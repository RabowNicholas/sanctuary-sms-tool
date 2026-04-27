'use client';

import { useEffect, useState } from 'react';

interface TrackedLink {
  id: string;
  originalUrl: string;
  shortCode: string;
  trackingUrl: string;
  createdAt: string;
  clickCount: number;
}

export default function LinksPage() {
  const [links, setLinks] = useState<TrackedLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    loadLinks();
    const interval = setInterval(loadLinks, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadLinks = async () => {
    try {
      const response = await fetch('/api/links');
      if (response.ok) {
        const data = await response.json();
        setLinks(data);
      } else {
        setError('Failed to load links');
      }
    } catch {
      setError('Failed to load links');
    } finally {
      setIsLoading(false);
    }
  };

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 2500);
  };

  const copyToClipboard = async (text: string, code: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formUrl.trim() }),
      });

      if (response.ok) {
        const newLink: TrackedLink = await response.json();
        setLinks((prev) => [newLink, ...prev]);
        setFormUrl('');
        await copyToClipboard(newLink.trackingUrl, newLink.shortCode);
        flashSuccess('Link created and copied to clipboard');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create link');
      }
    } catch {
      setError('Failed to create link');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (link: TrackedLink) => {
    if (
      !confirm(
        `Delete this link? Its ${link.clickCount} click record${
          link.clickCount === 1 ? '' : 's'
        } will also be removed.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/links/${link.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== link.id));
        flashSuccess('Link deleted');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete link');
      }
    } catch {
      setError('Failed to delete link');
    }
  };

  const truncate = (s: string, n: number) =>
    s.length > n ? s.slice(0, n - 1) + '…' : s;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-white">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Trackable Links</h1>
          <p className="text-gray-300 mt-2">
            Create short links for social media and track clicks
          </p>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-900 border border-green-700 text-green-300 px-4 py-3 rounded mb-6">
            {success}
          </div>
        )}

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Create New Link
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Destination URL *
              </label>
              <input
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://example.com/your-page"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !formUrl.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Link'}
            </button>
          </form>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">
              Links ({links.length})
            </h2>
          </div>

          {links.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              No links created yet. Create one above to start tracking.
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {links.map((link) => (
                <div key={link.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <a
                          href={link.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 font-mono text-sm break-all"
                        >
                          {link.trackingUrl}
                        </a>
                        <button
                          onClick={() =>
                            copyToClipboard(link.trackingUrl, link.shortCode)
                          }
                          className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded whitespace-nowrap"
                        >
                          {copiedCode === link.shortCode ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <p
                        className="text-gray-300 text-sm mb-1 break-all"
                        title={link.originalUrl}
                      >
                        → {truncate(link.originalUrl, 100)}
                      </p>
                      <p className="text-gray-500 text-xs">
                        Created {new Date(link.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {link.clickCount}
                        </div>
                        <div className="text-xs text-gray-400">
                          click{link.clickCount === 1 ? '' : 's'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(link)}
                        className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                      >
                        Delete
                      </button>
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
