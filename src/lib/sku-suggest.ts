/**
 * sku-suggest.ts — Sinh SKU chuẩn nhất quán.
 *
 * Format: mmHHDDMMYYYY
 *
 *   SKU = phút+giờ+ngày+tháng+năm tạo listing — chuỗi số thuần 12 chữ số.
 *   Mỗi SKU tạo ra tại một thời điểm khác nhau là duy nhất tuyệt đối.
 *   Không có prefix chữ cái, không có size suffix → barcode thuần số, scan nhanh.
 *
 * Ví dụ (tạo lúc 14:35 ngày 18/05/2026):
 *   → 353518052026
 *
 * suggestSku / suggestSkuFromGroup vẫn giữ nguyên để dùng khi cần prefix,
 * nhưng hàm chính để tạo SKU mới là datePart() dùng trực tiếp.
 */

// ── Vietnamese diacritic removal ─────────────────────────────────────────────

const VI_MAP: [RegExp, string][] = [
  [/[àáảãạăắằẳẵặâấầẩẫậ]/g, "a"],
  [/[ÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬ]/g, "A"],
  [/[èéẻẽẹêếềểễệ]/g, "e"],
  [/[ÈÉẺẼẸÊẾỀỂỄỆ]/g, "E"],
  [/[ìíỉĩị]/g, "i"],
  [/[ÌÍỈĨỊ]/g, "I"],
  [/[òóỏõọôốồổỗộơớờởỡợ]/g, "o"],
  [/[ÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢ]/g, "O"],
  [/[ùúủũụưứừửữự]/g, "u"],
  [/[ÙÚỦŨỤƯỨỪỬỮỰ]/g, "U"],
  [/[ỳýỷỹỵ]/g, "y"],
  [/[ỲÝỶỸỴ]/g, "Y"],
  [/[đ]/g, "d"],
  [/[Đ]/g, "D"],
];

