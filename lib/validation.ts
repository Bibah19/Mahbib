/**
 * Server-side validation for the reservation API.
 *
 * The browser also validates, but the browser is never trusted: this file is
 * the authoritative gate for anything that reaches the database.
 */

import { isKnownCategory, isKnownTable, isValidSeat } from "./seating";
import type { ReserveSeatInput } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 160;

export type ValidationResult =
  | { ok: true; value: ReserveSeatInput }
  | { ok: false; error: string };

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ");
}

/** Validates and normalises the JSON body of a reservation request. */
export function validateReservationPayload(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "We could not read your details. Please try again." };
  }

  const body = raw as Record<string, unknown>;

  const name = collapseSpaces(asTrimmedString(body.name));

  // Simple honeypot: real guests never fill a field they cannot see.
  if (asTrimmedString(body.website) !== "") {
    return { ok: false, error: "This submission was flagged as spam." };
  }

  const email = asTrimmedString(body.email).toLowerCase();
  const category = asTrimmedString(body.category);
  const table = asTrimmedString(body.table);
  const seat = Number(body.seat);

  if (name.length < NAME_MIN_LENGTH) {
    return { ok: false, error: "Please enter the invitee's full name." };
  }

  if (name.length > NAME_MAX_LENGTH) {
    return { ok: false, error: `Please keep the name under ${NAME_MAX_LENGTH} characters.` };
  }

  if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  if (!isKnownCategory(category)) {
    return { ok: false, error: "Please choose one of the listed invite categories." };
  }

  if (!isKnownTable(category, table)) {
    return { ok: false, error: "Please choose a table that belongs to your invite category." };
  }

  if (!isValidSeat(category, table, seat)) {
    return { ok: false, error: "Please choose an available seat on the selected table." };
  }

  return { ok: true, value: { name, email, category, table, seat } };
}

/** Validates a positive integer id coming from a query string. */
export function parseId(value: string | null): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Only allows invite codes made of the safe invite-code alphabet. */
export function normaliseInviteCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code) ? code : null;
}