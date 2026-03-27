'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { authClient } from '@/lib/auth-client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import NavBar from '@/components/NavBar';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface DashboardData {
  weekly_trend: Array<{
    date: string;
    score: number;
    severity: string;
  }>;
  average_score: number;
  improvement_percent: number;
  streak_days: number;
  last_check_in: string | null;
  total_scans: number;
  alerts: Array<{
    type: 'warning' | 'info' | 'success';
    message: string;
  }>;
}

interface ScanItem {
  id: string;
  phq9_score: number;
  severity: string;
  confidence: number;
  energy_level: number | null;
  stress_level: number | null;
  fatigue_level: number | null;
  created_at: string;
}

function DashboardContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [recentScans, setRecentScans] = useState<ScanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch dashboard data and recent scans in parallel
        const [dashboardRes, scansRes] = await Promise.all([
          authClient.fetch('/api/scans/dashboard/data'),
          authClient.fetch('/api/scans?page=1&page_size=5'),
        ]);

        if (dashboardRes.ok) {
          const data = await dashboardRes.json();
          setDashboardData(data);
        }

        if (scansRes.ok) {
          const data = await scansRes.json();
          setRecentScans(data.scans || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'minimal':
        return 'text-green-600 bg-green-100';
      case 'mild':
        return 'text-yellow-600 bg-yellow-100';
      case 'moderate':
        return 'text-orange-600 bg-orange-100';
      case 'moderately severe':
      case 'moderately_severe':
        return 'text-red-500 bg-red-100';
      case 'severe':
        return 'text-red-700 bg-red-200';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getAlertStyles = (type: string) => {
    switch (type) {
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar />
        <div className="flex items-center justify-center py-32">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />

      <main className="max-w-6xl mx-auto px-4 pt-24 pb-12">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            สวัสดี, {user?.nickname || user?.email?.split('@')[0]}
          </h1>
          <p className="text-gray-600 mt-1">
            ติดตามความก้าวหน้าและดูแลสุขภาวะจิตของคุณ
          </p>
        </div>

        {/* Subscription Banner */}
        {!user?.is_pro && (
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 text-white mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">อัปเกรดเป็น Pro</h2>
                <p className="text-violet-100 text-sm mt-1">
                  ปลดล็อคการตรวจไม่จำกัด, ประวัติย้อนหลัง 90 วัน และอีกมากมาย
                </p>
              </div>
              <Link
                href="/pricing"
                className="px-6 py-2.5 bg-white text-violet-600 font-medium rounded-lg hover:bg-violet-50 transition-all"
              >
                ดูแผนราคา
              </Link>
            </div>
          </div>
        )}

        {/* Alerts */}
        {dashboardData?.alerts && dashboardData.alerts.length > 0 && (
          <div className="space-y-3 mb-8">
            {dashboardData.alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border ${getAlertStyles(alert.type)}`}
              >
                {alert.message}
              </div>
            ))}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-gray-500 text-sm">คะแนนเฉลี่ย (30 วัน)</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {dashboardData?.average_score.toFixed(1) || '-'}
            </div>
            <div className="text-xs text-gray-400 mt-1">PHQ-9</div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-gray-500 text-sm">การเปลี่ยนแปลง</div>
            <div className={`text-3xl font-bold mt-1 ${
              (dashboardData?.improvement_percent || 0) > 0
                ? 'text-green-600'
                : (dashboardData?.improvement_percent || 0) < 0
                ? 'text-red-600'
                : 'text-gray-900'
            }`}>
              {dashboardData?.improvement_percent
                ? `${dashboardData.improvement_percent > 0 ? '+' : ''}${dashboardData.improvement_percent.toFixed(1)}%`
                : '-'}
            </div>
            <div className="text-xs text-gray-400 mt-1">เทียบสัปดาห์ก่อน</div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-gray-500 text-sm">Streak</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {dashboardData?.streak_days || 0} <span className="text-lg">วัน</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">เช็คอินต่อเนื่อง</div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-gray-500 text-sm">การตรวจทั้งหมด</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {dashboardData?.total_scans || 0}
            </div>
            <div className="text-xs text-gray-400 mt-1">ครั้ง</div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Weekly Trend Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              แนวโน้มคะแนน PHQ-9
            </h2>
            {dashboardData?.weekly_trend && dashboardData.weekly_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dashboardData.weekly_trend}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getDate()}/${date.getMonth() + 1}`;
                    }}
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis domain={[0, 27]} stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    formatter={(value: number) => [value, 'PHQ-9']}
                    labelFormatter={(label) => {
                      const date = new Date(label);
                      return format(date, 'd MMMM yyyy', { locale: th });
                    }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#colorScore)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[280px] text-gray-400">
                <span className="text-4xl mb-3">📊</span>
                <p>ยังไม่มีข้อมูลการตรวจ</p>
                <Link
                  href="/scan"
                  className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"
                >
                  เริ่มตรวจครั้งแรก
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions & Recent */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                ดำเนินการ
              </h2>
              <div className="space-y-3">
                <Link
                  href="/scan"
                  className="flex items-center gap-3 w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all"
                >
                  <span>🔍</span>
                  เริ่มตรวจใหม่
                </Link>

                {user?.is_pro && (
                  <button
                    className="flex items-center gap-3 w-full py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all"
                  >
                    <span>📄</span>
                    ดาวน์โหลดรายงาน PDF
                  </button>
                )}
              </div>

              {/* Last Check-in */}
              {dashboardData?.last_check_in && (
                <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                  เช็คอินล่าสุด: {format(new Date(dashboardData.last_check_in), 'd MMM yyyy HH:mm', { locale: th })}
                </div>
              )}
            </div>

            {/* Recent Scans */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                ประวัติล่าสุด
              </h2>
              {recentScans.length > 0 ? (
                <div className="space-y-3">
                  {recentScans.map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-sm text-gray-500">
                          {format(new Date(scan.created_at), 'd MMM HH:mm', { locale: th })}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getSeverityColor(scan.severity)}`}>
                          {scan.severity}
                        </span>
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        {scan.phq9_score}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-4">
                  ยังไม่มีประวัติการตรวจ
                </p>
              )}

              {recentScans.length > 0 && (
                <Link
                  href="/dashboard/history"
                  className="block mt-4 text-center text-sm text-violet-600 hover:text-violet-700 font-medium"
                >
                  ดูประวัติทั้งหมด
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Wellness Tips */}
        <div className="mt-8 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100">
          <h2 className="text-lg font-semibold text-emerald-800 mb-4 flex items-center gap-2">
            <span>💡</span> เคล็ดลับสุขภาวะวันนี้
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: '🧘', title: 'หายใจลึก', desc: 'ฝึกหายใจลึก 5 นาที เพื่อลดความเครียด' },
              { icon: '🚶', title: 'เดินเล่น', desc: 'เดินกลางแจ้ง 15 นาที รับวิตามิน D' },
              { icon: '😴', title: 'นอนให้พอ', desc: 'ตั้งเป้านอน 7-8 ชั่วโมง' },
            ].map((tip, i) => (
              <div key={i} className="bg-white/60 rounded-xl p-4">
                <span className="text-2xl">{tip.icon}</span>
                <h3 className="font-medium text-emerald-800 mt-2">{tip.title}</h3>
                <p className="text-sm text-emerald-600 mt-1">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
