
import React, { useState, useEffect, useRef } from 'react';
import { Upload, CheckCircle, FileSpreadsheet, XCircle, AlertTriangle, X, UserPlus, AlertOctagon, ArrowRight, Save, Play, Download, Eye } from 'lucide-react';
import { storageService } from '../services/storageService';
import { DailyEntry, WeeklyWallet, Driver, AssetMaster } from '../types';

declare const XLSX: any;

// Configuration for Strict Daily Import
const REQUIRED_DAILY_COLUMNS = [
  { field: 'date', label: 'Date', keys: ['Date', 'Trip Date', 'Run Date'], required: true },
  { field: 'day', label: 'Day', keys: ['Day', 'Day Name'], required: false },
  { field: 'vehicle', label: 'Vehicle', keys: ['Vehicle', 'Vehicle No', 'Vehicle Number'], required: false },
  { field: 'driver', label: 'Driver', keys: ['Driver', 'Driver Name'], required: true },
  { field: 'shift', label: 'Shift', keys: ['Shift', 'Shift Type'], required: true },
  { field: 'qrCode', label: 'QR CODE', keys: ['QR CODE', 'QRCode', 'QR'], required: true },
  { field: 'rent', label: 'Rent', keys: ['Rent', 'Rental'], required: true },
  { field: 'collection', label: 'Collection', keys: ['Collection', 'Amount Collected', 'Collected'], required: false },
  { field: 'fuel', label: 'Fuel', keys: ['Fuel', 'Fuel Expense', 'Fuel Cost', 'Encho Fuel'], required: false },
  { field: 'due', label: 'Due', keys: ['Due', 'Balance', 'Pending', 'Due Amount'], required: false },
  { field: 'payout', label: 'Payout', keys: ['Payout', 'Pay Out', 'Paid', 'Payout Amount', 'Pay to Driver'], required: false }
];

type ImportStatus = 'idle' | 'processing' | 'paused' | 'complete';

interface ConflictState {
  type: 'DRIVER_MISSING' | 'DUPLICATE_ENTRY' | 'BLANK_FIELDS';
  row: any;
  rowIndex: number;
  payload?: any; 
}

interface SkippedRow {
  rowNumber: number;
  date: string;
  driver: string;
  qrCode: string;
  vehicle: string;
  shift: string;
  rent: string;
  collection: string;
  fuel: string;
  due: string;
  payout: string;
  rejectReason: string;
}

interface ImportState {
  queue: any[];
  currentIndex: number;
  validEntries: DailyEntry[];
  skippedRows: SkippedRow[];
  overriddenIds: string[]; 
  status: ImportStatus;
}

const ImportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
  const [file, setFile] = useState<File | null>(null);
   const [isXLSXReady, setIsXLSXReady] = useState<boolean>(typeof XLSX !== 'undefined');
  // System Data State
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [existingEntries, setExistingEntries] = useState<DailyEntry[]>([]);
  const [assets, setAssets] = useState<AssetMaster>({ vehicles: [], qrCodes: [] });

  // System Data Refs
  const driversRef = useRef<Driver[]>([]);
  const existingEntriesRef = useRef<DailyEntry[]>([]);
  const assetsRef = useRef<AssetMaster>({ vehicles: [], qrCodes: [] });

  // State Machine
  const [importState, setImportState] = useState<ImportState>({
    queue: [],
    currentIndex: 0,
    validEntries: [],
    skippedRows: [],
    overriddenIds: [],
    status: 'idle'
  });

  const [currentConflict, setCurrentConflict] = useState<ConflictState | null>(null);
  const [showSkippedModal, setShowSkippedModal] = useState(false);
  
  // Quick Driver Add Form State
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverMobile, setNewDriverMobile] = useState('');

  useEffect(() => {
    refreshSystemData();
  }, []);

 useEffect(() => {
    if (typeof XLSX !== 'undefined') {
      setIsXLSXReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.async = true;
    script.onload = () => setIsXLSXReady(true);
    script.onerror = () => console.error('Failed to load XLSX library');
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (currentConflict?.type === 'DRIVER_MISSING') {
        setNewDriverName(currentConflict.payload.driverName || '');
        setNewDriverMobile('');
    }
  }, [currentConflict]);

  useEffect(() => { driversRef.current = drivers; }, [drivers]);
  useEffect(() => { existingEntriesRef.current = existingEntries; }, [existingEntries]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);

  const refreshSystemData = async () => {
    const [d, e, a] = await Promise.all([
      storageService.getDrivers(),
      storageService.getDailyEntries(),
      storageService.getAssets()
    ]);
    setDrivers(d);
    setExistingEntries(e);
    setAssets(a);
    driversRef.current = d;
    existingEntriesRef.current = e;
    assetsRef.current = a;
  };

  // --- PARSING HELPERS ---

  // Clean cell value
  const cleanCell = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).trim();
  };

  const parseExcelDate = (val: any): string => {
    if (!val) return '';
    
    const buildISODate = (year: number, month: number, day: number) => {
      const fullYear = year < 100 ? 2000 + year : year;
      if (fullYear < 2000 || fullYear > 2100) return '';
      const d = new Date(fullYear, month - 1, day);
      if (d.getFullYear() !== fullYear || d.getMonth() !== month - 1 || d.getDate() !== day) return '';
      const mm = month.toString().padStart(2, '0');
      const dd = day.toString().padStart(2, '0');
      return `${fullYear}-${mm}-${dd}`;
    };

    try {
       // Excel serial number
      if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return buildISODate(date.getFullYear(), date.getMonth() + 1, date.getDate());
      }

      const strVal = String(val).trim();

      // Numeric strings (Excel serial values or yyyymmdd)
      if (/^-?\d+(?:\.\d+)?$/.test(strVal)) {
        const asNumber = Number(strVal);

        // Try serial number interpretation first
        const serialDate = new Date(Math.round((asNumber - 25569) * 86400 * 1000));
        const serialISO = buildISODate(serialDate.getFullYear(), serialDate.getMonth() + 1, serialDate.getDate());
        if (serialISO) return serialISO;

        // Try yyyymmdd compact format (e.g., 20240131)
        if (strVal.length === 8) {
          const year = parseInt(strVal.slice(0, 4), 10);
          const month = parseInt(strVal.slice(4, 6), 10);
          const day = parseInt(strVal.slice(6, 8), 10);
          const compactISO = buildISODate(year, month, day);
          if (compactISO) return compactISO;
        }
  }

      // Handle slash/dash/dot separated strings with explicit day & month recognition (DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD)
      const datePattern = /^(\d{1,4})[\/.-](\d{1,2})[\/.-](\d{1,4})$/;
      const match = strVal.match(datePattern);
      if (match) {
        const a = parseInt(match[1], 10);
        const b = parseInt(match[2], 10);
        const c = parseInt(match[3], 10);

        // Try DD/MM/YYYY first for the provided sample files
        const ddmmyyyy = buildISODate(c >= 100 ? c : 2000 + c, b, a);
        if (ddmmyyyy) return ddmmyyyy;

        // Try YYYY/MM/DD
        const yyyymmdd = buildISODate(a, b, c);
        if (yyyymmdd) return yyyymmdd;

        // Fallback to MM/DD/YYYY
        const mmddyyyy = buildISODate(c >= 100 ? c : 2000 + c, a, b);
        if (mmddyyyy) return mmddyyyy;
      }

      // Native Date parsing fallback
      const native = new Date(val);
      if (!isNaN(native.getTime()) && native.getFullYear() > 2000) {
        return buildISODate(native.getFullYear(), native.getMonth() + 1, native.getDate());
      }
    } catch (e) {
      return '';
    }
  


    return '';
  };

  const getNumber = (val: any) => {
    if (!val) return 0;
    const str = String(val).replace(/[^\d.-]/g, ''); // Remove currency, commas
    if (str === '' || str === '#N/A' || str.toLowerCase() === 'null') return 0;
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  };

  // Helper to construct SkippedRow object
  const createSkippedRow = (rowObj: any, index: number, reason: string): SkippedRow => {
    return {
      rowNumber: index + 1, // Visual row number
      date: cleanCell(rowObj.date),
      driver: cleanCell(rowObj.driver),
      qrCode: cleanCell(rowObj.qrCode),
      vehicle: cleanCell(rowObj.vehicle),
      shift: cleanCell(rowObj.shift),
      rent: cleanCell(rowObj.rent),
      collection: cleanCell(rowObj.collection),
      fuel: cleanCell(rowObj.fuel),
      due: cleanCell(rowObj.due),
        payout: cleanCell(rowObj.payout),
      rejectReason: reason
    };
  };

  // -------------------------------------------------------------------------
  // FILE PARSING (ARRAY-BASED)
  // -------------------------------------------------------------------------

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      resetImportState();
    }
  };

  const resetImportState = () => {
    setImportState({
      queue: [],
      currentIndex: 0,
      validEntries: [],
      skippedRows: [],
      overriddenIds: [],
      status: 'idle'
    });
    setCurrentConflict(null);
    setShowSkippedModal(false);
  };

  const startImport = async () => {
       if (!file) return;
    if (!isXLSXReady || typeof XLSX === 'undefined') {
        alert("Loading file parser. Please try again in a moment.");
        return;
    }
    setImportState(prev => ({ ...prev, status: 'processing' }));

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 1. Read as Array of Arrays (Header: 1)
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        
        if (rawRows.length === 0) {
          alert("File appears empty.");
          setImportState(prev => ({ ...prev, status: 'idle' }));
          return;
        }

        // 2. Locate Header Row
        let headerRowIndex = -1;
let bestMatchCount = 0;
        let colIndices: Record<string, number> = {};

       for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
            const normalizedRow = rawRows[i].map(cell => String(cell).toLowerCase().trim());
            let matchCount = 0;
            

            REQUIRED_DAILY_COLUMNS.forEach(col => {
              if (col.keys.some(k => normalizedRow.some(cell => cell.includes(k.toLowerCase())))) {
                    matchCount++;
                }
            });

if (matchCount > bestMatchCount) {
                const candidate: Record<string, number> = {};
                REQUIRED_DAILY_COLUMNS.forEach(col => {
                  
               const idx = normalizedRow.findIndex(cell => col.keys.some(k => cell.includes(k.toLowerCase())));
                    candidate[col.field] = idx;
                });
 bestMatchCount = matchCount;
                headerRowIndex = i;
                colIndices = candidate;
            }
        }

