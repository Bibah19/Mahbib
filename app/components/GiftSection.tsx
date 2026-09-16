import CopyButton from "./CopyButton";
import QrCodeCard from "./QrCodeCard";
import { WEDDING_DETAILS } from "@/lib/wedding-config";

export default function GiftSection() {
  const { bankName, accountName, accountNumber } = WEDDING_DETAILS.gift;

  const giftQrValue = [
    "Wedding gift",
    `Bank: ${bankName}`,
    `Account name: ${accountName}`,
    `Account number: ${accountNumber}`,
  ].join("\n");

  return (
    <section id="gift" className="shell section-pad">
      <div className="glass-card grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
        <div>
          <p className="small-caps">Gift Information</p>
          <h2 className="display-title mt-3 mb-4 text-[clamp(32px,5vw,52px)]">
            Gift and account details
          </h2>
          <p className="font-sans text-[17px] leading-relaxed text-muted">
            Your presence is the greatest gift of all. If you wish to bless the couple, kindly use
            the account details below. The QR code hands the details straight to a banking app.
          </p>

          <div className="mt-6">
            <QrCodeCard value={giftQrValue} caption="Scan for gift details" />
          </div>
        </div>

        <div className="form-card">
          <div className="grid gap-3">
            <div className="detail-row">
              <div className="icon-badge">B</div>
              <div className="font-sans">
                <span className="small-caps">Bank Name</span>
                <strong className="mt-1 block text-[17px] leading-snug">{bankName}</strong>
              </div>
            </div>

            <div className="detail-row">
              <div className="icon-badge">A</div>
              <div className="font-sans">
                <span className="small-caps">Account Name</span>
                <strong className="mt-1 block text-[17px] leading-snug">{accountName}</strong>
              </div>
            </div>

            <div className="account-number-card">
              <div className="font-sans">
                <span className="small-caps">Account Number</span>
                <span className="account-number">{accountNumber}</span>
              </div>
              <CopyButton
                value={accountNumber}
                label="Copy number"
                copiedLabel="Number copied"
                className="btn btn-primary"
              />
            </div>
          </div>

          <div className="note mt-5">
            Kindly confirm your gift with the couple so it can be acknowledged properly.
          </div>
        </div>
      </div>
    </section>
  );
}