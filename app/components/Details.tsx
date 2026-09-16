import VenueMap from "./VenueMap";
import { WEDDING_DETAILS, getDirectionSentence } from "@/lib/wedding-config";

export default function Details() {
  return (
    <section id="details" className="shell section-pad">
      <div className="glass-card grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
        <div>
          <p className="small-caps">Wedding Details</p>
          <h2 className="display-title mt-3 mb-4 text-[clamp(32px,5vw,52px)]">
            Celebrate with us in style
          </h2>
          <p className="font-sans text-[17px] leading-relaxed text-muted">
            Every invitee reserves a seat from their own category. The seat map below is the
            real location of the celebration. Drag it, zoom it and open the directions when you
            are ready to travel.
          </p>

          <div className="mt-5 grid gap-3">
            <div className="detail-row">
              <div className="icon-badge">D</div>
              <div className="font-sans">
                <span className="small-caps">Date</span>
                <strong className="mt-1 block text-[17px] leading-snug">
                  {WEDDING_DETAILS.weddingDate}
                </strong>
              </div>
            </div>

            <div className="detail-row">
              <div className="icon-badge">T</div>
              <div className="font-sans">
                <span className="small-caps">Time</span>
                <strong className="mt-1 block text-[17px] leading-snug">
                  {WEDDING_DETAILS.weddingTime}
                </strong>
              </div>
            </div>

            <div className="detail-row">
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

            <div className="detail-row">
              <div className="icon-badge">C</div>
              <div className="font-sans">
                <span className="small-caps">Dress Code</span>
                <strong className="mt-1 block text-[17px] leading-snug">
                  {WEDDING_DETAILS.dressCode}
                </strong>
              </div>
            </div>

            <div className="detail-row">
              <div className="icon-badge">N</div>
              <div className="font-sans">
                <span className="small-caps">If you need help finding it</span>
                <strong className="mt-1 block text-[15px] leading-snug font-medium text-muted">
                  {getDirectionSentence()}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <VenueMap />
      </div>
    </section>
  );
}