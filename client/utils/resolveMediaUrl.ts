import { API_CONFIG } from '@/config/constants';

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_CONFIG.BACKEND_URL}${url}`;
}
