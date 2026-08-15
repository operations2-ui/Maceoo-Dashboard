import nodemailer from "nodemailer";
import type { SoldNegativeRow } from "@/lib/reports";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
      throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set to send email");
    }
    transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  }
  return transporter;
}

function oversellEmailHtml(storeName: string, date: string, rows: SoldNegativeRow[]): string {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;">
      <h2 style="margin-bottom: 4px;">⚠️ Prior-Day Oversell Alert – ${storeName}</h2>
      <p style="color: #64748b; margin-top: 0;">${date}</p>
      <p>Dear Team,</p>
      <p>This is to inform you that <strong>Prior-Day Oversell</strong> has been identified in your store for <strong>${date}</strong>.</p>
      <p><strong>📌 What does this mean?</strong><br/>
      These SKUs are showing negative on-hand quantity that isn't fully explained by ${date}'s recorded sales —
      meaning the shortfall likely existed before that day, or something beyond that day's sales caused it.</p>
      <p><strong>⚠️ Possible Reasons:</strong></p>
      <ul>
        <li>Stock issued but not properly recorded</li>
        <li>Incorrect GRN (Goods Receipt Entry)</li>
        <li>Delay in updating inward entries</li>
        <li>Manual adjustment errors</li>
        <li>Mismatch between physical and system stock</li>
      </ul>
      <p><strong>✂️ Action Required:</strong><br/>
      Please review the attached report (${rows.length} item${rows.length === 1 ? "" : "s"}) and take necessary
      corrective action at the earliest.</p>
      <p>Regards,<br/>Inventory Control System</p>
    </div>
  `;
}

export async function sendOversellAlert(opts: {
  to: string;
  cc?: string | null;
  storeName: string;
  date: string;
  rows: SoldNegativeRow[];
  attachment: Buffer;
}): Promise<void> {
  const { to, cc, storeName, date, rows, attachment } = opts;
  await getTransporter().sendMail({
    from: process.env.GMAIL_USER,
    to,
    cc: cc ?? undefined,
    subject: `Prior-Day Oversell Alert – ${storeName} – ${date}`,
    html: oversellEmailHtml(storeName, date, rows),
    attachments: [
      {
        filename: `prior-day-oversell_${storeName.replace(/\s+/g, "-")}_${date}.xlsx`,
        content: attachment,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });
}
