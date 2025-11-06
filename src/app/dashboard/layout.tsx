'use client';

import { signOut } from 'next-auth/react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-end">
          <button
            onClick={handleLogout}
            className="text-gray-300 hover:text-white text-sm font-medium transition-colors duration-200"
          >
            Sign Out
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}