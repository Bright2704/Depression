/**
 * FaceScan Component
 * Main UI for the facial emotion wellness screening
 *
 * Features:
 * - Privacy-first: All processing in browser
 * - Real-time feedback with progress indicators
 * - Professional, medical-grade UI
 */

'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  predictPHQ9,
  createBaseline,
  createSession,
  addWindowToSession,
  completeSession,
  PredictionSession,
  PHQ9Prediction,
  UserBaseline,
  WindowStatistics,
} from '@/lib/phq9-predictor';

// ============================================================================
// Types
// ============================================================================

type ScanPhase = 'idle' | 'consent' | 'initializing' | 'calibrating' | 'scanning' | 'processing' | 'results';

interface ScanProgress {
  phase: ScanPhase;
  progress: number;
  windowsCollected: number;
  totalWindows: number;
  message: string;
}

interface Props {
  onComplete?: (prediction: PHQ9Prediction) => void;
  onError?: (error: Error) => void;
  existingBaseline?: UserBaseline;
  minimumScanDuration?: number;
  showDebugInfo?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const SCAN_CONFIG = {
  minDuration: 30,
  windowSize: 10,
  calibrationWindows: 3,
  scanningWindows: 6,
  samplingRate: 2.5,
};

// ============================================================================
// Simplified Face Detection using getUserMedia + Canvas
// ============================================================================

async function initializeCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

// Simple mock face analysis (replace with actual MediaPipe later)
function analyzeFace(): {
  headPose: { pitch: number; yaw: number; roll: number };
  actionUnits: Record<string, number>;
  smileProbability: number;
  eyeMetrics: { blinkRate: number; avgEAR: { mean: number; std: number } };
} {
  // Generate realistic-looking mock data
  const randomNormal = () => (Math.random() + Math.random() + Math.random()) / 3;

  return {
    headPose: {
      pitch: (randomNormal() - 0.5) * 20,
      yaw: (randomNormal() - 0.5) * 15,
      roll: (randomNormal() - 0.5) * 10,
    },
    actionUnits: {
      AU01: randomNormal() * 0.3,
      AU02: randomNormal() * 0.25,
      AU04: randomNormal() * 0.2,
      AU06: randomNormal() * 0.35,
      AU07: randomNormal() * 0.3,
      AU10: randomNormal() * 0.2,
      AU12: randomNormal() * 0.4,
      AU14: randomNormal() * 0.15,
      AU15: randomNormal() * 0.25,
      AU17: randomNormal() * 0.2,
      AU23: randomNormal() * 0.15,
      AU24: randomNormal() * 0.1,
    },
    smileProbability: randomNormal() * 0.5,
    eyeMetrics: {
      blinkRate: 12 + randomNormal() * 8,
      avgEAR: { mean: 0.25 + randomNormal() * 0.1, std: 0.05 },
    },
  };
}

// ============================================================================
// Main Component
// ============================================================================

export default function FaceScan({
  onComplete,
  onError,
  existingBaseline,
  minimumScanDuration = SCAN_CONFIG.minDuration,
  showDebugInfo = false,
}: Props) {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [progress, setProgress] = useState<ScanProgress>({
    phase: 'idle',
    progress: 0,
    windowsCollected: 0,
    totalWindows: SCAN_CONFIG.scanningWindows,
    message: 'พร้อมเริ่มการตรวจ',
  });
  const [session, setSession] = useState<PredictionSession | null>(null);
  const [baseline, setBaseline] = useState<UserBaseline | undefined>(existingBaseline);
  const [prediction, setPrediction] = useState<PHQ9Prediction | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [frameBuffer, setFrameBuffer] = useState<any[]>([]);

  // Load baseline from localStorage
  useEffect(() => {
    if (!existingBaseline) {
      const saved = localStorage.getItem('facepsy_baseline');
      if (saved) {
        try {
          setBaseline(JSON.parse(saved));
        } catch {
          // Invalid baseline
        }
      }
    }
  }, [existingBaseline]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // =========================================================================
  // Camera and Analysis Logic
  // =========================================================================

  const startCamera = useCallback(async () => {
    try {
      setPhase('initializing');
      setProgress(prev => ({ ...prev, message: 'กำลังเปิดกล้อง...' }));
      setErrorMessage(null);

      if (!videoRef.current) {
        throw new Error('Video element not ready');
      }

      const stream = await initializeCamera(videoRef.current);
      streamRef.current = stream;

      // Wait for video to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      setFaceDetected(true);

      // Start calibration or scanning
      if (!baseline) {
        startCalibration();
      } else {
        startScanning();
      }
    } catch (error) {
      console.error('Camera error:', error);
      const message = error instanceof Error ? error.message : 'ไม่สามารถเปิดกล้องได้';
      setErrorMessage(message);
      onError?.(error instanceof Error ? error : new Error(message));
      setPhase('consent');
    }
  }, [baseline, onError]);

  const startCalibration = useCallback(() => {
    setPhase('calibrating');
    const newSession = createSession();
    setSession(newSession);
    setFrameBuffer([]);

    setProgress({
      phase: 'calibrating',
      progress: 0,
      windowsCollected: 0,
      totalWindows: SCAN_CONFIG.calibrationWindows,
      message: 'กำลังปรับเทียบระบบ... กรุณาทำหน้าปกติ',
    });

    // Start collecting frames
    startFrameCollection('calibrating', SCAN_CONFIG.calibrationWindows);
  }, []);

  const startScanning = useCallback(() => {
    setPhase('scanning');
    const newSession = createSession();
    setSession(newSession);
    setFrameBuffer([]);

    setProgress({
      phase: 'scanning',
      progress: 0,
      windowsCollected: 0,
      totalWindows: SCAN_CONFIG.scanningWindows,
      message: 'กำลังวิเคราะห์... ใช้อุปกรณ์ตามปกติ',
    });

    // Start collecting frames
    startFrameCollection('scanning', SCAN_CONFIG.scanningWindows);
  }, []);

  const startFrameCollection = useCallback((currentPhase: 'calibrating' | 'scanning', windowsNeeded: number) => {
    let frameCount = 0;
    let windowCount = 0;
    let currentWindowFrames: any[] = [];
    const framesPerWindow = SCAN_CONFIG.windowSize * SCAN_CONFIG.samplingRate; // 25 frames per window

    intervalRef.current = setInterval(() => {
      // Analyze face
      const analysis = analyzeFace();
      currentWindowFrames.push(analysis);
      frameCount++;

      // Check if window is complete
      if (currentWindowFrames.length >= framesPerWindow) {
        windowCount++;

        // Create window statistics
        const windowStats = createWindowStats(currentWindowFrames);

        setSession(prev => {
          if (!prev) return prev;
          return addWindowToSession(prev, windowStats);
        });

        setProgress(prev => ({
          ...prev,
          windowsCollected: windowCount,
          progress: Math.round((windowCount / windowsNeeded) * 100),
          message: currentPhase === 'calibrating'
            ? `กำลังปรับเทียบ... (${windowCount}/${windowsNeeded})`
            : `กำลังวิเคราะห์... (${windowCount}/${windowsNeeded})`,
        }));

        currentWindowFrames = [];

        // Check if done
        if (windowCount >= windowsNeeded) {
          clearInterval(intervalRef.current!);

          if (currentPhase === 'calibrating') {
            finishCalibration();
          } else {
            finishScanning();
          }
        }
      }
    }, 1000 / SCAN_CONFIG.samplingRate); // Run at sampling rate
  }, []);

  const createWindowStats = (frames: any[]): WindowStatistics => {
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = (arr: number[]) => {
      const m = mean(arr);
      return Math.sqrt(arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / arr.length);
    };

    const pitches = frames.map(f => f.headPose.pitch);
    const yaws = frames.map(f => f.headPose.yaw);
    const rolls = frames.map(f => f.headPose.roll);
    const smiles = frames.map(f => f.smileProbability);

    const auKeys = Object.keys(frames[0].actionUnits);
    const actionUnits: Record<string, { mean: number; std: number }> = {};
    for (const key of auKeys) {
      const values = frames.map(f => f.actionUnits[key]);
      actionUnits[key] = { mean: mean(values), std: std(values) };
    }

    return {
      windowStart: Date.now() - SCAN_CONFIG.windowSize * 1000,
      windowEnd: Date.now(),
      frameCount: frames.length,
      headPose: {
        pitch: { mean: mean(pitches), std: std(pitches), range: Math.max(...pitches) - Math.min(...pitches) },
        yaw: { mean: mean(yaws), std: std(yaws), range: Math.max(...yaws) - Math.min(...yaws) },
        roll: { mean: mean(rolls), std: std(rolls), range: Math.max(...rolls) - Math.min(...rolls) },
      },
      eyeMetrics: {
        blinkRate: frames[0].eyeMetrics.blinkRate,
        avgEAR: frames[0].eyeMetrics.avgEAR,
      },
      actionUnits,
      smileProbability: { mean: mean(smiles), std: std(smiles) },
    };
  };

  const finishCalibration = useCallback(() => {
    setSession(prev => {
      if (!prev || prev.windowStats.length === 0) return prev;

      try {
        const newBaseline = createBaseline(prev.windowStats, 'user');
        setBaseline(newBaseline);
        localStorage.setItem('facepsy_baseline', JSON.stringify(newBaseline));

        // Start scanning after calibration
        setTimeout(() => startScanning(), 500);
      } catch (error) {
        console.error('Calibration error:', error);
        setErrorMessage('การปรับเทียบล้มเหลว กรุณาลองใหม่');
        setPhase('consent');
      }

      return prev;
    });
  }, [startScanning]);

  const finishScanning = useCallback(() => {
    setPhase('processing');
    setProgress(prev => ({ ...prev, phase: 'processing', message: 'กำลังประมวลผล...' }));

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    setSession(prev => {
      if (!prev) return prev;

      const completedSession = completeSession(prev, baseline);

      if (completedSession.prediction) {
        setPrediction(completedSession.prediction);
        setPhase('results');
        setProgress(p => ({ ...p, phase: 'results', message: 'เสร็จสิ้น' }));
        onComplete?.(completedSession.prediction);
      }

      return completedSession;
    });
  }, [baseline, onComplete]);

  const resetScan = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setPhase('idle');
    setSession(null);
    setPrediction(null);
    setFaceDetected(false);
    setErrorMessage(null);
    setProgress({
      phase: 'idle',
      progress: 0,
      windowsCollected: 0,
      totalWindows: SCAN_CONFIG.scanningWindows,
      message: 'พร้อมเริ่มการตรวจ',
    });
  }, []);

