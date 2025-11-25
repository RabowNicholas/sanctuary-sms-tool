'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CostCalculator } from '@/infrastructure/cost/CostCalculator';

export default function SettingsPage() {
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [originalMessage, setOriginalMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const costCalculator = new CostCalculator();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/settings');

      if (response.ok) {
        const data = await response.json();
        setWelcomeMessage(data.welcomeMessage);
        setOriginalMessage(data.welcomeMessage);
      } else {
        setError('Failed to load settings');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!welcomeMessage.trim()) {
      setError('Welcome message cannot be empty');
      return;
    }

    if (welcomeMessage.length > 320) {
      setError('Welcome message is too long (max 320 characters)');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ welcomeMessage: welcomeMessage.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setOriginalMessage(data.welcomeMessage);
        setSuccess('Settings saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const segments = costCalculator.calculateSegments(welcomeMessage);
  const costPerSubscriber = segments * 0.01164; // Total cost per segment
  const hasChanges = welcomeMessage !== originalMessage;

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Settings</h1>
              <p className="text-gray-300 mt-2">Configure your SMS messaging</p>
            </div>
            <Link
              href="/dashboard"
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-gray-800 p-12 rounded-lg shadow-lg border border-gray-700 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-400">Loading settings...</p>
          </div>
        )}

        {/* Settings Form */}
        {!isLoading && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <div className="space-y-6">
              {/* Welcome Message */}
              <div>
                <label htmlFor="welcomeMessage" className="block text-lg font-semibold text-white mb-2">
                  Welcome Message
                </label>
                <p className="text-sm text-gray-400 mb-3">
                  This message is sent to new subscribers when they text <span className="font-mono text-blue-400">TRIBE</span> to join your list.
                </p>
                <textarea
                  id="welcomeMessage"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  placeholder="Welcome to SANCTUARY!"
                />

                {/* Character Count and Stats */}
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className={`font-medium ${welcomeMessage.length > 320 ? 'text-red-400' : 'text-gray-400'}`}>
                      {welcomeMessage.length}/320 characters
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-blue-400">
                      {segments} segment{segments !== 1 ? 's' : ''}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-green-400">
                      ${costPerSubscriber.toFixed(4)} per subscriber
                    </span>
                  </div>
                </div>

                {/* Info Box */}
                <div className="mt-4 p-4 bg-gray-700 rounded border border-gray-600">
                  <p className="text-sm text-gray-300">
                    💡 <span className="font-semibold">Tip:</span> Keep your message under 160 characters to fit in 1 SMS segment and minimize costs.
                    Each segment costs $0.01164 per subscriber.
                  </p>
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

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges || !welcomeMessage.trim()}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
              </button>

              {/* Compliance Note */}
              <div className="mt-6 p-4 bg-gray-750 rounded border border-gray-600">
                <p className="text-xs text-gray-400">
                  <span className="font-semibold">Note:</span> STOP and UNSUBSCRIBE keywords are fixed for SMS compliance and cannot be changed.
                  The opt-in keyword TRIBE is currently fixed but may be made editable in the future.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
