/**
 * Scan Page - Complete Flow
 * Landing → Consent → Quick Check-in → Face Scan → Result
 */

'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import QuickCheckin, { CheckinResponse } from '@/components/QuickCheckin';
import PHQ9Survey, { PHQ9Response } from '@/components/PHQ9Survey';
import WellnessResult from '@/components/WellnessResult';
import type { PHQ9Prediction } from '@/lib/phq9-predictor';
import type { ScanDebugData } from '@/components/FaceScan';

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

type FlowStep = 'checkin' | 'scanning' | 'phq9' | 'result';
type ScanCompleteEventDetail = {
  prediction: PHQ9Prediction;
  debug?: ScanDebugData;
  timestamp: number;
};

// ============================================================================
// Main Component
// ============================================================================

export default function ScanPage() {
  const [step, setStep] = useState<FlowStep>('checkin');
  const [checkinResponse, setCheckinResponse] = useState<CheckinResponse | null>(null);
  const [phq9Response, setPhq9Response] = useState<PHQ9Response | null>(null);
  const [prediction, setPrediction] = useState<PHQ9Prediction | null>(null);
  const [scanTimestamp, setScanTimestamp] = useState<number | null>(null);
  const [scanDebugData, setScanDebugData] = useState<ScanDebugData | null>(null);
  const scanCompletedRef = useRef(false);
  const handleScanCompleteRef = useRef<(pred: PHQ9Prediction, debug?: ScanDebugData) => void>(() => {});

  const handleCheckinComplete = (response: CheckinResponse) => {
    setCheckinResponse(response);
    setStep('scanning');
  };

  const handleScanComplete = (pred: PHQ9Prediction, debug?: ScanDebugData) => {
    if (scanCompletedRef.current) return;
    scanCompletedRef.current = true;
    setPrediction(pred);
    setScanTimestamp(Date.now()); // Record exact scan completion time
    setScanDebugData(debug || null);
    setStep('phq9');
  };

  useEffect(() => {
    handleScanCompleteRef.current = handleScanComplete;
  });

  useEffect(() => {
    if (step === 'scanning') {
      scanCompletedRef.current = false;
    }
  }, [step]);

  // Fallback: listen to scan-complete event if onComplete missed
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: Event) => {
      if (step !== 'scanning' || scanCompletedRef.current) return;
      const detail = (event as CustomEvent<ScanCompleteEventDetail>).detail;
      if (!detail?.prediction) return;
      handleScanCompleteRef.current(detail.prediction, detail.debug);
    };

    window.addEventListener('facepsy:scan-complete', handler as EventListener);
    return () => {
      window.removeEventListener('facepsy:scan-complete', handler as EventListener);
    };
  }, [step]);

  // Fallback: poll localStorage for last prediction (safety net)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (step !== 'scanning') return;

    const checkStorage = () => {
      try {
        const raw = localStorage.getItem('facepsy_last_prediction');
        if (!raw) return;
        const parsed = JSON.parse(raw) as ScanCompleteEventDetail;
        if (!parsed?.prediction) return;

        // Use recent prediction only (within 5 minutes)
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          localStorage.removeItem('facepsy_last_prediction');
          handleScanCompleteRef.current(parsed.prediction, parsed.debug);
        }
      } catch {
        // Ignore parsing/storage errors
      }
    };

    checkStorage();
    const intervalId = window.setInterval(checkStorage, 1000);
    return () => window.clearInterval(intervalId);
  }, [step]);

  // Restore last prediction after full reload (safety net)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('facepsy_last_prediction');
      if (!raw) return;
      const parsed = JSON.parse(raw) as ScanCompleteEventDetail;
      if (!parsed?.prediction) return;
      if (Date.now() - parsed.timestamp > 10 * 60 * 1000) return;
      handleScanCompleteRef.current(parsed.prediction, parsed.debug);
    } catch {
      // Ignore parsing/storage errors
    }
  }, []);

  const handlePHQ9Complete = (response: PHQ9Response) => {
    setPhq9Response(response);
    setStep('result');
  };

  const handleReset = () => {
    setStep('checkin');
    setCheckinResponse(null);
    setPhq9Response(null);
    setPrediction(null);
    setScanTimestamp(null);
    setScanDebugData(null);
    scanCompletedRef.current = false;
  };

  const steps = [
    { key: 'checkin', label: 'แบบสอบถาม' },
    { key: 'scanning', label: 'สแกนหน้า' },
    { key: 'phq9', label: 'PHQ-9' },
    { key: 'result', label: 'ผลลัพธ์' },
  ] as const;
  const currentStepIndex = steps.findIndex(s => s.key === step);

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
          {steps.map((s, idx) => (
            <Fragment key={s.key}>
              <div className={`flex items-center gap-2 ${idx === currentStepIndex ? 'text-violet-600' : idx < currentStepIndex ? 'text-violet-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  idx < currentStepIndex
                    ? 'bg-green-500 text-white'
                    : idx === currentStepIndex
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-200'
                }`}>
                  {idx < currentStepIndex ? '✓' : idx + 1}
                </div>
                <span className="text-sm hidden sm:inline">{s.label}</span>
              </div>

              {idx < steps.length - 1 && (
                <div className="w-8 h-0.5 bg-gray-200">
                  <div className={`h-full transition-all ${idx < currentStepIndex ? 'bg-violet-600 w-full' : 'w-0'}`} />
                </div>
              )}
            </Fragment>
          ))}
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
          />
        )}

        {step === 'phq9' && (
          <PHQ9Survey
            onComplete={handlePHQ9Complete}
            onBack={() => setStep('scanning')}
          />
        )}

        {step === 'result' && prediction && (
          <WellnessResult
            prediction={prediction}
            checkinResponse={checkinResponse || undefined}
            phq9Response={phq9Response || undefined}
            onReset={handleReset}
            scanTimestamp={scanTimestamp || undefined}
            debugData={scanDebugData || undefined}
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
