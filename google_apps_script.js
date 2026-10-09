/**
 * ============================================================================
 * Google Apps Script รวมระบบ:
 * 1. ระบบเดิม: ตรวจเช็คสต็อก / รับเข้า / เบิกหมึก (Inventory & Issue)
 * 2. ระบบใหม่: ระบบบันทึกการส่งคืนหมึก Ricoh (Toner Return Database)
 * ============================================================================
 */

const SCRIPT_VERSION = "2.0-Merged-ReturnRicoh";
const SHEET_NAME = "Sheet1"; // สำหรับระบบรับเข้า/เบิกเดิม
const SPREADSHEET_ID = '1uRjw1DguHPZrz802mhqHqk-83Wt6tiy9AUC5DUOVubA';

// หัวตารางสำหรับชีต "return ricoh"
const RETURN_HEADERS = [
  'เลขที่เอกสาร',
  'วันที่คืน',
  'Serial เครื่อง',
  'ห้อง / แผนก',
  'รุ่นเครื่อง',
  'รุ่นหมึก',
  'C (Cyan)',
  'M (Magenta)',
  'Y (Yellow)',
  'K (Black)',
  'ยอดรวม (ตลับ)',
  'ผู้ส่งคืน',
  'ผู้รับคืน',
  'หมายเหตุ / สภาพหมึก',
  'วันเวลาบันทึกระบบ'
];

