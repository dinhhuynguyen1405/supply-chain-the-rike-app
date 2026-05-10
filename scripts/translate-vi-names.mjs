/**
 * Dịch tên tiếng Việt cho toàn bộ sản phẩm trong sheet "Sản phẩm"
 * → Ghi trực tiếp vào cột A (Tên VN) của sheet
 *
 * Chỉ ghi những ô đang TRỐNG — không ghi đè tên đã có
 */

import Database from "better-sqlite3";
import { google } from "googleapis";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SHEET_ID = "1H7b_v9ZkGRUBfYle9u57Bw_cMqir1N_8FjNtBvpRKa0";
const TAB = "Sản phẩm";

// ──────────────────────────────────────────────────────────────
// TỪ ĐIỂN: Tên cây/thảo mộc tiếng Anh → tiếng Việt
// ──────────────────────────────────────────────────────────────
const PLANT_DICT = {
  // Hạt rau củ
  "asparagus": "Măng Tây",
  "bitter melon": "Khổ Qua",
  "bittermelon": "Khổ Qua",
  "butternut squash": "Bí Hạt Dẻ",
  "cabbage": "Bắp Cải",
  "red cabbage": "Bắp Cải Tím",
  "white cabbage": "Bắp Cải Trắng",
  "cucumber": "Dưa Leo",
  "dwarf mini cucumber": "Dưa Leo Mini",
  "gourd": "Bầu",
  "bottle gourd": "Bầu",
  "jicama": "Củ Đậu",
  "lettuce": "Xà Lách",
  "salad lettuce": "Xà Lách",
  "romaine lettuce": "Xà Lách Romaine",
  "long bean": "Đậu Đũa",
  "mung bean": "Đậu Xanh",
  "bean sprout": "Giá Đỗ",
  "mustard": "Cải",
  "baby mustard": "Cải Xanh",
  "bau sin": "Cải Bẹ Xanh",
  "brassica juncea": "Cải Bẹ Xanh",
  "kale": "Cải Xoăn",
  "broccoli": "Súp Lơ Xanh",
  "sweet pepper": "Ớt Ngọt",
  "pepper": "Ớt",
  "chili": "Ớt",
  "bird's eye chili": "Ớt Chim",
  "bird eye chili": "Ớt Chim",
  "cowhorn pepper": "Ớt Sừng Bò",
  "pumpkin": "Bí Đỏ",
  "large pumpkin": "Bí Đỏ Lớn",
  "halloween pumpkin": "Bí Đỏ Halloween",
  "tomato": "Cà Chua",
  "watermelon": "Dưa Hấu",
  "winter melon": "Bí Đao",
  "wheat grass": "Cỏ Lúa Mì",
  "wheat": "Lúa Mì",
  "corn": "Bắp",
  "sweet corn": "Ngô Ngọt",
  "beetroot": "Củ Dền",
  "red beetroot": "Củ Dền Đỏ",
  "sugar apple": "Mãng Cầu",
  "custard apple": "Mãng Cầu",
  "bitter gourd": "Khổ Qua",
  "okra": "Đậu Bắp",
  "ginger": "Gừng",
  "turmeric": "Nghệ",
  "garlic": "Tỏi",
  "black garlic": "Tỏi Đen",

  // Hạt cây hoa
  "lavender": "Oải Hương",
  "marigold": "Vạn Thọ",
  "french marigold": "Cúc Vạn Thọ Pháp",
  "sunflower": "Hướng Dương",
  "rose": "Hoa Hồng",
  "red rose": "Hồng Đỏ",
  "white rose": "Hồng Trắng",
  "hibiscus": "Bụp Giấm",
  "white hibiscus": "Bụp Giấm Trắng",
  "blue hibiscus": "Bụp Giấm Xanh",
  "swamp rose mallow": "Dâm Bụt Đầm Lầy",
  "rose mallow": "Dâm Bụt",
  "chamomile": "Cúc La Mã",
  "german chamomile": "Cúc La Mã Đức",
  "daisy": "Hoa Cúc",
  "crown daisy": "Cải Cúc",
  "daisy fleabane": "Cúc Dại",
  "frost aster": "Cúc Aster",
  "aster": "Cúc Aster",
  "peony": "Hoa Mẫu Đơn",
  "passionflower": "Hoa Lạc Tiên",
  "passion flower": "Hoa Lạc Tiên",
  "porterweed": "Ngưu Tất Nhám",
  "blue porterweed": "Ngưu Tất Nhám Xanh",
  "snake weed": "Cỏ Rắn",
  "periwinkle": "Dừa Cạn",
  "bigleaf periwinkle": "Dừa Cạn Lá To",
  "burning bush": "Cây Lửa",
  "rhododendron": "Đỗ Quyên",
  "azalea": "Đỗ Quyên",
  "rhododendron azalea": "Hoa Đỗ Quyên",
  "freesia": "Hoa Freesia",
  "south africa freesia": "Freesia Nam Phi",
  "bee balm": "Hoa Bee Balm",
  "wild bergamot": "Hoa Bee Balm",
  "bee balm wild bergamot": "Hoa Bee Balm",
  "milkweed": "Bông Sữa",
  "common milkweed": "Bông Sữa",
  "pampas grass": "Cỏ Pampas",
  "clover": "Cỏ Ba Lá",
  "red clover": "Cỏ Ba Lá Đỏ",
  "sweet clover": "Cỏ Ba Lá Ngọt",
  "yellow sweet clover": "Cỏ Ba Lá Vàng",
  "ironweed": "Cây Vernonia",
  "vernonia": "Cây Vernonia",
  "mugwort": "Ngải Cứu",
  "peppermint": "Bạc Hà",
  "spearmint": "Bạc Hà Xanh",
  "mint": "Bạc Hà",
  "linden": "Cây Đoạn",
  "sesbania": "Cây Điền Thanh",
  "alaska pea": "Đậu Hà Lan Alaska",
  "pea": "Đậu Hà Lan",
  "trumpet vine": "Hoa Kèn Đồng",
  "winter creeper": "Cây Leo Mùa Đông",
  "borage": "Cây Lưỡi Bò",
  "cilantro": "Rau Mùi",
  "culantro": "Ngò Gai",
  "dill": "Thì Là",
  "basil": "Húng Quế",
  "holy basil": "Húng Quế Thánh",
  "sweet basil": "Húng Quế",
  "fish mint": "Diếp Cá",
  "fish mint herb": "Diếp Cá",
  "eclipta alba": "Cỏ Mực",
  "eclipta": "Cỏ Mực",
  "mulberry": "Dâu Tằm",
  "lemongrass": "Sả",
  "moringa": "Cây Chùm Ngây",
  "watercress": "Rau Cải Xoong",
  "sorrel": "Chua Me",
  "purslane": "Rau Sam",
  "golden purslane": "Rau Sam Vàng",
  "amaranth": "Rau Dền",
  "jute": "Cây Đay",
  "red jute": "Đay Đỏ",
  "mallow": "Cây Bụp",
  "hollyhock": "Hoa Cẩm Quỳ",
  "blue hyssop": "Hoa Thạch Thảo Xanh",
  "hyssop": "Hoa Thạch Thảo",
  "motherwort": "Ích Mẫu",
  "wormwood": "Ngải Đắng",
  "coriander": "Rau Mùi",
  "parsley": "Mùi Tây",
  "fennel": "Thì Là Tây",
  "sage": "Xô Thơm",
  "thyme": "Cỏ Xạ Hương",
  "rosemary": "Hương Thảo",
  "oregano": "Kinh Giới Ý",
  "chives": "Hẹ",
  "leek": "Tỏi Tây",
  "spinach": "Cải Bó Xôi",
  "watercress": "Cải Xoong",
  "arugula": "Rau Rocket",
  "beet": "Củ Dền",
  "turnip": "Củ Cải Đức",
  "radish": "Củ Cải",
  "carrot": "Cà Rốt",
  "sweet potato": "Khoai Lang",
  "luffa": "Mướp",
  "loofah": "Mướp",

  // Cây thân gỗ / bụi
  "maple": "Phong Lá Đỏ",
  "red maple": "Phong Đỏ",
  "american maple": "Phong Mỹ",
  "boxelder maple": "Phong Boxelder",
  "silver maple": "Phong Bạc",
  "japanese maple": "Phong Nhật",
  "oak": "Cây Sồi",
  "white oak": "Sồi Trắng",
  "acorn": "Hạt Sồi",
  "white oak acorn": "Hạt Sồi Trắng",
  "ash": "Cây Tần Bì",
  "green ash": "Tần Bì Xanh",
  "american sycamore": "Cây Tiêu Huyền",
  "sycamore": "Cây Tiêu Huyền",
  "poplar": "Cây Dương",
  "rowan": "Cây Thanh Lương Trà",
  "locust": "Cây Keo / Hoa Hòe",
  "honey locust": "Bồ Kết",
  "bo ket": "Bồ Kết",
  "locust tree": "Cây Hoa Hòe",
  "black locust": "Cây Keo Đen",
  "cypress": "Cây Tùng Bách",
  "italian cypress": "Tùng Ý",
  "bald cypress": "Bách Trụi Lá",
  "eastern red cedar": "Tuyết Tùng Đỏ",
  "cedar": "Cây Bách",
  "catalpa": "Cây Catalpa",
  "catalpa speciosa": "Cây Catalpa Lớn",
  "neem": "Xoan Ấn Độ",
  "neem tree": "Cây Neem",
  "eucalyptus": "Cây Bạch Đàn",
  "bamboo": "Tre",
  "manilkara zapota": "Hồng Xiêm",
  "sapodilla": "Hồng Xiêm",
  "sugar maple": "Phong Đường",
  "barberry": "Cây Barberry",
  "japanese barberry": "Hoàng Liên Nhật",
  "quaking aspen": "Cây Dương Run",
  "aspen": "Cây Dương",
  "hickory": "Cây Hickory",
  "shanghark hickory": "Hickory Vỏ Sần",
  "macadamia": "Mắc Ca",
  "almond": "Hạnh Nhân",
  "raw almond tree": "Cây Hạnh Nhân",
  "pine": "Thông",
  "eastern white pine": "Thông Trắng Mỹ",

  // Cây ăn quả
  "cherry": "Anh Đào",
  "sweet cherry": "Anh Đào Ngọt",
  "pomegranate": "Lựu",
  "lemon": "Chanh Vàng",
  "orange": "Cam",
  "lime": "Chanh",
  "jujube": "Táo Tàu",
  "mulberry": "Dâu",
  "fig": "Sung",
  "date": "Chà Là",
  "passion fruit": "Chanh Dây",

  // Thảo mộc & thuốc
  "saffron": "Nghệ Tây",
  "kashmiri saffron": "Nghệ Tây Kashmir",
  "saffron crocus": "Nghệ Tây",
  "ginseng": "Nhân Sâm",
  "red ginseng": "Hồng Sâm",
  "korean red ginseng": "Hồng Sâm Hàn Quốc",
  "panax ginseng": "Nhân Sâm Panax",
  "echinacea": "Hoa Cúc Tím",
  "valerian": "Cây Nữ Lang",
  "elderberry": "Cơm Cháy",
  "ashwagandha": "Phá Cố Chỉ / Ashwagandha",
  "turmeric": "Nghệ",
  "ginger": "Gừng",
  "galangal": "Riềng",
  "licorice": "Cam Thảo",
  "milk thistle": "Kế Sữa",
  "st john's wort": "Cỏ Lúa Mạch",
  "dandelion": "Bồ Công Anh",
  "la giang": "Lá Giang",
  "nhan tran": "Nhân Trần",
  "star anise": "Hoa Hồi",
  "cinnamon": "Quế",
  "vetiver": "Cỏ Hương Bài",
  "frankincense": "Nhựa Nhũ Hương",
  "myrrh": "Mộc Dược",
  "sandalwood": "Đàn Hương",
  "agarwood": "Trầm Hương",
  "euonymus": "Cây Kim Ngân",
  "dallisgrass": "Cỏ Dallisgrass",
  "mullein": "Cây Mao Nhị",
  "seagrass": "Cỏ Biển",
  "ironweed": "Cây Sắt Cỏ",
  "white wild indigo": "Chàm Trắng Hoang Dã",
  "wild indigo": "Chàm Hoang Dã",
  "pennsylvania pellitory": "Cây Pellitory",
  "pellitory": "Cây Pellitory",
  "frost aster": "Cúc Aster",
  "winter creeper": "Leo Mùa Đông",
  "trumpet vine": "Hoa Kèn Leo",

  // Đặc biệt
  "wasabi": "Wasabi",
  "morinda": "Ba Kích",
  "lotus": "Sen",
  "lotus seeds": "Hạt Sen",
  "red dates": "Táo Đỏ",
  "chrysanthemum": "Cúc",
  "pandan": "Lá Dứa",
  "lychee": "Vải",
  "longan": "Long Nhãn",
  "dragon fruit": "Thanh Long",
  "bitter herb": "Thảo Mộc Đắng",
  "swamp rose": "Hoa Hồng Đầm",
  "la giang": "Lá Giang",
  "culantro": "Ngò Gai",
};

