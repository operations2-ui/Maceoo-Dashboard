import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

function parseServiceAccountJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    // allow the key to be stored base64-encoded, since some hosts (Vercel included)
    // are fussier about multi-line/quote-heavy env var values than plain JSON
    return JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  }
}

function getAuth() {
  const inlineKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (inlineKey) {
    return new google.auth.GoogleAuth({
      credentials: parseServiceAccountJson(inlineKey),
      scopes: SCOPES,
    });
  }

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (keyPath) {
    return new google.auth.GoogleAuth({ keyFile: keyPath, scopes: SCOPES });
  }

  throw new Error("Neither GOOGLE_SERVICE_ACCOUNT_KEY nor GOOGLE_SERVICE_ACCOUNT_KEY_PATH is set");
}

export function getDriveClient() {
  return google.drive({ version: "v3", auth: getAuth() });
}

export function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}
