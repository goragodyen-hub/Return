// ==========================================================================
// Ricoh Toner Return Management System - Main Application Logic
// ==========================================================================

const STORAGE_KEY = 'ricoh_toner_returns_data';
const THEME_KEY = 'ricoh_app_theme';

// State
let returnRecords = [];
let currentFilter = {
  keyword: '',
  room: '',
  color: ''
};

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initClock();
  initPWA();
  initMachinesDatalist();
  initRoomFilterDropdown();
  initSheetsSync();
  loadData();
  setupEventListeners();
  setDefaultDate();
  initFormalReportModule();
});

// --------------------------------------------------------------------------
// Initialization & Theme
// --------------------------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'theme-dark';
  document.body.className = savedTheme;
  updateThemeIcon(savedTheme);

  document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = document.body.classList.contains('theme-dark');
    const newTheme = isDark ? 'theme-light' : 'theme-dark';
    document.body.className = newTheme;
    localStorage.setItem(THEME_KEY, newTheme);
    updateThemeIcon(newTheme);
  });
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  btn.innerHTML = theme === 'theme-dark' 
    ? '<i class="fa-solid fa-moon"></i>' 
    : '<i class="fa-solid fa-sun"></i>';
}

function initClock() {
  const clockEl = document.getElementById('liveClock');
  const update = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('th-TH');
  };
  update();
  setInterval(update, 1000);
}

// --------------------------------------------------------------------------
// Progressive Web App (PWA) Integration
// --------------------------------------------------------------------------
let deferredInstallPrompt = null;

function initPWA() {
  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered successfully:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }

  // 2. Handle Install Prompt
  const installBtn = document.getElementById('btnInstallPwa');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBtn) {
      installBtn.style.display = 'inline-flex';
    }
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log('[PWA] User choice:', outcome);
      deferredInstallPrompt = null;
      installBtn.style.display = 'none';
    });
  }

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (installBtn) installBtn.style.display = 'none';
    showToast('ติดตั้งแอปพลิเคชัน Return Ricoh สำเร็จแล้ว!');
  });
}

function setDefaultDate() {
  const dateInput = document.getElementById('returnDate');
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
}

// --------------------------------------------------------------------------
// Populate Machine Datalist & Filters
// --------------------------------------------------------------------------
function initMachinesDatalist() {
  const datalist = document.getElementById('machineDatalist');
  if (!datalist) return;
  datalist.innerHTML = '';

  RICOH_MACHINES.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.serial;
    const typeLabel = m.isColor ? 'สี' : 'ขาว-ดำ';
    const noteBadge = m.note ? ` [${m.note}]` : '';
    opt.label = `${m.room} | ${m.model} (${typeLabel})${noteBadge}`;
    datalist.appendChild(opt);
  });
}

function initRoomFilterDropdown() {
  const roomSelect = document.getElementById('filterRoomSelect');
  const rooms = Array.from(new Set(RICOH_MACHINES.map(m => m.room))).sort();
  rooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    roomSelect.appendChild(opt);
  });
}

// --------------------------------------------------------------------------
// Machine Selection & Form Behavior
// --------------------------------------------------------------------------
function onMachineInput(inputVal) {
  const trimmed = (inputVal || '').trim();
  if (!trimmed) {
    onMachineChanged('');
    return;
  }

  // Find exact or case-insensitive match
  const matched = RICOH_MACHINES.find(m => m.serial.toLowerCase() === trimmed.toLowerCase());
  if (matched) {
    onMachineChanged(matched.serial);
  } else {
    // Custom serial typed
    onCustomSerialTyped(trimmed);
  }
}

function onMachineChanged(serial) {
  const machine = RICOH_MACHINES.find(m => m.serial.toLowerCase() === (serial || '').toLowerCase());
  const previewBox = document.getElementById('machinePreviewBox');
  const monoNotice = document.getElementById('monoNotice');

  if (!machine) {
    previewBox.style.display = 'none';
    resetCmykInputs();
    enableAllColorInputs();
    updateFormSubtotal();
    return;
  }

  // Show Preview
  previewBox.style.display = 'block';
  document.getElementById('previewRoom').textContent = machine.room;
  document.getElementById('previewModel').textContent = machine.model;
  document.getElementById('previewIp').textContent = machine.ip || '-';
  document.getElementById('previewToner').textContent = machine.tonerModel;

  const typeBadge = document.getElementById('previewTypeBadge');
  if (machine.isColor) {
    typeBadge.textContent = 'เครื่องพิมพ์สี (Color - CMYK)';
    typeBadge.style.background = 'rgba(6, 182, 212, 0.15)';
    typeBadge.style.color = '#06b6d4';
  } else {
    typeBadge.textContent = 'เครื่องพิมพ์ขาว-ดำ (Monochrome - K)';
    typeBadge.style.background = 'rgba(100, 116, 139, 0.2)';
    typeBadge.style.color = '#94a3b8';
  }

  const noteBadge = document.getElementById('previewNoteBadge');
  if (machine.note) {
    noteBadge.style.display = 'inline-block';
    noteBadge.textContent = machine.note;
  } else {
    noteBadge.style.display = 'none';
  }

  // Handle Monochrome vs Color Constraints
  if (!machine.isColor) {
    // Disable C, M, Y
    setColorDisabled('cyan', true);
    setColorDisabled('magenta', true);
    setColorDisabled('yellow', true);
    setColorDisabled('black', false);
    monoNotice.style.display = 'flex';
  } else {
    enableAllColorInputs();
    monoNotice.style.display = 'none';
  }

  updateFormSubtotal();
}

function onCustomSerialTyped(serial) {
  const previewBox = document.getElementById('machinePreviewBox');
  const monoNotice = document.getElementById('monoNotice');
  previewBox.style.display = 'block';

  document.getElementById('previewRoom').textContent = 'เครื่องนอกฐานข้อมูล / ระบุเอง';
  document.getElementById('previewModel').textContent = 'Ricoh Printer';
  document.getElementById('previewIp').textContent = '-';
  document.getElementById('previewToner').textContent = 'ระบุตามการใช้งาน';

  const typeBadge = document.getElementById('previewTypeBadge');
  typeBadge.textContent = 'กำหนดเอง (รองรับ CMYK)';
  typeBadge.style.background = 'rgba(245, 158, 11, 0.15)';
  typeBadge.style.color = '#f59e0b';

  const noteBadge = document.getElementById('previewNoteBadge');
  noteBadge.style.display = 'inline-block';
  noteBadge.textContent = 'Serial ใหม่';

  enableAllColorInputs();
  monoNotice.style.display = 'none';
  updateFormSubtotal();
}

function setColorDisabled(colorName, disabled) {
  const card = document.getElementById(`${colorName}InputCard`);
  const input = document.getElementById(`input${capitalize(colorName)}`);
  if (disabled) {
    card.classList.add('disabled');
    input.value = 0;
    input.disabled = true;
  } else {
    card.classList.remove('disabled');
    input.disabled = false;
  }
}

