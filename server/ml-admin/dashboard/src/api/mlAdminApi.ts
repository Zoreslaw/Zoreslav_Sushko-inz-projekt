// mlAdminApi.ts
// Minimal, typed client for the ML Admin API + SSE logs.
// Works with the refactored api.py endpoints.

export type AlgorytmType = 'TwoTower' | 'ContentBased';

export type LastTrainingLog = {
  timestamp?: string;
  duration_seconds?: number;
  num_users?: number;
  num_interactions?: number;
  model_path?: string;
  status?: 'success' | 'error' | 'skipped' | string;
  error?: string;
};

export type TrainingStatus = {
  is_training: boolean;
  last_training?: LastTrainingLog | null;
};

export type NextTrainingInfo = {
  next_training?: string | null;
  interval_hours: number;
};

export type ModelInfo = {
  exists: boolean;
  path: string;
  size_mb?: number;
  last_modified?: string;
  age_hours?: number;
  message?: string;
};

export type MLHealth = {
  status: string;
  model_loaded?: boolean;
  device?: string;
  model_version?: string;
  timestamp?: string;
  error?: string;
};

export type Stats = {
  total_users: number;
  total_likes: number;
  total_dislikes: number;
  total_interactions: number;
};

export type TrainingLog =
  (Omit<LastTrainingLog, 'status'> & { status: 'success' | 'error' | 'skipped' }) |
  (Omit<LastTrainingLog, 'status' | 'timestamp'> & { status: 'in_progress'; timestamp: 'IN_PROGRESS' });

type ApiMethod = 'GET' | 'POST';
type Json = Record<string, unknown> | unknown[];

class ApiError extends Error {
  status: number;
  body?: any;
  constructor(message: string, status: number, body?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_TIMEOUT_MS = 15000;

// If your admin UI is served from the same domain, this can stay empty.
// Otherwise, set VITE_ADMIN_API_URL (e.g. http://localhost:6000).
const baseUrl =
  (import.meta as any)?.env?.VITE_ADMIN_API_URL?.replace(/\/+$/, '') ||
  '';

async function fetchJSON<T>(
  path: string,
  method: ApiMethod = 'GET',
  payload?: Json,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    signal: controller.signal,
  }).catch((e) => {
    clearTimeout(id);
    throw new ApiError(`Network error: ${e?.message ?? e}`, 0);
  });

  clearTimeout(id);

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => undefined) : undefined;

  if (!res.ok) {
    const msg = body?.error || body?.message || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, body);
  }
  return (body as T) ?? ({} as T);
}

function toEventSource(path: string): EventSource {
  // Browser EventSource will automatically send Last-Event-ID on reconnect
  // if the server sets "id: ..." per event — which our backend does.
  const url = `${baseUrl}${path}`;
  return new EventSource(url, { withCredentials: true });
}

export const mlAdminApi = {
  // ---- Training status / control ----
  async getTrainingStatus(): Promise<TrainingStatus> {
    return fetchJSON<TrainingStatus>('/api/training/status', 'GET');
  },

  async triggerTraining(): Promise<{ message: string; timestamp: string }> {
    return fetchJSON('/api/training/trigger', 'POST');
  },

  // Raw SSE stream (UI layer wires onmessage/onerror etc.)
  // We keep the signature with an optional lastId to be future-proof,
  // but native EventSource does not accept headers; the browser handles resume.
  streamTrainingLogsRaw(_lastId?: string): EventSource {
    return toEventSource('/api/training/logs/stream');
  },

  // ---- Logs (optional helpers for non-stream views) ----
  async getRecentLogs(limit = 50): Promise<Array<Record<string, any>>> {
    const safe = Math.max(1, Math.min(500, limit));
    return fetchJSON(`/api/training/logs?limit=${safe}`, 'GET');
  },

  async getTrainingLogs(limit = 50): Promise<TrainingLog[]> {
    const safe = Math.max(1, Math.min(500, limit));
    return fetchJSON<TrainingLog[]>(`/api/training/logs?limit=${safe}`, 'GET');
  },

  async getCurrentLogFile(): Promise<{ logs: string[]; is_training: boolean }> {
    return fetchJSON('/api/training/logs/current', 'GET');
  },

  async getNextTraining(): Promise<NextTrainingInfo> {
    return fetchJSON('/api/training/next', 'GET');
  },

  // ---- Model / Service / Stats ----
  async getModelInfo(): Promise<ModelInfo> {
    return fetchJSON('/api/model/info', 'GET');
  },

  async getCBModelInfo(): Promise<any> {
    return fetchJSON('/api/cb-model/info', 'GET');
  },

  async mlServiceHealth(): Promise<MLHealth> {
    return fetchJSON('/api/ml-service/health', 'GET');
  },

  // Backward-compatible alias used by some components
  async getMLServiceHealth(): Promise<MLHealth> {
    return fetchJSON('/api/ml-service/health', 'GET');
  },

  async getStats(): Promise<Stats> {
    return fetchJSON('/api/stats', 'GET');
  },

  async cbServiceHealth(): Promise<MLHealth> {
    return fetchJSON('/api/cb-service/health', 'GET');
  },

  // ---- Algorithm Management ----
  async getAlgorithm(): Promise<{ algorithm: string; message: string }> {
    return fetchJSON('/api/algorithm', 'GET');
  },

  async setAlgorithm(algorithm: string): Promise<{ algorithm: string; message: string }> {
    return fetchJSON('/api/algorithm', 'POST', { algorithm });
  },

  // ---- Low-level utilities ----
  ApiError,
};

// Backward-compatible type alias used by some components
export type MLServiceHealth = MLHealth;
