import nodemailer from "nodemailer";
import type { SoldNegativeRow, RetailAuditDetailRow } from "@/lib/reports";

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

function physicalStockCountHtml(storeName: string, poNumber: string, rows: RetailAuditDetailRow[]): string {
  const tableRows = rows
    .map(
      (r) => `
        <tr>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0;">${r.sku}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0;">${r.item_name ?? ""}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${r.quantity_shipped ?? "—"}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${r.quantity_received ?? "—"}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #dc2626; font-weight: 600;">${r.diff_shipped_received ?? "—"}</td>
        </tr>`,
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;">
      <h2 style="margin-bottom: 4px;">📦 Physical Stock Count Request – ${poNumber}</h2>
      <p style="color: #64748b; margin-top: 0;">${storeName}</p>
      <p>Dear Team,</p>
      <p>For Purchase Order <strong>${poNumber}</strong>, the system shows fewer units received than were shipped
      for the SKUs listed below.</p>
      <p><strong>Action Required:</strong><br/>
      Please physically count the current on-hand quantity for these SKUs at your store and reply to this email
      with the actual counts, so we can reconcile against system stock and receive any remaining quantity that's
      genuinely on hand but not yet recorded.</p>
      <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 6px 10px; text-align: left;">SKU</th>
            <th style="padding: 6px 10px; text-align: left;">Item Name</th>
            <th style="padding: 6px 10px; text-align: right;">Shipped</th>
            <th style="padding: 6px 10px; text-align: right;">Received</th>
            <th style="padding: 6px 10px; text-align: right;">Difference</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      <p style="margin-top: 16px;">Regards,<br/>Inventory Control System</p>
    </div>
  `;
}

export async function sendPhysicalStockCountRequest(opts: {
  to: string;
  cc?: string | null;
  storeName: string;
  poNumber: string;
  rows: RetailAuditDetailRow[];
}): Promise<void> {
  const { to, cc, storeName, poNumber, rows } = opts;
  await getTransporter().sendMail({
    from: process.env.GMAIL_USER,
    to,
    cc: cc ?? undefined,
    subject: `Physical Stock Count Request – ${poNumber} – ${storeName}`,
    html: physicalStockCountHtml(storeName, poNumber, rows),
  });
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
