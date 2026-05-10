/**
 * Fix tên tiếng Việt — viết lại toàn bộ với logic tốt hơn
 * --force: ghi đè tất cả (kể cả đã có)
 */

import Database from "better-sqlite3";
import { google } from "googleapis";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SHEET_ID = "1H7b_v9ZkGRUBfYle9u57Bw_cMqir1N_8FjNtBvpRKa0";
const TAB = "Sản phẩm";

// ─────────────────────────────────────────────────────────────
// BƯỚC 1: Fix category sai trong DB
// ─────────────────────────────────────────────────────────────
function fixCategories(db) {
  const now = new Date().toISOString();
  let total = 0;
  const fixes = [
    // Leather / da thuộc
    ["Làm đẹp", "%leather%"],
    ["Làm đẹp", "%cowhide%"],
    ["Làm đẹp", "%Leather%"],
    // Candle / nến
    ["Thực phẩm & thảo dược", "%candle%"],
    ["Thực phẩm & thảo dược", "%Candle%"],
    ["Thực phẩm & thảo dược", "%coconut wax%"],
    // Incense / nhang
    ["Thực phẩm & thảo dược", "%incense%"],
    ["Thực phẩm & thảo dược", "%Incense%"],
    // Flag
    ["Thực phẩm & thảo dược", "%American Flag%"],
    // Power station
    ["Thực phẩm & thảo dược", "%Power Station%"],
    ["Thực phẩm & thảo dược", "%power station%"],
    // Tarp / bạt
    ["Thực phẩm & thảo dược", "%Tarp%"],
    // Grow light
    ["Thực phẩm & thảo dược", "%Grow Light%"],
    ["Thực phẩm & thảo dược", "%Grow Box%"],
    // Tote bag / seagrass bag
    ["Làm đẹp", "%Tote%"],
    ["Làm đẹp", "%tote%"],
    ["Làm đẹp", "%Straw Bag%"],
    ["Làm đẹp", "%Seagrass%"],
    // Mask / skincare
    ["Làm đẹp", "%Mask%"],
    ["Làm đẹp", "%mask%"],
    ["Làm đẹp", "%Collagen%"],
    // Epsom salt
    ["Thực phẩm & thảo dược", "%Epsom Salt%"],
    // Dryer / máy sấy
    ["Thực phẩm & thảo dược", "%Dryer%"],
    ["Thực phẩm & thảo dược", "%Dehydrat%"],
    // Planting bag (dụng cụ)
    ["Dụng cụ trồng trọt", "%Planting Bag%"],
    ["Dụng cụ trồng trọt", "%planting bag%"],
    ["Dụng cụ trồng trọt", "%Felt Bag%"],
    // Firestarter
    ["Thực phẩm & thảo dược", "%Firestarter%"],
    ["Thực phẩm & thảo dược", "%Fire Starter%"],
    // Molasses / syrup
    ["Thực phẩm & thảo dược", "%Molasses%"],
    ["Thực phẩm & thảo dược", "%Cream%"],
    // Matchstick
    ["Thực phẩm & thảo dược", "%Metal Match%"],
    // Wax pearl / candle wax
    ["Thực phẩm & thảo dược", "%pearl wax%"],
    ["Thực phẩm & thảo dược", "%wax wedding%"],
    // Boron nitride
    ["Thực phẩm & thảo dược", "%Boron Nitride%"],
  ];

  for (const [cat, pattern] of fixes) {
    const r = db.prepare(
      `UPDATE Product SET category=?, updatedAt=? WHERE LOWER(name) LIKE LOWER(?) AND category != ?`
    ).run(cat, now, pattern, cat);
    total += r.changes;
  }
  console.log(`  ✓ Fixed ${total} wrong categories`);
}

// ─────────────────────────────────────────────────────────────
// BƯỚC 2: Từ điển và hàm dịch cải tiến
// ─────────────────────────────────────────────────────────────

