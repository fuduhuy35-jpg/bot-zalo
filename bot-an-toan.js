const { ZaloApi } = require('zca-js');
const api = new ZaloApi();
const FILE_DANG_NHAP = './zalo-login.json';

// ==================================================
// 🔧 DANH SÁCH NHÓM ĐƯỢC HOẠT ĐỘNG
// ==================================================
const NHOM_DUOC_KICH_HOAT = {
  // Ban đầu để trống — quản trị viên tự kích hoạt bằng lệnh
  // "UID_NHOM": { ten: "...", ... }
};

// Danh sách quản trị TOÀN CỤ (chỉ những người này mới kích hoạt được)
const QUAN_TRI_TOAN_CUC = {
  "0327602828": { ten: "Đồng Quốc Huy" }
  // Thêm người khác có quyền kích hoạt nếu cần
};

// Dữ liệu tạm
const TRANG_THAI = {};

// ==================================================
// 🔐 KIỂM TRA QUYỀN
// ==================================================
function laQuanTriToanCuc(uid) {
  return !!QUAN_TRI_TOAN_CUC[uid];
}
function laTruongNhom(chatId, uid) {
  return NHOM_DUOC_KICH_HOAT[chatId]?.admin[uid]?.capQuyen === "truong_nhom";
}
function laQuanTri(chatId, uid) {
  const nhom = NHOM_DUOC_KICH_HOAT[chatId];
  if (!nhom) return false;
  const ad = nhom.admin[uid];
  return ad && (ad.capQuyen === "truong_nhom" || ad.capQuyen === "pho_nhom");
}
function layUIDTuTag(text) {
  const m = text.match(/@(\d+)/);
  return m ? m[1] : null;
}

// ==================================================
// 💬 GỬI TIN
// ==================================================
async function guiTin(threadId, noiDung) {
  try {
    await api.sendMessage(threadId, noiDung);
    return true;
  } catch (e) {
    console.error("❌ Gửi tin lỗi:", e.message);
    return false;
  }
}

// ==================================================
// ⚡ ĐUỔI NGƯỜI
// ==================================================
async function kickNguoi(threadId, uidNguoi, lyDo, chanLai = false) {
  try {
    await api.removeUserFromGroup(threadId, uidNguoi);
    if (chanLai) TRANG_THAI[threadId].daChan[uidNguoi] = true;
    await guiTin(threadId, `🚫 ĐÃ ${chanLai ? "ĐUỔI + CHẶN" : "ĐUỔI"} THÀNH CÔNG\nNgười: @${uidNguoi}\nLý do: ${lyDo}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👑 @Đồng Quốc Huy`);
    return true;
  } catch (e) {
    await guiTin(threadId, `⚠️ Không thể xử lý @${uidNguoi}`);
    return false;
  }
}

