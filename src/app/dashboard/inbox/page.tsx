'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Conversation {
  id: string;
  phoneNumber: string;
  formattedPhoneNumber: string;
  isActive: boolean;
  joinedAt: string;
  lastReadAt: string | null;
  hasUnread: boolean;
  lastMessage: {
    id: string;
    content: string;
    direction: 'INBOUND' | 'OUTBOUND';
    createdAt: string;
  } | null;
}

interface InboxStats {
  unreadCount: number;
  totalConversations: number;
}

type FilterType = 'all' | 'unread' | 'read';

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<InboxStats>({ unreadCount: 0, totalConversations: 0 });
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInbox();
    loadStats();
  }, [filter, search]);

  const loadInbox = async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('filter', filter);
      if (search) {
        params.set('search', search);
      }

      const response = await fetch(`/api/inbox?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations);
      } else {
        setError('Failed to load conversations');
      }
    } catch (err) {
      console.error('Failed to load inbox:', err);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/inbox/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleMarkAsRead = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/mark-read`, {
        method: 'POST',
      });

      if (response.ok) {
        // Refresh inbox and stats
        loadInbox();
        loadStats();
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAsUnread = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/mark-unread`, {
        method: 'POST',
      });

      if (response.ok) {
        // Refresh inbox and stats
        loadInbox();
        loadStats();
      }
    } catch (err) {
      console.error('Failed to mark as unread:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes}m ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Inbox</h1>
              <p className="text-gray-300 mt-2">Manage your conversations and messages</p>
            </div>
            <Link
              href="/dashboard"
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-300">Total Conversations</h3>
            <p className="text-3xl font-bold text-blue-400">{stats.totalConversations}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-300">Unread</h3>
            <p className="text-3xl font-bold text-orange-400">{stats.unreadCount}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-300">Read</h3>
            <p className="text-3xl font-bold text-green-400">{stats.totalConversations - stats.unreadCount}</p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Filter Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                All ({stats.totalConversations})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                  filter === 'unread'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Unread ({stats.unreadCount})
              </button>
              <button
                onClick={() => setFilter('read')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                  filter === 'read'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Read ({stats.totalConversations - stats.unreadCount})
              </button>
            </div>

            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by phone number..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
          {error && (
            <div className="p-4 bg-red-900 border-b border-red-700 text-red-300">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-gray-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2">Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p>No conversations found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-4 hover:bg-gray-750 transition-colors ${
                    conversation.hasUnread ? 'bg-gray-800/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {/* Unread Indicator */}
                        {conversation.hasUnread && (
                          <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                        )}

                        {/* Phone Number Link */}
                        <Link
                          href={`/dashboard/conversations/${conversation.id}`}
                          className="text-lg font-semibold text-white hover:text-blue-400 transition-colors"
                        >
                          {conversation.formattedPhoneNumber}
                        </Link>

                        {/* Active Badge */}
                        {conversation.isActive && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-600 text-green-100 rounded-full">
                            Active
                          </span>
                        )}
                      </div>

                      {/* Last Message Preview */}
                      {conversation.lastMessage && (
                        <div className="ml-5">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs font-medium ${
                                conversation.lastMessage.direction === 'INBOUND'
                                  ? 'text-blue-400'
                                  : 'text-green-400'
                              }`}
                            >
                              {conversation.lastMessage.direction === 'INBOUND' ? '← Received' : '→ Sent'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatDate(conversation.lastMessage.createdAt)}
                            </span>
                          </div>
                          <p className={`text-sm ${conversation.hasUnread ? 'text-white font-medium' : 'text-gray-400'}`}>
                            {conversation.lastMessage.content.length > 100
                              ? conversation.lastMessage.content.substring(0, 100) + '...'
                              : conversation.lastMessage.content}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 ml-4">
                      <Link
                        href={`/dashboard/conversations/${conversation.id}`}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
                      >
                        View
                      </Link>
                      {conversation.hasUnread ? (
                        <button
                          onClick={() => handleMarkAsRead(conversation.id)}
                          className="px-4 py-2 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          Mark Read
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkAsUnread(conversation.id)}
                          className="px-4 py-2 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          Mark Unread
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
