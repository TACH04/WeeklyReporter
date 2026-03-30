import sqlite3
import os
import sys

DB_NAME = "weekly_reporter.db"

def get_app_data_dir():
    """Returns a persistent, writable data directory outside the app bundle.
    Safe for both development and PyInstaller-bundled (.app / .exe) modes."""
    if sys.platform == 'darwin':
        base = os.path.expanduser("~/Library/Application Support")
    elif sys.platform == 'win32':
        base = os.environ.get('APPDATA', os.path.expanduser("~"))
    else:
        base = os.path.expanduser("~")
    path = os.path.join(base, "Weekly Reporter")
    os.makedirs(path, exist_ok=True)
    return path

DB_PATH = os.path.join(get_app_data_dir(), DB_NAME)

def get_db():
    """Returns a new SQLite connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # This allows accessing columns by name
    return conn

def init_db():
    """Initializes the database schema if it doesn't exist."""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS residents (
            asu_id TEXT PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            room TEXT
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asu_id TEXT,
            content TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (asu_id) REFERENCES residents (asu_id)
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    
    conn.commit()
    conn.close()

# Initialize tables when the module is imported
init_db()
