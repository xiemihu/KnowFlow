import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import settings

logger = logging.getLogger(__name__)

MIGRATIONS = [
    {
        "check": "SELECT column_name FROM information_schema.columns WHERE table_name='knowledge_points' AND column_name='group_id'",
        "sql": "ALTER TABLE knowledge_points ADD COLUMN group_id UUID REFERENCES knowledge_groups(id) ON DELETE SET NULL",
    },
    {
        "check": "SELECT table_name FROM information_schema.tables WHERE table_name='knowledge_groups'",
        "sql": """
            CREATE TABLE knowledge_groups (
                id UUID PRIMARY KEY,
                subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
                name VARCHAR(500) NOT NULL,
                description TEXT DEFAULT '',
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """,
    },
    {
        "check": "SELECT indexname FROM pg_indexes WHERE tablename='knowledge_points' AND indexname='ix_knowledge_points_group_id'",
        "sql": "CREATE INDEX ix_knowledge_points_group_id ON knowledge_points(group_id)",
    },
    {
        "check": "SELECT table_name FROM information_schema.tables WHERE table_name='chat_messages'",
        "sql": """
            CREATE TABLE chat_messages (
                id UUID PRIMARY KEY,
                subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
                user_id VARCHAR(255) DEFAULT 'default_user',
                role VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                seq_index INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """,
    },
    {
        "check": "SELECT indexname FROM pg_indexes WHERE tablename='chat_messages' AND indexname='ix_chat_messages_subject_id'",
        "sql": "CREATE INDEX ix_chat_messages_subject_id ON chat_messages(subject_id)",
    },
    {
        "check": "SELECT table_name FROM information_schema.tables WHERE table_name='subject_exercises'",
        "sql": """
            CREATE TABLE subject_exercises (
                id UUID PRIMARY KEY,
                subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
                question TEXT NOT NULL,
                answer TEXT DEFAULT '',
                explanation TEXT DEFAULT '',
                difficulty VARCHAR(50) DEFAULT 'medium',
                question_type VARCHAR(50) DEFAULT 'short_answer',
                options TEXT,
                source VARCHAR(255) DEFAULT 'ai_generated',
                is_correct BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """,
    },
    {
        "check": "SELECT table_name FROM information_schema.tables WHERE table_name='exercise_kp_links'",
        "sql": """
            CREATE TABLE exercise_kp_links (
                exercise_id UUID NOT NULL REFERENCES subject_exercises(id) ON DELETE CASCADE,
                kp_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
                PRIMARY KEY (exercise_id, kp_id)
            )
        """,
    },
    {
        "check": "SELECT indexname FROM pg_indexes WHERE tablename='subject_exercises' AND indexname='ix_subject_exercises_subject_id'",
        "sql": "CREATE INDEX ix_subject_exercises_subject_id ON subject_exercises(subject_id)",
    },
    {
        "check": "SELECT table_name FROM information_schema.tables WHERE table_name='conversations'",
        "sql": """
            CREATE TABLE conversations (
                id UUID PRIMARY KEY,
                subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
                user_id VARCHAR(255) DEFAULT 'default_user',
                title VARCHAR(500) DEFAULT '新对话',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """,
    },
    {
        "check": "SELECT column_name FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='conversation_id'",
        "sql": "ALTER TABLE chat_messages ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE",
    },
    {
        "check": "SELECT indexname FROM pg_indexes WHERE tablename='chat_messages' AND indexname='ix_chat_messages_conversation_id'",
        "sql": "CREATE INDEX ix_chat_messages_conversation_id ON chat_messages(conversation_id)",
    },
    {
        "check": "SELECT column_name FROM information_schema.columns WHERE table_name='knowledge_points' AND column_name='is_important'",
        "sql": "ALTER TABLE knowledge_points ADD COLUMN is_important BOOLEAN DEFAULT false",
    },
    {
        "check": "SELECT column_name FROM information_schema.columns WHERE table_name='knowledge_points' AND column_name='is_difficult'",
        "sql": "ALTER TABLE knowledge_points ADD COLUMN is_difficult BOOLEAN DEFAULT false",
    },
]


async def run_migrations():
    engine = create_async_engine(settings.database_url, echo=False)
    async with engine.begin() as conn:
        for migration in MIGRATIONS:
            try:
                result = await conn.execute(text(migration["check"]))
                exists = result.fetchone() is not None
                if not exists:
                    logger.info(f"Running migration: {migration['sql'][:80]}...")
                    await conn.execute(text(migration["sql"]))
                    logger.info("Migration completed")
                else:
                    logger.debug(f"Skipping migration (already exists)")
            except Exception as e:
                logger.warning(f"Migration check failed (table may not exist yet): {e}")
    await engine.dispose()
    logger.info("All migrations completed")
