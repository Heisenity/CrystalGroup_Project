import "server-only";

import { google } from "googleapis";
import { Review, ReviewPayload } from "@/lib/types";
import { getMonthKey } from "@/lib/utils";

const REVIEW_HEADERS = [
  "timestamp",
  "monthKey",
  "employeeEmail",
  "employeeName",
  "managerEmail",
  "outputQuality",
  "attendance",
  "teamwork",
  "comment",
];

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getSheetsClient() {
  const clientEmail = getEnv("GOOGLE_CLIENT_EMAIL");
  const privateKey = getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

async function getPrimarySheetTitle(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title,index))",
  });

  const sortedSheets =
    response.data.sheets
      ?.map((sheet) => ({
        title: sheet.properties?.title,
        index: sheet.properties?.index ?? 0,
      }))
      .filter((sheet): sheet is { title: string; index: number } => Boolean(sheet.title))
      .sort((a, b) => a.index - b.index) ?? [];

  if (sortedSheets.length === 0) {
    throw new Error("No sheet tabs found in the spreadsheet");
  }

  return sortedSheets[0].title;
}

async function ensureHeaderRow(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetTitle: string,
) {
  const headerRange = `${sheetTitle}!A1:I1`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange,
  });

  const currentHeader = response.data.values?.[0] ?? [];
  const matches =
    currentHeader.length === REVIEW_HEADERS.length &&
    currentHeader.every((value, index) => value === REVIEW_HEADERS[index]);

  if (matches) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: headerRange,
    valueInputOption: "RAW",
    requestBody: {
      values: [REVIEW_HEADERS],
    },
  });
}

function mapRowToReview(row: string[]): Review {
  return {
    timestamp: row[0],
    monthKey: row[1],
    employeeEmail: row[2],
    employeeName: row[3],
    managerEmail: row[4],
    outputQuality: Number(row[5]),
    attendance: Number(row[6]),
    teamwork: Number(row[7]),
    comment: row[8],
  };
}

export async function appendReview(payload: ReviewPayload) {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv("GOOGLE_SHEET_ID");
  const timestamp = new Date().toISOString();
  const sheetTitle = await getPrimarySheetTitle(sheets, spreadsheetId);
  const sheetRange = `${sheetTitle}!A:I`;

  await ensureHeaderRow(sheets, spreadsheetId, sheetTitle);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sheetRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          timestamp,
          getMonthKey(new Date(timestamp)),
          payload.employeeEmail,
          payload.employeeName,
          payload.managerEmail,
          payload.outputQuality,
          payload.attendance,
          payload.teamwork,
          payload.comment,
        ],
      ],
    },
  });

  return { ok: true };
}

export async function getReviews(employeeEmail?: string) {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv("GOOGLE_SHEET_ID");
  const sheetTitle = await getPrimarySheetTitle(sheets, spreadsheetId);
  const sheetRange = `${sheetTitle}!A:I`;

  await ensureHeaderRow(sheets, spreadsheetId, sheetTitle);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange,
  });

  const rows = response.data.values ?? [];
  if (rows.length <= 1) {
    return [] as Review[];
  }

  const dataRows = rows.slice(1).map(mapRowToReview);
  const filtered = employeeEmail
    ? dataRows.filter((review) => review.employeeEmail === employeeEmail)
    : dataRows;

  return filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
