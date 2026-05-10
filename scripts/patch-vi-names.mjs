/**
 * Patch tên VN còn sai/tiếng Anh dựa trên keyword trong tên EN
 * Chạy sau fix-vi-names.mjs
 */

import Database from "better-sqlite3";
import { google } from "googleapis";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SHEET_ID = "1H7b_v9ZkGRUBfYle9u57Bw_cMqir1N_8FjNtBvpRKa0";
const TAB = "Sản phẩm";

// Map keyword (lowercase, trong tên EN) → tên VN
// Dùng kiểu "longest match" — key dài hơn được ưu tiên
const KEYWORD_MAP = [
  // Hạt giống đặc biệt
  ["water mimosa", "Rau Nhút (Hạt)"],
  ["horse chestnut", "Hạt Dẻ Ngựa"],
  ["hazelnut", "Hạt Phỉ"],
  ["american hazelnut", "Hạt Phỉ Mỹ"],
  ["american filbert", "Hạt Phỉ Mỹ"],
  ["sweetgum", "Cây Hổ Phách"],
  ["american sweetgum", "Hạt Hổ Phách Mỹ"],
  ["larch", "Cây Thông Lá Rụng"],
  ["douglas fir", "Cây Thông Douglas"],
  ["norway spruce", "Vân Sam Na Uy"],
  ["colorado blue spruce", "Vân Sam Xanh Colorado"],
  ["silver tip spruce", "Vân Sam Đầu Bạc"],
  ["hackberry", "Cây Mạ Xương"],
  ["common hackberry", "Cây Mạ Xương"],
  ["lilac", "Hoa Tử Đinh Hương"],
  ["common lilac", "Hoa Tử Đinh Hương"],
  ["stinging nettle", "Cây Tầm Ma"],
  ["common nettle", "Cây Tầm Ma"],
  ["nettle", "Tầm Ma"],
  ["crepe myrtle", "Tường Vi Nhật"],
  ["crape myrtle", "Tường Vi Nhật"],
  ["royal palm", "Cọ Hoàng Gia"],
  ["cuban royal palm", "Cọ Hoàng Gia Cuba"],
  ["trachycarpus", "Cọ Trachycarpus"],
  ["palm tree", "Cây Cọ"],
  ["cushion spurge", "Euphorbia Đệm"],
  ["lambsquart", "Rau Muối Trắng"],
  ["lamb's quarter", "Rau Muối Trắng"],
  ["purpletop tridens", "Cỏ Purpletop"],
  ["smooth sumac", "Cây Đỏ Sumac"],
  ["sumac", "Cây Sumac"],
  ["dragon tree", "Cây Huyết Giác"],
  ["gold moss stonecrop", "Hoa Đá Vàng"],
  ["stonecrop", "Cây Đá"],
  ["penstemon", "Hoa Penstemon"],
  ["red penstemon", "Hoa Penstemon Đỏ"],
  ["blue platycodon", "Hoa Cát Cánh Xanh"],
  ["platycodon", "Hoa Cát Cánh"],
  ["blanket flower", "Hoa Gaillardia"],
  ["gaillardia", "Hoa Gaillardia"],
  ["chinese silver grass", "Cỏ Bạc Trung Hoa"],
  ["cattail", "Cây Bồng Bông"],
  ["texas bluebonnet", "Hoa Xanh Texas"],
  ["nepeta", "Cây Catnip"],
  ["pink nepeta", "Cây Catnip Hồng"],
  ["bergenia", "Hoa Bergenia"],
  ["dwarf blue nile lily", "Hoa Agapanthus Xanh"],
  ["agapanthus", "Hoa Agapanthus"],
  ["calla lily", "Hoa Calla"],
  ["peruvian lily", "Hoa Lily Peru"],
  ["elephant ear", "Tai Voi (Củ)"],
  ["jade vine", "Hoa Jade Vine"],
  ["emerald vine", "Hoa Jade Vine"],
  ["venus flytrap", "Cây Bẫy Ruồi"],
  ["gold child english ivy", "Thường Xuân Vàng"],
  ["english ivy", "Thường Xuân"],
  ["american elm", "Du Mỹ"],
  ["elm tree", "Cây Du"],
  ["american holly", "Cây Nhựa Ruồi Mỹ"],
  ["golden rain tree", "Cây Mưa Vàng"],
  ["royal empress", "Cây Paulownia"],
  ["yew tree", "Cây Thủy Tùng"],
  ["taxus", "Cây Thủy Tùng"],
  ["magnolia", "Hoa Mộc Lan"],
  ["wisteria", "Hoa Tử Đằng"],
  ["beer hops", "Cây Bia (Hoa Bia)"],
  ["hops", "Hoa Bia"],
  ["fuji apple", "Táo Fuji"],
  ["apple tree", "Cây Táo"],
  ["apple", "Táo"],
  ["crab apple", "Táo Dại"],
  ["siberian crab apple", "Táo Dại Siberia"],
  ["english walnut", "Óc Chó"],
  ["walnut", "Óc Chó"],
  ["mango", "Xoài"],
  ["cantaloupe", "Dưa Lưới"],
  ["honeydew", "Dưa Vàng"],
  ["muskmelon", "Dưa Thơm"],
  ["honeyrock", "Dưa Lưới Honeyrock"],
  ["tomatillo", "Trái Tomatillo"],
  ["kohlrabi", "Su Hào"],
  ["celtuce", "Rau Diếp Cán"],
  ["choy sum", "Cải Ngọt"],
  ["green onion", "Hành Lá"],
  ["scallion", "Hành Lá"],
  ["vidalia onion", "Hành Ngọt Vidalia"],
  ["onion", "Hành Tây"],
  ["shiso", "Tía Tô"],
  ["perilla", "Tía Tô"],
  ["vietnamese perilla", "Tía Tô"],
  ["limnophila aromatica", "Ngổ Om"],
  ["rice paddy herb", "Ngổ Om"],
  ["red dragon fruit", "Thanh Long Đỏ"],
  ["dragon fruit", "Thanh Long"],
  ["katuk", "Rau Bồ Ngót"],
  ["soursop leaf", "Lá Mãng Cầu Xiêm"],
  ["soursop", "Mãng Cầu Xiêm"],
  ["eggfruit", "Trứng Gà (Quả)"],
  ["manilkara zapota", "Hồng Xiêm"],
  ["jackfruit", "Mít"],
  ["siebold's plantain lily", "Ngọc Trâm Siebold"],
  ["hosta", "Hoa Ngọc Trâm"],
  ["abyssinian banana", "Chuối Thổ Nhĩ Kỳ"],
  ["ensete", "Chuối Ensete"],

  // Trà / Thảo mộc
  ["anamu leaf tea", "Trà Lá Anamu (Petiveria)"],
  ["artichoke flower bud", "Hoa Atiso Khô"],
  ["artichoke leaf tea", "Trà Lá Atiso"],
  ["artichoke leaves tea", "Trà Lá Atiso"],
  ["dried artichoke", "Hoa Atiso Khô"],
  ["globe artichoke", "Atiso"],
  ["artichoke", "Atiso"],
  ["bearberry tea", "Trà Lá Bearberry"],
  ["beauty herbal tea", "Trà Thảo Mộc Làm Đẹp"],
  ["bergamot peel", "Trà Vỏ Bergamot"],
  ["bergamot", "Bergamot"],
  ["calendula flower tea", "Trà Hoa Cúc Lịch Calendula"],
  ["calendula", "Hoa Cúc Lịch"],
  ["caulis spatholobi", "Kê Huyết Đằng"],
  ["celastrus leaf tea", "Trà Lá Xạ Đen"],
  ["chanca piedra", "Trà Diệp Hạ Châu"],
  ["dead nettle tea", "Trà Hoa Tầm Ma Trắng"],
  ["elaeagnus umbellata", "Trà Nhót Tây"],
  ["olive leaf", "Lá Ô Liu"],
  ["euryale ferox", "Hạt Khiếm Thực"],
  ["gardenia jasminoides", "Hoa Chi Tử"],
  ["gardenia", "Hoa Dành Dành"],
  ["goji berries herbal", "Trà Kỷ Tử"],
  ["goji berries", "Kỷ Tử"],
  ["goji", "Kỷ Tử"],
  ["gynostemma", "Trà Giảo Cổ Lam"],
  ["jiaogulan", "Giảo Cổ Lam"],
  ["honeysuckle tea", "Trà Hoa Kim Ngân"],
  ["honeysuckle", "Hoa Kim Ngân"],
  ["jin yin hua", "Hoa Kim Ngân"],
  ["indian bael", "Trái Bầu Thủng / Bael"],
  ["bael", "Quả Bael Sấy"],
  ["la mang cau xiem", "Trà Lá Mãng Cầu Xiêm"],
  ["lotus flower tea", "Trà Hoa Sen"],
  ["lotus root", "Ngó Sen Sấy"],
  ["lotus embryo", "Tâm Sen"],
  ["lotus plumule", "Tâm Sen"],
  ["lotus leaf tea", "Trà Lá Sen"],
  ["tim sen", "Tâm Sen"],
  ["mo huang tea", "Trà Ma Hoàng"],
  ["mormon tea", "Trà Ephedra"],
  ["ephedra", "Ma Hoàng"],
  ["nu voi", "Nụ Vối"],
  ["syzygium nervosum", "Trà Nụ Vối"],
  ["la voi", "Nụ Vối"],
  ["olive leaf herbal", "Trà Lá Ô Liu"],
  ["papaya leaf tea", "Trà Lá Đu Đủ"],
  ["patchouli leaf tea", "Trà Lá Hoắc Hương"],
  ["patchouli", "Hoắc Hương"],
  ["radix codonopsis", "Đảng Sâm"],
  ["codonopsis", "Đảng Sâm"],
  ["dang shen", "Đảng Sâm"],
  ["russian box thorn", "Kỷ Tử / Goji"],
  ["sophora japonica", "Trà Hoa Hòe"],
  ["hoa hoe", "Trà Hoa Hòe"],
  ["stevia tea", "Trà Cỏ Ngọt"],
  ["stevia", "Cỏ Ngọt"],
  ["stinging nettle tea", "Trà Lá Tầm Ma"],
  ["symphytum", "Cây Comfrey"],
  ["comfrey tea", "Trà Comfrey"],
  ["elaeagnus", "Nhót Tây"],
  ["gynostemma", "Giảo Cổ Lam"],
  ["lemon peel", "Vỏ Chanh Vàng Sấy"],
  ["grapefruit peel", "Vỏ Bưởi Sấy"],
  ["bergenia cordifolia", "Hoa Bergenia"],
  ["tra duong nhan", "Trà Dưỡng Nhan"],
  ["detox tea", "Trà Thải Độc"],
  ["fra duong nhan", "Trà Dưỡng Nhan"],
  ["beauty herbal", "Trà Thảo Mộc Làm Đẹp"],
  ["herbal tea flowers roots", "Trà Thảo Mộc Hỗn Hợp"],
  ["siraitia grosvenorii", "La Hán Quả"],
  ["multivitamin", "Vitamin Tổng Hợp"],
  ["prenatal vitamin", "Vitamin Bà Bầu"],

  // Hoa quả khô
  ["lemon slices", "Chanh Vàng Sấy Lát"],
  ["green lemon slices", "Chanh Xanh Sấy Lát"],
  ["orange slices", "Cam Sấy Lát"],
  ["dried orange fruit", "Cam Sấy"],
  ["top bulk green lemon", "Chanh Xanh Sấy Lát"],
  ["goji berries - bright", "Kỷ Tử Sấy"],
  ["exotic dried fruit", "Hoa Quả Nhiệt Đới Sấy"],
  ["hamster snacks freeze-dried strawberries", "Dâu Tây Sấy Đông Khô"],
  ["freeze-dried strawberries", "Dâu Tây Sấy Đông Khô"],
  ["freeze dried strawberries", "Dâu Tây Sấy Đông Khô"],
  ["dried goji berries herbal", "Kỷ Tử Khô"],
  ["dried goji berries", "Kỷ Tử Khô"],

  // Thực phẩm đặc biệt
  ["authentic southeast asian prawn cracker", "Bánh Phồng Tôm Đông Nam Á"],
  ["prawn cracker", "Bánh Phồng Tôm"],
  ["shrimp cracker", "Bánh Phồng Tôm"],
  ["baking soda", "Bột Nổi Sodium Bicarbonate"],
  ["sodium bicarbonate", "Natri Bicarbonate"],
  ["cloves", "Đinh Hương"],
  ["clove", "Đinh Hương"],
  ["microfiber mat", "Thảm Microfiber"],

  // Dụng cụ / thiết bị
  ["solar panel", "Tấm Pin Mặt Trời"],
  ["acopower", "Pin Mặt Trời ACOPOWER"],
  ["compact solar panel", "Tấm Pin Mặt Trời Mini"],
  ["poly solar panel kit", "Bộ Pin Mặt Trời"],
  ["ultra-bright solar outdoor", "Đèn Ngoài Trời Năng Lượng Mặt Trời"],
  ["solar outdoor light", "Đèn Ngoài Trời Solar"],
  ["solar light", "Đèn Solar"],
  ["car heater windshield", "Máy Sưởi Kính Xe Hơi"],
  ["automatic granule powder filling", "Máy Đóng Gói Bột"],
  ["filling machine", "Máy Đóng Gói"],
  ["epoxy resin glue", "Keo Epoxy"],
  ["epoxy resin", "Nhựa Epoxy"],
  ["rooting growth promoting", "Chất Kích Thích Ra Rễ"],
  ["soil activator", "Chất Kích Hoạt Đất"],
  ["dual-sided polyethylene outdoor rain cover", "Bạt Che Mưa Ngoài Trời"],
  ["rain cover", "Bạt Che Mưa"],
  ["emergency survival gear", "Bộ Dụng Cụ Sinh Tồn"],
  ["brass genie charcoal burner", "Lò Xông Hương Đồng"],
  ["charcoal burner", "Lò Xông Than"],
  ["palo santo smudging", "Gỗ Palo Santo"],
  ["palo santo", "Gỗ Palo Santo"],
  ["smudging sticks", "Nhang Xông"],
  ["fragrance sticks", "Que Thơm Phòng"],
  ["home fragrance spray", "Xịt Thơm Phòng"],
  ["room scent", "Xịt Thơm Phòng"],
  ["luxury home fragrance", "Xịt Thơm Phòng Cao Cấp"],
  ["uyuni home fragrance", "Xịt Thơm Phòng Uyuni"],
  ["hugs and kisses fragrance", "Que Thơm Hugs & Kisses"],
  ["fragrance stick set", "Bộ Que Thơm"],
  ["tea storage tin", "Hộp Đựng Trà"],
  ["olive wood mortar and pestle", "Cối Chày Gỗ Ô Liu"],
  ["mortar and pestle", "Cối Chày"],
  ["pet-friendly plant subscription", "Hộp Cây Cảnh Thân Thiện Thú Cưng"],
  ["premium suture kit", "Bộ Khâu Vết Thương"],
  ["raw classic rolling", "Giấy Cuốn RAW"],
  ["raw rolling tray", "Khay RAW"],
  ["non-toxic sunscreen", "Kem Chống Nắng Không Độc Hại"],
  ["sunscreen", "Kem Chống Nắng"],
  ["moisturizing dry skin", "Kem Dưỡng Ẩm Da Khô"],
  ["citrus sea goat milk soap", "Xà Phòng Sữa Dê"],
  ["goat milk body soap", "Xà Phòng Sữa Dê"],
  ["goat soap laundry", "Xà Phòng Giặt Sữa Dê"],
  ["lip balm", "Son Dưỡng Môi"],
  ["certified tea tree oil", "Tinh Dầu Tràm Trà"],
  ["tea tree oil", "Tinh Dầu Tràm Trà"],
  ["t-shirt", "Áo Thun"],
  ["cotton t-shirt", "Áo Thun Cotton"],
  ["premium quality soft cotton", "Áo Thun Cotton Cao Cấp"],
  ["the rike - elevate", "The Rike - Dịch Vụ Marketing 4.0"],
  ["the rike", "The Rike"],
];

