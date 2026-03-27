/**
 * Real Face Analyzer using MediaPipe Face Mesh
 * วิเคราะห์ใบหน้าจริงจาก Video Feed
 *
 * คำนวณ:
 * - Action Units (AU) จาก landmark distances
 * - Head Pose (Pitch, Yaw, Roll) จาก 3D landmarks
 * - Eye Aspect Ratio (EAR) สำหรับ blink detection
 * - Smile Probability จาก mouth landmarks
 */

// ============================================================================
// MediaPipe Face Mesh Landmark Indices
// ============================================================================

// ดวงตาซ้าย (สำหรับ EAR)
const LEFT_EYE = {
  top: [159, 145],      // บน
  bottom: [145, 159],   // ล่าง
  left: 33,             // มุมซ้าย
  right: 133,           // มุมขวา
  upper: [159, 158, 157, 173, 246],
  lower: [145, 144, 163, 7, 33],
};

// ดวงตาขวา
const RIGHT_EYE = {
  top: [386, 374],
  bottom: [374, 386],
  left: 362,
  right: 263,
  upper: [386, 385, 384, 398, 466],
  lower: [374, 373, 390, 249, 263],
};

// ปาก
const MOUTH = {
  upperLipTop: 13,
  upperLipBottom: 14,
  lowerLipTop: 14,
  lowerLipBottom: 17,
  leftCorner: 61,
  rightCorner: 291,
  upperOuter: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
  lowerOuter: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
};

// คิ้ว
const LEFT_EYEBROW = {
  inner: 107,
  outer: 70,
  top: [107, 66, 105, 63, 70],
};

const RIGHT_EYEBROW = {
  inner: 336,
  outer: 300,
  top: [336, 296, 334, 293, 300],
};

// จุดอ้างอิงใบหน้า
const FACE_REFERENCE = {
  noseTip: 1,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  foreheadCenter: 10,
  noseBase: 2,
};

// ============================================================================
// Types
// ============================================================================

export interface FaceLandmarks {
  x: number;
  y: number;
  z?: number;
}

export interface FaceAnalysisResult {
  detected: boolean;
  headPose: {
    pitch: number;  // ก้ม/เงย (degrees)
    yaw: number;    // หันซ้าย/ขวา (degrees)
    roll: number;   // เอียง (degrees)
  };
  actionUnits: {
    AU01: number;  // Inner Brow Raiser (ยกคิ้วด้านใน)
    AU02: number;  // Outer Brow Raiser (ยกคิ้วด้านนอก)
    AU04: number;  // Brow Lowerer (ขมวดคิ้ว)
    AU06: number;  // Cheek Raiser (ยกแก้ม - ยิ้มจริง)
    AU07: number;  // Lid Tightener (บีบเปลือกตา)
    AU10: number;  // Upper Lip Raiser
    AU12: number;  // Lip Corner Puller (ยิ้ม)
    AU14: number;  // Dimpler
    AU15: number;  // Lip Corner Depressor (มุมปากตก - เศร้า)
    AU17: number;  // Chin Raiser
    AU23: number;  // Lip Tightener
    AU24: number;  // Lip Pressor
  };
  eyeMetrics: {
    leftEAR: number;   // Left Eye Aspect Ratio
    rightEAR: number;  // Right Eye Aspect Ratio
    avgEAR: number;    // Average
    isBlinking: boolean;
  };
  smileProbability: number;
  mouthOpenness: number;
  faceSize: number;      // ขนาดใบหน้า (pixels)
  timestamp: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

function distance(p1: FaceLandmarks, p2: FaceLandmarks): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function distance2D(p1: FaceLandmarks, p2: FaceLandmarks): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function midpoint(p1: FaceLandmarks, p2: FaceLandmarks): FaceLandmarks {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: ((p1.z || 0) + (p2.z || 0)) / 2,
  };
}

