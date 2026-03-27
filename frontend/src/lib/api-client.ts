/**
 * API Client for FacePsy Backend
 * Handles encrypted transmission of facial metadata
 * Now with real-time frame analysis using AU_200.tflite model
 */

import type { PHQ9Prediction, UserBaseline, PredictionSession, WindowStatistics } from './phq9-predictor';

// Re-export WindowStatistics for convenience
export type { WindowStatistics };

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
// Frame Analysis Types (from Backend AU_200.tflite model)
// ============================================================================

export interface ActionUnitResult {
  'AU01 - Inner Brow Raiser': number;
  'AU02 - Outer Brow Raiser': number;
  'AU04 - Brow Lowerer': number;
  'AU06 - Cheek Raiser': number;
  'AU07 - Lid Tightener': number;
  'AU10 - Upper Lip Raiser': number;
  'AU12 - Lip Corner Puller': number;
  'AU14 - Dimpler': number;
  'AU15 - Lip Corner Depressor': number;
  'AU17 - Chin Raiser': number;
  'AU23 - Lip Tightener': number;
  'AU24 - Lip Pressor': number;
}

export interface FrameAnalysisResult {
  success: boolean;
  message: string;
  data: {
    face_detected: boolean;
    bounding_box: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    head_pose: {
      pitch: number;
      yaw: number;
      roll: number;
    } | null;
    eye_analysis: {
      left_eye_openness: number;
      right_eye_openness: number;
      average_openness: number;
    };
    expressions: {
      smile_probability: number;
      smile_details: {
        from_blendshapes: number;
        from_au12: number;
        from_landmarks: number;
      };
    };
    action_units: ActionUnitResult | null;
    landmarks_count: number;
  } | null;
}

// Simplified AU format for internal use
export interface SimpleActionUnits {
  AU01: number;
  AU02: number;
  AU04: number;
  AU06: number;
  AU07: number;
  AU10: number;
  AU12: number;
  AU14: number;
  AU15: number;
  AU17: number;
  AU23: number;
  AU24: number;
}

export interface ParsedFrameResult {
  faceDetected: boolean;
  headPose: { pitch: number; yaw: number; roll: number };
  actionUnits: SimpleActionUnits;
  eyeOpenness: number;
  smileProbability: number;
  timestamp: number;
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

export interface WellnessSettings {
  shareVectors: boolean;
  sharePhq9: boolean;
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
  private isBackendAvailable: boolean | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // =========================================================================
  // Auth Methods - Now reads from localStorage/zustand store
  // =========================================================================

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('mindcheck-auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.state?.accessToken || null;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  // =========================================================================
  // Real-time Frame Analysis (Uses AU_200.tflite model on backend)
  // =========================================================================

  /**
   * Check if backend is available and has model loaded
   * Always re-checks to ensure we have the latest status
   */
  async checkBackendStatus(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.isBackendAvailable = data.model_loaded === true && data.face_landmarker_loaded === true;
        console.log('✅ Backend status:', data);
        return this.isBackendAvailable;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('⚠️ Backend check timeout');
      } else {
        console.warn('⚠️ Backend not available:', error);
      }
    }

    this.isBackendAvailable = false;
    return false;
  }

  /**
   * Reset cached backend status (call this to force re-check)
   */
  resetBackendStatus(): void {
    this.isBackendAvailable = null;
  }

