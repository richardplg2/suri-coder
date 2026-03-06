from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Agent Coding API"
    debug: bool = False
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/agent_coding"
    anthropic_api_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
