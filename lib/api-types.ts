/** Extra shapes shared by pages and components. */

import type { Availability } from "./types";

/** Reservation + invite details returned by POST /api/reservations. */
export type ReservationApiResponse =
  | {
      ok: true;
      reservation: {
        id: number;
        inviteCode: string;
        name: string;
        email: string;
        category: string;
        table: string;
        seat: number;
        createdAt: string;
      };
      invitePath: string;
      inviteUrl: string;
      email: { status: "sent" | "skipped" | "failed"; message: string };
      availability: Availability;
    }
  | {
      ok: false;
      error: string;
      conflict?: boolean;
      availability?: Availability;
    };