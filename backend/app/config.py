from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_name: str = "AI-StudyCompanion"
    secret_key: str = "change-this-secret-key"
    cors_origins: str = "http://localhost:5173,http://localhost:80"

    # PostgreSQL
    postgres_user: str = "knowflow"
    postgres_password: str = "knowflow_secret"
    postgres_db: str = "knowflow"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    @property
    def database_url_sync(self) -> str:
        return f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    # MinIO
    minio_root_user: str = "knowflow"
    minio_root_password: str = "knowflow_secret"
    minio_host: str = "localhost"
    minio_port: int = 9000
    minio_bucket: str = "study-resources"
    minio_secure: bool = False

    @property
    def minio_endpoint(self) -> str:
        return f"{self.minio_host}:{self.minio_port}"

    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333

    @property
    def qdrant_url(self) -> str:
        return f"http://{self.qdrant_host}:{self.qdrant_port}"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
