'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BroadcastAnalytics } from '@/app/api/analytics/route';

export default function AnalyticsPage() {
  const [broadcasts, setBroadcasts] = useState<BroadcastAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analytics');

      if (response.ok) {
        const data = await response.json();
        setBroadcasts(data.broadcasts);
      } else {
        setError('Failed to load analytics');
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMessage = (message: string, maxLength: number = 100) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Broadcast Analytics</h1>
              <p className="text-gray-300 mt-2">Track performance of your SMS campaigns</p>
            </div>
            <Link
              href="/dashboard"
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-400">Loading analytics...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* No Broadcasts */}
        {!isLoading && !error && broadcasts.length === 0 && (
          <div className="bg-gray-800 p-12 rounded-lg shadow-lg border border-gray-700 text-center">
            <p className="text-gray-400 text-lg">No broadcasts yet</p>
            <p className="text-gray-500 mt-2">Send your first broadcast to see analytics here</p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Send Broadcast
            </Link>
          </div>
        )}

        {/* Broadcasts List */}
        {!isLoading && !error && broadcasts.length > 0 && (
          <div className="space-y-6">
            {broadcasts.map((broadcast) => (
              <div
                key={broadcast.id}
                className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 hover:border-gray-600 transition-colors"
              >
                {/* Campaign Header */}
                <div className="mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white">
                        {broadcast.name || `Broadcast - ${formatDate(broadcast.createdAt)}`}
                      </h3>
                      <p className="text-gray-400 text-sm mt-1">{formatDate(broadcast.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-400">${broadcast.totalCost.toFixed(2)}</p>
                      <p className="text-gray-400 text-sm">Total Cost</p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-gray-700 rounded border border-gray-600">
                    <p className="text-gray-300 text-sm">{formatMessage(broadcast.message)}</p>
                  </div>
                </div>

                {/* Analytics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Total Sent */}
                  <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                    <p className="text-gray-400 text-sm">Total Sent</p>
                    <p className="text-2xl font-bold text-white mt-1">{broadcast.sentCount}</p>
                  </div>

                  {/* Delivered */}
                  <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                    <p className="text-gray-400 text-sm">Delivered</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="text-2xl font-bold text-green-400">{broadcast.deliveredCount}</p>
                      <p className="text-sm text-green-400">({broadcast.deliveryRate}%)</p>
                    </div>
                  </div>

                  {/* Failed */}
                  <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                    <p className="text-gray-400 text-sm">Failed</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="text-2xl font-bold text-red-400">{broadcast.failedCount}</p>
                      {broadcast.sentCount > 0 && (
                        <p className="text-sm text-red-400">
                          ({((broadcast.failedCount / broadcast.sentCount) * 100).toFixed(1)}%)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Total Clicks */}
                  <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                    <p className="text-gray-400 text-sm">Total Clicks</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">{broadcast.totalClicks}</p>
                  </div>

                  {/* Unique Clickers */}
                  <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                    <p className="text-gray-400 text-sm">Unique Clickers</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">{broadcast.uniqueClickers}</p>
                  </div>

                  {/* Click-Through Rate */}
                  <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                    <p className="text-gray-400 text-sm">Click-Through Rate</p>
                    <p className="text-2xl font-bold text-orange-400 mt-1">{broadcast.clickThroughRate}%</p>
                    <p className="text-xs text-gray-500 mt-1">of delivered</p>
                  </div>

                  {/* Cost per Click */}
                  <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                    <p className="text-gray-400 text-sm">Cost per Click</p>
                    <p className="text-2xl font-bold text-cyan-400 mt-1">
                      {broadcast.uniqueClickers > 0
                        ? `$${(broadcast.totalCost / broadcast.uniqueClickers).toFixed(2)}`
                        : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">per unique click</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
