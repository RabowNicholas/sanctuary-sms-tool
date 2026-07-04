"use client";

import { useState } from "react";

/**
 * Email capture — STUB.
 *
 * UI + capture logic are real, but there is no ESP wired up yet. On submit it
 * POSTs to NEXT_PUBLIC_ESP_ENDPOINT if set; otherwise it just shows the success
 * state so the funnel is testable.
 *
 * TODO(handback): set NEXT_PUBLIC_ESP_ENDPOINT and confirm the POST body shape
 * matches your ESP (ConvertKit / Beehiiv / Mailchimp), then remove this note.
 */
export function EmailOptin({
  magnet,
  cta = "Get it",
}: {
  magnet: string;
  cta?: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    const endpoint = process.env.NEXT_PUBLIC_ESP_ENDPOINT;
    try {
      if (endpoint) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, magnet }),
        });
        if (!res.ok) throw new Error("bad response");
      }
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="my-8 rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/40 to-zinc-900 p-6">
      <p className="text-lg font-semibold text-white">{magnet}</p>
      {state === "done" ? (
        <p className="mt-3 text-sm text-fuchsia-300">
          You&apos;re in — check your inbox.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <label className="sr-only" htmlFor="optin-email">
            Email address
          </label>
          <input
            id="optin-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-fuchsia-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={state === "loading"}
            className="shrink-0 rounded-lg bg-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
          >
            {state === "loading" ? "…" : cta}
          </button>
        </form>
      )}
      {state === "error" ? (
        <p className="mt-2 text-sm text-red-400">
          Something went wrong. Try again.
        </p>
      ) : null}
    </div>
  );
}
