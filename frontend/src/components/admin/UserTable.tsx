'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface User {
  id: string;
  email: string;
  nickname: string | null;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  oauth_provider: string | null;
  scan_count: number;
  last_scan_at: string | null;
  created_at: string;
  last_login_at: string | null;
}

interface UserTableProps {
  users: User[];
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onSearch: (query: string) => void;
  onDelete: (userId: string) => void;
}

export default function UserTable({
  users,
  totalPages,
  currentPage,
  onPageChange,
  onSearch,
  onDelete,
}: UserTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  const handleDelete = (userId: string) => {
    onDelete(userId);
    setDeleteConfirm(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm">
      {/* Search */}
      <div className="p-4 border-b">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาอีเมลหรือชื่อ..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            ค้นหา
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">ผู้ใช้</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">สถานะ</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">การตรวจ</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">เข้าสู่ระบบล่าสุด</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium">
                      {user.nickname?.[0] || user.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.nickname || user.email.split('@')[0]}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                    {user.oauth_provider && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        {user.oauth_provider}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        user.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          user.is_active ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {user.role === 'admin' && (
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-gray-900 font-medium">{user.scan_count}</div>
                  {user.last_scan_at && (
                    <div className="text-sm text-gray-500">
                      ล่าสุด: {format(new Date(user.last_scan_at), 'd MMM yyyy', { locale: th })}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-500 text-sm">
                  {user.last_login_at
                    ? format(new Date(user.last_login_at), 'd MMM yyyy HH:mm', { locale: th })
                    : '-'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Link>
                    {user.role !== 'admin' && (
                      deleteConfirm === user.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            ยืนยัน
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(user.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <div className="text-sm text-gray-500">
            หน้า {currentPage} จาก {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              ก่อนหน้า
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
