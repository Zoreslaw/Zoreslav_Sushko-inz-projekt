#!/usr/bin/env python3
"""
Clean ML Training Scheduler
- Robust Redis stream session
- Safe stdout redirection with try/finally
- Manual trigger that re-seeds next schedule
"""

import os
import sys
import time
import json
import logging
import schedule
import redis
from datetime import datetime, timedelta, timezone
from typing import Optional

from train_from_db import train_model

TRAINING_INTERVAL_HOURS = int(os.getenv('TRAINING_INTERVAL_HOURS', '8'))
TRAIN_ON_START = os.getenv('TRAIN_ON_START', 'true').lower() == 'true'
TRIGGER_FILE = os.getenv('TRIGGER_FILE', '/shared/logs/trigger_training.flag')
NEXT_TRAINING_FILE = os.getenv('NEXT_TRAINING_FILE', '/shared/logs/next_training.json')
REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379')
REDIS_CHANNEL = os.getenv('REDIS_CHANNEL', 'training_logs')
REDIS_CURRENT_KEY = os.getenv('REDIS_CURRENT_KEY', 'training_stream_current')
CURRENT_TRAINING_LOG = os.getenv('CURRENT_TRAINING_LOG', '/shared/logs/current_training.log')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("scheduler")

def connect_redis() -> Optional[redis.Redis]:
    try:
        client = redis.from_url(REDIS_URL, decode_responses=True)
        client.ping()
        logger.info("Connected to Redis")
        return client
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        return None

redis_client = connect_redis()

class TrainingStream:
    def __init__(self, r: Optional[redis.Redis], channel: str):
        self.r = r
        self.channel = channel
        self.current_stream = None

    def start_session(self) -> Optional[str]:
        if not self.r:
            return None
        # If API pre-created a stream id, reuse it
        pre = self.r.get(REDIS_CURRENT_KEY)
        if pre:
            self.current_stream = pre
        else:
            ts = datetime.utcnow().strftime('%Y%m%dT%H%M%S%fZ')
            self.current_stream = f"{self.channel}:{ts}"
            self.r.set(REDIS_CURRENT_KEY, self.current_stream)
        self.send('[TRAINING_START]')
        return self.current_stream

    def send(self, msg: str):
        if not (self.r and self.current_stream):
            return
        try:
            self.r.xadd(self.current_stream, {'message': msg.rstrip()}, maxlen=500)
        except Exception as e:
            logger.error(f"Failed to send message: {e}")

    def complete(self):
        self.send('[TRAINING_COMPLETED]')
        self.current_stream = None

class TrainingLogger:
    def __init__(self, file_path: str, stream: TrainingStream):
        self.file_path = file_path
        self.stream = stream
        self.file = None
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)

    def __enter__(self):
        self.file = open(self.file_path, 'w', buffering=1)
        return self

    def __exit__(self, exc_type, exc, tb):
        if self.file:
            self.file.close()

    def write(self, data: str):
        if not data or data == '\n':
            return len(data or '')
        if self.file:
            self.file.write(data)
            self.file.flush()
        self.stream.send(data)
        return len(data)

    def flush(self):
        if self.file:
            self.file.flush()

def save_next_training_time():
    next_time = datetime.now(timezone.utc) + timedelta(hours=TRAINING_INTERVAL_HOURS)
    try:
        os.makedirs(os.path.dirname(NEXT_TRAINING_FILE), exist_ok=True)
        with open(NEXT_TRAINING_FILE, 'w') as f:
            json.dump({
                'next_training': next_time.isoformat(),  # TZ-aware
                'interval_hours': TRAINING_INTERVAL_HOURS
            }, f)
    except Exception as e:
        logger.error(f"Failed to save next training time: {e}")

class ForwardHandler(logging.Handler):
    def __init__(self, sink):
        super().__init__(level=logging.INFO)
        self.sink = sink
        self.setFormatter(logging.Formatter('%(message)s'))

    def emit(self, record: logging.LogRecord):
        try:
            msg = self.format(record)
            self.sink.write(msg + '\n')
        except Exception:
            pass

def run_training(trigger_source='scheduled') -> bool:
    logger.info(f"Training triggered: {trigger_source}")

    stream = TrainingStream(redis_client, REDIS_CHANNEL)
    stream_key = stream.start_session()
    if not stream_key:
        logger.error("Failed to start training stream")
        return False

    original_stdout = sys.stdout
    fwd_handler = None
    attached_loggers = []

    try:
        with TrainingLogger(CURRENT_TRAINING_LOG, stream) as tlog:
            sys.stdout = tlog

            fwd_handler = ForwardHandler(tlog)

            root = logging.getLogger()

            already = any(isinstance(h, ForwardHandler) for h in root.handlers)
            if not already:
                root.addHandler(fwd_handler)

            if root.level > logging.INFO or root.level == logging.NOTSET:
                root.setLevel(logging.INFO)

            attached_loggers = [root]

            logger.info("Forwarding handler attached; streaming logs to Redis…")

            ok = train_model()
            print(f"\n---\nTraining result: {'SUCCESS' if ok else 'SKIPPED'}")
            return ok

    except Exception:
        logger.exception("Training crashed")
        return False

    finally:
        try:
            if fwd_handler:
                for lg in attached_loggers:
                    try:
                        lg.removeHandler(fwd_handler)
                    except Exception:
                        pass
        finally:
            try:
                sys.stdout = original_stdout
            finally:
                stream.complete()
                save_next_training_time()


def check_manual_trigger():
    if os.path.exists(TRIGGER_FILE):
        logger.info(f"Manual trigger detected: {TRIGGER_FILE}")
        try:
            os.remove(TRIGGER_FILE)
        except Exception:
            logger.warning("Could not remove trigger file (continuing)")
        ok = run_training('manual')
        # reset schedule after manual run
        schedule.clear()
        schedule.every(TRAINING_INTERVAL_HOURS).hours.do(lambda: run_training('scheduled'))
        logger.info(f"Scheduler reset: every {TRAINING_INTERVAL_HOURS} hours (last ok={ok})")

def scheduled_training():
    run_training('scheduled')

def main():
    logger.info("=" * 60)
    logger.info("ML Training Scheduler started")
    logger.info(f"Interval: {TRAINING_INTERVAL_HOURS}h | Train on start: {TRAIN_ON_START}")
    logger.info("=" * 60)

    if TRAIN_ON_START:
        scheduled_training()
    else:
        save_next_training_time()

    schedule.every(TRAINING_INTERVAL_HOURS).hours.do(scheduled_training)
    logger.info("Monitoring for manual training triggers...")

    while True:
        check_manual_trigger()
        schedule.run_pending()
        time.sleep(2)

if __name__ == '__main__':
    main()
