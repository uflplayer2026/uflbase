import { createServerFn } from "@tanstack/react-start";

export type PlayerCardRecord = {
  id: string;
  playerName: string;
  ovr: number | null;
  position: string;
  nation: string;
  pac: number | null;
  sho: number | null;
  pas: number | null;
  dri: number | null;
  def: number | null;
  phy: number | null;
  perk: string;
  cardImage: string;
};

const SPREADSHEET_ID = "18nnOuoFMsH4iJmoYR6rfeqPL6DKRv6cGOh3GNdo9MZU";
const SHEET_RANGE = "Sheet1!A2:L";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

const text = (row: string[], i: number) => (row[i] ?? "").toString().trim();

const num = (row: string[], i: number) => {
  const raw = text(row, i);
  if (raw === "") return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

export const getPlayerCards = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlayerCardRecord[]> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["GOOGLE_SHEETS_API_KEY"];

    if (!lovableKey || !connectionKey) {
      throw new Error(
        "Google Sheets is not configured yet. Connect the Google Sheets integration in Lovable, then reload this page.",
      );
    }

    const res = await fetch(
      `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_RANGE}?majorDimension=ROWS`,
      {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connectionKey,
        },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`Google Sheets read failed [${res.status}]: ${body}`);
      throw new Error(
        `The player sheet could not be read (error ${res.status}). Check that the connected Google account can open the sheet.`,
      );
    }

    const json = (await res.json()) as { values?: string[][] };
    const rows = json.values ?? [];

    return rows
      .filter((row) => row.some((cell) => (cell ?? "").toString().trim() !== ""))
      .map((row, index) => ({
        id: `${index}-${text(row, 0)}`,
        playerName: text(row, 0),
        ovr: num(row, 1),
        position: text(row, 2),
        nation: text(row, 3),
        pac: num(row, 4),
        sho: num(row, 5),
        pas: num(row, 6),
        dri: num(row, 7),
        def: num(row, 8),
        phy: num(row, 9),
        perk: text(row, 10),
        cardImage: text(row, 11),
      }));
  },
);
