/**
 * FacePsy React Hook
 * Extracts facial features using MediaPipe Face Mesh for depression screening
 * Based on FacePsy research paper: 151 signals including AUs, EAR, Head Pose
 *
 * Privacy-first: All processing happens in browser, only numeric metadata sent to backend
 */

import { useRef, useState, useCallback, useEffect } from 'react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface HeadPose {
  pitch: number;  // Up/Down rotation (nodding)
  yaw: number;    // Left/Right rotation (shaking head)
  roll: number;   // Tilting head
}

export interface EyeMetrics {
  leftEAR: number;        // Left Eye Aspect Ratio
  rightEAR: number;       // Right Eye Aspect Ratio
  averageEAR: number;     // Average EAR
  leftOpenProbability: number;
  rightOpenProbability: number;
  blinkDetected: boolean;
}

export interface ActionUnits {
  AU01: number;  // Inner Brow Raiser
  AU02: number;  // Outer Brow Raiser (key predictor)
  AU04: number;  // Brow Lowerer
  AU06: number;  // Cheek Raiser (key predictor)
  AU07: number;  // Lid Tightener (key predictor)
  AU10: number;  // Upper Lip Raiser
  AU12: number;  // Lip Corner Puller (key predictor)
  AU14: number;  // Dimpler
  AU15: number;  // Lip Corner Depressor (key predictor)
  AU17: number;  // Chin Raiser (key predictor)
  AU23: number;  // Lip Tightener
  AU24: number;  // Lip Pressor
}

export interface GeometricFeatures {
  mouthAspectRatio: number;
  mouthWidth: number;
  eyebrowHeight: number;
  facialSymmetry: number;
  interVectorAngles: number[];  // IVA features
}

export interface FacialFrame {
  timestamp: number;
  headPose: HeadPose;
  eyeMetrics: EyeMetrics;
  actionUnits: ActionUnits;
  geometricFeatures: GeometricFeatures;
  smileProbability: number;
  landmarks?: number[][];  // Optional raw landmarks for debugging
}

export interface WindowStatistics {
  windowStart: number;
  windowEnd: number;
  frameCount: number;
  headPose: {
    pitch: { mean: number; std: number; range: number };
    yaw: { mean: number; std: number; range: number };
    roll: { mean: number; std: number; range: number };
  };
  eyeMetrics: {
    blinkRate: number;  // blinks per minute
    avgEAR: { mean: number; std: number };
  };
  actionUnits: {
    [key: string]: { mean: number; std: number };
  };
  smileProbability: { mean: number; std: number };
}

export interface FacePsyConfig {
  samplingRate: number;           // FPS (default: 2.5 as per paper)
  windowDuration: number;         // Window size in ms (default: 10000)
  maxImageRetention: number;      // Max ms to keep image (default: 20000)
  enableDebugLandmarks: boolean;  // Store landmarks for debugging
  onFrameProcessed?: (frame: FacialFrame) => void;
  onWindowComplete?: (stats: WindowStatistics) => void;
  onError?: (error: Error) => void;
}

export interface FacePsyState {
  isInitialized: boolean;
  isProcessing: boolean;
  currentFrame: FacialFrame | null;
  windowStats: WindowStatistics | null;
  error: string | null;
  frameCount: number;
  fps: number;
}

// ============================================================================
// Landmark Indices (MediaPipe Face Mesh 468 points)
// ============================================================================

const LANDMARK_INDICES = {
  // Left eye
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeUpper: 159,
  leftEyeLower: 145,
  leftEyeUpperOuter: 158,
  leftEyeLowerOuter: 153,

  // Right eye
  rightEyeOuter: 263,
  rightEyeInner: 362,
  rightEyeUpper: 386,
  rightEyeLower: 374,
  rightEyeUpperOuter: 385,
  rightEyeLowerOuter: 380,

  // Eyebrows
  leftEyebrowInner: 107,
  leftEyebrowOuter: 70,
  rightEyebrowInner: 336,
  rightEyebrowOuter: 300,

  // Nose
  noseTip: 4,
  noseBottom: 2,

  // Mouth
  upperLipTop: 13,
  lowerLipBottom: 14,
  mouthLeft: 61,
  mouthRight: 291,
  upperLipCenter: 0,
  lowerLipCenter: 17,

  // Face contour for head pose
  forehead: 10,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,

  // Additional for AU detection
  leftNasolabialFold: 117,
  rightNasolabialFold: 346,
  leftDimple: 216,
  rightDimple: 436,
};