// Từ điển sản phẩm theo loại (không phải hạt giống)
const TYPE_DICT = {
  // Da / leather
  "leather": "Da Thuộc", "cowhide": "Da Bò", "crazy horse": "Da Ngựa Điên",
  "vegetable tanned": "Da Thuộc Thực Vật",
  // Nến
  "candle": "Nến", "coconut wax": "Sáp Dừa", "wax": "Sáp",
  "incense stick": "Nhang Hương", "incense cone": "Nón Nhang", "incense": "Nhang",
  "tibetan incense": "Nhang Tây Tạng", "frankincense": "Nhũ Hương", "myrrh": "Mộc Dược",
  // Túi / giỏ
  "tote bag": "Túi Xách", "tote": "Túi Xách", "straw tote": "Túi Cói",
  "seagrass tote": "Túi Cói Biển", "seagrass": "Cói Biển", "woven straw": "Đan Cói",
  "beach tote": "Túi Biển", "shoulder bag": "Túi Đeo Vai",
  // Làm đẹp
  "collagen mask": "Mặt Nạ Collagen", "hydrogel mask": "Mặt Nạ Hydrogel",
  "gold collagen": "Collagen Vàng 24K", "mask": "Mặt Nạ",
  "fat burning cream": "Kem Đốt Mỡ", "cream": "Kem",
  "epsom salt": "Muối Epsom", "bath": "Tắm",
  // Thực phẩm đặc biệt
  "shrimp chip": "Bánh Phồng Tôm", "shrimp puff": "Bánh Phồng Tôm",
  "banh phong tom": "Bánh Phồng Tôm",
  "vegetable flake": "Rau Củ Khô Thái Lát", "vegetable pickle": "Dưa Góp",
  "seaweed brown rice": "Gạo Lứt Rong Biển",
  "grain cereal": "Ngũ Cốc", "cereal powder": "Bột Ngũ Cốc",
  "superfood powder": "Bột Siêu Thực Phẩm",
  "molasses": "Mật Rỉ Đường", "blackstrap molasses": "Mật Rỉ Đường Đen",
  "palm oil": "Dầu Cọ Đỏ", "red palm oil": "Dầu Cọ Đỏ",
  "menthol crystal": "Tinh Thể Bạc Hà",
  // Dụng cụ trồng
  "planting bag": "Túi Trồng Cây", "felt bag": "Túi Vải Nỉ",
  "grow light": "Đèn Trồng Cây LED", "grow box": "Hộp Trồng Cây",
  // Thiết bị / khác
  "power station": "Máy Phát Điện Dự Phòng",
  "dryer": "Máy Sấy Thực Phẩm", "dehydrat": "Máy Sấy Thực Phẩm",
  "tarp": "Bạt Che Mưa",
  "firestarter": "Bật Lửa Đá Lửa", "fire starter": "Bật Lửa Đá",
  "metal match": "Diêm Kim Loại",
  "american flag": "Cờ Mỹ",
  "keychain": "Móc Chìa Khóa",
  "boron nitride": "Bột Boron Nitride",
  "candle wax": "Sáp Nến",
  "pearl candle": "Sáp Hạt Nến",
  // Jerusalem artichoke
  "jerusalem artichoke": "Atiso Jerusalem",
  "artichoke tuber": "Củ Atiso",
  // Aloe vera
  "aloe vera": "Nha Đam",
};

