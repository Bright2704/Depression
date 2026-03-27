'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { authClient } from '@/lib/auth-client';

const navItems = [
  { href: '/admin', label: 'แดชบอร์ด', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/admin/users', label: 'ผู้ใช้งาน', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();

  const handleLogout = async () => {
    await authClient.logout();
    router.push('/');
  };

  return (
    <nav className="bg-slate-900 text-white w-64 min-h-screen fixed left-0 top-0">
      <div className="p-6">
        <Link href="/admin" className="text-xl font-bold">
          MindCheck Admin
        </Link>
      </div>

      <div className="px-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={item.icon}
                    />
                  </svg>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
            {user?.nickname?.[0] || user?.email?.[0] || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {user?.nickname || 'Admin'}
            </div>
            <div className="text-xs text-slate-400 truncate">
              {user?.email}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full mt-2 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-left"
        >
          ออกจากระบบ
        </button>
      </div>
    </nav>
  );
}
