import QRCode from "qrcode";

type QrCodeCardProps = {
  /** What the guest gets after scanning. */
  value: string;
  caption: string;
};

/**
 * Real, scannable QR code rendered as an inline SVG on the server.
 * The colours match the invitation palette (emerald on white).
 */
export default async function QrCodeCard({ value, caption }: QrCodeCardProps) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#07311f",
      light: "#ffffff",
    },
  });

  return (
    <figure className="qr-card m-0">
      <div
        className="mx-auto flex max-w-[190px] justify-center"
        // The SVG is generated on the server from our own strings.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="sr-only">{caption}</figcaption>
      <p>{caption}</p>
    </figure>
  );
}