/**
 * Wellness Result Component
 * แสดงผลลัพธ์เชิงลึกที่ทำให้ User รู้สึกได้รับการดูแล
 * - การตรวจจับความเสี่ยงโรคต่างๆ
 * - ข้อมูลเชิงลึกจากการวิเคราะห์ใบหน้า
 * - คำแนะนำที่ปรับตามช่วงเวลาที่สแกน
 * - แผนดูแลตัวเองที่ทำได้จริง
 */

'use client';

import React, { useState, useMemo } from 'react';
import type { PHQ9Prediction } from '@/lib/phq9-predictor';
import type { CheckinResponse } from './QuickCheckin';

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

interface Props {
  prediction: PHQ9Prediction;
  checkinResponse?: CheckinResponse;
  onReset: () => void;
  onSaveHistory?: () => void;
  onDownloadPDF?: () => void;
  scanTimestamp?: number;
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
// Facial Insights Functions
// ============================================================================

function generateFacialInsights(prediction: PHQ9Prediction, checkin?: CheckinResponse): FacialInsight[] {
  const insights: FacialInsight[] = [];

  if (prediction.score < 5) {
    insights.push({
      title: 'การแสดงออกทางใบหน้าเป็นธรรมชาติ',
      description: 'ระบบตรวจพบการเคลื่อนไหวของกล้ามเนื้อใบหน้าที่สมดุลและเป็นธรรมชาติ',
      icon: '😊',
      type: 'positive',
    });
  }

  if (prediction.riskIndicators.some(r => r.feature.includes('smile'))) {
    insights.push({
      title: 'ความเข้มของรอยยิ้มลดลง',
      description: 'กล้ามเนื้อบริเวณมุมปากและรอบดวงตา (AU6, AU12) มีการเคลื่อนไหวน้อยกว่าค่าปกติ',
      icon: '🔍',
      type: 'attention',
    });
  }

  if (prediction.riskIndicators.some(r => r.feature.includes('head') || r.feature.includes('movement'))) {
    insights.push({
      title: 'การเคลื่อนไหวศีรษะลดลง',
      description: 'ตรวจพบการเคลื่อนไหวศีรษะน้อยกว่าค่ามาตรฐาน ซึ่งอาจเกี่ยวข้องกับความล้าสะสม',
      icon: '📊',
      type: 'attention',
    });
  }

  if (prediction.riskIndicators.some(r => r.feature.includes('blink') || r.feature.includes('eye'))) {
    insights.push({
      title: 'รูปแบบการกะพริบตาผิดปกติ',
      description: 'อัตราการกะพริบตามีความแตกต่างจากค่าเฉลี่ย อาจเกี่ยวข้องกับความเหนื่อยล้าหรือความเครียด',
      icon: '👁️',
      type: 'neutral',
    });
  }

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
  wellness: WellnessScore,
  timeContext: TimeContext,
  checkin?: CheckinResponse
): { immediate: string[]; today: string[]; thisWeek: string[] } {
  const immediate: string[] = [];
  const today: string[] = [];
  const thisWeek: string[] = [];

  // Time-specific immediate actions
  if (timeContext.period === 'morning') {
    if (wellness.energy < 50) {
      immediate.push('ดื่มน้ำ 1 แก้วและออกไปรับแสงแดดยามเช้า 5 นาที');
    } else {
      immediate.push('เช้านี้พลังงานดี ลองวางแผนทำสิ่งสำคัญที่สุดของวันตอนนี้');
    }
  } else if (timeContext.period === 'afternoon') {
    if (wellness.fatigue > 50) {
      immediate.push('ช่วงบ่ายง่วงเป็นธรรมชาติ ลองเดินเล่น 5 นาทีหรืองีบสั้นๆ');
    }
    immediate.push('ดื่มน้ำและกินของว่างที่มีโปรตีนเพื่อเพิ่มพลังงาน');
  } else if (timeContext.period === 'evening') {
    immediate.push('ช่วงเย็นแล้ว ลองทำกิจกรรมผ่อนคลายที่ชอบสักอย่าง');
    if (wellness.stress > 50) {
      immediate.push('หายใจลึกๆ 3 ครั้ง ปล่อยความเครียดของวันออกไป');
    }
  } else {
    immediate.push('ดึกแล้ว ลดแสงหน้าจอและเตรียมตัวนอน');
    immediate.push('ลองทำ stretching เบาๆ หรือฟังเพลงผ่อนคลายก่อนนอน');
  }

  // Stress-based recommendations
  if (wellness.stress > 60) {
    immediate.push('หายใจลึก 3 ครั้ง - สูดเข้า 4 วินาที กลั้น 4 วินาที ปล่อยออก 6 วินาที');
    today.push('จัดเวลาพัก 15 นาทีทำสิ่งที่ผ่อนคลาย');
  }

  // Today recommendations based on time
  if (timeContext.period === 'morning' || timeContext.period === 'afternoon') {
    if (wellness.energy < 60) {
      today.push('พยายามออกไปเดินกลางแจ้งอย่างน้อย 15 นาทีวันนี้');
    }
    today.push('กำหนดเวลาเลิกงานที่ชัดเจน ไม่ทำงานเลยเวลา');
  } else {
    today.push('คืนนี้นอนให้เร็วกว่าปกติ 30 นาที');
    if (checkin && checkin.sleepQuality <= 3) {
      today.push('ปิดหน้าจอทุกชนิดก่อนนอน 1 ชั่วโมง');
    }
  }

  // This week recommendations
  thisWeek.push('ตั้งเป้าเช็คอินสุขภาวะอารมณ์ทุกวันเพื่อติดตามแนวโน้ม');
  if (wellness.fatigue > 50 || (checkin && checkin.sleepQuality <= 3)) {
    thisWeek.push('ปรับปรุงการนอน: ห้องมืด เย็น นอนเวลาเดิมทุกวัน');
  }
  thisWeek.push('ออกกำลังกายเบาๆ อย่างน้อย 3 ครั้ง ครั้งละ 20 นาที');
  if (wellness.stress > 50) {
    thisWeek.push('ลองฝึก meditation หรือ mindfulness 10 นาที/วัน');
  }

  return {
    immediate: immediate.slice(0, 2),
    today: today.slice(0, 3),
    thisWeek: thisWeek.slice(0, 3),
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
  onReset,
  onSaveHistory,
  onDownloadPDF,
  scanTimestamp,
}: Props) {
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);
  const [showAllRisks, setShowAllRisks] = useState(false);

