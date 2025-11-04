#!/usr/bin/env python3
"""
ML Admin API for monitoring and managing the ML service.
Refactored for reliable SSE, cleaner config, safer IO, and clearer status.
"""

import os
import json
import time
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Generator, Optional

import redis
import requests
from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS

# -----------------------------------
# Config
# -----------------------------------
MODEL_PATH = os.getenv('MODEL_PATH', '/shared/models/twotower_v6_optimal.pt')
LOG_PATH = os.getenv('LOG_PATH', '/shared/logs/training.log')
CURRENT_TRAINING_LOG = os.getenv('CURRENT_TRAINING_LOG', '/shared/logs/current_training.log')
NEXT_TRAINING_FILE = os.getenv('NEXT_TRAINING_FILE', '/shared/logs/next_training.json')
TRIGGER_FILE = os.getenv('TRIGGER_FILE', '/shared/logs/trigger_training.flag')
ML_SERVICE_URL = os.getenv('ML_SERVICE_URL', 'http://ml-service:5000')

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379')
REDIS_CHANNEL = os.getenv('REDIS_CHANNEL', 'training_logs')
REDIS_CURRENT_KEY = os.getenv('REDIS_CURRENT_KEY', 'training_stream_current')

SSE_HEARTBEAT_SECONDS = int(os.getenv('SSE_HEARTBEAT_SECONDS', '10'))
SSE_BLOCK_MS = int(os.getenv('SSE_BLOCK_MS', '1000'))  # XREAD block ms

# -----------------------------------
# App
# -----------------------------------
app = Flask(__name__)
CORS(app, supports_credentials=True)

# -----------------------------------
# Redis
# -----------------------------------
def connect_redis() -> Optional[redis.Redis]:
    try:
        client = redis.from_url(REDIS_URL, decode_responses=True)
        client.ping()
        print("Connected to Redis successfully")
        return client
    except Exception as e:
        print(f"Failed to connect to Redis: {e}")
        return None

redis_client = connect_redis()

# -----------------------------------
# Helpers
# -----------------------------------
def _file_exists(path: str) -> bool:
    try:
        return os.path.exists(path)
    except Exception:
        return False

def _tail_json_lines(path: str, limit: int) -> list:
    if not _file_exists(path):
        return []
    out = []
    try:
        with open(path, 'r') as f:
            lines = f.readlines()[-limit:]
        for line in lines:
            try:
                out.append(json.loads(line.strip()))
            except json.JSONDecodeError:
                continue
    except Exception:
        pass
    return list(reversed(out))

def _process_running(name: str) -> bool:
    try:
        result = subprocess.run(['pgrep', '-f', name], capture_output=True, text=True)
        return bool(result.stdout.strip())
    except Exception:
        return False

def _recently_modified(path: str, seconds: int = 30) -> bool:
    if not _file_exists(path):
        return False
    try:
        mtime = os.path.getmtime(path)
        return (datetime.now().timestamp() - mtime) < seconds
    except Exception:
        return False

# -----------------------------------
# Routes
# -----------------------------------
@app.get('/health')
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()}), 200

