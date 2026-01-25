"""Application configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # Database
    database_url: str

    # Patreon OAuth
    patreon_client_id: str
    patreon_client_secret: str
    patreon_redirect_uri: str
    patreon_creator_id: str  # VAMA's campaign ID: 13637777
    
    # Patreon Tier Access Control
    # Comma-separated list of allowed Patreon tier IDs
    # Only users subscribed to these tiers can access the site
    # VAMA's Tiers:
    #   25126656 - Free ($0) - BLOCKED (not in list)
    #   25126680 - NSFW Art! Tier 1 ($6.90) - ALLOWED
    #   25126688 - NSFW Art! Tier 2 ($15) - ALLOWED
    #   25126693 - NSFW Art! Tier 3 ($30) - ALLOWED
    #   25147402 - NSFW Art! support ($60) - ALLOWED
    allowed_patreon_tier_ids: str = "25126680,25126688,25126693,25147402"

    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_days: int = 30

    # File uploads
    upload_dir: str = "./uploads"
    max_image_size_mb: int = 10
    max_images_per_submission: int = 20

    # Application
    environment: str = "development"
    frontend_url: str = "http://localhost:5173"

    # Admin
    admin_patreon_id: Optional[str] = None

    # Patreon API
    patreon_api_url: str = "https://www.patreon.com/api/oauth2/v2"
    patreon_authorize_url: str = "https://www.patreon.com/oauth2/authorize"
    patreon_token_url: str = "https://www.patreon.com/api/oauth2/token"

    @property
    def max_image_size_bytes(self) -> int:
        """Convert MB to bytes."""
        return self.max_image_size_mb * 1024 * 1024


settings = Settings()
