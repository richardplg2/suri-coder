from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Agent Coding API"
    debug: bool = False
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/agent_coding"
    anthropic_api_key: str = ""
    redis_url: str = "redis://localhost:6379"
    jwt_secret: str = "change-me-in-production"
    jwt_expire_minutes: int = 60 * 24  # 24 hours

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
