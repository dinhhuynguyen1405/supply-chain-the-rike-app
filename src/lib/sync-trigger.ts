/**
 * Fire-and-forget helper: triggers a Google Sheet sync in the background
 * without blocking the current API response.
 *
 * Usage (inside any route handler, after a successful DB write):
 *   triggerSheetSync("purchases");
 *   triggerSheetSync("products");
 *   triggerSheetSync("inbound");
 *   triggerSheetSync("fbm");
 *
 * Valid targets: "purchases" | "products" | "inventory" | "sales" |
 *                "vi_names" | "bros_inventory" | "inbound" | "fbm" | "summary" | "production" | "nhung" | "all"
 */

const BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

export function triggerSheetSync(target: string): void {
  fetch(`${BASE_URL}/api/sync/sheets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
  }).catch((err) => {
    console.warn(`[sync-trigger] background sync failed (target=${target}):`, err?.message ?? err);
  });
}
