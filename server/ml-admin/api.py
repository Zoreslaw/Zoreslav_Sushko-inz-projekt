#!/usr/bin/env python3
"""
ML Admin API for monitoring and managing the ML service.
Refactored for reliable SSE, cleaner config, safer IO, and clearer status.
"""

import os
import re
import json
import time
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Generator, Optional

import redis
import requests
from flask import Flask, jsonify, request, Response, stream_with_context
from werkzeug.utils import secure_filename
from flask_cors import CORS

# -----------------------------------
# Config
# -----------------------------------
MODEL_PATH = os.getenv('MODEL_PATH', '/shared/models/twotower_v6_optimal.pt')
MODELS_DIR = os.getenv('MODELS_DIR', '/shared/models')
LOG_PATH = os.getenv('LOG_PATH', '/shared/logs/training.log')
CURRENT_TRAINING_LOG = os.getenv('CURRENT_TRAINING_LOG', '/shared/logs/current_training.log')
NEXT_TRAINING_FILE = os.getenv('NEXT_TRAINING_FILE', '/shared/logs/next_training.json')
TRIGGER_FILE = os.getenv('TRIGGER_FILE', '/shared/logs/trigger_training.flag')
STOP_TRAINING_FILE = os.getenv('STOP_TRAINING_FILE', '/shared/logs/stop_training.flag')
ML_SERVICE_URL = os.getenv('ML_SERVICE_URL', 'http://ml-service:5000')
CB_SERVICE_URL = os.getenv('CB_SERVICE_URL', 'http://cb-service:5001')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://backend:8080')

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379')
REDIS_CHANNEL = os.getenv('REDIS_CHANNEL', 'training_logs')
REDIS_CURRENT_KEY = os.getenv('REDIS_CURRENT_KEY', 'training_stream_current')

SSE_HEARTBEAT_SECONDS = int(os.getenv('SSE_HEARTBEAT_SECONDS', '10'))
SSE_BLOCK_MS = int(os.getenv('SSE_BLOCK_MS', '1000'))  # XREAD block ms
TRAINING_ACTIVE_WINDOW_SECONDS = int(os.getenv('TRAINING_ACTIVE_WINDOW_SECONDS', '300'))

CURRENT_MODEL_VERSION_FILE = os.getenv(
    'CURRENT_MODEL_VERSION_FILE',
    os.path.join(MODELS_DIR, 'current_model_version.txt')
)

# -----------------------------------
# App
# -----------------------------------
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB limit
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

