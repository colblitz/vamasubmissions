"""
Service layer for global edit suggestions (bulk rename functionality)
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.post import Post
from app.models.global_edit import GlobalEditSuggestion
from app.models.user import User
from app.schemas.global_edit import (
    GlobalEditSuggestionCreate,
    GlobalEditPreview,
    GlobalEditPreviewPost,
)
from datetime import datetime
import json


class GlobalEditService:
    """Service for managing global edit suggestions"""

    @staticmethod
    def preview_global_edit(db: Session, field_name: str, pattern: str) -> GlobalEditPreview:
        """
        Preview which posts would be affected by a global edit

        Args:
            db: Database session
            field_name: Field to search ('characters', 'series', 'tags')
            pattern: Pattern to search for (supports wildcards with *)
                     Example: "Marin*" matches "Marin", "Marina", "Marine", etc.

        Returns:
            GlobalEditPreview with list of affected posts
        """
        # Convert pattern to SQL ILIKE pattern (replace * with % for SQL wildcard)
        sql_pattern = pattern.replace('*', '%')
        
        # Query posts using raw SQL with EXISTS for pattern matching
        query_text = text(f"""
            SELECT id, post_id, title, {field_name}
            FROM posts
            WHERE status = 'published'
              AND EXISTS (
                SELECT 1 
                FROM unnest({field_name}) AS val 
                WHERE val ILIKE :pattern
              )
        """)
        
        result = db.execute(query_text, {"pattern": sql_pattern})
        rows = result.fetchall()

        # Build preview response
        preview_posts = []
        for row in rows:
            # Construct URL from post_id
            post_url = f"https://www.patreon.com/posts/{row[1]}"
            current_values = row[3] or []  # The field_name column

            preview_posts.append(
                GlobalEditPreviewPost(
                    id=row[0],
                    post_id=row[1],
                    title=row[2],
                    url=post_url,
                    current_values=current_values,
                )
            )

        return GlobalEditPreview(
            field_name=field_name,
            pattern=pattern,
            action="",  # Not set yet in preview
            action_value=None,
            affected_posts=preview_posts,
            affected_count=len(preview_posts),
        )

    @staticmethod
    def create_suggestion(
        db: Session, data: GlobalEditSuggestionCreate, suggester_id: int
    ) -> GlobalEditSuggestion:
        """
        Create a new global edit suggestion

        Args:
            db: Database session
            data: Suggestion data (with condition_field, action_field, pattern, action, and action_value)
            suggester_id: ID of user creating suggestion

        Returns:
            Created GlobalEditSuggestion
        """
        # Get preview to find affected posts based on condition_field
        preview = GlobalEditService.preview_global_edit(db, data.condition_field, data.pattern)

        # Store previous values for undo (from the action_field)
        previous_values = {}

        # We need to get the current values of the action_field for affected posts
        for post_data in preview.affected_posts:
            # Get the post to access the action_field values
            post = db.query(Post).filter(Post.id == post_data.id).first()
            if post:
                # Get the current values of the action_field
                action_field_values = getattr(post, data.action_field, [])
                previous_values[str(post_data.id)] = action_field_values or []

        # Create suggestion
        suggestion = GlobalEditSuggestion(
            suggester_id=suggester_id,
            field_name=data.condition_field,  # Store condition field as field_name
            pattern=data.pattern,
            action=data.action,
            action_field=data.action_field,  # Store the field to modify
            action_value=data.action_value,
            status="pending",
            previous_values=previous_values,
        )

        db.add(suggestion)
        db.commit()
        db.refresh(suggestion)

        return suggestion

    @staticmethod
    def get_pending_suggestions(db: Session) -> List[GlobalEditSuggestion]:
        """Get all pending global edit suggestions"""
        return (
            db.query(GlobalEditSuggestion)
            .filter(GlobalEditSuggestion.status == "pending")
            .order_by(GlobalEditSuggestion.created_at.desc())
            .all()
        )

    @staticmethod
    def get_suggestion_by_id(db: Session, suggestion_id: int) -> Optional[GlobalEditSuggestion]:
        """Get a global edit suggestion by ID"""
        return (
            db.query(GlobalEditSuggestion).filter(GlobalEditSuggestion.id == suggestion_id).first()
        )

    @staticmethod
    def approve_suggestion(
        db: Session, suggestion_id: int, approver_id: int
    ) -> GlobalEditSuggestion:
        """
        Approve and apply a global edit suggestion

        This performs a bulk update across all affected posts using pattern matching
        and array operations (ADD or DELETE).

        Args:
            db: Database session
            suggestion_id: ID of suggestion to approve
            approver_id: ID of user approving

        Returns:
            Updated GlobalEditSuggestion

        Raises:
            ValueError: If suggestion not found, already processed, or approver is suggester
        """
        suggestion = GlobalEditService.get_suggestion_by_id(db, suggestion_id)

        if not suggestion:
            raise ValueError("Global edit suggestion not found")

        if suggestion.status != "pending":
            raise ValueError("Global edit suggestion is not pending")

        # Check if approver is different from suggester (unless approver is admin)
        if suggestion.suggester_id == approver_id:
            # Get approver user to check if they're an admin
            from app.models.user import User
            approver = db.query(User).filter(User.id == approver_id).first()
            if not approver or approver.role != "admin":
                raise ValueError("Cannot approve your own global edit suggestion")

        # field_name is the condition field (where to match the pattern)
        condition_field = suggestion.field_name
        # action_field is where to perform the ADD/DELETE operation
        action_field = suggestion.action_field
        
        # Get pattern and action from suggestion
        pattern = suggestion.pattern
        action = suggestion.action
        action_value = suggestion.action_value
        
        # Convert pattern to SQL ILIKE pattern
        sql_pattern = pattern.replace('*', '%')

        if action == 'ADD':
            # ADD: Add action_value to action_field for all posts matching the pattern in condition_field
            # Only add if the value doesn't already exist
            update_query = text(f"""
                UPDATE posts
                SET {action_field} = array_append({action_field}, :action_value),
                    updated_at = NOW()
                WHERE status = 'published'
                  AND EXISTS (
                    SELECT 1 
                    FROM unnest({condition_field}) AS val 
                    WHERE val ILIKE :pattern
                  )
                  AND NOT (:action_value = ANY({action_field}))
            """)
            
            db.execute(
                update_query, 
                {"pattern": sql_pattern, "action_value": action_value}
            )
            
        elif action == 'DELETE':
            # DELETE: Remove all values matching the pattern from action_field
            # First, find all distinct values that match the pattern in the action_field
            find_values_query = text(f"""
                SELECT DISTINCT val
                FROM posts, unnest({action_field}) AS val
                WHERE status = 'published'
                  AND val ILIKE :pattern
                  AND EXISTS (
                    SELECT 1 
                    FROM unnest({condition_field}) AS cval 
                    WHERE cval ILIKE :pattern
                  )
            """)
            
            result = db.execute(find_values_query, {"pattern": sql_pattern})
            matching_values = [row[0] for row in result.fetchall()]
            
            # Remove each matching value from all posts that match the condition
            for value_to_remove in matching_values:
                delete_query = text(f"""
                    UPDATE posts
                    SET {action_field} = array_remove({action_field}, :value_to_remove),
                        updated_at = NOW()
                    WHERE status = 'published'
                      AND EXISTS (
                        SELECT 1 
                        FROM unnest({condition_field}) AS cval 
                        WHERE cval ILIKE :pattern
                      )
                      AND :value_to_remove = ANY({action_field})
                """)
                
                db.execute(delete_query, {"value_to_remove": value_to_remove, "pattern": sql_pattern})

        # Update suggestion status
        suggestion.status = "approved"
        suggestion.approver_id = approver_id
        suggestion.approved_at = datetime.utcnow()
        suggestion.applied_at = datetime.utcnow()

        db.commit()
        db.refresh(suggestion)

        return suggestion

    @staticmethod
    def reject_suggestion(db: Session, suggestion_id: int) -> GlobalEditSuggestion:
        """
        Reject a global edit suggestion

        Args:
            db: Database session
            suggestion_id: ID of suggestion to reject

        Returns:
            Updated GlobalEditSuggestion

        Raises:
            ValueError: If suggestion not found or already processed
        """
        suggestion = GlobalEditService.get_suggestion_by_id(db, suggestion_id)

        if not suggestion:
            raise ValueError("Global edit suggestion not found")

        if suggestion.status != "pending":
            raise ValueError("Global edit suggestion is not pending")

        suggestion.status = "rejected"

        db.commit()
        db.refresh(suggestion)

        return suggestion

    @staticmethod
    def get_history(db: Session, limit: int = 50) -> List[GlobalEditSuggestion]:
        """
        Get history of approved global edit suggestions

        Args:
            db: Database session
            limit: Maximum number of results

        Returns:
            List of approved suggestions, newest first
        """
        return (
            db.query(GlobalEditSuggestion)
            .filter(GlobalEditSuggestion.status == "approved")
            .order_by(GlobalEditSuggestion.applied_at.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def undo_suggestion(
        db: Session, suggestion_id: int, admin_user_id: int
    ) -> GlobalEditSuggestion:
        """
        Undo a previously applied global edit suggestion (admin only)

        This restores the previous values from the stored previous_values JSONB.

        Args:
            db: Database session
            suggestion_id: ID of suggestion to undo
            admin_user_id: ID of admin performing undo

        Returns:
            Updated GlobalEditSuggestion

        Raises:
            ValueError: If suggestion not found or not approved
        """
        suggestion = GlobalEditService.get_suggestion_by_id(db, suggestion_id)

        if not suggestion:
            raise ValueError("Global edit suggestion not found")

        if suggestion.status != "approved":
            raise ValueError("Can only undo approved suggestions")

        if not suggestion.previous_values:
            raise ValueError("No previous values stored for undo")

        # Restore previous values for each post (using action_field since that's what was modified)
        action_field = suggestion.action_field

        for post_id_str, previous_array in suggestion.previous_values.items():
            post_id = int(post_id_str)

            # Update the post with previous values
            update_query = text(f"""
                UPDATE posts
                SET {action_field} = :previous_values,
                    updated_at = NOW()
                WHERE id = :post_id
            """)

            db.execute(update_query, {"previous_values": previous_array, "post_id": post_id})

        # Mark suggestion as undone (change status back to pending or add new status?)
        # For now, we'll keep it as approved but could add an 'undone' status
        # Let's add a note in the system that it was undone

        db.commit()
        db.refresh(suggestion)

        return suggestion