if (headerRowIndex === -1 || bestMatchCount < 3) {
            alert("Could not detect header row. Please check column names (Date, Driver, etc.)");
            setImportState(prev => ({ ...prev, status: 'idle' }));
            return;
        }
          // Ensure we have a usable Date column reference; if not found, default to first column
        if (colIndices.date === -1 || colIndices.date === undefined) {
            colIndices.date = 0;
        }


        // 3. Process Data Rows (Stop at Table End)
        const processedQueue: any[] = [];
           const skippedFromParse: SkippedRow[] = [];
        let blankStreak = 0;
        const isGarbageRow = (row: any[]) => {
            // Consider rows with only a weekday label or metadata as empty so we can find table end quickly
            const nonEmpty = row.filter(c => String(c || '').trim() !== '');
            if (nonEmpty.length === 0) return true;
            if (nonEmpty.length === 1) {
              const val = String(nonEmpty[0]).toLowerCase();
              const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
              if (weekdays.includes(val)) return true;
            }
            return false;
        };


        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            
            
            // Safety: Pad row if short
            while (row.length < Object.keys(colIndices).length) row.push("");

            // Stop Conditions
          // A. Check for section headers of other tables
            const firstCellRaw = String(row[0] || '').toLowerCase();
            if (firstCellRaw.includes('driver summary') || firstCellRaw.includes('weekly status') || firstCellRaw.includes('profit') || firstCellRaw.includes('loss')) break;
            if (firstCellRaw.includes('total')) break;

          // B. Check for Blank/Garbage Streak (End of block)
            if (isGarbageRow(row)) {
                blankStreak++;
                if (blankStreak > 3) break; // Assume end of table after 3 empty/garbage rows
                continue;
            } else {
                blankStreak = 0;
            }

            // C. Extract Data via Index
            const rowObj: any = {};
            // Using mapped indices ensures we don't read "Drivers" from column 3 if it's actually in column 1 in a different table
            REQUIRED_DAILY_COLUMNS.forEach(col => {
                const idx = colIndices[col.field];
                rowObj[col.field] = idx !== -1 && idx !== undefined ? cleanCell(row[idx]) : '';
            });

            // Store original line number for reference
            rowObj._line = i + 1;

            // Check if it's a valid data row (Must have Date)
            const parsedDate = parseExcelDate(rowObj.date);
            
            if (parsedDate) {
               processedQueue.push({ ...rowObj, date: parsedDate }); // Store parsed ISO date
             } else if (Object.values(rowObj).some(v => String(v || '').trim() !== '')) {
               skippedFromParse.push(createSkippedRow(rowObj, i, 'Invalid or missing date'));
                }
        }

        if (processedQueue.length === 0) {
            setImportState(prev => ({ ...prev, skippedRows: [...prev.skippedRows, ...skippedFromParse], status: 'idle' }));
             alert(`No valid data rows found after header. ${skippedFromParse.length > 0 ? 'Rows failed date parsing. Please verify the Date column (e.g., DD/MM/YYYY).' : ''}`);
             return;
        }

        setImportState(prev => ({ ...prev, queue: processedQueue, skippedRows: [...prev.skippedRows, ...skippedFromParse], status: 'processing' }));


      } catch (err) {
        console.error(err);
        alert("Error parsing file.");
        setImportState(prev => ({ ...prev, status: 'idle' }));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // -------------------------------------------------------------------------
  // VALIDATION PIPELINE
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (importState.status === 'processing' && importState.queue.length > 0) {
      if (importState.currentIndex < importState.queue.length) {
        // Reduced timeout for speed
        const timer = setTimeout(() => validateCurrentRow(), 5);
        return () => clearTimeout(timer);
      } else {
        finalizeImport();
      }
    }
  }, [importState.status, importState.currentIndex, importState.queue]);

  const validateCurrentRow = () => {
    const { queue, currentIndex } = importState;
    const mapped = queue[currentIndex]; // Already mapped & cleaned in startImport
    
    // --- VALIDATION 3: CHECK MANDATORY FIELDS ---
    const missingFields = REQUIRED_DAILY_COLUMNS.filter(col => col.required && !mapped[col.field]);
    
    if (missingFields.length > 0) {
      pauseWithConflict('BLANK_FIELDS', mapped, currentIndex, { missingFields: missingFields.map(f => f.label) });
      return;
    }

    const driverName = mapped.driver;
    const dateStr = mapped.date; // Already parsed

    // --- VALIDATION 1: DRIVER EXISTS CHECK ---
    const driverExists = driversRef.current.some(d => d.name.toLowerCase() === driverName.toLowerCase() && !d.terminationDate);
    if (!driverExists) {
      pauseWithConflict('DRIVER_MISSING', mapped, currentIndex, { driverName });
      return;
    }

    // --- VALIDATION 2: DUPLICATE ENTRY CHECK ---
    const duplicate = existingEntriesRef.current.find(e => 
      e.date === dateStr && 
      e.driver.toLowerCase() === driverName.toLowerCase() &&
      !importState.overriddenIds.includes(e.id)
    );

    const batchDuplicate = importState.validEntries.find(e => 
      e.date === dateStr && e.driver.toLowerCase() === driverName.toLowerCase()
    );

    if (duplicate || batchDuplicate) {
        const newEntryObj = {
          driver: driverName,
          date: dateStr,
          vehicle: mapped.vehicle,
          shift: mapped.shift,
          rent: getNumber(mapped.rent),
          collection: getNumber(mapped.collection),
          fuel: getNumber(mapped.fuel),
          due: getNumber(mapped.due),
           payout: getNumber(mapped.payout),
          qrCode: mapped.qrCode
      };
      
      pauseWithConflict('DUPLICATE_ENTRY', mapped, currentIndex, { 
        existing: duplicate || batchDuplicate, 
        newEntry: newEntryObj,
        isBatchDuplicate: !!batchDuplicate 
      });
      return;
    }

    // --- ALL VALID ---
    const newEntry: DailyEntry = {
      id: crypto.randomUUID(),
      date: dateStr,
      day: mapped.day || new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }),
      vehicle: mapped.vehicle, 
      driver: driverName,
      shift: mapped.shift,
      qrCode: mapped.qrCode,
      rent: getNumber(mapped.rent),
      collection: getNumber(mapped.collection),
      fuel: getNumber(mapped.fuel),
      due: getNumber(mapped.due),
      payout: getNumber(mapped.payout),  
      notes: 'Imported'
    };

    setImportState(prev => ({
      ...prev,
      validEntries: [...prev.validEntries, newEntry],
      currentIndex: prev.currentIndex + 1
    }));
  };

  const pauseWithConflict = (type: ConflictState['type'], row: any, index: number, payload: any) => {
    setCurrentConflict({ type, row, rowIndex: index, payload });
    setImportState(prev => ({ ...prev, status: 'paused' }));
  };

  const resumeImport = (incrementIndex = true) => {
    setCurrentConflict(null);
    setImportState(prev => ({
      ...prev,
      currentIndex: incrementIndex ? prev.currentIndex + 1 : prev.currentIndex, 
      status: 'processing'
    }));
  };

  // -------------------------------------------------------------------------
  // CONFLICT RESOLVERS
  // -------------------------------------------------------------------------

  const resolveDriver_Add = async () => {
    const nameToAdd = newDriverName.trim() || currentConflict?.payload.driverName?.trim();
    const mobileToAdd = newDriverMobile.trim();
    
    if (!nameToAdd) return alert("Name required");
    
    // Check duplication against existing drivers before adding
    const duplicateName = driversRef.current.find(d => d.name.toLowerCase() === nameToAdd.toLowerCase());
    if (duplicateName) {
        alert(`Cannot add: Driver "${duplicateName.name}" already exists.`);
        return;
    }

    const newDriver: Driver = {
      id: '', // Empty string, let backend generate UUID
      name: nameToAdd,
      mobile: mobileToAdd,
      joinDate: new Date().toISOString().split('T')[0],
      deposit: 0,
      status: 'Active',
      qrCode: '',
      vehicle: '',
      currentShift: 'Day'
    };

    try {
        const savedDriver = await storageService.saveDriver(newDriver);
        
        // Update reference with the FULL driver object returned by API (including new ID)
        const updatedDrivers = [...driversRef.current, savedDriver];
        driversRef.current = updatedDrivers;
        setDrivers(updatedDrivers); 
        
        setNewDriverName('');
        setNewDriverMobile('');
        
        resumeImport(false); 
    } catch (e: any) {
        alert(e.message);
    }
  };

  const resolveDriver_Skip = () => {
    const driverName = currentConflict?.payload.driverName;
    const { queue, currentIndex } = importState;
    const row = queue[currentIndex];
    
    // Add current to skipped list
    const skippedRow = createSkippedRow(row, currentIndex, `Driver not found: ${driverName}`);
    
    setImportState(prev => ({
        ...prev,
        skippedRows: [...prev.skippedRows, skippedRow],
        // Just skip this one row, manual skip logic simplified to row-by-row for now as per robust design
        // Or implement loop if "Skip All" is desired
        currentIndex: prev.currentIndex + 1,
        status: 'processing' // resume
    }));
    setCurrentConflict(null);
  };

  const resolve_Terminate = () => {
    resetImportState();
  };

  const resolveDuplicate_Override = () => {
    const { existing, isBatchDuplicate } = currentConflict?.payload;
    if (!isBatchDuplicate && existing?.id) {
      setImportState(prev => ({
        ...prev,
        overriddenIds: [...prev.overriddenIds, existing.id]
      }));
    } else if (isBatchDuplicate) {
      setImportState(prev => ({
        ...prev,
        validEntries: prev.validEntries.filter(e => 
          !(e.date === existing.date && e.driver === existing.driver)
        )
      }));
    }
    resumeImport(false);
  };

  const resolveDuplicate_Skip = () => {
    const { queue, currentIndex } = importState;
    const row = queue[currentIndex];
    const skippedRow = createSkippedRow(row, currentIndex, "Duplicate entry skipped by user");
    
    setImportState(prev => ({ 
        ...prev, 
        skippedRows: [...prev.skippedRows, skippedRow],
        currentIndex: prev.currentIndex + 1,
        status: 'processing'
    }));
    setCurrentConflict(null);
  };

  const resolveBlank_Skip = () => {
    const { queue, currentIndex } = importState;
    const row = queue[currentIndex];
    const missing = currentConflict?.payload.missingFields.join(', ');
    const skippedRow = createSkippedRow(row, currentIndex, `Missing mandatory fields: ${missing}`);

    setImportState(prev => ({ 
        ...prev, 
        skippedRows: [...prev.skippedRows, skippedRow],
        currentIndex: prev.currentIndex + 1,
        status: 'processing'
    }));
    setCurrentConflict(null);
  };

  // -------------------------------------------------------------------------
  // FINALIZATION
  // -------------------------------------------------------------------------
  
  const finalizeImport = async () => {
    setImportState(prev => ({ ...prev, status: 'complete' }));
    
    if (importState.overriddenIds.length > 0) {
      for (const id of importState.overriddenIds) {
        await storageService.deleteDailyEntry(id);
      }
    }
    
    if (importState.validEntries.length > 0) {
      await storageService.saveDailyEntriesBulk(importState.validEntries);
    }
  };

  // -------------------------------------------------------------------------
  // RENDER UI
  // -------------------------------------------------------------------------

  const ComparisonTable = ({ oldData, newData }: any) => (
    <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden text-xs mt-4">
      <div className="grid grid-cols-3 font-bold bg-slate-100 p-2 border-b border-slate-200">
        <div>Field</div>
        <div className="text-amber-700">Existing</div>
        <div className="text-indigo-700">New Import</div>
      </div>
      {Object.keys(newData).map(key => {
        if (key === 'id') return null;
        const oldVal = oldData[key];
        const newVal = newData[key];
        const isDiff = oldVal != newVal;
        return (
          <div key={key} className={`grid grid-cols-3 p-2 border-b border-slate-100 last:border-0 ${isDiff ? 'bg-indigo-50/50' : ''}`}>
            <div className="font-semibold text-slate-500 capitalize">{key}</div>
            <div className="text-slate-600 truncate">{oldVal?.toString() || '-'}</div>
            <div className={`truncate ${isDiff ? 'font-bold text-indigo-700' : 'text-slate-600'}`}>{newVal?.toString() || '-'}</div>
          </div>
        )
      })}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in relative">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Smart Import</h2>
           <p className="text-slate-500 mt-1">Strict multi-step validation with conflict resolution.</p>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        {importState.status === 'idle' && (
           <div className="p-16 flex flex-col items-center justify-center text-center">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 w-full max-w-lg hover:bg-slate-50 hover:border-indigo-400 transition-all cursor-pointer relative group">
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="bg-indigo-50 p-5 rounded-full text-indigo-600 mb-6 mx-auto w-fit group-hover:scale-110 transition-transform shadow-sm">
                  <Upload size={40} />
                </div>
                <h3 className="text-xl font-bold text-slate-700">Drop Daily Entry CSV</h3>
                <p className="text-slate-400 mt-2 font-medium">Smart detection of tables & dates.</p>
              </div>
  <button onClick={startImport} disabled={!file || !isXLSXReady} className="mt-8 px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none hover:bg-indigo-700 transition-all">
                 Start Validation
              </button>
           </div>
        )}

        {importState.status !== 'idle' && (
          <div className="p-8">
             <div className="flex items-center justify-between mb-6">
                <div>
                   <h3 className="text-lg font-bold text-slate-800">Processing Import...</h3>
                   <p className="text-sm text-slate-500">Processing Row {importState.currentIndex + 1} of {importState.queue.length}</p>
                </div>
                <div className="flex gap-4">
                   <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 font-bold text-sm">
                      {importState.validEntries.length} Valid
                   </div>
                   <button 
                     onClick={() => importState.skippedRows.length > 0 && setShowSkippedModal(true)}
                     className={`px-4 py-2 rounded-lg border font-bold text-sm flex items-center gap-2 transition-all ${importState.skippedRows.length > 0 ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-default'}`}
                   >
                      <span>{importState.skippedRows.length} Skipped</span>
                      {importState.skippedRows.length > 0 && <Eye size={16} />}
                   </button>
                </div>
             </div>

             {/* Progress Bar */}
             <div className="w-full bg-slate-100 rounded-full h-4 mb-8 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${importState.status === 'paused' ? 'bg-amber-400' : importState.status === 'complete' ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                  style={{ width: `${(importState.currentIndex / Math.max(importState.queue.length, 1)) * 100}%` }}
                ></div>
             </div>

             {importState.status === 'complete' && (
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl flex flex-col items-center text-center">
                   <div className="bg-white p-3 rounded-full shadow-sm mb-3">
                      <CheckCircle size={32} className="text-emerald-600" />
                   </div>
                   <h4 className="text-xl font-bold text-emerald-800">Import Complete!</h4>
                   <p className="text-emerald-600 mt-1">Successfully saved {importState.validEntries.length} entries.</p>
                   <button onClick={resetImportState} className="mt-6 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold">Import Another File</button>
                </div>
             )}
             
             {importState.status === 'paused' && (
                <div className="text-center py-12 text-slate-400 animate-pulse flex flex-col items-center gap-3">
                   <AlertTriangle size={32} className="text-amber-400" />
                   <span className="font-medium">Import Paused: Resolve conflict in popup</span>
                </div>
             )}
          </div>
        )}
      </div>

      {/* POPUP 1: DRIVER MISSING */}
      {currentConflict?.type === 'DRIVER_MISSING' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ring-4 ring-rose-50">
              <div className="bg-rose-50 p-6 border-b border-rose-100 flex items-center gap-3">
                 <div className="bg-white p-2 rounded-full text-rose-500 shadow-sm"><AlertTriangle size={24} /></div>
                 <div>
                    <h3 className="font-bold text-rose-900">Driver Not Found</h3>
                    <p className="text-xs text-rose-700 font-medium">Import Row {currentConflict.rowIndex + 1}</p>
                 </div>
              </div>
              <div className="p-6 space-y-4">
                 <p className="text-slate-600 text-sm">
                    The driver <span className="font-bold text-slate-900">"{currentConflict.payload.driverName}"</span> does not exist in the system.
                 </p>
                 
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quick Register & Continue</p>
                    <input 
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="Driver Name" 
                      value={newDriverName} 
                      onChange={e => setNewDriverName(e.target.value)} 
                    />
                    <input 
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="Mobile (Optional)" 
                      value={newDriverMobile} 
                      onChange={e => setNewDriverMobile(e.target.value)} 
                    />
                    <button onClick={resolveDriver_Add} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
                       <UserPlus size={14} /> Add Driver & Resume
                    </button>
                 </div>

                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={resolveDriver_Skip} className="py-3 border border-slate-200 rounded-xl text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors">
                       Skip Row
                    </button>
                    <button onClick={resolve_Terminate} className="py-3 bg-rose-100 text-rose-700 rounded-xl text-sm font-bold hover:bg-rose-200 transition-colors">
                       Terminate Import
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* POPUP 2: DUPLICATE ENTRY */}
      {currentConflict?.type === 'DUPLICATE_ENTRY' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden ring-4 ring-amber-50">
              <div className="bg-amber-50 p-6 border-b border-amber-100 flex items-center gap-3">
                 <div className="bg-white p-2 rounded-full text-amber-500 shadow-sm"><AlertOctagon size={24} /></div>
                 <div>
                    <h3 className="font-bold text-amber-900">Duplicate Entry Found</h3>
                    <p className="text-xs text-amber-700 font-medium">Import Row {currentConflict.rowIndex + 1}</p>
                 </div>
              </div>
              <div className="p-6">
                 <p className="text-slate-600 text-sm mb-4">
                    Driver <span className="font-bold text-slate-900">"{currentConflict.payload.newEntry.driver}"</span> already has an entry for <span className="font-bold text-slate-900">{currentConflict.payload.newEntry.date}</span>.
                 </p>
                 
                 <ComparisonTable oldData={currentConflict.payload.existing} newData={currentConflict.payload.newEntry} />

                 <div className="grid grid-cols-3 gap-3 mt-6">
                    <button onClick={resolveDuplicate_Override} className="py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                       Override
                    </button>
                    <button onClick={resolveDuplicate_Skip} className="py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200">
                       Skip Row
                    </button>
                    <button onClick={resolve_Terminate} className="py-2.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100">
                       Terminate
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* POPUP 3: BLANK FIELDS */}
      {currentConflict?.type === 'BLANK_FIELDS' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden ring-4 ring-slate-200">
              <div className="bg-slate-100 p-6 border-b border-slate-200 flex items-center gap-3">
                 <div className="bg-white p-2 rounded-full text-slate-500 shadow-sm"><XCircle size={24} /></div>
                 <div>
                    <h3 className="font-bold text-slate-800">Missing Data</h3>
                    <p className="text-xs text-slate-500 font-medium">Import Row {currentConflict.rowIndex + 1}</p>
                 </div>
              </div>
              <div className="p-6 space-y-4">
                 <p className="text-slate-600 text-sm">
                    The following mandatory columns are blank:
                 </p>
                 <div className="flex flex-wrap gap-2">
                    {currentConflict.payload.missingFields.map((f: string) => (
                       <span key={f} className="px-2 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded border border-rose-100">{f}</span>
                    ))}
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={resolveBlank_Skip} className="py-3 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors">
                       Skip Row
                    </button>
                    <button onClick={resolve_Terminate} className="py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
                       Terminate Import
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* SKIPPED ROWS VIEWER MODAL */}
      {showSkippedModal && (
         <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
               <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="bg-slate-200 p-2 rounded-lg text-slate-700"><Eye size={20} /></div>
                     <div>
                        <h3 className="font-bold text-slate-800 text-lg">Skipped Rows</h3>
                        <p className="text-xs text-slate-500">Rows that were excluded during import.</p>
                     </div>
                  </div>
                  <button onClick={() => setShowSkippedModal(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-2 rounded-full transition-colors">
                     <X size={24} />
                  </button>
               </div>
               
               <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm text-left">
                     <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 shadow-sm">
                        <tr>
                           <th className="px-4 py-3 font-bold w-16">Row</th>
                           <th className="px-4 py-3 font-bold text-rose-600 w-1/4">Reject Reason</th>
                           <th className="px-4 py-3 font-bold">Date</th>
                           <th className="px-4 py-3 font-bold">Driver</th>
                           <th className="px-4 py-3 font-bold">Shift</th>
                           <th className="px-4 py-3 font-bold">QR</th>
                           <th className="px-4 py-3 font-bold text-right">Rent</th>
                           <th className="px-4 py-3 font-bold text-right">Collection</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {importState.skippedRows.map((row, idx) => (
                           <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-mono text-xs text-slate-400 font-bold">{row.rowNumber}</td>
                              <td className="px-4 py-3 text-rose-600 font-medium">{row.rejectReason}</td>
                              <td className="px-4 py-3 text-slate-600">{row.date || '-'}</td>
                              <td className="px-4 py-3 font-bold text-slate-800">{row.driver || '-'}</td>
                              <td className="px-4 py-3 text-slate-600">{row.shift || '-'}</td>
                              <td className="px-4 py-3 text-slate-500 text-xs">{row.qrCode || '-'}</td>
                              <td className="px-4 py-3 text-right text-slate-600">{row.rent}</td>
                              <td className="px-4 py-3 text-right text-slate-600">{row.collection}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
               
               <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                  <button onClick={() => setShowSkippedModal(false)} className="px-6 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors">Close Viewer</button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default ImportPage;