@app.get('/api/model/info')
def get_model_info():
    try:
        if _file_exists(MODEL_PATH):
            stat = os.stat(MODEL_PATH)
            size_mb = round(stat.st_size / (1024 * 1024), 2)
            mtime = datetime.fromtimestamp(stat.st_mtime)
            return jsonify({
                'exists': True,
                'path': MODEL_PATH,
                'size_mb': size_mb,
                'last_modified': mtime.isoformat(),
                'age_hours': round((datetime.now() - mtime).total_seconds() / 3600, 2)
            }), 200
        return jsonify({'exists': False, 'path': MODEL_PATH, 'message': 'Model file not found'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.get('/api/training/logs')
def get_training_logs():
    try:
        limit = max(1, min(500, int(request.args.get('limit', 50))))
        return jsonify(_tail_json_lines(LOG_PATH, limit)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.get('/api/training/status')
def get_training_status():
    """
    Training considered 'active' if:
    - train_from_db.py process is running OR
    - CURRENT_TRAINING_LOG modified in last 30s,
    and not explicitly marked completed in the file.
    """
    try:
        is_training = _process_running('train_from_db.py') or _recently_modified(CURRENT_TRAINING_LOG, 30)
        last_training = None
        logs = _tail_json_lines(LOG_PATH, 1)
        if logs:
            last_training = logs[0]

        # If the current log contains completion/skip, treat as idle.
        if _file_exists(CURRENT_TRAINING_LOG):
            try:
                txt = Path(CURRENT_TRAINING_LOG).read_text()
                if 'TRAINING COMPLETED' in txt or 'Training skipped' in txt:
                    is_training = False
            except Exception:
                pass

        return jsonify({'is_training': bool(is_training), 'last_training': last_training}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.get('/api/training/next')
def get_next_training():
    try:
        if _file_exists(NEXT_TRAINING_FILE):
            with open(NEXT_TRAINING_FILE, 'r') as f:
                return jsonify(json.load(f)), 200
        return jsonify({'next_training': None, 'interval_hours': int(os.getenv('TRAINING_INTERVAL_HOURS', '8'))}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.post('/api/training/trigger')
def trigger_training():
    """
    Creates a new Redis stream id and writes it to REDIS_CURRENT_KEY.
    Drops a trigger flag file for the scheduler to pick up.
    """
    try:
        stream_id = datetime.utcnow().strftime('%Y%m%dT%H%M%S%fZ')
        stream_key = f"{REDIS_CHANNEL}:{stream_id}"

        if redis_client:
            try:
                redis_client.set(REDIS_CURRENT_KEY, stream_key)
                # Seed messages so UI sees immediate activity
                redis_client.xadd(stream_key, {'message': f"Training triggered at {stream_id}"}, maxlen=500)
                redis_client.xadd(stream_key, {'message': "Waiting for training to start..."}, maxlen=500)
            except Exception:
                pass

        # Create trigger file (scheduler will remove it)
        with open(TRIGGER_FILE, 'w') as f:
            f.write(stream_id)

        return jsonify({'message': 'Training triggered successfully', 'timestamp': datetime.utcnow().isoformat()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.get('/api/training/logs/stream')
def stream_training_logs():
    """
    SSE stream reading from the latest Redis Stream referenced by REDIS_CURRENT_KEY.
    - Sends heartbeat every SSE_HEARTBEAT_SECONDS to keep connection alive.
    - Supports Last-Event-ID so the client can resume.
    """
    def sse(data: str, event: Optional[str] = None, id_: Optional[str] = None) -> str:
        parts = []
        if event:
            parts.append(f"event: {event}")
        if id_:
            parts.append(f"id: {id_}")
        parts.append(f"data: {data}")
        return "\n".join(parts) + "\n\n"

    def generate() -> Generator[str, None, None]:
        if not redis_client:
            yield sse("Redis unavailable", event="error")
            return

        yield sse("Connected to training stream...")

        stream_key = redis_client.get(REDIS_CURRENT_KEY) or REDIS_CHANNEL
        last_id = request.headers.get('Last-Event-ID') or '0-0'
        last_heartbeat = time.time()

        while True:
            try:
                messages = redis_client.xread({stream_key: last_id}, count=50, block=SSE_BLOCK_MS)
                if messages:
                    _, stream_messages = messages[0]
                    for msg_id, msg_data in stream_messages:
                        last_id = msg_id
                        line = msg_data.get('message', '')
                        if line == '[TRAINING_COMPLETED]':
                            yield sse("[TRAINING COMPLETED]", event="complete", id_=msg_id)
                            return
                        if line and line != '[TRAINING_START]':
                            yield sse(line, id_=msg_id)

                # Heartbeat
                now = time.time()
                if now - last_heartbeat > SSE_HEARTBEAT_SECONDS:
                    last_heartbeat = now
                    yield sse("💓", event="heartbeat", id_=last_id)

            except GeneratorExit:
                return
            except Exception as e:
                # brief backoff
                yield sse(f"stream_error:{str(e)}", event="error")
                time.sleep(0.5)

    headers = {
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
    }
    return Response(stream_with_context(generate()), headers=headers)

@app.get('/api/training/logs/current')
def get_current_training_logs():
    try:
        if not _file_exists(CURRENT_TRAINING_LOG):
            return jsonify({'logs': [], 'is_training': False}), 200

        with open(CURRENT_TRAINING_LOG, 'r') as f:
            lines = [ln.rstrip() for ln in f.readlines()]

        is_training = _process_running('train_from_db.py') or _recently_modified(CURRENT_TRAINING_LOG, 30)
        text = "\n".join(lines)
        if 'TRAINING COMPLETED' in text or 'Training skipped' in text:
            is_training = False

        return jsonify({'logs': lines, 'is_training': bool(is_training)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.get('/api/ml-service/health')
def check_ml_service():
    try:
        r = requests.get(f'{ML_SERVICE_URL}/health', timeout=5)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'status': 'unavailable', 'error': str(e)}), 503

@app.get('/api/stats')
def get_stats():
    import psycopg2
    from psycopg2.extras import RealDictCursor
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'postgres'),
            port=os.getenv('DB_PORT', '5432'),
            database=os.getenv('DB_NAME', 'teamup'),
            user=os.getenv('DB_USER', 'teamup_user'),
            password=os.getenv('DB_PASSWORD', 'teamup_password'),
            cursor_factory=RealDictCursor
        )
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) as count FROM users')
        total_users = cur.fetchone()['count']

        cur.execute('''
            SELECT 
              COALESCE(SUM(array_length(liked, 1)),0) as total_likes,
              COALESCE(SUM(array_length(disliked, 1)),0) as total_dislikes
            FROM users
        ''')
        row = cur.fetchone()
        total_likes = row['total_likes']
        total_dislikes = row['total_dislikes']
        cur.close(); conn.close()

        return jsonify({
            'total_users': total_users,
            'total_likes': total_likes,
            'total_dislikes': total_dislikes,
            'total_interactions': total_likes + total_dislikes
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6000, debug=True)