function hasManyEnglish(vi) {
  // Có 3+ từ tiếng Anh viết hoa liên tiếp
  return /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){2,}\b/.test(vi);
}

function applyKeywordMap(enName) {
  const lower = enName.toLowerCase();
  let best = null;
  let bestLen = 0;
  for (const [kw, vi] of KEYWORD_MAP) {
    if (lower.includes(kw) && kw.length > bestLen) {
      best = vi;
      bestLen = kw.length;
    }
  }
  return best;
}

async function main() {
  const db = new Database(join(ROOT, "dev.db"));
  const tokenRow = db.prepare("SELECT value FROM Setting WHERE key='googleRefreshToken'").get();
  const products = db.prepare("SELECT skuShopify, name, nameVi, category FROM Product").all();
  db.close();

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || "",
    process.env.GOOGLE_CLIENT_SECRET || "",
    "http://localhost:3000/api/auth/google/callback"
  );
  auth.setCredentials({ refresh_token: tokenRow.value });
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A:C`,
  });
  const rows = res.data.values.slice(1);

  const bySku = new Map(products.filter(p => p.skuShopify).map(p => [p.skuShopify.trim(), p]));

  const updates = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const vi = row[0]?.trim() ?? "";
    const en = row[1]?.trim() ?? "";
    const sku = row[2]?.trim() ?? "";

    if (!hasManyEnglish(vi)) continue; // tên VN tốt rồi, bỏ qua

    const newVi = applyKeywordMap(en);
    if (newVi) {
      updates.push({ row: i + 2, viName: newVi, sku, en });
    }
  }

  console.log(`📊 Tìm thấy ${updates.length} tên cần patch`);
  updates.slice(0, 20).forEach(u =>
    console.log(`  VN: ${u.viName.padEnd(30)} | EN: ${u.en.substring(0, 50)}`)
  );

  if (updates.length === 0) { console.log("✅ Không có gì cần patch"); return; }

  // Ghi lên sheet
  const batchData = updates.map(u => ({ range: `${TAB}!A${u.row}`, values: [[u.viName]] }));
  const BATCH = 500;
  for (let i = 0; i < batchData.length; i += BATCH) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: "RAW", data: batchData.slice(i, i + BATCH) },
    });
  }
  console.log(`✅ Ghi lên sheet ${updates.length} tên`);

  // Cập nhật DB
  const db2 = new Database(join(ROOT, "dev.db"));
  const upd = db2.prepare("UPDATE Product SET nameVi=?, updatedAt=? WHERE skuShopify=?");
  const now = new Date().toISOString();
  let cnt = 0;
  for (const u of updates) {
    if (u.sku) { const r = upd.run(u.viName, now, u.sku); cnt += r.changes; }
  }
  db2.close();
  console.log(`✅ DB: ${cnt} sản phẩm cập nhật`);
}

main().catch(e => { console.error(e); process.exit(1); });