function enableAllColorInputs() {
  ['cyan', 'magenta', 'yellow', 'black'].forEach(c => setColorDisabled(c, false));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --------------------------------------------------------------------------
// CMYK Counter Helpers
// --------------------------------------------------------------------------
window.stepColor = function(colorName, delta) {
  const input = document.getElementById(`input${capitalize(colorName)}`);
  if (input.disabled) return;
  let val = parseInt(input.value, 10) || 0;
  val = Math.max(0, val + delta);
  input.value = val;
  updateFormSubtotal();
};

window.setColorVal = function(colorName, val, isClear = false) {
  const input = document.getElementById(`input${capitalize(colorName)}`);
  if (input.disabled) return;
  if (isClear) {
    input.value = 0;
  } else {
    let current = parseInt(input.value, 10) || 0;
    input.value = current + val;
  }
  updateFormSubtotal();
};

function updateFormSubtotal() {
  const c = parseInt(document.getElementById('inputCyan').value, 10) || 0;
  const m = parseInt(document.getElementById('inputMagenta').value, 10) || 0;
  const y = parseInt(document.getElementById('inputYellow').value, 10) || 0;
  const k = parseInt(document.getElementById('inputBlack').value, 10) || 0;
  const total = c + m + y + k;
  document.getElementById('formCurrentTotal').textContent = total;
}

function resetCmykInputs() {
  ['Cyan', 'Magenta', 'Yellow', 'Black'].forEach(c => {
    document.getElementById(`input${c}`).value = 0;
  });
  updateFormSubtotal();
}

// --------------------------------------------------------------------------
// Navigation & Tabs
// --------------------------------------------------------------------------
function setupEventListeners() {
  // Nav tabs
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');

      if (targetId === 'tab-analytics') {
        renderAnalytics();
      }
    });
  });

  // Machine Serial Input Handling (Type, Autocomplete, Barcode scanner)
  const machineInput = document.getElementById('machineInput');
  const clearSerialBtn = document.getElementById('btnClearSerial');

  if (machineInput) {
    machineInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (clearSerialBtn) clearSerialBtn.style.display = val ? 'flex' : 'none';
      onMachineInput(val);
    });

    machineInput.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      onMachineInput(val);
    });
  }

  if (clearSerialBtn && machineInput) {
    clearSerialBtn.addEventListener('click', () => {
      machineInput.value = '';
      clearSerialBtn.style.display = 'none';
      onMachineChanged('');
      machineInput.focus();
    });
  }

  // Input change on CMYK values
  ['Cyan', 'Magenta', 'Yellow', 'Black'].forEach(c => {
    document.getElementById(`input${c}`).addEventListener('input', updateFormSubtotal);
  });

  // Notes Checkbox 'อื่นๆ' Toggle
  const chkNoteOther = document.getElementById('chkNoteOther');
  const otherNoteWrapper = document.getElementById('otherNoteWrapper');
  const inputNoteOtherText = document.getElementById('inputNoteOtherText');

  chkNoteOther.addEventListener('change', () => {
    if (chkNoteOther.checked) {
      otherNoteWrapper.style.display = 'block';
      inputNoteOtherText.focus();
    } else {
      otherNoteWrapper.style.display = 'none';
      inputNoteOtherText.value = '';
    }
  });

  // Form Submit
  document.getElementById('returnForm').addEventListener('submit', handleFormSubmit);

  // Form Reset
  document.getElementById('btnResetForm').addEventListener('click', () => {
    document.getElementById('returnForm').reset();
    document.getElementById('machineInput').value = '';
    document.getElementById('btnClearSerial').style.display = 'none';
    otherNoteWrapper.style.display = 'none';
    inputNoteOtherText.value = '';
    setDefaultDate();
    onMachineChanged('');
  });

  // History Search & Filters
  document.getElementById('searchHistoryInput').addEventListener('input', (e) => {
    currentFilter.keyword = e.target.value.trim().toLowerCase();
    renderHistoryTable();
  });

  document.getElementById('filterRoomSelect').addEventListener('change', (e) => {
    currentFilter.room = e.target.value;
    renderHistoryTable();
  });

  document.getElementById('filterColorSelect').addEventListener('change', (e) => {
    currentFilter.color = e.target.value;
    renderHistoryTable();
  });

  // Export Buttons
  document.getElementById('btnExportExcel').addEventListener('click', exportToExcel);
  document.getElementById('btnExportCsv').addEventListener('click', exportToCsv);

  // Sample data button
  document.getElementById('btnSampleData').addEventListener('click', loadSampleData);

  // Clear data button
  document.getElementById('btnClearAllData').addEventListener('click', async () => {
    if (confirm('ต้องการล้างประวัติการคืนหมึกทั้งหมดใช่หรือไม่?\n\n(ระบบจะล้างข้อมูลทั้งบนหน้าเว็บและใน Google Sheet ให้ว่างเปล่า 0 รายการ)')) {
      returnRecords = [];
      saveData();
      updateUI();
      showToast('ล้างข้อมูลในระบบเรียบร้อยแล้ว');

      if (sheetsScriptUrl) {
        try {
          await fetch(sheetsScriptUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'clearAll' }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
          });
          showToast('ล้างข้อมูลใน Google Sheet เรียบร้อยแล้ว (0 รายการ)');
        } catch (err) {
          console.warn('Clear Google Sheets warning:', err);
        }
      }
    }
  });

  // Google Sheets Sync Events
  document.getElementById('btnOpenSyncModal').addEventListener('click', openSyncModal);

  document.getElementById('btnTestAndSaveSync').addEventListener('click', async () => {
    const url = document.getElementById('appsScriptUrlInput').value.trim();
    if (!url) {
      alert('กรุณากรอก Web App URL ของ Google Sheets');
      return;
    }
    sheetsScriptUrl = url;
    localStorage.setItem(SHEETS_URL_KEY, url);
    updateSyncStatusBadge();
    showToast('บันทึกการตั้งค่าแล้ว กำลังทดสอบเชื่อมต่อ...');
    await fetchFromGoogleSheets(false);
  });

  document.getElementById('btnManualPull').addEventListener('click', () => {
    fetchFromGoogleSheets(false);
  });

  document.getElementById('btnSyncFromSheets').addEventListener('click', () => {
    fetchFromGoogleSheets(false);
  });

  const btnMigrate = document.getElementById('btnMigrateHistory');
  if (btnMigrate) {
    btnMigrate.addEventListener('click', async () => {
      initDefaultSampleRecords();
      saveData();
      showToast('โหลดข้อมูลประวัติจริง 13 รายการเรียบร้อยแล้ว');
      if (sheetsScriptUrl) {
        try {
          await fetch(sheetsScriptUrl + '?action=migrate');
        } catch (e) {}
      }
    });
  }

  // Copy Apps Script Code to Clipboard Button
  const btnCopyScript = document.getElementById('btnCopyScriptCode');
  if (btnCopyScript) {
    btnCopyScript.addEventListener('click', async () => {
      try {
        const res = await fetch('google_apps_script.js');
        const code = await res.text();
        await navigator.clipboard.writeText(code);
        showToast('คัดลอกโค้ด Apps Script ลง Clipboard เรียบร้อยแล้ว!');
      } catch (err) {
        showToast('คัดลอกจากไฟล์ google_apps_script.js ในโฟลเดอร์ได้โดยตรงครับ');
      }
    });
  }
}

