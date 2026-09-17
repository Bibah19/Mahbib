import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/app/components/Footer";
import QrCodeCard from "@/app/components/QrCodeCard";
import ShareButton from "@/app/components/ShareButton";
import SiteNav from "@/app/components/SiteNav";
import { getReservationByInviteCode } from "@/lib/reservations";
import { normaliseInviteCode } from "@/lib/validation";
import {
  WEDDING_DETAILS,
  getDirectionsUrl,
  getGoogleMapsUrl,
  getShareDirectionText,
} from "@/lib/wedding-config";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: InvitePageProps): Promise<Metadata> {
  const { code } = await params;
  const normalised = normaliseInviteCode(code);
  const reservation = normalised ? await getReservationByInviteCode(normalised) : null;

  return {
    title: reservation
      ? `${reservation.name}, Seat ${reservation.seat} confirmed`
      : "Invitation not found",
    robots: { index: false, follow: false },
  };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const normalised = normaliseInviteCode(code);
  const reservation = normalised ? await getReservationByInviteCode(normalised) : null;

  if (!reservation) notFound();

  const details = [
    { icon: "N", label: "Invitee Name", value: reservation.name },
    { icon: "C", label: "Invite Category", value: reservation.category },
    { icon: "T", label: "Table", value: reservation.table },
    { icon: "S", label: "Seat Number", value: String(reservation.seat) },
    { icon: "K", label: "Invite Code", value: reservation.inviteCode },
  ];

  return (
    <>
      <SiteNav />

      <main className="shell section-pad">
        <div className="glass-card inset-frame p-6 sm:p-10">
          <div className="text-center">
            <p className="small-caps">Seat confirmed</p>
            <div className="section-rule my-5" />
            <h1 className="display-title m-0 text-[clamp(34px,6vw,62px)]">
              <span>{WEDDING_DETAILS.brideName}</span>
              <span className="amp">&amp;</span>
              <span>{WEDDING_DETAILS.groomName}</span>
            </h1>
            <p className="hero-subtitle">
              Dear {reservation.name}, your seat is secured. We cannot wait to celebrate with you.
            </p>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
            <div className="grid gap-3">
              {details.map((item) => (
                <div className="detail-row" key={item.label}>
                  <div className="icon-badge">{item.icon}</div>
                  <div className="font-sans">
                    <span className="small-caps">{item.label}</span>
                    <strong className="mt-1 block text-[17px] leading-snug">{item.value}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid content-start gap-4">
              <QrCodeCard value={getDirectionsUrl()} caption="Scan for directions" />

              <div className="summary-panel">
                <p className="small-caps">Wedding</p>
                <p className="mt-3 mb-0 font-sans text-[15px] leading-relaxed text-muted">
                  {WEDDING_DETAILS.weddingDate}, {WEDDING_DETAILS.weddingTime}
                  <br />
                  {WEDDING_DETAILS.venue.name}
                  <br />
                  {WEDDING_DETAILS.venue.address}
                  <br />
                  Dress code: {WEDDING_DETAILS.dressCode}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              className="btn btn-primary"
              href={getDirectionsUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get directions
            </a>
            <a
              className="btn btn-secondary"
              href={getGoogleMapsUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Google Maps
            </a>
            <ShareButton
              label="Share the venue"
              title={`Directions to ${WEDDING_DETAILS.venue.name}`}
              text={getShareDirectionText()}
            />
            <Link className="btn btn-secondary" href="/">
              Back to the invitation
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}