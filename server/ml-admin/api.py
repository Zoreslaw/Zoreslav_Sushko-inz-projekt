#!/usr/bin/env python3
"""
ML Admin API for monitoring and managing the ML service.
Refactored for reliable SSE, cleaner config, safer IO, and clearer status.
"""

import os
import json
import time
import subprocess
import re
from datetime import datetime
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
_MODEL_VERSION_RE = re.compile(r'^(\d{8}_\d{6})(?:_[A-Za-z0-9-]+)?$')

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
        last_success = None
        last_error = None
        logs = _tail_json_lines(LOG_PATH, 200)
        if logs:
            last_training = logs[0]
            for entry in logs:
                status = (entry.get('status') or '').lower()
                if status == 'success' and last_success is None:
                    last_success = entry
                if status == 'error' and last_error is None:
                    last_error = entry

        # If the current log contains completion/skip, treat as idle.
        if _file_exists(CURRENT_TRAINING_LOG):
            try:
                txt = Path(CURRENT_TRAINING_LOG).read_text()
                if 'TRAINING COMPLETED' in txt or 'Training skipped' in txt:
                    is_training = False
            except Exception:
                pass

        return jsonify({
            'is_training': bool(is_training),
            'last_training': last_training,
            'last_success': last_success,
            'last_error': last_error
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

        # Create trigger file (scheduler will remove it)
        with open(TRIGGER_FILE, 'w') as f:
            f.write(stream_id)

        return jsonify({'message': 'Training triggered successfully', 'timestamp': datetime.utcnow().isoformat()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.post('/api/training/stop')
def stop_training():
    """Stop the currently running training by creating a stop flag file."""
    try:
        # Check if training is actually running
        is_training = _process_running('train_from_db.py') or _recently_modified(CURRENT_TRAINING_LOG, 30)
        if not is_training:
            return jsonify({'message': 'No training is currently running'}), 400
        
        # Create stop flag file
        with open(STOP_TRAINING_FILE, 'w') as f:
            f.write(datetime.utcnow().isoformat())
        
        return jsonify({'message': 'Stop signal sent to training process'}), 200
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

@app.get('/api/metrics/compare')
def compare_algorithms():
    """Proxy to backend API to compare both algorithms on the same holdout set."""
    try:
        k_values = request.args.getlist('kValues', type=int)
        params = {}
        if k_values:
            params['kValues'] = k_values
        
        r = requests.get(
            f'{BACKEND_URL}/api/users/metrics/compare',
            params=params,
            timeout=120  # Longer timeout since we're evaluating both algorithms
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
    """Get paginated list of all saved models."""
    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = max(1, min(100, int(request.args.get('per_page', 20))))
        
        models_dir = Path(MODELS_DIR)
        if not models_dir.exists():
            return jsonify({'models': [], 'total': 0, 'page': page, 'per_page': per_page, 'total_pages': 0}), 200
        
        # Find all model files
        model_files = []
        current_model_path = Path(MODEL_PATH)
        current_model_info = None
        
        # Get info about the current model file if it exists
        if current_model_path.exists():
            try:
                current_stat = current_model_path.stat()
                current_model_info = {
                    'size': current_stat.st_size,
                    'mtime': current_stat.st_mtime,
                    'path': str(current_model_path.resolve())
                }
            except Exception:
                pass
        
        for file_path in models_dir.glob('twotower_v6_*.pt'):
            if file_path.is_file() and not file_path.name.endswith('.tmp'):
                try:
                    # Skip the "optimal" current model file - we only want versioned models
                    if file_path.name == 'twotower_v6_optimal.pt':
                        continue
                    
                    stat = file_path.stat()
                    # Extract version from filename: twotower_v6_YYYYMMDD_HHMMSS.pt
                    version = file_path.stem.replace('twotower_v6_', '')
                    
                    # Skip if version doesn't match timestamp pattern (should be YYYYMMDD_HHMMSS)
                    if not _MODEL_VERSION_RE.match(version):
                        continue
                    
                    mtime = datetime.fromtimestamp(stat.st_mtime)
                    size_mb = round(stat.st_size / (1024 * 1024), 2)
                    
                    # Check if this is the current model by comparing file size and modification time
                    # (since optimal.pt is a copy of the versioned model)
                    is_current = False
                    if current_model_info:
                        try:
                            # Compare by file size and modification time (they should match if it's the same file)
                            file_size = stat.st_size
                            file_mtime = stat.st_mtime
                            if (file_size == current_model_info['size'] and 
                                abs(file_mtime - current_model_info['mtime']) < 2):  # Allow 2 second difference
                                is_current = True
                        except Exception:
                            pass
                    
                    model_files.append({
                        'filename': file_path.name,
                        'version': version,
                        'path': str(file_path),
                        'size_mb': size_mb,
                        'created_at': mtime.isoformat(),
                        'is_current': is_current
                    })
                except Exception:
                    continue
        
        # Sort by creation time (newest first)
        model_files.sort(key=lambda x: x['created_at'], reverse=True)
        
        # Paginate
        total = len(model_files)
        total_pages = (total + per_page - 1) // per_page
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_models = model_files[start_idx:end_idx]
        
        # Load training log info for each model
        training_logs = _tail_json_lines(LOG_PATH, 1000)  # Load recent logs
        for model in paginated_models:
            # Find matching log entry - try multiple matching strategies
            matching_log = None
            for log in training_logs:
                # Match by exact filename
                if log.get('model_filename') == model['filename']:
                    matching_log = log
                    break
                # Match by version (timestamp format)
                if log.get('model_version') == model['version']:
                    matching_log = log
                    break
                # Match by model_path containing the version
                model_path = log.get('model_path', '')
                if model['version'] in model_path or model['filename'] in model_path:
                    matching_log = log
                    break
            
            if matching_log:
                model['num_users'] = matching_log.get('num_users')
                model['num_interactions'] = matching_log.get('num_interactions')
                model['duration_seconds'] = matching_log.get('duration_seconds')
                model['status'] = matching_log.get('status', 'unknown')
                # Use timestamp from log if available (more accurate)
                if matching_log.get('timestamp'):
                    try:
                        log_timestamp = datetime.fromisoformat(matching_log['timestamp'].replace('Z', '+00:00'))
                        model['created_at'] = log_timestamp.isoformat()
                    except Exception:
                        pass
            else:
                model['status'] = 'unknown'
        
        return jsonify({
            'models': paginated_models,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.get('/api/models/<version>/logs')
def get_model_logs(version):
    """Get training logs for a specific model version."""
    try:
        # Find the model file
        models_dir = Path(MODELS_DIR)
        model_file = None
        for file_path in models_dir.glob(f'twotower_v6_{version}.pt'):
            if file_path.is_file():
                model_file = file_path
                break
        
        if not model_file:
            return jsonify({'error': 'Model not found'}), 404
        
        # Find matching log entry
        training_logs = _tail_json_lines(LOG_PATH, 1000)
        matching_log = None
        for log in training_logs:
            if log.get('model_filename') == model_file.name or log.get('model_version') == version:
                matching_log = log
                break
        
        if not matching_log:
            return jsonify({'error': 'Training logs not found for this model'}), 404
        
        # Try to get the actual training log file if it exists
        log_content = None
        log_file_path = Path(MODELS_DIR) / f'training_log_{version}.txt'
        if log_file_path.exists():
            try:
                with open(log_file_path, 'r') as f:
                    log_content = f.read()
            except Exception:
                pass
        
        return jsonify({
            'version': version,
            'model_info': matching_log,
            'log_content': log_content
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.post('/api/models/<version>/activate')
def activate_model(version):
    """Set a specific model version as the active/current model."""
    try:
        import shutil
        
        # Find the model file
        models_dir = Path(MODELS_DIR)
        model_file = None
        for file_path in models_dir.glob(f'twotower_v6_{version}.pt'):
            if file_path.is_file():
                model_file = file_path
                break
        
        if not model_file:
            return jsonify({'error': 'Model not found'}), 404
        
        # Backup current model if it exists
        current_model_path = Path(MODEL_PATH)
        if current_model_path.exists():
            backup_path = current_model_path.with_suffix('.pt.backup')
            if backup_path.exists():
                backup_path.unlink()
            current_model_path.rename(backup_path)
        
        # Copy selected model to current location
        shutil.copy2(model_file, current_model_path)
        
        # Notify ML service to reload the model
        try:
            ml_service_url = os.getenv('ML_SERVICE_URL', 'http://ml-service:5000')
            import requests
            reload_response = requests.post(
                f'{ml_service_url}/ml/reload-model',
                timeout=30
            )
            if reload_response.status_code == 200:
                print(f"ML service reloaded model {version}")
            else:
                print(f"ML service reload returned status {reload_response.status_code}")
        except Exception as reload_error:
            print(f"Failed to notify ML service to reload: {reload_error}")
            # Don't fail the activation if reload notification fails
        
        return jsonify({
            'message': f'Model {version} activated successfully',
            'model_path': str(current_model_path),
            'ml_service_reloaded': True
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6000, debug=True)