// Tiền tố danh mục
const CAT_PREFIX = {
  "Hạt giống": "Hạt",
  "Thảo mộc khô": "Thảo Mộc Khô",
  "Trà thảo mộc": "Trà",
  "Thực phẩm & thảo dược": "",
  "Hoa quả khô": "Hoa Quả Khô",
  "Làm đẹp": "",
  "Thực vật": "Cây",
  "Dụng cụ trồng trọt": "",
};

// ──────────────────────────────────────────────────────────────
// Hàm tách tên cốt lõi từ tiêu đề tiếng Anh
// ──────────────────────────────────────────────────────────────
function extractCoreName(title) {
  let s = title
    // Bỏ số lượng đầu: "100 Seeds", "3000 seeds", "2 pack x 100"
    .replace(/^\d[\d\s.]*\s*(x\s*\d+\s*)?(pack\s*(x\s*\d+\s*)?)?/i, "")
    // Bỏ trọng lượng đầu: "100g", "200 gram"
    .replace(/^\d+\s*(gram|g|kg|oz|lb)\s*/i, "")
    // Bỏ đuôi "Seeds for Planting", "Seeds for Growing", "for Planting", "for Sale"
    .replace(/\s+seeds?\s+for\s+(planting|growing|garden|sale|home|your|easy)[^|]*/i, "")
    .replace(/\s+for\s+(planting|growing|gardening|sale|home|easy)[^|]*/i, "")
    // Bỏ phần sau | hoặc - (variants)
    .replace(/\s*[\|]\s*.*/g, "")
    // Bỏ đuôi "Seeds" cuối
    .replace(/\s+seeds?$/i, "")
    // Bỏ "Bulbs" cuối
    .replace(/\s+bulbs?$/i, "")
    // Bỏ các cụm thường gặp
    .replace(/\b(non-?gmo|heirloom|organic|natural|pure|dried|bulk|fresh|easy|vibrant|colorful|lush|verdant|hardy|fast.growing|non\s+gmo|sustainable|eco.friendly|home\s+garden|garden)\b/gi, "")
    // Bỏ số ở đầu còn sót
    .replace(/^\d+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  // Bỏ "Seeds" ở giữa nếu còn
  s = s.replace(/\bseeds?\b/gi, "").replace(/\s+/g, " ").trim();

  return s;
}

function lookupPlantVI(coreName) {
  const lower = coreName.toLowerCase().trim();

  // Exact match
  if (PLANT_DICT[lower]) return PLANT_DICT[lower];

  // Partial match (longest match wins)
  let bestKey = "";
  let bestVal = "";
  for (const [k, v] of Object.entries(PLANT_DICT)) {
    if (lower.includes(k) && k.length > bestKey.length) {
      bestKey = k;
      bestVal = v;
    }
  }
  if (bestVal) return bestVal;

  // Fallback: capitalize core name (giữ tên tiếng Anh)
  return coreName
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function generateViName(enName, category) {
  const core = extractCoreName(enName);
  const vi = lookupPlantVI(core);
  const prefix = CAT_PREFIX[category] ?? "";

  if (!prefix) return vi;

  // Tránh "Hạt Hạt Sen" nếu vi đã bắt đầu bằng "Hạt"
  if (vi.toLowerCase().startsWith(prefix.toLowerCase())) return vi;

  return `${prefix} ${vi}`;
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────
async function main() {
  const db = new Database(join(ROOT, "dev.db"));
  const tokenRow = db.prepare("SELECT value FROM Setting WHERE key='googleRefreshToken'").get();
  const dbProducts = db.prepare("SELECT name, nameVi, skuShopify FROM Product").all();
  db.close();

  if (!tokenRow?.value) { console.error("❌ No Google token"); process.exit(1); }

  // Build SKU → nameVi từ DB
  const dbViMap = new Map();
  for (const p of dbProducts) {
    if (p.skuShopify && p.nameVi) dbViMap.set(p.skuShopify.trim(), p.nameVi);
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || "",
    process.env.GOOGLE_CLIENT_SECRET || "",
    "http://localhost:3000/api/auth/google/callback"
  );
  auth.setCredentials({ refresh_token: tokenRow.value });
  const sheets = google.sheets({ version: "v4", auth });

  // Đọc sheet
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A:I`,
  });

  const rows = res.data.values ?? [];
  const data = rows.slice(1); // bỏ header

  console.log(`📋 Đọc xong: ${data.length} sản phẩm`);

  // Tính toán tên VN cho từng hàng
  const updates = []; // { rowIndex (1-based), viName }
  let fromDB = 0, generated = 0, skipped = 0;

  // Build DB category map
  const dbCatMap = new Map();
  const dbProdsWithCat = new Database(join(ROOT, "dev.db")).prepare("SELECT skuShopify, category FROM Product").all();
  for (const p of dbProdsWithCat) {
    if (p.skuShopify) dbCatMap.set(p.skuShopify.trim(), p.category ?? "");
  }
  const dbCatDb = new Database(join(ROOT, "dev.db"));
  dbCatDb.close();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const existingVi = row[0]?.trim() ?? "";
    const enName = row[1]?.trim() ?? "";
    const sku = row[2]?.trim() ?? "";
    const category = dbCatMap.get(sku) ?? "";

    if (existingVi) { skipped++; continue; } // đã có tên VN, bỏ qua

    let viName = "";

    // 1. Lấy từ DB nếu có
    if (sku && dbViMap.has(sku)) {
      viName = dbViMap.get(sku);
      fromDB++;
    }
    // 2. Tự sinh từ tên EN
    else if (enName) {
      viName = generateViName(enName, category);
      generated++;
    }

    if (viName) {
      updates.push({ row: i + 2, viName }); // +2 vì header ở row 1
    }
  }

  console.log(`\n📊 Kết quả:`);
  console.log(`  ✓ Bỏ qua (đã có tên VN): ${skipped}`);
  console.log(`  ✓ Lấy từ DB:             ${fromDB}`);
  console.log(`  ✓ Tự tạo từ tên EN:      ${generated}`);
  console.log(`  → Tổng cần ghi:          ${updates.length}`);

  if (updates.length === 0) {
    console.log("✅ Không có gì cần cập nhật!");
    return;
  }

  // Ghi vào sheet theo batch (500 ô mỗi lần)
  console.log(`\n⏳ Đang ghi lên Google Sheet...`);
  const batchData = updates.map((u) => ({
    range: `${TAB}!A${u.row}`,
    values: [[u.viName]],
  }));

  const BATCH = 500;
  for (let i = 0; i < batchData.length; i += BATCH) {
    const chunk = batchData.slice(i, i + BATCH);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: chunk,
      },
    });
    console.log(`  Đã ghi ${Math.min(i + BATCH, batchData.length)} / ${batchData.length}`);
  }

  // Cập nhật DB luôn
  console.log(`\n⏳ Cập nhật DB...`);
  const db2 = new Database(join(ROOT, "dev.db"));
  const updateDb = db2.prepare("UPDATE Product SET nameVi=?, updatedAt=? WHERE skuShopify=? AND nameVi IS NULL");
  const now = new Date().toISOString();
  let dbUpdated = 0;
  for (const u of updates) {
    const dataRow = data[u.row - 2];
    const sku = dataRow?.[2]?.trim();
    if (sku) {
      const r = updateDb.run(u.viName, now, sku);
      dbUpdated += r.changes;
    }
  }
  db2.close();
  console.log(`  DB: cập nhật ${dbUpdated} sản phẩm`);

  console.log(`\n✅ Hoàn thành! Đã ghi ${updates.length} tên VN lên sheet "${TAB}"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