// ============================================================================
// Mathematical Utilities
// ============================================================================

function distance3D(p1: number[], p2: number[]): number {
  return Math.sqrt(
    Math.pow(p2[0] - p1[0], 2) +
    Math.pow(p2[1] - p1[1], 2) +
    Math.pow(p2[2] - p1[2], 2)
  );
}

function distance2D(p1: number[], p2: number[]): number {
  return Math.sqrt(
    Math.pow(p2[0] - p1[0], 2) +
    Math.pow(p2[1] - p1[1], 2)
  );
}

function calculateAngle(p1: number[], p2: number[], p3: number[]): number {
  const v1 = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const v2 = [p3[0] - p2[0], p3[1] - p2[1], p3[2] - p2[2]];

  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const mag1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2 + v1[2] ** 2);
  const mag2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2 + v2[2] ** 2);

  if (mag1 === 0 || mag2 === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / arr.length);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// Feature Extraction Functions
// ============================================================================

function extractLandmarkArray(
  landmarks: { x: number; y: number; z: number }[],
  width: number,
  height: number
): number[][] {
  return landmarks.map(lm => [
    lm.x * width,
    lm.y * height,
    lm.z * width  // Z is relative to face width
  ]);
}

function calculateEyeAspectRatio(landmarks: number[][], isLeft: boolean): number {
  /**
   * EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
   * Measures eye openness, drops during blinks
   */
  const indices = isLeft
    ? {
        p1: LANDMARK_INDICES.leftEyeOuter,
        p2: LANDMARK_INDICES.leftEyeUpper,
        p3: LANDMARK_INDICES.leftEyeUpperOuter,
        p4: LANDMARK_INDICES.leftEyeInner,
        p5: LANDMARK_INDICES.leftEyeLowerOuter,
        p6: LANDMARK_INDICES.leftEyeLower,
      }
    : {
        p1: LANDMARK_INDICES.rightEyeOuter,
        p2: LANDMARK_INDICES.rightEyeUpper,
        p3: LANDMARK_INDICES.rightEyeUpperOuter,
        p4: LANDMARK_INDICES.rightEyeInner,
        p5: LANDMARK_INDICES.rightEyeLowerOuter,
        p6: LANDMARK_INDICES.rightEyeLower,
      };

  const vertical1 = distance2D(landmarks[indices.p2], landmarks[indices.p6]);
  const vertical2 = distance2D(landmarks[indices.p3], landmarks[indices.p5]);
  const horizontal = distance2D(landmarks[indices.p1], landmarks[indices.p4]);

  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2 * horizontal);
}

function calculateHeadPose(landmarks: number[][]): HeadPose {
  /**
   * Calculate Euler angles from face landmarks
   * Uses nose, chin, and eye corners to estimate 3D orientation
   */
  const noseTip = landmarks[LANDMARK_INDICES.noseTip];
  const chin = landmarks[LANDMARK_INDICES.chin];
  const forehead = landmarks[LANDMARK_INDICES.forehead];
  const leftEye = landmarks[LANDMARK_INDICES.leftEyeOuter];
  const rightEye = landmarks[LANDMARK_INDICES.rightEyeOuter];

  // Pitch: vertical angle (nodding)
  const faceVertical = [chin[0] - forehead[0], chin[1] - forehead[1], chin[2] - forehead[2]];
  const pitch = Math.atan2(faceVertical[2], faceVertical[1]) * (180 / Math.PI);

  // Yaw: horizontal rotation (left-right)
  const eyeCenter = [(leftEye[0] + rightEye[0]) / 2, (leftEye[1] + rightEye[1]) / 2, (leftEye[2] + rightEye[2]) / 2];
  const yaw = Math.atan2(noseTip[0] - eyeCenter[0], Math.abs(noseTip[2] - eyeCenter[2]) + 0.001) * (180 / Math.PI);

  // Roll: head tilt
  const roll = Math.atan2(rightEye[1] - leftEye[1], rightEye[0] - leftEye[0]) * (180 / Math.PI);

  return {
    pitch: clamp(pitch, -90, 90),
    yaw: clamp(yaw, -90, 90),
    roll: clamp(roll, -90, 90),
  };
}

