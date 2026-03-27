'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardStatsProps {
  stats: {
    total_users: number;
    active_users: number;
    total_scans: number;
    scans_today: number;
    scans_this_week: number;
    average_phq9: number;
    severity_distribution: Record<string, number>;
    daily_scans: Array<{ date: string; count: number }>;
  };
}

const SEVERITY_COLORS: Record<string, string> = {
  'Minimal': '#22c55e',
  'Mild': '#eab308',
  'Moderate': '#f97316',
  'Moderately Severe': '#ef4444',
  'Severe': '#991b1b',
};

export default function DashboardStats({ stats }: DashboardStatsProps) {
  const severityData = Object.entries(stats.severity_distribution).map(([name, value]) => ({
    name,
    value,
    color: SEVERITY_COLORS[name] || '#6b7280',
  }));

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="ผู้ใช้ทั้งหมด"
          value={stats.total_users}
          subtitle={`${stats.active_users} active (7d)`}
          icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          color="indigo"
        />
        <StatCard
          title="การตรวจทั้งหมด"
          value={stats.total_scans}
          subtitle={`${stats.scans_today} วันนี้`}
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          color="emerald"
        />
        <StatCard
          title="การตรวจสัปดาห์นี้"
          value={stats.scans_this_week}
          icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          color="blue"
        />
        <StatCard
          title="PHQ-9 เฉลี่ย"
          value={stats.average_phq9.toFixed(1)}
          subtitle={getSeverityLabel(stats.average_phq9)}
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          color="amber"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Scans Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            การตรวจรายวัน (7 วัน)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.daily_scans}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
                stroke="#9ca3af"
              />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                formatter={(value: number) => [value, 'การตรวจ']}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString('th-TH');
                }}
              />
              <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Distribution */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            การกระจายระดับความรุนแรง
          </h3>
          {severityData.length > 0 ? (
            <div className="flex items-center">
              <ResponsiveContainer width="50%" height={250}>
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-1/2 space-y-2">
                {severityData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-600">{item.name}</span>
                    <span className="text-sm font-medium text-gray-900 ml-auto">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-gray-400">
              ยังไม่มีข้อมูล
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color: 'indigo' | 'emerald' | 'blue' | 'amber';
}) {
  const colorClasses = {
    indigo: 'bg-indigo-100 text-indigo-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  );
}

function getSeverityLabel(score: number): string {
  if (score < 5) return 'Minimal';
  if (score < 10) return 'Mild';
  if (score < 15) return 'Moderate';
  if (score < 20) return 'Moderately Severe';
  return 'Severe';
}
