'use client';

import { useEffect, useRef, useState } from 'react';

type Step = 'phone' | 'code' | 'done';

const RESEND_COOLDOWN_S = 30;

function formatAsTyped(value: string): string {
  const d = value.replace(/\D/g, '').replace(/^1(?=\d{10})/, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// HIG notes applied throughout:
// - 44pt+ touch targets (buttons/inputs are 56px tall, text links get padded hit areas)
// - 17px+ text in inputs so iOS Safari never zooms on focus
// - real labels (visually hidden) instead of placeholder-only fields
// - one primary action per screen, clear disabled/loading states
// - status changes announced to VoiceOver via aria-live
// - motion is subtle and disabled under prefers-reduced-motion

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-5 w-5 rounded-full border-2 border-black/20 border-t-black animate-spin motion-reduce:animate-none"
    />
  );
}

const display = '[font-family:var(--font-syne)] font-bold tracking-tight text-white';
const headline = `${display} text-[34px] leading-[1.1]`; // HIG Large Title (34pt)
const body = 'text-[17px] leading-relaxed text-white/70 font-light'; // HIG Body (17pt)
const field =
  'w-full h-14 rounded-xl bg-white/[0.06] border border-white/15 px-4 text-[19px] text-white text-center ' +
  'placeholder:text-white/30 outline-none transition-colors motion-reduce:transition-none ' +
  'focus:border-white/70 focus:bg-white/[0.09] aria-[invalid=true]:border-red-400/80';
const primary =
  'w-full h-14 rounded-xl bg-white text-black text-[17px] font-semibold flex items-center justify-center gap-2 ' +
  'transition-[opacity,transform] motion-reduce:transition-none active:scale-[0.98] active:opacity-80 ' +
  'disabled:bg-white/15 disabled:text-white/40 disabled:active:scale-100 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';
const textButton =
  'min-h-11 px-3 -mx-3 text-[15px] text-white/60 underline-offset-4 hover:text-white active:text-white ' +
  'disabled:text-white/25 disabled:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded-md';

export default function JoinForm({ keyword }: { keyword: string }) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [alreadyIn, setAlreadyIn] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const verifying = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function post(path: string, payload: object) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const { ok, data } = await post('/api/join/send-code', { phone, keyword, website });
      if (!ok) return setError(data.error || "couldn't send the code");
      setCode('');
      if (step === 'code') setNotice('new code sent');
      setCooldown(RESEND_COOLDOWN_S);
      setStep('code');
    } catch {
      setError('no connection try again');
    } finally {
      setLoading(false);
    }
  }

  async function verify(value: string) {
    if (verifying.current || value.length !== 6) return;
    verifying.current = true;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const { ok, data } = await post('/api/join/verify', { phone, keyword, code: value });
      if (!ok) {
        setError(data.error || "that code didn't work");
        setCode('');
        return;
      }
      setAlreadyIn(data.status === 'already_subscribed');
      setStep('done');
    } catch {
      setError('no connection try again');
    } finally {
      setLoading(false);
      verifying.current = false;
    }
  }

  function onCodeChange(raw: string) {
    const next = raw.replace(/\D/g, '').slice(0, 6);
    setCode(next);
    if (error) setError(null);
    // iOS autofills the whole code from Messages; submit as soon as it's complete
    if (next.length === 6) verify(next);
  }

  function changeNumber() {
    setStep('phone');
    setCode('');
    setError(null);
    setNotice(null);
  }

  const status = (
    <div aria-live="polite" className="min-h-6 mt-4 text-[15px]">
      {error && <p className="text-red-400">{error}</p>}
      {!error && notice && <p className="text-white/60">{notice}</p>}
    </div>
  );

  if (step === 'done') {
    return (
      <section className="animate-[fadeUp_.35s_ease-out] motion-reduce:animate-none">
        <div
          aria-hidden="true"
          className="mx-auto mb-6 h-16 w-16 rounded-full bg-white text-black flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h1 className={headline} tabIndex={-1} autoFocus>
          {alreadyIn ? "you're already in" : "you're in"}
        </h1>
        <p className={`${body} mt-3`}>
          check your texts
          <br />
          we&apos;ll hit you when something drops
        </p>
      </section>
    );
  }

  if (step === 'code') {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); verify(code); }}
        className="animate-[fadeUp_.35s_ease-out] motion-reduce:animate-none"
        noValidate
      >
        <h1 className={headline}>check your texts</h1>
        <p className={`${body} mt-3 mb-8`}>
          enter the 6 digit code sent to
          <br />
          <span className="text-white font-normal">{phone}</span>
        </p>

        <label htmlFor="code" className="sr-only">6 digit code</label>
        <input
          id="code"
          className={`${field} [font-family:var(--font-jetbrains)] tracking-[0.6em] indent-[0.6em] text-[24px]`}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby="code-status"
          autoFocus
          disabled={loading}
        />

        <button type="submit" className={`${primary} mt-4`} disabled={loading || code.length !== 6}>
          {loading ? <><Spinner /><span className="sr-only">checking</span></> : 'confirm'}
        </button>

        <div id="code-status">{status}</div>

        <div className="mt-2 flex items-center justify-center gap-8">
          <button type="button" onClick={() => sendCode()} disabled={loading || cooldown > 0} className={textButton}>
            {cooldown > 0 ? `resend in ${cooldown}s` : 'resend code'}
          </button>
          <button type="button" onClick={changeNumber} disabled={loading} className={textButton}>
            change number
          </button>
        </div>
      </form>
    );
  }

  const digits = phone.replace(/\D/g, '');
  return (
    <form onSubmit={sendCode} className="animate-[fadeUp_.35s_ease-out] motion-reduce:animate-none" noValidate>
      <h1 className={headline}>get the texts</h1>
      <p className={`${body} mt-3 mb-8`}>event drops and early access</p>

      <label htmlFor="phone" className="sr-only">phone number</label>
      <input
        id="phone"
        className={field}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(555) 555-5555"
        value={phone}
        onChange={(e) => { setPhone(formatAsTyped(e.target.value)); if (error) setError(null); }}
        aria-invalid={!!error}
        aria-describedby="phone-status consent"
        autoFocus
      />
      {/* Honeypot: hidden from people and assistive tech, bots fill it in */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0 pointer-events-none">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <button type="submit" className={`${primary} mt-4`} disabled={loading || digits.length !== 10}>
        {loading ? <><Spinner /><span className="sr-only">sending</span></> : 'send code'}
      </button>

      <div id="phone-status">{status}</div>

      <p id="consent" className="mt-4 text-[12px] leading-[1.5] text-white/55">
        By entering your number you agree to receive recurring automated texts from Flow State
        Collective. Consent is not a condition of purchase. Msg frequency varies. Msg &amp; data
        rates may apply. Reply STOP to opt out, HELP for help.
      </p>
    </form>
  );
}