// --------------------------------------------------------------------------
// Google Sheets Database Integration
// --------------------------------------------------------------------------
const SHEETS_URL_KEY = 'ricoh_sheets_script_url';
const DEFAULT_SHEETS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwqVK0nKH8t9vhpPqSthpFwqHOSu_zeDcqMKRydJESxJ_0SIVlPuvPAQZhop2rU44re/exec';
let sheetsScriptUrl = localStorage.getItem(SHEETS_URL_KEY) || DEFAULT_SHEETS_SCRIPT_URL;

function initSheetsSync() {
  updateSyncStatusBadge();
  const input = document.getElementById('appsScriptUrlInput');
  if (input) input.value = sheetsScriptUrl;

  // หากเคยตั้งค่า URL ไว้แล้ว ให้ดึงข้อมูลล่าสุดจาก Google Sheets มาแสดงผลอัตโนมัติ
  if (sheetsScriptUrl) {
    fetchFromGoogleSheets(true);
  }
}

function updateSyncStatusBadge() {
  const btn = document.getElementById('btnOpenSyncModal');
  const text = document.getElementById('syncStatusBadgeText');
  if (!btn || !text) return;

  if (sheetsScriptUrl) {
    btn.classList.add('connected');
    text.textContent = 'Google Sheet เชื่อมต่อแล้ว';
  } else {
    btn.classList.remove('connected');
    text.textContent = 'เชื่อมต่อ Google Sheet';
  }
}

async function fetchFromGoogleSheets(silent = false) {
  if (!sheetsScriptUrl) {
    if (!silent) alert('กรุณาระบุ Web App URL ของ Google Sheets ก่อน');
    return;
  }

  if (!silent) showToast('กำลังดึงข้อมูลล่าสุดจาก Google Sheets...');

  try {
    const res = await fetch(sheetsScriptUrl);
    const result = await res.json();
    if (result && result.status === 'success' && Array.isArray(result.data)) {
      const cleanData = result.data.filter(r => r.serial && r.serial.toUpperCase() !== 'TEST-SERIAL');
      returnRecords = cleanData;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(returnRecords));
      updateUI();
      if (!silent) {
        showToast(`ดึงข้อมูลจาก Google Sheets สำเร็จ (${returnRecords.length} รายการ)`);
      }
    } else {
      if (!silent) alert('เกิดข้อผิดพลาดจาก Google Sheets: ' + (result.message || 'รูปแบบข้อมูลไม่ถูกต้อง'));
    }
  } catch (err) {
    console.error('Fetch Google Sheets error:', err);
    if (!silent) {
      alert('ไม่สามารถเชื่อมต่อกับ Google Sheets ได้ กรุณาตรวจสอบว่าเลือกสิทธิ์ Anyone (ทุกคน) หรือยัง');
    }
  }
}

async function sendToGoogleSheets(record) {
  if (!sheetsScriptUrl) return;

  try {
    const res = await fetch(sheetsScriptUrl, {
      method: 'POST',
      body: JSON.stringify(record),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      }
    });
    const result = await res.json();
    if (result && result.status === 'success') {
      showToast('บันทึกลงชีต Google Sheets (Database) สำเร็จ!');
    }
  } catch (err) {
    console.warn('POST to Google Sheets warning:', err);
  }
}

window.openSyncModal = function() {
  document.getElementById('syncModal').style.display = 'flex';
  const input = document.getElementById('appsScriptUrlInput');
  if (input) input.value = sheetsScriptUrl;
};

window.closeSyncModal = function() {
  document.getElementById('syncModal').style.display = 'none';
};

// --------------------------------------------------------------------------
// Form Submit Handler
// --------------------------------------------------------------------------
function getSelectedNotes() {
  const notes = [];
  if (document.getElementById('chkNoteEmpty').checked) {
    notes.push('ตลับเปล่า');
  }
  if (document.getElementById('chkNoteProblem').checked) {
    notes.push('หมึกมีปัญหา');
  }
  if (document.getElementById('chkNoteOther').checked) {
    const detail = (document.getElementById('inputNoteOtherText').value || '').trim();
    notes.push(detail ? `อื่นๆ: ${detail}` : 'อื่นๆ');
  }
  return notes.length > 0 ? notes.join(', ') : '-';
}

function handleFormSubmit(e) {
  e.preventDefault();

  const serial = document.getElementById('machineInput').value.trim();
  if (!serial) {
    alert('กรุณากรอกหมายเลข Serial เครื่องพิมพ์');
    return;
  }

  let machine = RICOH_MACHINES.find(m => m.serial.toLowerCase() === serial.toLowerCase());
  if (!machine) {
    machine = {
      serial: serial,
      room: 'แผนก/ห้องอื่น ๆ',
      model: 'Ricoh Printer',
      tonerModel: 'Ricoh Toner Series',
      isColor: true
    };
  }

  const c = parseInt(document.getElementById('inputCyan').value, 10) || 0;
  const m = parseInt(document.getElementById('inputMagenta').value, 10) || 0;
  const y = parseInt(document.getElementById('inputYellow').value, 10) || 0;
  const k = parseInt(document.getElementById('inputBlack').value, 10) || 0;
  const total = c + m + y + k;

  if (total === 0) {
    alert('กรุณาระบุจำนวนตลับหมึกที่ต้องการคืนอย่างน้อย 1 ตลับ (สีใดสีหนึ่ง)');
    return;
  }

  const selectedNotes = getSelectedNotes();

  const newRecord = {
    id: 'RT-' + Date.now().toString().slice(-6),
    timestamp: new Date().toISOString(),
    returnDate: document.getElementById('returnDate').value,
    serial: machine.serial,
    room: machine.room,
    model: machine.model,
    tonerModel: machine.tonerModel,
    isColor: machine.isColor,
    c: c,
    m: m,
    y: y,
    k: k,
    total: total,
    returner: document.getElementById('returnerName').value.trim(),
    receiver: document.getElementById('receiverName').value.trim() || '-',
    notes: selectedNotes
  };

  returnRecords.unshift(newRecord);
  saveData();

  // บันทึกลง Google Sheets Database ใน Cloud ทันที
  sendToGoogleSheets(newRecord);

  // Reset form
  document.getElementById('returnForm').reset();
  document.getElementById('machineInput').value = '';
  document.getElementById('btnClearSerial').style.display = 'none';
  document.getElementById('otherNoteWrapper').style.display = 'none';
  document.getElementById('inputNoteOtherText').value = '';
  setDefaultDate();
  onMachineChanged('');

  showToast(`บันทึกการส่งคืนหมึก Serial: ${newRecord.serial} รวม ${total} ตลับ สำเร็จ!`);

  // Optionally offer to print slip immediately
  if (confirm(`บันทึกรายการสำเร็จ!\nคุณต้องการดู/พิมพ์ใบส่งคืนหมึก (Return Slip) เลยหรือไม่?`)) {
    openPrintModal(newRecord.id);
  }
}