// ==================================================
// 🔗 PHÁT HIỆN LINK & TỪ CẤM
// ==================================================
function phatHienLink(text) {
  const m = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)|([a-zA-Z0-9][a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}[^\s<>"{}|\\^`\[\]]*/gi;
  return text.match(m) || [];
}
function coTuCam(text, ds) {
  return ds.some(tu => text.toLowerCase().includes(tu.toLowerCase()));
}

// ==================================================
// 📖 MENU LỆNH
// ==================================================
const MENU_KICH_HOAT = `🤖 BOT CHƯA ĐƯỢC KÍCH HOẠT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 Bot chỉ hoạt động khi được Quản trị viên kích hoạt
Gõ lệnh:
/kich_hoat [Tên nhóm] @UID_Trưởng_Nhóm
Ví dụ: /kich_hoat "Nhóm Lớp" @123456789
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 Quản lý hệ thống: @Đồng Quốc Huy`;

const MENU_CHINH = `🤖 MENU LỆNH QUẢN LÝ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 TẤT CẢ:
/help — Xem menu
/nội_quy — Xem nội quy
/danh_sach_admin — Xem quản trị
/link_nhom — Lấy link mời
/bao_cao @người [lý do] — Báo cáo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 QUẢN TRỊ:
/kick @người [lý do] — Đuổi
/ban @người [lý do] — Đuổi + chặn
/unban @người — Bỏ chặn
/canh_bao @người [lý do] — Cảnh cáo
/ghim [nội dung] — Ghim tin
/bo_ghim — Bỏ ghim
/them_admin @người — Thêm phó
/xoa_admin @người — Thu hồi quyền
/chi_admin_gui — Chỉ quản trị gửi tin
/tat_che_do — Mở bình thường
/thong_ke — Xem thống kê
/reset_vi_pham @người — Xóa vi phạm
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 TRƯỞNG NHÓM:
/bat_tu_dong_chao — Bật chào
/tat_tu_dong_chao — Tắt chào
/dat_noi_quy [nội dung] — Đổi nội quy
/them_tu_cam [từ] — Thêm từ cấm
/xoa_tu_cam [từ] — Xóa từ cấm
/dat_nguong [số] — Đặt ngưỡng
/bat_kick_link — Bật đuổi link
/tat_kick_link — Tắt đuổi link
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 @Đồng Quốc Huy`;

// ==================================================
// 🧠 XỬ LÝ TIN NHẮN
// ==================================================
async function xuLyTinNhan(tin) {
  const threadId = tin.threadId;
  const nguoiGui = tin.senderId;
  const noiDung = tin.content?.trim() || "";
  const lenh = noiDung.split(" ")[0];
  const thamSo = noiDung.slice(lenh.length).trim();

  // ─── KÍCH HOẠT NHÓM — Chỉ quản trị hệ thống mới làm được ───
  if (lenh === "/kich_hoat") {
    if (!laQuanTriToanCuc(nguoiGui)) {
      await guiTin(threadId, "❌ Chỉ người quản lý hệ thống mới được kích hoạt!");
      return;
    }
    const uidTruong = layUIDTuTag(thamSo);
    if (!uidTruong) {
      await guiTin(threadId, "⚠️ Dùng: /kich_hoat \"Tên nhóm\" @UID_Trưởng_Nhóm");
      return;
    }
    const tenNhom = thamSo.replace(/@\d+/g, '').trim() || "Nhóm mới";
    
    // Thêm nhóm vào danh sách được phép
    NHOM_DUOC_KICH_HOAT[threadId] = {
      ten: tenNhom,
      linkMoi: "https://zalo.me/link-cua-nhom",
      noiQuy: `📋 NỘI QUY ${tenNhom}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n1. Cấm gửi link lạ\n2. Tôn trọng mọi thành viên\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👑 Quản lý: @Đồng Quốc Huy`,
      admin: {
        [uidTruong]: { ten: "Trưởng Nhóm", capQuyen: "truong_nhom" }
      },
      tuDongKickLink: true,
      gioiHanCanhBao: 3,
      tuKhoaCam: [],
      tuDongChao: true,
      chiAdminGui: false
    };
    
    TRANG_THAI[threadId] = { viPham: {}, daChan: {}, tinGhim: null };
    await guiTin(threadId, `✅ KÍCH HOẠT THÀNH CÔNG!\nNhóm: ${tenNhom}\nTrưởng nhóm: @${uidTruong}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nBot đã sẵn sàng hoạt động! Gõ /help để xem lệnh.`);
    console.log(`✅ Kích hoạt nhóm: ${threadId} | ${tenNhom}`);
    return;
  }

  // ─── KIỂM TRA NHÓM ĐÃ ĐƯỢC KÍCH HOẠT CHƯA ───
  const nhom = NHOM_DUOC_KICH_HOAT[threadId];
  if (!nhom) {
    // Chỉ trả lời lệnh kích hoạt, bỏ qua mọi tin khác
    if (lenh === "/help" || lenh === "/tro_giup") {
      await guiTin(threadId, MENU_KICH_HOAT);
    }
    return; // Bỏ qua hoàn toàn nếu chưa kích hoạt
  }

  // ====== TỪ ĐÂY NHÓM ĐÃ ĐƯỢC PHÉP HOẠT ĐỘNG ======
  const tt = TRANG_THAI[threadId];
  const uidDich = layUIDTuTag(thamSo);
  const lyDo = thamSo.replace(/@\d+/g, '').trim() || "Không có";

  // Chặn tin nếu chỉ quản trị được gửi
  if (nhom.chiAdminGui && !laQuanTri(threadId, nguoiGui) && !noiDung.startsWith("/")) {
    return;
  }

  // Tự động đuổi link
  const linkTimThay = phatHienLink(noiDung);
  if (linkTimThay.length && !laQuanTri(threadId, nguoiGui) && nhom.tuDongKickLink) {
    tt.viPham[nguoiGui] = (tt.viPham[nguoiGui] || 0) + 1;
    if (tt.viPham[nguoiGui] >= nhom.gioiHanCanhBao) {
      await kickNguoi(threadId, nguoiGui, `Gửi link: ${linkTimThay[0]}`);
    } else {
      await guiTin(threadId, `⚠️ Cảnh báo @${nguoiGui} — Lần ${tt.viPham[nguoiGui]}/${nhom.gioiHanCanhBao}\n🚫 Không gửi link trong nhóm!`);
    }
    return;
  }

  // Từ khóa cấm
  if (coTuCam(noiDung, nhom.tuKhoaCam) && !laQuanTri(threadId, nguoiGui)) {
    tt.viPham[nguoiGui] = (tt.viPham[nguoiGui] || 0) + 1;
    if (tt.viPham[nguoiGui] >= nhom.gioiHanCanhBao) {
      await kickNguoi(threadId, nguoiGui, "Nội dung vi phạm quy định");
    } else {
      await guiTin(threadId, `⚠️ Cảnh báo @${nguoiGui} — Lần ${tt.viPham[nguoiGui]}/${nhom.gioiHanCanhBao}\n🚫 Nội dung không phù hợp!`);
    }
    return;
  }

  // Xử lý lệnh
  switch (lenh) {
    case "/help": case "/tro_giup":
      await guiTin(threadId, MENU_CHINH); break;
    case "/nội_quy":
      await guiTin(threadId, nhom.noiQuy); break;
    case "/danh_sach_admin":
      const dsQT = Object.entries(nhom.admin).map(([uid, i]) =>
        `• ${i.capQuyen==="truong_nhom"?"👑":"🔧"} ${i.ten} — @${uid}`
      ).join("\n");
      await guiTin(threadId, `📋 QUẢN TRỊ VIÊN — ${nhom.ten}\n${dsQT}`); break;
    case "/link_nhom":
      await guiTin(threadId, `🔗 Link mời — ${nhom.ten}:\n${nhom.linkMoi}`); break;
    case "/bao_cao":
      if (!uidDich) { await guiTin(threadId, "⚠️ Dùng: /bao_cao @người [lý do]"); break; }
      await guiTin(threadId, "📩 Đã báo cáo cho Quản trị viên ✅"); break;

    case "/kick":
      if (!laQuanTri(threadId, nguoiGui)) { await guiTin(threadId, "❌ Không có quyền!"); break; }
      if (!uidDich) { await guiTin(threadId, "⚠️ Dùng: /kick @người [lý do]"); break; }
      await kickNguoi(threadId, uidDich, lyDo); break;
    case "/ban":
      if (!laQuanTri(threadId, nguoiGui)) { await guiTin(threadId, "❌ Không có quyền!"); break; }
      if (!uidDich) { await guiTin(threadId, "⚠️ Dùng: /ban @người [lý do]"); break; }
      await kickNguoi(threadId, uidDich, lyDo, true); break;
    case "/unban":
      if (!laQuanTri(threadId, nguoiGui)) { await guiTin(threadId, "❌ Không có quyền!"); break; }
      if (!uidDich) { await guiTin(threadId, "⚠️ Dùng: /unban @người"); break; }
      delete tt.daChan[uidDich];
      await guiTin(threadId, `✅ Đã bỏ chặn @${uidDich}`); break;
    case "/canh_bao":
      if (!laQuanTri(threadId, nguoiGui)) { await guiTin(threadId, "❌ Không có quyền!"); break; }
      if (!uidDich) { await guiTin(threadId, "⚠️ Dùng: /canh_bao @người [lý do]"); break; }
      tt.viPham[uidDich] = (tt.viPham[uidDich] || 0) + 1;
      await guiTin(threadId, `⚠️ CẢNH BÁO @${uidDich}\nLý do: ${lyDo}\nSố lần: ${tt.viPham[uidDich]}/${nhom.gioiHanCanhBao}`);
      if (tt.viPham[uidDich] >= nhom.gioiHanCanhBao) {
        await kickNguoi(threadId, uidDich, "Đủ ngưỡng cảnh báo");
      }
      break;
    case "/ghim":
      if (!laQuanTri(threadId, nguoiGui)) { await guiTin(threadId, "❌ Không có quyền!"); break; }
      if (!thamSo) { await guiTin(threadId, "⚠️ Dùng: /ghim Nội dung"); break; }
      tt.tinGhim = thamSo;
      await guiTin(threadId, `📌 Đã ghim:\n${thamSo}`); break;
    case "/bo_ghim":
      if (!laQuanTri(threadId, nguoiGui)) { await guiTin(threadId, "❌ Không có quyền!"); break; }
      tt.tinGhim = null;
      await guiTin(threadId, "✅ Đã bỏ ghim"); break;
    case "/them_admin":
      if (!laTruongNhom(threadId, nguoiGui)) { await guiTin(threadId, "❌ Chỉ trưởng nhóm!"); break; }
      if (!uidDich) { await guiTin(threadId, "⚠️ Dùng: /them_admin @người"); break; }
      nhom.admin[uidDich] = { ten: "Phó Nhóm", capQuyen: "pho_nhom" };
      await guiTin(threadId, `✅ Đã bổ nhiệm @${uidDich} làm Phó Nhóm`); break;
    case "/xoa_admin":
      if (!laTruongNhom(threadId, nguoiGui)) { await guiTin(threadId, "❌ Chỉ trưởng nhóm!"); break; }
      if (!uidDich) { await guiTin(threadId, "⚠️ Dùng: /xoa_admin @người"); break; }
      if (nhom.admin[uidDich]?.capQuyen === "truong_nhom") { await guiTin(threadId, "❌ Không thu hồi quyền trưởng nhóm!"); break; }
      delete nhom.admin[uidDich];
      await guiTin(threadId, `✅ Đã thu hồi quyền quản trị @${uidDich}`); break;
    case "/chi_admin_gui":
      if (!laQuanTri(threadId, nguoiGui)) { await guiTin(threadId, "❌ Không có quyền!"); break; }
      nhom.chiAdminGui = true;
      await guiTin(threadId, "✅ Chỉ quản trị viên được gửi tin"); break;
    case "/tat_che_do":
      if (!laQuanTri(threadId, nguoiGui)) { await guiTin(threadId, "❌ Không có quyền!"); break; }
      nhom.chiAdminGui = false;
      await guiTin(threadId, "✅ Đã mở chế độ bình thường"); break;
    case "/thong_ke":
      if (!laQuanTri(threadId, nguoiGui)) { await guiTin(threadId, "❌ Không có quyền!"); break; }
      await guiTin(threadId, `📊 THỐNG KÊ — ${nhom.ten}
Số quản trị: ${Object.keys(nhom.admin).length}
Số vi phạm: ${Object.keys(tt.viPham).length}
Ngưỡng: ${nhom.gioiHanCanhBao} lần
Đuổi link: ${nhom.tuDongKickLink?"✅ BẬT":"❌ TẮT"}
Tự động chào: ${nhom.tuDongChao?"✅ BẬT":"❌ TẮT"}`); break;
    case "/reset_vi_pham":
      if (!laQuanTri(threadId, nguoiGui)) { await guiTin(threadId, "❌ Không có quyền!"); break; }
      if (!uidDich) { await guiTin(threadId, "⚠️ Dùng: /reset_vi_pham @người"); break; }
      delete tt.viPham[uidDich];
      await guiTin(threadId, `✅ Đã xóa vi phạm của @${uidDich}`); break;
    case "/bat_tu_dong_chao":
      if (!laTruongNhom(threadId, nguoiGui)) { await guiTin(threadId, "❌ Chỉ trưởng nhóm!"); break; }
      nhom.tuDongChao = true;
      await guiTin(threadId, "✅ Bật tự động chào"); break;
    case "/tat_tu_dong_chao":
      if (!laTruongNhom(threadId, nguoiGui)) { await guiTin(threadId, "❌ Chỉ trưởng nhóm!"); break; }
      nhom.tuDongChao = false;
      await guiTin(threadId, "✅ Tắt tự động chào"); break;
    case "/dat_noi_quy":
      if (!laTruongNhom(threadId, nguoiGui)) { await guiTin(threadId, "❌ Chỉ trưởng nhóm!"); break; }
      if (!thamSo) { await guiTin(threadId, "⚠️ Dùng: /dat_noi_quy Nội dung"); break; }
      nhom.noiQuy = thamSo;
      await guiTin(threadId, "✅ Đã cập nhật nội quy"); break;
    case "/them_tu_cam":
      if (!laTruongNhom(threadId, nguoiGui)) { await guiTin(threadId, "❌ Chỉ trưởng nhóm!"); break; }
      if (!thamSo) { await guiTin(threadId, "⚠️ Dùng: /them_tu_cam từ_khoá"); break; }
      if (!nhom.tuKhoaCam.includes(thamSo)) nhom.tuKhoaCam.push(thamSo);
      await guiTin(threadId, `✅ Thêm từ khóa cấm: "${thamSo}"`); break;
    case "/xoa_tu_cam":
      if (!laTruongNhom(threadId, nguoiGui)) { await guiTin(threadId, "❌ Chỉ trưởng nhóm!"); break; }
      if (!thamSo) { await guiTin(threadId, "⚠️ Dùng: /xoa_tu_cam từ_khoá"); break; }
      nhom.tuKhoaCam = nhom.tuKhoaCam.filter(t => t !== thamSo);
      await guiTin(threadId, `✅ Xóa từ khóa cấm: "${thamSo}"`); break;
    case "/dat_nguong":
      if (!laTruongNhom(threadId, nguoiGui)) { await guiTin(threadId, "❌ Chỉ trưởng nhóm!"); break; }
      const so = parseInt(thamSo);
      if (!so || so < 1) { await guiTin(threadId, "⚠️ Ví dụ: /dat_nguong 3"); break; }
      nhom.gioiHanCanhBao = so;
      await guiTin(threadId, `✅ Đặt ngưỡng: ${so} lần`); break;
    case "/bat_kick_link":
      if (!laTruongNhom(threadId, nguoiGui)) { await guiTin(threadId, "❌ Chỉ trưởng nhóm!"); break; }
      nhom.tuDongKickLink = true;
      await guiTin(threadId, "✅ Bật tự động đuổi khi gửi link"); break;
    case "/tat_kick_link":
      if (!laTruongNhom(threadId, nguoiGui)) { await guiTin(threadId, "❌ Chỉ trưởng nhóm!"); break; }
      nhom.tuDongKickLink = false;
      await guiTin(threadId, "✅ Tắt tự động đuổi khi gửi link"); break;
  }
}

// ==================================================
// 🚀 KHỞI ĐỘNG
// ==================================================
async function khoiDong() {
  console.log("🔐 Đang đăng nhập tài khoản phụ...");
  try {
    await api.loginWithQrCode({ saveCredentials: true, credentialFile: FILE_DANG_NHAP });
    console.log("✅ Đăng nhập thành công!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🤖 BOT AN TOÀN — Chỉ hoạt động khi được kích hoạt");
    console.log(`👑 Quản lý hệ thống: ${Object.keys(QUAN_TRI_TOAN_CUC).length} người`);
    console.log(`🔒 Nhóm đã kích hoạt: ${Object.keys(NHOM_DUOC_KICH_HOAT).length}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📌 Để kích hoạt nhóm mới: /kich_hoat \"Tên nhóm\" @UID_Trưởng");
  } catch (e) {
    console.error("❌ Đăng nhập thất bại:", e.message);
    process.exit(1);
  }

  api.onMessage(xuLyTinNhan);
}

khoiDong();