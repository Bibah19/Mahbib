import Image from "next/image";
import ShareButton from "./ShareButton";
import { WEDDING_DETAILS, getShareInviteText } from "@/lib/wedding-config";
import type { SeatSummary } from "@/lib/types";

type ReservedSeatSummary = {
  name: string;
  category: string;
  table: string;
  seat: string;
  invitePath?: string;
};

type HeroProps = {
  summary: SeatSummary;
  reservedSeat: ReservedSeatSummary | null;
};

export default function Hero({ summary, reservedSeat }: HeroProps) {
  const couple = `${WEDDING_DETAILS.brideName} & ${WEDDING_DETAILS.groomName}`;

  return (
    <header id="invite" className="hero">
      <div className="hero-backdrop">
        <Image
          src="/img5678.png"
          alt=""
          fill
          preload
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="hero-scrim" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1120px] items-center gap-7 px-5 py-20 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="glass-card inset-frame reveal px-6 py-12 text-center sm:px-10">
          <p className="small-caps">Together with their families</p>
          <div className="accent-rule my-6" />

          <h1 className="names m-0">
            <span>{WEDDING_DETAILS.brideName}</span>
            <span className="amp">&amp;</span>
            <span>{WEDDING_DETAILS.groomName}</span>
          </h1>

          <p className="hero-subtitle">joyfully invite you to celebrate their wedding</p>

          <div className="mt-8 flex flex-wrap justify-center gap-3.5">
            <a href="#secure-seat" className="btn btn-primary">
              Secure Your Seat
            </a>
            <a href="#direction" className="btn btn-secondary">
              View the Map &amp; Directions
            </a>
            <ShareButton
              label="Share Invitation"
              title={`${couple} Wedding Invitation`}
              text={getShareInviteText()}
            />
          </div>
        </div>

        <aside className="glass-card reveal reveal-delay-1 p-7">
          <p className="small-caps">Event Summary</p>

          <div className="summary-panel mt-5">
            <h2 className="display-title mb-3 text-[clamp(28px,4.5vw,42px)]">
              Celebrate Love With Us
            </h2>
            <p className="font-sans text-[17px] leading-relaxed text-muted">
              Check the wedding details, choose your invite category and reserve your preferred
              available seat. Your seat is saved instantly for every guest to see.
            </p>

            <div className="mt-5 grid gap-3">
              <div className="quick-item">
                <div className="icon-badge">D</div>
                <div className="font-sans">
                  <span className="small-caps">Date</span>
                  <strong className="mt-1 block text-[17px] leading-snug">
                    {WEDDING_DETAILS.weddingDate}
                  </strong>
                </div>
              </div>

              <div className="quick-item">
                <div className="icon-badge">T</div>
                <div className="font-sans">
                  <span className="small-caps">Time</span>
                  <strong className="mt-1 block text-[17px] leading-snug">
                    {WEDDING_DETAILS.weddingTime}
                  </strong>
                </div>
              </div>

              <div className="quick-item">
                <div className="icon-badge">V</div>
                <div className="font-sans">
                  <span className="small-caps">Venue</span>
                  <strong className="mt-1 block text-[17px] leading-snug">
                    {WEDDING_DETAILS.venue.name}
                  </strong>
                  <span className="mt-1 block text-[13px] text-muted">
                    {WEDDING_DETAILS.venue.address}
                  </span>
                </div>
              </div>

              {reservedSeat ? (
                <div className="quick-item">
                  <div className="icon-badge">S</div>
                  <div className="font-sans">
                    <span className="small-caps">Reserved Seat</span>
                    <strong className="mt-1 block text-[17px] leading-snug">
                      {reservedSeat.category}, {reservedSeat.table}, Seat {reservedSeat.seat}
                    </strong>
                    <span className="mt-1 block text-[13px] text-muted">
                      {reservedSeat.name}
                      {reservedSeat.invitePath ? (
                        <>
                          {", "}
                          <a
                            className="font-bold text-emerald-deep underline"
                            href={reservedSeat.invitePath}
                          >
                            open invitation
                          </a>
                        </>
                      ) : null}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip">
                {summary.occupiedSeats} of {summary.totalSeats} seats secured
              </span>
              <span className="chip">{summary.availableSeats} still available</span>
            </div>
          </div>
        </aside>
      </div>
    </header>
  );
}