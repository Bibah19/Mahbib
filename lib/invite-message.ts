/**
 * The invitation message that each guest receives.
 *
 * Pure functions (no server-only imports) so both the server and the browser
 * can build the same email: the server sends it through Resend when configured,
 * and the browser can always fall back to a prepared mailto link.
 */

import { WEDDING_DETAILS, getDirectionsUrl } from "./wedding-config";
import type { Reservation } from "./types";

export function buildInviteSubject(reservation: Reservation): string {
  return `Wedding invitation confirmed: ${reservation.table}, Seat ${reservation.seat}`;
}

export function buildInviteBody(reservation: Reservation, inviteUrl: string): string {
  return [
    `Hello ${reservation.name},`,
    "",
    `Your seat is secured for the wedding of ${WEDDING_DETAILS.brideName} and ${WEDDING_DETAILS.groomName}.`,
    "",
    `Invitee name: ${reservation.name}`,
    `Invite category: ${reservation.category}`,
    `Table: ${reservation.table}`,
    `Seat number: ${reservation.seat}`,
    `Invite code: ${reservation.inviteCode}`,
    "",
    `Your personal invitation page: ${inviteUrl}`,
    "",
    `Date: ${WEDDING_DETAILS.weddingDate}`,
    `Time: ${WEDDING_DETAILS.weddingTime}`,
    `Venue: ${WEDDING_DETAILS.venue.name}, ${WEDDING_DETAILS.venue.address}`,
    `Directions: ${getDirectionsUrl()}`,
    "",
    "We look forward to celebrating with you.",
  ].join("\n");
}

/** `mailto:` link used when automatic delivery is not configured. */
export function buildMailtoUrl(reservation: Reservation, inviteUrl: string): string {
  const subject = buildInviteSubject(reservation);
  const body = buildInviteBody(reservation, inviteUrl);
  return `mailto:${encodeURIComponent(reservation.email)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

/** Exported for the API route, which needs the same plain-text preview. */
export function buildInvitePlainTextPreview(reservation: Reservation, inviteUrl: string): string {
  return buildInviteBody(reservation, inviteUrl);
}