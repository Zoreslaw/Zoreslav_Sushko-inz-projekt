import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '@/config/constants';

// Storage keys
const TOKEN_KEY = 'teamup_access_token';
const REFRESH_TOKEN_KEY = 'teamup_refresh_token';
const USER_KEY = 'teamup_user';

// Types
export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  photoUrl?: string;
}

export interface AuthResponse {
  userId: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  age: number;
  gender: string;
  description?: string;
  favoriteCategory?: string;
  favoriteGames: string[];
  otherGames: string[];
  languages: string[];
  preferenceCategories: string[];
  preferenceLanguages: string[];
  preferenceGender?: string;
  preferenceAgeMin?: number;
  preferenceAgeMax?: number;
  createdAt: string;
}

export interface MatchUser {
  id: string;
  displayName: string;
  photoUrl?: string;
  age: number;
  gender: string;
  description?: string;
  favoriteGames: string[];
  otherGames: string[];
  languages: string[];
  preferenceCategories: string[];
  score: number;
  isMatch: boolean;
}

export interface SwipeResponse {
  success: boolean;
  isMatch: boolean;
  conversationId?: string;
  message?: string;
}

export interface Conversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserPhotoUrl?: string;
  otherUserOnline: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageSenderId?: string;
  unreadCount: number;
  lastUpdatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  message: string;
  messageType: string;
  status: string;
  timestamp: string;
  url?: string;
}

export interface UserPresence {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onAuthChange: ((user: AuthUser | null) => void) | null = null;

  constructor() {
    this.baseUrl = API_CONFIG.BACKEND_URL;
    this.loadTokens();
  }

  setAuthChangeHandler(handler: (user: AuthUser | null) => void) {
    this.onAuthChange = handler;
  }

  private async loadTokens() {
    try {
      this.accessToken = await AsyncStorage.getItem(TOKEN_KEY);
      this.refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  }

  private async saveTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  private async clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
  }

  private async saveUser(user: AuthUser) {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  async getStoredUser(): Promise<AuthUser | null> {
    try {
      const userJson = await AsyncStorage.getItem(USER_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch {
      return null;
    }
  }

  async getStoredToken(): Promise<string | null> {
    if (!this.accessToken) {
      this.accessToken = await AsyncStorage.getItem(TOKEN_KEY);
    }
    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth = true
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (requiresAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 - try to refresh token
      if (response.status === 401 && requiresAuth && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(url, { ...options, headers });
          if (!retryResponse.ok) {
            throw new Error(await this.parseError(retryResponse));
          }
          return retryResponse.json();
        } else {
          // Refresh failed, logout
          await this.logout();
          throw new Error('Session expired. Please login again.');
        }
      }

      if (!response.ok) {
        throw new Error(await this.parseError(response));
      }

      // Handle empty responses
      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  private async parseError(response: Response): Promise<string> {
    try {
      const data = await response.json();
      return data.error || data.message || `Error ${response.status}`;
    } catch {
      return `Error ${response.status}`;
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) return false;

      const data: AuthResponse = await response.json();
      await this.saveTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  // ============ AUTH ENDPOINTS ============

  async register(email: string, password: string, displayName: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName }),
      },
      false
    );

    await this.saveTokens(response.accessToken, response.refreshToken);
    const user: AuthUser = {
      userId: response.userId,
      email: response.email,
      displayName: response.displayName,
      photoUrl: response.photoUrl,
    };
    await this.saveUser(user);
    this.onAuthChange?.(user);

    return response;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      false
    );

    await this.saveTokens(response.accessToken, response.refreshToken);
    const user: AuthUser = {
      userId: response.userId,
      email: response.email,
      displayName: response.displayName,
      photoUrl: response.photoUrl,
    };
    await this.saveUser(user);
    this.onAuthChange?.(user);

    return response;
  }

  async loginWithGoogle(idToken: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(
      '/api/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      },
      false
    );

    await this.saveTokens(response.accessToken, response.refreshToken);
    const user: AuthUser = {
      userId: response.userId,
      email: response.email,
      displayName: response.displayName,
      photoUrl: response.photoUrl,
    };
    await this.saveUser(user);
    this.onAuthChange?.(user);

    return response;
  }

  async loginWithApple(idToken: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(
      '/api/auth/apple',
      {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      },
      false
    );

    await this.saveTokens(response.accessToken, response.refreshToken);
    const user: AuthUser = {
      userId: response.userId,
      email: response.email,
      displayName: response.displayName,
      photoUrl: response.photoUrl,
    };
    await this.saveUser(user);
    this.onAuthChange?.(user);

    return response;
  }

  async logout(): Promise<void> {
    try {
      if (this.refreshToken) {
        await this.request('/api/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await this.clearTokens();
      this.onAuthChange?.(null);
    }
  }

  // ============ PROFILE ENDPOINTS ============

  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/api/profile');
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    return this.request<UserProfile>(`/api/profile/${userId}`);
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async uploadAvatar(uri: string): Promise<{ photoUrl: string }> {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri,
      name: filename,
      type,
    } as any);

    const response = await fetch(`${this.baseUrl}/api/profile/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await this.parseError(response));
    }

    return response.json();
  }

  // ============ MATCHES ENDPOINTS ============

  async getMatches(limit = 50): Promise<MatchUser[]> {
    return this.request<MatchUser[]>(`/api/matches?limit=${limit}`);
  }

  async likeUser(targetUserId: string): Promise<SwipeResponse> {
    return this.request<SwipeResponse>('/api/matches/like', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  }

  async dislikeUser(targetUserId: string): Promise<SwipeResponse> {
    return this.request<SwipeResponse>('/api/matches/dislike', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  }

  // ============ CONVERSATIONS ENDPOINTS ============

  async getConversations(): Promise<Conversation[]> {
    return this.request<Conversation[]>('/api/conversations');
  }

  async getConversation(id: string): Promise<Conversation> {
    return this.request<Conversation>(`/api/conversations/${id}`);
  }

  async createConversation(otherUserId: string): Promise<{ conversationId: string; isNew: boolean }> {
    return this.request('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ otherUserId }),
    });
  }

  async getMessages(conversationId: string, limit = 50, before?: Date): Promise<Message[]> {
    let url = `/api/conversations/${conversationId}/messages?limit=${limit}`;
    if (before) {
      url += `&before=${before.toISOString()}`;
    }
    return this.request<Message[]>(url);
  }

  async sendMessage(
    conversationId: string,
    message: string,
    messageType = 'Text',
    url?: string
  ): Promise<Message> {
    return this.request<Message>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message, messageType, url }),
    });
  }

  async markMessagesAsRead(conversationId: string, messageIds?: string[]): Promise<void> {
    await this.request(`/api/conversations/${conversationId}/messages/read`, {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    });
  }

  // ============ PRESENCE ENDPOINTS ============

  async getPresence(userId: string): Promise<UserPresence> {
    return this.request<UserPresence>(`/api/presence/${userId}`);
  }

  async getBatchPresence(userIds: string[]): Promise<UserPresence[]> {
    return this.request<UserPresence[]>('/api/presence/batch', {
      method: 'POST',
      body: JSON.stringify(userIds),
    });
  }

  async setPresence(isOnline: boolean): Promise<UserPresence> {
    return this.request<UserPresence>('/api/presence', {
      method: 'POST',
      body: JSON.stringify({ isOnline }),
    });
  }

  async heartbeat(): Promise<void> {
    await this.request('/api/presence/heartbeat', { method: 'POST' });
  }
}

// Export singleton instance
export const api = new ApiClient();

