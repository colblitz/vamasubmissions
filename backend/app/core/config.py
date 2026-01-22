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
    patreon_creator_id: str

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
