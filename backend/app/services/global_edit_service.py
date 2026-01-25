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
    def preview_global_edit(
        db: Session,
        field_name: str,
        old_value: str
    ) -> GlobalEditPreview:
        """
        Preview which posts would be affected by a global edit
        
        Args:
            db: Database session
            field_name: Field to search ('characters', 'series', 'tags')
            old_value: Value to search for
            
        Returns:
            GlobalEditPreview with list of affected posts
        """
        # Query posts that contain the old_value in the specified field
        # Using array contains operator @>
        query = db.query(Post).filter(
            Post.status == 'published'
        )
        
        if field_name == 'characters':
            query = query.filter(Post.characters.contains([old_value]))
        elif field_name == 'series':
            query = query.filter(Post.series.contains([old_value]))
        elif field_name == 'tags':
            query = query.filter(Post.tags.contains([old_value]))
        
        affected_posts = query.all()
        
        # Build preview response
        preview_posts = []
        for post in affected_posts:
            current_values = []
            if field_name == 'characters':
                current_values = post.characters or []
            elif field_name == 'series':
                current_values = post.series or []
            elif field_name == 'tags':
                current_values = post.tags or []
            
            preview_posts.append(GlobalEditPreviewPost(
                id=post.id,
                post_id=post.post_id,
                title=post.title,
                url=post.url,
                current_values=current_values
            ))
        
        return GlobalEditPreview(
            field_name=field_name,
            old_value=old_value,
            new_value="",  # Not set yet in preview
            affected_posts=preview_posts,
            affected_count=len(preview_posts)
        )

    @staticmethod
    def create_suggestion(
        db: Session,
        data: GlobalEditSuggestionCreate,
        suggester_id: int
    ) -> GlobalEditSuggestion:
        """
        Create a new global edit suggestion
        
        Args:
            db: Database session
            data: Suggestion data
            suggester_id: ID of user creating suggestion
            
        Returns:
            Created GlobalEditSuggestion
        """
        # Get preview to find affected posts
        preview = GlobalEditService.preview_global_edit(
            db, data.field_name, data.old_value
        )
        
        # Store previous values for undo
        previous_values = {}
        
        for post_data in preview.affected_posts:
            previous_values[str(post_data.id)] = post_data.current_values
        
        # Create suggestion
        suggestion = GlobalEditSuggestion(
            suggester_id=suggester_id,
            field_name=data.field_name,
            old_value=data.old_value,
            new_value=data.new_value,
            status='pending',
            previous_values=previous_values
        )
        
        db.add(suggestion)
        db.commit()
        db.refresh(suggestion)
        
        return suggestion

    @staticmethod
    def get_pending_suggestions(db: Session) -> List[GlobalEditSuggestion]:
        """Get all pending global edit suggestions"""
        return db.query(GlobalEditSuggestion).filter(
            GlobalEditSuggestion.status == 'pending'
        ).order_by(GlobalEditSuggestion.created_at.desc()).all()

    @staticmethod
    def get_suggestion_by_id(
        db: Session,
        suggestion_id: int
    ) -> Optional[GlobalEditSuggestion]:
        """Get a global edit suggestion by ID"""
        return db.query(GlobalEditSuggestion).filter(
            GlobalEditSuggestion.id == suggestion_id
        ).first()

    @staticmethod
    def approve_suggestion(
        db: Session,
        suggestion_id: int,
        approver_id: int
    ) -> GlobalEditSuggestion:
        """
        Approve and apply a global edit suggestion
        
        This performs a bulk update across all affected posts using PostgreSQL's
        array_replace function for atomic operation.
        
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
        
        if suggestion.status != 'pending':
            raise ValueError("Global edit suggestion is not pending")
        
        if suggestion.suggester_id == approver_id:
            raise ValueError("Cannot approve your own global edit suggestion")
        
        # Update all affected posts using array_replace
        # This is an atomic operation
        field_column = None
        if suggestion.field_name == 'characters':
            field_column = 'characters'
        elif suggestion.field_name == 'series':
            field_column = 'series'
        elif suggestion.field_name == 'tags':
            field_column = 'tags'
        
        # Use raw SQL for array_replace operation
        # array_replace(array, old_value, new_value)
        # Apply to all posts that contain the old value
        update_query = text(f"""
            UPDATE posts
            SET {field_column} = array_replace({field_column}, :old_value, :new_value),
                updated_at = NOW()
            WHERE status = 'published'
              AND :old_value = ANY({field_column})
        """)
        
        db.execute(
            update_query,
            {
                'old_value': suggestion.old_value,
                'new_value': suggestion.new_value
            }
        )
        
        # Update suggestion status
        suggestion.status = 'approved'
        suggestion.approver_id = approver_id
        suggestion.approved_at = datetime.utcnow()
        suggestion.applied_at = datetime.utcnow()
        
        db.commit()
        db.refresh(suggestion)
        
        return suggestion

    @staticmethod
    def reject_suggestion(
        db: Session,
        suggestion_id: int
    ) -> GlobalEditSuggestion:
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
        
        if suggestion.status != 'pending':
            raise ValueError("Global edit suggestion is not pending")
        
        suggestion.status = 'rejected'
        
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
        return db.query(GlobalEditSuggestion).filter(
            GlobalEditSuggestion.status == 'approved'
        ).order_by(GlobalEditSuggestion.applied_at.desc()).limit(limit).all()

    @staticmethod
    def undo_suggestion(
        db: Session,
        suggestion_id: int,
        admin_user_id: int
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
        
        if suggestion.status != 'approved':
            raise ValueError("Can only undo approved suggestions")
        
        if not suggestion.previous_values:
            raise ValueError("No previous values stored for undo")
        
        # Restore previous values for each post
        field_column = suggestion.field_name
        
        for post_id_str, previous_array in suggestion.previous_values.items():
            post_id = int(post_id_str)
            
            # Update the post with previous values
            update_query = text(f"""
                UPDATE posts
                SET {field_column} = :previous_values,
                    updated_at = NOW()
                WHERE id = :post_id
            """)
            
            db.execute(
                update_query,
                {
                    'previous_values': previous_array,
                    'post_id': post_id
                }
            )
        
        # Mark suggestion as undone (change status back to pending or add new status?)
        # For now, we'll keep it as approved but could add an 'undone' status
        # Let's add a note in the system that it was undone
        
        db.commit()
        db.refresh(suggestion)
        
        return suggestion