function calculateActionUnits(landmarks: number[][], faceWidth: number, faceHeight: number): ActionUnits {
  /**
   * Approximate Action Unit intensities from landmark geometry
   * Based on FACS (Facial Action Coding System)
   * Values normalized to 0-1 range
   */

  // Normalize all distances by face dimensions for consistency
  const normalize = (value: number, dimension: number) => clamp(value / dimension, 0, 1);

  // AU01 - Inner Brow Raiser
  const leftBrowInnerHeight = landmarks[LANDMARK_INDICES.leftEyeUpper][1] - landmarks[LANDMARK_INDICES.leftEyebrowInner][1];
  const rightBrowInnerHeight = landmarks[LANDMARK_INDICES.rightEyeUpper][1] - landmarks[LANDMARK_INDICES.rightEyebrowInner][1];
  const AU01 = normalize((leftBrowInnerHeight + rightBrowInnerHeight) / 2, faceHeight * 0.1) * 0.5;

  // AU02 - Outer Brow Raiser (KEY PREDICTOR)
  const leftBrowOuterHeight = landmarks[LANDMARK_INDICES.leftEyeUpper][1] - landmarks[LANDMARK_INDICES.leftEyebrowOuter][1];
  const rightBrowOuterHeight = landmarks[LANDMARK_INDICES.rightEyeUpper][1] - landmarks[LANDMARK_INDICES.rightEyebrowOuter][1];
  const AU02 = normalize((leftBrowOuterHeight + rightBrowOuterHeight) / 2, faceHeight * 0.08) * 0.5;

  // AU04 - Brow Lowerer
  const browDistance = distance2D(landmarks[LANDMARK_INDICES.leftEyebrowInner], landmarks[LANDMARK_INDICES.rightEyebrowInner]);
  const AU04 = 1 - normalize(browDistance, faceWidth * 0.15);

  // AU06 - Cheek Raiser (KEY PREDICTOR)
  const leftCheekRaise = landmarks[LANDMARK_INDICES.leftEyeLower][1] - landmarks[LANDMARK_INDICES.leftNasolabialFold][1];
  const rightCheekRaise = landmarks[LANDMARK_INDICES.rightEyeLower][1] - landmarks[LANDMARK_INDICES.rightNasolabialFold][1];
  const AU06 = clamp(1 - normalize((leftCheekRaise + rightCheekRaise) / 2, faceHeight * 0.15), 0, 1);

  // AU07 - Lid Tightener (KEY PREDICTOR)
  const leftEAR = calculateEyeAspectRatio(landmarks, true);
  const rightEAR = calculateEyeAspectRatio(landmarks, false);
  const AU07 = clamp(1 - (leftEAR + rightEAR) / 0.6, 0, 1);

  // AU10 - Upper Lip Raiser
  const upperLipToNose = distance2D(landmarks[LANDMARK_INDICES.upperLipTop], landmarks[LANDMARK_INDICES.noseBottom]);
  const AU10 = clamp(1 - normalize(upperLipToNose, faceHeight * 0.1), 0, 1);

  // AU12 - Lip Corner Puller (smile) (KEY PREDICTOR)
  const mouthWidth = distance2D(landmarks[LANDMARK_INDICES.mouthLeft], landmarks[LANDMARK_INDICES.mouthRight]);
  const AU12 = clamp(normalize(mouthWidth, faceWidth * 0.5) - 0.3, 0, 1);

  // AU14 - Dimpler
  const leftDimpleDepth = Math.abs(landmarks[LANDMARK_INDICES.leftDimple][2] - landmarks[LANDMARK_INDICES.mouthLeft][2]);
  const rightDimpleDepth = Math.abs(landmarks[LANDMARK_INDICES.rightDimple][2] - landmarks[LANDMARK_INDICES.mouthRight][2]);
  const AU14 = normalize((leftDimpleDepth + rightDimpleDepth) / 2, faceWidth * 0.02);

  // AU15 - Lip Corner Depressor (KEY PREDICTOR - depression indicator)
  const leftCornerY = landmarks[LANDMARK_INDICES.mouthLeft][1];
  const rightCornerY = landmarks[LANDMARK_INDICES.mouthRight][1];
  const mouthCenterY = (landmarks[LANDMARK_INDICES.upperLipTop][1] + landmarks[LANDMARK_INDICES.lowerLipBottom][1]) / 2;
  const cornerDrop = ((leftCornerY + rightCornerY) / 2) - mouthCenterY;
  const AU15 = clamp(normalize(cornerDrop, faceHeight * 0.03), 0, 1);

  // AU17 - Chin Raiser (KEY PREDICTOR)
  const chinToLowerLip = distance2D(landmarks[LANDMARK_INDICES.chin], landmarks[LANDMARK_INDICES.lowerLipBottom]);
  const AU17 = clamp(1 - normalize(chinToLowerLip, faceHeight * 0.15), 0, 1);

  // AU23 - Lip Tightener
  const lipThickness = distance2D(landmarks[LANDMARK_INDICES.upperLipTop], landmarks[LANDMARK_INDICES.lowerLipBottom]);
  const AU23 = clamp(1 - normalize(lipThickness, faceHeight * 0.08), 0, 1);

  // AU24 - Lip Pressor
  const AU24 = AU23 * 0.8;  // Correlated with lip tightening

  return { AU01, AU02, AU04, AU06, AU07, AU10, AU12, AU14, AU15, AU17, AU23, AU24 };
}

