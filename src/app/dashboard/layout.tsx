'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Load unread count
    loadUnreadCount();

    // Poll for updates every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const response = await fetch('/api/inbox/stats');
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname?.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Navigation Links */}
            <nav className="flex items-center gap-6">
              <Link
                href="/dashboard"
                className={`text-sm font-medium transition-colors duration-200 ${
                  isActive('/dashboard')
                    ? 'text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/inbox"
                className={`relative text-sm font-medium transition-colors duration-200 ${
                  isActive('/dashboard/inbox')
                    ? 'text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Inbox
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-6 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/subscribers"
                className={`text-sm font-medium transition-colors duration-200 ${
                  isActive('/dashboard/subscribers')
                    ? 'text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Subscribers
              </Link>
              <Link
                href="/dashboard/keywords"
                className={`text-sm font-medium transition-colors duration-200 ${
                  isActive('/dashboard/keywords')
                    ? 'text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Keywords
              </Link>
              <Link
                href="/dashboard/lists"
                className={`text-sm font-medium transition-colors duration-200 ${
                  isActive('/dashboard/lists')
                    ? 'text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Lists
              </Link>
              <Link
                href="/dashboard/settings"
                className={`text-sm font-medium transition-colors duration-200 ${
                  isActive('/dashboard/settings')
                    ? 'text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Settings
              </Link>
            </nav>

            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              className="text-gray-300 hover:text-white text-sm font-medium transition-colors duration-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}