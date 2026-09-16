import { WEDDING_DETAILS } from "@/lib/wedding-config";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="accent-rule w-[min(430px,82%)]" />
      <p>A celebration of love, laughter, and happily ever after</p>
      <p className="mt-4 font-sans text-[13px] font-normal text-muted not-italic">
        {WEDDING_DETAILS.brideName} &amp; {WEDDING_DETAILS.groomName},{" "}
        {WEDDING_DETAILS.weddingDate}, {WEDDING_DETAILS.venue.name}
      </p>
    </footer>
  );
}