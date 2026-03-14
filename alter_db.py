import sqlite3

def upgrade_db():
    conn = sqlite3.connect('nomad_hub.db')
    cursor = conn.cursor()
    commands = [
        "ALTER TABLE accounts ADD COLUMN browser_type TEXT DEFAULT 'chromium';",
        "ALTER TABLE accounts ADD COLUMN proxy TEXT;",
        "ALTER TABLE accounts ADD COLUMN user_agent TEXT;",
        "ALTER TABLE accounts ADD COLUMN lightweight_mode BOOLEAN DEFAULT 0;"
    ]
    for cmd in commands:
        try:
            cursor.execute(cmd)
            print(f"Success: {cmd}")
        except Exception as e:
            print(f"Error executing {cmd}: {e}")
            
    conn.commit()
    conn.close()

if __name__ == '__main__':
    upgrade_db()