// Từ điển hạt giống (chú ý: dùng tên ngắn gọn, không có "Hạt" — prefix xử lý riêng)
const SEED_DICT = {
  // Rau củ
  "asparagus": "Măng Tây", "bitter melon": "Khổ Qua", "butternut squash": "Bí Hạt Dẻ",
  "squash": "Bí", "pumpkin": "Bí Đỏ", "large pumpkin": "Bí Đỏ Lớn",
  "watermelon": "Dưa Hấu", "cucumber": "Dưa Leo", "dwarf mini cucumber": "Dưa Leo Mini",
  "mini cucumber": "Dưa Leo Mini", "bottle gourd": "Bầu", "gourd": "Bầu",
  "cabbage": "Bắp Cải", "red cabbage": "Bắp Cải Tím", "white cabbage": "Bắp Cải Trắng",
  "bok choy": "Cải Thìa", "chinese cabbage": "Bắp Cải Tàu",
  "kale": "Cải Xoăn", "broccoli": "Súp Lơ Xanh",
  "lettuce": "Xà Lách", "salad lettuce": "Xà Lách", "romaine lettuce": "Xà Lách Romaine",
  "mustard": "Cải", "baby mustard": "Cải Xanh", "bau-sin": "Cải Bẹ Xanh",
  "brassica juncea": "Cải Bẹ Xanh", "green mustard": "Cải Xanh",
  "beetroot": "Củ Dền", "red beetroot": "Củ Dền Đỏ", "detroit beetroot": "Củ Dền Detroit",
  "jicama": "Củ Đậu", "wasabi": "Wasabi",
  "sweet pepper": "Ớt Ngọt", "pepper": "Ớt", "chili": "Ớt Cay",
  "bird's eye chili": "Ớt Chim", "bird eye chili": "Ớt Chim", "cowhorn pepper": "Ớt Sừng Bò",
  "long bean": "Đậu Đũa", "mung bean": "Đậu Xanh", "bean sprout": "Giá Đỗ",
  "alaska pea": "Đậu Hà Lan Alaska", "pea": "Đậu Hà Lan",
  "cherokee wax bean": "Đậu Leo Vàng", "wax bean": "Đậu Cô Ve Vàng",
  "winged bean": "Đậu Rồng", "sesbania": "Điền Thanh",
  "wheat grass": "Cỏ Lúa Mì", "wheat": "Lúa Mì",
  "malabar spinach": "Mồng Tơi", "spinach": "Cải Bó Xôi",
  "sugar apple": "Mãng Cầu Ta", "custard apple": "Mãng Cầu",
  "bitter gourd": "Khổ Qua",
  // Thảo mộc / rau thơm
  "cilantro": "Rau Mùi (Coriander)", "culantro": "Ngò Gai", "coriander": "Rau Mùi",
  "dill": "Thì Là", "basil": "Húng Quế", "holy basil": "Húng Quế Thánh",
  "thai basil": "Húng Quế Thái", "sweet basil": "Húng Quế",
  "peppermint": "Bạc Hà Tiêu", "spearmint": "Bạc Hà Xanh", "mint": "Bạc Hà",
  "fish mint": "Diếp Cá", "fish mint herb": "Diếp Cá",
  "lemongrass": "Sả", "rosemary": "Hương Thảo", "thyme": "Cỏ Xạ Hương",
  "sage": "Xô Thơm", "oregano": "Kinh Giới Ý",
  "parsley": "Mùi Tây", "fennel": "Thì Là Tây", "chives": "Hẹ",
  "moringa": "Chùm Ngây", "neem": "Xoan Ấn Độ", "neem tree": "Cây Neem",
  "mugwort": "Ngải Cứu", "wormwood": "Ngải Đắng",
  "chamomile": "Cúc La Mã", "german chamomile": "Cúc La Mã Đức",
  "eclipta alba": "Cỏ Mực", "eclipta": "Cỏ Mực",
  "red clover": "Cỏ Ba Lá Đỏ", "sweet clover": "Cỏ Ba Lá Ngọt",
  "yellow sweet clover": "Cỏ Ba Lá Vàng", "clover": "Cỏ Ba Lá",
  "la giang": "Lá Giang", "nhan tran": "Nhân Trần",
  "adenosma": "Nhân Trần", "glutinosum": "Nhân Trần",
  "pellitory": "Pellitory", "pennsylvania pellitory": "Cây Pellitory",
  "wild indigo": "Chàm Hoang Dã", "white wild indigo": "Chàm Trắng",
  "jute": "Đay", "red jute": "Đay Đỏ",
  "purslane": "Rau Sam", "golden purslane": "Rau Sam Vàng",
  "amaranth": "Rau Dền", "red amaranth": "Rau Dền Đỏ",
  "watercress": "Cải Xoong", "sorrel": "Chua Me",
  "milkweed": "Bông Sữa", "common milkweed": "Bông Sữa",
  "mullein": "Cây Mao Nhị", "dallisgrass": "Cỏ Dallisgrass",
  "ironweed": "Cây Sắt / Vernonia", "vernonia": "Vernonia",
  "borage": "Cây Lưỡi Bò", "motherwort": "Ích Mẫu",
  "artichoke": "Atiso", "jerusalem artichoke": "Atiso Jerusalem",
  "strawberry": "Dâu Tây",
  // Hoa
  "lavender": "Oải Hương", "sunflower": "Hướng Dương",
  "marigold": "Vạn Thọ", "french marigold": "Cúc Vạn Thọ Pháp",
  "rose": "Hồng", "red rose": "Hồng Đỏ", "white rose": "Hồng Trắng",
  "hibiscus": "Bụp Giấm", "white hibiscus": "Bụp Giấm Trắng",
  "swamp rose mallow": "Dâm Bụt Đầm Lầy", "rose mallow": "Dâm Bụt",
  "passionflower": "Lạc Tiên", "passion flower": "Lạc Tiên",
  "porterweed": "Cây Ngưu Tất", "blue porterweed": "Cây Ngưu Tất Xanh",
  "periwinkle": "Dừa Cạn", "bigleaf periwinkle": "Dừa Cạn Lá To",
  "burning bush": "Cây Lửa", "rhododendron": "Đỗ Quyên", "azalea": "Đỗ Quyên",
  "freesia": "Freesia", "south africa freesia": "Freesia Nam Phi",
  "bee balm": "Hoa Bee Balm", "wild bergamot": "Bergamot Hoang",
  "daisy": "Cúc Dại", "crown daisy": "Cải Cúc", "daisy fleabane": "Cúc Dại",
  "frost aster": "Cúc Aster", "aster": "Cúc Aster",
  "chrysanthemum": "Cúc", "peony": "Mẫu Đơn",
  "pampas grass": "Cỏ Pampas",
  "hollyhock": "Cẩm Quỳ", "hyssop": "Thạch Thảo",
  "linden": "Cây Linden",
  "trumpet vine": "Hoa Kèn Leo", "winter creeper": "Leo Mùa Đông",
  "snowball": "Hoa Cầu Tuyết",
  "forget-me-not": "Lưu Ly Thảo", "forget me not": "Lưu Ly Thảo",
  "snapdragon": "Hoa Mõm Sói",
  "zinnia": "Cúc Zinnia",
  "cosmos": "Cúc Cosmos",
  "morning glory": "Bìm Bìm",
  "poppy": "Hoa Anh Túc",
  "carnation": "Cẩm Chướng",
  "dahlia": "Thược Dược",
  "pansy": "Hoa Cánh Bướm",
  "impatiens": "Móng Tay",
  "portulaca": "Hoa Mười Giờ",
  // Cây ăn quả
  "cherry": "Anh Đào", "sweet cherry": "Anh Đào Ngọt",
  "pomegranate": "Lựu", "lychee": "Vải", "longan": "Long Nhãn",
  "jujube": "Táo Tàu", "fig": "Sung", "mulberry": "Dâu Tằm",
  "saffron": "Nghệ Tây", "kashmiri saffron": "Nghệ Tây Kashmir",
  "saffron crocus": "Nghệ Tây", "crocus": "Hoa Nghẹ",
  "sugar cane": "Mía",
  // Cây thân gỗ
  "maple": "Phong", "red maple": "Phong Đỏ", "american maple": "Phong Mỹ",
  "boxelder maple": "Phong Boxelder", "silver maple": "Phong Bạc",
  "japanese maple": "Phong Nhật", "sugar maple": "Phong Đường",
  "quaking aspen": "Cây Dương Run", "aspen": "Cây Dương",
  "oak": "Sồi", "white oak": "Sồi Trắng", "acorn": "Hạt Sồi",
  "ash tree": "Cây Tần Bì", "green ash": "Tần Bì Xanh",
  "american sycamore": "Tiêu Huyền Mỹ", "sycamore": "Tiêu Huyền",
  "poplar": "Cây Dương Bạch", "rowan": "Thanh Lương Trà",
  "locust tree": "Cây Hoa Hòe", "honey locust": "Bồ Kết",
  "black locust": "Cây Keo Đen",
  "cypress": "Tùng Bách", "italian cypress": "Tùng Ý",
  "bald cypress": "Bách Trụi Lá", "eastern red cedar": "Tuyết Tùng Đỏ", "cedar": "Cây Bách",
  "catalpa": "Catalpa", "catalpa speciosa": "Catalpa Lớn",
  "hickory": "Cây Hickory", "shagbark hickory": "Hickory Vỏ Sần",
  "macadamia": "Mắc Ca", "almond": "Hạnh Nhân", "raw almond": "Hạnh Nhân Thô",
  "pine": "Cây Thông", "eastern white pine": "Thông Trắng Mỹ",
  "barberry": "Cây Barberry", "japanese barberry": "Hoàng Liên Nhật",
  "manilkara zapota": "Hồng Xiêm", "sapodilla": "Hồng Xiêm",
  "linden": "Linden", "malabar": "Malabar",
  "ginkgo": "Bạch Quả", "sequoia": "Sequoia", "redwood": "Gỗ Đỏ",
  "willow": "Liễu", "birch": "Bạch Dương", "beech": "Dẻ",
  "dogwood": "Sơn Thù Du", "magnolia": "Mộc Lan", "wisteria": "Tử Đằng",
  "japanese cherry": "Anh Đào Nhật", "ornamental cherry": "Anh Đào Cảnh",
  "locust": "Cây Hòe",
  // Cây leo / bụi
  "bougainvillea": "Hoa Giấy", "jasmine": "Hoa Nhài", "wisteria": "Tử Đằng",
  "climbing rose": "Hồng Leo", "clematis": "Tử Uyên",
  "Virginia creeper": "Dây Leo",
  "sesbania": "Điền Thanh",
  // Bulbs
  "saffron bulb": "Củ Nghệ Tây", "freesia bulb": "Củ Freesia",
  "tulip": "Hoa Tulip", "daffodil": "Thủy Tiên",
  "hyacinth": "Phong Tín Tử", "allium": "Hành Tây Cảnh",
  "bluebell": "Hoa Chuông Xanh",
  // Thực phẩm chức năng
  "ginseng": "Nhân Sâm", "red ginseng": "Hồng Sâm",
  "turmeric": "Nghệ", "ginger": "Gừng", "galangal": "Riềng",
  "licorice": "Cam Thảo", "echinacea": "Cúc Tím",
  "valerian": "Nữ Lang", "elderberry": "Cơm Cháy",
  "dandelion": "Bồ Công Anh", "milk thistle": "Kế Sữa",
  "star anise": "Hoa Hồi", "cinnamon": "Quế",
  "vetiver": "Cỏ Hương Bài", "agarwood": "Trầm Hương",
  "sandalwood": "Đàn Hương",
  "lotus": "Sen", "lotus seed": "Hạt Sen", "lotus leaf": "Lá Sen",
  "lotus embryo": "Tâm Sen", "lotus plumule": "Tâm Sen",
  "manuka": "Manuka", "noni": "Nhàu", "morinda": "Ba Kích",
  "fo-ti": "Hà Thủ Ô", "gotu kola": "Rau Má",
  "astragalus": "Hoàng Kỳ", "reishi": "Linh Chi",
  "chrysanthemum flower": "Hoa Cúc",
  "rosehip": "Tầm Xuân", "rose hip": "Tầm Xuân", "rosehips": "Quả Tầm Xuân",
  "pine needle": "Kim Thông",
  "anamu": "Anamu (Petiveria)",
  "mormon tea": "Trà Ma Môn", "ephedra": "Ma Hoàng",
  "nu voi": "Nụ Vối",
  "matcha": "Bột Matcha", "green tea": "Trà Xanh",
  "black tea": "Trà Đen", "oolong": "Trà Ô Long",
  "lemon slices": "Chanh Vàng Sấy Lát", "orange slices": "Cam Sấy Lát",
  "dried fruit": "Hoa Quả Sấy", "dried flower": "Hoa Sấy",
  "bay leaves": "Lá Nguyệt Quế", "bay leaf": "Lá Nguyệt Quế",
  "shiitake": "Nấm Hương", "mushroom": "Nấm",
  "wood ear": "Mộc Nhĩ",
  "solomon's seal": "Ngọc Trúc", "astragalus": "Hoàng Kỳ",
  "atiso": "Atiso", "artichoke": "Atiso", "globe artichoke": "Atiso",
  "dried artichoke": "Hoa Atiso Khô",
  "tim sen": "Tâm Sen",
  "bamboo": "Tre / Trúc",
  "yucca": "Cây Yucca",
  "euonymus": "Kim Ngân / Euonymus",
  "common reed": "Sậy",
  "fortune's spindle": "Cây Fortune's Spindle",
  "atlantic bluebell": "Hoa Chuông Xanh Đại Tây Dương",
  "hemp": "Cần Sa / Gai Dầu",
  "flax": "Lanh",
  "sesame": "Mè",
  "sunflower": "Hướng Dương",
  "peanut": "Đậu Phộng", "soybean": "Đậu Nành", "chickpea": "Đậu Gà",
  "lentil": "Đậu Lăng",
  "quinoa": "Diêm Mạch",
  "amaranth grain": "Rau Dền Hạt",
  "chia": "Hạt Chia",
  "flaxseed": "Hạt Lanh",
};

