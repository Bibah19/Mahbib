"use client";

/**
 * The sealed invitation envelope that greets every guest.
 *
 * Press the emerald wax seal (or Enter / Space, or Escape to skip) and the flap
 * swings open, the invitation card rises out, the overlay fades and the website
 * is revealed. No images are used: all of it is CSS, so it stays sharp and
 * keeps the navy and emerald palette.
 *
 * Details that matter:
 *  - The envelope is sealed on every page load: `useState` starts at "sealed",
 *    so a refresh always shows the envelope again.
 *  - `prefers-reduced-motion` reveals the site instantly, with no animation.
 *  - A `noscript` rule hides the overlay, so the site is never unusable when
 *    JavaScript is switched off.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  WEDDING_DETAILS,
  getCoupleMonogram,
  getCoupleNames,
} from "@/lib/wedding-config";

type EnvelopeState = "sealed" | "opening" | "done";

/** How long the open animation runs before the overlay is removed. */
const REVEAL_DELAY_MS = 1500;

export default function EnvelopeIntro() {
  // Always sealed on mount, so every reload starts with the envelope.
  const [state, setState] = useState<EnvelopeState>("sealed");
  const sealRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  const reveal = useCallback(() => {
    document.body.style.removeProperty("overflow");
    setState("done");
  }, []);

  const openEnvelope = useCallback(() => {
    setState((current) => (current === "sealed" ? "opening" : current));
  }, []);

  // Lock the page while the envelope covers it.
  useEffect(() => {
    if (state === "done") return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [state]);

  // Run the opening sequence once, then get out of the way.
  useEffect(() => {
    if (state !== "opening") return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const revealTimer = window.setTimeout(reveal, prefersReducedMotion ? 0 : REVEAL_DELAY_MS);
    timers.current.push(revealTimer);

    return () => window.clearTimeout(revealTimer);
  }, [reveal, state]);

  // Behave like a dialog: focus the seal, and let Escape skip the envelope.
  useEffect(() => {
    if (state !== "sealed") return;

    sealRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") reveal();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reveal, state]);

  useEffect(() => clearTimers, [clearTimers]);

  if (state === "done") return null;

  return (
    <div
      className="envelope-intro"
      data-state={state}
      role="dialog"
      aria-modal="true"
      aria-label={`Open the wedding invitation of ${getCoupleNames()}`}
    >
      <noscript>
        {/* Without JavaScript the seal cannot be pressed, so never block the site. */}
        <style>{`.envelope-intro{display:none !important}`}</style>
      </noscript>

      <div className="envelope-stage">
        <h2 className="envelope-names">{getCoupleNames()}</h2>
        <p className="envelope-date">{WEDDING_DETAILS.weddingDate}</p>

        <div className="envelope-scene">
          <div className="envelope-shadow" aria-hidden="true" />

          <div className="envelope">
            <div className="envelope-card">
              <span>Wedding Invitation</span>
              <strong>{getCoupleNames()}</strong>
              <span>
                {WEDDING_DETAILS.weddingTime}, {WEDDING_DETAILS.venue.name}
              </span>
            </div>

            <div className="envelope-back" />
            <div className="envelope-fold-left" />
            <div className="envelope-fold-right" />
            <div className="envelope-fold-bottom" />

            <div className="envelope-flap-shadow" aria-hidden="true" />

            <div className="envelope-flap">
              <div className="envelope-flap-face envelope-flap-face--liner" />
              <div className="envelope-flap-face envelope-flap-face--front" />
            </div>

            <button
              ref={sealRef}
              type="button"
              className="envelope-seal"
              onClick={openEnvelope}
              aria-label="Press the seal to open the invitation"
            >
              <span className="envelope-seal-mono">{getCoupleMonogram()}</span>
            </button>
          </div>
        </div>

        <p className="envelope-invited">You Are Invited</p>
        <p className="envelope-ask">Tap the seal to open</p>

        <button type="button" className="btn btn-secondary" onClick={reveal}>
          Skip to the website
        </button>
      </div>
    </div>
  );
}