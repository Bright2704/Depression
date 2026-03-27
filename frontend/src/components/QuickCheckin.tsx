/**
 * Quick Check-in Component
 * แบบสอบถามสั้น 3-5 ข้อ ก่อนสแกนหน้า
 * ตาม claude.md - Step 2 และ Step 4
 */

'use client';

import React, { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface CheckinResponse {
  reason: string;
  sleepQuality: number;     // 1-5
  energyLevel: number;      // 1-5
  stressLevel: number;      // 1-5
  moodToday: string;
}

interface Props {
  onComplete: (response: CheckinResponse) => void;
  onBack: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const REASONS = [
  { id: 'stressed', label: 'รู้สึกเครียด', icon: '😰' },
  { id: 'sleep', label: 'นอนไม่ค่อยหลับ', icon: '😴' },
  { id: 'tired', label: 'อ่อนล้า / หมดไฟ', icon: '🔋' },
  { id: 'curious', label: 'อยากเช็กตัวเองเฉยๆ', icon: '🤔' },
  { id: 'hr', label: 'ดูแลพนักงาน / ทีมงาน', icon: '👥' },
];

const MOODS = [
  { id: 'great', label: 'ดีมาก', emoji: '😄' },
  { id: 'good', label: 'ดี', emoji: '🙂' },
  { id: 'okay', label: 'เฉยๆ', emoji: '😐' },
  { id: 'notgood', label: 'ไม่ค่อยดี', emoji: '😔' },
  { id: 'bad', label: 'แย่', emoji: '😢' },
];

// ============================================================================
// Main Component
// ============================================================================

export default function QuickCheckin({ onComplete, onBack }: Props) {
  const [step, setStep] = useState(1);
  const [response, setResponse] = useState<Partial<CheckinResponse>>({
    reason: '',
    sleepQuality: 3,
    energyLevel: 3,
    stressLevel: 3,
    moodToday: '',
  });

  const handleReasonSelect = (reason: string) => {
    setResponse(prev => ({ ...prev, reason }));
    setStep(2);
  };

  const handleMoodSelect = (mood: string) => {
    setResponse(prev => ({ ...prev, moodToday: mood }));
    setStep(3);
  };

  const handleSliderChange = (field: keyof CheckinResponse, value: number) => {
    setResponse(prev => ({ ...prev, [field]: value }));
  };

  const handleComplete = () => {
    onComplete(response as CheckinResponse);
  };

  // =========================================================================
  // Step 1: เลือกเหตุผล
  // =========================================================================
  const renderReasonStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800">วันนี้คุณเข้ามาเพราะอะไร?</h2>
        <p className="text-gray-600 text-sm mt-2">เลือก 1 ข้อที่ตรงกับคุณมากที่สุด</p>
      </div>

      <div className="space-y-3">
        {REASONS.map((reason) => (
          <button
            key={reason.id}
            onClick={() => handleReasonSelect(reason.id)}
            className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-violet-300 hover:bg-violet-50 transition-all"
          >
            <span className="text-2xl">{reason.icon}</span>
            <span className="text-gray-800 font-medium">{reason.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onBack}
        className="w-full py-3 text-gray-600 text-sm hover:text-gray-800 transition-colors"
      >
        ย้อนกลับ
      </button>
    </div>
  );

  // =========================================================================
  // Step 2: อารมณ์วันนี้
  // =========================================================================
  const renderMoodStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800">วันนี้รู้สึกอย่างไรบ้าง?</h2>
        <p className="text-gray-600 text-sm mt-2">เลือกอารมณ์ที่ใกล้เคียงที่สุด</p>
      </div>

      <div className="flex justify-center gap-4">
        {MOODS.map((mood) => (
          <button
            key={mood.id}
            onClick={() => handleMoodSelect(mood.id)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
              response.moodToday === mood.id
                ? 'bg-violet-100 border-2 border-violet-500'
                : 'bg-white border border-gray-200 hover:border-violet-300'
            }`}
          >
            <span className="text-3xl">{mood.emoji}</span>
            <span className="text-xs text-gray-600">{mood.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setStep(1)}
        className="w-full py-3 text-gray-600 text-sm hover:text-gray-800 transition-colors"
      >
        ย้อนกลับ
      </button>
    </div>
  );

  // =========================================================================
  // Step 3: ระดับต่างๆ
  // =========================================================================
  const renderLevelsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800">บอกเราเพิ่มอีกนิด</h2>
        <p className="text-gray-600 text-sm mt-2">ข้อมูลนี้ช่วยให้ผลแม่นยำขึ้น</p>
      </div>

      <div className="space-y-6">
        {/* Sleep Quality */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-800 font-medium">คุณภาพการนอนเมื่อคืน</span>
            <span className="text-sm text-violet-600 font-medium">
              {['แย่มาก', 'ไม่ค่อยดี', 'พอใช้', 'ดี', 'ดีมาก'][response.sleepQuality! - 1]}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            value={response.sleepQuality}
            onChange={(e) => handleSliderChange('sleepQuality', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>แย่มาก</span>
            <span>ดีมาก</span>
          </div>
        </div>

        {/* Energy Level */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-800 font-medium">ระดับพลังงานตอนนี้</span>
            <span className="text-sm text-violet-600 font-medium">
              {['ต่ำมาก', 'ค่อนข้างต่ำ', 'ปานกลาง', 'ค่อนข้างสูง', 'สูงมาก'][response.energyLevel! - 1]}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            value={response.energyLevel}
            onChange={(e) => handleSliderChange('energyLevel', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>ต่ำมาก</span>
            <span>สูงมาก</span>
          </div>
        </div>

        {/* Stress Level */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-800 font-medium">ระดับความเครียด</span>
            <span className="text-sm text-violet-600 font-medium">
              {['ไม่เครียดเลย', 'เล็กน้อย', 'ปานกลาง', 'ค่อนข้างมาก', 'มากที่สุด'][response.stressLevel! - 1]}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            value={response.stressLevel}
            onChange={(e) => handleSliderChange('stressLevel', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>ไม่เครียด</span>
            <span>เครียดมาก</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleComplete}
        className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-200"
      >
        ถัดไป: สแกนใบหน้า
      </button>

      <button
        onClick={() => setStep(2)}
        className="w-full py-3 text-gray-600 text-sm hover:text-gray-800 transition-colors"
      >
        ย้อนกลับ
      </button>
    </div>
  );

  // =========================================================================
  // Progress Indicator
  // =========================================================================
  const renderProgress = () => (
    <div className="flex justify-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={`w-2 h-2 rounded-full transition-all ${
            s === step ? 'w-6 bg-violet-600' : s < step ? 'bg-violet-400' : 'bg-gray-300'
          }`}
        />
      ))}
    </div>
  );

  // =========================================================================
  // Main Render
  // =========================================================================
  return (
    <div className="max-w-md mx-auto p-4">
      {renderProgress()}
      {step === 1 && renderReasonStep()}
      {step === 2 && renderMoodStep()}
      {step === 3 && renderLevelsStep()}
    </div>
  );
}
