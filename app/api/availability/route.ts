/**
 * GET /api/availability
 *
 * Live seat map for the whole venue: every category, every table, every seat
 * that is already taken. Used by the seat picker when it needs to refresh.
 */

import { getAvailability, getSeatSummary } from "@/lib/reservations";

// Seats change constantly, so this route must never be statically cached.
export const dynamic = "force-dynamic";

export async function GET() {
  const availability = getAvailability();

  return Response.json(
    {
      ...availability,
      summary: getSeatSummary(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}