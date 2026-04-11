'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type SuppressionReason = 'OPTED_OUT' | 'UNREACHABLE' | 'NONEXISTENT';

interface SuppressionEntry {
  id: string;
  phoneNumber: string;
  reason: SuppressionReason;
  addedAt: string;
}

interface SuppressionCounts {
  total: number;
  optedOut: number;
  unreachable: number;
  nonexistent: number;
}

interface ViolationRecord {
  phoneNumber: string;
  firstOptOut: string;
  messagesAfter: number;
  dates: string[];
}

const REASON_LABELS: Record<SuppressionReason, string> = {
  OPTED_OUT: 'Opted Out',
  UNREACHABLE: 'Unreachable',
  NONEXISTENT: 'Nonexistent',
};

const REASON_COLORS: Record<SuppressionReason, string> = {
  OPTED_OUT: 'bg-red-900 text-red-300',
  UNREACHABLE: 'bg-yellow-900 text-yellow-300',
  NONEXISTENT: 'bg-gray-700 text-gray-300',
};

export default function SuppressionPage() {
  const [entries, setEntries] = useState<SuppressionEntry[]>([]);
  const [counts, setCounts] = useState<SuppressionCounts>({ total: 0, optedOut: 0, unreachable: 0, nonexistent: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reasonFilter, setReasonFilter] = useState<SuppressionReason | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importDefaultReason, setImportDefaultReason] = useState<SuppressionReason>('OPTED_OUT');
  const [isImporting, setIsImporting] = useState(false);

  // Violations tab state
  const [activeTab, setActiveTab] = useState<'list' | 'violations'>('list');
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [isLoadingViolations, setIsLoadingViolations] = useState(false);
  const [isFixingViolations, setIsFixingViolations] = useState(false);
  const [violationsFixed, setViolationsFixed] = useState<number | null>(null);

  useEffect(() => {
    loadSuppressionList();
  }, [reasonFilter]);

  const loadSuppressionList = async () => {
    setIsLoading(true);
    try {
      const url = reasonFilter
        ? `/api/suppression?reason=${reasonFilter}`
        : '/api/suppression';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries);
        setCounts(data.counts);
      } else {
        setError('Failed to load suppression list');
      }
    } catch {
      setError('Failed to load suppression list');
    } finally {
      setIsLoading(false);
    }
  };

  const loadViolations = async () => {
    setIsLoadingViolations(true);
    try {
      const response = await fetch('/api/admin/opt-out-violations');
      if (response.ok) {
        const data = await response.json();
        setViolations(data.violations);
      } else {
        setError('Failed to load violation report');
      }
    } catch {
      setError('Failed to load violation report');
    } finally {
      setIsLoadingViolations(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'violations' && violations.length === 0) {
      loadViolations();
    }
  }, [activeTab]);

  const handleRemove = async (id: string, phoneNumber: string) => {
    if (!confirm(`Remove ${formatPhoneNumber(phoneNumber)} from suppression list?`)) return;
    try {
      const response = await fetch(`/api/suppression/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setSuccess(`Removed ${formatPhoneNumber(phoneNumber)} from suppression list`);
        loadSuppressionList();
      } else {
        setError('Failed to remove entry');
      }
    } catch {
      setError('Failed to remove entry');
    }
  };

  const handleExportCSV = () => {
    window.location.href = '/api/suppression/export';
  };

  const parseCsvImport = (text: string): Array<{ phoneNumber: string; reason: SuppressionReason }> => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const results: Array<{ phoneNumber: string; reason: SuppressionReason }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header row
      if (i === 0 && (line.toLowerCase().includes('phone') || line.toLowerCase().includes('reason'))) {
        continue;
      }
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      const phone = parts[0];
      const rawReason = parts[1]?.toUpperCase();
      const reason = (['OPTED_OUT', 'UNREACHABLE', 'NONEXISTENT'] as SuppressionReason[]).includes(rawReason as SuppressionReason)
        ? (rawReason as SuppressionReason)
        : importDefaultReason;

      if (phone) {
        results.push({ phoneNumber: phone, reason });
      }
    }
    return results;
  };

  const handleBulkImport = async () => {
    if (!importText.trim()) {
      setError('Please enter phone numbers or a CSV');
      return;
    }

    const entries = parseCsvImport(importText);
    if (entries.length === 0) {
      setError('No valid entries found');
      return;
    }

    setIsImporting(true);
    try {
      const response = await fetch('/api/suppression/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const result = await response.json();
      if (response.ok) {
        setSuccess(`Imported ${result.added} entries. ${result.skipped} already existed.${result.errors.length > 0 ? ` ${result.errors.length} errors.` : ''}`);
        setShowImportModal(false);
        setImportText('');
        loadSuppressionList();
      } else {
        setError(result.error || 'Import failed');
      }
    } catch {
      setError('Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFixAllViolations = async () => {
    if (!confirm(`Add all ${violations.length} violating numbers to the suppression list as Opted Out?`)) return;
    setIsFixingViolations(true);
    try {
      const response = await fetch('/api/admin/opt-out-violations', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setViolationsFixed(data.added);
        setSuccess(`Added ${data.added} numbers to suppression list as Opted Out`);
        loadSuppressionList();
        loadViolations();
      } else {
        setError(data.error || 'Failed to fix violations');
      }
    } catch {
      setError('Failed to fix violations');
    } finally {
      setIsFixingViolations(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (phone.startsWith('+1') && phone.length === 12) {
      const d = phone.substring(2);
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    return phone;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const filteredEntries = entries.filter(e =>
    formatPhoneNumber(e.phoneNumber).includes(searchTerm) || e.phoneNumber.includes(searchTerm)
  );

  const previewEntries = parseCsvImport(importText);

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Suppression List</h1>
            <p className="text-gray-300 mt-2">Numbers excluded from all outbound messages</p>
          </div>
          <Link href="/dashboard" className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors">
            ← Back to Dashboard
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
            <p className="text-gray-400 text-sm">Total Suppressed</p>
            <p className="text-3xl font-bold text-white mt-1">{counts.total}</p>
          </div>
          <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
            <p className="text-gray-400 text-sm">Opted Out</p>
            <p className="text-3xl font-bold text-red-400 mt-1">{counts.optedOut}</p>
          </div>
          <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
            <p className="text-gray-400 text-sm">Unreachable</p>
            <p className="text-3xl font-bold text-yellow-400 mt-1">{counts.unreachable}</p>
          </div>
          <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
            <p className="text-gray-400 text-sm">Nonexistent</p>
            <p className="text-3xl font-bold text-gray-400 mt-1">{counts.nonexistent}</p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded mb-4">
            {error}
            <button onClick={() => setError('')} className="ml-2 font-bold">×</button>
          </div>
        )}
        {success && (
          <div className="bg-green-900 border border-green-700 text-green-300 px-4 py-3 rounded mb-4">
            {success}
            <button onClick={() => setSuccess('')} className="ml-2 font-bold">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'list' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}
          >
            Suppression List
          </button>
          <button
            onClick={() => setActiveTab('violations')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'violations' ? 'text-white border-b-2 border-red-500' : 'text-gray-400 hover:text-white'}`}
          >
            Opt-Out Violations
          </button>
        </div>

        {/* ─── Suppression List Tab ─── */}
        {activeTab === 'list' && (
          <>
            {/* Controls */}
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6 flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="Search by phone number..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <select
                value={reasonFilter}
                onChange={e => setReasonFilter(e.target.value as SuppressionReason | '')}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Reasons</option>
                <option value="OPTED_OUT">Opted Out</option>
                <option value="UNREACHABLE">Unreachable</option>
                <option value="NONEXISTENT">Nonexistent</option>
              </select>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Bulk Import
                </button>
                <button
                  onClick={handleExportCSV}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              {isLoading ? (
                <div className="p-8 text-center text-gray-400">Loading...</div>
              ) : filteredEntries.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  {counts.total === 0 ? 'No suppressed numbers yet.' : 'No entries match your filters.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-750">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Phone Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Reason</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date Added</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {filteredEntries.map(entry => (
                        <tr key={entry.id} className="hover:bg-gray-750 transition-colors">
                          <td className="px-6 py-3 text-sm text-gray-200 font-mono">{formatPhoneNumber(entry.phoneNumber)}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${REASON_COLORS[entry.reason]}`}>
                              {REASON_LABELS[entry.reason]}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-400">{formatDate(entry.addedAt)}</td>
                          <td className="px-6 py-3">
                            <button
                              onClick={() => handleRemove(entry.id, entry.phoneNumber)}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <p className="text-gray-500 text-xs mt-2">{filteredEntries.length} entries shown</p>
          </>
        )}

        {/* ─── Violations Tab ─── */}
        {activeTab === 'violations' && (
          <div>
            <div className="bg-gray-800 p-4 rounded-lg border border-yellow-800 mb-6">
              <p className="text-yellow-300 text-sm font-medium">
                These contacts sent a STOP/opt-out reply (error 21610) but were messaged again afterward. Fix by adding all to the suppression list.
              </p>
            </div>

            {isLoadingViolations ? (
              <div className="p-8 text-center text-gray-400">Loading violations...</div>
            ) : violations.length === 0 ? (
              <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 text-center text-gray-400">
                No opt-out violations found.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-300">
                    <span className="text-red-400 font-bold">{violations.length}</span> contacts were messaged after opting out
                    {' '}(<span className="text-red-400 font-bold">{violations.reduce((s, v) => s + v.messagesAfter, 0)}</span> total violations)
                  </p>
                  <button
                    onClick={handleFixAllViolations}
                    disabled={isFixingViolations || violationsFixed !== null}
                    className="bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-red-800 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {isFixingViolations ? 'Fixing...' : violationsFixed !== null ? `Fixed (${violationsFixed} added)` : 'Fix All: Add to Suppression List'}
                  </button>
                </div>

                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                      <thead className="bg-gray-750">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Phone Number</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">First Opt-Out</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Messages After</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Violation Dates</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {violations.map((v, i) => (
                          <tr key={i} className="hover:bg-gray-750 transition-colors">
                            <td className="px-6 py-3 text-sm text-gray-200 font-mono">{formatPhoneNumber(v.phoneNumber)}</td>
                            <td className="px-6 py-3 text-sm text-red-400">{formatDate(v.firstOptOut)}</td>
                            <td className="px-6 py-3">
                              <span className="bg-red-900 text-red-300 px-2 py-1 rounded text-xs font-bold">
                                {v.messagesAfter}×
                              </span>
                            </td>
                            <td className="px-6 py-3 text-xs text-gray-400">
                              {v.dates.slice(0, 5).map(d => formatDate(d)).join(', ')}
                              {v.dates.length > 5 && ` +${v.dates.length - 5} more`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-4">Bulk Import Suppression List</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Default Reason (used when CSV has no reason column)
                </label>
                <select
                  value={importDefaultReason}
                  onChange={e => setImportDefaultReason(e.target.value as SuppressionReason)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                >
                  <option value="OPTED_OUT">Opted Out</option>
                  <option value="UNREACHABLE">Unreachable</option>
                  <option value="NONEXISTENT">Nonexistent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  CSV or phone numbers (one per line)
                </label>
                <textarea
                  rows={8}
                  placeholder={`phone_number,reason\n+15551234567,OPTED_OUT\n+15559876543,UNREACHABLE\n\nOr just phone numbers:\n+15551234567\n+15559876543`}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm font-mono focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  CSV columns: <code className="bg-gray-700 px-1 rounded">phone_number,reason</code>. Reason is optional — defaults to selection above.
                </p>
              </div>

              {importText.trim() && (
                <div className="bg-gray-700 p-3 rounded-lg text-sm">
                  <span className="text-gray-300">Preview: </span>
                  <span className="text-white font-medium">{previewEntries.length} entries</span>
                  {previewEntries.length > 0 && (
                    <div className="mt-1 text-xs text-gray-400">
                      {previewEntries.slice(0, 3).map((e, i) => (
                        <div key={i}>{formatPhoneNumber(e.phoneNumber)} — {REASON_LABELS[e.reason]}</div>
                      ))}
                      {previewEntries.length > 3 && <div>... and {previewEntries.length - 3} more</div>}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleBulkImport}
                  disabled={isImporting || previewEntries.length === 0}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isImporting ? 'Importing...' : `Import ${previewEntries.length} Entries`}
                </button>
                <button
                  onClick={() => { setShowImportModal(false); setImportText(''); }}
                  className="flex-1 bg-gray-600 text-gray-200 py-2 px-4 rounded-lg hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