// --------------------------------------------------------------------------
// Data Storage & Management
// --------------------------------------------------------------------------
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      returnRecords = Array.isArray(parsed) 
        ? parsed.filter(r => r.serial && r.serial.toUpperCase() !== 'TEST-SERIAL')
        : [];
    } catch (err) {
      returnRecords = [];
    }
  } else {
    // ผู้ใช้เข้าใช้งานครั้งแรกสุดเท่านั้น
    returnRecords = [];
  }
  updateUI();
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(returnRecords));
  updateUI();
}

function initDefaultSampleRecords() {
  returnRecords = [
    {
      id: "RT-SH013",
      timestamp: "01/10/2569 11:29:38",
      returnDate: "01/10/2569",
      serial: "9173RB20165",
      room: "วิชาการ (มัธยม)",
      model: "IM C4510",
      tonerModel: "IM C6010 M",
      isColor: true,
      c: 0, m: 1, y: 0, k: 0,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "กรกฎ เย็นคงคา",
      notes: "คืนหมึกจาก Google Sheets"
    },
    {
      id: "RT-SH012",
      timestamp: "23/09/2569 13:17:56",
      returnDate: "23/09/2569",
      serial: "9173RB20165",
      room: "วิชาการ (มัธยม)",
      model: "IM C4510",
      tonerModel: "IM C6010 Y",
      isColor: true,
      c: 0, m: 0, y: 1, k: 0,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "พิชาวัจน์ เกิดเรืองสิน",
      notes: "คืนหมึกจาก Google Sheets"
    },
    {
      id: "RT-SH011",
      timestamp: "23/09/2569 13:17:35",
      returnDate: "23/09/2569",
      serial: "9173RB20195",
      room: "ห้องประชุมกลาง (ประถม)",
      model: "IM C4500",
      tonerModel: "IM C6010 C",
      isColor: true,
      c: 1, m: 0, y: 0, k: 0,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "กรกฎ เย็นคงคา",
      notes: "คืนหมึกจาก Google Sheets"
    },
    {
      id: "RT-SH010",
      timestamp: "17/09/2569 10:13:45",
      returnDate: "17/09/2569",
      serial: "9173RB20165",
      room: "วิชาการ (มัธยม)",
      model: "IM C4510",
      tonerModel: "IM C6010 B",
      isColor: true,
      c: 0, m: 0, y: 0, k: 1,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "กรกฎ เย็นคงคา",
      notes: "คืนหมึกจาก Google Sheets"
    },
    {
      id: "RT-SH009",
      timestamp: "08/09/2569 15:18:05",
      returnDate: "08/09/2569",
      serial: "9154R130684",
      room: "อำนวยการ (มัธยม)",
      model: "IM C3010",
      tonerModel: "IM C3510 Y",
      isColor: true,
      c: 0, m: 0, y: 1, k: 0,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "พิชาวัจน์ เกิดเรืองสิน",
      notes: "คืนหมึกจาก Google Sheets"
    },
    {
      id: "RT-SH008",
      timestamp: "08/09/2569 15:17:44",
      returnDate: "08/09/2569",
      serial: "9154R130684",
      room: "อำนวยการ (มัธยม)",
      model: "IM C3010",
      tonerModel: "IM C3510 B",
      isColor: true,
      c: 0, m: 0, y: 0, k: 1,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "พิชาวัจน์ เกิดเรืองสิน",
      notes: "คืนหมึกจาก Google Sheets"
    },
    {
      id: "RT-SH007",
      timestamp: "02/09/2569 13:06:11",
      returnDate: "02/09/2569",
      serial: "9154R130684",
      room: "อำนวยการ (มัธยม)",
      model: "IM C3010",
      tonerModel: "IM C3510 C",
      isColor: true,
      c: 1, m: 0, y: 0, k: 0,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "พิชาวัจน์ เกิดเรืองสิน",
      notes: "คืนหมึกจาก Google Sheets"
    },
    {
      id: "RT-SH006",
      timestamp: "02/09/2569 13:05:42",
      returnDate: "02/09/2569",
      serial: "9154R130684",
      room: "อำนวยการ (มัธยม)",
      model: "IM C3010",
      tonerModel: "IM C3510 M",
      isColor: true,
      c: 0, m: 1, y: 0, k: 0,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "พิชาวัจน์ เกิดเรืองสิน",
      notes: "คืนหมึกจาก Google Sheets"
    },
    {
      id: "RT-SH005",
      timestamp: "11/08/2569 10:44:07",
      returnDate: "11/08/2569",
      serial: "9173RB20195",
      room: "ห้องประชุมกลาง (ประถม)",
      model: "IM C4500",
      tonerModel: "IM C6010 Y",
      isColor: true,
      c: 0, m: 0, y: 1, k: 0,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "พิชาวัจน์ เกิดเรืองสิน",
      notes: "คืนหมึกจาก Google Sheets"
    },
    {
      id: "RT-SH004",
      timestamp: "16/07/2569 10:19:34",
      returnDate: "16/07/2569",
      serial: "9173RB20165",
      room: "วิชาการ (มัธยม)",
      model: "IM C4510",
      tonerModel: "IM C6010 B",
      isColor: true,
      c: 0, m: 0, y: 0, k: 1,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "พิชาวัจน์ เกิดเรืองสิน",
      notes: "คืนหมึกจาก Google Sheets"
    },
    {
      id: "RT-SH003",
      timestamp: "07/07/2569 10:18:38",
      returnDate: "07/07/2569",
      serial: "9173RB20195",
      room: "ห้องประชุมกลาง (ประถม)",
      model: "IM C4500",
      tonerModel: "IM C6010 B",
      isColor: true,
      c: 0, m: 0, y: 0, k: 1,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "กรกฎ เย็นคงคา",
      notes: "คืนหมึกจาก Google Sheets"
    },
    {
      id: "RT-SH002",
      timestamp: "01/07/2569 10:41:14",
      returnDate: "01/07/2569",
      serial: "9154R130684",
      room: "อำนวยการ (มัธยม)",
      model: "IM C3010",
      tonerModel: "IM C3510 B",
      isColor: true,
      c: 0, m: 0, y: 0, k: 1,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "กรกฎ เย็นคงคา",
      notes: "คืนหมึกจาก Google Sheets"
    },
    {
      id: "RT-SH001",
      timestamp: "20/05/2569 12:53:17",
      returnDate: "20/05/2569",
      serial: "9173RB20195",
      room: "ห้องประชุมกลาง (ประถม)",
      model: "IM C4500",
      tonerModel: "IM C6010 M",
      isColor: true,
      c: 0, m: 1, y: 0, k: 0,
      total: 1,
      returner: "ครู/เจ้าหน้าที่ประจำห้อง",
      receiver: "กรกฎ เย็นคงคา",
      notes: "คืนหมึกจาก Google Sheets"
    }
  ];
  saveData();
}

function loadSampleData() {
  initDefaultSampleRecords();
  showToast('โหลดข้อมูลตัวอย่างเรียบร้อยแล้ว');
}

