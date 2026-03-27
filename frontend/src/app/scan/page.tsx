/**
 * Scan Page - Complete Flow
 * Landing → Consent → Quick Check-in → Face Scan → Result
 */

'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import QuickCheckin, { CheckinResponse } from '@/components/QuickCheckin';
import WellnessResult from '@/components/WellnessResult';
import type { PHQ9Prediction } from '@/lib/phq9-predictor';

// Dynamic import to avoid SSR issues with MediaPipe
const FaceScan = dynamic(() => import('@/components/FaceScan'), {
  ssr: false,
  loading: () => (
    <div className="max-w-md mx-auto p-4 text-center">
      <div className="w-16 h-16 mx-auto border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      <p className="mt-4 text-gray-600">กำลังโหลดระบบ...</p>
    </div>
  ),
});

// ============================================================================
// Types
// ============================================================================

type FlowStep = 'checkin' | 'scanning' | 'result';

// ============================================================================
// Main Component
// ============================================================================

export default function ScanPage() {
  const [step, setStep] = useState<FlowStep>('checkin');
  const [checkinResponse, setCheckinResponse] = useState<CheckinResponse | null>(null);
  const [prediction, setPrediction] = useState<PHQ9Prediction | null>(null);
  const [scanTimestamp, setScanTimestamp] = useState<number | null>(null);

  const handleCheckinComplete = (response: CheckinResponse) => {
    setCheckinResponse(response);
    setStep('scanning');
  };

  const handleScanComplete = (pred: PHQ9Prediction) => {
    setPrediction(pred);
    setScanTimestamp(Date.now()); // Record exact scan completion time
    setStep('result');
  };

  const handleReset = () => {
    setStep('checkin');
    setCheckinResponse(null);
    setPrediction(null);
    setScanTimestamp(null);
  };

  const handleSaveHistory = () => {
    // TODO: Implement save to backend/localStorage
    alert('บันทึกประวัติเรียบร้อย');
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation
    alert('ฟีเจอร์นี้จะเปิดให้ใช้งานเร็วๆ นี้');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg"></div>
            <span className="text-xl font-semibold text-gray-800">MindCheck</span>
          </Link>
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            กลับหน้าหลัก
          </Link>
        </div>
      </nav>

      {/* Progress Steps */}
      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="flex items-center justify-center gap-2">
          <div className={`flex items-center gap-2 ${step === 'checkin' ? 'text-violet-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'checkin' ? 'bg-violet-600 text-white' :
              step === 'scanning' || step === 'result' ? 'bg-green-500 text-white' : 'bg-gray-200'
            }`}>
              {step === 'scanning' || step === 'result' ? '✓' : '1'}
            </div>
            <span className="text-sm hidden sm:inline">แบบสอบถาม</span>
          </div>

          <div className="w-8 h-0.5 bg-gray-200">
            <div className={`h-full transition-all ${step === 'scanning' || step === 'result' ? 'bg-violet-600 w-full' : 'w-0'}`} />
          </div>

          <div className={`flex items-center gap-2 ${step === 'scanning' ? 'text-violet-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'scanning' ? 'bg-violet-600 text-white' :
              step === 'result' ? 'bg-green-500 text-white' : 'bg-gray-200'
            }`}>
              {step === 'result' ? '✓' : '2'}
            </div>
            <span className="text-sm hidden sm:inline">สแกนหน้า</span>
          </div>

          <div className="w-8 h-0.5 bg-gray-200">
            <div className={`h-full transition-all ${step === 'result' ? 'bg-violet-600 w-full' : 'w-0'}`} />
          </div>

          <div className={`flex items-center gap-2 ${step === 'result' ? 'text-violet-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'result' ? 'bg-violet-600 text-white' : 'bg-gray-200'
            }`}>
              3
            </div>
            <span className="text-sm hidden sm:inline">ผลลัพธ์</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="py-6">
        {step === 'checkin' && (
          <QuickCheckin
            onComplete={handleCheckinComplete}
            onBack={() => window.history.back()}
          />
        )}

        {step === 'scanning' && (
          <FaceScan
            onComplete={handleScanComplete}
            onError={(error) => {
              console.error('Scan error:', error);
              alert('เกิดข้อผิดพลาด: ' + error.message);
            }}
            showDebugInfo={process.env.NODE_ENV === 'development'}
          />
        )}

        {step === 'result' && prediction && (
          <WellnessResult
            prediction={prediction}
            checkinResponse={checkinResponse || undefined}
            onReset={handleReset}
            onSaveHistory={handleSaveHistory}
            onDownloadPDF={handleDownloadPDF}
            scanTimestamp={scanTimestamp || undefined}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-100 mt-auto">
        <div className="max-w-md mx-auto text-center text-sm text-gray-500">
          <p>
            ผลลัพธ์นี้ไม่ใช่การวินิจฉัยทางการแพทย์
            <br />
            หากคุณมีข้อกังวล กรุณาปรึกษาผู้เชี่ยวชาญ
          </p>
        </div>
      </footer>
    </div>
  );
}
