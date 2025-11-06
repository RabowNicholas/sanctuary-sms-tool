'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Message {
  id: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  createdAt: string;
}

interface Subscriber {
  id: string;
  phoneNumber: string;
  isActive: boolean;
  joinedAt: string;
}

interface ConversationData {
  subscriber: Subscriber;
  messages: Message[];
}

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const subscriberId = params.id as string;

  const [data, setData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const fetchConversation = async () => {
    try {
      const response = await fetch(`/api/subscribers/${subscriberId}/messages`);

      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversation();

    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchConversation, 5000);
    return () => clearInterval(interval);
  }, [subscriberId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!replyMessage.trim()) return;

    setSending(true);
    setSendError(null);
    setSendSuccess(false);

    try {
      const response = await fetch(`/api/subscribers/${subscriberId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyMessage }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      // Clear input and show success
      setReplyMessage('');
      setSendSuccess(true);

      // Refresh conversation to show new message
      await fetchConversation();

      // Hide success message after 3 seconds
      setTimeout(() => setSendSuccess(false), 3000);

    } catch (err: any) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (phone.startsWith('+1') && phone.length === 12) {
      const cleaned = phone.replace('+1', '');
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else if (days === 1) {
      return 'Yesterday ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  };

  const calculateCost = (message: string) => {
    const segmentLength = 160;
    const costPerSegment = 0.0083;
    const segments = Math.ceil(message.length / segmentLength);
    return (segments * costPerSegment).toFixed(4);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-gray-400">Loading conversation...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 text-blue-400 hover:text-blue-300"
          >
            ← Back to Dashboard
          </button>
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-300">
            Error: {error || 'Failed to load conversation'}
          </div>
        </div>
      </div>
    );
  }

  const { subscriber, messages } = data;
  const messageCount = messages.length;
  const inboundCount = messages.filter(m => m.direction === 'INBOUND').length;
  const outboundCount = messages.filter(m => m.direction === 'OUTBOUND').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto p-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-2 text-blue-400 hover:text-blue-300 text-sm"
          >
            ← Back to Dashboard
          </button>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {formatPhoneNumber(subscriber.phoneNumber)}
              </h1>
              <div className="flex gap-4 text-sm text-gray-400">
                <span className={subscriber.isActive ? 'text-green-400' : 'text-red-400'}>
                  {subscriber.isActive ? '● Active' : '○ Inactive'}
                </span>
                <span>Joined {new Date(subscriber.joinedAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="text-right text-sm text-gray-400">
              <div>{messageCount} messages</div>
              <div>{inboundCount} received / {outboundCount} sent</div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="space-y-4 mb-24">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No messages yet. Start the conversation below!
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.direction === 'OUTBOUND'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  <div
                    className={`text-xs mt-1 ${
                      message.direction === 'OUTBOUND' ? 'text-blue-200' : 'text-gray-400'
                    }`}
                  >
                    {formatDate(message.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Reply Box - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4">
          <div className="max-w-4xl mx-auto">
            {!subscriber.isActive && (
              <div className="mb-2 bg-yellow-900/20 border border-yellow-500 rounded p-2 text-yellow-300 text-sm">
                ⚠️ This subscriber is inactive. They won't receive messages.
              </div>
            )}

            {sendSuccess && (
              <div className="mb-2 bg-green-900/20 border border-green-500 rounded p-2 text-green-300 text-sm">
                ✓ Message sent successfully!
              </div>
            )}

            {sendError && (
              <div className="mb-2 bg-red-900/20 border border-red-500 rounded p-2 text-red-300 text-sm">
                ✗ {sendError}
              </div>
            )}

            <form onSubmit={handleSendReply} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-lg p-3
                           focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                  maxLength={1600}
                  disabled={sending || !subscriber.isActive}
                />
                <button
                  type="submit"
                  disabled={sending || !replyMessage.trim() || !subscriber.isActive}
                  className="px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600
                           disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>
                  {replyMessage.length} / 1600 characters
                  {replyMessage.length > 160 && ` (${Math.ceil(replyMessage.length / 160)} segments)`}
                </span>
                {replyMessage.length > 0 && (
                  <span>Cost: ${calculateCost(replyMessage)}</span>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
