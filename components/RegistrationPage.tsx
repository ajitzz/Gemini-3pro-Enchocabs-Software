import React, { useState, useEffect, useRef } from 'react';
import { Upload, CheckCircle, FileSpreadsheet, XCircle, AlertTriangle, X, UserPlus, AlertOctagon, ArrowRight, Save, Play } from 'lucide-react';
import { storageService } from '../services/storageService';
import { DailyEntry, WeeklyWallet, Driver, AssetMaster } from '../types';

declare const XLSX: any;

// Configuration for Strict Daily Import
// Added 'optional' flag for Fuel and Due as requested
const REQUIRED_DAILY_COLUMNS = [
  { field: 'date', label: 'Date', keys: ['Date', 'Trip Date', 'Run Date'], required: true },
  { field: 'day', label: 'Day', keys: ['Day', 'Day Name'], required: true },
  { field: 'vehicle', label: 'Vehicle', keys: ['Vehicle', 'Vehicle No', 'Vehicle Number'], required: true },
  { field: 'driver', label: 'Driver', keys: ['Driver', 'Driver Name'], required: true },
  { field: 'shift', label: 'Shift', keys: ['Shift', 'Shift Type'], required: true },
  { field: 'qrCode', label: 'QR CODE', keys: ['QR CODE', 'QRCode', 'QR'], required: true },
  { field: 'rent', label: 'Rent', keys: ['Rent', 'Rental'], required: true },
  { field: 'collection', label: 'Collection', keys: ['Collection', 'Amount Collected', 'Collected'], required: true },
  { field: 'fuel', label: 'Fuel', keys: ['Fuel', 'Fuel Expense', 'Fuel Cost', 'Encho Fuel'], required: false },
  { field: 'due', label: 'Due', keys: ['Due', 'Balance', 'Pending', 'Due Amount'], required: false }
];

type ImportStatus = 'idle' | 'processing' | 'paused' | 'complete';

interface ConflictState {
  type: 'DRIVER_MISSING' | 'DUPLICATE_ENTRY' | 'BLANK_FIELDS';
  row: any;
  rowIndex: number;
  payload?: any; // Extra data like existing entry for comparison
}

interface ImportState {
  queue: any[];
  currentIndex: number;
  validEntries: DailyEntry[];
  skippedCount: number;
  overriddenIds: string[]; // IDs of existing entries to delete from DB
  status: ImportStatus;
}

const ImportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
  const [file, setFile] = useState<File | null>(null);
  
  // System Data State (For UI Rendering)
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [existingEntries, setExistingEntries] = useState<DailyEntry[]>([]);
  const [assets, setAssets] = useState<AssetMaster>({ vehicles: [], qrCodes: [] });

  // System Data Refs (For Logic/Validation - Prevents Stale Closures)
  const driversRef = useRef<Driver[]>([]);
  const existingEntriesRef = useRef<DailyEntry[]>([]);
  const assetsRef = useRef<AssetMaster>({ vehicles: [], qrCodes: [] });

  // State Machine
  const [importState, setImportState] = useState<ImportState>({
    queue: [],
    currentIndex: 0,
    validEntries: [],
    skippedCount: 0,
    overriddenIds: [],
    status: 'idle'
  });

  const [currentConflict, setCurrentConflict] = useState<ConflictState | null>(null);
  
  // Quick Driver Add Form State
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverMobile, setNewDriverMobile] = useState('');

  // -------------------------------------------------------------------------
  // INITIALIZATION & HELPERS
  // -------------------------------------------------------------------------

  useEffect(() => {
    refreshSystemData();
  }, []);

  // Pre-fill driver name when conflict appears
  useEffect(() => {
    if (currentConflict?.type === 'DRIVER_MISSING') {
        setNewDriverName(currentConflict.payload.driverName || '');
        setNewDriverMobile('');
    }
  }, [currentConflict]);

  // Keep Refs in Sync with State
  useEffect(() => { driversRef.current = drivers; }, [drivers]);
  useEffect(() => { existingEntriesRef.current = existingEntries; }, [existingEntries]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);

  const refreshSystemData = async () => {
    const [d, e, a] = await Promise.all([
      storageService.getDrivers(),
      storageService.getDailyEntries(),
      storageService.getAssets()
    ]);
    
    // Update State (for UI)
    setDrivers(d);
    setExistingEntries(e);
    setAssets(a);

    // Update Refs (for Logic immediately)
    driversRef.current = d;
    existingEntriesRef.current = e;
    assetsRef.current = a;
  };

  const getCol = (row: any, possibleKeys: string[]): string => {
    if (!row) return '';
    const rowKeys = Object.keys(row);
    const normalize = (s: string) => s.trim().toLowerCase();
    for (const key of possibleKeys) {
      // Direct match
      if (row[key] !== undefined) return String(row[key]);
      // Fuzzy match
      const foundKey = rowKeys.find(k => normalize(k) === normalize(key));
      if (foundKey && row[foundKey] !== undefined) return String(row[foundKey]);
    }
    return '';
  };

  const parseExcelDate = (val: any): string => {
    if (!val) return '';
    try {
        if (typeof val === 'number') {
          // Excel serial date
          const date = new Date(Math.round((val - 25569) * 86400 * 1000));
          const iso = date.toISOString().split('T')[0];
          // Basic sanity check for valid year to avoid noise
          if (date.getFullYear() < 2000 || date.getFullYear() > 2100) return '';
          return iso;
        }
        if (typeof val === 'string') {
           // Handle DD/MM/YYYY
           if (val.includes('/')) {
             const parts = val.split('/');
             if (parts.length === 3) {
                // Determine format (DD/MM vs MM/DD). Usually India/UK is DD/MM
                // Assuming DD/MM/YYYY based on provided CSV example (01/11/2025)
                const d = parseInt(parts[0]);
                const m = parseInt(parts[1]);
                const y = parseInt(parts[2]);
                if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                    const dateObj = new Date(y, m - 1, d);
                    // Check if date represents real calendar date
                    if (dateObj.getFullYear() === y && dateObj.getMonth() === m - 1 && dateObj.getDate() === d) {
                        // Pad with leading zeros
                        const mm = m.toString().padStart(2, '0');
                        const dd = d.toString().padStart(2, '0');
                        return `${y}-${mm}-${dd}`;
                    }
                }
             }
           }
           // Handle YYYY-MM-DD
           if (val.includes('-')) {
               const parts = val.split('-');
               if (parts.length === 3) return val;
           }
        }
        // Fallback to native parse if string matches something browser understands
        const native = new Date(val);
        if (!isNaN(native.getTime()) && native.getFullYear() > 2000) {
            return native.toISOString().split('T')[0];
        }
    } catch (e) { return ''; }
    return '';
  };

  const getNumber = (val: string) => {
    if (!val) return 0;
    // Remove currency symbols or commas if any
    const clean = val.toString().replace(/[^\d.-]/g, '');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  };

  // -------------------------------------------------------------------------
  // FILE PARSING
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
      skippedCount: 0,
      overriddenIds: [],
      status: 'idle'
    });
    setCurrentConflict(null);
  };

  const startImport = async () => {
    if (!file || typeof XLSX === 'undefined') {
        if (typeof XLSX === 'undefined') alert("Library loading...");
        return;
    }
    setImportState(prev => ({ ...prev, status: 'processing' }));

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // --- SMART HEADER DETECTION ---
        // We look for a row that contains our mandatory headers
        let headerRowIndex = 0;
        const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:Z100");
        
        for (let R = range.s.r; R <= Math.min(range.e.r, 20); ++R) {
            let matchCount = 0;
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = worksheet[XLSX.utils.encode_cell({r: R, c: C})];
                if (cell && cell.v) {
                    const val = String(cell.v).toLowerCase().trim();
                    if (REQUIRED_DAILY_COLUMNS.some(col => col.keys.some(k => k.toLowerCase() === val))) {
                        matchCount++;
                    }
                }
            }
            // If at least 4 known columns are found, this is the header
            if (matchCount >= 4) {
                headerRowIndex = R;
                break;
            }
        }

        // Parse starting from detected header
        const rows = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: "" });
        
        if (rows.length === 0) {
          alert("File appears empty or no data found after header.");
          setImportState(prev => ({ ...prev, status: 'idle' }));
          return;
        }

        // --- FILTERING "GARBAGE" ROWS ---
        // The CSV contains multiple tables. We only want the Daily Entries table.
        // Rule: A valid Daily Entry row MUST have a parseable Date.
        // Rows with "Total", empty dates, or headers from other tables (like "Date Start") will fail date parsing and be dropped.
        const cleanRows = rows.filter((r: any) => {
            const rawDate = getCol(r, ['Date', 'Trip Date']);
            const parsedDate = parseExcelDate(rawDate);
            
            // Also ensure it's not a "Total" row
            const firstColVal = String(Object.values(r)[0] || '').toLowerCase();
            if (firstColVal.includes('total')) return false;

            // Must have a valid date to be a daily entry
            return !!parsedDate;
        });

        if (cleanRows.length === 0) {
             alert("No valid daily entry rows found. Please check Date format (DD/MM/YYYY).");
             setImportState(prev => ({ ...prev, status: 'idle' }));
             return;
        }

        setImportState(prev => ({ ...prev, queue: cleanRows, status: 'processing' }));
      } catch (err) {
        console.error(err);
        alert("Error parsing file. Please check format.");
        setImportState(prev => ({ ...prev, status: 'idle' }));
      }
    };
    reader.readAsBinaryString(file);
  };

  // -------------------------------------------------------------------------
  // VALIDATION PIPELINE (The Loop)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (importState.status === 'processing' && importState.queue.length > 0) {
      if (importState.currentIndex < importState.queue.length) {
        const timer = setTimeout(() => validateCurrentRow(), 10);
        return () => clearTimeout(timer);
      } else {
        finalizeImport();
      }
    }
  }, [importState.status, importState.currentIndex, importState.queue]);

  const validateCurrentRow = () => {
    const { queue, currentIndex } = importState;
    const row = queue[currentIndex];
    
    // --- 1. MAPPING ---
    const mapped: any = {};
    REQUIRED_DAILY_COLUMNS.forEach(col => {
      mapped[col.field] = getCol(row, col.keys).trim();
    });

    const driverName = mapped.driver;
    const dateStr = parseExcelDate(mapped.date);

    // Double check sanity (though pre-filter handles most)
    if (!driverName || !dateStr) {
        // Skip invalid rows silently during processing if they snuck through
        setImportState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
        return;
    }

    // --- VALIDATION 1: DRIVER EXISTS CHECK ---
    if (driverName) {
      const driverExists = driversRef.current.some(d => d.name.toLowerCase() === driverName.toLowerCase() && !d.terminationDate);
      if (!driverExists) {
        pauseWithConflict('DRIVER_MISSING', row, currentIndex, { driverName });
        return;
      }
    }

    // --- VALIDATION 2: ONLY ONE ENTRY PER DRIVER PER DAY ---
    if (driverName && dateStr) {
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
           qrCode: mapped.qrCode
        };
        
        pauseWithConflict('DUPLICATE_ENTRY', row, currentIndex, { 
          existing: duplicate || batchDuplicate, 
          newEntry: newEntryObj,
          isBatchDuplicate: !!batchDuplicate 
        });
        return;
      }
    }

    // --- VALIDATION 3: BLANK COLUMN CHECK (STRICT ONLY) ---
    // Only check columns marked as 'required: true'
    const missingFields = REQUIRED_DAILY_COLUMNS.filter(col => col.required && !mapped[col.field]);
    if (missingFields.length > 0) {
      pauseWithConflict('BLANK_FIELDS', row, currentIndex, { missingFields: missingFields.map(f => f.label) });
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
      fuel: getNumber(mapped.fuel), // Will be 0 if blank
      due: getNumber(mapped.due),   // Will be 0 if blank
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
    const nameToAdd = newDriverName.trim() || currentConflict?.payload.driverName;
    if (!nameToAdd) return alert("Name required");
    
    const newDriver: Driver = {
      id: crypto.randomUUID(),
      name: nameToAdd,
      mobile: newDriverMobile,
      joinDate: new Date().toISOString().split('T')[0],
      deposit: 0,
      status: 'Active',
      qrCode: '',
      vehicle: '',
      currentShift: 'Day'
    };

    await storageService.saveDriver(newDriver);
    
    // Update Ref IMMEDIATELY
    const updatedDrivers = [...driversRef.current, newDriver];
    driversRef.current = updatedDrivers;
    setDrivers(updatedDrivers); 
    
    setNewDriverName('');
    setNewDriverMobile('');
    
    resumeImport(false); 
  };

  const resolveDriver_Skip = () => {
    const driverName = currentConflict?.payload.driverName;
    if (!driverName) return resumeImport(true);

    const { queue, currentIndex } = importState;
    const filteredQueue = queue.filter((row, idx) => {
      if (idx < currentIndex) return true;
      const dName = getCol(row, ['Driver', 'Driver Name']);
      return dName.trim().toLowerCase() !== driverName.toLowerCase();
    });
    
    const countRemoved = queue.length - filteredQueue.length;
    
    setImportState(prev => ({
      ...prev,
      queue: filteredQueue,
      skippedCount: prev.skippedCount + countRemoved,
    }));
    
    setCurrentConflict(null);
    setImportState(prev => ({ ...prev, status: 'processing' }));
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
    setImportState(prev => ({ ...prev, skippedCount: prev.skippedCount + 1 }));
    resumeImport(true);
  };

  const resolveBlank_Skip = () => {
    setImportState(prev => ({ ...prev, skippedCount: prev.skippedCount + 1 }));
    resumeImport(true);
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
              <button onClick={startImport} disabled={!file} className="mt-8 px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none hover:bg-indigo-700 transition-all">
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
                   <div className="px-4 py-2 bg-slate-50 text-slate-600 rounded-lg border border-slate-200 font-bold text-sm">
                      {importState.skippedCount} Skipped
                   </div>
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
                       Skip All for Driver
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

    </div>
  );
};

export default ImportPage;