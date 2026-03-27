/**
 * PHQ-9 Prediction Logic
 * Based on FacePsy paper methodology
 *
 * PHQ-9 Scoring:
 * - 0-4: Minimal depression
 * - 5-9: Mild depression
 * - 10-14: Moderate depression
 * - 15-19: Moderately severe depression
 * - 20-27: Severe depression
 *
 * Key predictive features from FacePsy:
 * - AU 2, 6, 7, 12, 15, 17 (Action Units)
 * - Head pose variability (reduced movement = higher risk)
 * - Eye dynamics (EAR, blink rate)
 * - Smile frequency and intensity
 */

// ============================================================================
// Types
// ============================================================================

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
    blinkRate: number;
    avgEAR: { mean: number; std: number };
  };
  actionUnits: {
    [key: string]: { mean: number; std: number };
  };
  smileProbability: { mean: number; std: number };
}

export interface PHQ9Prediction {
  score: number;              // 0-27 scale
  severity: PHQ9Severity;
  confidence: number;         // 0-1
  riskIndicators: RiskIndicator[];
  recommendations: string[];
  timestamp: number;
  dataPoints: number;         // Total frames analyzed
}

export type PHQ9Severity = 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe';

export interface RiskIndicator {
  feature: string;
  value: number;
  baseline: number;
  deviation: number;           // How far from baseline
  significance: 'low' | 'medium' | 'high';
  description: string;
}

export interface UserBaseline {
  userId: string;
  createdAt: number;
  updatedAt: number;
  sampleCount: number;
  features: BaselineFeatures;
}

export interface BaselineFeatures {
  headPose: {
    pitch: { mean: number; std: number };
    yaw: { mean: number; std: number };
    roll: { mean: number; std: number };
    movementRange: number;
  };
  actionUnits: {
    [key: string]: { mean: number; std: number };
  };
  eyeMetrics: {
    avgEAR: number;
    blinkRate: number;  // per minute
  };
  smileProbability: {
    mean: number;
    frequency: number;  // smiles per minute
  };
}

export interface PredictionInput {
  windowStats: WindowStatistics[];
  baseline?: UserBaseline;
}

// ============================================================================
// Feature Weights (Based on FacePsy Research)
// ============================================================================

/**
 * Feature importance weights derived from FacePsy paper findings.
 * Higher weights indicate stronger correlation with depression.
 */
const FEATURE_WEIGHTS = {
  // Action Units - Key predictors
  AU02: 0.12,   // Outer Brow Raiser - surprise expression
  AU06: 0.15,   // Cheek Raiser - genuine smile indicator
  AU07: 0.10,   // Lid Tightener
  AU12: 0.18,   // Lip Corner Puller - smile
  AU15: 0.20,   // Lip Corner Depressor - strongest depression indicator
  AU17: 0.08,   // Chin Raiser

  // Head Pose - Movement reduction correlates with depression
  headMovement: 0.15,

  // Eye Dynamics
  blinkRate: 0.05,
  eyeOpenness: 0.03,

  // Overall expressiveness
  expressionVariability: 0.10,
};

// Depression-associated thresholds
const DEPRESSION_THRESHOLDS = {
  // Low values indicate depression risk
  AU06_low: 0.15,      // Low cheek raise (no genuine smile)
  AU12_low: 0.20,      // Low smile intensity
  smileFrequency_low: 2, // Smiles per 10 minutes

  // High values indicate depression risk
  AU15_high: 0.25,     // Lip corner depression
  AU17_high: 0.30,     // Chin raise (tension)

  // Movement thresholds
  headMovement_low: 5,  // Degrees - reduced head movement
  blinkRate_low: 10,    // Blinks per minute (abnormally low)
  blinkRate_high: 25,   // Blinks per minute (anxiety indicator)
};

