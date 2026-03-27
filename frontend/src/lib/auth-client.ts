/**
 * Authentication API Client
 */

import { useAuthStore, User } from '@/stores/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================================================
// Types
// ============================================================================

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data: TokenResponse | null;
}

interface RegisterData {
  email: string;
  password: string;
  nickname?: string;
  age_range?: string;
  goal?: string;
}

interface LoginData {
  email: string;
  password: string;
}

// ============================================================================
// Auth Client Class
// ============================================================================

class AuthClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(includeAuth: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  // =========================================================================
  // Register
  // =========================================================================

  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      const result: AuthResponse = await response.json();

      if (result.success && result.data) {
        useAuthStore.getState().setAuth(
          result.data.user,
          result.data.access_token,
          result.data.refresh_token
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
        data: null,
      };
    }
  }

  // =========================================================================
  // Login
  // =========================================================================

  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      const result: AuthResponse = await response.json();

      if (result.success && result.data) {
        useAuthStore.getState().setAuth(
          result.data.user,
          result.data.access_token,
          result.data.refresh_token
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Login failed',
        data: null,
      };
    }
  }

  // =========================================================================
  // Logout
  // =========================================================================

  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders(true),
      });
    } catch {
      // Ignore errors on logout
    } finally {
      useAuthStore.getState().clearAuth();
    }
  }

  // =========================================================================
  // Refresh Token
  // =========================================================================

  async refreshToken(): Promise<boolean> {
    const refreshToken = useAuthStore.getState().refreshToken;

    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const result: AuthResponse = await response.json();

      if (result.success && result.data) {
        useAuthStore.getState().setAuth(
          result.data.user,
          result.data.access_token,
          result.data.refresh_token
        );
        return true;
      }

      // If refresh fails, clear auth
      useAuthStore.getState().clearAuth();
      return false;
    } catch {
      useAuthStore.getState().clearAuth();
      return false;
    }
  }

  // =========================================================================
  // Get Current User
  // =========================================================================

  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/me`, {
        method: 'GET',
        headers: this.getHeaders(true),
      });

      if (!response.ok) {
        // Try refreshing token
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.getCurrentUser();
        }
        return null;
      }

      const user: User = await response.json();
      useAuthStore.getState().setUser(user);
      return user;
    } catch {
      return null;
    }
  }

  // =========================================================================
  // OAuth URLs
  // =========================================================================

  async getGoogleAuthUrl(redirectUri: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.url;
    } catch {
      return null;
    }
  }

  async getFacebookAuthUrl(redirectUri: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/auth/facebook/url?redirect_uri=${encodeURIComponent(redirectUri)}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.url;
    } catch {
      return null;
    }
  }

  // =========================================================================
  // OAuth Callback
  // =========================================================================

  async handleGoogleCallback(code: string, redirectUri: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/google/callback`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      });

      const result: AuthResponse = await response.json();

      if (result.success && result.data) {
        useAuthStore.getState().setAuth(
          result.data.user,
          result.data.access_token,
          result.data.refresh_token
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Google login failed',
        data: null,
      };
    }
  }

  async handleFacebookCallback(code: string, redirectUri: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/facebook/callback`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      });

      const result: AuthResponse = await response.json();

      if (result.success && result.data) {
        useAuthStore.getState().setAuth(
          result.data.user,
          result.data.access_token,
          result.data.refresh_token
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Facebook login failed',
        data: null,
      };
    }
  }

  // =========================================================================
  // Authenticated Fetch
  // =========================================================================

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = useAuthStore.getState().accessToken;

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers,
    });

    // If unauthorized, try refreshing token
    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        const newToken = useAuthStore.getState().accessToken;
        response = await fetch(`${this.baseUrl}${url}`, {
          ...options,
          headers: {
            ...headers,
            Authorization: `Bearer ${newToken}`,
          },
        });
      }
    }

    return response;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const authClient = new AuthClient();

export default authClient;
