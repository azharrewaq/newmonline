import * as XLSX from 'xlsx';
import { quranSurahs } from '../data/quranSurahs';
import { countriesList } from '../data/countries';
import egyptCenters from '../data/egyptCenters';
import { formatTime12Ar } from './placementHelpers';

// Avoid Vite/ESM bundling issues where XLSX properties might be nested under default
const xlsxLib = XLSX && XLSX.utils ? XLSX : (XLSX[String('default')] || XLSX);

const LOOKUP_SHEET_NAME = 'المسميات';
const VALIDATION_MAX_ROW = 6500;

const getDynamicSessionNumbers = () => {
  try {
    if (typeof window === 'undefined') return [];
    const items = JSON.parse(localStorage.getItem('platformSessions') || '[]');
    return Array.from(new Set(items.map(i => String(i?.session_no || '').trim()).filter(Boolean)));
  } catch {
    return [];
  }
};

/**
 * قواميس المسميات المعتمدة في المنصة لبناء شيت "المسميات" وربط القوائم المنسدلة
 */
const buildLookupCatalog = () => {
  const sessionNos = getDynamicSessionNumbers();

  const childrenLevels = [
    'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس',
    'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
    'مستوى الإتقان (تجويد) أطفال',
  ];
  const seniorsLevels = [
    'نظام السنة الواحدة',
    'نظام العامين',
    'نظام الثلاث سنوات',
    'نظام الاربع سنوات ( من سورة البقرة )',
    'نظام الاربع سنوات ( من سورة الناس )',
    'نظام الخمس سنوات ( من سورة البقرة )',
    'نظام الخمس سنوات ( من سورة الناس )',
  ];

  return [
    {
      title: 'النوع',
      matchHeaders: ['النوع', 'الجنس'],
      values: ['ذكر', 'أنثى'],
    },
    {
      title: 'المحافظات',
      matchHeaders: ['المحافظة'],
      values: Object.keys(egyptCenters),
    },
    {
      title: 'الرواق',
      matchHeaders: ['الرواق'],
      values: [
        'رواق القرآن الكريم ( أطفال )',
        'رواق القرآن الكريم كبار ( رجال )',
        'رواق القرآن الكريم كبار ( سيدات )',
      ],
    },
    {
      title: 'مستويات الأطفال',
      matchHeaders: [],
      values: childrenLevels,
    },
    {
      title: 'مستويات الكبار (رجال / نساء)',
      matchHeaders: [],
      values: seniorsLevels,
    },
    {
      title: 'جميع المستويات (أطفال وكبار)',
      matchHeaders: ['المستوى', 'المستوى المتقدم عليه', 'المستوى وفق الاختبار'],
      values: [...childrenLevels, ...seniorsLevels],
    },
    {
      title: 'سور القرآن الكريم',
      matchHeaders: ['السورة المتوقف عندها', 'السورة'],
      values: quranSurahs.map(s => s.name),
    },
    {
      title: 'الأيام المناسبة للدارس',
      matchHeaders: ['الأيام المناسبة', 'الايام المناسبة'],
      values: ['السبت - الثلاثاء', 'الأحد - الأربعاء', 'الاثنين - الخميس'],
    },
    {
      title: 'التوقيت المناسب للدارس',
      matchHeaders: ['التوقيت المناسب', 'الساعة المناسبة'],
      values: ['من 6 إلى 7 مساء', 'من 7 إلى 8 مساء', 'من 8 إلى 9 مساء', 'من 9 إلى 10 مساء'],
    },
    {
      title: 'مجموعات تحديد المستوى (1 - 40)',
      matchHeaders: ['رقم المجموعة', 'المجموعة'],
      values: Array.from({ length: 40 }, (_, i) => String(i + 1)),
    },
    {
      title: 'فترة المجموعة',
      matchHeaders: ['فترة المجموعة'],
      values: ['من 6 إلى 8 مساءً', 'من 8 إلى 10 مساءً'],
    },
    {
      title: 'توقيت الاختبار',
      matchHeaders: ['توقيت الاختبار'],
      values: [
        '18:00 - 18:30',
        '18:30 - 19:00',
        '19:00 - 19:30',
        '19:30 - 20:00',
        '18:00',
        '19:00',
        '20:00',
      ],
    },
    {
      title: 'أرقام الحلقات الأصلية',
      matchHeaders: ['الحلقة'],
      values: sessionNos.length > 0 ? sessionNos : ['1'],
    },
    {
      title: 'الدول',
      matchHeaders: ['الدولة', 'الدول'],
      values: countriesList,
    },
  ];
};

