"use client";

/**
 * Category → table → seat picker.
 *
 * The seat map comes from the server (SQLite through /api). Every reservation
 * is saved with one atomic INSERT, so two guests on two phones can never end up
 * with the same chair: the slower request gets a 409 and a fresh seat map.
 */

import { useCallback, useMemo, useState, type FormEvent } from "react";
import CopyButton from "./CopyButton";
import { buildMailtoUrl } from "@/lib/invite-message";
import type { ReservationApiResponse } from "@/lib/api-types";
import type { Availability } from "@/lib/types";

type SeatReservationProps = {
  initialAvailability: Availability;
};

type StatusMessage = {
  tone: "success" | "error" | "info";
  title: string;
  lines: string[];
};

type ReservedSummary = {
  name: string;
  email: string;
  category: string;
  table: string;
  seat: number;
  inviteCode: string;
  invitePath: string;
  inviteUrl: string;
};

export default function SeatReservation({ initialAvailability }: SeatReservationProps) {
  const [availability, setAvailability] = useState<Availability>(initialAvailability);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [category, setCategory] = useState("");
  const [table, setTable] = useState("");
  const [seat, setSeat] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reserved, setReserved] = useState<ReservedSummary | null>(null);

  const activeCategory = useMemo(
    () => availability.categories.find((item) => item.name === category) ?? null,
    [availability, category],
  );

  const tables = useMemo(() => activeCategory?.tables ?? [], [activeCategory]);

  const activeTable = useMemo(
    () => tables.find((item) => item.name === table) ?? null,
    [tables, table],
  );

  const occupiedSeats = useMemo(() => new Set(activeTable?.occupied ?? []), [activeTable]);

  const seatNumbers = useMemo(() => {
    if (!activeTable) return [];
    return Array.from({ length: activeTable.seatCount }, (_, index) => index + 1);
  }, [activeTable]);

  const refreshAvailability = useCallback(async () => {
    try {
      const response = await fetch("/api/availability", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as Availability;
      setAvailability(data);
    } catch {
      // Offline: keep the seat map we already have on screen.
    }
  }, []);

  const handleCategoryChange = useCallback((value: string) => {
    setCategory(value);
    setTable("");
    setSeat(null);
    setStatus(null);
  }, []);

  const handleTableChange = useCallback((value: string) => {
    setTable(value);
    setSeat(null);
    setStatus(null);
  }, []);

  const clearSelection = useCallback(() => {
    setCategory("");
    setTable("");
    setSeat(null);
    setStatus(null);
    setReserved(null);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting) return;

      if (!name.trim() || !email.trim() || !category || !table || seat === null) {
        setStatus({
          tone: "error",
          title: "Please complete the form",
          lines: ["Enter your name and email, choose your category and table, then tap an available seat."],
        });
        return;
      }

      setSubmitting(true);
      setStatus(null);

      try {
        const response = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, category, table, seat, website: honeypot }),
        });

        const data = (await response.json()) as ReservationApiResponse;

        if (data.availability) setAvailability(data.availability);

        if (!data.ok) {
          setSeat(null);
          setStatus({
            tone: "error",
            title: data.conflict ? "That seat was just taken" : "The seat could not be saved",
            lines: [data.error],
          });
          return;
        }

        setReserved({
          name: data.reservation.name,
          email,
          category: data.reservation.category,
          table: data.reservation.table,
          seat: data.reservation.seat,
          inviteCode: data.reservation.inviteCode,
          invitePath: data.invitePath,
          inviteUrl: data.inviteUrl,
        });

        const emailNote =
          data.email.status === "sent"
            ? "The invitation email has been sent."
            : data.email.status === "failed"
              ? `${data.email.message} Use the buttons below to share the invitation.`
              : "Automatic email is off, use the buttons below to send or copy the invitation.";

        setStatus({
          tone: "success",
          title: "Seat secured successfully",
          lines: [
            `Invitee: ${data.reservation.name}`,
            `Invite category: ${data.reservation.category}`,
            `Table: ${data.reservation.table}`,
            `Seat number: ${data.reservation.seat}`,
            `Invite code: ${data.reservation.inviteCode}`,
            emailNote,
          ],
        });

        setName("");
        setEmail("");
        setSeat(null);
      } catch {
        setStatus({
          tone: "error",
          title: "Network problem",
          lines: [
            "We could not reach the seat server. Please check your connection and try again.",
          ],
        });
      } finally {
        setSubmitting(false);
      }
    },
    [category, email, honeypot, name, seat, submitting, table],
  );

  const mailtoHref = reserved
    ? buildMailtoUrl(
        {
          id: 0,
          inviteCode: reserved.inviteCode,
          name: reserved.name,
          email: reserved.email,
          category: reserved.category,
          table: reserved.table,
          seat: reserved.seat,
          createdAt: new Date().toISOString(),
        },
        reserved.inviteUrl,
      )
    : null;

  return (
    <section id="secure-seat" className="shell section-pad">
      <div className="glass-card p-6 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="small-caps">Secure a Seat</p>
            <h2 className="display-title mt-3 mb-0 text-[clamp(30px,5vw,50px)] text-balance">
              Choose your invite category and reserve your preferred seat
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="chip">
              {availability.occupiedSeats} of {availability.totalSeats} seats secured
            </span>
            <span className="chip">
              {Math.max(availability.totalSeats - availability.occupiedSeats, 0)} available
            </span>
          </div>
        </div>

        <p className="mt-4 max-w-3xl font-sans text-[17px] leading-relaxed text-muted">
          Pick your category first, then the table allocated to it. Seats already taken by other
          guests are crossed out live, because every reservation is stored in the wedding
          database, not in your browser.
        </p>

        <form className="form-card mt-6" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="field-label" htmlFor="guestName">
                Invitee Name
              </label>
              <input
                id="guestName"
                name="guestName"
                className="text-input"
                type="text"
                placeholder="Enter invitee full name"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <label className="field-label" htmlFor="guestEmail">
                Invitee Email Address
              </label>
              <input
                id="guestEmail"
                name="guestEmail"
                className="text-input"
                type="email"
                placeholder="Enter invitee email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <label className="field-label" htmlFor="guestCategory">
                Invite Category
              </label>
              <select
                id="guestCategory"
                name="guestCategory"
                className="select-input"
                required
                value={category}
                onChange={(event) => handleCategoryChange(event.target.value)}
              >
                <option value="">Select invite category</option>
                {availability.categories.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name} ({item.seatCount - item.occupiedCount} seats open)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <label className="field-label" htmlFor="guestTable">
                Table Allocated to This Category
              </label>
              <select
                id="guestTable"
                name="guestTable"
                className="select-input"
                required
                disabled={!category}
                value={table}
                onChange={(event) => handleTableChange(event.target.value)}
              >
                <option value="">
                  {category ? "Select table" : "Select an invite category first"}
                </option>
                {tables.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}, {item.availableCount} of {item.seatCount} seats available
                  </option>
                ))}
              </select>
            </div>

            {/* Honeypot for bots: hidden from guests, never empty for scripts. */}
            <div className="honeypot" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
              />
            </div>
          </div>

          {activeTable ? (
            <div className="availability-panel mt-5">
              <div className="mb-4 flex flex-wrap justify-between gap-3">
                <strong className="font-sans">
                  {activeCategory?.name}, {activeTable.name}
                </strong>
                <span className="text-muted">
                  {activeTable.availableCount} available, {activeTable.occupied.length} occupied
                </span>
              </div>

              <div className="seat-grid" role="group" aria-label="Available seats">
                {seatNumbers.map((number) => {
                  const isOccupied = occupiedSeats.has(number);
                  const isSelected = seat === number;

                  return (
                    <button
                      key={number}
                      type="button"
                      disabled={isOccupied}
                      aria-pressed={isSelected}
                      aria-label={`Seat ${number}${isOccupied ? " (occupied)" : ""}`}
                      className={[
                        "seat-btn",
                        isOccupied ? "seat-btn-occupied" : "",
                        isSelected ? "seat-btn-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSeat(number)}
                    >
                      <span>{number}</span>
                      <small>
                        {isOccupied ? "Occupied" : isSelected ? "Selected" : "Available"}
                      </small>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 mb-0 text-[13px] text-muted">
                {seat !== null
                  ? `Seat ${seat} selected on ${activeTable.name}.`
                  : "Tap a seat to select it, then press “Secure Seat”."}
              </p>
            </div>
          ) : (
            <p className="mt-5 mb-0 font-sans text-[14px] text-muted">
              Choose a category and a table to see which seats are still available.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Saving your seat…" : "Secure Seat"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={refreshAvailability}>
              Refresh seat map
            </button>
            <button type="button" className="btn btn-secondary" onClick={clearSelection}>
              Clear selection
            </button>
          </div>
        </form>

        {status ? (
          <div
            className={[
              "status-box mt-5",
              status.tone === "success" ? "status-box-success" : "",
              status.tone === "error" ? "status-box-error" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role={status.tone === "error" ? "alert" : "status"}
          >
            <strong className="block text-[15px]">{status.title}</strong>
            <ul className="mt-2 mb-0 list-disc pl-5">
              {status.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            {reserved ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <a className="btn btn-primary" href={reserved.invitePath}>
                  Open the invitation page
                </a>
                {mailtoHref ? (
                  <a className="btn btn-secondary" href={mailtoHref}>
                    Open prepared email
                  </a>
                ) : null}
                <CopyButton
                  value={reserved.inviteUrl}
                  label="Copy invite link"
                  copiedLabel="Invite link copied"
                  className="btn btn-secondary"
                />
                <CopyButton
                  value={reserved.inviteCode}
                  label="Copy invite code"
                  copiedLabel="Code copied"
                  className="btn btn-secondary"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="note mt-5">
          Every seat is saved in the wedding database, so two guests on different phones can never
          take the same chair, the second request is refused and the seat map is repainted. Keep
          your invite code so you can reopen your personal invitation page at any time.
        </p>
      </div>
    </section>
  );
}
