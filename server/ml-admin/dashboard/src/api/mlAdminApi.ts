// mlAdminApi.ts
// Minimal, typed client for the ML Admin API + SSE logs.
// Works with the refactored api.py endpoints.

export type AlgorytmType = 'TwoTower' | 'ContentBased' | 'Hybrid';

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
  last_success?: LastTrainingLog | null;
  last_error?: LastTrainingLog | null;
  stop_requested?: boolean;
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

export type SteamHealth = {
  status: string;
  latency_ms?: number;
  backend_status?: number;
  error?: string;
  timestamp?: string;
};

export type SteamCatalogResponse = {
  items: string[];
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
  evaluation?: MetricsEvaluationMetadata;
};

export type MetricsEvaluationMetadata = {
  holdoutStrategy?: string;
  holdoutFraction?: number;
  holdoutSize?: number;
  candidateConstruction?: string;
  aggregation?: string;
  precisionDenominator?: string;
  chatStartDefinition?: string;
  sampleSize?: number;
  maxUsersEvaluated?: number;
  userSelection?: string;
  minLikesForEval?: number;
  minHoldoutSize?: number;
  averageHoldoutSize?: number;
  averageCandidateCount?: number;
  averageEligibleLikedCount?: number;
  usersConsidered?: number;
  usersSkipped?: number;
};


type ApiMethod = 'GET' | 'POST' | 'DELETE';
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
  timeoutMs = DEFAULT_TIMEOUT_MS,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${baseUrl}${path}`;

  const mergedHeaders: Record<string, string> = {};
  if (payload) {
    mergedHeaders['Content-Type'] = 'application/json';
  }
  if (extraHeaders) {
    Object.assign(mergedHeaders, extraHeaders);
  }

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: Object.keys(mergedHeaders).length ? mergedHeaders : undefined,
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
  // if the server sets "id: ..." per event -- which our backend does.
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
  streamTrainingLogsRaw(lastId?: string): EventSource {
    const query = lastId ? `?last_id=${encodeURIComponent(lastId)}` : '';
    return toEventSource(`/api/training/logs/stream${query}`);
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

  async compareAlgorithms(kValues: number[] = [5, 10, 20]): Promise<{ TwoTower?: AggregateMetricsResponse; ContentBased?: AggregateMetricsResponse; Hybrid?: AggregateMetricsResponse }> {
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

  async uploadModel(
    file: File,
    options?: { activate?: boolean; version?: string }
  ): Promise<{
    message: string;
    version: string;
    model_path: string;
    activated?: boolean;
    reloaded_status?: number | null;
  }> {
    const baseUrl = (import.meta as any)?.env?.VITE_ADMIN_API_URL?.replace(/\/+$/, '') || '';
    const url = `${baseUrl}/api/models/upload`;
    const formData = new FormData();
    formData.append('file', file);
    if (options?.activate) {
      formData.append('activate', 'true');
    }
    if (options?.version) {
      formData.append('version', options.version);
    }

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

  // ---- Steam API ----
  async getSteamHealth(): Promise<SteamHealth> {
    return fetchJSON('/api/steam/health', 'GET');
  },

  async getSteamCatalog(type: 'games' | 'categories', query = ''): Promise<SteamCatalogResponse> {
    const params = new URLSearchParams();
    params.append('type', type);
    if (query) params.append('query', query);
    return fetchJSON(`/api/steam/catalog?${params.toString()}`, 'GET');
  },

  async connectSteam(token: string, steamIdOrUrl: string): Promise<any> {
    return fetchJSON('/api/steam/connect', 'POST', { steamIdOrUrl }, DEFAULT_TIMEOUT_MS, {
      Authorization: token,
    });
  },

  async syncSteam(token: string): Promise<any> {
    return fetchJSON('/api/steam/sync', 'POST', undefined, DEFAULT_TIMEOUT_MS, {
      Authorization: token,
    });
  },

  async disconnectSteam(token: string): Promise<any> {
    return fetchJSON('/api/steam/disconnect', 'POST', undefined, DEFAULT_TIMEOUT_MS, {
      Authorization: token,
    });
  },

  // ---- User Admin ----
  async getUsers(): Promise<any[]> {
    return fetchJSON('/api/users', 'GET');
  },

  async getUser(userId: string): Promise<any> {
    return fetchJSON(`/api/users/${userId}`, 'GET');
  },

  async createUser(payload: Record<string, any>): Promise<any> {
    return fetchJSON('/api/users/create', 'POST', payload);
  },

  async createRandomUser(): Promise<any> {
    return fetchJSON('/api/users/random', 'POST');
  },

  async createRandomUsers(count: number): Promise<any> {
    return fetchJSON(`/api/users/random/bulk?count=${count}`, 'POST');
  },

  async updateUser(userId: string, payload: Record<string, any>): Promise<any> {
    return fetchJSON(`/api/users/${userId}/update`, 'POST', payload);
  },

  async deleteUser(userId: string): Promise<any> {
    return fetchJSON(`/api/users/${userId}`, 'DELETE');
  },

  async updateUserInteractions(
    userId: string,
    payload: { likedIds: string[]; dislikedIds: string[]; replace?: boolean; removeConflicts?: boolean }
  ): Promise<any> {
    return fetchJSON(`/api/users/${userId}/interactions`, 'POST', payload);
  },

  async clearUserInteractions(userId: string): Promise<any> {
    return fetchJSON(`/api/users/${userId}/interactions/clear`, 'POST');
  },

  async purgeUserInteractions(payload: {
    targetUserId: string;
    removeFromLiked?: boolean;
    removeFromDisliked?: boolean;
  }): Promise<any> {
    return fetchJSON('/api/users/interactions/purge', 'POST', payload);
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
