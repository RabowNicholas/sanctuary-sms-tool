'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SubscriberList {
  id: string;
  name: string;
}

interface Subscriber {
  id: string;
  phoneNumber: string;
  isActive: boolean;
  joinedAt: string;
  joinedViaKeyword?: string;
  slackThreadTs?: string;
  _count?: {
    messages: number;
  };
  lists?: SubscriberList[];
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMethod, setImportMethod] = useState<'text' | 'csv'>('text');

  useEffect(() => {
    loadSubscribers();
  }, []);

  const loadSubscribers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/subscribers');
      if (response.ok) {
        const data = await response.json();
        setSubscribers(data);
      } else {
        setError('Failed to load subscribers');
      }
    } catch (err) {
      setError('Failed to load subscribers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (subscriberId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/subscribers/${subscriberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        setSuccess(currentStatus ? 'Subscriber deactivated' : 'Subscriber activated');
        loadSubscribers();
      } else {
        setError('Failed to update subscriber');
      }
    } catch (err) {
      setError('Failed to update subscriber');
    }
  };

  const handleAddSubscriber = async () => {
    if (!newPhoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    try {
      const response = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: newPhoneNumber }),
      });

      if (response.ok) {
        setSuccess('Subscriber added successfully');
        setNewPhoneNumber('');
        setShowAddModal(false);
        loadSubscribers();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add subscriber');
      }
    } catch (err) {
      setError('Failed to add subscriber');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      const phoneNumbers = parseCsvContent(csvContent);
      setImportText(phoneNumbers.join('\n'));
    };
    reader.readAsText(file);
  };

  const parseCsvContent = (csvContent: string): string[] => {
    const lines = csvContent.split('\n');
    const phoneNumbers: string[] = [];
    let headers: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle CSV with headers (detect and store header positions)
      if (i === 0 && (line.toLowerCase().includes('phone') || line.toLowerCase().includes('number'))) {
        headers = line.split(',').map(col => col.trim().replace(/['"]/g, '').toLowerCase());
        continue;
      }

      // Split by comma and handle quoted values properly
      const columns = line.split(',').map(col => col.trim().replace(/^["']|["']$/g, ''));
      
      // Check if this contact is unsubscribed (for TRIBE CSV format)
      if (headers.length > 0) {
        const unsubscribedIndex = headers.findIndex(h => h.includes('unsubscrib'));
        if (unsubscribedIndex >= 0 && columns[unsubscribedIndex] && columns[unsubscribedIndex].trim() !== '') {
          // Skip unsubscribed contacts
          continue;
        }
      }
      
      // Find phone number in the row
      for (const column of columns) {
        // Look for phone number patterns
        if (column.match(/^\+?1?\d{10,12}$/) || column.includes('+1')) {
          let cleanPhone = column.replace(/[^\d+]/g, '');
          
          // Add +1 if it's a 10-digit US number
          if (cleanPhone.length === 10) {
            cleanPhone = '+1' + cleanPhone;
          } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
            cleanPhone = '+' + cleanPhone;
          }
          
          if (cleanPhone.startsWith('+1') && cleanPhone.length === 12) {
            phoneNumbers.push(cleanPhone);
            break; // Found phone number in this row, move to next
          }
        }
      }
    }

    return phoneNumbers;
  };

  const handleBulkImport = async () => {
    if (!importText.trim()) {
      setError('Please enter phone numbers or upload a CSV file');
      return;
    }

    // Parse phone numbers from text (one per line or comma-separated)
    const phoneNumbers = importText
      .split(/[\n,]/)
      .map(phone => phone.trim())
      .filter(phone => phone.length > 0);

    if (phoneNumbers.length === 0) {
      setError('No valid phone numbers found');
      return;
    }

    try {
      const response = await fetch('/api/subscribers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumbers }),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(`Successfully added ${result.added} subscribers. ${result.skipped} duplicates skipped.`);
        setImportText('');
        setShowImportModal(false);
        loadSubscribers();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to import subscribers');
      }
    } catch (err) {
      setError('Failed to import subscribers');
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
    return new Date(dateStr).toLocaleDateString();
  };

  // Filter subscribers based on search and status
  const filteredSubscribers = subscribers.filter(subscriber => {
    const matchesSearch = formatPhoneNumber(subscriber.phoneNumber)
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filter === 'all' ||
      (filter === 'active' && subscriber.isActive) ||
      (filter === 'inactive' && !subscriber.isActive);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Subscriber Management</h1>
              <p className="text-gray-300 mt-2">Manage your SMS subscriber list</p>
            </div>
            <Link
              href="/dashboard"
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-300">Total Subscribers</h3>
            <p className="text-3xl font-bold text-blue-400">{subscribers.length}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-300">Active Subscribers</h3>
            <p className="text-3xl font-bold text-green-400">
              {subscribers.filter(s => s.isActive).length}
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-300">Inactive Subscribers</h3>
            <p className="text-3xl font-bold text-red-400">
              {subscribers.filter(s => !s.isActive).length}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <input
                type="text"
                placeholder="Search by phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Subscribers</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Add Subscriber
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                Bulk Import
              </button>
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded mb-4">
            {error}
            <button onClick={() => setError('')} className="ml-2 font-bold text-red-200 hover:text-white">×</button>
          </div>
        )}
        
        {success && (
          <div className="bg-green-900 border border-green-700 text-green-300 px-4 py-3 rounded mb-4">
            {success}
            <button onClick={() => setSuccess('')} className="ml-2 font-bold text-green-200 hover:text-white">×</button>
          </div>
        )}

        {/* Subscribers Table */}
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-300">Loading subscribers...</div>
          ) : filteredSubscribers.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {searchTerm || filter !== 'all' ? 'No subscribers match your filters' : 'No subscribers yet'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-600">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Phone Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Lists
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Joined Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Messages
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-600">
                  {filteredSubscribers.map((subscriber) => (
                    <tr key={subscriber.id} className="hover:bg-gray-700 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-200">
                          {formatPhoneNumber(subscriber.phoneNumber)}
                        </div>
                        {subscriber.joinedViaKeyword && (
                          <div className="text-xs text-gray-500">
                            via {subscriber.joinedViaKeyword}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            subscriber.isActive
                              ? 'bg-green-600 text-green-100'
                              : 'bg-red-600 text-red-100'
                          }`}
                        >
                          {subscriber.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {subscriber.lists && subscriber.lists.length > 0 ? (
                            subscriber.lists.map((list) => (
                              <Link
                                key={list.id}
                                href={`/dashboard/lists/${list.id}`}
                                className="px-2 py-0.5 text-xs bg-purple-900 text-purple-300 rounded hover:bg-purple-800 transition-colors"
                              >
                                {list.name}
                              </Link>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatDate(subscriber.joinedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {subscriber._count?.messages || 0} messages
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <button
                          onClick={() => handleToggleStatus(subscriber.id, subscriber.isActive)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors duration-200 ${
                            subscriber.isActive
                              ? 'bg-red-600 text-red-100 hover:bg-red-500'
                              : 'bg-green-600 text-green-100 hover:bg-green-500'
                          }`}
                        >
                          {subscriber.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Subscriber Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
              <h3 className="text-lg font-medium text-white mb-4">Add New Subscriber</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+15551234567"
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-400 mt-1">Format: +1XXXXXXXXXX (US numbers only)</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleAddSubscriber}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Add Subscriber
                  </button>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewPhoneNumber('');
                    }}
                    className="flex-1 bg-gray-600 text-gray-200 py-2 px-4 rounded-lg hover:bg-gray-500 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700">
              <h3 className="text-lg font-medium text-white mb-4">Bulk Import Subscribers</h3>
              <div className="space-y-4">
                {/* Import Method Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Import Method
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center text-gray-300">
                      <input
                        type="radio"
                        value="text"
                        checked={importMethod === 'text'}
                        onChange={(e) => setImportMethod(e.target.value as 'text' | 'csv')}
                        className="mr-2 text-blue-500"
                      />
                      Manual Entry
                    </label>
                    <label className="flex items-center text-gray-300">
                      <input
                        type="radio"
                        value="csv"
                        checked={importMethod === 'csv'}
                        onChange={(e) => setImportMethod(e.target.value as 'text' | 'csv')}
                        className="mr-2 text-blue-500"
                      />
                      CSV Upload
                    </label>
                  </div>
                </div>

                {/* CSV Upload Section */}
                {importMethod === 'csv' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Upload CSV File
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-sm text-gray-400 mt-1">
                      CSV should contain phone numbers. Headers are automatically detected and skipped.
                    </p>
                    <div className="mt-2 p-3 bg-gray-700 rounded-md border border-gray-600">
                      <p className="text-sm font-medium text-gray-200">Features:</p>
                      <ul className="text-sm text-gray-300 mt-1">
                        <li>• Automatically skips unsubscribed contacts</li>
                        <li>• Supports quoted phone numbers</li>
                        <li>• Formats: +15551234567, 15551234567, 5551234567</li>
                        <li>• Header detection for any CSV format</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Manual Entry Section */}
                {importMethod === 'text' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Phone Numbers
                    </label>
                    <textarea
                      rows={8}
                      placeholder="+15551234567&#10;+15559876543&#10;+15555555555"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-sm text-gray-400 mt-1">
                      One phone number per line or comma-separated. Format: +1XXXXXXXXXX
                    </p>
                  </div>
                )}

                {/* Preview Section */}
                {importText && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Preview ({importText.split('\n').filter(p => p.trim()).length} numbers)
                    </label>
                    <div className="max-h-32 overflow-y-auto p-2 bg-gray-700 border border-gray-600 rounded-md text-sm">
                      {importText.split('\n').filter(p => p.trim()).slice(0, 10).map((phone, index) => (
                        <div key={index} className="text-gray-200">{phone.trim()}</div>
                      ))}
                      {importText.split('\n').filter(p => p.trim()).length > 10 && (
                        <div className="text-gray-400 italic">
                          ... and {importText.split('\n').filter(p => p.trim()).length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleBulkImport}
                    disabled={!importText.trim()}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    Import Subscribers
                  </button>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportText('');
                      setImportMethod('text');
                    }}
                    className="flex-1 bg-gray-600 text-gray-200 py-2 px-4 rounded-lg hover:bg-gray-500 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}