import { google } from "googleapis";

export const SPREADSHEET_ID =
  process.env.SHEET_ID ?? "17-7hAjXUFwTGYtfvyp0dyjoq0M3UZA0E6MNJWqrU-Cg";

// Đã cấu hình service account chưa?
export function isSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY,
  );
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Private key trong env thường có \n bị escape thành \\n -> khôi phục lại
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error(
      "Chưa cấu hình GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY",
    );
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}