function normalize(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// Eye Aspect Ratio (EAR) Calculation
// ============================================================================

function calculateEAR(landmarks: FaceLandmarks[], eyeIndices: typeof LEFT_EYE): number {
  // EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
  // p1,p4 = horizontal corners
  // p2,p6 = upper lid points
  // p3,p5 = lower lid points

  const p1 = landmarks[eyeIndices.left];
  const p4 = landmarks[eyeIndices.right];

  // Get upper and lower lid points
  const upperPoints = eyeIndices.upper.map(i => landmarks[i]);
  const lowerPoints = eyeIndices.lower.map(i => landmarks[i]);

  // Calculate average upper and lower positions
  const upperAvg = {
    x: upperPoints.reduce((s, p) => s + p.x, 0) / upperPoints.length,
    y: upperPoints.reduce((s, p) => s + p.y, 0) / upperPoints.length,
  };
  const lowerAvg = {
    x: lowerPoints.reduce((s, p) => s + p.x, 0) / lowerPoints.length,
    y: lowerPoints.reduce((s, p) => s + p.y, 0) / lowerPoints.length,
  };

  const verticalDist = distance2D(upperAvg, lowerAvg);
  const horizontalDist = distance2D(p1, p4);

  if (horizontalDist === 0) return 0;

  return verticalDist / horizontalDist;
}

// ============================================================================
// Head Pose Estimation
// ============================================================================

function estimateHeadPose(landmarks: FaceLandmarks[]): { pitch: number; yaw: number; roll: number } {
  // ใช้ key points สำหรับประมาณการท่าทางศีรษะ
  const noseTip = landmarks[FACE_REFERENCE.noseTip];
  const chin = landmarks[FACE_REFERENCE.chin];
  const leftEye = landmarks[FACE_REFERENCE.leftEyeOuter];
  const rightEye = landmarks[FACE_REFERENCE.rightEyeOuter];
  const forehead = landmarks[FACE_REFERENCE.foreheadCenter];
  const noseBase = landmarks[FACE_REFERENCE.noseBase];

  // Yaw: หันซ้าย/ขวา (จากระยะห่างตาซ้าย-จมูก vs ตาขวา-จมูก)
  const leftDist = distance2D(leftEye, noseTip);
  const rightDist = distance2D(rightEye, noseTip);
  const totalDist = leftDist + rightDist;
  const yawRatio = totalDist > 0 ? (rightDist - leftDist) / totalDist : 0;
  const yaw = yawRatio * 45; // Convert to degrees (approx)

  // Pitch: ก้ม/เงย (จากตำแหน่ง z ของจมูกเทียบกับตา)
  const eyeCenter = midpoint(leftEye, rightEye);
  const verticalDist = noseTip.y - eyeCenter.y;
  const faceHeight = distance2D(forehead, chin);
  const pitchRatio = faceHeight > 0 ? verticalDist / faceHeight : 0;
  const pitch = (pitchRatio - 0.3) * 60; // Normalize and convert to degrees

  // Roll: เอียงซ้าย/ขวา (จากมุมเอียงของเส้นระหว่างตา)
  const eyeDeltaY = rightEye.y - leftEye.y;
  const eyeDeltaX = rightEye.x - leftEye.x;
  const roll = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI);

  return {
    pitch: clamp(pitch, -45, 45),
    yaw: clamp(yaw, -45, 45),
    roll: clamp(roll, -30, 30),
  };
}

// ============================================================================
// Action Unit Calculations
// ============================================================================

