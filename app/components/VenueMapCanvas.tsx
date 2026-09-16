"use client";

/**
 * The real venue map: Leaflet + OpenStreetMap raster tiles (via CARTO's
 * light basemap), with a custom emerald pin in the invitation palette.
 *
 * This module touches `window` at import time, so it is only ever loaded in the
 * browser through `next/dynamic` with `ssr: false` from `VenueMap.tsx`.
 */

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { MAP_TILE_LAYER, WEDDING_DETAILS, getDirectionsUrl } from "@/lib/wedding-config";

type VenueMapCanvasProps = {
  /** Fired when the first screen of tiles has finished loading. */
  onReady?: () => void;
  /** Fired for every tile that fails to load (offline, blocked network, ...). */
  onTileError?: () => void;
};

const { lat, lng } = WEDDING_DETAILS.venue.coordinates;

/** Emerald teardrop pin, drawn with the site's own CSS classes. */
const venueIcon = L.divIcon({
  className: "venue-marker-wrap",
  html: '<span class="venue-marker"></span><span class="venue-marker-pulse"></span>',
  iconSize: [46, 46],
  iconAnchor: [23, 46],
  popupAnchor: [0, -48],
});

export default function VenueMapCanvas({ onReady, onTileError }: VenueMapCanvasProps) {
  return (
    <MapContainer
      className="map-canvas"
      center={[lat, lng]}
      zoom={WEDDING_DETAILS.venue.zoom}
      scrollWheelZoom={false}
      zoomSnap={0.5}
      minZoom={3}
      maxZoom={MAP_TILE_LAYER.maxZoom}
      whenReady={onReady}
    >
      <TileLayer
        url={MAP_TILE_LAYER.url}
        attribution={MAP_TILE_LAYER.attribution}
        maxZoom={MAP_TILE_LAYER.maxZoom}
        detectRetina
        eventHandlers={{
          load: () => onReady?.(),
          tileerror: () => onTileError?.(),
        }}
      />

      <Marker position={[lat, lng]} icon={venueIcon} title={WEDDING_DETAILS.venue.name}>
        <Popup>
          <strong className="block text-[15px] text-navy-deep">
            {WEDDING_DETAILS.venue.name}
          </strong>
          <span className="mt-1 block text-muted">{WEDDING_DETAILS.venue.address}</span>
          <a
            className="mt-3 inline-block rounded-xl bg-emerald-deep px-3 py-2 font-bold text-white no-underline"
            href={getDirectionsUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get directions
          </a>
        </Popup>
      </Marker>
    </MapContainer>
  );
}