// --------------------------------------------------------------------------
// UI Rendering
// --------------------------------------------------------------------------
function updateUI() {
  updateStats();
  renderHistoryTable();
  renderRecentActivity();
  renderAnalytics();
}

function updateStats() {
  let totalCartridges = 0;
  let cyanCount = 0;
  let magentaCount = 0;
  let yellowCount = 0;
  let blackCount = 0;

  returnRecords.forEach(r => {
    cyanCount += (r.c || 0);
    magentaCount += (r.m || 0);
    yellowCount += (r.y || 0);
    blackCount += (r.k || 0);
    totalCartridges += (r.total || 0);
  });

  document.getElementById('statTotalCartridges').innerHTML = `${totalCartridges} <span class="unit">ตลับ</span>`;
  document.getElementById('statCyanCount').innerHTML = `${cyanCount} <span class="unit">ตลับ</span>`;
  document.getElementById('statMagentaCount').innerHTML = `${magentaCount} <span class="unit">ตลับ</span>`;
  document.getElementById('statYellowCount').innerHTML = `${yellowCount} <span class="unit">ตลับ</span>`;
  document.getElementById('statBlackCount').innerHTML = `${blackCount} <span class="unit">ตลับ</span>`;
  document.getElementById('statTxCount').innerHTML = `${returnRecords.length} <span class="unit">รายการ</span>`;

  document.getElementById('historyCountBadge').textContent = returnRecords.length;
}