function calculateGeometricFeatures(landmarks: number[][], faceWidth: number, faceHeight: number): GeometricFeatures {
  // Mouth Aspect Ratio
  const mouthHeight = distance2D(landmarks[LANDMARK_INDICES.upperLipTop], landmarks[LANDMARK_INDICES.lowerLipBottom]);
  const mouthWidth = distance2D(landmarks[LANDMARK_INDICES.mouthLeft], landmarks[LANDMARK_INDICES.mouthRight]);
  const mouthAspectRatio = mouthWidth > 0 ? mouthHeight / mouthWidth : 0;

  // Eyebrow height relative to eyes
  const leftBrowHeight = landmarks[LANDMARK_INDICES.leftEyeUpper][1] - landmarks[LANDMARK_INDICES.leftEyebrowInner][1];
  const rightBrowHeight = landmarks[LANDMARK_INDICES.rightEyeUpper][1] - landmarks[LANDMARK_INDICES.rightEyebrowInner][1];
  const eyebrowHeight = (leftBrowHeight + rightBrowHeight) / (2 * faceHeight);

  // Facial symmetry (0 = perfect symmetry, 1 = maximum asymmetry)
  const leftEyeCenter = [
    (landmarks[LANDMARK_INDICES.leftEyeOuter][0] + landmarks[LANDMARK_INDICES.leftEyeInner][0]) / 2,
    (landmarks[LANDMARK_INDICES.leftEyeOuter][1] + landmarks[LANDMARK_INDICES.leftEyeInner][1]) / 2,
  ];
  const rightEyeCenter = [
    (landmarks[LANDMARK_INDICES.rightEyeOuter][0] + landmarks[LANDMARK_INDICES.rightEyeInner][0]) / 2,
    (landmarks[LANDMARK_INDICES.rightEyeOuter][1] + landmarks[LANDMARK_INDICES.rightEyeInner][1]) / 2,
  ];
  const noseTip = landmarks[LANDMARK_INDICES.noseTip];
  const leftDist = distance2D(leftEyeCenter, [noseTip[0], noseTip[1]]);
  const rightDist = distance2D(rightEyeCenter, [noseTip[0], noseTip[1]]);
  const facialSymmetry = Math.abs(leftDist - rightDist) / faceWidth;

  // Inter-Vector Angles (IVA) - angles between key facial vectors
  const interVectorAngles = [
    calculateAngle(landmarks[LANDMARK_INDICES.leftEyebrowOuter], landmarks[LANDMARK_INDICES.noseTip], landmarks[LANDMARK_INDICES.rightEyebrowOuter]),
    calculateAngle(landmarks[LANDMARK_INDICES.mouthLeft], landmarks[LANDMARK_INDICES.noseTip], landmarks[LANDMARK_INDICES.mouthRight]),
    calculateAngle(landmarks[LANDMARK_INDICES.leftEyeOuter], landmarks[LANDMARK_INDICES.chin], landmarks[LANDMARK_INDICES.rightEyeOuter]),
    calculateAngle(landmarks[LANDMARK_INDICES.forehead], landmarks[LANDMARK_INDICES.noseTip], landmarks[LANDMARK_INDICES.chin]),
  ];

  return {
    mouthAspectRatio,
    mouthWidth: mouthWidth / faceWidth,
    eyebrowHeight,
    facialSymmetry,
    interVectorAngles,
  };
}

