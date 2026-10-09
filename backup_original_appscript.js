/**
 * ============================================================================
 * BACKUP: สคริปต์เดิมของระบบตรวจนับสต็อก/รับเข้า/เบิกหมึก (Inventory & Issue System)
 * วันที่สำรองข้อมูล: 2026-10-09
 * เวอร์ชันต้นฉบับ: 1.2-NoDrive-Fixed
 * ============================================================================
 */

const SCRIPT_VERSION = "1.2-NoDrive-Fixed";
const SHEET_NAME = "Sheet1";

function doGet(e) {
  if (!e || !e.parameter) return ContentService.createTextOutput("Script Active").setMimeType(ContentService.MimeType.TEXT);
  const action = e.parameter.action;
  if (action === "getData") return ContentService.createTextOutput(JSON.stringify(getInventoryData())).setMimeType(ContentService.MimeType.JSON);
  if (action === "checkMachine") return ContentService.createTextOutput(JSON.stringify(checkMachineStatus(e.parameter.serial))).setMimeType(ContentService.MimeType.JSON);
  if (action === "getSheets") return ContentService.createTextOutput(JSON.stringify({ status: "success", sheets: SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName()) })).setMimeType(ContentService.MimeType.JSON);
  if (action === "getArchiveData") return ContentService.createTextOutput(JSON.stringify(getInventoryData(e.parameter.sheetName))).setMimeType(ContentService.MimeType.JSON);
  return ContentService.createTextOutput(JSON.stringify({ status: "success", version: SCRIPT_VERSION })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === "receive") return ContentService.createTextOutput(JSON.stringify(receiveInk(data.model, data.serial, data.receiver, data.room))).setMimeType(ContentService.MimeType.JSON);
    if (data.action === "issue") return ContentService.createTextOutput(JSON.stringify(issueInk(data.serial, data.model, data.room, data.signatureBase64))).setMimeType(ContentService.MimeType.JSON);
    throw new Error("Invalid action");
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheet(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name || SHEET_NAME); }

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
  getSheet().appendRow([model, serial, room || "", getThaiDateTimeStr(), "", "", receiver]);
  return { status: "success", message: "รับเข้าสต๊อกเรียบร้อยแล้ว" };
}

function issueInk(serial, model, room, signatureBase64) {
  const sheet = getSheet();
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