function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '';

  const filtered = returnRecords.filter(r => {
    // Keyword filter
    if (currentFilter.keyword) {
      const kw = currentFilter.keyword;
      const matchSerial = r.serial.toLowerCase().includes(kw);
      const matchRoom = r.room.toLowerCase().includes(kw);
      const matchModel = r.model.toLowerCase().includes(kw);
      const matchReturner = r.returner.toLowerCase().includes(kw);
      if (!matchSerial && !matchRoom && !matchModel && !matchReturner) return false;
    }
    // Room filter
    if (currentFilter.room && r.room !== currentFilter.room) {
      return false;
    }
    // Color filter
    if (currentFilter.color) {
      if (currentFilter.color === 'C' && (!r.c || r.c <= 0)) return false;
      if (currentFilter.color === 'M' && (!r.m || r.m <= 0)) return false;
      if (currentFilter.color === 'Y' && (!r.y || r.y <= 0)) return false;
      if (currentFilter.color === 'K' && (!r.k || r.k <= 0)) return false;
    }
    return true;
  });

  document.getElementById('tableRecordInfo').textContent = `แสดง ${filtered.length} จากทั้งหมด ${returnRecords.length} รายการ`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="text-center" style="padding: 2.5rem; color: var(--text-dim);">ไม่พบข้อมูลรายการคืนหมึกที่ตรงตามเงื่อนไข</td></tr>`;
    return;
  }

  filtered.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td class="font-mono">${r.returnDate}</td>
      <td><strong class="font-mono" style="color: #38bdf8;">${r.serial}</strong></td>
      <td>${r.room}</td>
      <td><span style="font-weight: 600;">${r.model}</span></td>
      <td class="text-center">${formatQtyBadge(r.c, 'c')}</td>
      <td class="text-center">${formatQtyBadge(r.m, 'm')}</td>
      <td class="text-center">${formatQtyBadge(r.y, 'y')}</td>
      <td class="text-center">${formatQtyBadge(r.k, 'k')}</td>
      <td class="text-center"><strong style="color: var(--ricoh-red); font-size: 1rem;">${r.total}</strong></td>
      <td>${r.returner}</td>
      <td style="color: var(--text-muted); font-size: 0.82rem;">${r.notes}</td>
      <td class="text-center">
        <div class="action-btn-group">
          <button class="btn-table-action" onclick="openPrintModal('${r.id}')" title="พิมพ์ใบส่งคืน">
            <i class="fa-solid fa-print"></i>
          </button>
          <button class="btn-table-action delete" onclick="deleteRecord('${r.id}')" title="ลบรายการ">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function formatQtyBadge(qty, type) {
  if (!qty || qty <= 0) {
    return `<span class="qty-zero">-</span>`;
  }
  let bg = '#64748b', col = '#ffffff';
  if (type === 'c') { bg = 'rgba(6, 182, 212, 0.2)'; col = '#06b6d4'; }
  if (type === 'm') { bg = 'rgba(236, 72, 153, 0.2)'; col = '#ec4899'; }
  if (type === 'y') { bg = 'rgba(245, 158, 11, 0.2)'; col = '#f59e0b'; }
  if (type === 'k') { bg = 'rgba(100, 116, 139, 0.25)'; col = '#cbd5e1'; }

  return `<span class="table-badge-qty" style="background: ${bg}; color: ${col};">${qty}</span>`;
}

function renderRecentActivity() {
  const container = document.getElementById('recentList');
  container.innerHTML = '';

  const recents = returnRecords.slice(0, 5);
  if (recents.length === 0) {
    container.innerHTML = `<div class="empty-state-mini">ยังไม่มีรายการบันทึก</div>`;
    return;
  }

  recents.forEach(r => {
    const item = document.createElement('div');
    item.className = 'recent-item';
    item.onclick = () => openPrintModal(r.id);

    let pills = [];
    if (r.c > 0) pills.push(`<span class="mini-color-pill mini-c">C: ${r.c}</span>`);
    if (r.m > 0) pills.push(`<span class="mini-color-pill mini-m">M: ${r.m}</span>`);
    if (r.y > 0) pills.push(`<span class="mini-color-pill mini-y">Y: ${r.y}</span>`);
    if (r.k > 0) pills.push(`<span class="mini-color-pill mini-k">K: ${r.k}</span>`);

    item.innerHTML = `
      <div class="recent-top">
        <span class="recent-serial">${r.serial}</span>
        <span class="recent-date">${r.returnDate}</span>
      </div>
      <div class="recent-room">${r.room} (${r.model})</div>
      <div class="recent-chips">${pills.join('')}</div>
    `;
    container.appendChild(item);
  });
}

// --------------------------------------------------------------------------
// Analytics Tab
// --------------------------------------------------------------------------
function renderAnalytics() {
  let cTotal = 0, mTotal = 0, yTotal = 0, kTotal = 0;
  const roomMap = {};

  returnRecords.forEach(r => {
    cTotal += (r.c || 0);
    mTotal += (r.m || 0);
    yTotal += (r.y || 0);
    kTotal += (r.k || 0);

    if (!roomMap[r.room]) {
      roomMap[r.room] = { txCount: 0, c: 0, m: 0, y: 0, k: 0, total: 0 };
    }
    roomMap[r.room].txCount += 1;
    roomMap[r.room].c += (r.c || 0);
    roomMap[r.room].m += (r.m || 0);
    roomMap[r.room].y += (r.y || 0);
    roomMap[r.room].k += (r.k || 0);
    roomMap[r.room].total += (r.total || 0);
  });

  const grandTotal = cTotal + mTotal + yTotal + kTotal || 1;

  // Render Bar Charts
  const barsContainer = document.getElementById('colorProgressBars');
  const cPct = ((cTotal / grandTotal) * 100).toFixed(1);
  const mPct = ((mTotal / grandTotal) * 100).toFixed(1);
  const yPct = ((yTotal / grandTotal) * 100).toFixed(1);
  const kPct = ((kTotal / grandTotal) * 100).toFixed(1);

  barsContainer.innerHTML = `
    <div class="bar-item">
      <div class="bar-meta">
        <span style="color: var(--cmyk-cyan);"><i class="fa-solid fa-square"></i> Cyan (สีฟ้า - C)</span>
        <span>${cTotal} ตลับ (${cPct}%)</span>
      </div>
      <div class="bar-track"><div class="bar-fill bar-c" style="width: ${cPct}%"></div></div>
    </div>

    <div class="bar-item">
      <div class="bar-meta">
        <span style="color: var(--cmyk-magenta);"><i class="fa-solid fa-square"></i> Magenta (สีชมพู/แดง - M)</span>
        <span>${mTotal} ตลับ (${mPct}%)</span>
      </div>
      <div class="bar-track"><div class="bar-fill bar-m" style="width: ${mPct}%"></div></div>
    </div>

    <div class="bar-item">
      <div class="bar-meta">
        <span style="color: var(--cmyk-yellow);"><i class="fa-solid fa-square"></i> Yellow (สีเหลือง - Y)</span>
        <span>${yTotal} ตลับ (${yPct}%)</span>
      </div>
      <div class="bar-track"><div class="bar-fill bar-y" style="width: ${yPct}%"></div></div>
    </div>

    <div class="bar-item">
      <div class="bar-meta">
        <span style="color: #cbd5e1;"><i class="fa-solid fa-square"></i> Black (สีดำ - K)</span>
        <span>${kTotal} ตลับ (${kPct}%)</span>
      </div>
      <div class="bar-track"><div class="bar-fill bar-k" style="width: ${kPct}%"></div></div>
    </div>
  `;

  // Render Room Summary Table
  const roomTbody = document.getElementById('roomSummaryTableBody');
  roomTbody.innerHTML = '';
  const roomKeys = Object.keys(roomMap);

  if (roomKeys.length === 0) {
    roomTbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 1.5rem; color: var(--text-dim);">ยังไม่มีข้อมูลสรุป</td></tr>`;
    return;
  }

  roomKeys.forEach(room => {
    const data = roomMap[room];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${room}</strong></td>
      <td class="text-center">${data.txCount}</td>
      <td class="text-center" style="color: var(--cmyk-cyan); font-weight: 700;">${data.c}</td>
      <td class="text-center" style="color: var(--cmyk-magenta); font-weight: 700;">${data.m}</td>
      <td class="text-center" style="color: var(--cmyk-yellow); font-weight: 700;">${data.y}</td>
      <td class="text-center" style="color: #cbd5e1; font-weight: 700;">${data.k}</td>
      <td class="text-center"><strong style="color: var(--ricoh-red);">${data.total}</strong></td>
    `;
    roomTbody.appendChild(tr);
  });
}

// --------------------------------------------------------------------------
// Delete & Slip Modal Actions
// --------------------------------------------------------------------------
window.deleteRecord = function(id) {
  if (confirm('คุณต้องการลบรายการคืนหมึกนี้ใช่หรือไม่?')) {
    returnRecords = returnRecords.filter(r => r.id !== id);
    saveData();
    showToast('ลบรายการเรียบร้อยแล้ว');
  }
};

window.openPrintModal = function(id) {
  const record = returnRecords.find(r => r.id === id);
  if (!record) return;

  document.getElementById('slipDocNo').textContent = record.id;
  document.getElementById('slipDate').textContent = record.returnDate;
  document.getElementById('slipSerial').textContent = record.serial;
  document.getElementById('slipRoom').textContent = record.room;
  document.getElementById('slipModel').textContent = record.model;
  document.getElementById('slipTonerModel').textContent = record.tonerModel;

  document.getElementById('slipC').textContent = `${record.c} ตลับ`;
  document.getElementById('slipM').textContent = `${record.m} ตลับ`;
  document.getElementById('slipY').textContent = `${record.y} ตลับ`;
  document.getElementById('slipK').textContent = `${record.k} ตลับ`;
  document.getElementById('slipTotal').textContent = `${record.total} ตลับ`;

  document.getElementById('slipNotes').textContent = record.notes || '-';
  document.getElementById('slipReturner').textContent = record.returner || '-';
  document.getElementById('slipReceiver').textContent = record.receiver || 'เจ้าหน้าที่ Ricoh';

  document.getElementById('printModal').style.display = 'flex';
};

window.closePrintModal = function() {
  document.getElementById('printModal').style.display = 'none';
};

// --------------------------------------------------------------------------
// Exports: Excel & CSV
// --------------------------------------------------------------------------
function exportToExcel() {
  if (returnRecords.length === 0) {
    alert('ไม่มีข้อมูลสำหรับส่งออก');
    return;
  }

  const exportData = returnRecords.map((r, i) => ({
    'ลำดับ': i + 1,
    'รหัสเอกสาร': r.id,
    'วันที่คืน': r.returnDate,
    'เลข Serial เครื่อง': r.serial,
    'ห้อง / แผนก': r.room,
    'รุ่นเครื่อง': r.model,
    'รุ่นหมึก': r.tonerModel,
    'Cyan (C)': r.c,
    'Magenta (M)': r.m,
    'Yellow (Y)': r.y,
    'Black (K)': r.k,
    'ยอดรวม (ตลับ)': r.total,
    'ผู้ส่งคืน': r.returner,
    'ผู้รับคืน': r.receiver,
    'หมายเหตุ': r.notes
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Return_Ricoh_CMYK');

  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Ricoh_Toner_Returns_${today}.xlsx`);
  showToast('ส่งออกไฟล์ Excel สำเร็จ!');
}

function exportToCsv() {
  if (returnRecords.length === 0) {
    alert('ไม่มีข้อมูลสำหรับส่งออก');
    return;
  }

  const headers = ['ลำดับ', 'รหัสเอกสาร', 'วันที่คืน', 'เลข Serial', 'ห้อง/แผนก', 'รุ่นเครื่อง', 'หมึกรุ่น', 'C', 'M', 'Y', 'K', 'รวมตลับ', 'ผู้ส่งคืน', 'ผู้รับคืน', 'หมายเหตุ'];
  const rows = returnRecords.map((r, i) => [
    i + 1,
    `"${r.id}"`,
    `"${r.returnDate}"`,
    `"${r.serial}"`,
    `"${r.room}"`,
    `"${r.model}"`,
    `"${r.tonerModel}"`,
    r.c,
    r.m,
    r.y,
    r.k,
    r.total,
    `"${r.returner}"`,
    `"${r.receiver}"`,
    `"${r.notes}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const today = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `Ricoh_Toner_Returns_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ส่งออกไฟล์ CSV สำเร็จ!');
}

// --------------------------------------------------------------------------
// Toast Feedback
// --------------------------------------------------------------------------
function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

// ==========================================================================
// Formal A4 Report System (รายงานสรุปส่งคืนหมึกทางการ A4 / PDF)
// ==========================================================================
let formalReportFilteredRecords = [];

function initFormalReportModule() {
  const btn1 = document.getElementById('btnOpenFormalReport');
  const btn2 = document.getElementById('btnOpenFormalReportFromAnalytics');
  if (btn1) btn1.addEventListener('click', openFormalReportModal);
  if (btn2) btn2.addEventListener('click', openFormalReportModal);

  const btnApply = document.getElementById('btnReportFilterApply');
  const btnReset = document.getElementById('btnReportFilterReset');
  if (btnApply) btnApply.addEventListener('click', applyFormalReportFilter);
  if (btnReset) btnReset.addEventListener('click', resetFormalReportFilter);

  // Live input sync for signatures
  const prepInput = document.getElementById('reportPreparerInput');
  const receiverInput = document.getElementById('reportReceiverInput');

  if (prepInput) {
    prepInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const el = document.getElementById('rptSigPreparedName');
      if (el) el.textContent = val || '...................................................';
    });
  }

  if (receiverInput) {
    receiverInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const el = document.getElementById('rptSigReceiverName');
      if (el) el.textContent = val || '...................................................';
    });
  }
}

