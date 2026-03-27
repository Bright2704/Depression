'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AdminNav from '@/components/admin/AdminNav';
import DashboardStats from '@/components/admin/DashboardStats';
import { authClient } from '@/lib/auth-client';

interface Stats {
  total_users: number;
  active_users: number;
  total_scans: number;
  scans_today: number;
  scans_this_week: number;
  average_phq9: number;
  severity_distribution: Record<string, number>;
  daily_scans: Array<{ date: string; count: number }>;
}

function AdminDashboardContent() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await authClient.fetch('/api/admin/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          setError('ไม่สามารถโหลดข้อมูลได้');
        }
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ด</h1>
          <p className="text-gray-600 mt-1">ภาพรวมระบบ MindCheck</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl">
            {error}
          </div>
        ) : stats ? (
          <DashboardStats stats={stats} />
        ) : null}
      </main>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}
