'use client';

import { useEffect, useState, useCallback } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AdminNav from '@/components/admin/AdminNav';
import UserTable from '@/components/admin/UserTable';
import { authClient } from '@/lib/auth-client';

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

interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

function UsersPageContent() {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: '20',
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await authClient.fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        setError('ไม่สามารถโหลดข้อมูลได้');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleDelete = async (userId: string) => {
    try {
      const response = await authClient.fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchUsers();
      } else {
        alert('ไม่สามารถลบผู้ใช้ได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">ผู้ใช้งาน</h1>
          <p className="text-gray-600 mt-1">
            {data ? `${data.total} ผู้ใช้ทั้งหมด` : 'กำลังโหลด...'}
          </p>
        </div>

        {isLoading && !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl">
            {error}
          </div>
        ) : data ? (
          <UserTable
            users={data.users}
            totalPages={data.total_pages}
            currentPage={data.page}
            onPageChange={handlePageChange}
            onSearch={handleSearch}
            onDelete={handleDelete}
          />
        ) : null}
      </main>
    </div>
  );
}

export default function UsersPage() {
  return (
    <ProtectedRoute requireAdmin>
      <UsersPageContent />
    </ProtectedRoute>
  );
}