function initFormalReportRooms() {
  const roomSelect = document.getElementById('reportRoomFilter');
  if (!roomSelect) return;

  const currentVal = roomSelect.value;
  roomSelect.innerHTML = '<option value="">ทุกห้อง / แผนก</option>';

  const roomSet = new Set(RICOH_MACHINES.map(m => m.room));
  returnRecords.forEach(r => {
    if (r.room) roomSet.add(r.room);
  });

  const sortedRooms = Array.from(roomSet).filter(Boolean).sort();
  sortedRooms.forEach(room => {
    const opt = document.createElement('option');
    opt.value = room;
    opt.textContent = room;
    if (room === currentVal) opt.selected = true;
    roomSelect.appendChild(opt);
  });
}

window.openFormalReportModal = function() {
  initFormalReportRooms();

  const dateFromEl = document.getElementById('reportDateFrom');
  const dateToEl = document.getElementById('reportDateTo');

  if (returnRecords.length > 0) {
    const dates = returnRecords
      .map(r => parseDateForComparison(r.returnDate))
      .filter(Boolean)
      .sort();

    if (!dateFromEl.value && dates.length > 0) {
      dateFromEl.value = dates[0];
    }
    if (!dateToEl.value && dates.length > 0) {
      dateToEl.value = dates[dates.length - 1];
    }
  } else {
    const today = new Date().toISOString().split('T')[0];
    if (!dateFromEl.value) dateFromEl.value = today;
    if (!dateToEl.value) dateToEl.value = today;
  }

  applyFormalReportFilter();
  document.getElementById('formalReportModal').style.display = 'flex';
};

window.closeFormalReportModal = function() {
  document.getElementById('formalReportModal').style.display = 'none';
};

function applyFormalReportFilter() {
  const dateFrom = document.getElementById('reportDateFrom')?.value || '';
  const dateTo = document.getElementById('reportDateTo')?.value || '';
  const selectedRoom = document.getElementById('reportRoomFilter')?.value || '';

  const parsedFrom = dateFrom ? parseDateForComparison(dateFrom) : null;
  const parsedTo = dateTo ? parseDateForComparison(dateTo) : null;

  formalReportFilteredRecords = returnRecords.filter(r => {
    const rDate = parseDateForComparison(r.returnDate);
    if (parsedFrom && rDate && rDate < parsedFrom) return false;
    if (parsedTo && rDate && rDate > parsedTo) return false;
    if (selectedRoom && r.room !== selectedRoom) return false;
    return true;
  });

  renderFormalReportPaper(formalReportFilteredRecords, { dateFrom, dateTo, room: selectedRoom });
}

function resetFormalReportFilter() {
  const dateFromEl = document.getElementById('reportDateFrom');
  const dateToEl = document.getElementById('reportDateTo');
  const roomEl = document.getElementById('reportRoomFilter');

  if (returnRecords.length > 0) {
    const dates = returnRecords
      .map(r => parseDateForComparison(r.returnDate))
      .filter(Boolean)
      .sort();
    if (dateFromEl) dateFromEl.value = dates[0] || '';
    if (dateToEl) dateToEl.value = dates[dates.length - 1] || '';
  } else {
    if (dateFromEl) dateFromEl.value = '';
    if (dateToEl) dateToEl.value = '';
  }
  if (roomEl) roomEl.value = '';

  applyFormalReportFilter();
}

