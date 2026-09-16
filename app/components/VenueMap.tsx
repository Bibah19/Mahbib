"use client";

/**
 * The map card that replaces the old hand-drawn "map picture".
 *
 * It lazy-loads the real Leaflet map in the browser (never during server
 * rendering) and keeps the invitation look: rounded navy frame, a venue
 * name chip and the same action buttons as before, plus share/copy
 * actions.
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import CopyButton from "./CopyButton";
import ShareButton from "./ShareButton";
import {
  MAP_TILE_LAYER,
  WEDDING_DETAILS,
  getDirectionsUrl,
  getGoogleMapsUrl,
  getShareDirectionText,
} from "@/lib/wedding-config";

const VenueMapCanvas = dynamic(() => import("./VenueMapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder">
      <span className="small-caps">Loading the venue map…</span>
      <span className="font-sans text-[13px] text-muted">{WEDDING_DETAILS.venue.name}</span>
    </div>
  ),
});

type MapStatus = "loading" | "ready" | "failed";

/** How long to wait for the first tiles before offering the static fallback. */
const LOAD_TIMEOUT_MS = 12000;

export default function VenueMap() {
  const [status, setStatus] = useState<MapStatus>("loading");
  const tileErrors = useRef(0);

  const markReady = useCallback(() => setStatus("ready"), []);

  const markTileError = useCallback(() => {
    tileErrors.current += 1;
    // A couple of errors can be a fluke; a stream of them means no network.
    if (tileErrors.current >= 3) setStatus("failed");
  }, []);

  useEffect(() => {
    if (status !== "loading") return;

    const timer = window.setTimeout(() => {
      setStatus((current) => (current === "loading" ? "failed" : current));
    }, LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [status]);

  return (
    <div className="grid gap-4">
      <div
        className="map-frame"
        role="region"
        aria-label={`Map showing ${WEDDING_DETAILS.venue.name}, ${WEDDING_DETAILS.venue.address}`}
      >
        {status === "failed" ? (
          <div className="map-placeholder">
            <span className="small-caps">Venue location</span>
            <strong className="text-[20px] text-navy-deep">{WEDDING_DETAILS.venue.name}</strong>
            <span className="font-sans text-[14px] text-muted">
              {WEDDING_DETAILS.venue.address}
            </span>
            <span className="font-sans text-[13px] text-muted">
              The interactive map did not load. Use the buttons below to open the venue.
            </span>
            <a
              className="btn btn-primary mt-2"
              href={getGoogleMapsUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open the map on Google Maps
            </a>
          </div>
        ) : (
          <VenueMapCanvas onReady={markReady} onTileError={markTileError} />
        )}

        <div className="map-overlay">
          <span className="chip">
            <span aria-hidden="true">📍</span>
            {WEDDING_DETAILS.venue.name}
          </span>

          {WEDDING_DETAILS.venue.coordinatesArePlaceholder ? (
            <span
              className="chip"
              style={{ background: "rgba(255,235,235,.94)", color: "#a33a3a", borderColor: "rgba(163,58,58,.32)" }}
            >
              Sample pin, set the real coordinates in lib/wedding-config.ts
            </span>
          ) : null}

          {status === "loading" ? (
            <span className="chip" style={{ background: "rgba(255,255,255,.94)" }}>
              Loading map…
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          className="btn btn-primary"
          href={getDirectionsUrl()}
          target="_blank"
          rel="noopener noreferrer"
        >
          Get directions
        </a>
        <a
          className="btn btn-secondary"
          href={getGoogleMapsUrl()}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in Google Maps
        </a>
        <ShareButton
          label="Share direction"
          title={`Directions to ${WEDDING_DETAILS.venue.name}`}
          text={getShareDirectionText()}
        />
        <CopyButton
          value={WEDDING_DETAILS.venue.address}
          label="Copy address"
          copiedLabel="Address copied"
          className="btn btn-secondary"
        />
      </div>

      <p className="m-0 font-sans text-[12px] leading-relaxed text-muted">
        To explore, drag the map or use the plus and minus buttons, then open Google Maps for
        turn-by-turn navigation. Tiles courtesy of{" "}
        <a
          className="text-navy-deep"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenStreetMap
        </a>{" "}
        contributors, courtesy of CARTO ({MAP_TILE_LAYER.maxZoom}x maximum zoom).
      </p>
    </div>
  );
}