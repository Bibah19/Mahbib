"use client";

/**
 * The sealed invitation envelope that greets every guest.
 *
 * Press the emerald wax seal (or Enter / Space, or Escape to skip) and the flap
 * swings open, the invitation card rises out, then the overlay fades and zooms
 * away to reveal the website. No images are used: all of it is CSS, so it stays
 * sharp and keeps the navy and emerald palette.
 *
 * Details that matter:
 *  - The envelope is sealed on every page load: `useState` starts at "sealed",
 *    so a refresh always shows the envelope again.
 *  - States: sealed -> opening (flap lifts) -> leaving (overlay fades) -> done.
 *  - `prefers-reduced-motion` reveals the site instantly, with no animation.
 *  - A `noscript` rule hides the overlay, so the site is never unusable when
 *    JavaScript is switched off.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  WEDDING_DETAILS,
  getCoupleMonogram,
  getCoupleNames,
} from "@/lib/wedding-config";

type EnvelopeState = "sealed" | "opening" | "leaving" | "done";

/** How long the flap/card animation runs before the overlay starts to fade. */
const OPEN_DURATION_MS = 2900;
/** How long the overlay takes to fade away (matches the CSS transition). */
const LEAVE_DURATION_MS = 700;

type Sparkle = { x: string; s: string; t: string; d: string; drift: string };

/** Fixed values (not random) so server and client render the same markup. */
const SPARKLES: Sparkle[] = [
  { x: "6%", s: "4px", t: "11s", d: "0s", drift: "18px" },
  { x: "14%", s: "3px", t: "14s", d: "3s", drift: "-22px" },
  { x: "23%", s: "5px", t: "12s", d: "6s", drift: "26px" },
  { x: "31%", s: "3px", t: "16s", d: "1s", drift: "-14px" },
  { x: "40%", s: "4px", t: "13s", d: "8s", drift: "20px" },
  { x: "48%", s: "3px", t: "15s", d: "4s", drift: "-26px" },
  { x: "56%", s: "5px", t: "12s", d: "9s", drift: "16px" },
  { x: "64%", s: "3px", t: "17s", d: "2s", drift: "-18px" },
  { x: "72%", s: "4px", t: "13s", d: "7s", drift: "24px" },
  { x: "80%", s: "3px", t: "15s", d: "5s", drift: "-20px" },
  { x: "88%", s: "5px", t: "11s", d: "10s", drift: "14px" },
  { x: "94%", s: "4px", t: "14s", d: "2.5s", drift: "-16px" },
];

export default function EnvelopeIntro() {
  // Always sealed on mount, so every reload starts with the envelope.
  const [state, setState] = useState<EnvelopeState>("sealed");
  const sealRef = useRef<HTMLButtonElement>(null);

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Start fading the overlay away (instantly when motion is reduced). */
  const reveal = useCallback(() => {
    setState((current) => (current === "done" ? current : "leaving"));
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

  // opening -> leaving once the flap and card have finished moving.
  useEffect(() => {
    if (state !== "opening") return;

    const timer = window.setTimeout(
      reveal,
      prefersReducedMotion() ? 0 : OPEN_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [reveal, state]);

  // leaving -> done once the overlay has faded out, then remove it.
  useEffect(() => {
    if (state !== "leaving") return;

    const timer = window.setTimeout(
      () => setState("done"),
      prefersReducedMotion() ? 0 : LEAVE_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [state]);

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

      <div className="envelope-sparkles" aria-hidden="true">
        {SPARKLES.map((sparkle, index) => (
          <span
            key={index}
            style={
              {
                "--x": sparkle.x,
                "--s": sparkle.s,
                "--t": sparkle.t,
                "--d": sparkle.d,
                "--drift": sparkle.drift,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="envelope-stage">
        <p className="envelope-eyebrow">Together with their families</p>

        <h2 className="envelope-names" aria-label={getCoupleNames()}>
          <span aria-hidden="true">{WEDDING_DETAILS.brideName}</span>
          <span className="envelope-amp" aria-hidden="true">
            &amp;
          </span>
          <span aria-hidden="true">{WEDDING_DETAILS.groomName}</span>
        </h2>

        <div className="envelope-ornament" aria-hidden="true">
          <i />
        </div>
        <p className="envelope-date">{WEDDING_DETAILS.weddingDate}</p>

        <div className="envelope-scene">
          <div className="envelope-shadow" aria-hidden="true" />

          <div className="envelope">
            <div className="envelope-card">
              <span>You are invited</span>
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
              <span className="envelope-seal-ring" aria-hidden="true" />
              <span className="envelope-seal-ring envelope-seal-ring--late" aria-hidden="true" />
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