function renderFormalReportPaper(records, filterCriteria = {}) {
  // 1. Doc No & Thai Dates
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dayStr = String(now.getDate()).padStart(2, '0');
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const yearThai = now.getFullYear() + 543;
  const issueDateFormatted = `${dayStr}/${monthStr}/${yearThai}`;

  const docNo = `RP-${yearMonth}-${String(records.length).padStart(3, '0')}`;
  const docNoEl = document.getElementById('rptDocNo');
  if (docNoEl) docNoEl.textContent = docNo;

  const issueDateEl = document.getElementById('rptIssueDate');
  if (issueDateEl) issueDateEl.textContent = issueDateFormatted;

  // Period string
  let periodStr = 'ทั้งหมด';
  if (filterCriteria.dateFrom && filterCriteria.dateTo) {
    if (filterCriteria.dateFrom === filterCriteria.dateTo) {
      periodStr = formatThaiDisplayDate(filterCriteria.dateFrom);
    } else {
      periodStr = `${formatThaiDisplayDate(filterCriteria.dateFrom)} ถึง ${formatThaiDisplayDate(filterCriteria.dateTo)}`;
    }
  } else if (filterCriteria.dateFrom) {
    periodStr = `ตั้งแต่ ${formatThaiDisplayDate(filterCriteria.dateFrom)}`;
  } else if (filterCriteria.dateTo) {
    periodStr = `ถึง ${formatThaiDisplayDate(filterCriteria.dateTo)}`;
  }

  if (filterCriteria.room) {
    periodStr += ` (เฉพาะห้อง: ${filterCriteria.room})`;
  }

  const rptPeriodEl = document.getElementById('rptPeriod');
  if (rptPeriodEl) rptPeriodEl.textContent = periodStr;

  const countEl = document.getElementById('reportFilteredCount');
  if (countEl) countEl.textContent = records.length;

  // 2. Aggregate CMYK Counts
  let totalC = 0, totalM = 0, totalY = 0, totalK = 0, totalCartridges = 0;
  records.forEach(r => {
    totalC += Number(r.c) || 0;
    totalM += Number(r.m) || 0;
    totalY += Number(r.y) || 0;
    totalK += Number(r.k) || 0;
    totalCartridges += Number(r.total) || 0;
  });

  const countCEl = document.getElementById('rptCountC');
  const countMEl = document.getElementById('rptCountM');
  const countYEl = document.getElementById('rptCountY');
  const countKEl = document.getElementById('rptCountK');
  const countTotEl = document.getElementById('rptCountTotal');

  if (countCEl) countCEl.textContent = totalC.toLocaleString();
  if (countMEl) countMEl.textContent = totalM.toLocaleString();
  if (countYEl) countYEl.textContent = totalY.toLocaleString();
  if (countKEl) countKEl.textContent = totalK.toLocaleString();
  if (countTotEl) countTotEl.textContent = totalCartridges.toLocaleString();

  // 3. Section 1: Location Summary Table (Group by Room)
  const roomMap = {};
  records.forEach(r => {
    const roomKey = r.room || 'ไม่ระบุห้อง';
    if (!roomMap[roomKey]) {
      roomMap[roomKey] = { c: 0, m: 0, y: 0, k: 0, total: 0 };
    }
    roomMap[roomKey].c += Number(r.c) || 0;
    roomMap[roomKey].m += Number(r.m) || 0;
    roomMap[roomKey].y += Number(r.y) || 0;
    roomMap[roomKey].k += Number(r.k) || 0;
    roomMap[roomKey].total += Number(r.total) || 0;
  });

  const sortedRoomKeys = Object.keys(roomMap).sort((a, b) => roomMap[b].total - roomMap[a].total);
  const roomTableBody = document.getElementById('rptRoomTableBody');
  if (roomTableBody) {
    if (sortedRoomKeys.length === 0) {
      roomTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #94a3b8; padding: 10px;">ไม่มีข้อมูลตามเงื่อนไขที่เลือก</td>
        </tr>
      `;
    } else {
      roomTableBody.innerHTML = sortedRoomKeys.map(rm => {
        const d = roomMap[rm];
        return `
          <tr>
            <td style="font-weight: 600;">${rm}</td>
            <td style="text-align: center; color: #0891b2;">${d.c || '-'}</td>
            <td style="text-align: center; color: #db2777;">${d.m || '-'}</td>
            <td style="text-align: center; color: #d97706;">${d.y || '-'}</td>
            <td style="text-align: center; color: #1e293b; font-weight: 600;">${d.k || '-'}</td>
            <td style="text-align: center; font-weight: 700; color: #e11d48; background: #fff1f2;">${d.total}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // 4. Section 2: Itemized Return Records Table
  const itemsCountEl = document.getElementById('rptItemsCount');
  if (itemsCountEl) itemsCountEl.textContent = records.length;

  const itemsTableBody = document.getElementById('rptItemsTableBody');
  if (itemsTableBody) {
    if (records.length === 0) {
      itemsTableBody.innerHTML = `
        <tr>
          <td colspan="12" style="text-align: center; color: #94a3b8; padding: 18px;">
            <i class="fa-solid fa-inbox" style="margin-right: 6px;"></i> ไม่มีรายการส่งคืนในช่วงเวลาหรือเงื่อนไขที่เลือก
          </td>
        </tr>
      `;
    } else {
      // Sort chronologically descending
      const sortedRecords = [...records].sort((a, b) => {
        const da = parseDateForComparison(a.returnDate) || '';
        const db = parseDateForComparison(b.returnDate) || '';
        return db.localeCompare(da);
      });

      itemsTableBody.innerHTML = sortedRecords.map((r, index) => {
        return `
          <tr>
            <td style="text-align: center; color: #64748b; font-size: 0.72rem;">${index + 1}</td>
            <td style="white-space: nowrap; font-size: 0.74rem;">${formatThaiShortDate(r.returnDate)}</td>
            <td style="font-family: monospace; font-size: 0.74rem; font-weight: 600; color: #0284c7;">${r.serial || '-'}</td>
            <td style="font-size: 0.74rem;">${r.room || '-'}</td>
            <td style="font-size: 0.72rem; color: #475569;">${r.tonerModel || r.model || '-'}</td>
            <td style="text-align: center; color: #0891b2;">${r.c > 0 ? r.c : '-'}</td>
            <td style="text-align: center; color: #db2777;">${r.m > 0 ? r.m : '-'}</td>
            <td style="text-align: center; color: #d97706;">${r.y > 0 ? r.y : '-'}</td>
            <td style="text-align: center; color: #1e293b; font-weight: 600;">${r.k > 0 ? r.k : '-'}</td>
            <td style="text-align: center; font-weight: 700; color: #e11d48; background: #fff1f2;">${r.total}</td>
            <td style="font-size: 0.74rem;">${r.returner || '-'}</td>
            <td style="font-size: 0.72rem; color: #64748b; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.notes || ''}">${r.notes || '-'}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Footer Totals
  const footCEl = document.getElementById('rptFootC');
  const footMEl = document.getElementById('rptFootM');
  const footYEl = document.getElementById('rptFootY');
  const footKEl = document.getElementById('rptFootK');
  const footTotEl = document.getElementById('rptFootTotal');

  if (footCEl) footCEl.textContent = totalC;
  if (footMEl) footMEl.textContent = totalM;
  if (footYEl) footYEl.textContent = totalY;
  if (footKEl) footKEl.textContent = totalK;
  if (footTotEl) footTotEl.textContent = totalCartridges;

  // Signatures (2 parties: ผู้จัดทำรายงาน & ตัวแทน Ricoh)
  const prepInput = document.getElementById('reportPreparerInput');
  const receiverInput = document.getElementById('reportReceiverInput');

  const sigPrepEl = document.getElementById('rptSigPreparedName');
  const sigRecvEl = document.getElementById('rptSigReceiverName');

  if (sigPrepEl) {
    if (prepInput && prepInput.value.trim()) {
      sigPrepEl.textContent = prepInput.value.trim();
    } else {
      // ปล่อยว่างเป็นจุดไข่ปลาไว้ให้เขียนด้วยลายมือ
      sigPrepEl.textContent = '...................................................';
    }
  }

  if (sigRecvEl) {
    if (receiverInput && receiverInput.value.trim()) {
      sigRecvEl.textContent = receiverInput.value.trim();
    } else {
      const defaultReceiver = records.find(r => r.receiver && r.receiver.trim() !== '-' && r.receiver.trim() !== '')?.receiver;
      sigRecvEl.textContent = defaultReceiver || '...................................................';
    }
  }
}

// --------------------------------------------------------------------------
// Date Utility Helpers
// --------------------------------------------------------------------------
function parseDateForComparison(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  const parts = s.split('/');
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year = parseInt(parts[2], 10);
    if (year > 2400) year -= 543;
    return `${year}-${month}-${day}`;
  }
  return s;
}

function formatThaiDisplayDate(str) {
  if (!str) return '-';
  const iso = parseDateForComparison(str);
  if (!iso || iso.length < 10) return str;
  const [y, m, d] = iso.split('-');
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const monthName = thaiMonths[parseInt(m, 10) - 1] || m;
  const thaiYear = parseInt(y, 10) + 543;
  return `${parseInt(d, 10)} ${monthName} ${thaiYear}`;
}

function formatThaiShortDate(str) {
  if (!str) return '-';
  const iso = parseDateForComparison(str);
  if (!iso || iso.length < 10) return str;
  const [y, m, d] = iso.split('-');
  const thaiYearShort = (parseInt(y, 10) + 543).toString().slice(-2);
  return `${d}/${m}/${thaiYearShort}`;
}