const colIndexToLetter = (colIdx) => {
  let n = colIdx + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
};

/**
 * إنشاء شيت "المسميات" وإرجاع خريطة النطاقات المرجعية لكل عنوان عمود
 */
const createLookupsWorksheet = () => {
  const catalog = buildLookupCatalog();
  const maxRows = Math.max(...catalog.map(c => c.values.length), 1);
  const aoa = [];

  // صف العناوين
  aoa.push(catalog.map(c => c.title));

  // صفوف القيم
  for (let r = 0; r < maxRows; r++) {
    aoa.push(catalog.map(c => (c.values[r] !== undefined ? c.values[r] : '')));
  }

  const ws = xlsxLib.utils.aoa_to_sheet(aoa);
  ws['!cols'] = catalog.map(c => ({ wch: Math.max(c.title.length + 6, 22) }));

  // خريطة: اسم العمود في الشيت الأساسي -> مرجع النطاق في شيت المسميات
  const headerFormulaMap = {};
  catalog.forEach((colDef, colIdx) => {
    const colLetter = colIndexToLetter(colIdx);
    const lastRow = Math.max(colDef.values.length + 1, 2);
    const formula = `'${LOOKUP_SHEET_NAME}'!$${colLetter}$2:$${colLetter}$${lastRow}`;
    colDef.matchHeaders.forEach(h => {
      headerFormulaMap[h.trim()] = formula;
    });
  });

  return { ws, headerFormulaMap };
};

// حساب CRC32 لتحديث أرشيف الـ ZIP الخاص بملف الـ XLSX بعد حقن القوائم المنسدلة
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes) => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
};

