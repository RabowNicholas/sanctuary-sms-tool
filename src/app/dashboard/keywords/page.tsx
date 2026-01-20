'use client';

import { useState, useEffect } from 'react';

interface SubscriberList {
  id: string;
  name: string;
}

interface Keyword {
  id: string;
  keyword: string;
  autoResponse: string;
  isActive: boolean;
  listId: string | null;
  list: SubscriberList | null;
  createdAt: string;
}

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [lists, setLists] = useState<SubscriberList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [formKeyword, setFormKeyword] = useState('');
  const [formAutoResponse, setFormAutoResponse] = useState('');
  const [formListId, setFormListId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadKeywords();
    loadLists();
  }, []);

  const loadKeywords = async () => {
    try {
      const response = await fetch('/api/keywords');
      if (response.ok) {
        const data = await response.json();
        setKeywords(data);
      } else {
        setError('Failed to load keywords');
      }
    } catch (err) {
      setError('Failed to load keywords');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLists = async () => {
    try {
      const response = await fetch('/api/lists');
      if (response.ok) {
        const data = await response.json();
        setLists(data);
      }
    } catch (err) {
      console.error('Failed to load lists:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const url = editingKeyword
        ? `/api/keywords/${editingKeyword.id}`
        : '/api/keywords';

      const method = editingKeyword ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: formKeyword,
          autoResponse: formAutoResponse,
          listId: formListId || null,
        }),
      });

      if (response.ok) {
        setSuccess(editingKeyword ? 'Keyword updated!' : 'Keyword created!');
        resetForm();
        loadKeywords();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save keyword');
      }
    } catch (err) {
      setError('Failed to save keyword');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (keyword: Keyword) => {
    setEditingKeyword(keyword);
    setFormKeyword(keyword.keyword);
    setFormAutoResponse(keyword.autoResponse);
    setFormListId(keyword.listId || '');
    setShowForm(true);
  };

  const handleToggleActive = async (keyword: Keyword) => {
    try {
      const response = await fetch(`/api/keywords/${keyword.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !keyword.isActive }),
      });

      if (response.ok) {
        loadKeywords();
      } else {
        setError('Failed to update keyword status');
      }
    } catch (err) {
      setError('Failed to update keyword status');
    }
  };

  const handleDelete = async (keyword: Keyword) => {
    if (!confirm(`Are you sure you want to delete the keyword "${keyword.keyword}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/keywords/${keyword.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccess('Keyword deleted!');
        loadKeywords();
      } else {
        setError('Failed to delete keyword');
      }
    } catch (err) {
      setError('Failed to delete keyword');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingKeyword(null);
    setFormKeyword('');
    setFormAutoResponse('');
    setFormListId('');
  };

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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Signup Keywords</h1>
            <p className="text-gray-300 mt-2">
              Manage keywords that people can text to subscribe
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Keyword
          </button>
        </div>

        {/* Messages */}
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

        {/* Form */}
        {showForm && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              {editingKeyword ? 'Edit Keyword' : 'Add New Keyword'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Keyword *
                </label>
                <input
                  type="text"
                  value={formKeyword}
                  onChange={(e) => setFormKeyword(e.target.value.toUpperCase())}
                  placeholder="e.g., FLOW, TRIBE, JOIN"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  People will text this keyword to subscribe
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Auto-Response Message *
                </label>
                <textarea
                  value={formAutoResponse}
                  onChange={(e) => setFormAutoResponse(e.target.value)}
                  placeholder="Welcome message sent when someone texts this keyword..."
                  className="w-full h-24 p-3 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Auto-Add to List (Optional)
                </label>
                <select
                  value={formListId}
                  onChange={(e) => setFormListId(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No list</option>
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Subscribers using this keyword will automatically be added to this list
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Saving...' : editingKeyword ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Keywords List */}
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">
              Keywords ({keywords.length})
            </h2>
          </div>

          {keywords.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              No keywords configured. Add a keyword to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {keywords.map((keyword) => (
                <div
                  key={keyword.id}
                  className="p-4 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xl font-bold text-blue-400">
                          {keyword.keyword}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            keyword.isActive
                              ? 'bg-green-900 text-green-300'
                              : 'bg-gray-600 text-gray-300'
                          }`}
                        >
                          {keyword.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {keyword.list && (
                          <span className="px-2 py-1 text-xs bg-purple-900 text-purple-300 rounded-full">
                            {keyword.list.name}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-300 text-sm mb-2">
                        {keyword.autoResponse}
                      </p>
                      <p className="text-gray-500 text-xs">
                        Created: {new Date(keyword.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(keyword)}
                        className={`px-3 py-1 text-sm rounded transition-colors ${
                          keyword.isActive
                            ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                            : 'bg-green-600 hover:bg-green-500 text-white'
                        }`}
                      >
                        {keyword.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleEdit(keyword)}
                        className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(keyword)}
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