function removeViDiacritics(s: string): string {
  let r = s;
  for (const [re, ch] of VI_MAP) r = r.replace(re, ch);
  return r.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ── English stop words (dùng khi không có nameVi) ────────────────────────────

const EN_STOP = new Set([
  "a","an","and","are","as","at","be","been","by","do","for","from","had",
  "has","have","he","her","his","how","i","in","is","it","its","me","my",
  "of","on","or","our","she","so","than","that","the","their","them","then",
  "there","they","this","to","up","us","was","we","were","what","when",
  "where","which","who","will","with","you","your",
  "seeds","seed","seedlings","grow","growing","grown","plant","plants",
  "planting","garden","natural","organic","fresh","pure","dried","bulk",
  "premium","quality","best","top","new","usa","mix","all","live","wild",
  "non","gmo","pack","packs","kit","set","bag","box","bundle","lot",
  "each","per","unit","ounce","ounces","pound","pounds","make","diy",
  "traditional","delicious","authentic","edible","medicinal","native",
  "exotic","rare","special","rich","easy","quick","simple",
]);

// ── Size/quantity suffix ──────────────────────────────────────────────────────

function extractSuffix(name: string): string {
  // "2 pack x 400 seeds/g/kg..." — detect unit anywhere in string
  const packX = name.match(/(\d+)\s*(?:pack\s*x|x)\s*(\d+)/i);
  if (packX) {
    const unitMatch = name.match(/\d\s*(g|gram|grams|kg|lb|lbs|oz)\b/i)
      ?? name.match(/\b(seeds?|g|gram|grams|kg|lb|lbs|oz|bulbs?|pcs?)\b/i);
    const u = (unitMatch?.[1] ?? "").replace(/s$/i, "").toLowerCase();
    const c = u === "seed" ? "S" : u === "bulb" ? "B"
      : u === "g" || u === "gram" ? "G"
      : u === "kg" ? "KG" : u === "lb" ? "LB" : u === "oz" ? "OZ"
      : u === "pc" ? "PC" : "X";
    return `-${packX[1]}PX${packX[2]}${c}`;
  }

  // Weight: "200g", "1.5kg", "16oz"
  const wm = name.match(/(\d+(?:\.\d+)?)\s*(g|gram|grams|kg|lb|lbs|oz)\b/i);
  if (wm) {
    const u = wm[2].toLowerCase();
    const c = u === "g" || u === "gram" || u === "grams" ? "G"
      : u === "kg" ? "KG" : u === "lb" || u === "lbs" ? "LB" : "OZ";
    return `-${wm[1]}${c}`;
  }

  // Count: "3000 seeds", "10 bulbs"
  const cm = name.match(/(\d+)\s*(seeds?|bulbs?|pcs?|pieces?|plants?|slips?|tubers?)\b/i);
  if (cm) {
    const u = cm[2].replace(/s$/i, "").toLowerCase();
    const c = u === "seed" ? "S" : u === "bulb" ? "B" : "PC";
    return `-${cm[1]}${c}`;
  }

  return "";
}

// ── Date helper ───────────────────────────────────────────────────────────────

function datePart(date?: Date): string {
  const d = date ?? new Date();
  const min  = String(d.getMinutes()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  // Format: mmHHDDMMYYYY — e.g. "353518052026" for 14:35 on May 18 2026
  return min + hour + dd + mm + yyyy;
}

// ── Prefix builders ───────────────────────────────────────────────────────────

/**
 * Build prefix from Vietnamese name.
 * Takes first letter (uppercase) of each word after removing diacritics.
 * "Hạt Sen"        → "HS"
 * "Hạt Bạc Hà"    → "HBH"
 * "Bánh Phồng Tôm" → "BPT"
 * "Hạt Cây Chùm Ngây" → "HCCN"
 */
function viPrefix(nameVi: string): string {
  const clean = removeViDiacritics(nameVi.trim())
    .replace(/[^a-zA-Z\s]/g, " ")
    .trim();
  if (!clean) return "";
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return "";
  // Single word → first 3 chars
  if (words.length === 1) return words[0].toUpperCase().slice(0, 3);
  // Multiple words → first letter of each, max 5
  return words.slice(0, 5).map(w => w[0].toUpperCase()).join("");
}

/**
 * Build prefix from English name (fallback when no nameVi).
 * Takes first 3 chars of the first meaningful keyword.
 * "Dried Chamomile Flower 100g" → "CHA"
 * "Palo Santo Smudging Sticks"  → "PAL"
 */
function enPrefix(name: string): string {
  const stripped = name
    .replace(/\d+\s*(?:pack\s*x|x)\s*\d+/gi, " ")
    .replace(/\d+(?:\.\d+)?\s*(?:seeds?|bulbs?|g|gram|grams|kg|lb|lbs|oz|pcs?|pieces?|plants?)\b/gi, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/[^a-zA-Z\s]/g, " ");

  const words = stripped
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !EN_STOP.has(w.toLowerCase()));

  if (words.length === 0) return "";
  return words[0].toUpperCase().slice(0, 3);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Suggest a consistent SKU.
 *
 * Format: PREFIX-MMDD-SIZE
 *   PREFIX = chữ viết tắt (initials từ nameVi, hoặc 3 chars từ EN)
 *   MMDD   = tháng+ngày tạo (cố định per nhóm sản phẩm)
 *   SIZE   = phần duy nhất thay đổi giữa các variant
 *
 * @param name    Tên tiếng Anh (dùng để extract size suffix + fallback prefix)
 * @param nameVi  Tên tiếng Việt (preferred — dùng làm prefix base)
 * @param date    Ngày tạo (mặc định: hôm nay)
 */
export function suggestSku(name: string, nameVi?: string | null, date?: Date): string {
  if (!name && !nameVi) return "";

  const prefix = (nameVi ? viPrefix(nameVi) : "") || enPrefix(name ?? "");
  if (!prefix) return "";

  const suffix = extractSuffix(name ?? "");
  const dp = datePart(date);

  return `${prefix}-${dp}${suffix}`;
}

/**
 * Extract just the base code (PREFIX-MMDD) — dùng khi muốn tạo nhiều variant
 * từ cùng 1 base mà không cần nhập lại.
 */
export function baseCode(nameVi: string, date?: Date): string {
  const prefix = viPrefix(nameVi);
  if (!prefix) return "";
  return `${prefix}-${datePart(date)}`;
}

// ── Primary SKU generator ─────────────────────────────────────────────────────

/**
 * Sinh SKU chính thức: chuỗi số thuần 12 chữ số theo timestamp tạo listing.
 *
 * Format: mmHHDDMMYYYY
 *   mm   = phút (00–59)
 *   HH   = giờ  (00–23)
 *   DD   = ngày (01–31)
 *   MM   = tháng (01–12)
 *   YYYY = năm (4 chữ số)
 *
 * Ví dụ: tạo lúc 14:35 ngày 18/05/2026 → "353518052026"
 *
 * Mỗi lần gọi tại thời điểm khác nhau cho ra mã duy nhất.
 * Chuỗi số thuần → barcode CODE128 / EAN đẹp, scan nhanh, không lỗi.
 */
export function generateSku(date?: Date): string {
  return datePart(date);
}

// ── Group-based SKU (legacy, giữ lại để tương thích) ─────────────────────────

/**
 * @deprecated Dùng generateSku() cho sản phẩm mới.
 * Giữ lại để tương thích với các form/flow cũ.
 */
export function suggestSkuFromGroup(
  groupName: string,
  gramsPerUnit?: number | string | null,
  piecesPerPack?: number | string | null,
  date?: Date,
): string {
  const prefix = viPrefix(groupName);
  if (!prefix) return "";

  const dp = datePart(date);
  const grams = gramsPerUnit ? Number(gramsPerUnit) : null;
  const pieces = piecesPerPack ? Number(piecesPerPack) : null;

  if (grams && grams > 0) return `${prefix}-${dp}-${grams}G`;
  if (pieces && pieces > 0) return `${prefix}-${dp}-${pieces}S`;
  return `${prefix}-${dp}`;
}