def _read_json_lines(path: str) -> list:
    if not _file_exists(path):
        return []
    out = []
    try:
        with open(path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except Exception:
        return []
    return out

def _parse_model_version(filename: str) -> Optional[str]:
    if not filename.endswith('.pt'):
        return None
    prefix = 'twotower_v6_'
    if not filename.startswith(prefix):
        return None
    return filename[len(prefix):-3]

def _is_valid_version(version: str) -> bool:
    return bool(re.match(r'^[A-Za-z0-9_-]+$', version))

def _get_current_model_version() -> Optional[str]:
    try:
        if _file_exists(CURRENT_MODEL_VERSION_FILE):
            return Path(CURRENT_MODEL_VERSION_FILE).read_text().strip() or None
    except Exception:
        return None
    return None

def _set_current_model_version(version: str) -> None:
    try:
        Path(CURRENT_MODEL_VERSION_FILE).write_text(version.strip())
    except Exception:
        pass

def _build_model_history() -> list:
    models = []
    history = _read_json_lines(LOG_PATH)
    history_by_version = {}
    for entry in history:
        ver = entry.get('model_version')
        if ver:
            history_by_version[ver] = entry

    current_version = _get_current_model_version()
    current_size = None
    current_mtime = None
    if not current_version and _file_exists(MODEL_PATH):
        try:
            stat = os.stat(MODEL_PATH)
            current_size = stat.st_size
            current_mtime = int(stat.st_mtime)
        except Exception:
            current_size = None
            current_mtime = None
    try:
        entries = list(Path(MODELS_DIR).glob('twotower_v6_*.pt'))
    except Exception:
        entries = []

    for p in entries:
        version = _parse_model_version(p.name)
        if not version:
            continue
        try:
            stat = p.stat()
            size_mb = round(stat.st_size / (1024 * 1024), 2)
            created_at = datetime.fromtimestamp(stat.st_mtime).isoformat()
            same_as_current = (
                current_version is not None and version == current_version
            ) or (
                current_version is None
                and current_size is not None
                and current_mtime is not None
                and stat.st_size == current_size
                and int(stat.st_mtime) == current_mtime
            )
        except Exception:
            size_mb = 0.0
            created_at = datetime.utcnow().isoformat()
            same_as_current = False

        log_entry = history_by_version.get(version, {})
        status = log_entry.get('status') or 'external'
        models.append({
            'filename': p.name,
            'version': version,
            'path': str(p),
            'size_mb': size_mb,
            'created_at': created_at,
            'is_current': bool(same_as_current),
            'num_users': log_entry.get('num_users'),
            'num_interactions': log_entry.get('num_interactions'),
            'duration_seconds': log_entry.get('duration_seconds'),
            'status': status,
        })

    models.sort(key=lambda m: m.get('created_at', ''), reverse=True)
    return models

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

def _get_latest_stream_key(client: Optional[redis.Redis]) -> Optional[str]:
    if not client:
        return None
    try:
        current = client.get(REDIS_CURRENT_KEY)
        if current:
            return current
        latest = None
        prefix = f"{REDIS_CHANNEL}:"
        for key in client.scan_iter(match=f"{prefix}*"):
            if not latest or key > latest:
                latest = key
        return latest
    except Exception:
        return None

def _get_stream_last_message(client: Optional[redis.Redis], stream_key: Optional[str]) -> Optional[str]:
    if not client or not stream_key:
        return None
    try:
        entries = client.xrevrange(stream_key, max='+', min='-', count=1)
        if not entries:
            return None
        _, data = entries[0]
        return data.get('message')
    except Exception:
        return None

def _find_last(entries: list, predicate) -> Optional[dict]:
    for entry in reversed(entries):
        try:
            if predicate(entry):
                return entry
        except Exception:
            continue
    return None

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

@app.get('/api/cb-model/info')
def get_cb_model_info():
    """Get CB service model info (featurizer state)."""
    try:
        r = requests.get(f'{CB_SERVICE_URL}/ml/model-info', timeout=5)
        if r.status_code == 200:
            data = r.json()
            return jsonify({
                'exists': True,
                'version': data.get('version', 'content-based-v1'),
                'architecture': data.get('architecture', 'Content-Based'),
                'parameters': data.get('parameters', {}),
                'users_fitted': data.get('users_fitted', 0),
                'message': 'Content-Based service is ready'
            }), 200
        return jsonify({'exists': False, 'message': 'CB service model not available'}), 200
    except Exception as e:
        return jsonify({'exists': False, 'error': str(e), 'message': 'CB service unavailable'}), 503

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
    - CURRENT_TRAINING_LOG modified recently,
    and not explicitly marked completed in the file.
    """
    try:
        log_entries = _read_json_lines(LOG_PATH)
        last_training = log_entries[-1] if log_entries else None
        last_success = _find_last(log_entries, lambda e: e.get('status') == 'success')
        last_error = _find_last(log_entries, lambda e: e.get('status') == 'error')

        is_training = _process_running('train_from_db.py') or _recently_modified(
            CURRENT_TRAINING_LOG,
            TRAINING_ACTIVE_WINDOW_SECONDS
        )
        if _file_exists(TRIGGER_FILE):
            is_training = True

        stream_key = _get_latest_stream_key(redis_client)
        last_stream_message = _get_stream_last_message(redis_client, stream_key)
        if last_stream_message:
            if last_stream_message == '[TRAINING_COMPLETED]':
                is_training = False
            else:
                is_training = True

        # If the current log contains completion/skip, treat as idle.
        if _file_exists(CURRENT_TRAINING_LOG):
            try:
                txt = Path(CURRENT_TRAINING_LOG).read_text()
                if (
                    'TRAINING COMPLETED' in txt
                    or 'Training skipped' in txt
                    or 'Skipping training' in txt
                    or 'Training result: SKIPPED' in txt
                    or 'Training was stopped' in txt
                ):
                    is_training = False
            except Exception:
                pass

        stop_requested = _file_exists(STOP_TRAINING_FILE)

        return jsonify({
            'is_training': bool(is_training),
            'last_training': last_training,
            'last_success': last_success,
            'last_error': last_error,
            'stop_requested': bool(stop_requested),
        }), 200
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

        # Clear any stale stop flag so a new run is not immediately cancelled.
        if _file_exists(STOP_TRAINING_FILE):
            try:
                os.remove(STOP_TRAINING_FILE)
            except Exception:
                pass

        # Create trigger file (scheduler will remove it)
        with open(TRIGGER_FILE, 'w') as f:
            f.write(stream_id)

        return jsonify({'message': 'Training triggered successfully', 'timestamp': datetime.utcnow().isoformat()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.post('/api/training/stop')
def stop_training():
    try:
        is_training = _process_running('train_from_db.py') or _recently_modified(
            CURRENT_TRAINING_LOG,
            TRAINING_ACTIVE_WINDOW_SECONDS
        )
        if _file_exists(TRIGGER_FILE):
            is_training = True

        if not is_training:
            if _file_exists(STOP_TRAINING_FILE):
                try:
                    os.remove(STOP_TRAINING_FILE)
                except Exception:
                    pass
            return jsonify({'message': 'No active training to stop.'}), 200

        os.makedirs(os.path.dirname(STOP_TRAINING_FILE), exist_ok=True)
        with open(STOP_TRAINING_FILE, 'w') as f:
            f.write(datetime.utcnow().isoformat())

        if redis_client:
            stream_key = _get_latest_stream_key(redis_client)
            if stream_key:
                try:
                    redis_client.xadd(
                        stream_key,
                        {'message': 'Stop requested by admin UI.'},
                        maxlen=500
                    )
                except Exception:
                    pass

        return jsonify({'message': 'Stop request submitted.'}), 200
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
        data = "" if data is None else str(data)
        lines = data.splitlines() or [""]
        for line in lines:
            parts.append(f"data: {line}")
        return "\n".join(parts) + "\n\n"

    def generate() -> Generator[str, None, None]:
        if not redis_client:
            yield sse("Redis unavailable", event="error")
            return

        stream_key = _get_latest_stream_key(redis_client)
        if stream_key:
            yield sse("Connected to training stream.", event="status")
        else:
            yield sse("Waiting for training stream...", event="status")
        last_id = request.headers.get('Last-Event-ID') or request.args.get('last_id') or '0-0'
        last_heartbeat = time.time()

        while True:
            try:
                current_key = redis_client.get(REDIS_CURRENT_KEY)
                if current_key and current_key != stream_key:
                    stream_key = current_key
                    last_id = '0-0'
                    yield sse("Switched to latest training stream.", event="status")

                if stream_key:
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
                    yield sse("ping", event="heartbeat", id_=last_id)

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

        is_training = _process_running('train_from_db.py') or _recently_modified(
            CURRENT_TRAINING_LOG,
            TRAINING_ACTIVE_WINDOW_SECONDS
        )
        text = "\n".join(lines)
        if (
            'TRAINING COMPLETED' in text
            or 'Training skipped' in text
            or 'Skipping training' in text
            or 'Training result: SKIPPED' in text
            or 'Training was stopped' in text
        ):
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

@app.get('/api/cb-service/health')
def check_cb_service():
    try:
        r = requests.get(f'{CB_SERVICE_URL}/health', timeout=5)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'status': 'unavailable', 'error': str(e)}), 503

@app.get('/api/algorithm')
def get_algorithm():
    """Proxy to backend API to get current algorithm."""
    try:
        r = requests.get(f'{BACKEND_URL}/api/users/algorithm', timeout=5)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e), 'algorithm': 'TwoTower'}), 503

@app.post('/api/algorithm')
def set_algorithm():
    """Proxy to backend API to set algorithm."""
    try:
        data = request.get_json() or {}
        r = requests.post(
            f'{BACKEND_URL}/api/users/algorithm',
            json=data,
            timeout=5,
            headers={'Content-Type': 'application/json'}
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/metrics/<user_id>')
def calculate_user_metrics(user_id):
    """Proxy to backend API to calculate metrics for a user."""
    try:
        data = request.get_json() or {}
        r = requests.post(
            f'{BACKEND_URL}/api/users/metrics/{user_id}',
            json=data,
            timeout=30,
            headers={'Content-Type': 'application/json'}
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.get('/api/metrics/aggregate')
def get_aggregate_metrics():
    """Proxy to backend API to get aggregate metrics."""
    try:
        algorithm = request.args.get('algorithm')
        k_values = request.args.getlist('kValues', type=int)
        params = {}
        if algorithm:
            params['algorithm'] = algorithm
        if k_values:
            params['kValues'] = k_values
        
        r = requests.get(
            f'{BACKEND_URL}/api/users/metrics/aggregate',
            params=params,
            timeout=60
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/users/generate-interactions')
def generate_interactions():
    """Proxy to backend API to generate random user interactions."""
    try:
        count = request.args.get('count', default=50, type=int)
        r = requests.post(
            f'{BACKEND_URL}/api/users/generate-interactions',
            params={'count': count},
            timeout=60
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/users/upload-dataset')
def upload_dataset():
    """Proxy to backend API to upload CSV dataset."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Forward the file to backend
        files = {'file': (file.filename, file.stream, file.content_type)}
        r = requests.post(
            f'{BACKEND_URL}/api/users/upload-dataset',
            files=files,
            timeout=300  # 5 minutes for large files
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.get('/api/users')
def list_users():
    """Proxy to backend API to list users."""
    try:
        r = requests.get(f'{BACKEND_URL}/api/users', timeout=20)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.get('/api/users/<user_id>')
def get_user(user_id):
    """Proxy to backend API to fetch a single user."""
    try:
        r = requests.get(f'{BACKEND_URL}/api/users/{user_id}', timeout=20)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/users/create')
def create_user():
    """Proxy to backend API to create a user."""
    try:
        data = request.get_json() or {}
        r = requests.post(f'{BACKEND_URL}/api/users/create', json=data, timeout=20)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/users/random')
def create_random_user():
    """Proxy to backend API to create a random user."""
    try:
        r = requests.post(f'{BACKEND_URL}/api/users/random', timeout=20)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/users/random/bulk')
def create_random_users():
    """Proxy to backend API to create random users in bulk."""
    try:
        count = request.args.get('count', default=10, type=int)
        r = requests.post(f'{BACKEND_URL}/api/users/random/bulk', params={'count': count}, timeout=30)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.delete('/api/users/<user_id>')
def delete_user(user_id):
    """Proxy to backend API to delete a user."""
    try:
        r = requests.delete(f'{BACKEND_URL}/api/users/{user_id}', timeout=30)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/users/<user_id>/update')
def update_user(user_id):
    """Proxy to backend API to update a user."""
    try:
        data = request.get_json() or {}
        r = requests.post(
            f'{BACKEND_URL}/api/users/{user_id}/update',
            json=data,
            timeout=30
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/users/<user_id>/interactions')
def update_user_interactions(user_id):
    """Proxy to backend API to update user interactions."""
    try:
        data = request.get_json() or {}
        r = requests.post(
            f'{BACKEND_URL}/api/users/{user_id}/interactions',
            json=data,
            timeout=30
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/users/<user_id>/interactions/clear')
def clear_user_interactions(user_id):
    """Proxy to backend API to clear user interactions."""
    try:
        r = requests.post(
            f'{BACKEND_URL}/api/users/{user_id}/interactions/clear',
            timeout=30
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/users/interactions/purge')
def purge_user_interactions():
    """Proxy to backend API to purge user interactions globally."""
    try:
        data = request.get_json() or {}
        r = requests.post(
            f'{BACKEND_URL}/api/users/interactions/purge',
            json=data,
            timeout=30
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.get('/api/admin/conversations')
def admin_list_conversations():
    try:
        user_id = request.args.get('userId', '')
        r = requests.get(
            f'{BACKEND_URL}/api/admin/conversations',
            params={'userId': user_id},
            timeout=20
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.get('/api/admin/conversations/between')
def admin_get_conversation_between():
    try:
        user_id = request.args.get('userId', '')
        other_user_id = request.args.get('otherUserId', '')
        r = requests.get(
            f'{BACKEND_URL}/api/admin/conversations/between',
            params={'userId': user_id, 'otherUserId': other_user_id},
            timeout=20
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/admin/conversations')
def admin_create_conversation():
    try:
        data = request.get_json() or {}
        r = requests.post(
            f'{BACKEND_URL}/api/admin/conversations',
            json=data,
            timeout=20
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.get('/api/admin/conversations/<conv_id>')
def admin_get_conversation(conv_id):
    try:
        r = requests.get(f'{BACKEND_URL}/api/admin/conversations/{conv_id}', timeout=20)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.get('/api/admin/conversations/<conv_id>/messages')
def admin_get_messages(conv_id):
    try:
        limit = request.args.get('limit', default=50, type=int)
        before = request.args.get('before')
        params = {'limit': limit}
        if before:
            params['before'] = before
        r = requests.get(
            f'{BACKEND_URL}/api/admin/conversations/{conv_id}/messages',
            params=params,
            timeout=20
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/admin/conversations/<conv_id>/messages')
def admin_send_message(conv_id):
    try:
        data = request.get_json() or {}
        r = requests.post(
            f'{BACKEND_URL}/api/admin/conversations/{conv_id}/messages',
            json=data,
            timeout=20
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/admin/conversations/<conv_id>/messages/read')
def admin_mark_messages_read(conv_id):
    try:
        data = request.get_json() or {}
        r = requests.post(
            f'{BACKEND_URL}/api/admin/conversations/{conv_id}/messages/read',
            json=data,
            timeout=20
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.delete('/api/admin/conversations/<conv_id>/messages/<message_id>')
def admin_delete_message(conv_id, message_id):
    try:
        r = requests.delete(
            f'{BACKEND_URL}/api/admin/conversations/{conv_id}/messages/{message_id}',
            timeout=20
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.get('/api/steam/health')
def steam_health():
    """Lightweight Steam API connectivity check via backend health endpoint."""
    start = time.time()
    try:
        r = requests.get(
            f'{BACKEND_URL}/api/steam/health',
            timeout=10
        )
        latency_ms = int((time.time() - start) * 1000)
        body = {}
        try:
            body = r.json()
        except Exception:
            body = {}
        if r.status_code == 200:
            return jsonify({
                'status': body.get('status', 'ok'),
                'latency_ms': body.get('latency_ms', latency_ms),
                'backend_status': r.status_code,
                'error': body.get('error'),
                'timestamp': body.get('timestamp') or datetime.utcnow().isoformat()
            }), 200
        return jsonify({
            'status': 'degraded',
            'latency_ms': latency_ms,
            'backend_status': r.status_code,
            'error': body.get('error') or body.get('message') or 'Steam check failed',
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        latency_ms = int((time.time() - start) * 1000)
        return jsonify({
            'status': 'unavailable',
            'latency_ms': latency_ms,
            'backend_status': None,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 200

@app.get('/api/steam/catalog')
def steam_catalog():
    """Proxy to backend Steam catalog endpoint."""
    try:
        kind = request.args.get('type', 'games')
        query = request.args.get('query', '')
        limit = request.args.get('limit', default=60, type=int)
        r = requests.get(
            f'{BACKEND_URL}/api/steam/catalog',
            params={'type': kind, 'query': query, 'limit': limit},
            timeout=20
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/steam/connect')
def steam_connect():
    """Proxy to backend Steam connect endpoint with auth header passthrough."""
    try:
        data = request.get_json() or {}
        headers = {}
        auth = request.headers.get('Authorization')
        if auth:
            headers['Authorization'] = auth
        r = requests.post(
            f'{BACKEND_URL}/api/steam/connect',
            json=data,
            timeout=30,
            headers=headers
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/steam/sync')
def steam_sync():
    """Proxy to backend Steam sync endpoint with auth header passthrough."""
    try:
        headers = {}
        auth = request.headers.get('Authorization')
        if auth:
            headers['Authorization'] = auth
        r = requests.post(
            f'{BACKEND_URL}/api/steam/sync',
            timeout=30,
            headers=headers
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

@app.post('/api/steam/disconnect')
def steam_disconnect():
    """Proxy to backend Steam disconnect endpoint with auth header passthrough."""
    try:
        headers = {}
        auth = request.headers.get('Authorization')
        if auth:
            headers['Authorization'] = auth
        r = requests.post(
            f'{BACKEND_URL}/api/steam/disconnect',
            timeout=30,
            headers=headers
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 503

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
        cur.close()
        conn.close()

        return jsonify({
            'total_users': total_users,
            'total_likes': total_likes,
            'total_dislikes': total_dislikes,
            'total_interactions': total_likes + total_dislikes
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.get('/api/models/history')
def get_models_history():
    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = max(1, min(100, int(request.args.get('per_page', 20))))

        models = _build_model_history()
        total = len(models)
        total_pages = max(1, (total + per_page - 1) // per_page)
        start = (page - 1) * per_page
        end = start + per_page

        return jsonify({
            'models': models[start:end],
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.get('/api/models/<version>/logs')
def get_model_logs(version: str):
    try:
        log_file = os.path.join(MODELS_DIR, f'training_log_{version}.txt')
        log_content = None
        if _file_exists(log_file):
            with open(log_file, 'r') as f:
                log_content = f.read()

        model_info = next(
            (m for m in _build_model_history() if m.get('version') == version),
            None
        )
        return jsonify({
            'version': version,
            'model_info': model_info,
            'log_content': log_content
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.post('/api/models/<version>/activate')
def activate_model(version: str):
    try:
        filename = f'twotower_v6_{version}.pt'
        source_path = os.path.join(MODELS_DIR, filename)
        if not _file_exists(source_path):
            return jsonify({'error': 'Model file not found', 'path': source_path}), 404

        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        tmp_path = MODEL_PATH + '.tmp'
        shutil.copy2(source_path, tmp_path)
        os.replace(tmp_path, MODEL_PATH)
        _set_current_model_version(version)

        # Best-effort reload of the ML service.
        try:
            r = requests.post(f'{ML_SERVICE_URL}/ml/reload-model', timeout=5)
            reload_status = r.status_code
        except Exception:
            reload_status = None

        return jsonify({
            'message': 'Model activated',
            'model_path': MODEL_PATH,
            'reloaded_status': reload_status
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.post('/api/models/upload')
def upload_model():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        activate_raw = request.form.get('activate') or request.args.get('activate')
        activate = str(activate_raw).lower() in ('1', 'true', 'yes', 'on')
        version_override = (request.form.get('version') or request.args.get('version') or '').strip()

        safe_name = secure_filename(file.filename)
        parsed_version = _parse_model_version(safe_name)

        if not parsed_version:
            if not version_override:
                return jsonify({
                    'error': 'Invalid filename. Use twotower_v6_<version>.pt or provide version.'
                }), 400
            if not _is_valid_version(version_override):
                return jsonify({'error': 'Invalid version format'}), 400
            safe_name = f'twotower_v6_{version_override}.pt'
            parsed_version = version_override

        os.makedirs(MODELS_DIR, exist_ok=True)
        dest_path = os.path.join(MODELS_DIR, safe_name)
        tmp_path = dest_path + '.tmp'
        file.save(tmp_path)
        os.replace(tmp_path, dest_path)

        response = {
            'message': 'Model uploaded',
            'version': parsed_version,
            'model_path': dest_path,
            'activated': False
        }

        if activate:
            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            current_tmp = MODEL_PATH + '.tmp'
            shutil.copy2(dest_path, current_tmp)
            os.replace(current_tmp, MODEL_PATH)
            _set_current_model_version(parsed_version)
            response['activated'] = True

            try:
                r = requests.post(f'{ML_SERVICE_URL}/ml/reload-model', timeout=5)
                response['reloaded_status'] = r.status_code
            except Exception:
                response['reloaded_status'] = None

        return jsonify(response), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6000, debug=True)