const readUInt16LE = (buf, off) => buf[off] | (buf[off + 1] << 8);
const readUInt32LE = (buf, off) => (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
const writeUInt16LE = (buf, val, off) => { buf[off] = val & 0xFF; buf[off + 1] = (val >>> 8) & 0xFF; };
const writeUInt32LE = (buf, val, off) => {
  buf[off] = val & 0xFF;
  buf[off + 1] = (val >>> 8) & 0xFF;
  buf[off + 2] = (val >>> 16) & 0xFF;
  buf[off + 3] = (val >>> 24) & 0xFF;
};

/**
 * حقن وسم <dataValidations> داخل ملفات أوراق العمل في أرشيف XLSX (ZIP غير مضغوط method=0)
 */
const injectDataValidationsIntoXlsx = (xlsxArrayBuffer, validationsBySheetIndex) => {
  const buf = new Uint8Array(xlsxArrayBuffer);
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();

  // فك مدخلات الـ ZIP المحلية (Local File Headers)
  const entries = [];
  let offset = 0;
  while (offset + 30 <= buf.length && readUInt32LE(buf, offset) === 0x04034b50) {
    const method = readUInt16LE(buf, offset + 8);
    const compSize = readUInt32LE(buf, offset + 18);
    const nameLen = readUInt16LE(buf, offset + 26);
    const extraLen = readUInt16LE(buf, offset + 28);
    const nameBytes = buf.slice(offset + 30, offset + 30 + nameLen);
    const name = decoder.decode(nameBytes);
    const headerBytes = buf.slice(offset, offset + 30 + nameLen + extraLen);
    const dataStart = offset + 30 + nameLen + extraLen;
    let dataBytes = buf.slice(dataStart, dataStart + compSize);

    // إذا كان هذا الملف هو xl/worksheets/sheet{N}.xml ومخزن بدون ضغط (method === 0)
    const match = name.match(/^xl\/worksheets\/sheet(\d+)\.xml$/);
    if (match && method === 0) {
      const sheetIdx = parseInt(match[1], 10);
      const rules = validationsBySheetIndex[sheetIdx];
      if (rules && rules.length > 0) {
        let xml = decoder.decode(dataBytes);
        const dvItems = rules.map(r =>
          `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0" sqref="${r.sqref}"><formula1>${r.formula}</formula1></dataValidation>`
        ).join('');
        const dvBlock = `<dataValidations count="${rules.length}">${dvItems}</dataValidations>`;
        if (xml.includes('<ignoredErrors')) {
          xml = xml.replace('<ignoredErrors', `${dvBlock}<ignoredErrors`);
        } else {
          xml = xml.replace('</worksheet>', `${dvBlock}</worksheet>`);
        }
        dataBytes = encoder.encode(xml);
      }
    }

    const newCrc = crc32(dataBytes);
    const newHeader = new Uint8Array(headerBytes);
    writeUInt32LE(newHeader, newCrc, 14);
    writeUInt32LE(newHeader, dataBytes.length, 18);
    writeUInt32LE(newHeader, dataBytes.length, 22);

    entries.push({
      name,
      header: newHeader,
      data: dataBytes,
      crc: newCrc,
      size: dataBytes.length,
      nameLen,
      extraLen,
      flags: readUInt16LE(buf, offset + 6),
      method,
      time: readUInt16LE(buf, offset + 10),
      date: readUInt16LE(buf, offset + 12),
    });

    offset = dataStart + compSize;
  }

  // إعادة بناء الملف مع Central Directory محدث
  let localTotal = 0;
  entries.forEach(e => {
    e.localOffset = localTotal;
    localTotal += e.header.length + e.data.length;
  });

  const cdChunks = entries.map(e => {
    const nameBytes = encoder.encode(e.name);
    const cd = new Uint8Array(46 + nameBytes.length);
    writeUInt32LE(cd, 0x02014b50, 0);
    writeUInt16LE(cd, 20, 4);
    writeUInt16LE(cd, 20, 6);
    writeUInt16LE(cd, e.flags, 8);
    writeUInt16LE(cd, e.method, 10);
    writeUInt16LE(cd, e.time, 12);
    writeUInt16LE(cd, e.date, 14);
    writeUInt32LE(cd, e.crc, 16);
    writeUInt32LE(cd, e.size, 20);
    writeUInt32LE(cd, e.size, 24);
    writeUInt16LE(cd, nameBytes.length, 28);
    writeUInt16LE(cd, 0, 30);
    writeUInt16LE(cd, 0, 32);
    writeUInt16LE(cd, 0, 34);
    writeUInt16LE(cd, 0, 36);
    writeUInt32LE(cd, 0, 38);
    writeUInt32LE(cd, e.localOffset, 42);
    cd.set(nameBytes, 46);
    return cd;
  });

  const cdSize = cdChunks.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  writeUInt32LE(eocd, 0x06054b50, 0);
  writeUInt16LE(eocd, 0, 4);
  writeUInt16LE(eocd, 0, 6);
  writeUInt16LE(eocd, entries.length, 8);
  writeUInt16LE(eocd, entries.length, 10);
  writeUInt32LE(eocd, cdSize, 12);
  writeUInt32LE(eocd, localTotal, 16);
  writeUInt16LE(eocd, 0, 20);

  const out = new Uint8Array(localTotal + cdSize + 22);
  let pos = 0;
  entries.forEach(e => {
    out.set(e.header, pos); pos += e.header.length;
    out.set(e.data, pos); pos += e.data.length;
  });
  cdChunks.forEach(c => {
    out.set(c, pos); pos += c.length;
  });
  out.set(eocd, pos);
  return out;
};

/**
 * استخراج قواعد القوائم المنسدلة لشيت معين بناءً على عناوين أعمدته
 */
const buildValidationRulesForHeaders = (headers, headerFormulaMap, startRow = 2, dataLen = 100) => {
  if (!Array.isArray(headers) || headers.length === 0) return [];
  const maxRow = Math.max(dataLen + 500, VALIDATION_MAX_ROW);
  const rules = [];

  headers.forEach((h, idx) => {
    const formula = headerFormulaMap[String(h || '').trim()];
    if (formula) {
      const colLetter = colIndexToLetter(idx);
      rules.push({
        sqref: `${colLetter}${startRow}:${colLetter}${maxRow}`,
        formula,
      });
    }
  });
  return rules;
};

const buildValidationRulesForData = (data, headerFormulaMap) => {
  if (!Array.isArray(data) || data.length === 0) return [];
  const headers = Object.keys(data[0] || {});
  return buildValidationRulesForHeaders(headers, headerFormulaMap, 2, data.length);
};

const downloadXlsxBytes = (bytes, fileName) => {
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/**
 * تصدير شيت واحد + شيت "المسميات" تلقائياً مع ربط الأعمدة بقوائم منسدلة
 */
export function exportToXLSX(data, fileName = 'export', sheetName = 'Sheet1') {
  if (!data || data.length === 0) {
    alert('لا توجد بيانات للتصدير');
    return;
  }
  try {
    const workbook = xlsxLib.utils.book_new();
    const worksheet = xlsxLib.utils.json_to_sheet(data);
    const headers = Object.keys(data[0] || {});
    worksheet['!cols'] = headers.map(h => ({ wch: Math.max(String(h).length + 8, 18) }));

    const { ws: lookupWs, headerFormulaMap } = createLookupsWorksheet();
    const safeMainName = sheetName === LOOKUP_SHEET_NAME ? 'البيانات' : sheetName;

    xlsxLib.utils.book_append_sheet(workbook, worksheet, safeMainName);
    xlsxLib.utils.book_append_sheet(workbook, lookupWs, LOOKUP_SHEET_NAME);

    const rules = buildValidationRulesForData(data, headerFormulaMap);
    const rawBuffer = xlsxLib.write(workbook, { type: 'array', bookType: 'xlsx' });
    const finalBytes = injectDataValidationsIntoXlsx(rawBuffer, { 1: rules });
    downloadXlsxBytes(finalBytes, fileName);
  } catch (error) {
    console.error('XLSX Export Error:', error);
    alert('حدث خطأ أثناء تصدير الملف. يرجى المحاولة مرة أخرى.');
  }
}

/**
 * تصدير عدة شيتات + شيت "المسميات" تلقائياً مع ربط الأعمدة بقوائم منسدلة
 */
export function exportMultiSheetToXLSX(sheets, fileName = 'export') {
  if (!sheets || sheets.length === 0) {
    alert('لا توجد بيانات للتصدير');
    return;
  }
  try {
    const workbook = xlsxLib.utils.book_new();
    const { ws: lookupWs, headerFormulaMap } = createLookupsWorksheet();
    const validationsBySheetIndex = {};

    sheets.forEach((sheet, idx) => {
      const worksheet = xlsxLib.utils.json_to_sheet(sheet.data);
      const headers = Object.keys((sheet.data && sheet.data[0]) || {});
      if (headers.length > 0) {
        worksheet['!cols'] = headers.map(h => ({ wch: Math.max(String(h).length + 8, 18) }));
      }
      xlsxLib.utils.book_append_sheet(workbook, worksheet, sheet.sheetName);
      const rules = buildValidationRulesForData(sheet.data, headerFormulaMap);
      if (rules.length > 0) {
        validationsBySheetIndex[idx + 1] = rules;
      }
    });

    if (!sheets.some(s => s.sheetName === LOOKUP_SHEET_NAME)) {
      xlsxLib.utils.book_append_sheet(workbook, lookupWs, LOOKUP_SHEET_NAME);
    }

    const rawBuffer = xlsxLib.write(workbook, { type: 'array', bookType: 'xlsx' });
    const finalBytes = injectDataValidationsIntoXlsx(rawBuffer, validationsBySheetIndex);
    downloadXlsxBytes(finalBytes, fileName);
  } catch (error) {
    console.error('XLSX Export Error:', error);
    alert('حدث خطأ أثناء تصدير الملف. يرجى المحاولة مرة أخرى.');
  }
}

/**
 * تصدير كشوف اختبار تحديد المستوى إلى ملف Excel بنفس الديباجة والأعمدة الرسمية للطباعة
 * مع ربط الأعمدة بالقوائم المنسدلة من شيت "المسميات"
 */
export function exportExamSheetsToXLSX(
  sheets,
  fileName = 'كشف_تحديد_مستوى_المنصة_المحلية_بالجامع_الأزهر_نوفمبر_2026'
) {
  if (!sheets || sheets.length === 0) {
    alert('لا توجد كشوف للتصدير');
    return;
  }
  try {
    const workbook = xlsxLib.utils.book_new();
    const { ws: lookupWs, headerFormulaMap } = createLookupsWorksheet();
    const validationsBySheetIndex = {};
    const usedSheetNames = new Set([LOOKUP_SHEET_NAME]);

    const tableHeaders = [
      'م',
      'الاسم',
      'الرقم القومى',
      'درجة السؤال الأول',
      'درجة السؤال الثانى',
      'درجة السؤال الثالث',
      'درجة السؤال الرابع',
      'درجة السؤال الخامس',
      'المجموع',
      'الرواق',
      'المستوى وفق الاختبار',
      'السورة المتوقف عندها',
      'الأيام المناسبة',
      'الساعة المناسبة',
    ];

    sheets.forEach((sheet, idx) => {
      const totalRows = Math.max(sheet.rows?.length || 0, sheet.padCount || 25);
      const groupDisplay =
        sheet.groupNo && sheet.groupNo !== 'غير مسكن'
          ? `مجموعة (${sheet.groupNo})${sheet.shiftLabel ? ` - ${sheet.shiftLabel}` : ''}`
          : 'غير محدد';

      const aoa = [
        ['الجامع الأزهر - إدارة شئون الأروقة - كشف تحديد مستوى المنصة المحلية بالجامع الأزهر نوفمبر 2026'],
        [
          `المجموعة: ${groupDisplay}`,
          '',
          `المشرف العلمي: ${sheet.scientificSupervisor || '............'}`,
          '',
          `المشرف التقني: ${sheet.technicalSupervisor || '............'}`,
          '',
          `المنسق: ${sheet.coordinator || '............'}`,
          '',
          `المحفظ الممتحن: ${sheet.mohfez || '............'}`,
          '',
          '',
          `التاريخ: ${sheet.examDate || '   / 11 / 2026'}`,
          '',
          `عدد الدارسين: ${sheet.rows?.length || totalRows}`,
        ],
        tableHeaders,
      ];

      for (let i = 0; i < totalRows; i++) {
        const a = sheet.rows?.[i] || {};
        const excelRow = i + 4; // الصف الأول للبيانات هو الصف رقم 4 في الإكسيل
        const qVals = [a.q1, a.q2, a.q3, a.q4, a.q5]
          .map(v => (v === '' || v === null || v === undefined ? NaN : Number(v)))
          .filter(v => !isNaN(v));
        const totalCell = qVals.length > 0
          ? { t: 'n', v: qVals.reduce((s, v) => s + v, 0), f: `IF(COUNT(D${excelRow}:H${excelRow})=0,"",SUM(D${excelRow}:H${excelRow}))` }
          : { t: 's', v: '', f: `IF(COUNT(D${excelRow}:H${excelRow})=0,"",SUM(D${excelRow}:H${excelRow}))` };
        aoa.push([
          i + 1,
          a.name || '',
          a.national_id || a.passport_no || '',
          a.q1 ?? '',
          a.q2 ?? '',
          a.q3 ?? '',
          a.q4 ?? '',
          a.q5 ?? '',
          totalCell,
          a.rowaq || '',
          a.tested_level || '',
          a.stopped_surah || '',
          a.preferred_days || '',
          a.exam_time ? formatTime12Ar(a.exam_time) : (a.preferred_time || ''),
        ]);
      }

      aoa.push([]);
      aoa.push([
        'توقيع المحفظ الممتحن: ........................',
        '',
        '',
        '',
        'توقيع المنسق: ........................',
        '',
        '',
        '',
        '',
        'يعتمد، إدارة شئون الأروقة: ........................',
      ]);

      const ws = xlsxLib.utils.aoa_to_sheet(aoa);
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
        { s: { r: 1, c: 3 }, e: { r: 1, c: 5 } },
        { s: { r: 1, c: 6 }, e: { r: 1, c: 8 } },
        { s: { r: 1, c: 9 }, e: { r: 1, c: 11 } },
        { s: { r: 1, c: 12 }, e: { r: 1, c: 14 } },
      ];
      ws['!cols'] = [
        { wch: 6 },
        { wch: 28 },
        { wch: 20 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 12 },
        { wch: 28 },
        { wch: 26 },
        { wch: 26 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
      ];

      let baseName =
        sheet.groupNo && sheet.groupNo !== 'غير مسكن'
          ? `مجموعة ${sheet.groupNo}`
          : `كشف ${idx + 1}`;
      if (sheet.examDate && /^\d{4}-\d{2}-\d{2}$/.test(sheet.examDate)) {
        baseName = `${baseName} - ${sheet.examDate}`.slice(0, 28);
      } else if (sheet.coordinator) {
        baseName = `${baseName} - ${sheet.coordinator}`.slice(0, 28);
      }
      baseName = baseName.replace(/[\\/?*[\]:]/g, ' ').trim() || `كشف ${idx + 1}`;
      let finalSheetName = baseName;
      let counter = 2;
      while (usedSheetNames.has(finalSheetName)) {
        finalSheetName = `${baseName.slice(0, 25)} (${counter++})`;
      }
      usedSheetNames.add(finalSheetName);

      xlsxLib.utils.book_append_sheet(workbook, ws, finalSheetName);
      const rules = buildValidationRulesForHeaders(tableHeaders, headerFormulaMap, 4, totalRows + 4);
      if (rules.length > 0) {
        validationsBySheetIndex[idx + 1] = rules;
      }
    });

    xlsxLib.utils.book_append_sheet(workbook, lookupWs, LOOKUP_SHEET_NAME);

    const rawBuffer = xlsxLib.write(workbook, { type: 'array', bookType: 'xlsx' });
    const finalBytes = injectDataValidationsIntoXlsx(rawBuffer, validationsBySheetIndex);
    downloadXlsxBytes(finalBytes, fileName);
  } catch (error) {
    console.error('Exam Sheets XLSX Export Error:', error);
    alert('حدث خطأ أثناء تصدير ملف الإكسيل.');
  }
}

/**
 * Import data from an xlsx file, returns a Promise resolving to array of objects
 */
export function importFromXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = xlsxLib.read(data, { type: 'array' });
        const targetSheets = workbook.SheetNames.filter(n => n !== LOOKUP_SHEET_NAME);
        const sheetsToRead = targetSheets.length > 0 ? targetSheets : workbook.SheetNames;
        let allRows = [];

        sheetsToRead.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) return;
          const aoa = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          if (!aoa || aoa.length === 0) return;

          // البحث عن صف العناوين في حال وجود ديباجة بأعلى الشيت (مثل كشف الاختبار)
          let headerRowIdx = 0;
          for (let r = 0; r < Math.min(aoa.length, 10); r++) {
            const rowStrs = (aoa[r] || []).map(c => String(c || '').trim());
            if (
              rowStrs.includes('الاسم') ||
              rowStrs.includes('اسم المحفظ') ||
              rowStrs.includes('رقم الحلقة') ||
              rowStrs.includes('الرقم القومي') ||
              rowStrs.includes('الرقم القومى')
            ) {
              headerRowIdx = r;
              break;
            }
          }

          const json = xlsxLib.utils.sheet_to_json(worksheet, { range: headerRowIdx });
          allRows = allRows.concat(json);
        });

        resolve(allRows);
      } catch (err) {
        console.error('XLSX Import Error:', err);
        reject(err);
      }
    };
    reader.onerror = (err) => {
      console.error('File Reading Error:', err);
      reject(err);
    };
    reader.readAsArrayBuffer(file);
  });
}
