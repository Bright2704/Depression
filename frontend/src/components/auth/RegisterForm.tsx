'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import OAuthButtons from './OAuthButtons';

const AGE_RANGES = [
  { value: '18-24', label: '18-24 ปี' },
  { value: '25-34', label: '25-34 ปี' },
  { value: '35-44', label: '35-44 ปี' },
  { value: '45-54', label: '45-54 ปี' },
  { value: '55+', label: '55 ปีขึ้นไป' },
];

const GOALS = [
  { value: 'stress', label: 'จัดการความเครียด' },
  { value: 'sleep', label: 'ปรับปรุงการนอน' },
  { value: 'energy', label: 'เพิ่มพลังงาน' },
  { value: 'mood', label: 'ติดตามอารมณ์' },
  { value: 'general', label: 'ดูแลสุขภาพจิตทั่วไป' },
];

export default function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    age_range: '',
    goal: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setStep(2);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await authClient.register({
      email: formData.email,
      password: formData.password,
      nickname: formData.nickname || undefined,
      age_range: formData.age_range || undefined,
      goal: formData.goal || undefined,
    });

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.message || 'สมัครสมาชิกไม่สำเร็จ');
    }

    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">สมัครสมาชิก</h1>
          <p className="text-gray-600 mt-2">
            {step === 1 ? 'สร้างบัญชีใหม่' : 'บอกเราเกี่ยวกับตัวคุณ'}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          <div className={`w-12 h-1 ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                อีเมล
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => updateFormData('email', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                รหัสผ่าน
              </label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => updateFormData('password', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                ยืนยันรหัสผ่าน
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 transition-all"
            >
              ถัดไป
            </button>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">หรือ</span>
                </div>
              </div>

              <div className="mt-6">
                <OAuthButtons />
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleFinalSubmit} className="space-y-5">
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อเล่น (ไม่บังคับ)
              </label>
              <input
                type="text"
                id="nickname"
                value={formData.nickname}
                onChange={(e) => updateFormData('nickname', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                placeholder="เราจะเรียกคุณว่าอะไร?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ช่วงอายุ
              </label>
              <div className="grid grid-cols-3 gap-2">
                {AGE_RANGES.map((range) => (
                  <button
                    key={range.value}
                    type="button"
                    onClick={() => updateFormData('age_range', range.value)}
                    className={`py-2 px-3 text-sm rounded-lg border transition-colors ${
                      formData.age_range === range.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เป้าหมายหลักของคุณ
              </label>
              <div className="space-y-2">
                {GOALS.map((goal) => (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() => updateFormData('goal', goal.value)}
                    className={`w-full py-3 px-4 text-left rounded-xl border transition-colors ${
                      formData.goal === goal.value
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-200'
                    }`}
                  >
                    {goal.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all"
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 px-4 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
              </button>
            </div>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-gray-600">
          มีบัญชีอยู่แล้ว?{' '}
          <Link href="/login" className="text-indigo-600 font-medium hover:text-indigo-700">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
