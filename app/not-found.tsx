import Link from "next/link";
import { WEDDING_DETAILS } from "@/lib/wedding-config";

export default function NotFound() {
  return (
    <main className="shell section-pad">
      <div className="glass-card inset-frame p-8 text-center sm:p-14">
        <p className="small-caps">Invitation not found</p>
        <div className="section-rule my-5" />
        <h1 className="display-title m-0 text-[clamp(30px,5vw,48px)]">
          We could not find that invitation
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-sans text-[16px] leading-relaxed text-muted">
          The invite code may have been typed incorrectly, or the link was cut in half by your
          messaging app. Please check the code from your invitation message, or reserve a seat again
          for the wedding of {WEDDING_DETAILS.brideName} &amp; {WEDDING_DETAILS.groomName}.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link className="btn btn-primary" href="/#secure-seat">
            Reserve a seat
          </Link>
          <Link className="btn btn-secondary" href="/">
            Back to the invitation
          </Link>
        </div>
      </div>
    </main>
  );
}