function calculateActionUnits(
  landmarks: FaceLandmarks[],
  faceHeight: number
): FaceAnalysisResult['actionUnits'] {
  // Normalize factor based on face size
  const norm = faceHeight > 0 ? 100 / faceHeight : 1;

  // -------------------------------------------------------------------------
  // AU01: Inner Brow Raiser (ยกคิ้วด้านใน)
  // วัดระยะห่างระหว่างคิ้วด้านในกับดั้งจมูก
  // -------------------------------------------------------------------------
  const leftBrowInner = landmarks[LEFT_EYEBROW.inner];
  const rightBrowInner = landmarks[RIGHT_EYEBROW.inner];
  const noseBase = landmarks[FACE_REFERENCE.noseBase];
  const browInnerDist = (distance2D(leftBrowInner, noseBase) + distance2D(rightBrowInner, noseBase)) / 2;
  const AU01 = normalize(browInnerDist * norm, 15, 30);

  // -------------------------------------------------------------------------
  // AU02: Outer Brow Raiser (ยกคิ้วด้านนอก)
  // วัดระยะห่างระหว่างคิ้วด้านนอกกับมุมตา
  // -------------------------------------------------------------------------
  const leftBrowOuter = landmarks[LEFT_EYEBROW.outer];
  const rightBrowOuter = landmarks[RIGHT_EYEBROW.outer];
  const leftEyeOuter = landmarks[FACE_REFERENCE.leftEyeOuter];
  const rightEyeOuter = landmarks[FACE_REFERENCE.rightEyeOuter];
  const leftOuterDist = distance2D(leftBrowOuter, leftEyeOuter);
  const rightOuterDist = distance2D(rightBrowOuter, rightEyeOuter);
  const browOuterDist = (leftOuterDist + rightOuterDist) / 2;
  const AU02 = normalize(browOuterDist * norm, 8, 20);

  // -------------------------------------------------------------------------
  // AU04: Brow Lowerer (ขมวดคิ้ว - Frown)
  // วัดระยะห่างระหว่างคิ้วทั้งสอง (ขมวด = ใกล้กัน)
  // -------------------------------------------------------------------------
  const browDistance = distance2D(leftBrowInner, rightBrowInner);
  const AU04 = 1 - normalize(browDistance * norm, 10, 30); // Inverse: closer = higher AU04

  // -------------------------------------------------------------------------
  // AU06: Cheek Raiser (ยกแก้ม - Duchenne smile)
  // วัดจากตำแหน่งแก้มที่ยกขึ้นเมื่อยิ้มจริง
  // -------------------------------------------------------------------------
  const leftCheek = landmarks[FACE_REFERENCE.leftCheek];
  const rightCheek = landmarks[FACE_REFERENCE.rightCheek];
  const leftEye = landmarks[LEFT_EYE.lower[2]];
  const rightEye = landmarks[RIGHT_EYE.lower[2]];
  const leftCheekEyeDist = distance2D(leftCheek, leftEye);
  const rightCheekEyeDist = distance2D(rightCheek, rightEye);
  const cheekRaise = (leftCheekEyeDist + rightCheekEyeDist) / 2;
  const AU06 = 1 - normalize(cheekRaise * norm, 20, 40); // Closer = more raised

  // -------------------------------------------------------------------------
  // AU07: Lid Tightener (บีบเปลือกตา)
  // -------------------------------------------------------------------------
  const leftEAR = calculateEAR(landmarks, LEFT_EYE);
  const rightEAR = calculateEAR(landmarks, RIGHT_EYE);
  const avgEAR = (leftEAR + rightEAR) / 2;
  const AU07 = 1 - normalize(avgEAR, 0.15, 0.35); // Smaller opening = more tightening

  // -------------------------------------------------------------------------
  // AU10: Upper Lip Raiser
  // -------------------------------------------------------------------------
  const upperLipTop = landmarks[MOUTH.upperLipTop];
  const noseBottom = landmarks[FACE_REFERENCE.noseBase];
  const upperLipNoseDist = distance2D(upperLipTop, noseBottom);
  const AU10 = 1 - normalize(upperLipNoseDist * norm, 10, 25);

  // -------------------------------------------------------------------------
  // AU12: Lip Corner Puller (ยิ้ม - SMILE) ⭐ สำคัญมาก
  // วัดจากมุมปากที่ยกขึ้นและกว้างขึ้น
  // -------------------------------------------------------------------------
  const leftMouthCorner = landmarks[MOUTH.leftCorner];
  const rightMouthCorner = landmarks[MOUTH.rightCorner];
  const mouthWidth = distance2D(leftMouthCorner, rightMouthCorner);

  // ตรวจสอบว่ามุมปากยกขึ้นหรือไม่ (เทียบกับจุดกลางปาก)
  const mouthCenter = midpoint(landmarks[MOUTH.upperLipTop], landmarks[MOUTH.lowerLipBottom]);
  const leftCornerLift = mouthCenter.y - leftMouthCorner.y;
  const rightCornerLift = mouthCenter.y - rightMouthCorner.y;
  const avgCornerLift = (leftCornerLift + rightCornerLift) / 2;

  // รวมความกว้างและการยกมุมปาก
  const smileScore = (normalize(mouthWidth * norm, 25, 45) + normalize(avgCornerLift * norm, -5, 10)) / 2;
  const AU12 = clamp(smileScore, 0, 1);

  // -------------------------------------------------------------------------
  // AU14: Dimpler (ลักยิ้ม)
  // -------------------------------------------------------------------------
  const AU14 = AU12 * 0.5; // Approximation based on smile

  // -------------------------------------------------------------------------
  // AU15: Lip Corner Depressor (มุมปากตก - SAD) ⭐ สำคัญมาก
  // ตรงข้ามกับ AU12 - มุมปากตกลง
  // -------------------------------------------------------------------------
  const cornerDrop = -avgCornerLift; // Negative lift = drop
  const AU15 = clamp(normalize(cornerDrop * norm, 0, 15), 0, 1);

  // -------------------------------------------------------------------------
  // AU17: Chin Raiser (ยกคาง - tension)
  // -------------------------------------------------------------------------
  const chin = landmarks[FACE_REFERENCE.chin];
  const lowerLip = landmarks[MOUTH.lowerLipBottom];
  const chinLipDist = distance2D(chin, lowerLip);
  const AU17 = 1 - normalize(chinLipDist * norm, 15, 30);

  // -------------------------------------------------------------------------
  // AU23: Lip Tightener
  // -------------------------------------------------------------------------
  const lipHeight = distance2D(landmarks[MOUTH.upperLipBottom], landmarks[MOUTH.lowerLipTop]);
  const AU23 = 1 - normalize(lipHeight * norm, 2, 15);

  // -------------------------------------------------------------------------
  // AU24: Lip Pressor
  // -------------------------------------------------------------------------
  const AU24 = AU23 * 0.8;

  return {
    AU01: clamp(AU01, 0, 1),
    AU02: clamp(AU02, 0, 1),
    AU04: clamp(AU04, 0, 1),
    AU06: clamp(AU06, 0, 1),
    AU07: clamp(AU07, 0, 1),
    AU10: clamp(AU10, 0, 1),
    AU12: clamp(AU12, 0, 1),
    AU14: clamp(AU14, 0, 1),
    AU15: clamp(AU15, 0, 1),
    AU17: clamp(AU17, 0, 1),
    AU23: clamp(AU23, 0, 1),
    AU24: clamp(AU24, 0, 1),
  };
}

