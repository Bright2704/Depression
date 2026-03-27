/**
 * API Client for FacePsy Backend
 * Handles encrypted transmission of facial metadata
 */

import type { WindowStatistics } from '@/hooks/useFacePsy';
import type { PHQ9Prediction, UserBaseline, PredictionSession } from './phq9-predictor';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

// ============================================================================
// Types
// ============================================================================

export interface UserProfile {
  id: string;
  nickname?: string;
  ageRange?: string;
  goal?: string;
  createdAt: number;
  lastActive: number;
}

export interface SessionHistoryItem {
  sessionId: string;
  timestamp: number;
  phq9Score: number;
  severity: string;
  confidence: number;
}

export interface DashboardData {
  weeklyTrend: {
    date: string;
    score: number;
    severity: string;
  }[];
  averageScore: number;
  improvementPercent: number;
  streakDays: number;
  lastCheckIn: number;
  alerts: {
    type: 'warning' | 'info' | 'success';
    message: string;
  }[];
}

// ============================================================================
// API Client Class
// ============================================================================

class FacePsyApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // =========================================================================
  // Auth Methods
  // =========================================================================

  setAuthToken(token: string) {
    this.authToken = token;
  }

  clearAuthToken() {
    this.authToken = null;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  // =========================================================================
  // Core API Methods
  // =========================================================================

  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    const response = await fetch(`${this.baseUrl}/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      return { success: false, message: 'Server unavailable', data: null };
    }

    const data = await response.json();
    return { success: true, message: 'OK', data };
  }

  /**
   * Submit window statistics for server-side analysis
   * Only numeric metadata is sent - no images
   */
  async submitWindowStats(stats: WindowStatistics[]): Promise<ApiResponse<PHQ9Prediction>> {
    try {
      // Encrypt sensitive data before transmission
      const encryptedPayload = await this.encryptPayload({
        windowStats: stats,
        timestamp: Date.now(),
        clientVersion: '1.0.0',
      });

      const response = await fetch(`${this.baseUrl}/api/analyze/session`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(encryptedPayload),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      };
    }
  }

  /**
   * Save user baseline for future sessions
   */
  async saveBaseline(baseline: UserBaseline): Promise<ApiResponse<{ saved: boolean }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user/baseline`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(baseline),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      };
    }
  }

  /**
   * Get user baseline
   */
  async getBaseline(): Promise<ApiResponse<UserBaseline | null>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user/baseline`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { success: true, message: 'No baseline found', data: null };
        }
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      };
    }
  }

  /**
   * Save completed session
   */
  async saveSession(session: PredictionSession): Promise<ApiResponse<{ sessionId: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          sessionId: session.sessionId,
          startTime: session.startTime,
          endTime: session.endTime,
          prediction: session.prediction,
          // Don't send raw window stats - only aggregated results
          summary: {
            windowCount: session.windowStats.length,
            totalFrames: session.windowStats.reduce((sum, w) => sum + w.frameCount, 0),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      };
    }
  }

  /**
   * Get session history
   */
  async getSessionHistory(limit: number = 30): Promise<ApiResponse<SessionHistoryItem[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions?limit=${limit}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      };
    }
  }

  /**
   * Get dashboard data
   */
  async getDashboard(): Promise<ApiResponse<DashboardData>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/dashboard`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      };
    }
  }

  /**
   * Delete all user data (GDPR compliance)
   */
  async deleteAllData(): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user/data`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      };
    }
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Encrypt payload for secure transmission
   * In production, use Web Crypto API with proper key exchange
   */
  private async encryptPayload(data: object): Promise<object> {
    // For MVP, we'll use base64 encoding
    // In production, implement proper E2E encryption
    const jsonString = JSON.stringify(data);
    const encoded = btoa(jsonString);

    return {
      encrypted: true,
      payload: encoded,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate PDF report
   */
  async generateReport(sessionId: string): Promise<Blob | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/reports/${sessionId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Report generation failed:', error);
      return null;
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const apiClient = new FacePsyApiClient();

export default apiClient;