// ============================================================================
// GET ROUTER
// ============================================================================
function doGet(e) {
  if (!e || !e.parameter) {
    return ContentService.createTextOutput("Script Active - Return Ricoh & Inventory Ready")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  const action = e.parameter.action;

  // --- ระบบคืนหมึก Ricoh (ดึงประวัติการคืน) ---
  if (action === "clearAll" || action === "clearReturnRecords") {
    return ContentService.createTextOutput(JSON.stringify(clearReturnRecords()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "migrate" || action === "resetAndMigrate") {
    return ContentService.createTextOutput(JSON.stringify(migrateExistingHistory()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (!action || action === "getReturns" || action === "getReturnHistory") {
    return ContentService.createTextOutput(JSON.stringify(getReturnHistory()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // --- ระบบรับเข้า/เบิกหมึกเดิม ---
  if (action === "getData") {
    return ContentService.createTextOutput(JSON.stringify(getInventoryData()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "checkMachine") {
    return ContentService.createTextOutput(JSON.stringify(checkMachineStatus(e.parameter.serial)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "getSheets") {
    const ss = getSpreadsheet();
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      sheets: ss.getSheets().map(s => s.getName()) 
    })).setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "getArchiveData") {
    return ContentService.createTextOutput(JSON.stringify(getInventoryData(e.parameter.sheetName)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "success", version: SCRIPT_VERSION }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// POST ROUTER
// ============================================================================
function doPost(e) {
  try {
    let data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    // 1. ระบบเดิม: รับเข้า
    if (data.action === "receive") {
      return ContentService.createTextOutput(JSON.stringify(receiveInk(data.model, data.serial, data.receiver, data.room)))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. ระบบเดิม: เบิกจ่าย
    if (data.action === "issue") {
      return ContentService.createTextOutput(JSON.stringify(issueInk(data.serial, data.model, data.room, data.signatureBase64)))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. ล้างข้อมูลประวัติการคืนทั้งหมด
    if (data.action === "clearAll" || data.action === "clearReturnRecords") {
      return ContentService.createTextOutput(JSON.stringify(clearReturnRecords()))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. ระบบใหม่: บันทึกการส่งคืนหมึก Ricoh (รองรับทั้ง data.action === 'return' หรือส่งข้อมูลคืนมาตรงๆ)
    if (data.action === "return" || data.action === "saveReturn" || data.serial !== undefined) {
      return ContentService.createTextOutput(JSON.stringify(saveReturnRecord(data)))
        .setMimeType(ContentService.MimeType.JSON);
    }

    throw new Error("Invalid action: " + (data.action || 'empty'));
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// ฟังก์ชันสำหรับระบบคืนหมึก RICOH (NEW)
// ============================================================================
function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function getOrCreateReturnSheet() {
  const ss = getSpreadsheet();
  if (!ss) throw new Error('ไม่สามารถเปิด Spreadsheet ได้');

  const candidateNames = ['return ricoh', 'retuen ricoh', 'Return Ricoh'];
  let sheet = null;
  for (let name of candidateNames) {
    sheet = ss.getSheetByName(name);
    if (sheet) break;
  }

  if (!sheet) {
    sheet = ss.insertSheet('return ricoh');
  }

  // ตรวจสอบหัวตาราง
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(RETURN_HEADERS);
    formatReturnHeaderRow(sheet);
  } else {
    const firstCell = String(sheet.getRange(1, 1).getValue()).trim();
    if (!firstCell || firstCell === 'serial' || firstCell === 'serial ') {
      sheet.getRange(1, 1, 1, RETURN_HEADERS.length).setValues([RETURN_HEADERS]);
      formatReturnHeaderRow(sheet);
    }
  }

  return sheet;
}

function formatReturnHeaderRow(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, RETURN_HEADERS.length);
  headerRange.setBackground('#e11d48');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

function getReturnHistory() {
  try {
    const sheet = getOrCreateReturnSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { status: 'success', data: [] };
    }

    const rows = sheet.getRange(2, 1, lastRow - 1, RETURN_HEADERS.length).getValues();
    const records = rows.map((r, index) => {
      let returnDateStr = '';
      if (r[1] instanceof Date) {
        returnDateStr = Utilities.formatDate(r[1], Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        returnDateStr = String(r[1] || '');
      }

      return {
        id: String(r[0] || ('RT-' + (index + 1))),
        returnDate: returnDateStr,
        serial: String(r[2] || ''),
        room: String(r[3] || ''),
        model: String(r[4] || ''),
        tonerModel: String(r[5] || ''),
        c: Number(r[6]) || 0,
        m: Number(r[7]) || 0,
        y: Number(r[8]) || 0,
        k: Number(r[9]) || 0,
        total: Number(r[10]) || 0,
        returner: String(r[11] || ''),
        receiver: String(r[12] || ''),
        notes: String(r[13] || '-'),
        timestamp: String(r[14] || '')
      };
    });

    records.reverse(); // ล่าสุดขึ้นก่อน
    return { status: 'success', data: records };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function saveReturnRecord(payload) {
  const sheet = getOrCreateReturnSheet();
  const id = payload.id || ('RT-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss'));
  const returnDate = payload.returnDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const serial = payload.serial || '';
  const room = payload.room || '';
  const model = payload.model || '';
  const tonerModel = payload.tonerModel || '';
  const c = Number(payload.c) || 0;
  const m = Number(payload.m) || 0;
  const y = Number(payload.y) || 0;
  const k = Number(payload.k) || 0;
  const total = Number(payload.total) || (c + m + y + k);
  const returner = payload.returner || '';
  const receiver = payload.receiver || '';
  const notes = payload.notes || '-';
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

  sheet.appendRow([
    id,
    returnDate,
    serial,
    room,
    model,
    tonerModel,
    c,
    m,
    y,
    k,
    total,
    returner,
    receiver,
    notes,
    timestamp
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, 2).setHorizontalAlignment('center');
  sheet.getRange(lastRow, 7, 1, 5).setHorizontalAlignment('center');

  return {
    status: 'success',
    message: 'บันทึกการส่งคืนหมึกลง Google Sheet สำเร็จ',
    id: id
  };
}

// ----------------------------------------------------------------------------
// ฟังก์ชันล้างข้อมูลประวัติการคืนทั้งหมด (เคลียร์ทั้งชีตให้เหลือเฉพาะหัวตาราง)
// ----------------------------------------------------------------------------
function clearReturnRecords() {
  const sheet = getOrCreateReturnSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, RETURN_HEADERS.length).clear();
  }
  return {
    status: 'success',
    message: 'ล้างข้อมูลประวัติการคืนหมึกทั้งหมดใน Google Sheet เรียบร้อยแล้ว'
  };
}

// ----------------------------------------------------------------------------
// ฟังก์ชันล้างข้อมูลทดสอบ (TEST-SERIAL) และนำเข้าประวัติจริง 13 รายการจาก Sheet1
// ----------------------------------------------------------------------------
function migrateExistingHistory() {
  const sheet = getOrCreateReturnSheet();

  // 1. เปลี่ยนชื่อแท็บให้ถูกต้อง (ถ้าชื่อเดิมคือ retuen ricoh)
  if (sheet.getName() !== 'return ricoh') {
    try {
      sheet.setName('return ricoh');
    } catch (e) {}
  }

  // 2. ล้างข้อมูลแถวเก่าทั้งหมดใต้หัวตาราง (ลบรายการ TEST-SERIAL ออก 100%)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, RETURN_HEADERS.length).clear();
  }

  // 3. ข้อมูลประวัติจริง 13 รายการดั้งเดิม (แปลงแยก CMYK ให้ถูกต้อง)
  const REAL_RECORDS = [
    ["RT-SH001", "20/5/2569", "9173RB20195", "ห้องประชุมกลาง (ประถม)", "IM C4500", "IM C6010 M", 0, 1, 0, 0, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "กรกฎ เย็นคงคา", "คืนหมึกจาก Google Sheets", "20/5/2569 12:59:18"],
    ["RT-SH002", "2/7/2569", "9154R130684", "อำนวยการ (มัธยม)", "IM C3010", "IM C3510 B", 0, 0, 0, 1, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "กรกฎ เย็นคงคา", "คืนหมึกจาก Google Sheets", "2/7/2569 9:15:04"],
    ["RT-SH003", "7/7/2569", "9173RB20195", "ห้องประชุมกลาง (ประถม)", "IM C4500", "IM C6010 B", 0, 0, 0, 1, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "กรกฎ เย็นคงคา", "คืนหมึกจาก Google Sheets", "7/7/2569 13:22:56"],
    ["RT-SH004", "21/7/2569", "9173RB20165", "วิชาการ (มัธยม)", "IM C4510", "IM C6010 B", 0, 0, 0, 1, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "พิชาวัจน์ เกิดเรืองสิน", "คืนหมึกจาก Google Sheets", "21/7/2569 8:34:54"],
    ["RT-SH005", "14/8/2569", "9173RB20195", "ห้องประชุมกลาง (ประถม)", "IM C4500", "IM C6010 Y", 0, 0, 1, 0, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "พิชาวัจน์ เกิดเรืองสิน", "คืนหมึกจาก Google Sheets", "14/8/2569 9:27:43"],
    ["RT-SH006", "2/9/2569", "9154R130684", "อำนวยการ (มัธยม)", "IM C3010", "IM C3510 M", 0, 1, 0, 0, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "พิชาวัจน์ เกิดเรืองสิน", "คืนหมึกจาก Google Sheets", "2/9/2569 13:07:22"],
    ["RT-SH007", "2/9/2569", "9154R130684", "อำนวยการ (มัธยม)", "IM C3010", "IM C3510 C", 1, 0, 0, 0, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "พิชาวัจน์ เกิดเรืองสิน", "คืนหมึกจาก Google Sheets", "2/9/2569 13:06:59"],
    ["RT-SH008", "7/10/2569", "9154R130684", "อำนวยการ (มัธยม)", "IM C3010", "IM C3510 B", 0, 0, 0, 1, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "พิชาวัจน์ เกิดเรืองสิน", "คืนหมึกจาก Google Sheets", "7/10/2569 11:00:34"],
    ["RT-SH009", "7/10/2569", "9154R130684", "อำนวยการ (มัธยม)", "IM C3010", "IM C3510 Y", 0, 0, 1, 0, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "พิชาวัจน์ เกิดเรืองสิน", "คืนหมึกจาก Google Sheets", "7/10/2569 11:00:58"],
    ["RT-SH010", "1/10/2569", "9173RB20165", "วิชาการ (มัธยม)", "IM C4510", "IM C6010 B", 0, 0, 0, 1, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "กรกฎ เย็นคงคา", "คืนหมึกจาก Google Sheets", "1/10/2569 14:31:44"],
    ["RT-SH011", "25/9/2569", "9173RB20195", "ห้องประชุมกลาง (ประถม)", "IM C4500", "IM C6010 C", 1, 0, 0, 0, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "กรกฎ เย็นคงคา", "คืนหมึกจาก Google Sheets", "25/9/2569 10:44:26"],
    ["RT-SH012", "1/10/2569", "9173RB20165", "วิชาการ (มัธยม)", "IM C4510", "IM C6010 Y", 0, 0, 1, 0, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "พิชาวัจน์ เกิดเรืองสิน", "คืนหมึกจาก Google Sheets", "1/10/2569 14:34:57"],
    ["RT-SH013", "1/10/2569", "9173RB20165", "วิชาการ (มัธยม)", "IM C4510", "IM C6010 M", 0, 1, 0, 0, 1, "ครู/เจ้าหน้าที่ประจำห้อง", "กรกฎ เย็นคงคา", "คืนหมึกจาก Google Sheets", "1/10/2569 14:34:26"]
  ];

  sheet.getRange(2, 1, REAL_RECORDS.length, RETURN_HEADERS.length).setValues(REAL_RECORDS);

  // จัดรูปแบบกึ่งกลาง
  sheet.getRange(2, 1, REAL_RECORDS.length, 2).setHorizontalAlignment('center');
  sheet.getRange(2, 7, REAL_RECORDS.length, 5).setHorizontalAlignment('center');

  return {
    status: 'success',
    message: 'ล้างข้อมูลทดสอบและนำเข้าประวัติจริง 13 รายการเรียบร้อยแล้ว',
    count: REAL_RECORDS.length
  };
}


// ============================================================================
// ฟังก์ชันของระบบเดิม (ORIGINAL INVENTORY & ISSUE SYSTEM)
// ============================================================================
function getSheet(name) { 
  return getSpreadsheet().getSheetByName(name || SHEET_NAME); 
}

function getInventoryData(customSheetName) {
  const sheet = getSheet(customSheetName);
  if (!sheet) return { status: "error", message: "Sheet not found" };
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: "success", recentActivity: [], allRows: [] };
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    rows.push({
      model: data[i][0], serial: data[i][1], room: data[i][2],
      dateReceived: formatDate(data[i][3]), dateIssued: formatDate(data[i][4]),
      signer: data[i][5], receiver: data[i][6]
    });
  }
  return { status: "success", recentActivity: rows.slice(-50).reverse(), allRows: rows };
}

function checkMachineStatus(serial) {
  const sheet = getSheet();
  if (!sheet) return { status: "error", message: "Sheet not found" };
  const data = sheet.getDataRange().getValues();
  let availableModels = [], room = "";
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(serial).trim()) {
      room = data[i][2] || room;
      if (!(data[i][4] !== "" && data[i][4] !== null)) availableModels.push(data[i][0]);
    }
  }
  if (availableModels.length > 0) return { status: "success", message: "พบหมึกในสต๊อก", models: [...new Set(availableModels)], room: room };
  return { status: "error", message: "ไม่พบหมึกในสต๊อกสำหรับเครื่องนี้" };
}

function receiveInk(model, serial, receiver, room) {
  const sheet = getSheet();
  if (!sheet) throw new Error("ไม่พบชีตสำหรับรับเข้า");
  sheet.appendRow([model, serial, room || "", getThaiDateTimeStr(), "", "", receiver]);
  return { status: "success", message: "รับเข้าสต๊อกเรียบร้อยแล้ว" };
}

function issueInk(serial, model, room, signatureBase64) {
  const sheet = getSheet();
  if (!sheet) return { status: "error", message: "Sheet not found" };
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(serial).trim() && String(data[i][0]).trim() === String(model).trim()) {
      if (data[i][4] === "" || data[i][4] === null) { rowIndex = i + 1; break; }
    }
  }
  if (rowIndex === -1) return { status: "error", message: "ไม่พบหมึกในสต๊อก" };
  const imageUrl = signatureBase64 || "-";
  sheet.getRange(rowIndex, 3).setValue(room);
  sheet.getRange(rowIndex, 5).setValue(getThaiDateTimeStr());
  sheet.getRange(rowIndex, 6).setValue(imageUrl);
  return { status: "success", message: "บันทึกการเบิกเรียบร้อยแล้ว" };
}

function formatDate(dateObj) {
  if (!dateObj) return "";
  try {
    if (typeof dateObj === 'string' && dateObj.includes('/')) return dateObj;
    return Utilities.formatDate(new Date(dateObj), "GMT+7", "dd/MM/yyyy HH:mm:ss");
  } catch(e) { return String(dateObj); }
}

function getThaiDateTimeStr() {
  const d = new Date();
  const f = (fmt) => Utilities.formatDate(d, "GMT+7", fmt);
  return `${f("dd")}/${f("MM")}/${parseInt(f("yyyy")) + 543} ${f("HH:mm:ss")}`;
}

