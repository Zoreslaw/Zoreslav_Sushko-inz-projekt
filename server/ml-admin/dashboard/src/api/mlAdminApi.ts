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

export type AggregateMetricsResponse = {
  algorithm: string;
  timestamp: string;
  userCount?: number;
  avgPrecisionAtK?: Record<number, number>;
  avgRecallAtK?: Record<number, number>;
  avgNDCGAtK?: Record<number, number>;
  avgHitRateAtK?: Record<number, number>;
  avgMutualAcceptRateAtK?: Record<number, number>;
  avgChatStartRateAtK?: Record<number, number>;
};


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

  // ---- Metrics ----
  async calculateUserMetrics(
    userId: string,
    kValues: number[] = [5, 10, 20]
  ): Promise<any> {
    return fetchJSON(`/api/metrics/${userId}`, 'POST', { kValues });
  },

  async getAggregateMetrics(
    algorithm?: string,
    kValues: number[] = [5, 10, 20]
  ): Promise<any> {
    const params = new URLSearchParams();
    if (algorithm) params.append('algorithm', algorithm);
    kValues.forEach(k => params.append('kValues', k.toString()));
    const query = params.toString();
    return fetchJSON(`/api/metrics/aggregate${query ? `?${query}` : ''}`, 'GET');
  },

  async compareAlgorithms(kValues: number[] = [5, 10, 20]): Promise<{ TwoTower?: AggregateMetricsResponse; ContentBased?: AggregateMetricsResponse }> {
    const params = new URLSearchParams();
    kValues.forEach(k => params.append('kValues', k.toString()));
    const query = params.toString();
    return fetchJSON(`/api/metrics/compare${query ? `?${query}` : ''}`, 'GET');
  },

  async generateInteractions(count: number = 100): Promise<any> {
    return fetchJSON(`/api/users/generate-interactions?count=${count}`, 'POST');
  },

  async uploadDataset(formData: FormData): Promise<any> {
    const baseUrl = (import.meta as any)?.env?.VITE_ADMIN_API_URL?.replace(/\/+$/, '') || '';
    const url = `${baseUrl}/api/users/upload-dataset`;
    
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const msg = body?.error || body?.message || `HTTP ${response.status}`;
      throw new ApiError(msg, response.status, body);
    }

    return await response.json();
  },

  // ---- Training Control ----
  async stopTraining(): Promise<{ message: string }> {
    return fetchJSON('/api/training/stop', 'POST');
  },

  // ---- Model History ----
  async getModelsHistory(page: number = 1, perPage: number = 20): Promise<{
    models: ModelHistoryItem[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  }> {
    return fetchJSON(`/api/models/history?page=${page}&per_page=${perPage}`, 'GET');
  },

  async getModelLogs(version: string): Promise<{
    version: string;
    model_info: any;
    log_content: string | null;
  }> {
    return fetchJSON(`/api/models/${version}/logs`, 'GET');
  },

  async activateModel(version: string): Promise<{ message: string; model_path: string }> {
    return fetchJSON(`/api/models/${version}/activate`, 'POST');
  },

  // ---- Low-level utilities ----
  ApiError,
};

export type ModelHistoryItem = {
  filename: string;
  version: string;
  path: string;
  size_mb: number;
  created_at: string;
  is_current: boolean;
  num_users?: number;
  num_interactions?: number;
  duration_seconds?: number;
  status: string;
};

// Backward-compatible type alias used by some components
export type MLServiceHealth = MLHealth;