// ============================================================================
// Smile Detection
// ============================================================================

function calculateSmileProbability(
  actionUnits: FaceAnalysisResult['actionUnits'],
  landmarks: FaceLandmarks[]
): number {
  // Smile = AU12 (lip corner pull) + AU06 (cheek raise)
  // Real smile (Duchenne) needs both!

  const lipCornerPull = actionUnits.AU12;
  const cheekRaise = actionUnits.AU06;
  const lipCornerDrop = actionUnits.AU15;

  // Mouth width ratio
  const leftCorner = landmarks[MOUTH.leftCorner];
  const rightCorner = landmarks[MOUTH.rightCorner];
  const mouthWidth = distance2D(leftCorner, rightCorner);

  const leftCheek = landmarks[FACE_REFERENCE.leftCheek];
  const rightCheek = landmarks[FACE_REFERENCE.rightCheek];
  const faceWidth = distance2D(leftCheek, rightCheek);

  const mouthWidthRatio = faceWidth > 0 ? mouthWidth / faceWidth : 0;
  const widthScore = normalize(mouthWidthRatio, 0.3, 0.5);

  // Combine factors
  // Duchenne smile: high AU12 + high AU06 + low AU15
  const smileScore = (
    lipCornerPull * 0.4 +
    cheekRaise * 0.3 +
    (1 - lipCornerDrop) * 0.2 +
    widthScore * 0.1
  );

  return clamp(smileScore, 0, 1);
}

// ============================================================================
// Mouth Openness
// ============================================================================

function calculateMouthOpenness(landmarks: FaceLandmarks[], faceHeight: number): number {
  const upperLip = landmarks[MOUTH.upperLipBottom];
  const lowerLip = landmarks[MOUTH.lowerLipTop];
  const mouthOpen = distance2D(upperLip, lowerLip);

  const normalizedOpen = faceHeight > 0 ? mouthOpen / faceHeight : 0;
  return normalize(normalizedOpen, 0, 0.15);
}

// ============================================================================
// Main Analyzer Class
// ============================================================================

export class FaceAnalyzer {
  private blinkHistory: boolean[] = [];
  private lastBlinkTime: number = 0;
  private blinkCount: number = 0;
  private sessionStartTime: number = Date.now();

