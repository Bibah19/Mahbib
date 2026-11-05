/**
 * Personalised invitation card, rendered to a PNG with Satori (next/og).
 * Used by the card route, the invite page and the invitation email.
 *
 * Satori only supports a subset of CSS: every element with more than one child
 * must be `display: flex`, and fonts must be static TTF/OTF/WOFF files.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";

import type { Reservation } from "./types";
import {
  WEDDING_DETAILS,
  getCoupleMonogram,
  getDirectionsUrl,
} from "./wedding-config";

export const INVITE_CARD_WIDTH = 1080;
export const INVITE_CARD_HEIGHT = 1500;

const NAVY = "#16375f";
const NAVY_DEEP = "#0b2340";
const EMERALD = "#0a6b51";
const IVORY = "#f7f9f8";
const ASH = "#ccd5d8";
const MUTED = "#55667a";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

type CardFont = {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 600;
  style: "normal" | "italic";
};

let fontsPromise: Promise<CardFont[]> | undefined;

function loadFonts(): Promise<CardFont[]> {
  fontsPromise ??= (async () => {
    const files: [string, string, CardFont["weight"], CardFont["style"]][] = [
      ["Cormorant", "cormorant-garamond-latin-500-normal.woff", 500, "normal"],
      ["Cormorant", "cormorant-garamond-latin-600-normal.woff", 600, "normal"],
      ["Cormorant", "cormorant-garamond-latin-400-italic.woff", 400, "italic"],
      ["Inter", "inter-latin-400-normal.woff", 400, "normal"],
      ["Inter", "inter-latin-600-normal.woff", 600, "normal"],
    ];
    return Promise.all(
      files.map(async ([name, file, weight, style]) => ({
        name,
        data: await readFile(path.join(FONT_DIR, file)),
        weight,
        style,
      })),
    );
  })().catch((error) => {
    fontsPromise = undefined;
    throw error;
  });
  return fontsPromise;
}

/** Longer names get a smaller type size so they always fit on one or two lines. */
function nameFontSize(name: string): number {
  const length = name.length;
  if (length <= 14) return 92;
  if (length <= 22) return 74;
  if (length <= 32) return 58;
  return 46;
}

function Diamond({ color = EMERALD, size = 14 }: { color?: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: color,
        transform: "rotate(45deg)",
        display: "flex",
      }}
    />
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ display: "flex", width: 150, height: 2, background: ASH }} />
      <Diamond />
      <div style={{ display: "flex", width: 150, height: 2, background: ASH }} />
    </div>
  );
}

function Corner({ top, left }: { top?: boolean; left?: boolean }) {
  // Satori rejects `undefined` style values, so only set the sides we need.
  const border = `4px solid ${EMERALD}`;
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        width: 54,
        height: 54,
        ...(top ? { top: 54, borderTop: border } : { bottom: 54, borderBottom: border }),
        ...(left ? { left: 54, borderLeft: border } : { right: 54, borderRight: border }),
      }}
    />
  );
}

