"""Application configuration loaded from environment variables."""

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[".env", "../../.env"],  # look in api/ dir first, then repo root
        case_sensitive=False,
        extra="ignore",
    )

    # App
    environment: str = "development"
    log_level: str = "INFO"
    allowed_origins: list[str] = ["http://localhost:3000"]
    api_base_url: str = "http://localhost:8000"

    # Database — defaults to SQLite for local dev when PostgreSQL isn't running
    database_url: str = "sqlite+aiosqlite:///./entropy_dev.db"
    postgres_user: str = "entropy_admin"
    postgres_password: str = "change_me"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "entropy_minio"
    minio_secret_key: str = "change_me"
    minio_bucket_name: str = "entropy-rfp-documents"
    minio_secure: bool = False

    # JWT
    jwt_secret_key: str = "change_me_use_256_bit_random_string"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 480

    # LLM
    anthropic_api_key: str = ""
    anthropic_foundry_api_key: str = ""
    anthropic_foundry_base_url: str = ""   # Azure AI Foundry endpoint
    openai_api_key: str = ""
    primary_llm_model: str = "claude-opus-4-20250514"
    secondary_llm_model: str = "claude-sonnet-4-20250514"
    cohere_api_key: str = ""
    embedding_provider: str = "openai"  # openai | cohere | ollama
    embedding_model: str = "text-embedding-3-large"
    ollama_api_url: str = "http://localhost:11434"
    llm_provider: str = "anthropic"  # anthropic | ollama
    ollama_llm_model: str = "llama3.1:8b"

    # OCR
    ocr_provider: str = "azure"  # azure | tesseract
    azure_document_intelligence_endpoint: str = ""
    azure_document_intelligence_key: str = ""

    # Keycloak SSO
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "entropy"
    keycloak_client_id: str = "entropy-rfp-platform"
    keycloak_client_secret: str = ""

    # Observability
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"
    otel_service_name: str = "entropy-rfp-api"

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list) -> list[str]:
        if isinstance(v, list):
            return [str(o).strip() for o in v]
        if isinstance(v, str):
            v = v.strip()
            # Handle JSON array format: ["url1","url2"]
            if v.startswith("["):
                import json
                try:
                    return [str(o).strip() for o in json.loads(v)]
                except Exception:
                    pass
            # Handle comma-separated plain format: url1,url2
            return [o.strip() for o in v.split(",") if o.strip()]
        return [str(v)]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


settings = Settings()