  private readonly EAR_THRESHOLD = 0.21; // Threshold for blink detection
  private readonly BLINK_CONSECUTIVE_FRAMES = 2;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.blinkHistory = [];
    this.lastBlinkTime = 0;
    this.blinkCount = 0;
    this.sessionStartTime = Date.now();
  }

  /**
   * วิเคราะห์ใบหน้าจาก MediaPipe landmarks
   * @param landmarks Array of 468 face landmarks from MediaPipe
   * @returns FaceAnalysisResult
   */
  analyze(landmarks: FaceLandmarks[]): FaceAnalysisResult {
    if (!landmarks || landmarks.length < 468) {
      return this.getEmptyResult();
    }

    const timestamp = Date.now();

    // Calculate face size for normalization
    const forehead = landmarks[FACE_REFERENCE.foreheadCenter];
    const chin = landmarks[FACE_REFERENCE.chin];
    const faceHeight = distance2D(forehead, chin);
    const faceSize = faceHeight;

    // Calculate EAR for both eyes
    const leftEAR = calculateEAR(landmarks, LEFT_EYE);
    const rightEAR = calculateEAR(landmarks, RIGHT_EYE);
    const avgEAR = (leftEAR + rightEAR) / 2;

    // Blink detection
    const isBlinking = avgEAR < this.EAR_THRESHOLD;
    this.updateBlinkTracking(isBlinking, timestamp);

    // Head pose
    const headPose = estimateHeadPose(landmarks);

    // Action Units
    const actionUnits = calculateActionUnits(landmarks, faceHeight);

    // Smile probability
    const smileProbability = calculateSmileProbability(actionUnits, landmarks);

    // Mouth openness
    const mouthOpenness = calculateMouthOpenness(landmarks, faceHeight);

    return {
      detected: true,
      headPose,
      actionUnits,
      eyeMetrics: {
        leftEAR,
        rightEAR,
        avgEAR,
        isBlinking,
      },
      smileProbability,
      mouthOpenness,
      faceSize,
      timestamp,
    };
  }

  private updateBlinkTracking(isBlinking: boolean, timestamp: number): void {
    this.blinkHistory.push(isBlinking);

    // Keep only last 10 frames
    if (this.blinkHistory.length > 10) {
      this.blinkHistory.shift();
    }

    // Detect blink (closed for a few frames then opened)
    const recentHistory = this.blinkHistory.slice(-5);
    const wasBlinking = recentHistory.slice(0, 3).filter(b => b).length >= 2;
    const nowOpen = recentHistory.slice(-2).filter(b => !b).length >= 1;

    if (wasBlinking && nowOpen && timestamp - this.lastBlinkTime > 200) {
      this.blinkCount++;
      this.lastBlinkTime = timestamp;
    }
  }

  /**
   * Get blink rate per minute
   */
  getBlinkRate(): number {
    const elapsedMinutes = (Date.now() - this.sessionStartTime) / 60000;
    if (elapsedMinutes < 0.1) return 15; // Default until we have enough data
    return Math.round(this.blinkCount / elapsedMinutes);
  }

  private getEmptyResult(): FaceAnalysisResult {
    return {
      detected: false,
      headPose: { pitch: 0, yaw: 0, roll: 0 },
      actionUnits: {
        AU01: 0, AU02: 0, AU04: 0, AU06: 0, AU07: 0, AU10: 0,
        AU12: 0, AU14: 0, AU15: 0, AU17: 0, AU23: 0, AU24: 0,
      },
      eyeMetrics: { leftEAR: 0, rightEAR: 0, avgEAR: 0, isBlinking: false },
      smileProbability: 0,
      mouthOpenness: 0,
      faceSize: 0,
      timestamp: Date.now(),
    };
  }
}

// ============================================================================
// MediaPipe Integration Helper
// ============================================================================

/**
 * แปลง MediaPipe FaceLandmarker results เป็น landmarks array
 */
export function convertMediaPipeLandmarks(
  faceLandmarkerResult: any,
  videoWidth: number,
  videoHeight: number
): FaceLandmarks[] | null {
  if (!faceLandmarkerResult?.faceLandmarks?.[0]) {
    return null;
  }

  const landmarks = faceLandmarkerResult.faceLandmarks[0];

  return landmarks.map((lm: any) => ({
    x: lm.x * videoWidth,
    y: lm.y * videoHeight,
    z: lm.z * videoWidth, // z is relative to x
  }));
}

// Export singleton instance
export const faceAnalyzer = new FaceAnalyzer();

export default FaceAnalyzer;