/** Bỏ tiền tố không cần thiết */
function stripPrefix(s) {
  return s
    // "0.5/1KG ", "1.5/2mm ", "99.9% ", "180cm ", "24K ", "2 pack x 100 "
    .replace(/^[\d\s\/\.\%\,]+\s*(x\s*\d+\s*)?(g|gram|grams|kg|oz|lb|mm|cm|ml|l|k|pack|packs|pcs|piece|pieces|count|unit|seeds?|bulbs?)?\s*/i, "")
    // "2 pack x" at start
    .replace(/^\d+\s*pack\s*(x\s*\d+\s*)?/i, "")
    // Số lượng seeds đầu: "100 Seeds - ", "3000 seeds "
    .replace(/^\d[\d,]*\s+seeds?\s*[-–]?\s*/i, "")
    // "x 2 pack" hoặc "x2" ở đầu
    .replace(/^x\s*\d+\s*/i, "")
    .replace(/^\s*[-–]\s*/, "")
    .trim();
}

/** Lấy tên cốt lõi để tra từ điển */
function extractCore(title) {
  let s = stripPrefix(title)
    // Bỏ phần sau | hoặc - (variants: màu, size)
    .replace(/\s*[\|]\s*.*/g, "")
    // Bỏ đuôi "Seeds for Planting/Growing", "for Planting"...
    .replace(/\s+seeds?\s+(for\s+)?(planting|growing|garden|sale|home|easy)[^,]*/i, "")
    .replace(/\s+for\s+(planting|growing|gardening|sale|home|easy|your)[^,]*/i, "")
    .replace(/\s+from\s+seed/i, "")
    // Bỏ đuôi "Seeds" / "Bulbs" / "Plant"
    .replace(/\s+(seeds?|bulbs?|plant|tree|tubers?|plumule)$/i, "")
    // Bỏ descriptor không cần thiết
    .replace(/\b(non-?gmo|heirloom|organic|natural|pure|dried|fresh|easy|vibrant|colorful|hardy|lush|verdant|medicinal|perennial|annual|tropical)\b/gi, "")
    // Bỏ số còn sót
    .replace(/^\d+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    // Bỏ "Seeds" ở giữa nếu còn
    .replace(/\bseeds?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

/** Tra từ điển — trả về {vi, found} */
function lookup(core, isSeeds) {
  const dict = isSeeds ? SEED_DICT : TYPE_DICT;
  const allDict = { ...TYPE_DICT, ...SEED_DICT };
  const lower = core.toLowerCase().trim();

  // Exact
  if (allDict[lower]) return { vi: allDict[lower], found: true };

  // Longest partial match
  let bestKey = "", bestVal = "";
  for (const [k, v] of Object.entries(allDict)) {
    if (lower.includes(k) && k.length > bestKey.length) {
      bestKey = k;
      bestVal = v;
    }
  }
  if (bestVal) return { vi: bestVal, found: true };

  return { vi: core, found: false };
}

/** Sinh tên VN từ tên EN + category */
function generateName(enName, category) {
  const isSeeds = category === "Hạt giống";
  const isTea   = category === "Trà thảo mộc";
  const isHerb  = category === "Thảo mộc khô";
  const isDried = category === "Hoa quả khô";
  const isPlant = category === "Thực vật";

  const core = extractCore(enName);
  const { vi, found } = lookup(core, isSeeds);

  // Nếu không dịch được (vi = core gốc = tiếng Anh), trả về tên viết hoa capitalize đơn giản
  // Không thêm prefix nếu vẫn là tiếng Anh
  const isEnglish = /[A-Z][a-z]/.test(vi) && !/[àáâãäảạấầẩẫậắằẳẵặèéêẽếềểễệìíîĩỉịòóôõöỏọốồổỗộớờởỡợùúûũủụưứừửữựỳýỵỷỹđ]/.test(vi);

  if (!found || isEnglish) {
    // Trường hợp đặc biệt: có thể nhận biết loại sản phẩm từ keywords EN
    const en = enName.toLowerCase();
    if (en.includes("leather") || en.includes("cowhide")) return "Da Thuộc";
    if (en.includes("candle") || en.includes("coconut wax")) return "Nến / Sáp";
    if (en.includes("incense")) return "Nhang Hương";
    if (en.includes("tote") || en.includes("straw bag") || en.includes("seagrass")) return "Túi Cói";
    if (en.includes("mask") || en.includes("collagen")) return "Mặt Nạ";
    if (en.includes("epsom")) return "Muối Epsom";
    if (en.includes("power station")) return "Máy Phát Điện Dự Phòng";
    if (en.includes("dryer") || en.includes("dehydrat")) return "Máy Sấy Thực Phẩm";
    if (en.includes("firestarter") || en.includes("fire starter") || en.includes("metal match")) return "Bật Lửa Đá Lửa";
    if (en.includes("tarp")) return "Bạt Che Mưa";
    if (en.includes("flag")) return "Cờ";
    if (en.includes("boron nitride")) return "Bột Boron Nitride";
    if (en.includes("cream")) return "Kem";
    if (en.includes("shrimp chip") || en.includes("banh phong")) return "Bánh Phồng Tôm";
    if (en.includes("grow light") || en.includes("growbox")) return "Đèn Trồng Cây";
    if (en.includes("planting bag") || en.includes("felt bag")) return "Túi Trồng Cây";
    if (en.includes("cereal") || en.includes("superfood powder")) return "Bột Ngũ Cốc Hỗn Hợp";
    if (en.includes("vegetable flake") || en.includes("pickle")) return "Rau Củ Khô / Dưa Muối";
    if (en.includes("seaweed") && en.includes("rice")) return "Gạo Lứt Rong Biển";
    if (en.includes("molasses")) return "Mật Rỉ Đường";
    if (en.includes("palm oil")) return "Dầu Cọ";
    if (en.includes("menthol")) return "Tinh Thể Bạc Hà";
    if (en.includes("bay leave") || en.includes("bay leaf")) return "Lá Nguyệt Quế Khô";
    if (en.includes("pumpkin") && en.includes("dried")) return "Bí Đỏ Mini Sấy";
    // Không dịch được → giữ phần tên ngắn gọn tiếng Anh (không thêm prefix sai)
    return core.length < 50 ? core : core.substring(0, 40) + "...";
  }

  // Thêm prefix theo category
  if (isSeeds) {
    if (vi.startsWith("Hạt")) return vi;
    if (vi.startsWith("Cây") || vi.startsWith("Cỏ") || vi.startsWith("Rau") ||
        vi.startsWith("Củ") || vi.startsWith("Bí") || vi.startsWith("Dưa") ||
        vi.startsWith("Đậu") || vi.startsWith("Bắp") || vi.startsWith("Cải") ||
        vi.startsWith("Ngò") || vi.startsWith("Sả") || vi.startsWith("Ớt") ||
        vi.startsWith("Măng") || vi.startsWith("Bầu") || vi.startsWith("Mướp") ||
        vi.startsWith("Xà")) return vi;
    return `Hạt ${vi}`;
  }
  if (isTea) {
    if (vi.startsWith("Trà")) return vi;
    return `Trà ${vi}`;
  }
  if (isHerb) return vi;
  if (isDried) {
    if (vi.startsWith("Hoa") || vi.startsWith("Quả") || vi.startsWith("Lá")) return `${vi} Sấy Khô`;
    return vi;
  }
  if (isPlant) {
    if (vi.startsWith("Cây") || vi.startsWith("Củ") || vi.startsWith("Cỏ")) return vi;
    return `Cây ${vi}`;
  }
  return vi;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  // Fix categories
  console.log("🔧 Sửa categories sai...");
  const db = new Database(join(ROOT, "dev.db"));
  fixCategories(db);

  // Lấy products từ DB (sau khi sửa category)
  const products = db.prepare("SELECT skuShopify, name, nameVi, category FROM Product").all();
  const tokenRow = db.prepare("SELECT value FROM Setting WHERE key='googleRefreshToken'").get();
  db.close();

  if (!tokenRow?.value) { console.error("❌ No Google token"); process.exit(1); }

  const bySku = new Map(products.filter(p => p.skuShopify).map(p => [p.skuShopify.trim(), p]));
  const byName = new Map(products.map(p => [p.name.trim(), p]));

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
  const data = rows.slice(1);
  console.log(`📋 Sheet: ${data.length} sản phẩm`);

  // Tạo tên VN cho từng dòng (ghi đè TẤT CẢ — force mode)
  const updates = [];
  const stats = { kept: 0, fromDb: 0, generated: 0 };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const existingVi = row[0]?.trim() ?? "";
    const enName = row[1]?.trim() ?? "";
    const sku = row[2]?.trim() ?? "";
    const dbProduct = bySku.get(sku) ?? byName.get(enName);
    const category = dbProduct?.category ?? "";
    const dbNameVi = dbProduct?.nameVi ?? "";

    // Nếu đã có tên VN trong DB (được đặt tay, không phải auto-gen), giữ nguyên
    // Nhận biết: tên VN gốc không có chữ hoa tiếng Anh và không bắt đầu bằng "Hạt [English]"
    const isBadName = existingVi.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+/) || // 2+ chuỗi Anh hoa
                      (existingVi.startsWith("Hạt ") && /[A-Z]/.test(existingVi.substring(4, 20))) ||
                      (existingVi.startsWith("Trà ") && /\b[A-Z][a-z]{3,}/.test(existingVi.substring(4)));

    let viName = "";

    if (!existingVi || isBadName) {
      // 1. DB có sẵn tên VN tốt
      if (dbNameVi && !dbNameVi.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+/)) {
        viName = dbNameVi;
        stats.fromDb++;
      }
      // 2. Tự sinh
      else if (enName) {
        viName = generateName(enName, category);
        stats.generated++;
      }
      if (viName) updates.push({ row: i + 2, viName, sku, enName, category });
    } else {
      stats.kept++;
    }
  }

  console.log(`\n📊 Kết quả:`);
  console.log(`  Giữ nguyên (tên VN tốt): ${stats.kept}`);
  console.log(`  Lấy từ DB:               ${stats.fromDb}`);
  console.log(`  Tự sinh:                 ${stats.generated}`);
  console.log(`  Cần ghi lên sheet:       ${updates.length}`);

  // Preview
  console.log("\n--- Preview 20 tên mới ---");
  updates.slice(0, 20).forEach(u => {
    console.log(`  [${u.category}] VN: ${u.viName.substring(0,35).padEnd(35)} | EN: ${u.enName.substring(0,45)}`);
  });

  // Ghi lên sheet
  console.log(`\n⏳ Ghi lên Google Sheet...`);
  const batchData = updates.map(u => ({ range: `${TAB}!A${u.row}`, values: [[u.viName]] }));

  const BATCH = 500;
  for (let i = 0; i < batchData.length; i += BATCH) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: "RAW", data: batchData.slice(i, i + BATCH) },
    });
    console.log(`  Đã ghi ${Math.min(i + BATCH, batchData.length)} / ${batchData.length}`);
  }

  // Cập nhật DB
  console.log(`\n⏳ Cập nhật DB...`);
  const db2 = new Database(join(ROOT, "dev.db"));
  const updateDb = db2.prepare("UPDATE Product SET nameVi=?, updatedAt=? WHERE skuShopify=?");
  const now = new Date().toISOString();
  let dbUpdated = 0;
  for (const u of updates) {
    if (u.sku) { const r = updateDb.run(u.viName, now, u.sku); dbUpdated += r.changes; }
  }
  db2.close();
  console.log(`  DB: ${dbUpdated} sản phẩm`);

  console.log(`\n✅ Hoàn thành!`);
}

main().catch(e => { console.error(e); process.exit(1); });
