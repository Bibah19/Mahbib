/**
 * Email delivery for the personal invitation.
 *
 * Behaviour:
 *  - If RESEND_API_KEY is set, the invitation is emailed automatically through
 *    Resend's HTTP API (plain `fetch`, so no extra package is needed).
 *  - Otherwise nothing breaks: the API reports `skipped` and the website shows
 *    the confirmation plus a "Open prepared email" button.
 *
 * Optional environment variables:
 *   RESEND_API_KEY=re_xxxxxxxx
 *   EMAIL_FROM="Weddings <invites@yourdomain.com>"   (must be a verified sender)
 */

import { buildInviteBody, buildInviteSubject } from "./invite-message";
import { WEDDING_DETAILS } from "./wedding-config";
import type { Reservation } from "./types";

export type EmailStatus = "sent" | "skipped" | "failed";

export type EmailResult = {
  status: EmailStatus;
  message: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function getSenderAddress(): string {
  return process.env.EMAIL_FROM || "Wedding Invitations <onboarding@resend.dev>";
}

function buildInviteHtml(reservation: Reservation, inviteUrl: string): string {
  return `
    <div style="font-family:Georgia,'Times New Roman',serif;background:#f7f9f8;padding:32px;color:#0f1b2d">
      <div style="max-width:560px;margin:auto;background:#ffffff;border:1px solid rgba(22,55,95,.22);border-radius:24px;padding:32px">
        <p style="font-family:Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;font-size:11px;color:#0a6b51;font-weight:800;margin:0 0 18px">
          Seat confirmed
        </p>
        <h1 style="font-size:26px;margin:0 0 8px;color:#0b2340;font-weight:500">
          ${WEDDING_DETAILS.brideName} &amp; ${WEDDING_DETAILS.groomName}
        </h1>
        <p style="color:#55667a;margin:0 0 22px">
          Dear ${reservation.name}, your seat is secured. We cannot wait to celebrate with you.
        </p>
        <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse;width:100%">
          <tr><td style="padding:8px 0;color:#55667a">Invite category</td><td style="padding:8px 0;font-weight:700">${reservation.category}</td></tr>
          <tr><td style="padding:8px 0;color:#55667a">Table</td><td style="padding:8px 0;font-weight:700">${reservation.table}</td></tr>
          <tr><td style="padding:8px 0;color:#55667a">Seat number</td><td style="padding:8px 0;font-weight:700">${reservation.seat}</td></tr>
          <tr><td style="padding:8px 0;color:#55667a">Invite code</td><td style="padding:8px 0;font-weight:700">${reservation.inviteCode}</td></tr>
        </table>
        <p style="font-family:Arial,sans-serif;font-size:14px;color:#55667a;margin:22px 0 0">
          ${WEDDING_DETAILS.weddingDate}, ${WEDDING_DETAILS.weddingTime}<br />
          ${WEDDING_DETAILS.venue.name}, ${WEDDING_DETAILS.venue.address}
        </p>
        <p style="margin:26px 0 0">
          <a href="${inviteUrl}" style="background:#0a6b51;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:16px;font-family:Arial,sans-serif;font-weight:700;font-size:14px;display:inline-block">
            Open my invitation
          </a>
        </p>
      </div>
    </div>
  `;
}

/** Sends (or intentionally skips) the invitation email. Never throws. */
export async function sendInviteEmail(
  reservation: Reservation,
  inviteUrl: string,
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { status: "skipped", message: "Automatic email is not configured." };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getSenderAddress(),
        to: [reservation.email],
        reply_to: WEDDING_DETAILS.contactEmail,
        subject: buildInviteSubject(reservation),
        text: buildInviteBody(reservation, inviteUrl),
        html: buildInviteHtml(reservation, inviteUrl),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Resend rejected the invitation email:", response.status, detail);
      return { status: "failed", message: "The invitation email could not be sent." };
    }

    return { status: "sent", message: "Invitation email sent." };
  } catch (error) {
    console.error("Invitation email failed:", error);
    return { status: "failed", message: "The invitation email could not be sent." };
  }
}