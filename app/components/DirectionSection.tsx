import QrCodeCard from "./QrCodeCard";
import ShareButton from "./ShareButton";
import {
  WEDDING_DETAILS,
  getDirectionSentence,
  getDirectionsUrl,
  getGoogleMapsUrl,
  getShareDirectionText,
} from "@/lib/wedding-config";

export default function DirectionSection() {
  const directionsUrl = getDirectionsUrl();

  return (
    <section id="direction" className="shell section-pad">
      <div className="glass-card grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
        <div>
          <p className="small-caps">Direction</p>
          <h2 className="display-title mt-3 mb-4 text-[clamp(32px,5vw,52px)]">
            How to get to the venue
          </h2>
          <p className="font-sans text-[17px] leading-relaxed text-muted">
            {getDirectionSentence()}
          </p>
          <p className="mt-3 font-sans text-[14px] leading-relaxed text-muted">
            Scan the code or tap a button to hand the route to Google Maps on your phone.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              className="btn btn-primary"
              href={directionsUrl}
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
              label="Share direction"
              title={`Directions to ${WEDDING_DETAILS.venue.name}`}
              text={getShareDirectionText()}
            />
          </div>

          <p className="mt-5 mb-0 font-sans text-[13px] text-muted">
            {WEDDING_DETAILS.venue.name}, {WEDDING_DETAILS.venue.address}
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <QrCodeCard value={directionsUrl} caption="Scan for directions" />
          <p className="m-0 max-w-[240px] text-center font-sans text-[12px] text-muted">
            The QR code opens the exact venue pin in the guest&apos;s map app.
          </p>
        </div>
      </div>
    </section>
  );
}