'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NavBar() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    await authClient.logout();
    router.push('/');
    setShowDropdown(false);
  };

  return (
    <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg"></div>
          <span className="text-xl font-semibold text-gray-800">MindCheck</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link href="#how-it-works" className="text-gray-600 hover:text-gray-800 text-sm hidden md:block">
            วิธีการทำงาน
          </Link>
          <Link href="#privacy" className="text-gray-600 hover:text-gray-800 text-sm hidden md:block">
            ความเป็นส่วนตัว
          </Link>
          <Link href="#pricing" className="text-gray-600 hover:text-gray-800 text-sm hidden md:block">
            ราคา
          </Link>

          {isLoading ? (
            <div className="w-20 h-9 bg-gray-100 rounded-lg animate-pulse" />
          ) : isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user?.nickname?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="text-sm text-gray-700 hidden sm:block">
                  {user?.nickname || user?.email?.split('@')[0]}
                </span>
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20">
                    <Link
                      href="/dashboard"
                      onClick={() => setShowDropdown(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      แดชบอร์ด
                    </Link>
                    <Link
                      href="/scan"
                      onClick={() => setShowDropdown(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      ตรวจเช็คใหม่
                    </Link>
                    {user?.role === 'admin' && (
                      <Link
                        href="/admin"
                        onClick={() => setShowDropdown(false)}
                        className="block px-4 py-2 text-sm text-violet-600 hover:bg-violet-50"
                      >
                        Admin Panel
                      </Link>
                    )}
                    <hr className="my-2 border-gray-100" />
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      ออกจากระบบ
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-gray-700 text-sm font-medium hover:text-gray-900 transition-colors"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/scan"
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all"
              >
                เริ่มตรวจฟรี
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
