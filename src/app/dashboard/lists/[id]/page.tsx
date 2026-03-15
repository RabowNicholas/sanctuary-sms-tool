'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface Member {
  subscriberId: string;
  phoneNumber: string;
  formattedPhoneNumber: string;
  isActive: boolean;
  subscriberJoinedAt: string;
  joinedViaKeyword: string | null;
  listJoinedAt: string;
  listJoinedVia: string | null;
  archivedAt: string | null;
}

interface ListDetails {
  listId: string;
  listName: string;
  memberCount: number;
  members: Member[];
}

interface Subscriber {
  id: string;
  phoneNumber: string;
  isActive: boolean;
}

interface ColdContact {
  subscriberId: string;
  phoneNumber: string;
  joinedAt: string;
  lastEngagedAt: string | null;
}

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [listDetails, setListDetails] = useState<ListDetails | null>(null);
  const [allSubscribers, setAllSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add member modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  // Archived contacts state
  const [showArchived, setShowArchived] = useState(false);
  const [archivedMembers, setArchivedMembers] = useState<Member[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);

  // Clean List modal state
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleanSinceDate, setCleanSinceDate] = useState('');
  const [coldContacts, setColdContacts] = useState<ColdContact[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [previewDone, setPreviewDone] = useState(false);

  useEffect(() => {
    loadListDetails();
    loadAllSubscribers();
  }, [id]);

  const loadListDetails = async () => {
    try {
      const response = await fetch(`/api/lists/${id}/members`);
      if (response.ok) {
        const data = await response.json();
        setListDetails(data);
        // Check how many archived members exist
        checkArchivedCount();
      } else if (response.status === 404) {
        setError('List not found');
      } else {
        setError('Failed to load list details');
      }
    } catch (err) {
      setError('Failed to load list details');
    } finally {
      setIsLoading(false);
    }
  };

  const checkArchivedCount = async () => {
    try {
      const res = await fetch(`/api/lists/${id}/members?includeArchived=true`);
      if (res.ok) {
        const data = await res.json();
        const archived = data.members.filter((m: Member) => m.archivedAt !== null);
        setArchivedCount(archived.length);
      }
    } catch {
      // Non-critical
    }
  };

  const loadAllSubscribers = async () => {
    try {
      const response = await fetch('/api/subscribers');
      if (response.ok) {
        const data = await response.json();
        setAllSubscribers(data);
      }
    } catch (err) {
      console.error('Failed to load subscribers:', err);
    }
  };

  const handleAddMembers = async () => {
    if (selectedSubscriberIds.size === 0) {
      setError('Please select at least one subscriber');
      return;
    }

    setIsAdding(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/lists/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriberIds: Array.from(selectedSubscriberIds),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message);
        setShowAddModal(false);
        setSelectedSubscriberIds(new Set());
        loadListDetails();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add members');
      }
    } catch (err) {
      setError('Failed to add members');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (subscriberId: string, phoneNumber: string) => {
    if (!confirm(`Remove ${phoneNumber} from this list?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/lists/${id}/members?subscriberId=${subscriberId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccess('Member removed');
        loadListDetails();
      } else {
        setError('Failed to remove member');
      }
    } catch (err) {
      setError('Failed to remove member');
    }
  };

  const toggleSubscriberSelection = (subscriberId: string) => {
    setSelectedSubscriberIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subscriberId)) {
        newSet.delete(subscriberId);
      } else {
        newSet.add(subscriberId);
      }
      return newSet;
    });
  };

  const handlePreviewColdContacts = async () => {
    if (!cleanSinceDate) return;
    setIsPreviewing(true);
    setColdContacts([]);
    setPreviewDone(false);

    try {
      const res = await fetch(`/api/lists/${id}/cold-contacts?since=${cleanSinceDate}`);
      if (res.ok) {
        const data = await res.json();
        setColdContacts(data.contacts);
        setPreviewDone(true);
      } else {
        setError('Failed to load cold contacts');
      }
    } catch {
      setError('Failed to load cold contacts');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleArchiveColdContacts = async () => {
    if (coldContacts.length === 0) return;
    setIsArchiving(true);

    try {
      const res = await fetch(`/api/lists/${id}/archive-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriberIds: coldContacts.map(c => c.subscriberId) }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(`Archived ${data.updated} contact${data.updated !== 1 ? 's' : ''}`);
        setShowCleanModal(false);
        setColdContacts([]);
        setCleanSinceDate('');
        setPreviewDone(false);
        loadListDetails();
      } else {
        setError('Failed to archive contacts');
      }
    } catch {
      setError('Failed to archive contacts');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleShowArchived = async () => {
    if (showArchived) {
      setShowArchived(false);
      return;
    }
    setIsLoadingArchived(true);
    try {
      const res = await fetch(`/api/lists/${id}/members?includeArchived=true`);
      if (res.ok) {
        const data = await res.json();
        setArchivedMembers(data.members.filter((m: Member) => m.archivedAt !== null));
        setShowArchived(true);
      }
    } catch {
      setError('Failed to load archived contacts');
    } finally {
      setIsLoadingArchived(false);
    }
  };

  const handleRestoreMember = async (subscriberId: string, phoneNumber: string) => {
    try {
      const res = await fetch(`/api/lists/${id}/archive-members/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriberIds: [subscriberId] }),
      });

      if (res.ok) {
        setSuccess(`Restored ${phoneNumber}`);
        // Reload archived and active lists
        handleShowArchived();
        loadListDetails();
      } else {
        setError('Failed to restore contact');
      }
    } catch {
      setError('Failed to restore contact');
    }
  };

  // Get subscribers not already in the list
  const availableSubscribers = allSubscribers.filter(
    (s) => !listDetails?.members.some((m) => m.subscriberId === s.id)
  );

  const formatPhoneNumber = (phone: string) => {
    if (phone.startsWith('+1') && phone.length === 12) {
      const cleaned = phone.substring(2);
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
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

  if (!listDetails) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-red-400">{error || 'List not found'}</div>
          <Link href="/dashboard/lists" className="text-blue-400 hover:underline mt-4 block">
            Back to Lists
          </Link>
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
            <Link
              href="/dashboard/lists"
              className="text-gray-400 hover:text-white text-sm mb-2 inline-block"
            >
              &larr; Back to Lists
            </Link>
            <h1 className="text-3xl font-bold text-white">{listDetails.listName}</h1>
            <p className="text-gray-300 mt-2">
              {listDetails.memberCount} member{listDetails.memberCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowCleanModal(true);
                setColdContacts([]);
                setCleanSinceDate('');
                setPreviewDone(false);
              }}
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors text-sm"
            >
              Clean List
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Members
            </button>
          </div>
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

        {/* Members List */}
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Members</h2>
          </div>

          {listDetails.members.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              No members in this list yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {listDetails.members.map((member) => (
                <div
                  key={member.subscriberId}
                  className="p-4 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium">
                          {member.formattedPhoneNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            member.isActive
                              ? 'bg-green-900 text-green-300'
                              : 'bg-gray-600 text-gray-300'
                          }`}
                        >
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {member.listJoinedVia && (
                          <span className="px-2 py-0.5 text-xs bg-blue-900 text-blue-300 rounded">
                            {member.listJoinedVia}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        Added to list: {new Date(member.listJoinedAt).toLocaleDateString()}
                        {member.joinedViaKeyword && ` | Subscribed via: ${member.joinedViaKeyword}`}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleRemoveMember(member.subscriberId, member.formattedPhoneNumber)
                      }
                      className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Archived Contacts */}
        {archivedCount > 0 && (
          <div className="mt-4">
            <button
              onClick={handleShowArchived}
              className="text-gray-400 hover:text-gray-300 text-sm underline"
            >
              {isLoadingArchived
                ? 'Loading...'
                : showArchived
                ? `Hide archived contacts`
                : `Show ${archivedCount} archived contact${archivedCount !== 1 ? 's' : ''}`}
            </button>

            {showArchived && archivedMembers.length > 0 && (
              <div className="mt-3 bg-gray-800 rounded-lg border border-gray-700 opacity-75">
                <div className="px-6 py-3 border-b border-gray-700">
                  <h3 className="text-sm font-medium text-gray-400">Archived Contacts</h3>
                </div>
                <div className="divide-y divide-gray-700">
                  {archivedMembers.map((member) => (
                    <div key={member.subscriberId} className="p-4 flex items-center justify-between">
                      <div>
                        <span className="text-gray-400 font-medium text-sm">
                          {member.formattedPhoneNumber}
                        </span>
                        <p className="text-gray-600 text-xs mt-0.5">
                          Archived {member.archivedAt ? new Date(member.archivedAt).toLocaleDateString() : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestoreMember(member.subscriberId, member.formattedPhoneNumber)}
                        className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add Member Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-lg max-h-[80vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">Add Members</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Select subscribers to add to this list
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {availableSubscribers.length === 0 ? (
                  <p className="text-gray-400 text-center">
                    All subscribers are already in this list
                  </p>
                ) : (
                  <div className="space-y-2">
                    {availableSubscribers.map((subscriber) => (
                      <label
                        key={subscriber.id}
                        className="flex items-center gap-3 p-3 bg-gray-700 rounded hover:bg-gray-600 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSubscriberIds.has(subscriber.id)}
                          onChange={() => toggleSubscriberSelection(subscriber.id)}
                          className="h-4 w-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-white">
                          {formatPhoneNumber(subscriber.phoneNumber)}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            subscriber.isActive
                              ? 'bg-green-900 text-green-300'
                              : 'bg-gray-600 text-gray-300'
                          }`}
                        >
                          {subscriber.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-700 flex justify-between items-center">
                <span className="text-gray-400 text-sm">
                  {selectedSubscriberIds.size} selected
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setSelectedSubscriberIds(new Set());
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddMembers}
                    disabled={isAdding || selectedSubscriberIds.size === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAdding ? 'Adding...' : 'Add Selected'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clean List Modal */}
        {showCleanModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-2xl max-h-[85vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">Clean List</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Find and archive contacts with no engagement since a given date
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-end gap-3 mb-6">
                  <div className="flex-1">
                    <label className="block text-gray-400 text-sm mb-1">
                      Show contacts with no engagement since:
                    </label>
                    <input
                      type="date"
                      value={cleanSinceDate}
                      onChange={e => {
                        setCleanSinceDate(e.target.value);
                        setPreviewDone(false);
                        setColdContacts([]);
                      }}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={handlePreviewColdContacts}
                    disabled={!cleanSinceDate || isPreviewing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {isPreviewing ? 'Loading...' : 'Preview'}
                  </button>
                </div>

                {previewDone && (
                  <div>
                    {coldContacts.length === 0 ? (
                      <p className="text-gray-400 text-center py-4">
                        No cold contacts found for this date range.
                      </p>
                    ) : (
                      <>
                        <p className="text-gray-300 text-sm mb-3">
                          {coldContacts.length} contact{coldContacts.length !== 1 ? 's' : ''} with no engagement since {cleanSinceDate}:
                        </p>
                        <div className="bg-gray-750 rounded border border-gray-600 divide-y divide-gray-600 max-h-64 overflow-y-auto">
                          <div className="grid grid-cols-3 px-4 py-2 text-xs text-gray-500 font-medium sticky top-0 bg-gray-700">
                            <span>Phone</span>
                            <span>Joined List</span>
                            <span>Last Engaged</span>
                          </div>
                          {coldContacts.map(contact => (
                            <div key={contact.subscriberId} className="grid grid-cols-3 px-4 py-2 text-sm">
                              <span className="text-white">{formatPhoneNumber(contact.phoneNumber)}</span>
                              <span className="text-gray-400">{new Date(contact.joinedAt).toLocaleDateString()}</span>
                              <span className="text-gray-500">
                                {contact.lastEngagedAt ? new Date(contact.lastEngagedAt).toLocaleDateString() : 'Never'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-700 flex justify-between items-center">
                <span className="text-gray-400 text-sm">
                  {previewDone ? `${coldContacts.length} contact${coldContacts.length !== 1 ? 's' : ''} to archive` : ''}
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowCleanModal(false);
                      setColdContacts([]);
                      setCleanSinceDate('');
                      setPreviewDone(false);
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleArchiveColdContacts}
                    disabled={!previewDone || coldContacts.length === 0 || isArchiving}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    {isArchiving ? 'Archiving...' : `Archive ${previewDone ? coldContacts.length : ''} contacts`}
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
