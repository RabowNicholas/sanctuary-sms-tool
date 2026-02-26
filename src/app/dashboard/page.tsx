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

interface SubscriberList {
  id: string;
  name: string;
  memberCount: number;
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
  const [campaignName, setCampaignName] = useState('');
  const [detectedLinks, setDetectedLinks] = useState<string[]>([]);
  const [approvedLinks, setApprovedLinks] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');
  const [testError, setTestError] = useState('');

  // Targeting state
  const [lists, setLists] = useState<SubscriberList[]>([]);
  const [targetAll, setTargetAll] = useState(true);
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [excludeListIds, setExcludeListIds] = useState<Set<string>>(new Set());
  const [targetedRecipientCount, setTargetedRecipientCount] = useState(0);

  const costCalculator = new CostCalculator();

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Detect links in broadcast message
  useEffect(() => {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const matches = broadcastMessage.match(urlPattern);
    const links = matches ? [...new Set(matches)] : [];

    setDetectedLinks(links);

    // Auto-approve newly detected links
    setApprovedLinks(prevApproved => {
      const newApproved = new Set(prevApproved);
      links.forEach(link => newApproved.add(link));
      return newApproved;
    });
  }, [broadcastMessage]);

  const loadDashboardData = async () => {
    try {
      const [statsResponse, inboxStatsResponse, listsResponse] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/inbox/stats'),
        fetch('/api/lists'),
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
        setTargetedRecipientCount(statsData.activeSubscribers);
      }

      if (inboxStatsResponse.ok) {
        const inboxStatsData = await inboxStatsResponse.json();
        setUnreadCount(inboxStatsData.unreadCount);
      }

      if (listsResponse.ok) {
        const listsData = await listsResponse.json();
        setLists(listsData);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  // Calculate targeted recipient count when targeting changes
  useEffect(() => {
    let count = 0;
    if (targetAll) {
      count = stats.activeSubscribers;
    } else if (selectedListIds.size > 0) {
      const selectedLists = lists.filter(l => selectedListIds.has(l.id));
      count = Math.min(
        selectedLists.reduce((sum, l) => sum + l.memberCount, 0),
        stats.activeSubscribers
      );
    }
    if (excludeListIds.size > 0) {
      const excludedCount = lists
        .filter(l => excludeListIds.has(l.id))
        .reduce((sum, l) => sum + l.memberCount, 0);
      count = Math.max(0, count - excludedCount);
    }
    setTargetedRecipientCount(count);
  }, [targetAll, selectedListIds, excludeListIds, lists, stats.activeSubscribers]);

  const toggleLinkApproval = (link: string) => {
    setApprovedLinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(link)) {
        newSet.delete(link);
      } else {
        newSet.add(link);
      }
      return newSet;
    });
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      setError('Please enter a message');
      return;
    }

    // Check for unapproved links
    const unapprovedLinks = detectedLinks.filter(link => !approvedLinks.has(link));
    if (unapprovedLinks.length > 0) {
      const confirmSend = window.confirm(
        `⚠️ Warning: ${unapprovedLinks.length} link(s) will not be tracked and will be sent as original URLs.\n\nUnapproved links:\n${unapprovedLinks.join('\n')}\n\nDo you want to send anyway?`
      );
      if (!confirmSend) {
        return;
      }
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
          campaignName: campaignName.trim() || undefined,
          approvedLinks: Array.from(approvedLinks),
          targetAll,
          targetListIds: targetAll ? [] : Array.from(selectedListIds),
          excludeListIds: Array.from(excludeListIds),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const targetInfo = result.targetAll
          ? ''
          : ` (targeted ${result.targetedLists} list${result.targetedLists !== 1 ? 's' : ''})`;
        setSuccess(`Broadcast sent to ${result.sentTo} subscribers! Cost: $${result.totalCost}${result.linksTracked > 0 ? ` (${result.linksTracked} link(s) tracked)` : ''}${targetInfo}`);
        setBroadcastMessage('');
        setCampaignName('');
        setDetectedLinks([]);
        setApprovedLinks(new Set());
        setTargetAll(true);
        setSelectedListIds(new Set());
        setExcludeListIds(new Set());
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

  const toggleListSelection = (listId: string) => {
    setSelectedListIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(listId)) {
        newSet.delete(listId);
      } else {
        newSet.add(listId);
      }
      return newSet;
    });
  };

  const toggleExcludeListSelection = (listId: string) => {
    setExcludeListIds(prev => {
      const next = new Set(prev);
      next.has(listId) ? next.delete(listId) : next.add(listId);
      return next;
    });
  };

  const handleSendTest = async () => {
    // Validate phone number
    if (!testPhoneNumber.trim()) {
      setTestError('Please enter a phone number');
      return;
    }

    const phoneRegex = /^\+1\d{10}$/;
    if (!phoneRegex.test(testPhoneNumber)) {
      setTestError('Invalid phone number format. Use +1XXXXXXXXXX (e.g., +18019416629)');
      return;
    }

    // Validate message
    if (!broadcastMessage.trim()) {
      setTestError('Please enter a message');
      return;
    }

    // Warn about unapproved links
    if (detectedLinks.length > 0 && approvedLinks.size === 0) {
      if (!confirm('No links are approved for tracking. Send without link tracking?')) {
        return;
      }
    }

    setIsSendingTest(true);
    setTestError('');
    setTestSuccess('');

    try {
      const response = await fetch('/api/broadcast/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: testPhoneNumber,
          message: broadcastMessage,
          campaignName: campaignName || undefined,
          approvedLinks: Array.from(approvedLinks),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestSuccess(`✅ Test message sent successfully to ${testPhoneNumber}! Cost: $${data.totalCost}`);
        console.log('Test message sent:', data);
      } else {
        setTestError(data.error || 'Failed to send test message');
      }
    } catch (error) {
      console.error('Error sending test message:', error);
      setTestError('Failed to send test message. Please try again.');
    } finally {
      setIsSendingTest(false);
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

  // Get base URL for accurate shortened link length
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://your-app.vercel.app'; // Fallback for SSR
  };

  // Calculate what the message will look like after link shortening
  const getProcessedMessageForCost = () => {
    if (detectedLinks.length === 0) {
      return broadcastMessage;
    }

    let processedMessage = broadcastMessage;
    const baseUrl = getBaseUrl();
    // Sample short code is 8 characters (matches actual implementation)
    const sampleShortCode = 'xxxxxxxx';

    detectedLinks.forEach(link => {
      // Only replace if link is approved
      if (approvedLinks.has(link)) {
        const shortenedUrl = `${baseUrl}/sanctuary/${sampleShortCode}`;
        processedMessage = processedMessage.replace(link, shortenedUrl);
      }
    });

    return processedMessage;
  };

  const costBreakdown = costCalculator.getCostBreakdown(
    getProcessedMessageForCost(),
    targetedRecipientCount
  );

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
                href="/dashboard/analytics"
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200"
              >
                Analytics
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
                  Campaign Name (Optional)
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Spring Newsletter, Product Launch..."
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={100}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Give this broadcast a name to track it in analytics
                </p>
              </div>

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

              {/* Detected Links */}
              {detectedLinks.length > 0 && (
                <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
                  <h3 className="font-medium text-gray-200 mb-3 flex items-center gap-2">
                    🔗 Detected Links ({detectedLinks.length})
                  </h3>
                  <div className="space-y-2">
                    {detectedLinks.map((link, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-2 bg-gray-800 rounded border border-gray-600"
                      >
                        <input
                          type="checkbox"
                          checked={approvedLinks.has(link)}
                          onChange={() => toggleLinkApproval(link)}
                          className="mt-1 h-4 w-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white break-all">{link}</p>
                          {approvedLinks.has(link) ? (
                            <div className="mt-1 space-y-1">
                              <p className="text-xs text-green-400">✓ Will be shortened & tracked</p>
                              <p className="text-xs text-gray-400">
                                Preview: <span className="text-blue-300">{getBaseUrl()}/sanctuary/xxxxxxxx</span>
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs mt-1 text-orange-400">⚠️ Will send as-is (no tracking)</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Targeting */}
              {lists.length > 0 && (
                <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
                  <h3 className="font-medium text-gray-200 mb-3">Target Audience</h3>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        checked={targetAll}
                        onChange={() => setTargetAll(true)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-white">All Subscribers</span>
                      <span className="text-gray-400 text-sm">({stats.activeSubscribers})</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        checked={!targetAll}
                        onChange={() => setTargetAll(false)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-white">Specific Lists</span>
                    </label>

                    {!targetAll && (
                      <div className="ml-7 space-y-2 pt-2">
                        {lists.map((list) => (
                          <label
                            key={list.id}
                            className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800 rounded hover:bg-gray-750 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedListIds.has(list.id)}
                              onChange={() => toggleListSelection(list.id)}
                              className="h-4 w-4 rounded border-gray-500 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-white">{list.name}</span>
                            <span className="text-gray-400 text-sm">({list.memberCount})</span>
                          </label>
                        ))}
                        {selectedListIds.size === 0 && (
                          <p className="text-orange-400 text-sm">
                            Select at least one list
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Exclude Lists */}
              {lists.length > 0 && (
                <div className="bg-gray-700 p-4 rounded-md border border-red-900/40 mt-3">
                  <h3 className="font-medium text-gray-200 mb-1 text-sm">
                    Exclude Lists{' '}
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Subscribers in these lists will be removed from the send.
                  </p>
                  <div className="space-y-2">
                    {lists.map((list) => (
                      <label
                        key={list.id}
                        className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800 rounded hover:bg-gray-750 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={excludeListIds.has(list.id)}
                          onChange={() => toggleExcludeListSelection(list.id)}
                          className="h-4 w-4 rounded border-gray-500 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-white text-sm">{list.name}</span>
                        <span className="text-gray-400 text-sm">({list.memberCount})</span>
                      </label>
                    ))}
                  </div>
                  {excludeListIds.size > 0 && (
                    <p className="text-red-400 text-xs mt-2">
                      -{excludeListIds.size} list{excludeListIds.size !== 1 ? 's' : ''} excluded
                    </p>
                  )}
                </div>
              )}

              {/* Cost Breakdown */}
              <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
                <h3 className="font-medium text-gray-200 mb-2">Cost Estimate</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Recipients:</span>
                    <span className="ml-2 font-medium text-white">
                      {targetedRecipientCount}
                      {!targetAll && selectedListIds.size > 1 && (
                        <span className="text-gray-500 text-xs ml-1">(approx)</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Segments:</span>
                    <span className="ml-2 font-medium text-white">{costBreakdown.segmentCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Base SMS Cost:</span>
                    <span className="ml-2 font-medium text-white">${costBreakdown.baseCost.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Carrier Fees:</span>
                    <span className="ml-2 font-medium text-white">${costBreakdown.carrierFees.toFixed(2)}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-gray-600">
                    <span className="text-gray-400">Total Cost:</span>
                    <span className="ml-2 font-medium text-lg text-green-400">
                      ${costBreakdown.totalCost.toFixed(2)}
                    </span>
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

              {/* Test Message Section */}
              <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-300 mb-3">
                  📱 Send Test Message
                </h3>
                <p className="text-sm text-gray-300 mb-4">
                  Send this message to a single phone number to verify links and content before broadcasting to all subscribers.
                </p>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <input
                      type="tel"
                      value={testPhoneNumber}
                      onChange={(e) => setTestPhoneNumber(e.target.value)}
                      placeholder="+18019416629"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Format: +1XXXXXXXXXX (US numbers only)
                    </p>
                  </div>
                  <button
                    onClick={handleSendTest}
                    disabled={isSendingTest || !broadcastMessage.trim() || !testPhoneNumber.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {isSendingTest ? 'Sending...' : 'Send Test'}
                  </button>
                </div>

                {testSuccess && (
                  <div className="mt-3 p-3 bg-green-900/20 border border-green-700 rounded text-green-300 text-sm">
                    {testSuccess}
                  </div>
                )}

                {testError && (
                  <div className="mt-3 p-3 bg-red-900/20 border border-red-700 rounded text-red-300 text-sm">
                    {testError}
                  </div>
                )}
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendBroadcast}
                disabled={
                  isLoading ||
                  !broadcastMessage.trim() ||
                  targetedRecipientCount === 0 ||
                  (!targetAll && selectedListIds.size === 0)
                }
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading
                  ? 'Sending...'
                  : `Send to ${targetedRecipientCount} Subscriber${targetedRecipientCount !== 1 ? 's' : ''}${!targetAll ? ' (Targeted)' : ''}`}
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