const Papa = require('papaparse');
const XLSX = require('xlsx');
const iconv = require('iconv-lite');

const REQUIRED_KEYS = ['lead_capture_at', 'name', 'platform', 'phone_normalized', 'city'];

const stripPhone = (raw, defaultCountry = '+91') => {
  if (!raw) return '';
  let cleaned = String(raw).trim();
  cleaned = cleaned.replace(/^p:/i, '');
  cleaned = cleaned.replace(/[\s-]/g, '');
  if (!cleaned.startsWith('+') && cleaned) {
    cleaned = `${defaultCountry}${cleaned.replace(/^0+/, '')}`;
  }
  return cleaned;
};

const decodeBuffer = (buffer) => {
  // UTF-16 BOM detection
  if (buffer.length >= 2) {
    const bom = buffer.slice(0, 2).toString('hex');
    if (bom === 'fffe' || bom === 'feff') {
      return iconv.decode(buffer, 'utf16le');
    }
  }
  return buffer.toString('utf8');
};

const detectDelimiter = (text) => {
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
  const commaCount = (sample.match(/,/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
};

const normalizeRow = (row, columnMap, defaultCountry) => {
  const lead_capture_at = row[columnMap.created_time];
  const name = row[columnMap.full_name];
  const platform = row[columnMap.platform];
  const phoneRaw = row[columnMap.phone];
  const city = row[columnMap.city];

  const phone_normalized = stripPhone(phoneRaw, defaultCountry);

  const mapped = { lead_capture_at, name, platform, phone: phoneRaw, phone_normalized, city };
  return mapped;
};

const parseCsvContent = (text, delimiter) => {
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter });
  return data;
};

const parseXlsx = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
};

const autodetectColumns = (headers) => {
  const lower = headers.map((h) => String(h || '').toLowerCase());
  const find = (keys) => {
    const idx = lower.findIndex((h) => keys.includes(h));
    return idx >= 0 ? headers[idx] : '';
  };
  return {
    created_time: find(['created_time', 'date', 'created']),
    full_name: find(['full_name', 'name']),
    platform: find(['platform', 'source']),
    phone: find(['phone', 'mobile', 'contact']),
    city: find(['city', 'location']),
  };
};

const validateRequired = (row) => {
  const missing = REQUIRED_KEYS.filter((key) => !row[key]);
  return missing;
};

const parseLeadFile = ({ buffer, mimetype, originalname, dedupeMode = 'skip', defaultCountry = '+91', columnMap }) => {
  const extension = (originalname || '').toLowerCase();
  let rows;
  if (extension.endsWith('.xlsx') || extension.endsWith('.xls')) {
    rows = parseXlsx(buffer);
  } else {
    const text = decodeBuffer(buffer);
    const delimiter = detectDelimiter(text);
    rows = parseCsvContent(text, delimiter);
  }

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const autoMap = columnMap || autodetectColumns(headers);

  const parsed = [];
  const errors = [];

  rows.forEach((row, idx) => {
    const normalized = normalizeRow(row, autoMap, defaultCountry);
    const missing = validateRequired(normalized);
    if (missing.length > 0) {
      errors.push({ row: idx + 2, message: `Missing required: ${missing.join(', ')}` });
      return;
    }
    parsed.push({
      ...normalized,
      platform: normalized.platform || 'unknown',
      city: normalized.city || '',
      custom_fields: row,
      dedupeMode,
    });
  });

  return { rows: parsed, mapping: autoMap, errors };
};

module.exports = {
  parseLeadFile,
  stripPhone,
};
