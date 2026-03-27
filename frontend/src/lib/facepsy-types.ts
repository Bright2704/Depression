export interface HeadPose {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface EyeMetrics {
  leftEAR: number;
  rightEAR: number;
  averageEAR: number;
  leftOpenProbability: number;
  rightOpenProbability: number;
  blinkDetected: boolean;
}

export interface ActionUnits {
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

export interface GeometricFeatures {
  mouthAspectRatio: number;
  mouthWidth: number;
  eyebrowHeight: number;
  facialSymmetry: number;
  interVectorAngles: number[];
}