function calculateSmileProbability(actionUnits: ActionUnits): number {
  /**
   * Smile detection using AU12 (primary) and AU06 (secondary)
   * A genuine (Duchenne) smile involves both
   */
  const duchenne = (actionUnits.AU12 * 0.7 + actionUnits.AU06 * 0.3);
  const inhibitor = actionUnits.AU15 * 0.5;  // Lip corner depressor inhibits smile
  return clamp(duchenne - inhibitor, 0, 1);
}

// ============================================================================
// Main Hook
// ============================================================================

export function useFacePsy(config: Partial<FacePsyConfig> = {}) {
  const {
    samplingRate = 2.5,
    windowDuration = 10000,
    maxImageRetention = 20000,
    enableDebugLandmarks = false,
    onFrameProcessed,
    onWindowComplete,
    onError,
  } = config;

  const [state, setState] = useState<FacePsyState>({
    isInitialized: false,
    isProcessing: false,
    currentFrame: null,
    windowStats: null,
    error: null,
    frameCount: 0,
    fps: 0,
  });

  const faceMeshRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameBufferRef = useRef<FacialFrame[]>([]);
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const fpsCounterRef = useRef<number[]>([]);
  const blinkHistoryRef = useRef<{ timestamp: number; detected: boolean }[]>([]);

  // Initialize MediaPipe Face Mesh
  const initialize = useCallback(async (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    try {
      videoRef.current = video;
      canvasRef.current = canvas;

      // Dynamic import to avoid SSR issues
      const { FaceMesh } = await import('@mediapipe/face_mesh');
      const { Camera } = await import('@mediapipe/camera_utils');

      const faceMesh = new FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults(processResults);
      faceMeshRef.current = faceMesh;

      // Initialize camera
      const camera = new Camera(video, {
        onFrame: async () => {
          if (faceMeshRef.current) {
            await faceMeshRef.current.send({ image: video });
          }
        },
        width: 640,
        height: 480,
      });

      await camera.start();

      setState(prev => ({ ...prev, isInitialized: true, error: null }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize MediaPipe';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [onError]);

  // Process MediaPipe results
  const processResults = useCallback((results: any) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      return;
    }

    const now = performance.now();
    const timeSinceLastFrame = now - lastFrameTimeRef.current;
    const targetInterval = 1000 / samplingRate;

    // Throttle to target sampling rate (2.5 FPS as per paper)
    if (timeSinceLastFrame < targetInterval) {
      return;
    }

    // Update FPS counter
    fpsCounterRef.current.push(now);
    fpsCounterRef.current = fpsCounterRef.current.filter(t => now - t < 1000);

    const faceLandmarks = results.multiFaceLandmarks[0];
    const width = videoRef.current?.videoWidth || 640;
    const height = videoRef.current?.videoHeight || 480;

    // Extract landmarks as array
    const landmarks = extractLandmarkArray(faceLandmarks, width, height);

    // Calculate face dimensions for normalization
    const faceWidth = distance2D(
      landmarks[LANDMARK_INDICES.leftCheek],
      landmarks[LANDMARK_INDICES.rightCheek]
    );
    const faceHeight = distance2D(
      landmarks[LANDMARK_INDICES.forehead],
      landmarks[LANDMARK_INDICES.chin]
    );

    // Extract all features
    const headPose = calculateHeadPose(landmarks);
    const actionUnits = calculateActionUnits(landmarks, faceWidth, faceHeight);

    const leftEAR = calculateEyeAspectRatio(landmarks, true);
    const rightEAR = calculateEyeAspectRatio(landmarks, false);
    const averageEAR = (leftEAR + rightEAR) / 2;
    const blinkDetected = averageEAR < 0.2;

    // Track blinks for blink rate calculation
    blinkHistoryRef.current.push({ timestamp: now, detected: blinkDetected });
    blinkHistoryRef.current = blinkHistoryRef.current.filter(b => now - b.timestamp < 60000);

    const eyeMetrics: EyeMetrics = {
      leftEAR,
      rightEAR,
      averageEAR,
      leftOpenProbability: clamp(leftEAR / 0.3, 0, 1),
      rightOpenProbability: clamp(rightEAR / 0.3, 0, 1),
      blinkDetected,
    };

    const geometricFeatures = calculateGeometricFeatures(landmarks, faceWidth, faceHeight);
    const smileProbability = calculateSmileProbability(actionUnits);

    const frame: FacialFrame = {
      timestamp: now,
      headPose,
      eyeMetrics,
      actionUnits,
      geometricFeatures,
      smileProbability,
      landmarks: enableDebugLandmarks ? landmarks : undefined,
    };

    // Add to buffer
    frameBufferRef.current.push(frame);

    // Calculate window statistics when window is complete
    const windowStart = frameBufferRef.current[0]?.timestamp || now;
    if (now - windowStart >= windowDuration) {
      const stats = calculateWindowStatistics(frameBufferRef.current);
      frameBufferRef.current = [];  // Clear buffer

      setState(prev => ({ ...prev, windowStats: stats }));
      onWindowComplete?.(stats);
    }

    // Update state
    lastFrameTimeRef.current = now;
    setState(prev => ({
      ...prev,
      currentFrame: frame,
      frameCount: prev.frameCount + 1,
      fps: fpsCounterRef.current.length,
    }));

    onFrameProcessed?.(frame);
  }, [samplingRate, windowDuration, enableDebugLandmarks, onFrameProcessed, onWindowComplete]);

  // Calculate statistics over a time window
  const calculateWindowStatistics = useCallback((frames: FacialFrame[]): WindowStatistics => {
    if (frames.length === 0) {
      return {
        windowStart: 0,
        windowEnd: 0,
        frameCount: 0,
        headPose: {
          pitch: { mean: 0, std: 0, range: 0 },
          yaw: { mean: 0, std: 0, range: 0 },
          roll: { mean: 0, std: 0, range: 0 },
        },
        eyeMetrics: {
          blinkRate: 0,
          avgEAR: { mean: 0, std: 0 },
        },
        actionUnits: {},
        smileProbability: { mean: 0, std: 0 },
      };
    }

    const pitches = frames.map(f => f.headPose.pitch);
    const yaws = frames.map(f => f.headPose.yaw);
    const rolls = frames.map(f => f.headPose.roll);
    const ears = frames.map(f => f.eyeMetrics.averageEAR);
    const smiles = frames.map(f => f.smileProbability);

    // Count blinks in window
    const blinksInWindow = blinkHistoryRef.current.filter(
      b => b.timestamp >= frames[0].timestamp &&
           b.timestamp <= frames[frames.length - 1].timestamp &&
           b.detected
    ).length;
    const windowDurationMinutes = (frames[frames.length - 1].timestamp - frames[0].timestamp) / 60000;
    const blinkRate = windowDurationMinutes > 0 ? blinksInWindow / windowDurationMinutes : 0;

    // Calculate AU statistics
    const auStats: { [key: string]: { mean: number; std: number } } = {};
    const auKeys = Object.keys(frames[0].actionUnits) as (keyof ActionUnits)[];
    for (const key of auKeys) {
      const values = frames.map(f => f.actionUnits[key]);
      auStats[key] = { mean: mean(values), std: std(values) };
    }

    return {
      windowStart: frames[0].timestamp,
      windowEnd: frames[frames.length - 1].timestamp,
      frameCount: frames.length,
      headPose: {
        pitch: { mean: mean(pitches), std: std(pitches), range: Math.max(...pitches) - Math.min(...pitches) },
        yaw: { mean: mean(yaws), std: std(yaws), range: Math.max(...yaws) - Math.min(...yaws) },
        roll: { mean: mean(rolls), std: std(rolls), range: Math.max(...rolls) - Math.min(...rolls) },
      },
      eyeMetrics: {
        blinkRate,
        avgEAR: { mean: mean(ears), std: std(ears) },
      },
      actionUnits: auStats,
      smileProbability: { mean: mean(smiles), std: std(smiles) },
    };
  }, []);

  // Start processing
  const startProcessing = useCallback(() => {
    setState(prev => ({ ...prev, isProcessing: true }));
  }, []);

  // Stop processing
  const stopProcessing = useCallback(() => {
    setState(prev => ({ ...prev, isProcessing: false }));

    // Clear any remaining frames after maxImageRetention
    setTimeout(() => {
      frameBufferRef.current = [];
    }, maxImageRetention);
  }, [maxImageRetention]);

  // Get current window data for sending to backend
  const getMetadataForBackend = useCallback(() => {
    return {
      currentFrame: state.currentFrame,
      windowStats: state.windowStats,
      sessionInfo: {
        frameCount: state.frameCount,
        fps: state.fps,
        timestamp: Date.now(),
      },
    };
  }, [state]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
    };
  }, []);

  return {
    state,
    initialize,
    startProcessing,
    stopProcessing,
    getMetadataForBackend,
    // Expose refs for external canvas rendering
    videoRef,
    canvasRef,
  };
}

export default useFacePsy;