// ============================================================================
// Utility Functions
// ============================================================================

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function normalizeScore(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function getSeverity(score: number): PHQ9Severity {
  if (score < 5) return 'minimal';
  if (score < 10) return 'mild';
  if (score < 15) return 'moderate';
  if (score < 20) return 'moderately_severe';
  return 'severe';
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

// ============================================================================
// Baseline Calibration
// ============================================================================

/**
 * Create initial baseline from calibration session.
 * User should be in neutral state during calibration.
 */
export function createBaseline(
  windowStats: WindowStatistics[],
  userId: string
): UserBaseline {
  if (windowStats.length === 0) {
    throw new Error('No data available for baseline calibration');
  }

  // Aggregate statistics across all windows
  const pitchMeans = windowStats.map(w => w.headPose.pitch.mean);
  const yawMeans = windowStats.map(w => w.headPose.yaw.mean);
  const rollMeans = windowStats.map(w => w.headPose.roll.mean);
  const earMeans = windowStats.map(w => w.eyeMetrics.avgEAR.mean);
  const blinkRates = windowStats.map(w => w.eyeMetrics.blinkRate);
  const smileMeans = windowStats.map(w => w.smileProbability.mean);

  // Calculate movement range (how much head moves)
  const movementRange = mean([
    mean(windowStats.map(w => w.headPose.pitch.range)),
    mean(windowStats.map(w => w.headPose.yaw.range)),
    mean(windowStats.map(w => w.headPose.roll.range)),
  ]);

  // Calculate smile frequency (times smile > 0.5 per window)
  const smileFrequency = mean(
    windowStats.map(w => w.smileProbability.mean > 0.3 ? 1 : 0)
  ) * 6; // Convert to per-minute assuming 10-second windows

  // Aggregate AU statistics
  const auBaseline: { [key: string]: { mean: number; std: number } } = {};
  const auKeys = ['AU01', 'AU02', 'AU04', 'AU06', 'AU07', 'AU10', 'AU12', 'AU14', 'AU15', 'AU17', 'AU23', 'AU24'];

  for (const key of auKeys) {
    const means = windowStats.map(w => w.actionUnits[key]?.mean || 0);
    const stds = windowStats.map(w => w.actionUnits[key]?.std || 0);
    auBaseline[key] = {
      mean: mean(means),
      std: mean(stds),
    };
  }

  return {
    userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sampleCount: windowStats.length,
    features: {
      headPose: {
        pitch: { mean: mean(pitchMeans), std: std(pitchMeans) },
        yaw: { mean: mean(yawMeans), std: std(yawMeans) },
        roll: { mean: mean(rollMeans), std: std(rollMeans) },
        movementRange,
      },
      actionUnits: auBaseline,
      eyeMetrics: {
        avgEAR: mean(earMeans),
        blinkRate: mean(blinkRates),
      },
      smileProbability: {
        mean: mean(smileMeans),
        frequency: smileFrequency,
      },
    },
  };
}

/**
 * Update existing baseline with new data (adaptive calibration)
 */
export function updateBaseline(
  existing: UserBaseline,
  newWindowStats: WindowStatistics[],
  weight: number = 0.1  // How much to weight new data
): UserBaseline {
  const newBaseline = createBaseline(newWindowStats, existing.userId);

  // Exponential moving average for smooth updates
  const blend = (old: number, current: number) => old * (1 - weight) + current * weight;

  const features = existing.features;
  const newFeatures = newBaseline.features;

  return {
    ...existing,
    updatedAt: Date.now(),
    sampleCount: existing.sampleCount + newWindowStats.length,
    features: {
      headPose: {
        pitch: {
          mean: blend(features.headPose.pitch.mean, newFeatures.headPose.pitch.mean),
          std: blend(features.headPose.pitch.std, newFeatures.headPose.pitch.std),
        },
        yaw: {
          mean: blend(features.headPose.yaw.mean, newFeatures.headPose.yaw.mean),
          std: blend(features.headPose.yaw.std, newFeatures.headPose.yaw.std),
        },
        roll: {
          mean: blend(features.headPose.roll.mean, newFeatures.headPose.roll.mean),
          std: blend(features.headPose.roll.std, newFeatures.headPose.roll.std),
        },
        movementRange: blend(features.headPose.movementRange, newFeatures.headPose.movementRange),
      },
      actionUnits: Object.fromEntries(
        Object.entries(features.actionUnits).map(([key, val]) => [
          key,
          {
            mean: blend(val.mean, newFeatures.actionUnits[key]?.mean || val.mean),
            std: blend(val.std, newFeatures.actionUnits[key]?.std || val.std),
          },
        ])
      ),
      eyeMetrics: {
        avgEAR: blend(features.eyeMetrics.avgEAR, newFeatures.eyeMetrics.avgEAR),
        blinkRate: blend(features.eyeMetrics.blinkRate, newFeatures.eyeMetrics.blinkRate),
      },
      smileProbability: {
        mean: blend(features.smileProbability.mean, newFeatures.smileProbability.mean),
        frequency: blend(features.smileProbability.frequency, newFeatures.smileProbability.frequency),
      },
    },
  };
}

// ============================================================================
// PHQ-9 Prediction
// ============================================================================

/**
 * Main prediction function.
 * Uses window statistics and optional baseline for personalized prediction.
 */
export function predictPHQ9(input: PredictionInput): PHQ9Prediction {
  const { windowStats, baseline } = input;

  if (windowStats.length === 0) {
    return {
      score: 0,
      severity: 'minimal',
      confidence: 0,
      riskIndicators: [],
      recommendations: ['ข้อมูลไม่เพียงพอสำหรับการประเมิน กรุณาทำเซสชันให้นานขึ้น'],
      timestamp: Date.now(),
      dataPoints: 0,
    };
  }

  // Aggregate current session data
  const current = aggregateWindowStats(windowStats);
  const riskIndicators: RiskIndicator[] = [];
  let totalRiskScore = 0;
  let weightSum = 0;

  // =========================================================================
  // Feature 1: AU15 - Lip Corner Depressor (strongest predictor)
  // =========================================================================
  const au15Value = current.actionUnits.AU15?.mean || 0;
  const au15Baseline = baseline?.features.actionUnits.AU15?.mean || 0.1;
  const au15Deviation = au15Value - au15Baseline;

  if (au15Value > DEPRESSION_THRESHOLDS.AU15_high || au15Deviation > 0.1) {
    const contribution = normalizeScore(au15Value, 0, 0.5) * FEATURE_WEIGHTS.AU15;
    totalRiskScore += contribution;
    weightSum += FEATURE_WEIGHTS.AU15;

    riskIndicators.push({
      feature: 'lip_corner_depression',
      value: au15Value,
      baseline: au15Baseline,
      deviation: au15Deviation,
      significance: au15Deviation > 0.2 ? 'high' : au15Deviation > 0.1 ? 'medium' : 'low',
      description: 'ตรวจพบมุมปากตกลง ซึ่งอาจสัมพันธ์กับอารมณ์ไม่สดใส',
    });
  }

  // =========================================================================
  // Feature 2: AU12 & AU06 - Smile indicators (inverse correlation)
  // =========================================================================
  const au12Value = current.actionUnits.AU12?.mean || 0;
  const au06Value = current.actionUnits.AU06?.mean || 0;
  const smileScore = (au12Value + au06Value) / 2;
  const smileBaseline = baseline
    ? (baseline.features.actionUnits.AU12?.mean || 0 + baseline.features.actionUnits.AU06?.mean || 0) / 2
    : 0.25;
  const smileDeviation = smileBaseline - smileScore;

  if (smileScore < DEPRESSION_THRESHOLDS.AU12_low || smileDeviation > 0.1) {
    const contribution = (1 - normalizeScore(smileScore, 0, 0.4)) * FEATURE_WEIGHTS.AU12;
    totalRiskScore += contribution;
    weightSum += FEATURE_WEIGHTS.AU12;

    riskIndicators.push({
      feature: 'smile_expression',
      value: smileScore,
      baseline: smileBaseline,
      deviation: -smileDeviation,
      significance: smileDeviation > 0.15 ? 'high' : smileDeviation > 0.08 ? 'medium' : 'low',
      description: 'ความเข้มของรอยยิ้มลดลงเมื่อเทียบกับค่าฐาน',
    });
  }

  // =========================================================================
  // Feature 3: Head Movement - Psychomotor retardation
  // =========================================================================
  const headMovement = mean([
    current.headPose.pitch.range,
    current.headPose.yaw.range,
    current.headPose.roll.range,
  ]);
  const headBaseline = baseline?.features.headPose.movementRange || 15;
  const headDeviation = headBaseline - headMovement;

  if (headMovement < DEPRESSION_THRESHOLDS.headMovement_low || headDeviation > 5) {
    const contribution = (1 - normalizeScore(headMovement, 0, 20)) * FEATURE_WEIGHTS.headMovement;
    totalRiskScore += contribution;
    weightSum += FEATURE_WEIGHTS.headMovement;

    riskIndicators.push({
      feature: 'head_movement',
      value: headMovement,
      baseline: headBaseline,
      deviation: -headDeviation,
      significance: headDeviation > 10 ? 'high' : headDeviation > 5 ? 'medium' : 'low',
      description: 'การเคลื่อนไหวศีรษะลดลง อาจบ่งบอกถึงการชะลอตัวทางจิตพลศาสตร์',
    });
  }

  // =========================================================================
  // Feature 4: AU02 - Outer Brow Raiser (surprise/engagement)
  // =========================================================================
  const au02Value = current.actionUnits.AU02?.mean || 0;
  const au02Baseline = baseline?.features.actionUnits.AU02?.mean || 0.15;
  const au02Deviation = au02Baseline - au02Value;

  if (au02Deviation > 0.05) {
    const contribution = (1 - normalizeScore(au02Value, 0, 0.3)) * FEATURE_WEIGHTS.AU02;
    totalRiskScore += contribution;
    weightSum += FEATURE_WEIGHTS.AU02;

    riskIndicators.push({
      feature: 'brow_expression',
      value: au02Value,
      baseline: au02Baseline,
      deviation: -au02Deviation,
      significance: au02Deviation > 0.1 ? 'medium' : 'low',
      description: 'การเคลื่อนไหวคิ้วลดลง อาจบ่งบอกถึงการแสดงออกอารมณ์ที่ราบเรียบ',
    });
  }

  // =========================================================================
  // Feature 5: Expression Variability
  // =========================================================================
  const expressionVariability = mean(
    Object.values(current.actionUnits).map(au => au.std)
  );
  const variabilityBaseline = baseline
    ? mean(Object.values(baseline.features.actionUnits).map(au => au.std))
    : 0.1;
  const variabilityDeviation = variabilityBaseline - expressionVariability;

  if (variabilityDeviation > 0.03) {
    const contribution = (1 - normalizeScore(expressionVariability, 0, 0.2)) * FEATURE_WEIGHTS.expressionVariability;
    totalRiskScore += contribution;
    weightSum += FEATURE_WEIGHTS.expressionVariability;

    riskIndicators.push({
      feature: 'expression_variability',
      value: expressionVariability,
      baseline: variabilityBaseline,
      deviation: -variabilityDeviation,
      significance: variabilityDeviation > 0.05 ? 'medium' : 'low',
      description: 'ความหลากหลายในการแสดงออกทางใบหน้าลดลง (อารมณ์ทื่อ)',
    });
  }

  // =========================================================================
  // Feature 6: Blink Rate
  // =========================================================================
  const blinkRate = current.eyeMetrics.blinkRate;
  const blinkBaseline = baseline?.features.eyeMetrics.blinkRate || 15;

  if (blinkRate < DEPRESSION_THRESHOLDS.blinkRate_low || blinkRate > DEPRESSION_THRESHOLDS.blinkRate_high) {
    const contribution = FEATURE_WEIGHTS.blinkRate;
    totalRiskScore += contribution;
    weightSum += FEATURE_WEIGHTS.blinkRate;

    riskIndicators.push({
      feature: 'blink_rate',
      value: blinkRate,
      baseline: blinkBaseline,
      deviation: blinkRate - blinkBaseline,
      significance: Math.abs(blinkRate - blinkBaseline) > 8 ? 'medium' : 'low',
      description: blinkRate < DEPRESSION_THRESHOLDS.blinkRate_low
        ? 'อัตราการกะพริบตาต่ำ อาจบ่งบอกถึงความเหนื่อยล้าหรือผลของยา'
        : 'อัตราการกะพริบตาสูง อาจบ่งบอกถึงความวิตกกังวล',
    });
  }

  // =========================================================================
  // Calculate Final Score
  // =========================================================================

  // Normalize and scale to PHQ-9 range (0-27)
  const normalizedRisk = weightSum > 0 ? totalRiskScore / weightSum : 0;
  const rawScore = sigmoid((normalizedRisk - 0.3) * 8) * 27;

  // Apply smoothing and bounds
  const phq9Score = Math.round(Math.max(0, Math.min(27, rawScore)));

  // Calculate confidence based on data quality
  const confidence = calculateConfidence(windowStats, baseline);

  // Generate recommendations
  const recommendations = generateRecommendations(phq9Score, riskIndicators);

  // Calculate total data points
  const dataPoints = windowStats.reduce((sum, w) => sum + w.frameCount, 0);

  return {
    score: phq9Score,
    severity: getSeverity(phq9Score),
    confidence,
    riskIndicators: riskIndicators.sort((a, b) =>
      b.significance === 'high' ? 1 : a.significance === 'high' ? -1 : 0
    ),
    recommendations,
    timestamp: Date.now(),
    dataPoints,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function aggregateWindowStats(windowStats: WindowStatistics[]) {
  const auKeys = ['AU01', 'AU02', 'AU04', 'AU06', 'AU07', 'AU10', 'AU12', 'AU14', 'AU15', 'AU17', 'AU23', 'AU24'];

  return {
    headPose: {
      pitch: {
        mean: mean(windowStats.map(w => w.headPose.pitch.mean)),
        std: mean(windowStats.map(w => w.headPose.pitch.std)),
        range: mean(windowStats.map(w => w.headPose.pitch.range)),
      },
      yaw: {
        mean: mean(windowStats.map(w => w.headPose.yaw.mean)),
        std: mean(windowStats.map(w => w.headPose.yaw.std)),
        range: mean(windowStats.map(w => w.headPose.yaw.range)),
      },
      roll: {
        mean: mean(windowStats.map(w => w.headPose.roll.mean)),
        std: mean(windowStats.map(w => w.headPose.roll.std)),
        range: mean(windowStats.map(w => w.headPose.roll.range)),
      },
    },
    eyeMetrics: {
      blinkRate: mean(windowStats.map(w => w.eyeMetrics.blinkRate)),
      avgEAR: {
        mean: mean(windowStats.map(w => w.eyeMetrics.avgEAR.mean)),
        std: mean(windowStats.map(w => w.eyeMetrics.avgEAR.std)),
      },
    },
    actionUnits: Object.fromEntries(
      auKeys.map(key => [
        key,
        {
          mean: mean(windowStats.map(w => w.actionUnits[key]?.mean || 0)),
          std: mean(windowStats.map(w => w.actionUnits[key]?.std || 0)),
        },
      ])
    ),
    smileProbability: {
      mean: mean(windowStats.map(w => w.smileProbability.mean)),
      std: mean(windowStats.map(w => w.smileProbability.std)),
    },
  };
}

function calculateConfidence(windowStats: WindowStatistics[], baseline?: UserBaseline): number {
  let confidence = 0.5;  // Base confidence

  // More data = higher confidence
  const dataPoints = windowStats.reduce((sum, w) => sum + w.frameCount, 0);
  confidence += Math.min(0.2, dataPoints / 500);  // Up to +0.2 for sufficient data

  // Having a baseline increases confidence
  if (baseline) {
    confidence += 0.15;

    // Mature baseline (more samples) = even higher confidence
    if (baseline.sampleCount > 10) confidence += 0.1;
  }

  // Multiple windows increase reliability
  if (windowStats.length >= 3) confidence += 0.05;

  return Math.min(0.95, confidence);
}

function generateRecommendations(score: number, indicators: RiskIndicator[]): string[] {
  const recommendations: string[] = [];

  if (score < 5) {
    recommendations.push('สัญญาณทางอารมณ์ของคุณดูมีเสถียรภาพ รักษาการดูแลตัวเองแบบนี้ต่อไป');
    recommendations.push('ลองบันทึกอารมณ์ประจำวันเพื่อเข้าใจตัวเองมากขึ้น');
  } else if (score < 10) {
    recommendations.push('พบสัญญาณเล็กน้อย ลองฝึกเทคนิคผ่อนคลายเช่นหายใจลึกๆ');
    recommendations.push('ลองออกไปเดินเล่นกลางแจ้ง 10-15 นาที รับแสงธรรมชาติ');
    recommendations.push('นอนหลับให้เพียงพอ 7-8 ชั่วโมงต่อคืน');
  } else if (score < 15) {
    recommendations.push('พบสัญญาณปานกลาง แนะนำให้ปรึกษาผู้เชี่ยวชาญด้านสุขภาวะ');
    recommendations.push('บันทึกอารมณ์ทุกวันเพื่อสังเกตรูปแบบและปัจจัยกระตุ้น');
    recommendations.push('ให้ความสำคัญกับการนอนหลับและการออกกำลังกาย');
    recommendations.push('พูดคุยกับคนที่คุณไว้วางใจเกี่ยวกับความรู้สึก');
  } else if (score < 20) {
    recommendations.push('พบสัญญาณที่ควรใส่ใจ กรุณาพิจารณาปรึกษานักจิตวิทยาหรือจิตแพทย์');
    recommendations.push('พูดคุยกับเพื่อนหรือครอบครัวที่ไว้วางใจ');
    recommendations.push('หลีกเลี่ยงการตัดสินใจสำคัญในช่วงนี้');
  } else {
    recommendations.push('พบสัญญาณที่ควรได้รับการดูแล แนะนำให้พบผู้เชี่ยวชาญด้านสุขภาพจิตโดยเร็ว');
    recommendations.push('สายด่วนสุขภาพจิต กรมสุขภาพจิต โทร 1323 (24 ชม.)');
    recommendations.push('อย่าอยู่คนเดียว พูดคุยกับคนที่คุณไว้วางใจ');
  }

  // Specific recommendations based on indicators
  const highIndicators = indicators.filter(i => i.significance === 'high');
  if (highIndicators.some(i => i.feature === 'head_movement')) {
    recommendations.push('ลองยืดเส้นยืดสายและขยับร่างกายเบาๆ ระหว่างวัน');
  }
  if (highIndicators.some(i => i.feature === 'expression_variability')) {
    recommendations.push('ทำกิจกรรมที่ทำให้คุณมีความสุขหรือยิ้มได้');
  }
  if (highIndicators.some(i => i.feature === 'blink_rate')) {
    recommendations.push('พักสายตาจากหน้าจอ และหลับตาพักเป็นระยะ');
  }

  return recommendations;
}

// ============================================================================
// API Integration
// ============================================================================

export interface PredictionSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  windowStats: WindowStatistics[];
  prediction?: PHQ9Prediction;
}

/**
 * Create a new prediction session
 */
export function createSession(): PredictionSession {
  return {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    startTime: Date.now(),
    windowStats: [],
  };
}

/**
 * Add window statistics to session
 */
export function addWindowToSession(
  session: PredictionSession,
  windowStats: WindowStatistics
): PredictionSession {
  return {
    ...session,
    windowStats: [...session.windowStats, windowStats],
  };
}

/**
 * Complete session and generate prediction
 */
export function completeSession(
  session: PredictionSession,
  baseline?: UserBaseline
): PredictionSession {
  const prediction = predictPHQ9({
    windowStats: session.windowStats,
    baseline,
  });

  return {
    ...session,
    endTime: Date.now(),
    prediction,
  };
}

export default {
  predictPHQ9,
  createBaseline,
  updateBaseline,
  createSession,
  addWindowToSession,
  completeSession,
};
