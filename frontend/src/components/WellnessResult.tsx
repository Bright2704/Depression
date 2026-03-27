/**
 * Wellness Result Component
 * แสดงผลลัพธ์เชิงลึกที่ทำให้ User รู้สึกได้รับการดูแล
 * - การตรวจจับความเสี่ยงโรคต่างๆ
 * - ข้อมูลเชิงลึกจากการวิเคราะห์ใบหน้า
 * - คำแนะนำที่ปรับตามช่วงเวลาที่สแกน
 * - แผนดูแลตัวเองที่ทำได้จริง
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import type { PHQ9Prediction, WindowStatistics } from '@/lib/phq9-predictor';
import type { ScanDebugData } from '@/components/FaceScan';
import type { CheckinResponse } from './QuickCheckin';
import type { PHQ9Response } from '@/components/PHQ9Survey';
import { useAuthStore } from '@/stores/auth-store';
import { authClient } from '@/lib/auth-client';

// ============================================================================
// Types
// ============================================================================

export interface WellnessScore {
  energy: number;
  stress: number;
  fatigue: number;
  emotionalBalance: number;
  overall: 'excellent' | 'good' | 'attention' | 'concern';
}

interface MentalHealthRisk {
  condition: string;
  thaiName: string;
  risk: 'low' | 'moderate' | 'elevated' | 'high';
  percentage: number;
  description: string;
  icon: string;
  color: string;
  indicators: string[];
}

interface TimeContext {
  period: 'morning' | 'afternoon' | 'evening' | 'night';
  hour: number;
  thaiPeriod: string;
  insight: string;
  typicalPattern: string;
  recommendation: string;
}

interface FacialInsight {
  title: string;
  description: string;
  icon: string;
  type: 'positive' | 'neutral' | 'attention';
}

interface DetailedAnalysis {
  category: string;
  icon: string;
  score: number;
  insights: string[];
  suggestion: string;
}

function formatPHQ9Severity(severity: PHQ9Response['severity']): string {
  switch (severity) {
    case 'minimal':
      return 'น้อยมาก';
    case 'mild':
      return 'เล็กน้อย';
    case 'moderate':
      return 'ปานกลาง';
    case 'moderately_severe':
      return 'ค่อนข้างมาก';
    case 'severe':
      return 'รุนแรง';
    default:
      return '-';
  }
}

interface Props {
  prediction: PHQ9Prediction;
  checkinResponse?: CheckinResponse;
  phq9Response?: PHQ9Response;
  onReset: () => void;
  scanTimestamp?: number;
  debugData?: ScanDebugData;
}

// ============================================================================
// Time Context Functions
// ============================================================================

function getTimeContext(timestamp: number): TimeContext {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const timeStr = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} น.`;

  if (hour >= 5 && hour < 12) {
    return {
      period: 'morning',
      hour,
      thaiPeriod: `ช่วงเช้า (${timeStr})`,
      insight: hour < 9
        ? 'คุณตื่นเช็คอินแต่เช้า แสดงว่าใส่ใจสุขภาพของตัวเองดี!'
        : 'ช่วงสายเป็นเวลาที่สมองทำงานได้ดี ผลการวิเคราะห์น่าจะสะท้อนสภาพที่แท้จริง',
      typicalPattern: 'โดยปกติช่วงเช้าคนเรามักมีพลังงานสูงที่สุดของวัน ฮอร์โมน Cortisol จะสูงสุดช่วง 6-8 โมงเช้า ช่วยให้ตื่นตัว',
      recommendation: hour < 9
        ? 'แนะนำให้รับแสงแดดยามเช้า 10-15 นาที จะช่วยตั้งนาฬิกาชีวิตและทำให้หลับง่ายขึ้นตอนกลางคืน'
        : 'ช่วงนี้เหมาะกับการทำงานที่ต้องใช้สมาธิสูง ลองวางแผนทำสิ่งยากๆ ตอนนี้',
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      period: 'afternoon',
      hour,
      thaiPeriod: `ช่วงบ่าย (${timeStr})`,
      insight: hour < 14
        ? 'หลังมื้อเที่ยง ร่างกายอาจรู้สึกง่วงเล็กน้อย เป็นเรื่องปกติ'
        : 'ช่วงบ่ายแก่ๆ พลังงานมักจะลดลง ผลที่ได้อาจสะท้อนความล้าสะสม',
      typicalPattern: 'ช่วง 13:00-15:00 น. เป็น "Post-lunch dip" ที่คนส่วนใหญ่จะรู้สึกง่วงและพลังงานตก เป็นเรื่องปกติทางชีววิทยา',
      recommendation: hour < 14
        ? 'ถ้ารู้สึกง่วงหลังมื้อเที่ยง ลองเดินเล่น 10 นาที หรืองีบสั้นๆ 15-20 นาที'
        : 'ช่วงบ่ายแก่เหมาะกับการทำงานที่เป็น routine หรือประชุม หลีกเลี่ยงการตัดสินใจสำคัญ',
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      period: 'evening',
      hour,
      thaiPeriod: `ช่วงเย็น (${timeStr})`,
      insight: 'หลังเลิกงาน เป็นช่วงที่ความเครียดสะสมมักแสดงออกมา ผลการวิเคราะห์อาจสะท้อนความเหนื่อยล้าของทั้งวัน',
      typicalPattern: 'ช่วงเย็นเป็นเวลาที่ร่างกายเริ่มผ่อนคลาย Cortisol ลดลง อาจรู้สึกเหนื่อยแต่ก็เป็นโอกาสดีในการทบทวนอารมณ์ของวัน',
      recommendation: 'ลองทำกิจกรรมผ่อนคลายก่อนนอน เช่น อ่านหนังสือ ฟังเพลงเบาๆ หรือพูดคุยกับครอบครัว',
    };
  } else {
    return {
      period: 'night',
      hour,
      thaiPeriod: `ช่วงกลางคืน (${timeStr})`,
      insight: hour < 23
        ? 'การเช็คอินก่อนนอนเป็นนิสัยที่ดี ช่วยทบทวนอารมณ์ของวัน'
        : 'ดึกแล้วนะ การนอนดึกอาจส่งผลต่อสุขภาวะอารมณ์ของวันพรุ่งนี้',
      typicalPattern: 'ช่วงกลางคืน ร่างกายผลิต Melatonin เพื่อเตรียมพร้อมสำหรับการนอน หน้าจอสีฟ้าอาจรบกวนการผลิตฮอร์โมนนี้',
      recommendation: hour < 23
        ? 'เตรียมตัวนอนได้เลย ลดแสงหน้าจอและทำห้องให้มืดและเย็น'
        : 'พยายามเข้านอนเร็วกว่านี้คืนพรุ่งนี้ การนอนหลับเพียงพอสำคัญมากต่อสุขภาพจิต',
    };
  }
}

// ============================================================================
// Mental Health Risk Assessment Functions
// ============================================================================

function assessMentalHealthRisks(
  prediction: PHQ9Prediction,
  wellness: WellnessScore,
  checkin?: CheckinResponse
): MentalHealthRisk[] {
  const risks: MentalHealthRisk[] = [];

  // 1. Depression Risk (from PHQ-9)
  const depressionRisk = calculateDepressionRisk(prediction);
  risks.push(depressionRisk);

  // 2. Anxiety Risk (from facial tension, blink rate, stress indicators)
  const anxietyRisk = calculateAnxietyRisk(prediction, wellness, checkin);
  risks.push(anxietyRisk);

  // 3. Burnout Risk (from fatigue, energy, sleep quality)
  const burnoutRisk = calculateBurnoutRisk(wellness, checkin);
  risks.push(burnoutRisk);

  // 4. Sleep Disorder Risk
  const sleepRisk = calculateSleepRisk(prediction, checkin);
  risks.push(sleepRisk);

  return risks;
}

function calculateDepressionRisk(prediction: PHQ9Prediction): MentalHealthRisk {
  const score = prediction.score;
  let risk: MentalHealthRisk['risk'];
  let percentage: number;
  let description: string;
  const indicators: string[] = [];

  if (score < 5) {
    risk = 'low';
    percentage = Math.round((score / 27) * 30);
    description = 'ไม่พบสัญญาณที่น่ากังวล ยินดีด้วย!';
  } else if (score < 10) {
    risk = 'moderate';
    percentage = 30 + Math.round(((score - 5) / 5) * 25);
    description = 'พบสัญญาณเล็กน้อย ควรดูแลตัวเองและติดตามต่อ';
    indicators.push('การแสดงออกทางใบหน้าลดลงเล็กน้อย');
  } else if (score < 15) {
    risk = 'elevated';
    percentage = 55 + Math.round(((score - 10) / 5) * 20);
    description = 'พบสัญญาณที่ควรใส่ใจ แนะนำให้ติดตามอาการอย่างใกล้ชิด';
    indicators.push('ความเข้มของรอยยิ้มลดลงชัดเจน');
    indicators.push('การเคลื่อนไหวใบหน้าน้อยกว่าปกติ');
  } else {
    risk = 'high';
    percentage = 75 + Math.round(((score - 15) / 12) * 25);
    description = 'พบสัญญาณที่ควรได้รับการดูแล แนะนำให้ปรึกษาผู้เชี่ยวชาญ';
    indicators.push('การแสดงออกทางอารมณ์ลดลงมาก');
    indicators.push('สัญญาณของภาวะซึมเศร้า');
    indicators.push('ควรพบจิตแพทย์หรือนักจิตวิทยา');
  }

  // Add specific indicators from prediction
  prediction.riskIndicators.forEach(ind => {
    if (ind.significance === 'high' || ind.significance === 'medium') {
      indicators.push(ind.description);
    }
  });

  return {
    condition: 'depression',
    thaiName: 'ภาวะซึมเศร้า',
    risk,
    percentage: Math.min(100, percentage),
    description,
    icon: '😔',
    color: risk === 'low' ? 'emerald' : risk === 'moderate' ? 'blue' : risk === 'elevated' ? 'amber' : 'rose',
    indicators: indicators.slice(0, 3),
  };
}

function calculateAnxietyRisk(
  prediction: PHQ9Prediction,
  wellness: WellnessScore,
  checkin?: CheckinResponse
): MentalHealthRisk {
  let score = 0;
  const indicators: string[] = [];

  // High stress contributes to anxiety
  if (wellness.stress > 60) {
    score += 30;
    indicators.push('ระดับความเครียดสูง');
  } else if (wellness.stress > 40) {
    score += 15;
  }

  // Check for blink rate anomalies (high blink = anxiety indicator)
  const blinkIndicator = prediction.riskIndicators.find(r => r.feature === 'blink_rate');
  if (blinkIndicator && blinkIndicator.value > 20) {
    score += 20;
    indicators.push('อัตราการกะพริบตาสูงกว่าปกติ');
  }

  // Facial tension indicators
  const hasAU4 = prediction.riskIndicators.some(r =>
    r.feature.includes('brow') && r.significance !== 'low'
  );
  if (hasAU4) {
    score += 15;
    indicators.push('พบการเกร็งกล้ามเนื้อบริเวณคิ้ว');
  }

  // Check-in stress level
  if (checkin && checkin.stressLevel >= 4) {
    score += 25;
    indicators.push('รายงานความเครียดระดับสูง');
  }

  let risk: MentalHealthRisk['risk'];
  let description: string;

  if (score < 25) {
    risk = 'low';
    description = 'ไม่พบสัญญาณความวิตกกังวลที่ชัดเจน';
  } else if (score < 45) {
    risk = 'moderate';
    description = 'พบสัญญาณความเครียดเล็กน้อย ลองฝึกเทคนิคผ่อนคลาย';
  } else if (score < 65) {
    risk = 'elevated';
    description = 'พบสัญญาณความวิตกกังวล ควรหาเวลาพักผ่อนและผ่อนคลาย';
  } else {
    risk = 'high';
    description = 'พบสัญญาณความวิตกกังวลสูง แนะนำให้ปรึกษาผู้เชี่ยวชาญ';
  }

  return {
    condition: 'anxiety',
    thaiName: 'ความวิตกกังวล',
    risk,
    percentage: Math.min(100, score),
    description,
    icon: '😰',
    color: risk === 'low' ? 'emerald' : risk === 'moderate' ? 'blue' : risk === 'elevated' ? 'amber' : 'rose',
    indicators: indicators.slice(0, 3),
  };
}

function calculateBurnoutRisk(
  wellness: WellnessScore,
  checkin?: CheckinResponse
): MentalHealthRisk {
  let score = 0;
  const indicators: string[] = [];

  // Low energy is a key burnout indicator
  if (wellness.energy < 40) {
    score += 35;
    indicators.push('พลังงานต่ำมาก');
  } else if (wellness.energy < 60) {
    score += 20;
    indicators.push('พลังงานค่อนข้างต่ำ');
  }

  // High fatigue
  if (wellness.fatigue > 60) {
    score += 30;
    indicators.push('ความเหนื่อยล้าสะสมสูง');
  } else if (wellness.fatigue > 40) {
    score += 15;
  }

  // Sleep quality
  if (checkin && checkin.sleepQuality <= 2) {
    score += 25;
    indicators.push('คุณภาพการนอนไม่ดี');
  } else if (checkin && checkin.sleepQuality <= 3) {
    score += 10;
  }

  // Low emotional balance
  if (wellness.emotionalBalance < 50) {
    score += 15;
    indicators.push('ความสมดุลทางอารมณ์ต่ำ');
  }

  let risk: MentalHealthRisk['risk'];
  let description: string;

  if (score < 25) {
    risk = 'low';
    description = 'ไม่พบสัญญาณภาวะหมดไฟ พลังงานดี!';
  } else if (score < 50) {
    risk = 'moderate';
    description = 'พบความเหนื่อยล้าบ้าง ควรพักผ่อนให้เพียงพอ';
  } else if (score < 70) {
    risk = 'elevated';
    description = 'มีสัญญาณภาวะหมดไฟ ควรจัดสรรเวลาพักผ่อนอย่างจริงจัง';
  } else {
    risk = 'high';
    description = 'พบสัญญาณภาวะหมดไฟชัดเจน ต้องพักผ่อนและอาจปรึกษาผู้เชี่ยวชาญ';
  }

  return {
    condition: 'burnout',
    thaiName: 'ภาวะหมดไฟ (Burnout)',
    risk,
    percentage: Math.min(100, score),
    description,
    icon: '🔥',
    color: risk === 'low' ? 'emerald' : risk === 'moderate' ? 'blue' : risk === 'elevated' ? 'amber' : 'rose',
    indicators: indicators.slice(0, 3),
  };
}

function calculateSleepRisk(
  prediction: PHQ9Prediction,
  checkin?: CheckinResponse
): MentalHealthRisk {
  let score = 0;
  const indicators: string[] = [];

  // Sleep quality from check-in
  if (checkin) {
    if (checkin.sleepQuality <= 2) {
      score += 45;
      indicators.push('รายงานว่านอนไม่หลับหรือหลับไม่สนิท');
    } else if (checkin.sleepQuality <= 3) {
      score += 25;
      indicators.push('คุณภาพการนอนไม่ดีเท่าที่ควร');
    }
  }

  // Blink rate anomalies can indicate sleep issues
  const blinkIndicator = prediction.riskIndicators.find(r => r.feature === 'blink_rate');
  if (blinkIndicator) {
    if (blinkIndicator.value < 12) {
      score += 20;
      indicators.push('อัตราการกะพริบตาต่ำ (อาจบ่งบอกถึงความง่วง)');
    }
  }

  // Low energy often correlates with poor sleep
  const phqNormalized = prediction.score / 27;
  if (phqNormalized > 0.3) {
    score += 15;
    indicators.push('พบสัญญาณความเหนื่อยล้าจากใบหน้า');
  }

  let risk: MentalHealthRisk['risk'];
  let description: string;

  if (score < 20) {
    risk = 'low';
    description = 'ไม่พบปัญหาการนอนที่ชัดเจน';
  } else if (score < 40) {
    risk = 'moderate';
    description = 'อาจมีปัญหาการนอนเล็กน้อย ลองปรับพฤติกรรมก่อนนอน';
  } else if (score < 60) {
    risk = 'elevated';
    description = 'พบสัญญาณปัญหาการนอน ควรปรับปรุงสุขอนามัยการนอน';
  } else {
    risk = 'high';
    description = 'มีปัญหาการนอนชัดเจน หากเรื้อรังควรปรึกษาแพทย์';
  }

  return {
    condition: 'sleep_disorder',
    thaiName: 'ปัญหาการนอนหลับ',
    risk,
    percentage: Math.min(100, score),
    description,
    icon: '😴',
    color: risk === 'low' ? 'emerald' : risk === 'moderate' ? 'blue' : risk === 'elevated' ? 'amber' : 'rose',
    indicators: indicators.slice(0, 3),
  };
}

// ============================================================================
// Wellness Score Functions
// ============================================================================

function calculateWellnessScore(
  prediction: PHQ9Prediction,
  checkin?: CheckinResponse
): WellnessScore {
  const phqNormalized = prediction.score / 27;

  let energy = 100 - (phqNormalized * 55);
  let stress = phqNormalized * 65;
  let fatigue = phqNormalized * 55;
  let emotionalBalance = 100 - (phqNormalized * 50);

  if (checkin) {
    energy = (energy * 0.6) + ((checkin.energyLevel / 5) * 100 * 0.4);
    stress = (stress * 0.6) + ((checkin.stressLevel / 5) * 100 * 0.4);
    fatigue = (fatigue * 0.5) + (((6 - checkin.sleepQuality) / 5) * 100 * 0.5);
    emotionalBalance = (emotionalBalance * 0.7) + ((checkin.energyLevel / 5) * 100 * 0.3);
  }

  let overall: 'excellent' | 'good' | 'attention' | 'concern' = 'excellent';
  if (prediction.score >= 10 || stress > 65 || fatigue > 65) {
    overall = 'concern';
  } else if (prediction.score >= 5 || stress > 45 || fatigue > 45) {
    overall = 'attention';
  } else if (prediction.score >= 3 || stress > 30 || fatigue > 30) {
    overall = 'good';
  }

  return {
    energy: Math.round(Math.max(0, Math.min(100, energy))),
    stress: Math.round(Math.max(0, Math.min(100, stress))),
    fatigue: Math.round(Math.max(0, Math.min(100, fatigue))),
    emotionalBalance: Math.round(Math.max(0, Math.min(100, emotionalBalance))),
    overall,
  };
}

function getOverallConfig(overall: WellnessScore['overall']) {
  const configs = {
    excellent: {
      text: 'สุขภาวะอารมณ์ดีเยี่ยม',
      subtext: 'คุณดูแลตัวเองได้ดีมาก',
      color: 'text-emerald-700',
      bg: 'bg-gradient-to-r from-emerald-50 to-teal-50',
      border: 'border-emerald-200',
      icon: '🌟',
    },
    good: {
      text: 'สุขภาวะอารมณ์ดี',
      subtext: 'มีบางจุดที่อาจดูแลเพิ่มได้',
      color: 'text-blue-700',
      bg: 'bg-gradient-to-r from-blue-50 to-indigo-50',
      border: 'border-blue-200',
      icon: '💙',
    },
    attention: {
      text: 'ควรใส่ใจดูแลตัวเอง',
      subtext: 'พบสัญญาณที่ควรให้ความสำคัญ',
      color: 'text-amber-700',
      bg: 'bg-gradient-to-r from-amber-50 to-orange-50',
      border: 'border-amber-200',
      icon: '💛',
    },
    concern: {
      text: 'ควรดูแลเป็นพิเศษ',
      subtext: 'แนะนำให้พักผ่อนและดูแลตัวเองมากขึ้น',
      color: 'text-rose-700',
      bg: 'bg-gradient-to-r from-rose-50 to-pink-50',
      border: 'border-rose-200',
      icon: '🧡',
    },
  };
  return configs[overall];
}

function getRiskColor(risk: MentalHealthRisk['risk']) {
  switch (risk) {
    case 'low': return { bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500' };
    case 'moderate': return { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500' };
    case 'elevated': return { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' };
    case 'high': return { bg: 'bg-rose-100', text: 'text-rose-700', bar: 'bg-rose-500' };
  }
}

function getRiskLabel(risk: MentalHealthRisk['risk']) {
  switch (risk) {
    case 'low': return 'ต่ำ';
    case 'moderate': return 'ปานกลาง';
    case 'elevated': return 'ค่อนข้างสูง';
    case 'high': return 'สูง';
  }
}

// ============================================================================
// Raw Summary Functions
// ============================================================================

function summarizeWindowStats(windowStats: WindowStatistics[]) {
  if (!windowStats.length) return null;

  const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const auKeys = ['AU01', 'AU02', 'AU04', 'AU06', 'AU07', 'AU10', 'AU12', 'AU14', 'AU15', 'AU17', 'AU23', 'AU24'];

  const actionUnits = Object.fromEntries(
    auKeys.map(key => [
      key,
      {
        mean: mean(windowStats.map(w => w.actionUnits[key]?.mean || 0)),
        std: mean(windowStats.map(w => w.actionUnits[key]?.std || 0)),
      },
    ])
  ) as Record<string, { mean: number; std: number }>;

  const headMovement = mean([
    mean(windowStats.map(w => w.headPose.pitch.range)),
    mean(windowStats.map(w => w.headPose.yaw.range)),
    mean(windowStats.map(w => w.headPose.roll.range)),
  ]);

  const expressionVariability = mean(Object.values(actionUnits).map(v => v.std));

  return {
    windowCount: windowStats.length,
    frameCount: windowStats.reduce((sum, w) => sum + w.frameCount, 0),
    headMovement,
    blinkRate: mean(windowStats.map(w => w.eyeMetrics.blinkRate)),
    avgEAR: mean(windowStats.map(w => w.eyeMetrics.avgEAR.mean)),
    smileProbability: mean(windowStats.map(w => w.smileProbability.mean)),
    expressionVariability,
    actionUnits,
  };
}

// ============================================================================
// Facial Insights Functions
// ============================================================================

function generateFacialInsights(prediction: PHQ9Prediction, checkin?: CheckinResponse): FacialInsight[] {
  const insights: FacialInsight[] = [];

  const indicatorMeta: Record<string, { title: string; icon: string; unit?: string }> = {
    lip_corner_depression: { title: 'มุมปากตก (AU15)', icon: '😔' },
    smile_expression: { title: 'รอยยิ้ม (AU12/AU06)', icon: '😊' },
    head_movement: { title: 'การเคลื่อนไหวศีรษะ', icon: '🧭', unit: '°' },
    brow_expression: { title: 'การยกคิ้ว (AU02)', icon: '🧐' },
    expression_variability: { title: 'ความหลากหลายการแสดงออก', icon: '🎭' },
    blink_rate: { title: 'อัตราการกะพริบตา', icon: '👁️', unit: 'ครั้ง/นาที' },
  };

  const indicatorPriority = (significance: 'low' | 'medium' | 'high') =>
    significance === 'high' ? 0 : significance === 'medium' ? 1 : 2;

  const sortedIndicators = [...prediction.riskIndicators]
    .sort((a, b) => indicatorPriority(a.significance) - indicatorPriority(b.significance))
    .slice(0, 4);

  sortedIndicators.forEach((indicator) => {
    const meta = indicatorMeta[indicator.feature] || { title: indicator.feature, icon: '📌' };
    const valueLabel = Number.isFinite(indicator.value)
      ? indicator.feature === 'blink_rate'
        ? Math.round(indicator.value).toString()
        : indicator.feature === 'head_movement'
          ? indicator.value.toFixed(1)
          : indicator.value.toFixed(2)
      : '-';
    const baselineLabel = Number.isFinite(indicator.baseline)
      ? indicator.feature === 'blink_rate'
        ? Math.round(indicator.baseline).toString()
        : indicator.feature === 'head_movement'
          ? indicator.baseline.toFixed(1)
          : indicator.baseline.toFixed(2)
      : '-';
    const unit = meta.unit ? ` ${meta.unit}` : '';

    insights.push({
      title: meta.title,
      description: `${indicator.description} (ค่า: ${valueLabel}${unit}, ฐาน: ${baselineLabel}${unit})`,
      icon: meta.icon,
      type: indicator.significance === 'high' ? 'attention' : indicator.significance === 'medium' ? 'neutral' : 'positive',
    });
  });

  if (checkin) {
    if (checkin.sleepQuality <= 2) {
      insights.push({
        title: 'คุณภาพการนอนต่ำ',
        description: 'การนอนไม่เพียงพอส่งผลโดยตรงต่อการแสดงออกทางใบหน้าและความสามารถในการจัดการอารมณ์',
        icon: '😴',
        type: 'attention',
      });
    }
    if (checkin.stressLevel >= 4) {
      insights.push({
        title: 'ความเครียดสะสม',
        description: 'ระดับความเครียดที่คุณรายงานสอดคล้องกับสัญญาณทางใบหน้าที่ระบบตรวจพบ',
        icon: '😤',
        type: 'attention',
      });
    }
  }

  if (insights.filter(i => i.type === 'positive').length === 0) {
    insights.push({
      title: 'การมีส่วนร่วมในการประเมิน',
      description: 'การเช็คอินสุขภาวะอารมณ์เป็นประจำช่วยให้คุณเข้าใจตัวเองมากขึ้น',
      icon: '✨',
      type: 'positive',
    });
  }

  return insights.slice(0, 4);
}

// ============================================================================
// Recommendations Functions
// ============================================================================

function generateTimeBasedRecommendations(
  prediction: PHQ9Prediction,
  wellness: WellnessScore,
  timeContext: TimeContext,
  checkin?: CheckinResponse
): { immediate: string[]; today: string[]; thisWeek: string[] } {
  const immediate: string[] = [];
  const today: string[] = [];
  const thisWeek: string[] = [];
  const pushUnique = (list: string[], value?: string) => {
    if (!value) return;
    if (!list.includes(value)) list.push(value);
  };

  // Model-driven recommendations first (reflects actual prediction)
  const modelRecs = prediction.recommendations || [];
  pushUnique(immediate, modelRecs[0]);
  if (prediction.score >= 10) {
    pushUnique(immediate, modelRecs[1]);
  } else {
    pushUnique(today, modelRecs[1]);
  }

  // Time-specific immediate actions
  if (timeContext.period === 'morning') {
    if (wellness.energy < 50) {
      pushUnique(immediate, 'ดื่มน้ำ 1 แก้วและออกไปรับแสงแดดยามเช้า 5 นาที');
    } else {
      pushUnique(immediate, 'เช้านี้พลังงานดี ลองวางแผนทำสิ่งสำคัญที่สุดของวันตอนนี้');
    }
  } else if (timeContext.period === 'afternoon') {
    if (wellness.fatigue > 50) {
      pushUnique(immediate, 'ช่วงบ่ายง่วงเป็นธรรมชาติ ลองเดินเล่น 5 นาทีหรืองีบสั้นๆ');
    }
    pushUnique(immediate, 'ดื่มน้ำและกินของว่างที่มีโปรตีนเพื่อเพิ่มพลังงาน');
  } else if (timeContext.period === 'evening') {
    pushUnique(immediate, 'ช่วงเย็นแล้ว ลองทำกิจกรรมผ่อนคลายที่ชอบสักอย่าง');
    if (wellness.stress > 50) {
      pushUnique(immediate, 'หายใจลึกๆ 3 ครั้ง ปล่อยความเครียดของวันออกไป');
    }
  } else {
    pushUnique(immediate, 'ดึกแล้ว ลดแสงหน้าจอและเตรียมตัวนอน');
    pushUnique(immediate, 'ลองทำ stretching เบาๆ หรือฟังเพลงผ่อนคลายก่อนนอน');
  }

  // Stress-based recommendations
  if (wellness.stress > 60) {
    pushUnique(immediate, 'หายใจลึก 3 ครั้ง - สูดเข้า 4 วินาที กลั้น 4 วินาที ปล่อยออก 6 วินาที');
    pushUnique(today, 'จัดเวลาพัก 15 นาทีทำสิ่งที่ผ่อนคลาย');
  }

  // Today recommendations based on time
  if (timeContext.period === 'morning' || timeContext.period === 'afternoon') {
    if (wellness.energy < 60) {
      pushUnique(today, 'พยายามออกไปเดินกลางแจ้งอย่างน้อย 15 นาทีวันนี้');
    }
    pushUnique(today, 'กำหนดเวลาเลิกงานที่ชัดเจน ไม่ทำงานเลยเวลา');
  } else {
    pushUnique(today, 'คืนนี้นอนให้เร็วกว่าปกติ 30 นาที');
    if (checkin && checkin.sleepQuality <= 3) {
      pushUnique(today, 'ปิดหน้าจอทุกชนิดก่อนนอน 1 ชั่วโมง');
    }
  }

  // This week recommendations
  pushUnique(thisWeek, 'ตั้งเป้าเช็คอินสุขภาวะอารมณ์ทุกวันเพื่อติดตามแนวโน้ม');
  if (wellness.fatigue > 50 || (checkin && checkin.sleepQuality <= 3)) {
    pushUnique(thisWeek, 'ปรับปรุงการนอน: ห้องมืด เย็น นอนเวลาเดิมทุกวัน');
  }
  pushUnique(thisWeek, 'ออกกำลังกายเบาๆ อย่างน้อย 3 ครั้ง ครั้งละ 20 นาที');
  if (wellness.stress > 50) {
    pushUnique(thisWeek, 'ลองฝึก meditation หรือ mindfulness 10 นาที/วัน');
  }

  return {
    immediate: immediate.slice(0, 2),
    today: today.slice(0, 3),
    thisWeek: thisWeek.slice(0, 3),
  };
}

function getNextCheckinSuggestion(risks: MentalHealthRisk[], timestamp: number) {
  const priority = { high: 0, elevated: 1, moderate: 2, low: 3 };
  const highest = [...risks].sort((a, b) => priority[a.risk] - priority[b.risk])[0];
  const hours =
    highest?.risk === 'high' ? 6 :
    highest?.risk === 'elevated' ? 12 :
    highest?.risk === 'moderate' ? 24 :
    48;
  const nextDate = new Date(timestamp + hours * 60 * 60 * 1000);
  const timeLabel = nextDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const dateLabel = nextDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });

  return {
    title: 'นัดหมายเช็คอินครั้งถัดไป',
    description: `แนะนำให้เช็คอินอีกครั้งภายใน ${hours} ชั่วโมง (ประมาณ ${dateLabel} ${timeLabel}) เพื่อดูแนวโน้มของคุณ`,
  };
}

// ============================================================================
// Sub Components
// ============================================================================

function ScoreRing({ score, label, icon, size = 80 }: { score: number; label: string; icon: string; size?: number }) {
  const circumference = 2 * Math.PI * 35;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size} viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="35" fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="35" fill="none"
            stroke="url(#gradient)"
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
      <span className="text-xs text-gray-600 mt-1 text-center">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{score}%</span>
    </div>
  );
}

function RiskCard({ risk, isExpanded, onToggle }: { risk: MentalHealthRisk; isExpanded: boolean; onToggle: () => void }) {
  const colors = getRiskColor(risk.risk);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{risk.icon}</span>
          <div className="text-left">
            <h3 className="font-medium text-gray-800">{risk.thaiName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                ความเสี่ยง{getRiskLabel(risk.risk)}
              </span>
              <span className="text-sm text-gray-500">{risk.percentage}%</span>
            </div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors.bar} transition-all duration-1000`}
                style={{ width: `${risk.percentage}%` }}
              />
            </div>
          </div>

          <p className="mt-3 text-sm text-gray-600">{risk.description}</p>

          {risk.indicators.length > 0 && (
            <div className="mt-3 bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">สัญญาณที่ตรวจพบ:</p>
              <ul className="space-y-1">
                {risk.indicators.map((indicator, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className={colors.text}>•</span>
                    {indicator}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function WellnessResult({
  prediction,
  checkinResponse,
  phq9Response,
  onReset,
  scanTimestamp,
  debugData,
}: Props) {
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);
  const [showAllRisks, setShowAllRisks] = useState(false);
  const [savedToCloud, setSavedToCloud] = useState(false);
  const { isAuthenticated, user } = useAuthStore();

  const currentTimestamp = scanTimestamp || Date.now();
  const scanDate = new Date(currentTimestamp);

  const timeContext = useMemo(() => getTimeContext(currentTimestamp), [currentTimestamp]);

  // Calculate wellness first for use in useEffect
  const wellness = useMemo(
    () => calculateWellnessScore(prediction, checkinResponse),
    [prediction, checkinResponse]
  );

  // Auto-save to cloud when user is logged in
  useEffect(() => {
    const saveToCloud = async () => {
      if (!isAuthenticated || savedToCloud) return;

      try {
        const response = await authClient.fetch('/api/scans', {
          method: 'POST',
          body: JSON.stringify({
            phq9_score: prediction.score,
            severity: prediction.severity,
            confidence: prediction.confidence,
            energy_level: wellness.energy,
            stress_level: wellness.stress,
            fatigue_level: wellness.fatigue,
            risk_indicators: prediction.riskIndicators,
            session_id: debugData?.session.sessionId,
            window_count: debugData?.session.windowStats?.length || 0,
            total_frames: debugData?.session.windowStats?.reduce((sum, w) => sum + w.frameCount, 0) || 0,
          }),
        });

        if (response.ok) {
          setSavedToCloud(true);
          console.log('Scan saved to cloud');
        }
      } catch (error) {
        console.error('Failed to save scan to cloud:', error);
      }
    };

    // Small delay to ensure wellness is calculated
    const timer = setTimeout(saveToCloud, 500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, savedToCloud, prediction, debugData, wellness]);

  const overallConfig = getOverallConfig(wellness.overall);

  const mentalHealthRisks = useMemo(
    () => assessMentalHealthRisks(prediction, wellness, checkinResponse),
    [prediction, wellness, checkinResponse]
  );

  const facialInsights = useMemo(
    () => generateFacialInsights(prediction, checkinResponse),
    [prediction, checkinResponse]
  );

  const recommendations = useMemo(
    () => generateTimeBasedRecommendations(prediction, wellness, timeContext, checkinResponse),
    [prediction, wellness, timeContext, checkinResponse]
  );

  const nextCheckin = useMemo(
    () => getNextCheckinSuggestion(mentalHealthRisks, currentTimestamp),
    [mentalHealthRisks, currentTimestamp]
  );

  const rawSummary = useMemo(
    () => summarizeWindowStats(debugData?.session.windowStats || []),
    [debugData]
  );

  const exportPayload = useMemo(() => {
    const sessionId = debugData?.session.sessionId || `scan_${currentTimestamp}`;
    return {
      exportVersion: 1,
      exportedAt: Date.now(),
      scanTimestamp: currentTimestamp,
      sessionId,
      backend: debugData?.backend || null,
      scanConfig: debugData?.scanConfig || null,
      checkinResponse: checkinResponse || null,
      phq9Response: phq9Response || null,
      model: {
        prediction,
        rawSummary,
        windowStats: debugData?.session.windowStats || [],
        baseline: debugData?.baseline || null,
      },
      program: {
        wellness,
        overall: wellness.overall,
        mentalHealthRisks,
        facialInsights,
        recommendations,
        timeContext,
        nextCheckin,
      },
    };
  }, [
    debugData,
    prediction,
    rawSummary,
    wellness,
    mentalHealthRisks,
    facialInsights,
    recommendations,
    timeContext,
    nextCheckin,
    checkinResponse,
    phq9Response,
    currentTimestamp,
  ]);

  const saveHistory = () => {
    try {
      const key = 'facepsy_scan_history';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const next = Array.isArray(existing) ? [...existing, exportPayload] : [exportPayload];
      localStorage.setItem(key, JSON.stringify(next.slice(-50)));
      alert('บันทึกประวัติเรียบร้อย');
    } catch (error) {
      console.error('Save history failed:', error);
      alert('บันทึกประวัติไม่สำเร็จ');
    }
  };

  const exportJson = () => {
    try {
      const date = new Date(currentTimestamp);
      const fileName = `facepsy-scan-${date.toISOString().replace(/[:.]/g, '-')}.json`;
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export JSON failed:', error);
      alert('ดาวน์โหลดไม่สำเร็จ');
    }
  };

  const exportHistory = () => {
    try {
      const key = 'facepsy_scan_history';
      const history = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(history) || history.length === 0) {
        alert('ยังไม่มีประวัติที่บันทึกไว้');
        return;
      }
      const fileName = `facepsy-history-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export history failed:', error);
      alert('ดาวน์โหลดประวัติไม่สำเร็จ');
    }
  };

  const formatValue = (value: number, digits: number = 2) =>
    Number.isFinite(value) ? value.toFixed(digits) : '-';

  // Sort risks by severity
  const sortedRisks = [...mentalHealthRisks].sort((a, b) => {
    const order = { high: 0, elevated: 1, moderate: 2, low: 3 };
    return order[a.risk] - order[b.risk];
  });

  const displayedRisks = showAllRisks ? sortedRisks : sortedRisks.slice(0, 2);
  const baselineMissing = !debugData?.baseline;
  const backendMode = debugData?.backend?.mode || 'unknown';

  return (
    <div className="max-w-md mx-auto p-4 space-y-5">
      {/* Time Context Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-2xl">
              {timeContext.period === 'morning' ? '🌅' :
               timeContext.period === 'afternoon' ? '☀️' :
               timeContext.period === 'evening' ? '🌆' : '🌙'}
            </span>
          </div>
          <div>
            <p className="text-white/80 text-sm">ผลการวิเคราะห์</p>
            <p className="font-semibold">{timeContext.thaiPeriod}</p>
            <p className="text-xs text-white/70">
              {scanDate.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="mt-3 bg-white/10 rounded-lg p-3">
          <p className="text-sm text-white/90">{timeContext.insight}</p>
        </div>
      </div>

      {(baselineMissing || backendMode !== 'backend') && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <p className="text-xs text-amber-800">
            <strong>คำเตือนความแม่นยำ:</strong>{' '}
            {baselineMissing
              ? 'ยังไม่มีการปรับเทียบ (baseline) ทำให้ผลอาจคลาดเคลื่อนจากค่าจริงของผู้ใช้'
              : 'ระบบกำลังทำงานในโหมดสำรอง (ไม่ใช้ AI Model หลัก) ความแม่นยำอาจลดลง'}
          </p>
        </div>
      )}

      {/* Overall Status */}
      <div className={`${overallConfig.bg} ${overallConfig.border} border rounded-2xl p-5`}>
        <div className="text-center">
          <span className="text-4xl mb-3 block">{overallConfig.icon}</span>
          <h1 className={`text-xl font-semibold ${overallConfig.color}`}>
            {overallConfig.text}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{overallConfig.subtext}</p>
        </div>
      </div>

      {/* 4-Dimension Score Rings */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200">
        <h2 className="text-sm font-medium text-gray-700 mb-4 text-center">ภาพรวมสุขภาวะอารมณ์</h2>
        <div className="grid grid-cols-4 gap-2">
          <ScoreRing score={wellness.energy} label="พลังงาน" icon="⚡" />
          <ScoreRing score={100 - wellness.stress} label="ความผ่อนคลาย" icon="🧘" />
          <ScoreRing score={100 - wellness.fatigue} label="ความสดชื่น" icon="✨" />
          <ScoreRing score={wellness.emotionalBalance} label="ความสมดุล" icon="💜" />
        </div>
      </div>

      {/* Mental Health Risk Assessment - NEW FEATURE */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <span className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center text-sm">🔬</span>
            การประเมินความเสี่ยงสุขภาพจิต
          </h2>
          <span className="text-xs text-gray-400">กดเพื่อดูรายละเอียด</span>
        </div>

        <div className="space-y-3">
          {displayedRisks.map((risk) => (
            <RiskCard
              key={risk.condition}
              risk={risk}
              isExpanded={expandedRisk === risk.condition}
              onToggle={() => setExpandedRisk(
                expandedRisk === risk.condition ? null : risk.condition
              )}
            />
          ))}
        </div>

        {!showAllRisks && sortedRisks.length > 2 && (
          <button
            onClick={() => setShowAllRisks(true)}
            className="w-full mt-3 py-2 text-sm text-violet-600 hover:text-violet-700 font-medium"
          >
            ดูการประเมินทั้งหมด ({sortedRisks.length} รายการ)
          </button>
        )}

        <div className="mt-4 bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-700">
            <strong>หมายเหตุ:</strong> การประเมินนี้ใช้เทคโนโลยีวิเคราะห์ใบหน้าร่วมกับข้อมูลที่คุณให้
            เพื่อประเมินความเสี่ยงเบื้องต้นเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์
          </p>
        </div>
      </div>

      {phq9Response && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <h2 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
            <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-sm">📝</span>
            ผลแบบประเมิน PHQ-9
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">คะแนนรวม</p>
              <p className="text-xl font-semibold text-gray-800">{phq9Response.totalScore}/27</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">ระดับอาการ</p>
              <p className="text-sm font-medium text-gray-800">
                {formatPHQ9Severity(phq9Response.severity)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            แบบประเมินนี้ใช้เพื่อการติดตามอาการเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์
          </p>
        </div>
      )}

      {/* Time-Based Pattern Insight */}
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-5 border border-cyan-100">
        <h3 className="text-sm font-medium text-cyan-800 mb-3 flex items-center gap-2">
          <span>⏰</span> รู้หรือไม่? (ข้อมูลเชิงลึกตามช่วงเวลา)
        </h3>
        <p className="text-sm text-cyan-700 mb-3">{timeContext.typicalPattern}</p>
        <div className="bg-white/60 rounded-lg p-3">
          <p className="text-sm text-cyan-800">
            <strong>💡 คำแนะนำสำหรับช่วงนี้:</strong> {timeContext.recommendation}
          </p>
        </div>
      </div>

      {/* Facial Insights */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200">
        <h2 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center text-sm">📊</span>
          สิ่งที่ระบบวิเคราะห์ได้จากใบหน้า
        </h2>
        <div className="space-y-3">
          {facialInsights.map((insight, index) => (
            <div
              key={index}
              className={`p-3 rounded-xl ${
                insight.type === 'positive'
                  ? 'bg-emerald-50 border border-emerald-100'
                  : insight.type === 'attention'
                  ? 'bg-amber-50 border border-amber-100'
                  : 'bg-gray-50 border border-gray-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{insight.icon}</span>
                <div>
                  <h3 className={`font-medium text-sm ${
                    insight.type === 'positive' ? 'text-emerald-800' :
                    insight.type === 'attention' ? 'text-amber-800' : 'text-gray-800'
                  }`}>
                    {insight.title}
                  </h3>
                  <p className={`text-xs mt-1 ${
                    insight.type === 'positive' ? 'text-emerald-600' :
                    insight.type === 'attention' ? 'text-amber-600' : 'text-gray-600'
                  }`}>
                    {insight.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Raw Model Summary */}
      {rawSummary && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <h2 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-sm">🧪</span>
            ค่าที่โมเดลตรวจจับได้ (สรุป)
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">AU12 (ยิ้ม)</p>
              <p className="font-medium text-gray-800">{formatValue(rawSummary.actionUnits.AU12?.mean || 0)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">AU06 (แก้มยก)</p>
              <p className="font-medium text-gray-800">{formatValue(rawSummary.actionUnits.AU06?.mean || 0)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">AU15 (มุมปากตก)</p>
              <p className="font-medium text-gray-800">{formatValue(rawSummary.actionUnits.AU15?.mean || 0)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">AU02 (คิ้ว)</p>
              <p className="font-medium text-gray-800">{formatValue(rawSummary.actionUnits.AU02?.mean || 0)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Smile Probability</p>
              <p className="font-medium text-gray-800">{formatValue(rawSummary.smileProbability)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Blink Rate</p>
              <p className="font-medium text-gray-800">{Math.round(rawSummary.blinkRate)} ครั้ง/นาที</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Head Movement</p>
              <p className="font-medium text-gray-800">{formatValue(rawSummary.headMovement, 1)}°</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Expression Variability</p>
              <p className="font-medium text-gray-800">{formatValue(rawSummary.expressionVariability)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            ค่านี้เป็นค่าเฉลี่ยของทั้งเซสชัน (หน้าต่าง {rawSummary.windowCount} ชุด / {rawSummary.frameCount} เฟรม)
          </p>
        </div>
      )}

      {/* Time-Based Recommendations */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl p-5 border border-violet-100">
        <h2 className="text-sm font-medium text-violet-800 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-violet-200 rounded-full flex items-center justify-center text-sm">🎯</span>
          แผนดูแลตัวเองที่แนะนำสำหรับ{timeContext.thaiPeriod}
        </h2>

        {/* Immediate */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-medium rounded-full">ทำตอนนี้เลย</span>
          </div>
          <ul className="space-y-2">
            {recommendations.immediate.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 bg-white/60 rounded-lg p-3">
                <span className="w-5 h-5 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs text-rose-600 font-medium">
                  {index + 1}
                </span>
                <span className="text-sm text-gray-700">{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Today */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              {timeContext.period === 'night' ? 'พรุ่งนี้' : 'วันนี้'}
            </span>
          </div>
          <ul className="space-y-2">
            {recommendations.today.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 bg-white/60 rounded-lg p-3">
                <span className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs text-amber-600 font-medium">
                  {index + 1}
                </span>
                <span className="text-sm text-gray-700">{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* This Week */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">สัปดาห์นี้</span>
          </div>
          <ul className="space-y-2">
            {recommendations.thisWeek.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 bg-white/60 rounded-lg p-3">
                <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs text-blue-600 font-medium">
                  {index + 1}
                </span>
                <span className="text-sm text-gray-700">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Next Scan Reminder */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📅</span>
          <div>
            <h3 className="font-medium text-green-800">{nextCheckin.title}</h3>
            <p className="text-sm text-green-600 mt-1">
              {nextCheckin.description}
            </p>
            <p className="text-xs text-green-500 mt-2">
              การเช็คอินต่อเนื่อง 7 วัน จะช่วยให้ระบบวิเคราะห์แนวโน้มของคุณได้แม่นยำขึ้น
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-600 mb-1">ข้อจำกัดความรับผิดชอบ</p>
        <p>
          ผลการวิเคราะห์นี้ใช้เทคโนโลยีการวิเคราะห์การแสดงออกทางใบหน้าร่วมกับข้อมูลที่คุณให้
          เพื่อประเมินความเสี่ยงสุขภาพจิตเบื้องต้น <strong>ไม่ใช่การวินิจฉัยทางการแพทย์</strong>
          หากมีความกังวลหรือพบความเสี่ยงสูง กรุณาปรึกษาจิตแพทย์หรือนักจิตวิทยา
        </p>
        <p className="mt-2">
          <strong>สายด่วนสุขภาพจิต กรมสุขภาพจิต:</strong> 1323 (24 ชั่วโมง)
        </p>
      </div>

      {/* Data Summary */}
      <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
          <span>ความมั่นใจ: {Math.round(prediction.confidence * 100)}%</span>
        </div>
        <span>•</span>
        <span>ข้อมูล {prediction.dataPoints} จุด</span>
        <span>•</span>
        <span>{scanDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={onReset}
          className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-200"
        >
          ตรวจอีกครั้ง
        </button>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={saveHistory}
          className="py-3 border border-gray-200 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all text-sm flex items-center justify-center gap-2"
        >
          <span>📊</span> บันทึกผลลัพธ์
        </button>
        <button
          onClick={exportJson}
          className="py-3 border border-gray-200 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all text-sm flex items-center justify-center gap-2"
        >
          <span>📄</span> ดาวน์โหลด JSON
        </button>
      </div>

      <button
        onClick={exportHistory}
        className="w-full py-3 border border-gray-200 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all text-sm flex items-center justify-center gap-2"
      >
        <span>🗂️</span> ดาวน์โหลดประวัติทั้งหมด (JSON)
      </button>
      </div>

      {/* Cloud Save Status / Login CTA */}
      {isAuthenticated ? (
        savedToCloud ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-medium text-emerald-800">บันทึกผลเรียบร้อย</h3>
              <p className="text-sm text-emerald-600">ผลการตรวจถูกบันทึกในบัญชีของคุณแล้ว</p>
            </div>
            <Link
              href="/dashboard"
              className="ml-auto px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              ดูแดชบอร์ด
            </Link>
          </div>
        ) : null
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💾</span>
            <div className="flex-1">
              <h3 className="font-medium text-blue-800 mb-1">เข้าสู่ระบบเพื่อบันทึกประวัติ</h3>
              <p className="text-sm text-blue-600 mb-3">
                สร้างบัญชีฟรี เพื่อเก็บประวัติการตรวจและติดตามแนวโน้มของคุณ
              </p>
              <div className="flex gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 border border-blue-300 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50"
                >
                  สมัครสมาชิก
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Upgrade CTA */}
      {(!user?.is_pro) && (
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
          <div className="flex items-start gap-3">
            <span className="text-3xl">✨</span>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">ปลดล็อคการวิเคราะห์เชิงลึก</h3>
              <ul className="text-sm text-violet-100 space-y-1 mb-3">
                <li>• ดูแนวโน้มความเสี่ยงย้อนหลัง 90 วัน</li>
                <li>• เปรียบเทียบผลตามช่วงเวลาของวัน</li>
                <li>• รับการแจ้งเตือนเมื่อความเสี่ยงสูงขึ้น</li>
                <li>• แผนดูแลตัวเอง 7 วันที่ปรับตามคุณ</li>
              </ul>
              <Link
                href="/pricing"
                className="block w-full py-2.5 bg-white text-violet-600 font-medium rounded-lg hover:bg-violet-50 transition-all text-center"
              >
                สมัคร Pro - ฿199/เดือน
              </Link>
              <p className="text-xs text-violet-200 text-center mt-2">ยกเลิกได้ทุกเมื่อ</p>
            </div>
          </div>
        </div>
      )}

      {/* Professional Help CTA for high risk */}
      {(mentalHealthRisks.some(r => r.risk === 'high' || r.risk === 'elevated')) && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <h3 className="font-medium text-rose-800 mb-1">ต้องการพูดคุยกับผู้เชี่ยวชาญ?</h3>
              <p className="text-sm text-rose-600 mb-3">
                เราพร้อมเชื่อมต่อคุณกับนักจิตวิทยาที่ได้รับการรับรอง
                พูดคุยแบบส่วนตัวและเป็นความลับ
              </p>
              <button className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-all">
                นัดปรึกษาผู้เชี่ยวชาญ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
