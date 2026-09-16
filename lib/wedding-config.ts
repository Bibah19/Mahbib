/**
 * ============================================================
 * EDIT EVERYTHING ABOUT THE WEDDING IN THIS ONE FILE
 * ============================================================
 * This is the single source of truth for the couple names, the wedding date
 * and time, the venue (including the exact pin shown on the real map) and the
 * gift account details.
 *
 * The map on the site points at `venue.coordinates` below, and the QR codes,
 * the "Get directions" and "Open in Google Maps" buttons all build from it.
 *
 * How to get the coordinates in 20 seconds (if they ever change):
 *   1. Open Google Maps and find the venue.
 *   2. Right click on the exact spot and click the coordinates that appear.
 *      They copy as "7.453100, 3.906000" -> lat = 7.453100, lng = 3.906000.
 *   (Alternatively, paste the Google Maps link in the URL bar: anything of the
 *    form .../@7.4531,3.9060,17z contains lat,lng.)
 */

export type VenueCoordinates = {
  lat: number;
  lng: number;
};

export const WEDDING_DETAILS = {
  brideName: "Oyenike",
  groomName: "Oladayo",

  /** Shown everywhere the date appears. */
  weddingDate: "Saturday, 12th December 2026",
  /** Shown everywhere the time appears. */
  weddingTime: "10 am",
  dressCode: "Trads (Navy Blue & Ash)",

  /** Seats in the hall. Must equal the total in `lib/seating.ts`. */
  hallCapacity: 200,

  venue: {
    name: "The University of Ibadan International Conference Centre (UI-ICC)",
    address:
      "Beside the Second Gate of the University of Ibadan, Ojoo-Mokola Expressway (UI-Ojoo Road), Ibadan, Oyo State, Nigeria",

    /** Shown under "How to get to the venue" and shared through the share button. */
    directionsText:
      "From Iwo Road, enter a Micra Ojoo / UI / Sango and tell them you are dropping at UI Second Gate (UI-ICC). The bus passes through the Ojoo-Mokola Expressway from Iwo Road to Agodi Gate, then Bodija, then Sango. Stop at UI Second Gate: the big University of Ibadan International Conference Centre (UI-ICC) is right beside the gate by the roadside.",

    /**
     * The International Conference Centre, University of Ibadan (UI-ICC).
     * Verified by the couple: Latitude 7.4531 N, Longitude 3.9060 E.
     */
    coordinates: {
      lat: 7.4531,
      lng: 3.906,
    } satisfies VenueCoordinates,

    /** The map zoom level: 13 = city, 15 = street, 17 = building. */
    zoom: 16,

    /**
     * The pin above is the real venue, so this stays false. Flip it to `true`
     * only while the coordinates are a guess; it makes the map show a red
     * reminder chip so the site is never deployed with a wrong pin.
     */
    coordinatesArePlaceholder: false,
  },

  gift: {
    bankName: "Bank Name",
    accountName: "Account Name",
    accountNumber: "0000000000",
  },

  /** Couple's inbox: used for the prepared email fallback and mailto links. */
  contactEmail: "couple@example.com",
} as const;

/** Tile layer used by the real map (Leaflet + OpenStreetMap data). */
export const MAP_TILE_LAYER = {
  url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  maxZoom: 20,
} as const;

/** "Oyenike & Oladayo" */
export function getCoupleNames(): string {
  return `${WEDDING_DETAILS.brideName} & ${WEDDING_DETAILS.groomName}`;
}

/** "O & O", the monogram pressed into the envelope seal. */
export function getCoupleMonogram(): string {
  const bride = WEDDING_DETAILS.brideName.trim().charAt(0).toUpperCase();
  const groom = WEDDING_DETAILS.groomName.trim().charAt(0).toUpperCase();
  return `${bride} & ${groom}`;
}

/** `Venue Name, Full Address` */
export function getVenueLocationLine(): string {
  return `${WEDDING_DETAILS.venue.name}, ${WEDDING_DETAILS.venue.address}`;
}

/** Plain Google Maps search link for the venue (used by the CTA buttons). */
export function getGoogleMapsUrl(): string {
  const { lat, lng } = WEDDING_DETAILS.venue.coordinates;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Turn-by-turn directions link that opens the guest's own Google Maps app. */
export function getDirectionsUrl(): string {
  const { lat, lng } = WEDDING_DETAILS.venue.coordinates;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** The written directions from the couple. */
export function getDirectionSentence(): string {
  return WEDDING_DETAILS.venue.directionsText;
}

/** Text shared through the "Share direction" button. */
export function getShareDirectionText(): string {
  return `${WEDDING_DETAILS.venue.name}. ${WEDDING_DETAILS.venue.address}. Get directions: ${getDirectionsUrl()}`;
}

/** Text shared through the "Share invitation" button. */
export function getShareInviteText(): string {
  return `You are invited to the wedding of ${getCoupleNames()} on ${WEDDING_DETAILS.weddingDate} at ${WEDDING_DETAILS.venue.name}.`;
}

/** How the hall is described in the summary chips. */
export function getHallCapacityText(): string {
  return `${WEDDING_DETAILS.hallCapacity} seats in the hall`;
}