function DetailCell({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string;
  /** Cormorant uses old-style figures; numbers read better in Inter. */
  numeric?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
        gap: 8,
        padding: "0 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: "Inter",
          fontWeight: 600,
          fontSize: 17,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: "#9fe3cd",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: numeric ? "Inter" : "Cormorant",
          fontWeight: 600,
          fontSize: numeric ? 40 : 38,
          lineHeight: 1.15,
          color: "#ffffff",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function shortTableName(table: string): string {
  return table.replace(/^table\s*/i, "") || table;
}

async function buildQrDataUrl(): Promise<string> {
  return QRCode.toDataURL(getDirectionsUrl(), {
    margin: 0,
    width: 240,
    color: { dark: NAVY_DEEP, light: "#ffffff" },
  });
}

/** Renders the guest's personalised card as PNG bytes. */
export async function renderInviteCard(
  reservation: Reservation,
): Promise<ArrayBuffer> {
  const [fonts, qr] = await Promise.all([loadFonts(), buildQrDataUrl()]);
  const { venue } = WEDDING_DETAILS;
  const guestName = reservation.name.trim();

  const image = new ImageResponse(
    (
      <div
        style={{
          width: INVITE_CARD_WIDTH,
          height: INVITE_CARD_HEIGHT,
          display: "flex",
          position: "relative",
          background: IVORY,
          padding: 36,
        }}
      >
        {/* Outer and inner frame */}
        <div
          style={{
            display: "flex",
            flex: 1,
            border: `3px solid ${NAVY}`,
            padding: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              alignItems: "center",
              border: `1px solid ${ASH}`,
              background: "#ffffff",
              padding: "70px 70px 0 70px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: 20,
                letterSpacing: 8,
                textTransform: "uppercase",
                color: EMERALD,
              }}
            >
              The wedding of
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginTop: 34,
                fontFamily: "Cormorant",
                fontWeight: 500,
                color: NAVY_DEEP,
              }}
            >
              <div style={{ display: "flex", fontSize: 112, lineHeight: 1 }}>
                {WEDDING_DETAILS.brideName}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 70,
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: EMERALD,
                  lineHeight: 1.1,
                }}
              >
                &amp;
              </div>
              <div style={{ display: "flex", fontSize: 112, lineHeight: 1 }}>
                {WEDDING_DETAILS.groomName}
              </div>
            </div>

            <div style={{ display: "flex", marginTop: 44 }}>
              <Divider />
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 40,
                fontFamily: "Cormorant",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: 36,
                color: MUTED,
              }}
            >
              request the honour of the company of
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                textAlign: "center",
                marginTop: 14,
                maxWidth: 900,
                fontFamily: "Cormorant",
                fontWeight: 600,
                fontSize: nameFontSize(guestName),
                lineHeight: 1.1,
                color: EMERALD,
              }}
            >
              {guestName}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginTop: 34,
                fontFamily: "Inter",
                fontSize: 25,
                lineHeight: 1.5,
                color: NAVY_DEEP,
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", fontWeight: 600 }}>
                {WEDDING_DETAILS.weddingDate} at {WEDDING_DETAILS.weddingTime}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  color: MUTED,
                  maxWidth: 820,
                  justifyContent: "center",
                }}
              >
                {venue.name}
              </div>
              <div style={{ display: "flex", marginTop: 8, color: MUTED }}>
                Dress code: {WEDDING_DETAILS.dressCode}
              </div>
            </div>

            {/* Seat strip + QR code, pushed to the bottom */}
            <div
              style={{
                display: "flex",
                marginTop: "auto",
                width: "100%",
                alignItems: "stretch",
                gap: 26,
                marginBottom: 70,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  justifyContent: "center",
                  background: NAVY_DEEP,
                  padding: "34px 20px",
                  gap: 30,
                }}
              >
                <div style={{ display: "flex", width: "100%" }}>
                  <DetailCell numeric label="Table" value={shortTableName(reservation.table)} />
                  <DetailCell numeric label="Seat" value={String(reservation.seat)} />
                </div>
                <div style={{ display: "flex", width: "100%" }}>
                  <DetailCell label="Category" value={reservation.category} />
                  <DetailCell label="Invite code" value={reservation.inviteCode} />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  padding: 20,
                  border: `2px solid ${ASH}`,
                  background: "#ffffff",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} width={200} height={200} alt="" />
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Inter",
                    fontWeight: 600,
                    fontSize: 15,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    color: MUTED,
                  }}
                >
                  Scan for directions
                </div>
              </div>
            </div>
          </div>
        </div>

        <Corner top left />
        <Corner top />
        <Corner left />
        <Corner />

        {/* Monogram seal straddling the top edge of the frame */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: (INVITE_CARD_WIDTH - 118) / 2,
            width: 118,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: IVORY,
            fontFamily: "Cormorant",
            fontWeight: 600,
            fontSize: 30,
            color: NAVY,
          }}
        >
          {getCoupleMonogram()}
        </div>
      </div>
    ),
    {
      width: INVITE_CARD_WIDTH,
      height: INVITE_CARD_HEIGHT,
      fonts,
    },
  );

  return image.arrayBuffer();
}

/** Safe filename such as `Invitation-Ada-Obi.png`. */
export function inviteCardFilename(reservation: Reservation): string {
  const slug = reservation.name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `Invitation-${slug || reservation.inviteCode}.png`;
}