  /**
   * Analyze a single frame using the backend AU_200.tflite model
   * This provides the most accurate Action Unit detection
   */
  async analyzeFrame(base64Image: string): Promise<ParsedFrameResult | null> {
    try {
      const response = await fetch(`${this.baseUrl}/analyze-base64`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        console.error('Backend analysis failed:', response.status);
        return null;
      }

      const result: FrameAnalysisResult = await response.json();

      if (!result.success || !result.data?.face_detected) {
        return {
          faceDetected: false,
          headPose: { pitch: 0, yaw: 0, roll: 0 },
          actionUnits: this.getEmptyActionUnits(),
          eyeOpenness: 0.5,
          smileProbability: 0,
          timestamp: Date.now(),
        };
      }

      // Parse the action units from backend format to simple format
      const actionUnits = this.parseActionUnits(result.data.action_units);

      return {
        faceDetected: true,
        headPose: result.data.head_pose || { pitch: 0, yaw: 0, roll: 0 },
        actionUnits,
        eyeOpenness: result.data.eye_analysis.average_openness,
        smileProbability: result.data.expressions.smile_probability,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Frame analysis error:', error);
      return null;
    }
  }

  /**
   * Capture frame from video element as base64
   */
  captureFrameAsBase64(video: HTMLVideoElement): string | null {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Draw video frame (flip horizontally for selfie camera)
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);

      // Convert to base64 JPEG (smaller size)
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('Frame capture error:', error);
      return null;
    }
  }

  /**
   * Parse backend AU format to simple format
   */
  private parseActionUnits(auResult: ActionUnitResult | null): SimpleActionUnits {
    if (!auResult) {
      return this.getEmptyActionUnits();
    }

    return {
      AU01: auResult['AU01 - Inner Brow Raiser'] || 0,
      AU02: auResult['AU02 - Outer Brow Raiser'] || 0,
      AU04: auResult['AU04 - Brow Lowerer'] || 0,
      AU06: auResult['AU06 - Cheek Raiser'] || 0,
      AU07: auResult['AU07 - Lid Tightener'] || 0,
      AU10: auResult['AU10 - Upper Lip Raiser'] || 0,
      AU12: auResult['AU12 - Lip Corner Puller'] || 0,
      AU14: auResult['AU14 - Dimpler'] || 0,
      AU15: auResult['AU15 - Lip Corner Depressor'] || 0,
      AU17: auResult['AU17 - Chin Raiser'] || 0,
      AU23: auResult['AU23 - Lip Tightener'] || 0,
      AU24: auResult['AU24 - Lip Pressor'] || 0,
    };
  }

  private getEmptyActionUnits(): SimpleActionUnits {
    return {
      AU01: 0, AU02: 0, AU04: 0, AU06: 0, AU07: 0, AU10: 0,
      AU12: 0, AU14: 0, AU15: 0, AU17: 0, AU23: 0, AU24: 0,
    };
  }

  /**
   * Calculate window statistics from multiple frame results
   */
  calculateWindowStats(frames: ParsedFrameResult[]): WindowStatistics {
    const validFrames = frames.filter(f => f.faceDetected);

    if (validFrames.length === 0) {
      return this.getEmptyWindowStats();
    }

    const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const std = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const m = mean(arr);
      return Math.sqrt(arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / arr.length);
    };
    const range = (arr: number[]) => arr.length > 0 ? Math.max(...arr) - Math.min(...arr) : 0;

    const pitchValues = validFrames.map(f => f.headPose.pitch);
    const yawValues = validFrames.map(f => f.headPose.yaw);
    const rollValues = validFrames.map(f => f.headPose.roll);
    const smileValues = validFrames.map(f => f.smileProbability);
    const earValues = validFrames.map(f => f.eyeOpenness);

    // Count blinks (when eye openness drops below threshold)
    let blinkCount = 0;
    for (let i = 1; i < validFrames.length; i++) {
      if (validFrames[i - 1].eyeOpenness > 0.3 && validFrames[i].eyeOpenness < 0.2) {
        blinkCount++;
      }
    }
    const durationMinutes = (validFrames[validFrames.length - 1].timestamp - validFrames[0].timestamp) / 60000 || 1/6;
    const blinkRate = Math.round(blinkCount / durationMinutes);

    // Calculate AU statistics
    const auKeys: (keyof SimpleActionUnits)[] = ['AU01', 'AU02', 'AU04', 'AU06', 'AU07', 'AU10', 'AU12', 'AU14', 'AU15', 'AU17', 'AU23', 'AU24'];
    const actionUnits: { [key: string]: { mean: number; std: number } } = {};

    for (const key of auKeys) {
      const values = validFrames.map(f => f.actionUnits[key]);
      actionUnits[key] = {
        mean: mean(values),
        std: std(values),
      };
    }

    return {
      windowStart: validFrames[0]?.timestamp || Date.now(),
      windowEnd: validFrames[validFrames.length - 1]?.timestamp || Date.now(),
      frameCount: validFrames.length,
      headPose: {
        pitch: { mean: mean(pitchValues), std: std(pitchValues), range: range(pitchValues) },
        yaw: { mean: mean(yawValues), std: std(yawValues), range: range(yawValues) },
        roll: { mean: mean(rollValues), std: std(rollValues), range: range(rollValues) },
      },
      eyeMetrics: {
        blinkRate,
        avgEAR: { mean: mean(earValues), std: std(earValues) },
      },
      actionUnits,
      smileProbability: { mean: mean(smileValues), std: std(smileValues) },
    };
  }

  private getEmptyWindowStats(): WindowStatistics {
    return {
      windowStart: Date.now(),
      windowEnd: Date.now(),
      frameCount: 0,
      headPose: {
        pitch: { mean: 0, std: 0, range: 0 },
        yaw: { mean: 0, std: 0, range: 0 },
        roll: { mean: 0, std: 0, range: 0 },
      },
      eyeMetrics: { blinkRate: 15, avgEAR: { mean: 0.28, std: 0.02 } },
      actionUnits: {},
      smileProbability: { mean: 0, std: 0 },
    };
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

  async getWellnessSettings(): Promise<ApiResponse<WellnessSettings>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/wellness/settings`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        return { success: false, message: `API error: ${response.status}`, data: null };
      }
      const raw = await response.json();
      return {
        success: true,
        message: 'OK',
        data: {
          shareVectors: !!raw.share_vectors,
          sharePhq9: !!raw.share_phq9,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      };
    }
  }

  async putWellnessSettings(body: {
    shareVectors: boolean;
    sharePhq9: boolean;
  }): Promise<ApiResponse<WellnessSettings>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/wellness/settings`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          share_vectors: body.shareVectors,
          share_phq9: body.sharePhq9,
        }),
      });
      if (!response.ok) {
        return { success: false, message: `API error: ${response.status}`, data: null };
      }
      const raw = await response.json();
      return {
        success: true,
        message: 'OK',
        data: {
          shareVectors: !!raw.share_vectors,
          sharePhq9: !!raw.share_phq9,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      };
    }
  }

  async submitVectorSample(payload: {
    vector: number[];
    dim: number;
    timeEpoch?: string;
    sessionId?: string;
  }): Promise<ApiResponse<{ id: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/wellness/vector-sample`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          vector: payload.vector,
          dim: payload.dim,
          time_epoch: payload.timeEpoch,
          session_id: payload.sessionId,
        }),
      });
      if (!response.ok) {
        return { success: false, message: `API error: ${response.status}`, data: null };
      }
      const raw = await response.json();
      return { success: true, message: 'OK', data: { id: raw.id } };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      };
    }
  }

  async submitPhq9Label(payload: {
    totalScore: number;
    answers?: number[];
  }): Promise<ApiResponse<{ id: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/wellness/phq9-label`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          total_score: payload.totalScore,
          answers: payload.answers,
        }),
      });
      if (!response.ok) {
        return { success: false, message: `API error: ${response.status}`, data: null };
      }
      const raw = await response.json();
      return { success: true, message: 'OK', data: { id: raw.id } };
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
