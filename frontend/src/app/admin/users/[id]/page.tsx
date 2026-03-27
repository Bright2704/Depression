'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AdminNav from '@/components/admin/AdminNav';
import { authClient } from '@/lib/auth-client';

interface ScanHistory {
  id: string;
  phq9_score: number;
  severity: string;
  confidence: number;
  energy_level: number | null;
  stress_level: number | null;
  fatigue_level: number | null;
  created_at: string;
}

interface UserDetail {
  id: string;
  email: string;
  nickname: string | null;
  role: string;
  age_range: string | null;
  goal: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  oauth_provider: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  scan_history: ScanHistory[];
  total_scans: number;
}

function UserDetailContent() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    nickname: '',
    is_active: true,
    role: 'user',
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await authClient.fetch(`/api/admin/users/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setUser(data);
          setEditForm({
            nickname: data.nickname || '',
            is_active: data.is_active,
            role: data.role,
          });
        } else if (response.status === 404) {
          setError('ไม่พบผู้ใช้');
        } else {
          setError('ไม่สามารถโหลดข้อมูลได้');
        }
      } catch {
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  const handleSaveEdit = async () => {
    try {
      const response = await authClient.fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                nickname: editForm.nickname || prev.nickname,
                is_active: editForm.is_active,
                role: editForm.role,
              }
            : null
        );
        setIsEditing(false);
      } else {
        alert('ไม่สามารถบันทึกได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async () => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบผู้ใช้นี้? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
      return;
    }

    try {
      const response = await authClient.fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/admin/users');
      } else {
        alert('ไม่สามารถลบผู้ใช้ได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'minimal':
        return 'bg-green-100 text-green-700';
      case 'mild':
        return 'bg-yellow-100 text-yellow-700';
      case 'moderate':
        return 'bg-orange-100 text-orange-700';
      case 'moderately severe':
        return 'bg-red-100 text-red-700';
      case 'severe':
        return 'bg-red-200 text-red-800';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <main className="ml-64 p-8">
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <main className="ml-64 p-8">
          <div className="bg-red-50 text-red-600 p-4 rounded-xl">
            {error || 'ไม่พบผู้ใช้'}
          </div>
          <Link
            href="/admin/users"
            className="mt-4 inline-block text-indigo-600 hover:text-indigo-700"
          >
            &larr; กลับไปหน้ารายชื่อผู้ใช้
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="ml-64 p-8">
        {/* Back button */}
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          กลับ
        </Link>

        {/* User Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl font-medium">
                {user.nickname?.[0] || user.email[0].toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {user.nickname || user.email.split('@')[0]}
                </h1>
                <p className="text-gray-500">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {user.role === 'admin' && (
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                      Admin
                    </span>
                  )}
                  {user.oauth_provider && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                      {user.oauth_provider}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    บันทึก
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    ยกเลิก
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    แก้ไข
                  </button>
                  {user.role !== 'admin' && (
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      ลบ
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Edit Form */}
          {isEditing && (
            <div className="mt-6 pt-6 border-t grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อเล่น
                </label>
                <input
                  type="text"
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  สถานะ
                </label>
                <select
                  value={editForm.is_active ? 'true' : 'false'}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          )}

          {/* User Info Grid */}
          <div className="mt-6 pt-6 border-t grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">ช่วงอายุ</div>
              <div className="font-medium text-gray-900">{user.age_range || '-'}</div>
            </div>
            <div>
              <div className="text-gray-500">เป้าหมาย</div>
              <div className="font-medium text-gray-900">{user.goal || '-'}</div>
            </div>
            <div>
              <div className="text-gray-500">สร้างบัญชี</div>
              <div className="font-medium text-gray-900">
                {format(new Date(user.created_at), 'd MMM yyyy', { locale: th })}
              </div>
            </div>
            <div>
              <div className="text-gray-500">เข้าสู่ระบบล่าสุด</div>
              <div className="font-medium text-gray-900">
                {user.last_login_at
                  ? format(new Date(user.last_login_at), 'd MMM yyyy HH:mm', { locale: th })
                  : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* PHQ-9 Trend Chart */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            แนวโน้ม PHQ-9 ({user.total_scans} การตรวจ)
          </h2>
          {user.scan_history.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[...user.scan_history].reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="created_at"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                  stroke="#9ca3af"
                />
                <YAxis domain={[0, 27]} stroke="#9ca3af" />
                <Tooltip
                  formatter={(value: number) => [value, 'PHQ-9']}
                  labelFormatter={(label) => {
                    const date = new Date(label);
                    return date.toLocaleDateString('th-TH');
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="phq9_score"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ fill: '#4f46e5', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400">
              ยังไม่มีข้อมูลการตรวจ
            </div>
          )}
        </div>

        {/* Scan History Table */}
        <div className="bg-white rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">ประวัติการตรวจ</h2>
          </div>
          {user.scan_history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">วันที่</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">PHQ-9</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">ระดับ</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Confidence</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">พลังงาน</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">ความเครียด</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">ความล้า</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {user.scan_history.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {format(new Date(scan.created_at), 'd MMM yyyy HH:mm', { locale: th })}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{scan.phq9_score}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(scan.severity)}`}>
                          {scan.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{(scan.confidence * 100).toFixed(1)}%</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{scan.energy_level ?? '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{scan.stress_level ?? '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{scan.fatigue_level ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-gray-400">
              ยังไม่มีประวัติการตรวจ
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function UserDetailPage() {
  return (
    <ProtectedRoute requireAdmin>
      <UserDetailContent />
    </ProtectedRoute>
  );
}
