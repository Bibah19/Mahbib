import { inviteCardFilename, renderInviteCard } from "@/lib/invite-card";
import { getReservationByInviteCode } from "@/lib/reservations";
import { normaliseInviteCode } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalised = normaliseInviteCode(code);
  const reservation = normalised
    ? await getReservationByInviteCode(normalised)
    : null;

  if (!reservation) {
    return new Response("Invitation not found", { status: 404 });
  }

  try {
    const png = await renderInviteCard(reservation);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${inviteCardFilename(reservation)}"`,
        "Cache-Control": "private, max-age=300",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("Invitation card failed:", error);
    return new Response("The invitation card could not be created.", {
      status: 500,
    });
  }
}