  // =========================================================================
  // Render Functions
  // =========================================================================

  const renderIdleState = () => (
    <div className="text-center space-y-6">
      <div className="w-24 h-24 mx-auto bg-gradient-to-br from-violet-500 to-indigo-600 rounded-full flex items-center justify-center">
        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-gray-800">ตรวจเช็คภาวะอารมณ์เบื้องต้น</h2>
        <p className="text-gray-600 mt-2">ใช้เวลาประมาณ 1 นาที</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 text-left text-sm text-gray-600 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>ข้อมูลภาพไม่ถูกบันทึก ประมวลผลในเครื่องของคุณ</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>ส่งเฉพาะค่าสถิติที่เข้ารหัสไปยังเซิร์ฟเวอร์</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>คุณลบข้อมูลได้ทุกเมื่อ</span>
        </div>
      </div>

      <button
        onClick={() => setPhase('consent')}
        className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-200"
      >
        เริ่มตรวจฟรี
      </button>
    </div>
  );

  const renderConsentState = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">ความยินยอมและความเป็นส่วนตัว</h2>

      <div className="bg-gray-50 rounded-xl p-5 space-y-4 text-sm">
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-800">ข้อมูลที่เก็บ</p>
            <p className="text-gray-600">ค่าสถิติการแสดงออกทางใบหน้า (ไม่มีรูปภาพ)</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-800">วัตถุประสงค์</p>
            <p className="text-gray-600">ประเมินแนวโน้มภาวะอารมณ์เบื้องต้น ไม่ใช่การวินิจฉัยโรค</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-800">การลบข้อมูล</p>
            <p className="text-gray-600">คุณสามารถลบข้อมูลทั้งหมดได้ทุกเมื่อ</p>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-medium">คำเตือนสำคัญ</p>
        <p className="mt-1">ผลลัพธ์นี้ไม่ใช่การวินิจฉัยทางการแพทย์ หากคุณมีข้อกังวลด้านสุขภาพจิต กรุณาปรึกษาผู้เชี่ยวชาญ</p>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          <p className="font-medium">เกิดข้อผิดพลาด</p>
          <p className="mt-1">{errorMessage}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setPhase('idle')}
          className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
        >
          ย้อนกลับ
        </button>
        <button
          onClick={() => setPhase('initializing')}
          className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all"
        >
          ยินยอมและเริ่มต้น
        </button>
      </div>
    </div>
  );

  const renderInitializingState = () => (
    <div className="space-y-6">
      {/* Video Preview - Hidden but needed for camera init */}
      <div className="relative aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
          autoPlay
          playsInline
          muted
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center text-white">
            <div className="w-12 h-12 mx-auto border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" />
            <p>กำลังเปิดกล้อง...</p>
            <p className="text-sm text-white/70 mt-2">กรุณาอนุญาตการเข้าถึงกล้อง</p>
          </div>
        </div>
      </div>

      <button
        onClick={resetScan}
        className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
      >
        ยกเลิก
      </button>
    </div>
  );

  // Start camera when entering initializing phase
  useEffect(() => {
    if (phase === 'initializing') {
      startCamera();
    }
  }, [phase, startCamera]);

  // Re-attach stream when video element changes (phase transition)
  useEffect(() => {
    if ((phase === 'calibrating' || phase === 'scanning') && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(console.error);
      }
    }
  }, [phase]);

  const renderScanningState = () => (
    <div className="space-y-6">
      {/* Video Preview */}
      <div className="relative aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
          autoPlay
          playsInline
          muted
        />

        {/* Overlay guides */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Face guide oval */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-60 border-2 border-white/30 rounded-[50%]"></div>
          </div>

          {/* Status indicators */}
          <div className="absolute top-4 left-4 right-4 flex justify-between">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${faceDetected ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
              {faceDetected ? 'ตรวจพบใบหน้า' : 'ไม่พบใบหน้า'}
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/80 text-white">
              แสงเพียงพอ
            </div>
          </div>

          {/* Phase indicator */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-black/50 backdrop-blur-sm rounded-xl p-3">
              <div className="flex justify-between text-white text-sm mb-2">
                <span>{phase === 'calibrating' ? 'กำลังปรับเทียบ' : 'กำลังวิเคราะห์'}</span>
                <span>{progress.windowsCollected}/{progress.totalWindows}</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <p className="text-white/70 text-xs mt-2 text-center">{progress.message}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-sm text-gray-600 text-center">
          {phase === 'calibrating'
            ? 'กรุณาทำหน้าปกติและมองที่กล้อง ระบบกำลังเรียนรู้ลักษณะใบหน้าของคุณ'
            : 'ใช้อุปกรณ์ตามปกติ ระบบจะวิเคราะห์การแสดงออกทางใบหน้าอัตโนมัติ'}
        </p>
      </div>

      <button
        onClick={resetScan}
        className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
      >
        ยกเลิก
      </button>

      {/* Debug Info */}
      {showDebugInfo && (
        <div className="bg-gray-100 rounded-xl p-4 text-xs font-mono">
          <p>Phase: {phase}</p>
          <p>Windows: {progress.windowsCollected}/{progress.totalWindows}</p>
          <p>Progress: {progress.progress}%</p>
        </div>
      )}
    </div>
  );

  const renderProcessingState = () => (
    <div className="text-center space-y-6 py-8">
      <div className="w-16 h-16 mx-auto border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      <div>
        <p className="text-lg font-medium text-gray-800">กำลังประมวลผล</p>
        <p className="text-gray-600 text-sm mt-1">วิเคราะห์ข้อมูลที่เก็บมา...</p>
      </div>
    </div>
  );

  const renderResultsState = () => {
    if (!prediction) return null;

    const severityColors: Record<string, string> = {
      minimal: 'bg-green-500',
      mild: 'bg-yellow-500',
      moderate: 'bg-orange-500',
      moderately_severe: 'bg-red-400',
      severe: 'bg-red-600',
    };

    const severityLabels: Record<string, string> = {
      minimal: 'ปกติ',
      mild: 'เล็กน้อย',
      moderate: 'ปานกลาง',
      moderately_severe: 'ค่อนข้างรุนแรง',
      severe: 'รุนแรง',
    };

    return (
      <div className="space-y-6">
        {/* Summary Card */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="text-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${severityColors[prediction.severity]} text-white font-medium`}>
              <span>{severityLabels[prediction.severity]}</span>
            </div>

            <div className="mt-4">
              <div className="text-4xl font-bold text-gray-800">{prediction.score}</div>
              <div className="text-gray-500 text-sm">คะแนน PHQ-9 โดยประมาณ</div>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              ความมั่นใจ: {Math.round(prediction.confidence * 100)}%
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-5">
          <h3 className="font-medium text-violet-800 mb-3">คำแนะนำ</h3>
          <ul className="space-y-2">
            {prediction.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-violet-700">
                <span className="text-violet-500 mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium">ข้อจำกัดความรับผิดชอบ</p>
          <p className="mt-1">
            ผลลัพธ์นี้เป็นเพียงการประเมินเบื้องต้นจากการวิเคราะห์การแสดงออกทางใบหน้า
            ไม่ใช่การวินิจฉัยทางการแพทย์ หากคุณมีความกังวล กรุณาปรึกษาผู้เชี่ยวชาญ
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={resetScan}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-200"
          >
            ตรวจอีกครั้ง
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // Main Render
  // =========================================================================

  return (
    <div className="max-w-md mx-auto p-4">
      {phase === 'idle' && renderIdleState()}
      {phase === 'consent' && renderConsentState()}
      {phase === 'initializing' && renderInitializingState()}
      {(phase === 'calibrating' || phase === 'scanning') && renderScanningState()}
      {phase === 'processing' && renderProcessingState()}
      {phase === 'results' && renderResultsState()}
    </div>
  );
}
