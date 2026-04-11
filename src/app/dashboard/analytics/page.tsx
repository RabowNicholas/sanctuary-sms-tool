'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BroadcastAnalytics, ListBreakdown, ErrorBreakdown } from '@/app/api/analytics/route';

export default function AnalyticsPage() {
  const [broadcasts, setBroadcasts] = useState<BroadcastAnalytics[]>([]);
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeTests, setIncludeTests] = useState(false);

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

  const toggleBreakdown = (broadcastId: string) => {
    setExpandedBreakdowns(prev => {
      const next = new Set(prev);
      if (next.has(broadcastId)) {
        next.delete(broadcastId);
      } else {
        next.add(broadcastId);
      }
      return next;
    });
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

  const getFilteredBroadcasts = () => {
    let filtered = broadcasts;
    if (startDate) {
      filtered = filtered.filter(b => new Date(b.createdAt) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter(b => new Date(b.createdAt) <= new Date(endDate + 'T23:59:59'));
    }
    if (!includeTests) {
      filtered = filtered.filter(b => !b.name?.toLowerCase().includes('test'));
    }
    return filtered;
  };

  const handleExportCSV = () => {
    const filtered = getFilteredBroadcasts();

    const headers = [
      'Name', 'Date', 'Message', 'Sent', 'Delivered', 'Failed',
      'Delivery Rate (%)', 'Total Clicks', 'Unique Clickers',
      'Click-Through Rate (%)', 'Total Cost ($)', 'Cost Per Click ($)'
    ];

    const rows = filtered.map(b => [
      `"${(b.name || '').replace(/"/g, '""')}"`,
      `"${formatDate(b.createdAt)}"`,
      `"${b.message.replace(/"/g, '""')}"`,
      b.sentCount,
      b.deliveredCount,
      b.failedCount,
      b.deliveryRate,
      b.totalClicks,
      b.uniqueClickers,
      b.clickThroughRate,
      b.totalCost.toFixed(2),
      b.uniqueClickers > 0 ? (b.totalCost / b.uniqueClickers).toFixed(2) : 'N/A'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

        {/* Export Controls */}
        {!isLoading && !error && broadcasts.length > 0 && (
          <div className="mb-6 bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-gray-400 text-sm">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-400 text-sm">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTests}
                onChange={e => setIncludeTests(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-gray-300 text-sm">Include test broadcasts</span>
            </label>
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-gray-400 text-sm">{getFilteredBroadcasts().length} broadcasts in range</span>
              <button
                onClick={handleExportCSV}
                disabled={getFilteredBroadcasts().length === 0}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Export CSV
              </button>
            </div>
          </div>
        )}

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

        {/* Delivery Rate Trend Chart */}
        {!isLoading && !error && getFilteredBroadcasts().length > 0 && (
          <DeliveryTrendChart broadcasts={getFilteredBroadcasts()} />
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
                      <p className="text-gray-400 text-sm">Total Cost (incl. carrier fees)</p>
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

                {/* Error Code Breakdown */}
                {broadcast.failedCount > 0 && broadcast.errorBreakdown && (
                  <div className="mt-4 border-t border-gray-700 pt-4">
                    <p className="text-sm font-medium text-red-400 mb-2">Failure Breakdown by Error Code</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {broadcast.errorBreakdown.carrierBlock > 0 && (
                        <div className="bg-red-950 border border-red-800 rounded p-2 text-center">
                          <p className="text-xs text-red-400 font-mono">30007</p>
                          <p className="text-lg font-bold text-red-300">{broadcast.errorBreakdown.carrierBlock}</p>
                          <p className="text-xs text-red-500">Carrier Block</p>
                        </div>
                      )}
                      {broadcast.errorBreakdown.optedOut > 0 && (
                        <div className="bg-orange-950 border border-orange-800 rounded p-2 text-center">
                          <p className="text-xs text-orange-400 font-mono">21610</p>
                          <p className="text-lg font-bold text-orange-300">{broadcast.errorBreakdown.optedOut}</p>
                          <p className="text-xs text-orange-500">Opted Out</p>
                        </div>
                      )}
                      {broadcast.errorBreakdown.unreachable > 0 && (
                        <div className="bg-yellow-950 border border-yellow-800 rounded p-2 text-center">
                          <p className="text-xs text-yellow-400 font-mono">30003</p>
                          <p className="text-lg font-bold text-yellow-300">{broadcast.errorBreakdown.unreachable}</p>
                          <p className="text-xs text-yellow-500">Unreachable</p>
                        </div>
                      )}
                      {broadcast.errorBreakdown.nonexistent > 0 && (
                        <div className="bg-gray-750 border border-gray-600 rounded p-2 text-center">
                          <p className="text-xs text-gray-400 font-mono">30005</p>
                          <p className="text-lg font-bold text-gray-300">{broadcast.errorBreakdown.nonexistent}</p>
                          <p className="text-xs text-gray-500">Nonexistent</p>
                        </div>
                      )}
                      {broadcast.errorBreakdown.other > 0 && (
                        <div className="bg-gray-750 border border-gray-600 rounded p-2 text-center">
                          <p className="text-xs text-gray-400 font-mono">other</p>
                          <p className="text-lg font-bold text-gray-300">{broadcast.errorBreakdown.other}</p>
                          <p className="text-xs text-gray-500">Other</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Breakdown by List */}
                {broadcast.listBreakdown && broadcast.listBreakdown.length > 0 && (
                  <div className="mt-4 border-t border-gray-700 pt-4">
                    <button
                      onClick={() => toggleBreakdown(broadcast.id)}
                      className="text-sm text-gray-400 hover:text-gray-300 flex items-center gap-2"
                    >
                      <span>{expandedBreakdowns.has(broadcast.id) ? '▲' : '▼'}</span>
                      Breakdown by List
                    </button>

                    {expandedBreakdowns.has(broadcast.id) && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 text-xs border-b border-gray-700">
                              <th className="pb-2 font-medium">List</th>
                              <th className="pb-2 font-medium text-right">Members</th>
                              <th className="pb-2 font-medium text-right">Clicks</th>
                              <th className="pb-2 font-medium text-right">Unique Clickers</th>
                              <th className="pb-2 font-medium text-right">Replies</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700">
                            {broadcast.listBreakdown
                              .filter((l: ListBreakdown) => l.type === 'include')
                              .map((list: ListBreakdown) => (
                                <tr key={list.listId} className="text-gray-300">
                                  <td className="py-2">{list.listName}</td>
                                  <td className="py-2 text-right">{list.memberCount}</td>
                                  <td className="py-2 text-right text-blue-400">{list.clicks}</td>
                                  <td className="py-2 text-right text-purple-400">{list.uniqueClickers}</td>
                                  <td className="py-2 text-right text-green-400">{list.replies}</td>
                                </tr>
                              ))}
                            {broadcast.listBreakdown
                              .filter((l: ListBreakdown) => l.type === 'exclude')
                              .map((list: ListBreakdown) => (
                                <tr key={list.listId} className="text-gray-500 italic">
                                  <td className="py-2">{list.listName} <span className="text-xs not-italic bg-gray-700 px-1.5 py-0.5 rounded ml-1">excluded</span></td>
                                  <td className="py-2 text-right">{list.memberCount}</td>
                                  <td className="py-2 text-right">—</td>
                                  <td className="py-2 text-right">—</td>
                                  <td className="py-2 text-right">—</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Delivery Rate Trend Chart ────────────────────────────────────────────────

interface TrendPoint {
  date: string;
  rate: number;
  name: string | null;
}

function DeliveryTrendChart({ broadcasts }: { broadcasts: BroadcastAnalytics[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: TrendPoint } | null>(null);

  // Sort oldest → newest for left-to-right trend
  const points: TrendPoint[] = [...broadcasts]
    .reverse()
    .map(b => ({ date: b.createdAt, rate: b.deliveryRate, name: b.name }));

  if (points.length === 0) return null;

  const W = 800;
  const H = 160;
  const PAD = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const xScale = (i: number) =>
    PAD.left + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);
  const yScale = (rate: number) =>
    PAD.top + chartH - (rate / 100) * chartH;

  const pointColor = (rate: number) =>
    rate >= 90 ? '#4ade80' : rate >= 75 ? '#facc15' : '#f87171';

  const polylinePoints = points
    .map((p, i) => `${xScale(i)},${yScale(p.rate)}`)
    .join(' ');

  const formatShortDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Show at most 8 x-axis labels to avoid crowding
  const labelEvery = Math.ceil(points.length / 8);

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Delivery Rate Trend</h2>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> ≥90%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> 75–89%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> &lt;75%</span>
        </div>
      </div>

      {points.length === 1 ? (
        <div className="text-center py-4">
          <p className="text-2xl font-bold" style={{ color: pointColor(points[0].rate) }}>{points[0].rate}%</p>
          <p className="text-gray-400 text-sm mt-1">{points[0].name || formatShortDate(points[0].date)}</p>
          <p className="text-gray-500 text-xs mt-2">Add more broadcasts to see trend over time</p>
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ minWidth: Math.max(points.length * 30, 300) }}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Guide lines at 100%, 75%, 50% */}
            {[100, 75, 50].map(pct => {
              const y = yScale(pct);
              return (
                <g key={pct}>
                  <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#374151" strokeDasharray="4 3" strokeWidth="1" />
                  <text x={PAD.left - 4} y={y + 4} textAnchor="end" fill="#6b7280" fontSize="10">{pct}%</text>
                </g>
              );
            })}

            {/* Trend polyline — gray base */}
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#4b5563"
              strokeWidth="2"
            />

            {/* Colored segments between consecutive points */}
            {points.slice(0, -1).map((p, i) => (
              <line
                key={i}
                x1={xScale(i)} y1={yScale(p.rate)}
                x2={xScale(i + 1)} y2={yScale(points[i + 1].rate)}
                stroke={pointColor((p.rate + points[i + 1].rate) / 2)}
                strokeWidth="2.5"
              />
            ))}

            {/* Data points */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={xScale(i)}
                cy={yScale(p.rate)}
                r="5"
                fill={pointColor(p.rate)}
                stroke="#1f2937"
                strokeWidth="2"
                className="cursor-pointer"
                onMouseEnter={() => setTooltip({ x: xScale(i), y: yScale(p.rate), point: p })}
              />
            ))}

            {/* X-axis labels */}
            {points.map((p, i) =>
              i % labelEvery === 0 || i === points.length - 1 ? (
                <text
                  key={i}
                  x={xScale(i)}
                  y={H - 4}
                  textAnchor="middle"
                  fill="#6b7280"
                  fontSize="9"
                >
                  {formatShortDate(p.date)}
                </text>
              ) : null
            )}
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute pointer-events-none bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs shadow-lg"
              style={{
                left: `${(tooltip.x / W) * 100}%`,
                top: `${(tooltip.y / H) * 100}%`,
                transform: 'translate(-50%, -110%)',
                zIndex: 10,
              }}
            >
              <p className="text-gray-300 font-medium">{tooltip.point.name || formatShortDate(tooltip.point.date)}</p>
              <p className="text-gray-400">{formatShortDate(tooltip.point.date)}</p>
              <p className="font-bold mt-0.5" style={{ color: pointColor(tooltip.point.rate) }}>
                {tooltip.point.rate}% delivered
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
