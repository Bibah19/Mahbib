"use client";

/**
 * Private view for the couple: every reservation, CSV export and the ability to
 * release a seat that a guest did not use.
 *
 * It is protected by the ADMIN_KEY environment variable. Set it in `.env.local`
 * (see `.env.example`); without it the API refuses every admin request.
 */

import { useCallback, useEffect, useState } from "react";
import { WEDDING_DETAILS } from "@/lib/wedding-config";
import type { Reservation, SeatSummary } from "@/lib/types";

const STORAGE_KEY = "weddingAdminKey";

type AdminPayload = {
  ok: boolean;
  reservations?: Reservation[];
  availability?: { totalSeats: number; occupiedSeats: number };
  error?: string;
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [summary, setSummary] = useState<SeatSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (key: string) => {
    if (!key.trim()) {
      setMessage("Enter your admin key to load the reservations.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/reservations", {
        headers: { "x-admin-key": key.trim() },
        cache: "no-store",
      });

      const data = (await response.json()) as AdminPayload;

      if (!response.ok || !data.ok) {
        setReservations([]);
        setSummary(null);
        setMessage(data.error ?? "Could not load the reservations.");
        return;
      }

      setReservations(data.reservations ?? []);
      window.sessionStorage.setItem(STORAGE_KEY, key.trim());

      if (data.availability) {
        setSummary({
          totalSeats: data.availability.totalSeats,
          occupiedSeats: data.availability.occupiedSeats,
          availableSeats: data.availability.totalSeats - data.availability.occupiedSeats,
        });
      }
    } catch {
      setMessage("Network problem while loading the reservations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    // Restoring the saved key is a side effect on an external system
    // (sessionStorage), so it happens on a tick rather than during the render.
    const timer = window.setTimeout(() => {
      setAdminKey(saved);
      void load(saved);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const release = useCallback(
    async (id: number) => {
      const confirmed = window.confirm(
        "Release this seat? The seat becomes available again for other guests.",
      );
      if (!confirmed) return;

      try {
        const response = await fetch(`/api/reservations?id=${id}`, {
          method: "DELETE",
          headers: { "x-admin-key": adminKey.trim() },
        });
                const data = (await response.json()) as {
          ok: boolean;
          error?: string;
          email?: { status: "sent" | "skipped" | "failed"; message: string };
        };

        if (!response.ok || !data.ok) {
          setMessage(data.error ?? "The seat could not be released.");
          return;
        }

        setMessage(
          data.email?.status === "sent"
            ? "Seat released. Cancellation email sent."
            : "Seat released. Cancellation email not sent.",
        );
        await load(adminKey);
      } catch {
        setMessage("Network problem while releasing the seat.");
      }
    },
    [adminKey, load],
  );

  const downloadCsv = useCallback(async () => {
    try {
      const response = await fetch("/api/reservations?format=csv", {
        headers: { "x-admin-key": adminKey.trim() },
      });

      if (!response.ok) {
        setMessage("Could not build the CSV file.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "wedding-reservations.csv";
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage("Network problem while building the CSV file.");
    }
  }, [adminKey]);

  return (
    <main className="shell section-pad">
      <div className="glass-card p-6 sm:p-10">
        <p className="small-caps">Private</p>
        <h1 className="display-title mt-3 mb-3 text-[clamp(28px,4.5vw,44px)]">
          {WEDDING_DETAILS.brideName} &amp; {WEDDING_DETAILS.groomName}, seat reservations
        </h1>
        <p className="max-w-2xl font-sans text-[16px] leading-relaxed text-muted">
          Reservations live in the wedding database. Export the CSV to print your seating chart, and
          release a seat if a guest can no longer attend.
        </p>

        <div className="form-card mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <label className="field-label" htmlFor="adminKey">
              Admin Key
            </label>
            <input
              id="adminKey"
              className="text-input"
              type="password"
              placeholder="ADMIN_KEY from your environment"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void load(adminKey)}
              disabled={loading}
            >
              {loading ? "Loading…" : "Load reservations"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void downloadCsv()}
              disabled={reservations.length === 0}
            >
              Download CSV
            </button>
          </div>
        </div>

        {summary ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="chip">
              {summary.occupiedSeats} of {summary.totalSeats} seats secured
            </span>
            <span className="chip">{summary.availableSeats} still available</span>
            <span className="chip">{reservations.length} reservations</span>
          </div>
        ) : null}

        {message ? (
          <div className="status-box status-box-error mt-5" role="status">
            {message}
          </div>
        ) : null}

        {reservations.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse font-sans text-[14px]">
              <thead>
                <tr className="text-left">
                  {["Invitee", "Email", "Category", "Table", "Seat", "Code", "Reserved", ""].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="border-b border-navy-border px-3 py-3 text-[11px] uppercase tracking-[0.16em] text-emerald-deep"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation.id} className="align-top">
                    <td className="border-b border-navy-border px-3 py-3 font-bold">
                      {reservation.name}
                    </td>
                    <td className="border-b border-navy-border px-3 py-3 text-muted">
                      {reservation.email}
                    </td>
                    <td className="border-b border-navy-border px-3 py-3">
                      {reservation.category}
                    </td>
                    <td className="border-b border-navy-border px-3 py-3">
                      {reservation.table}
                    </td>
                    <td className="border-b border-navy-border px-3 py-3">
                      {reservation.seat}
                    </td>
                    <td className="border-b border-navy-border px-3 py-3">
                      {reservation.inviteCode}
                    </td>
                    <td className="border-b border-navy-border px-3 py-3 text-muted">
                      {new Date(reservation.createdAt).toLocaleString()}
                    </td>
                    <td className="border-b border-navy-border px-3 py-3">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void release(reservation.id)}
                      >
                        Release
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="note mt-6">
            No reservations loaded yet. Enter the ADMIN_KEY you set in `.env.local` and press
            “Load reservations”. Guests&apos; seats appear here the moment they reserve.
          </p>
        )}
      </div>
    </main>
  );
}