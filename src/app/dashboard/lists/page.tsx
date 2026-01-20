'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Keyword {
  id: string;
  keyword: string;
}

interface SubscriberList {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  keywords: Keyword[];
  createdAt: string;
}

export default function ListsPage() {
  const [lists, setLists] = useState<SubscriberList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingList, setEditingList] = useState<SubscriberList | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    try {
      const response = await fetch('/api/lists');
      if (response.ok) {
        const data = await response.json();
        setLists(data);
      } else {
        setError('Failed to load lists');
      }
    } catch (err) {
      setError('Failed to load lists');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const url = editingList
        ? `/api/lists/${editingList.id}`
        : '/api/lists';

      const method = editingList ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          description: formDescription || null,
        }),
      });

      if (response.ok) {
        setSuccess(editingList ? 'List updated!' : 'List created!');
        resetForm();
        loadLists();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save list');
      }
    } catch (err) {
      setError('Failed to save list');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (list: SubscriberList) => {
    setEditingList(list);
    setFormName(list.name);
    setFormDescription(list.description || '');
    setShowForm(true);
  };

  const handleDelete = async (list: SubscriberList) => {
    if (!confirm(`Are you sure you want to delete the list "${list.name}"? This will not delete the subscribers.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccess('List deleted!');
        loadLists();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete list');
      }
    } catch (err) {
      setError('Failed to delete list');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingList(null);
    setFormName('');
    setFormDescription('');
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
            <h1 className="text-3xl font-bold text-white">Subscriber Lists</h1>
            <p className="text-gray-300 mt-2">
              Organize subscribers into lists for targeted broadcasts
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create List
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
              {editingList ? 'Edit List' : 'Create New List'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  List Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Flow State Interest, VIP Members"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What is this list for?"
                  className="w-full h-20 p-3 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Saving...' : editingList ? 'Update' : 'Create'}
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

        {/* Lists */}
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">
              Lists ({lists.length})
            </h2>
          </div>

          {lists.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              No lists created. Create a list to organize your subscribers.
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className="p-4 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link
                          href={`/dashboard/lists/${list.id}`}
                          className="text-xl font-bold text-purple-400 hover:text-purple-300"
                        >
                          {list.name}
                        </Link>
                        <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded-full">
                          {list.memberCount} member{list.memberCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {list.description && (
                        <p className="text-gray-300 text-sm mb-2">
                          {list.description}
                        </p>
                      )}
                      {list.keywords.length > 0 && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-gray-500 text-xs">Keywords:</span>
                          {list.keywords.map((k) => (
                            <span
                              key={k.id}
                              className="px-2 py-0.5 text-xs bg-blue-900 text-blue-300 rounded"
                            >
                              {k.keyword}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-gray-500 text-xs">
                        Created: {new Date(list.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Link
                        href={`/dashboard/lists/${list.id}`}
                        className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
                      >
                        View Members
                      </Link>
                      <button
                        onClick={() => handleEdit(list)}
                        className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(list)}
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
