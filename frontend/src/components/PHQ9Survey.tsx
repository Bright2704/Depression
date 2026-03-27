/**
 * PHQ-9 Survey Component
 * แบบประเมิน PHQ-9 สำหรับติดตามอาการซึมเศร้า (ไม่ใช่การวินิจฉัย)
 */

'use client';

import React, { useMemo, useState } from 'react';

export interface PHQ9Answer {
  item: number;
  score: number; // 0-3
}

export interface PHQ9Response {
  totalScore: number;
  severity: 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe';
  answers: PHQ9Answer[];
  difficulty?: number; // 0-3 (optional)
  timestamp: number;
}

interface Props {
  onComplete: (response: PHQ9Response) => void;
  onBack?: () => void;
}

const QUESTIONS = [
  'เบื่อ หรือไม่สนใจทำอะไร',
  'รู้สึกเศร้า ท้อแท้ หรือสิ้นหวัง',
  'นอนหลับยาก หลับๆ ตื่นๆ หรือหลับมากเกินไป',
  'รู้สึกเหนื่อย หรือไม่มีแรง',
  'เบื่ออาหาร หรือกินมากเกินไป',
  'รู้สึกแย่กับตัวเอง คิดว่าตัวเองล้มเหลว หรือทำให้ตัวเอง/ครอบครัวผิดหวัง',
  'มีปัญหาในการมีสมาธิ เช่น อ่านหนังสือหรือดูทีวี',
  'พูดหรือเคลื่อนไหวช้าจนคนอื่นสังเกตได้ หรือกระสับกระส่ายมากกว่าปกติ',
  'คิดว่าถ้าตายไปคงจะดีกว่า หรือคิดอยากทำร้ายตัวเอง',
];

const OPTIONS = [
  { value: 0, label: 'ไม่เลย' },
  { value: 1, label: 'บางวัน' },
  { value: 2, label: 'บ่อยกว่าครึ่ง' },
  { value: 3, label: 'เกือบทุกวัน' },
];

const DIFFICULTY_OPTIONS = [
  { value: 0, label: 'ไม่ยากเลย' },
  { value: 1, label: 'ยากบ้าง' },
  { value: 2, label: 'ยากมาก' },
  { value: 3, label: 'ยากที่สุด' },
];

function getSeverity(score: number): PHQ9Response['severity'] {
  if (score <= 4) return 'minimal';
  if (score <= 9) return 'mild';
  if (score <= 14) return 'moderate';
  if (score <= 19) return 'moderately_severe';
  return 'severe';
}

function getSeverityLabel(severity: PHQ9Response['severity']) {
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

function getSeverityColor(severity: PHQ9Response['severity']) {
  switch (severity) {
    case 'minimal':
      return 'text-emerald-600';
    case 'mild':
      return 'text-blue-600';
    case 'moderate':
      return 'text-amber-600';
    case 'moderately_severe':
      return 'text-orange-600';
    case 'severe':
      return 'text-rose-600';
    default:
      return 'text-gray-600';
  }
}

export default function PHQ9Survey({ onComplete, onBack }: Props) {
  const [answers, setAnswers] = useState<number[]>(Array(QUESTIONS.length).fill(-1));
  const [difficulty, setDifficulty] = useState<number | null>(null);

  const totalScore = useMemo(
    () => answers.reduce((sum, v) => (v >= 0 ? sum + v : sum), 0),
    [answers]
  );
  const allAnswered = answers.every(v => v >= 0);
  const severity = getSeverity(totalScore);
  const hasSelfHarmThought = answers[8] > 0;

  const handleSelect = (idx: number, value: number) => {
    setAnswers(prev => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleSubmit = () => {
    if (!allAnswered) return;
    const response: PHQ9Response = {
      totalScore,
      severity,
      answers: answers.map((score, i) => ({ item: i + 1, score })),
      difficulty: typeof difficulty === 'number' ? difficulty : undefined,
      timestamp: Date.now(),
    };
    onComplete(response);
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-5">
      <div className="bg-white rounded-2xl p-5 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">แบบประเมิน PHQ-9</h2>
        <p className="text-sm text-gray-600 mt-2">
          ในช่วง 2 สัปดาห์ที่ผ่านมา คุณมีอาการต่อไปนี้บ่อยแค่ไหน?
        </p>
      </div>

      {QUESTIONS.map((q, idx) => (
        <div key={idx} className="bg-white rounded-2xl p-4 border border-gray-200">
          <p className="text-sm font-medium text-gray-800">
            {idx + 1}. {q}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSelect(idx, opt.value)}
                className={`px-3 py-2 rounded-lg text-xs border transition-all ${
                  answers[idx] === opt.value
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-gray-200 text-gray-600 hover:border-violet-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-white rounded-2xl p-4 border border-gray-200">
        <p className="text-sm font-medium text-gray-800">
          ถ้าคุณมีปัญหาข้างต้น ส่งผลให้การทำงานหรือการใช้ชีวิตยากแค่ไหน?
        </p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {DIFFICULTY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDifficulty(opt.value)}
              className={`px-3 py-2 rounded-lg text-xs border transition-all ${
                difficulty === opt.value
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-gray-200 text-gray-600 hover:border-violet-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">คะแนนรวม</span>
          <span className={`text-lg font-semibold ${getSeverityColor(severity)}`}>
            {totalScore}/27
          </span>
        </div>
        <div className="mt-1 text-sm text-gray-600">
          ระดับอาการ: <span className={`font-medium ${getSeverityColor(severity)}`}>{getSeverityLabel(severity)}</span>
        </div>
      </div>

      {hasSelfHarmThought && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
          <p className="text-sm text-rose-700">
            หากคุณกำลังมีความคิดทำร้ายตัวเองหรือรู้สึกไม่ปลอดภัย โปรดติดต่อสายด่วนสุขภาพจิต 1323 (24 ชม.)
            หรือปรึกษาผู้เชี่ยวชาญทันที
          </p>
        </div>
      )}

      <div className="bg-blue-50 rounded-2xl p-3">
        <p className="text-xs text-blue-700">
          แบบประเมินนี้ใช้เพื่อการติดตามอาการเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์
        </p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allAnswered}
        className={`w-full py-4 rounded-xl font-medium transition-all ${
          allAnswered
            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }`}
      >
        ดูผลลัพธ์
      </button>

      {onBack && (
        <button
          onClick={onBack}
          className="w-full py-3 text-gray-600 text-sm hover:text-gray-800 transition-colors"
        >
          ย้อนกลับ
        </button>
      )}
    </div>
  );
}
