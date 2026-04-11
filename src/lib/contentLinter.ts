export interface LintWarning {
  rule: string;
  message: string;
}

// Known brand words that should not trigger the ALL_CAPS rule
const CAPS_ALLOWLIST = new Set([
  'SANCTUARY', 'TRIBE', 'RSVP', 'FLOW', 'VIP', 'DM', 'SMS',
  'LA', 'SF', 'NYC', 'DJ', 'ID', 'FAQ', 'OK', 'ASAP',
]);

/**
 * Scans an SMS message body for content patterns known to trigger carrier filtering.
 * Returns an array of warnings — advisory only, does not block sending.
 *
 * Rules are based on observed ~22% carrier block rate (error 30007) on broadcasts
 * containing promotional language.
 */
export function lintMessage(text: string): LintWarning[] {
  if (!text || !text.trim()) return [];

  const warnings: LintWarning[] = [];

  // Rule: "FREE" in any form (FREE EVENT, free rsvp, free entry, etc.)
  if (/\bfree\b/i.test(text)) {
    warnings.push({
      rule: 'FREE',
      message: 'Contains "FREE" — a top carrier filter trigger. Consider "complimentary", "no cost", or "on us" instead.',
    });
  }

  // Rule: More than 2 consecutive exclamation points
  if (/!{3,}/.test(text)) {
    warnings.push({
      rule: 'EXCLAMATION',
      message: 'Contains 3+ consecutive exclamation points — often flagged as spam. Limit to 1–2.',
    });
  }

  // Rule: Any word in ALL CAPS longer than 4 characters, excluding brand words and URL tokens
  // Strip URLs first so we don't flag capitalized URL components (HTTPS, COM, etc.)
  const textWithoutUrls = text.replace(/https?:\/\/[^\s]+/gi, '');
  const capsWords = textWithoutUrls.match(/\b[A-Z]{5,}\b/g) || [];
  const flaggedCapsWords = capsWords.filter(w => !CAPS_ALLOWLIST.has(w));
  if (flaggedCapsWords.length > 0) {
    warnings.push({
      rule: 'ALL_CAPS',
      message: `Contains ALL CAPS word(s) longer than 4 characters (${[...new Set(flaggedCapsWords)].join(', ')}) — a common spam signal.`,
    });
  }

  // Rule: More than one URL in a single message
  const urls = text.match(/https?:\/\/[^\s]+/g);
  if (urls && urls.length > 1) {
    warnings.push({
      rule: 'MULTIPLE_URLS',
      message: `Contains ${urls.length} URLs — messages with multiple links have higher block rates. Limit to 1.`,
    });
  }

  return warnings;
}
