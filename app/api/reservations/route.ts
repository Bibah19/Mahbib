/**
 * Seat reservation endpoints.
 *
 *   POST   /api/reservations                  reserve a seat (public)
 *   GET    /api/reservations                  list every reservation (admin)
 *   GET    /api/reservations?format=csv       CSV download for the couple (admin)
 *   DELETE /api/reservations?id=123           release a seat (admin)
 *
 * Admin requests are authorised with the ADMIN_KEY environment variable, passed
 * either as an `x-admin-key` header or a `key` query parameter.
 */

import { BookingDiagnostics } from "@/lib/booking-diagnostics";

import { sendCancellationEmail, sendInviteEmail } from "@/lib/email";
import { checkRateLimit, getClientKey, pruneRateLimitBuckets } from "@/lib/rate-limit";
import { getAvailability, listReservations, releaseSeat, reservationsToCsv, getReservationById, reserveSeat } from "@/lib/reservations";
import { parseId, validateReservationPayload } from "@/lib/validation";

export const dynamic = "force-dynamic";

function getAdminKey(request: Request): string | null {
  const header = request.headers.get("x-admin-key");
  if (header) return header.trim();

  const fromQuery = new URL(request.url).searchParams.get("key");
  return fromQuery ? fromQuery.trim() : null;
}

function isAuthorised(request: Request): boolean {
  const expected = process.env.ADMIN_KEY?.trim();
  if (!expected) return false;
  return getAdminKey(request) === expected;
}

function unauthorisedResponse(): Response {
  const configured = Boolean(process.env.ADMIN_KEY?.trim());
  return Response.json(
    {
      ok: false,
      error: configured
        ? "That admin key is not correct."
        : "Set ADMIN_KEY in your environment to open the admin view.",
    },
    { status: 401 },
  );
}

export async function POST(request: Request) {
  const diagnostics = new BookingDiagnostics();
  try {
    const response = await bookSeat(request, diagnostics);
    const body = await response.json();
    diagnostics.log(response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info", "response", undefined, response.status);
    response.headers.set("x-request-id", diagnostics.requestId);
    return Response.json({ ...body, requestId: diagnostics.requestId }, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    diagnostics.log("error", "unhandled_failure", error, 500);
    return Response.json({
      ok: false,
      error: `We could not complete the booking response. Please contact the host before retrying. Reference: ${diagnostics.requestId}`,
      requestId: diagnostics.requestId,
    }, { status: 500, headers: { "x-request-id": diagnostics.requestId } });
  }
}

async function bookSeat(request: Request, diagnostics: BookingDiagnostics) {
  diagnostics.step("rate_limit");
  pruneRateLimitBuckets();

  const limit = checkRateLimit(getClientKey(request));
  if (!limit.allowed) {
    return Response.json(
      {
        ok: false,
        error: `Too many reservation attempts. Please wait ${limit.retryAfterSeconds} seconds and try again.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let raw: unknown;
  diagnostics.step("parse_request");
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "We could not read your details. Please try again." },
      { status: 400 },
    );
  }

  diagnostics.step("validation");
  if (typeof raw === "object" && raw !== null) {
    for (const value of Object.values(raw)) {
      if (typeof value === "string") diagnostics.protect(value);
    }
  }
  const validation = validateReservationPayload(raw);
  if (!validation.ok) {
    diagnostics.step("invalid_payload_availability");
    return Response.json(
      { ok: false, error: validation.error, availability: await getAvailability() },
      { status: 400 },
    );
  }

  const result = await reserveSeat(validation.value, diagnostics);

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error, conflict: result.conflict, availability: result.availability },
      { status: result.conflict ? 409 : 500 },
    );
  }

  diagnostics.step("invite_url");
  const inviteUrl = new URL(result.invitePath, new URL(request.url).origin).toString();
  diagnostics.step("email");
  const email = await sendInviteEmail(result.reservation, inviteUrl, diagnostics);
  diagnostics.log(email.status === "failed" ? "warn" : "info", `email_${email.status}`);
  diagnostics.step("response_availability");
  const availability = await getAvailability();
  diagnostics.step("response_serialization");

  return Response.json(
    {
      ok: true,
      reservation: result.reservation,
      invitePath: result.invitePath,
      inviteUrl,
      email,
      availability,
    },
    { status: 201 },
  );
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) return unauthorisedResponse();

  const reservations = await listReservations();
  const format = new URL(request.url).searchParams.get("format");

  if (format === "csv") {
    return new Response(reservationsToCsv(reservations), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="wedding-reservations.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.json(
    { ok: true, reservations: await listReservations(), availability: await getAvailability() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  if (!isAuthorised(request)) return unauthorisedResponse();

    const id = parseId(new URL(request.url).searchParams.get("id"));
  if (id === null) {
    return Response.json({ ok: false, error: "A valid reservation id is required." }, { status: 400 });
  }

  const reservation = await getReservationById(id);

  if (reservation) {
    const email = await sendCancellationEmail(reservation);
    const released = await releaseSeat(id);
    return Response.json(
      {
        ok: released,
        error: released ? undefined : "That reservation no longer exists.",
        email,
        availability: await getAvailability(),
      },
      { status: released ? 200 : 404 },
    );
  }

  return Response.json(
    {
      ok: false,
      error: "That reservation no longer exists.",
      availability: await getAvailability(),
    },
    { status: 404 },
  );
}