'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RegisterForm from '@/components/auth/RegisterForm';
import { useAuthStore } from '@/stores/auth-store';

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-50 to-white">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            MindCheck
          </Link>
          <Link
            href="/scan"
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            ตรวจฟรีโดยไม่ต้องสมัคร
          </Link>
        </div>

        {/* Register Form */}
        <div className="flex items-center justify-center py-8">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
