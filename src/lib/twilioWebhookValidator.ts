/**
 * Twilio webhook signature validation.
 *
 * Twilio signs every webhook request with an HMAC-SHA1 of:
 *   authToken + fullRequestURL + sorted POST params (concatenated key+value pairs)
 *
 * The signature is sent in the X-Twilio-Signature header.
 *
 * In production (Vercel), NEXTAUTH_URL or VERCEL_PROJECT_PRODUCTION_URL must be
 * set to the canonical public URL so the full webhook URL can be reconstructed.
 */

import { NextRequest } from 'next/server';

function getBaseUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  return 'http://localhost:3000';
}

/**
 * Validates the X-Twilio-Signature header against the request body.
 *
 * @returns true if valid (or if running locally / no auth token configured)
 * @returns false if the signature is present but invalid
 */
export async function validateTwilioWebhook(
  request: NextRequest,
  formData: FormData,
  webhookPath: string
): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // Skip validation in local dev or test mode
  if (!authToken || authToken === 'test_token' || authToken.startsWith('test')) {
    return true;
  }

  const twilioSignature = request.headers.get('x-twilio-signature');
  if (!twilioSignature) {
    console.warn('⚠️  Twilio webhook received with no X-Twilio-Signature header');
    return false;
  }

  const fullUrl = `${getBaseUrl()}${webhookPath}`;

  // Build sorted params object from form data
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value as string;
  });

  try {
    // Dynamically require twilio to match the pattern used in TwilioSMSService
    const twilio = require('twilio');
    const isValid = twilio.validateRequest(authToken, twilioSignature, fullUrl, params);
    if (!isValid) {
      console.error('❌ Twilio webhook signature validation failed', { url: fullUrl });
    }
    return isValid;
  } catch (err) {
    console.error('Twilio signature validation error:', err);
    // Fail closed — if we can't validate, reject the request
    return false;
  }
}
