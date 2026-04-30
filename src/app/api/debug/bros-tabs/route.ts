import { getSheetsClient } from "@/lib/google";

const BROS_SPREADSHEET_ID = "1I_IQNSq8iZPM-MqyjswYN5juJo6xadudRBU8Pwcj5WI";

export async function GET() {
  const sheets = await getSheetsClient();

  const results: Record<string, { headers: string[]; rowCount: number; sample: string[][] }> = {};
  const tabs = ["Inbound Information", "FBM Order", "Inventory"];

  for (const tab of tabs) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: BROS_SPREADSHEET_ID,
      range: `${tab}!A1:Z30`,
    });
    const rows = (res.data.values ?? []) as string[][];
    results[tab] = {
      headers: rows[0] ?? [],
      rowCount: rows.length,
      sample: rows.slice(0, 5),
    };
  }

  return Response.json(results);
}