  const currentTimestamp = scanTimestamp || Date.now();
  const scanDate = new Date(currentTimestamp);

  const timeContext = useMemo(() => getTimeContext(currentTimestamp), [currentTimestamp]);

  const wellness = useMemo(
    () => calculateWellnessScore(prediction, checkinResponse),
    [prediction, checkinResponse]
  );

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
    () => generateTimeBasedRecommendations(wellness, timeContext, checkinResponse),
    [wellness, timeContext, checkinResponse]
  );

  // Sort risks by severity
  const sortedRisks = [...mentalHealthRisks].sort((a, b) => {
    const order = { high: 0, elevated: 1, moderate: 2, low: 3 };
    return order[a.risk] - order[b.risk];
  });

  const displayedRisks = showAllRisks ? sortedRisks : sortedRisks.slice(0, 2);

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
            <h3 className="font-medium text-green-800">นัดหมายเช็คอินครั้งถัดไป</h3>
            <p className="text-sm text-green-600 mt-1">
              {timeContext.period === 'morning'
                ? 'แนะนำให้เช็คอินอีกครั้งตอนเย็น เพื่อเปรียบเทียบอารมณ์ช่วงเช้าและเย็น'
                : timeContext.period === 'afternoon'
                ? 'แนะนำให้เช็คอินอีกครั้งพรุ่งนี้เช้า เพื่อดูว่านอนหลับดีขึ้นไหม'
                : 'แนะนำให้เช็คอินพรุ่งนี้เช้า เพื่อเริ่มต้นวันใหม่ด้วยการเข้าใจตัวเอง'}
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
            onClick={onSaveHistory}
            className="py-3 border border-gray-200 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all text-sm flex items-center justify-center gap-2"
          >
            <span>📊</span> บันทึกประวัติ
          </button>
          <button
            onClick={onDownloadPDF}
            className="py-3 border border-gray-200 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all text-sm flex items-center justify-center gap-2"
          >
            <span>📄</span> ดาวน์โหลด PDF
          </button>
        </div>
      </div>

      {/* Premium Upgrade CTA */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex items-start gap-3">
          <span className="text-3xl">✨</span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">ปลดล็อคการวิเคราะห์เชิงลึก</h3>
            <ul className="text-sm text-violet-100 space-y-1 mb-3">
              <li>• ดูแนวโน้มความเสี่ยงย้อนหลัง 30 วัน</li>
              <li>• เปรียบเทียบผลตามช่วงเวลาของวัน</li>
              <li>• รับการแจ้งเตือนเมื่อความเสี่ยงสูงขึ้น</li>
              <li>• แผนดูแลตัวเอง 7 วันที่ปรับตามคุณ</li>
            </ul>
            <button className="w-full py-2.5 bg-white text-violet-600 font-medium rounded-lg hover:bg-violet-50 transition-all">
              เริ่มต้น Pro - ฿199/เดือน
            </button>
            <p className="text-xs text-violet-200 text-center mt-2">ทดลองฟรี 7 วัน • ยกเลิกได้ทุกเมื่อ</p>
          </div>
        </div>
      </div>

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
