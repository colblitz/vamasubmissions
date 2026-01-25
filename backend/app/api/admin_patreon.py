"""Admin Patreon integration endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import httpx

from app.core.database import get_db
from app.services import user_service
from app.services.patreon_service import PatreonService, PatreonAPIError
from app.models.user import User
from app.models.admin_settings import AdminSettings
from app.core.config import settings

router = APIRouter()


@router.get("/patreon/tiers")
async def get_vama_tier_ids(
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Fetch VAMA's Patreon tier IDs and details.
    
    This endpoint queries the Patreon API to get all tier information for VAMA's campaign.
    Use this to find the tier IDs that should be allowed access to the site.
    
    Args:
        current_user: Current admin user
        db: Database session
    
    Returns:
        List of tiers with IDs, titles, and amounts
    """
    # Get admin's Patreon token
    admin_settings = (
        db.query(AdminSettings).filter(AdminSettings.user_id == current_user.id).first()
    )
    
    if not admin_settings or not admin_settings.patreon_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin must be logged in with Patreon to fetch tier information.",
        )
    
    # Check if token is expired and refresh if needed
    if admin_settings.is_token_expired:
        try:
            new_tokens = PatreonService.refresh_access_token(admin_settings.patreon_refresh_token)
            admin_settings.patreon_access_token = new_tokens["access_token"]
            admin_settings.patreon_refresh_token = new_tokens["refresh_token"]
            admin_settings.patreon_token_expires_at = datetime.utcnow() + timedelta(
                seconds=new_tokens["expires_in"]
            )
            admin_settings.updated_at = datetime.utcnow()
            db.commit()
        except PatreonAPIError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Failed to refresh Patreon token: {str(e)}",
            )
    
    # Fetch campaign tiers
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://www.patreon.com/api/oauth2/v2/campaigns/{settings.patreon_creator_id}",
            params={
                "include": "tiers",
                "fields[tier]": "title,amount_cents,description,patron_count,published",
            },
            headers={"Authorization": f"Bearer {admin_settings.patreon_access_token}"},
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to fetch tiers from Patreon: {response.text}",
            )
        
        data = response.json()
        
        # Extract tier information
        tiers = []
        for item in data.get("included", []):
            if item.get("type") == "tier":
                tier_attrs = item.get("attributes", {})
                tiers.append({
                    "id": item.get("id"),
                    "title": tier_attrs.get("title"),
                    "amount_cents": tier_attrs.get("amount_cents"),
                    "amount_dollars": tier_attrs.get("amount_cents", 0) / 100,
                    "description": tier_attrs.get("description"),
                    "patron_count": tier_attrs.get("patron_count"),
                    "published": tier_attrs.get("published"),
                })
        
        # Sort by amount
        tiers.sort(key=lambda t: t["amount_cents"])
        
        return {
            "campaign_id": settings.patreon_creator_id,
            "tiers": tiers,
            "total_tiers": len(tiers),
        }
