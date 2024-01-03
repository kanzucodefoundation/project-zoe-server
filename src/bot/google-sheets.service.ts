import { google } from "googleapis";
import * as process from "process";
import { Injectable, Logger } from "@nestjs/common";

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const sheetName = process.env.GOOGLE_SPREADSHEET_SHEET_NAME;
const credentialsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

@Injectable()
export class GoogleSheetsService {
  async addRowToSheet(values: string[][]) {
    try {
      const serviceAccountAuth = new google.auth.GoogleAuth({
        keyFile: credentialsFile,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      const sheets = google.sheets({ version: "v4", auth: serviceAccountAuth });
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: sheetName,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values,
        },
      });

      Logger.log("data added successfully");
    } catch (error: any) {
      Logger.error("Error adding row:" + error);
    }
  }
}
