import os
import sqlite3
import hashlib
import hmac
import binascii
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "users.db")

SQL_CREATE_USERS = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
);
"""

SQL_CREATE_LOGIN_HISTORY = """
CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    FOREIGN KEY (username) REFERENCES users (username)
);
"""


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str, salt: bytes | None = None) -> str:
    if salt is None:
        salt = os.urandom(16)
    else:
        if isinstance(salt, str):
            salt = binascii.unhexlify(salt)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
    return f"{binascii.hexlify(salt).decode('ascii')}:{binascii.hexlify(pwd_hash).decode('ascii')}"


def verify_password(stored_password: str, provided_password: str) -> bool:
    try:
        salt_hex, hash_hex = stored_password.split(':')
        salt = binascii.unhexlify(salt_hex)
        expected_hash = binascii.unhexlify(hash_hex)
        test_hash = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt, 100_000)
        return hmac.compare_digest(test_hash, expected_hash)
    except Exception:
        return False


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(SQL_CREATE_USERS)
    cursor.execute(SQL_CREATE_LOGIN_HISTORY)
    conn.commit()
    conn.close()
    _ensure_default_admin()


def _ensure_default_admin():
    if get_user_by_username('admin'):
        return

    password_hash = hash_password('Admin@123')
    create_user(
        username='admin',
        email='admin@metro.local',
        password_hash=password_hash,
        first_name='Admin',
        last_name='User',
        phone='',
        role='admin'
    )


def create_user(username: str, email: str, password_hash: str, first_name: str, last_name: str, phone: str = '', role: str = 'user') -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (username, email, password_hash, first_name, last_name, phone, role, created_at)
    )
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()
    return user_id


def get_user_by_username(username: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_email(email: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def list_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, first_name, last_name, phone, role, created_at FROM users ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def record_login_attempt(username: str, ip_address: str = None, user_agent: str = None, success: bool = True):
    """Record a login attempt in the history table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    timestamp = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO login_history (username, timestamp, ip_address, user_agent, success) VALUES (?, ?, ?, ?, ?)",
        (username, timestamp, ip_address, user_agent, success)
    )
    conn.commit()
    conn.close()


def get_login_history(limit: int = 100):
    """Get recent login history for all users."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT lh.*, u.first_name, u.last_name, u.email
        FROM login_history lh
        JOIN users u ON lh.username = u.username
        ORDER BY lh.timestamp DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_user_login_history(username: str, limit: int = 50):
    """Get login history for a specific user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM login_history
        WHERE username = ?
        ORDER BY timestamp DESC
        LIMIT ?
    """, (username, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
