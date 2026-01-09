import os
import asyncpg
import logging

logger = logging.getLogger(__name__)

async def init_db(pool: asyncpg.Pool):
    """
    Initialize the database by running SQL schema files if tables are missing.
    """
    try:
        # Simple check: if 'sensors' table exists, assume DB is initialized.
        # In a real migration system, we would check a migrations table.
        async with pool.acquire() as connection:
            table_exists = await connection.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'metadata' 
                    AND table_name = 'sensors'
                );
            """)

            if table_exists:
                logger.info("✅ Database already initialized (table 'sensors' found).")
                return

            logger.info("⚠️ Database empty or missing tables. Starting initialization...")

            schema_dir = "/app/schemas"
            if not os.path.exists(schema_dir):
                logger.error(f"❌ Schema directory not found: {schema_dir}")
                return

            # List of schema files in order
            schema_files = sorted([f for f in os.listdir(schema_dir) if f.endswith(".sql")])
            
            if not schema_files:
                logger.warning(f"⚠️ No SQL files found in {schema_dir}")
                return

            for filename in schema_files:
                file_path = os.path.join(schema_dir, filename)
                logger.info(f"📜 Executing {filename}...")
                
                with open(file_path, "r") as f:
                    sql_content = f.read()
                    
                # Execute the SQL script
                await connection.execute(sql_content)
                logger.info(f"✅ Executed {filename}")

            logger.info("🎉 Database initialization complete.")

    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise
