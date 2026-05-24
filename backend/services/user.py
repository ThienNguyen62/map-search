import os
import sqlite3
import hashlib
import hmac
import binascii
import json
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

SQL_CREATE_FAVORITE_ROUTES = """
CREATE TABLE IF NOT EXISTS favorite_routes (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    route_name TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_name TEXT NOT NULL,
    source_lat REAL,
    source_lon REAL,
    target_lat REAL,
    target_lon REAL,
    path_json TEXT NOT NULL,
    stations_json TEXT NOT NULL,
    metro_time REAL NOT NULL,
    transfer_count INTEGER NOT NULL,
    saved_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
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
    cursor.execute(SQL_CREATE_FAVORITE_ROUTES)
    conn.commit()
    conn.close()
    _ensure_default_admin()

    # Ensure favorite_routes has coordinate columns (migration for older DBs)
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(favorite_routes)")
        cols = [r['name'] for r in cur.fetchall()]
        required = [('source_lat','REAL'), ('source_lon','REAL'), ('target_lat','REAL'), ('target_lon','REAL')]
        for name, _type in required:
            if name not in cols:
                cur.execute(f"ALTER TABLE favorite_routes ADD COLUMN {name} {_type}")
        conn.commit()
    except Exception:
        pass
    finally:
        try: conn.close()
        except Exception: pass


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


def list_favorite_routes(username: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT *
        FROM favorite_routes
        WHERE username = ?
        ORDER BY datetime(saved_at) DESC, datetime(created_at) DESC
        """,
        (username,)
    )
    rows = cursor.fetchall()
    conn.close()

    out = []
    for row in rows:
        item = dict(row)
        item['path'] = json.loads(item.get('path_json') or '[]')
        item['stations'] = json.loads(item.get('stations_json') or '[]')
        item['routeName'] = item.pop('route_name')
        item['sourceId'] = item.pop('source_id')
        item['sourceName'] = item.pop('source_name')
        item['targetId'] = item.pop('target_id')
        item['targetName'] = item.pop('target_name')
        # include optional coordinates
        s_lat = item.pop('source_lat', None)
        s_lon = item.pop('source_lon', None)
        t_lat = item.pop('target_lat', None)
        t_lon = item.pop('target_lon', None)
        item['sourceCoord'] = (s_lat is not None and s_lon is not None) and {'lat': s_lat, 'lon': s_lon} or None
        item['targetCoord'] = (t_lat is not None and t_lon is not None) and {'lat': t_lat, 'lon': t_lon} or None
        item['metroTime'] = item.pop('metro_time')
        item['transferCount'] = item.pop('transfer_count')
        item['savedAt'] = item.pop('saved_at')
        item.pop('path_json', None)
        item.pop('stations_json', None)
        item.pop('created_at', None)
        out.append(item)

    return out


def create_favorite_route(
    favorite_id: str,
    username: str,
    route_name: str,
    source_id: str,
    source_name: str,
    target_id: str,
    target_name: str,
    path: list,
    stations: list,
    metro_time: float,
    transfer_count: int,
    saved_at: str,
    source_lat: float | None = None,
    source_lon: float | None = None,
    target_lat: float | None = None,
    target_lon: float | None = None,
):
    conn = get_db_connection()
    cursor = conn.cursor()

    path_json = json.dumps(path or [], ensure_ascii=False)
    stations_json = json.dumps(stations or [], ensure_ascii=False)
    # Try to detect duplicates: match on ids+path or exact coordinates+path
    if source_id and target_id:
        cursor.execute(
            """
            SELECT id
            FROM favorite_routes
            WHERE username = ?
              AND source_id = ?
              AND target_id = ?
              AND path_json = ?
            LIMIT 1
            """,
            (username, source_id, target_id, path_json)
        )
    else:
        cursor.execute(
            """
            SELECT id
            FROM favorite_routes
            WHERE username = ?
              AND source_lat IS NOT NULL
              AND source_lon IS NOT NULL
              AND target_lat IS NOT NULL
              AND target_lon IS NOT NULL
              AND ABS(source_lat - ?) < 0.00001
              AND ABS(source_lon - ?) < 0.00001
              AND ABS(target_lat - ?) < 0.00001
              AND ABS(target_lon - ?) < 0.00001
              AND path_json = ?
            LIMIT 1
            """,
            (username, source_lat or 0.0, source_lon or 0.0, target_lat or 0.0, target_lon or 0.0, path_json)
        )
    duplicate = cursor.fetchone()
    if duplicate:
        conn.close()
        return {"ok": False, "reason": "duplicate"}

    created_at = datetime.utcnow().isoformat()
    cursor.execute(
        """
        INSERT INTO favorite_routes (
            id, username, route_name,
            source_id, source_name, target_id, target_name,
            source_lat, source_lon, target_lat, target_lon,
            path_json, stations_json,
            metro_time, transfer_count,
            saved_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            favorite_id,
            username,
            route_name,
            source_id,
            source_name,
            target_id,
            target_name,
            source_lat,
            source_lon,
            target_lat,
            target_lon,
            path_json,
            stations_json,
            float(metro_time),
            int(transfer_count),
            saved_at,
            created_at,
        )
    )
    conn.commit()
    conn.close()
    return {"ok": True}


def update_favorite_route_name(username: str, favorite_id: str, route_name: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE favorite_routes
        SET route_name = ?
        WHERE username = ? AND id = ?
        """,
        (route_name, username, favorite_id)
    )
    conn.commit()
    changed = cursor.rowcount
    conn.close()
    return changed > 0


def delete_favorite_route(username: str, favorite_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        DELETE FROM favorite_routes
        WHERE username = ? AND id = ?
        """,
        (username, favorite_id)
    )
    conn.commit()
    changed = cursor.rowcount
    conn.close()
    return changed > 0
