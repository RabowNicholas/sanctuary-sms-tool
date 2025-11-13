'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CostCalculator } from '@/infrastructure/cost/CostCalculator';

interface Subscriber {
  id: string;
  phoneNumber: string;
  isActive: boolean;
  joinedAt: string;
}

interface DashboardStats {
  totalSubscribers: number;
  activeSubscribers: number;
  totalMessages: number;
  todayMessages: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSubscribers: 0,
    activeSubscribers: 0,
    totalMessages: 0,
    todayMessages: 0,
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const costCalculator = new CostCalculator();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsResponse, inboxStatsResponse] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/inbox/stats'),
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (inboxStatsResponse.ok) {
        const inboxStatsData = await inboxStatsResponse.json();
        setUnreadCount(inboxStatsData.unreadCount);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      setError('Please enter a message');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: broadcastMessage,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(`Broadcast sent to ${result.sentTo} subscribers! Cost: $${result.totalCost}`);
        setBroadcastMessage('');
        loadDashboardData(); // Refresh stats
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to send broadcast');
      }
    } catch (err) {
      setError('Failed to send broadcast');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (phone.startsWith('+1') && phone.length === 12) {
      const cleaned = phone.substring(2);
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const costBreakdown = costCalculator.getCostBreakdown(broadcastMessage, stats.activeSubscribers);

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">SMS Broadcast Dashboard</h1>
              <p className="text-gray-300 mt-2">Manage your SMS campaigns and subscribers</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/dashboard/inbox"
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center gap-2"
              >
                Inbox
                {unreadCount > 0 && (
                  <span className="bg-white text-orange-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/subscribers"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Manage Subscribers
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-300">Total Subscribers</h3>
            <p className="text-3xl font-bold text-blue-400">{stats.totalSubscribers}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-300">Active Subscribers</h3>
            <p className="text-3xl font-bold text-green-400">{stats.activeSubscribers}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors">
            <Link href="/dashboard/inbox?filter=unread">
              <h3 className="text-lg font-semibold text-gray-300">Unread Messages</h3>
              <p className="text-3xl font-bold text-orange-400">{unreadCount}</p>
            </Link>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-300">Total Messages</h3>
            <p className="text-3xl font-bold text-purple-400">{stats.totalMessages}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-300">Today's Messages</h3>
            <p className="text-3xl font-bold text-cyan-400">{stats.todayMessages}</p>
          </div>
        </div>

        {/* Broadcast Composer */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Send Broadcast</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Message
                </label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Enter your broadcast message..."
                  className="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={1600}
                />
                <div className="flex justify-between text-sm text-gray-400 mt-1">
                  <span>{broadcastMessage.length}/1600 characters</span>
                  <span>{costBreakdown.segmentCount} SMS segment(s)</span>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
                <h3 className="font-medium text-gray-200 mb-2">Cost Estimate</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Recipients:</span>
                    <span className="ml-2 font-medium text-white">{stats.activeSubscribers}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Cost per SMS:</span>
                    <span className="ml-2 font-medium text-white">${costBreakdown.costPerSubscriber.toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Total Cost:</span>
                    <span className="ml-2 font-medium text-lg text-green-400">
                      ${costBreakdown.totalCost.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Segments:</span>
                    <span className="ml-2 font-medium text-white">{costBreakdown.segmentCount}</span>
                  </div>
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="bg-green-900 border border-green-700 text-green-300 px-4 py-3 rounded">
                  {success}
                </div>
              )}

              {/* Send Button */}
              <button
                onClick={handleSendBroadcast}
                disabled={isLoading || !broadcastMessage.trim() || stats.activeSubscribers === 0}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? 'Sending...' : `Send to ${stats.activeSubscribers} Subscribers`}
              </button>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-8 bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-gray-300">SMS Service: Online</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-gray-300">Database: Connected</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-gray-300">Slack: Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}