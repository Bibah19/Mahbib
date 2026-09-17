import EnvelopeIntro from "@/app/components/EnvelopeIntro";
import { existsSync } from "node:fs";
import path from "node:path";
import Details from "@/app/components/Details";
import DirectionSection from "@/app/components/DirectionSection";
import Footer from "@/app/components/Footer";
import Hero from "@/app/components/Hero";
import SeatReservation from "@/app/components/SeatReservation";
import SiteNav from "@/app/components/SiteNav";
import { getAvailability, getReservationBySeat, getSeatSummary } from "@/lib/reservations";
import { isKnownTable, isValidSeat } from "@/lib/seating";

/** The page reads live seat data, so it must render on every request. */
export const dynamic = "force-dynamic";

/** True when the couple's photo has been dropped into `public/couple.jpg`. */
function hasCouplePhoto(): boolean {
  try {
    return existsSync(path.join(process.cwd(), "public", "couple.jpg"));
  } catch {
    return false;
  }
}

type HomePageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const availability = await getAvailability();
  const summary = await getSeatSummary();

  // Guests arriving from a saved invite link: /?guest=…&category=…&table=…&seat=…
  const guest = firstValue(params.guest).trim();
  const category = firstValue(params.category).trim();
  const table = firstValue(params.table).trim();
  const seatNumber = Number(firstValue(params.seat));

  let reservedSeat = null;

  if (
    guest &&
    category &&
    table &&
    Number.isInteger(seatNumber) &&
    isKnownTable(category, table) &&
    isValidSeat(category, table, seatNumber)
  ) {
    const existing = await getReservationBySeat(category, table, seatNumber);

    reservedSeat = {
      name: existing?.name ?? guest,
      category,
      table,
      seat: String(seatNumber),
      invitePath: existing ? `/invite/${existing.inviteCode}` : undefined,
    };
  }

  return (
    <>
      <EnvelopeIntro />
      <SiteNav />
      <Hero hasCouplePhoto={hasCouplePhoto()} summary={summary} reservedSeat={reservedSeat} />
      <main>
        <Details />
        <SeatReservation initialAvailability={availability} />
        <DirectionSection />
      </main>
      <Footer />
    </>
  );
}
