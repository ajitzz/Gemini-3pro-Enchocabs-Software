import React, { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { RentalSlab, CompanyWeeklySummary, CompanySummaryRow } from '../types';
import { Briefcase, Save, Plus, Trash2, Edit3, X, Settings, ChevronDown, ChevronUp, Upload, FileText, AlertTriangle, CheckCircle, Calendar, Eye } from 'lucide-react';

declare const XLSX: any;

const REQUIRED_SUMMARY_COLUMNS = [
  "Vehicle Number", "Onroad Days", "Daily Rent Applied", "Weekly Indemnity Fees", 
  "Net Weekly Lease Rental", "Performance Day", "Uber Trips", "Total Earning", 
  "Uber Cash Collection", "Toll", "Driver subscription charge", "Uber Incentive", 
  "Uber Week O/s", "OLA Week O/s", "Vehicle Level Adjustment", "TDS", "Challan", "Accident", 
  "DeadMile", "Current O/S"
];

const CompanySettlementPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [slabs, setSlabs] = useState<RentalSlab[]>([]);
  
  // Rental Plan States
  const [isExpanded, setIsExpanded] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false); 
  const [editingSlabId, setEditingSlabId] = useState<string | null>(null);
  const [tempSlab, setTempSlab] = useState<Partial<RentalSlab>>({});

  // Company Summary States
  const [summaries, setSummaries] = useState<CompanyWeeklySummary[]>([]);
  const [currentWeekFile, setCurrentWeekFile] = useState<File | null>(null);
  const [currentWeekNote, setCurrentWeekNote] = useState('');
  const [processingSummary, setProcessingSummary] = useState(false);
  
  // Popup States
  const [popupType, setPopupType] = useState<'NONE' | 'PENALTY' | 'OVERRIDE'>('NONE');
  const [popupMessage, setPopupMessage] = useState('');
  const [pendingData, setPendingData] = useState<CompanySummaryRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  // Viewer State
  const [selectedSummary, setSelectedSummary] = useState<CompanyWeeklySummary | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [slabData, summaryData] = await Promise.all([
        storageService.getRentalSlabs(),
        storageService.getCompanySummaries()
    ]);
    setSlabs(slabData.sort((a, b) => a.minTrips - b.minTrips));
    setSummaries(summaryData.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    setLoading(false);
  };

  // --- RENTAL PLAN HANDLERS ---
  const handleAddSlab = () => {
    const newId = crypto.randomUUID();
    const lastSlab = slabs[slabs.length - 1];
    const newMin = lastSlab ? (lastSlab.maxTrips ? lastSlab.maxTrips + 1 : lastSlab.minTrips + 10) : 0;
    const newSlab: RentalSlab = { id: newId, minTrips: newMin, maxTrips: newMin + 14, rentAmount: 0, notes: '' };
    setSlabs([...slabs, newSlab]);
    startEditing(newSlab);
    setIsExpanded(true);
  };

  const startEditing = (slab: RentalSlab) => { setEditingSlabId(slab.id); setTempSlab({ ...slab }); };
  const cancelEditing = () => { setEditingSlabId(null); setTempSlab({}); loadData(); };
  
  const saveSlab = async () => {
    if (editingSlabId && tempSlab) {
        const updatedSlabs = slabs.map(s => s.id === editingSlabId ? { ...s, ...tempSlab } as RentalSlab : s);
        const finalSlabs = updatedSlabs.sort((a, b) => a.minTrips - b.minTrips);
        await storageService.saveRentalSlabs(finalSlabs);
        setSlabs(finalSlabs);
        setEditingSlabId(null);
        setTempSlab({});
    }
  };

  const deleteSlab = async (id: string) => {
    if (confirm("Are you sure you want to delete this rental slab?")) {
        const newSlabs = slabs.filter(s => s.id !== id);
        await storageService.saveRentalSlabs(newSlabs);
        setSlabs(newSlabs);
    }
  };

  const handleInputChange = (field: keyof RentalSlab, value: any) => setTempSlab(prev => ({ ...prev, [field]: value }));

  // --- COMPANY SUMMARY HANDLERS ---

  const getCurrentWeekRange = () => {
      const d = new Date();
      const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(d.setDate(diff + 6));
      return { 
          start: monday.toISOString().split('T')[0], 
          end: sunday.toISOString().split('T')[0],
          label: `${monday.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})} – ${sunday.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}`
      };
  };

  const handleSummaryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          setCurrentWeekFile(e.target.files[0]);
          setErrors([]); // Clear errors on new file
      }
  };

  const processSummaryFile = async () => {
      if (!currentWeekFile) return;
      setProcessingSummary(true);
      setErrors([]);

      const reader = new FileReader();
      reader.onload = (e) => {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Read first 20 rows to find header
          const initialRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          let headerRowIndex = -1;
          
          // Smart Header Detection
          for (let i = 0; i < Math.min(initialRows.length, 20); i++) {
              const row = initialRows[i].map(cell => String(cell).trim());
              // Check if this row contains most of our required columns
              const matchCount = REQUIRED_SUMMARY_COLUMNS.reduce((count, col) => {
                  return row.includes(col) ? count + 1 : count;
              }, 0);

              // Threshold: if 50% of columns match, assume it's the header
              if (matchCount >= REQUIRED_SUMMARY_COLUMNS.length / 2) {
                  headerRowIndex = i;
                  break;
              }
          }

          if (headerRowIndex === -1) {
             setErrors(["Could not detect valid header row. Please check column names."]);
             setProcessingSummary(false);
             return;
          }

          // Read data starting from detected header
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: "" });
          
          if (rawRows.length === 0) {
              setErrors(["File is empty or no data found after header."]);
              setProcessingSummary(false);
              return;
          }

          // --- VALIDATION 1: REQUIRED COLUMNS ---
          const headers = Object.keys(rawRows[0]);
          const missingCols = REQUIRED_SUMMARY_COLUMNS.filter(c => !headers.includes(c));
          if (missingCols.length > 0) {
              setErrors([`Missing required columns: ${missingCols.join(', ')}`]);
              setProcessingSummary(false);
              return;
          }

          // Helper to parse potentially formatted numbers (e.g. "1,234.56")
          const getNum = (val: any) => {
              if (typeof val === 'number') return val;
              if (!val) return 0;
              const clean = String(val).replace(/,/g, '');
              const n = parseFloat(clean);
              return isNaN(n) ? 0 : n;
          };

          // Normalize Data
          const rows: CompanySummaryRow[] = rawRows
            .filter((r: any) => r["Vehicle Number"]) // Filter empty rows
            .map((r: any) => ({
              vehicleNumber: String(r["Vehicle Number"]),
              onroadDays: getNum(r["Onroad Days"]),
              dailyRentApplied: getNum(r["Daily Rent Applied"]),
              weeklyIndemnityFees: getNum(r["Weekly Indemnity Fees"]),
              netWeeklyLeaseRental: getNum(r["Net Weekly Lease Rental"]),
              performanceDay: getNum(r["Performance Day"]),
              uberTrips: getNum(r["Uber Trips"]),
              totalEarning: getNum(r["Total Earning"]),
              uberCashCollection: getNum(r["Uber Cash Collection"]),
              toll: getNum(r["Toll_1"] !== undefined ? r["Toll_1"] : r["Toll"]),
              driverSubscriptionCharge: getNum(r["Driver subscription charge"]),
              uberIncentive: getNum(r["Uber Incentive"]),
              uberWeekOs: getNum(r["Uber Week O/s"]),
              olaWeekOs: getNum(r["OLA Week O/s"]), // New Column
              vehicleLevelAdjustment: getNum(r["Vehicle Level Adjustment"]),
              tds: getNum(r["TDS"]),
              challan: getNum(r["Challan"]),
              accident: getNum(r["Accident"]),
              deadMile: getNum(r["DeadMile"]),
              currentOs: getNum(r["Current O/S"]),
          }));

          if (rows.length === 0) {
              setErrors(["No valid vehicle data found."]);
              setProcessingSummary(false);
              return;
          }

          // --- VALIDATION 2: PENALTY CHECK (SOFT) ---
          const penaltyRows = rows.filter(r => r.tds > 0 || r.challan > 0 || r.accident > 0 || r.deadMile > 0);
          if (penaltyRows.length > 0) {
              const reasons = [];
              if (rows.some(r => r.tds > 0)) reasons.push("TDS");
              if (rows.some(r => r.challan > 0)) reasons.push("Challan");
              if (rows.some(r => r.accident > 0)) reasons.push("Accident");
              if (rows.some(r => r.deadMile > 0)) reasons.push("DeadMile");
              
              setPopupMessage(`Warning: The following sections have values greater than zero: ${reasons.join(', ')}.`);
              setPopupType('PENALTY');
              setPendingData(rows);
              setProcessingSummary(false);
              return; // Pause for user input
          }

          // If no penalties, proceed to next validations directly
          continueValidations(rows);
      };
      reader.readAsBinaryString(currentWeekFile);
  };

  const handlePenaltyAction = (allow: boolean) => {
      setPopupType('NONE');
      if (allow && pendingData) {
          continueValidations(pendingData);
      } else {
          setErrors(["Import rejected by user due to penalties."]);
          setPendingData(null);
      }
  };

  const continueValidations = (rows: CompanySummaryRow[]) => {
      const newErrors: string[] = [];
      
      // --- VALIDATION 3: EXISTING RECORD (SOFT) ---
      const week = getCurrentWeekRange();
      const existing = summaries.find(s => s.startDate === week.start);
      
      if (popupType !== 'OVERRIDE') {
          if (existing) {
              setPopupMessage("A settlement already exists for this company and week range. Do you want to override it?");
              setPopupType('OVERRIDE');
              setPendingData(rows);
              return; // Pause
          }
      }

      rows.forEach(row => {
          // --- VALIDATION 4: NET LEASE FORMULA (HARD) ---
          // Formula: (Daily Rent * Days) + Indemnity
          const expectedNet = (row.dailyRentApplied * row.onroadDays) + row.weeklyIndemnityFees;
          if (Math.abs(expectedNet - row.netWeeklyLeaseRental) > 2) {
              newErrors.push(`Net Lease Calculation Error for ${row.vehicleNumber}:
                Formula: (${row.dailyRentApplied} * ${row.onroadDays}) + ${row.weeklyIndemnityFees}
                Expected: ${expectedNet}, Found: ${row.netWeeklyLeaseRental}`);
          }
          
          // --- VALIDATION 5: TRIP SLAB (HARD) ---
          const slab = slabs.find(s => row.uberTrips >= s.minTrips && (s.maxTrips === null || row.uberTrips <= s.maxTrips));
          if (slab && slab.rentAmount !== row.dailyRentApplied) {
               newErrors.push(`Trip Slab Mismatch for ${row.vehicleNumber}:
                 Trips: ${row.uberTrips}, Expected Rent: ${slab.rentAmount}, Found: ${row.dailyRentApplied}`);
          }

          // --- VALIDATION 6: WALLET SETTLEMENT (HARD) ---
          // Updated Formula: -(Total Earning + Cash + Toll + Subscription) = Week O/S
          // Revert to previous logic: -(Sum)
          
          const expectedWeekOs = -(row.totalEarning + row.uberCashCollection + row.toll + row.driverSubscriptionCharge);
          
          if (Math.abs(expectedWeekOs - row.uberWeekOs) > 5) {
              newErrors.push(`Wallet Settlement Wrong for ${row.vehicleNumber}:
                Formula: -(${row.totalEarning} + ${row.uberCashCollection} + ${row.toll} + ${row.driverSubscriptionCharge})
                Expected: ${expectedWeekOs.toFixed(2)}, Found: ${row.uberWeekOs}`);
          }

          // --- VALIDATION 7: CURRENT O/S (HARD) ---
          // Formula: Net Weekly Lease + Uber Week O/s + OLA Week O/s
          const expectedCurrentOs = row.netWeeklyLeaseRental + row.uberWeekOs + (row.olaWeekOs || 0);
          
          if (Math.abs(expectedCurrentOs - row.currentOs) > 5) {
             newErrors.push(`Current O/S Mismatch for ${row.vehicleNumber}:
               Formula: ${row.netWeeklyLeaseRental} (Rent) + ${row.uberWeekOs} (Uber) + ${row.olaWeekOs || 0} (Ola)
               Expected: ${expectedCurrentOs.toFixed(2)}, Found: ${row.currentOs}`);
          }
      });

      if (newErrors.length > 0) {
          setErrors(newErrors);
          setProcessingSummary(false);
          setPendingData(null);
          return;
      }

      finalizeSummarySave(rows);
  };

  const handleOverrideAction = (override: boolean) => {
      setPopupType('NONE');
      if (override && pendingData) {
          runHardValidations(pendingData);
      } else {
          setErrors(["Existing settlement found. User cancelled import."]);
          setPendingData(null);
      }
  };
  
  const runHardValidations = (rows: CompanySummaryRow[]) => {
       const newErrors: string[] = [];
       
       rows.forEach(row => {
          const expectedNet = (row.dailyRentApplied * row.onroadDays) + row.weeklyIndemnityFees;
          if (Math.abs(expectedNet - row.netWeeklyLeaseRental) > 5) 
              newErrors.push(`Net Lease Error ${row.vehicleNumber}: (${row.dailyRentApplied}*${row.onroadDays})+${row.weeklyIndemnityFees} = ${expectedNet} vs ${row.netWeeklyLeaseRental}`);
          
          const slab = slabs.find(s => row.uberTrips >= s.minTrips && (s.maxTrips === null || row.uberTrips <= s.maxTrips));
          if (slab && slab.rentAmount !== row.dailyRentApplied) 
              newErrors.push(`Trip Slab Error ${row.vehicleNumber}: Trips ${row.uberTrips} -> Rent ${slab.rentAmount} vs ${row.dailyRentApplied}`);
          
          // Updated Hard Check to match new formula
          const expectedWeekOs = -(row.totalEarning + row.uberCashCollection + row.toll + row.driverSubscriptionCharge);
          if (Math.abs(expectedWeekOs - row.uberWeekOs) > 5) 
              newErrors.push(`Wallet Settlement Error ${row.vehicleNumber}: -(${row.totalEarning}+${row.uberCashCollection}+${row.toll}+${row.driverSubscriptionCharge}) = ${expectedWeekOs} vs ${row.uberWeekOs}`);
          
          const expectedCurrentOs = row.netWeeklyLeaseRental + row.uberWeekOs + (row.olaWeekOs || 0);
          if (Math.abs(expectedCurrentOs - row.currentOs) > 5) 
              newErrors.push(`Current O/S Error ${row.vehicleNumber}: ${row.netWeeklyLeaseRental} + ${row.uberWeekOs} + ${row.olaWeekOs||0} = ${expectedCurrentOs} vs ${row.currentOs}`);
      });

      if (newErrors.length > 0) {
          setErrors(newErrors);
          setProcessingSummary(false);
          setPendingData(null);
      } else {
          finalizeSummarySave(rows);
      }
  };

  const finalizeSummarySave = async (rows: CompanySummaryRow[]) => {
      const week = getCurrentWeekRange();
      const newSummary: CompanyWeeklySummary = {
          id: crypto.randomUUID(),
          startDate: week.start,
          endDate: week.end,
          fileName: currentWeekFile?.name || 'Unknown',
          importedAt: new Date().toISOString(),
          note: currentWeekNote,
          rows: rows
      };
      
      await storageService.saveCompanySummary(newSummary);
      setProcessingSummary(false);
      setPendingData(null);
      setCurrentWeekFile(null);
      setCurrentWeekNote('');
      loadData();
      alert("Weekly Summary Imported Successfully!");
  };


  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex items-center space-x-4 mb-6">
        <div className="p-3 bg-emerald-900/10 rounded-xl text-emerald-700 shadow-sm border border-emerald-100">
           <Briefcase size={28} />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Company Settlement</h2>
          <p className="text-slate-500 mt-1 font-medium">Manage rental plans and settlement rules.</p>
        </div>
      </div>

      {/* SECTION 1: RENTAL PLAN */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
          <div 
            className={`px-8 py-6 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'hover:bg-slate-50'}`}
            onClick={() => setIsExpanded(!isExpanded)}
          >
             <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg transition-transform duration-300 ${isExpanded ? 'bg-slate-200 rotate-180' : 'bg-slate-100'}`}>
                    <ChevronDown size={20} className="text-slate-600" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">1</span>
                        Rental Plan Configuration
                    </h3>
                </div>
             </div>
             {isExpanded && (
                 <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                     {isManageMode ? (
                        <>
                            <button onClick={handleAddSlab} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl flex items-center gap-2"><Plus size={16} /> Add Slab</button>
                            <button onClick={() => setIsManageMode(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl">Done</button>
                        </>
                     ) : (
                        <button onClick={() => setIsManageMode(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"><Settings size={20} /></button>
                     )}
                 </div>
             )}
          </div>

          {isExpanded && (
              <div className="p-0 animate-fade-in">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                       <thead className="bg-white text-xs uppercase font-bold text-slate-500 border-b border-slate-100">
                          <tr>
                             <th className="px-8 py-4 w-1/2 pl-24">Trip Range</th>
                             <th className="px-8 py-4 w-1/2">Rental Amount (₹)</th>
                             {isManageMode && <th className="px-8 py-4 text-right w-32">Actions</th>}
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {slabs.map((slab) => {
                            const isEditing = editingSlabId === slab.id;
                            return (
                               <tr key={slab.id} className={`transition-colors ${isEditing ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}>
                                  <td className="px-8 py-5 pl-24">
                                     {isEditing ? (
                                        <div className="flex items-center gap-2">
                                           <input type="number" value={tempSlab.minTrips ?? ''} onChange={e => handleInputChange('minTrips', parseInt(e.target.value))} className="w-20 p-2 border rounded-lg text-center font-bold" />
                                           <span className="text-slate-400 font-bold">–</span>
                                           <input type="number" placeholder="∞" value={tempSlab.maxTrips ?? ''} onChange={e => handleInputChange('maxTrips', e.target.value ? parseInt(e.target.value) : null)} className="w-20 p-2 border rounded-lg text-center font-bold" />
                                        </div>
                                     ) : (
                                        <span className="font-bold text-slate-700 text-base">{slab.minTrips} – {slab.maxTrips === null ? '∞' : slab.maxTrips}</span>
                                     )}
                                  </td>
                                  <td className="px-8 py-5">
                                     {isEditing ? (
                                        <div className="relative w-32"><span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span><input type="number" value={tempSlab.rentAmount ?? ''} onChange={e => handleInputChange('rentAmount', parseFloat(e.target.value))} className="w-full pl-6 pr-3 py-2 border rounded-lg font-bold text-slate-800" /></div>
                                     ) : (
                                        <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-4 py-1.5 rounded-lg text-base">₹{slab.rentAmount}</span>
                                     )}
                                  </td>
                                  {isManageMode && (
                                      <td className="px-8 py-5 text-right">
                                         <div className="flex items-center justify-end gap-2">
                                            {isEditing ? (
                                               <><button onClick={saveSlab} className="p-2 bg-indigo-600 text-white rounded-lg"><Save size={16} /></button><button onClick={cancelEditing} className="p-2 bg-white border border-slate-200"><X size={16} /></button></>
                                            ) : (
                                               <><button onClick={() => startEditing(slab)} className="p-2 text-slate-400 hover:text-indigo-600"><Edit3 size={16} /></button><button onClick={() => deleteSlab(slab.id)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button></>
                                            )}
                                         </div>
                                      </td>
                                  )}
                               </tr>
                            );
                         })}
                       </tbody>
                    </table>
                 </div>
              </div>
          )}
      </div>

      {/* SECTION: COMPANY SUMMARY (WEEKLY) */}
      <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
             <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">W</div>
             <h3 className="text-xl font-bold text-slate-800">Company Summary (Weekly)</h3>
          </div>

          {/* Active Week Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden p-8">
              <div className="flex justify-between items-start mb-6">
                  <div>
                      <h4 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                          Current Week Import
                          <span className="bg-indigo-50 text-indigo-600 text-xs px-2 py-1 rounded-md uppercase tracking-wider font-bold">Active</span>
                      </h4>
                      <p className="text-slate-500 mt-1 flex items-center gap-2"><Calendar size={16} /> {getCurrentWeekRange().label}</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-xl p-8 text-center transition-all group bg-slate-50/50 relative">
                      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleSummaryFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <div className="bg-white p-4 rounded-full shadow-sm w-fit mx-auto mb-3 text-indigo-500 group-hover:scale-110 transition-transform">
                          <Upload size={24} />
                      </div>
                      <p className="text-slate-600 font-medium">{currentWeekFile ? currentWeekFile.name : "Upload Weekly Excel"}</p>
                      <p className="text-xs text-slate-400 mt-1">.xlsx, .xls, .csv supported</p>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Note</label>
                          <textarea 
                              value={currentWeekNote}
                              onChange={e => setCurrentWeekNote(e.target.value)}
                              className="w-full mt-2 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-32 bg-slate-50"
                              placeholder="Add notes for this week..."
                          />
                      </div>
                      <button 
                          onClick={processSummaryFile}
                          disabled={!currentWeekFile || processingSummary}
                          className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${!currentWeekFile ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'}`}
                      >
                          {processingSummary ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <CheckCircle size={20} />}
                          Import & Validate
                      </button>
                  </div>
              </div>

              {/* Errors Display */}
              {errors.length > 0 && (
                  <div className="mt-6 bg-rose-50 border border-rose-100 rounded-xl p-4 animate-fade-in">
                      <h5 className="text-rose-700 font-bold flex items-center gap-2 mb-2"><AlertTriangle size={18} /> Validation Errors</h5>
                      <ul className="list-none text-sm text-rose-600 space-y-2">
                          {errors.map((err, i) => (
                              <li key={i} className="bg-white p-3 rounded-lg border border-rose-100 shadow-sm text-xs font-mono whitespace-pre-wrap">
                                 {err}
                              </li>
                          ))}
                      </ul>
                  </div>
              )}
          </div>

          {/* History Section */}
          <div className="mt-12">
              <h4 className="text-lg font-bold text-slate-700 mb-4 px-2">History</h4>
              <div className="space-y-4">
                  {summaries.length === 0 && <p className="text-slate-400 px-2">No history yet.</p>}
                  {summaries.map(s => (
                      <div key={s.id} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow">
                          <div>
                              <div className="flex items-center gap-3 mb-1">
                                  <span className="font-bold text-slate-800">{new Date(s.startDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})} – {new Date(s.endDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}</span>
                                  <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Imported</span>
                              </div>
                              <p className="text-xs text-slate-400 flex items-center gap-2">
                                  <FileText size={12} /> {s.fileName}
                                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                  {new Date(s.importedAt).toLocaleString()}
                              </p>
                              {s.note && <p className="text-sm text-slate-500 mt-2 italic">"{s.note}"</p>}
                          </div>
                          <button 
                            onClick={() => setSelectedSummary(s)}
                            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                          >
                            View / Edit
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* --- VIEW SUMMARY MODAL --- */}
      {selectedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col animate-fade-in">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                           <Eye size={20} className="text-indigo-600"/> Weekly Summary Details
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                           {new Date(selectedSummary.startDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})} – {new Date(selectedSummary.endDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}
                        </p>
                    </div>
                    <button onClick={() => setSelectedSummary(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left whitespace-nowrap">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Vehicle</th>
                                    <th className="px-4 py-3">Onroad</th>
                                    <th className="px-4 py-3">Rent Applied</th>
                                    <th className="px-4 py-3">Indemnity</th>
                                    <th className="px-4 py-3 bg-indigo-50/50 text-indigo-700">Net Lease</th>
                                    <th className="px-4 py-3">Uber Trips</th>
                                    <th className="px-4 py-3">Earnings</th>
                                    <th className="px-4 py-3 text-rose-600">Cash</th>
                                    <th className="px-4 py-3">Toll</th>
                                    <th className="px-4 py-3 text-rose-600">Sub</th>
                                    <th className="px-4 py-3">Incentive</th>
                                    <th className="px-4 py-3 bg-indigo-50/50 text-indigo-700">Wallet O/s</th>
                                    <th className="px-4 py-3">TDS</th>
                                    <th className="px-4 py-3">Challan</th>
                                    <th className="px-4 py-3">Accident</th>
                                    <th className="px-4 py-3 bg-slate-100 font-bold text-slate-900 sticky right-0 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Current O/S</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {selectedSummary.rows.map((row, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{row.vehicleNumber}</td>
                                        <td className="px-4 py-3">{row.onroadDays}</td>
                                        <td className="px-4 py-3">{row.dailyRentApplied}</td>
                                        <td className="px-4 py-3">{row.weeklyIndemnityFees}</td>
                                        <td className="px-4 py-3 font-bold text-indigo-600 bg-indigo-50/10">{row.netWeeklyLeaseRental}</td>
                                        <td className="px-4 py-3">{row.uberTrips}</td>
                                        <td className="px-4 py-3 text-emerald-600">{row.totalEarning}</td>
                                        <td className="px-4 py-3 text-rose-500">{row.uberCashCollection}</td>
                                        <td className="px-4 py-3">{row.toll}</td>
                                        <td className="px-4 py-3 text-rose-500">{row.driverSubscriptionCharge}</td>
                                        <td className="px-4 py-3">{row.uberIncentive}</td>
                                        <td className="px-4 py-3 font-bold text-indigo-600 bg-indigo-50/10">{row.uberWeekOs}</td>
                                        <td className="px-4 py-3">{row.tds || '-'}</td>
                                        <td className="px-4 py-3 text-rose-600 font-bold">{row.challan || '-'}</td>
                                        <td className="px-4 py-3 text-rose-600 font-bold">{row.accident || '-'}</td>
                                        <td className="px-4 py-3 font-bold text-slate-900 bg-slate-50 sticky right-0 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">{row.currentOs}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 border-t-2 border-slate-200 font-bold text-slate-800">
                                <tr>
                                    <td className="px-4 py-3 sticky left-0 bg-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">TOTAL</td>
                                    <td colSpan={3}></td>
                                    <td className="px-4 py-3 text-indigo-800">{selectedSummary.rows.reduce((sum, r) => sum + r.netWeeklyLeaseRental, 0).toFixed(2)}</td>
                                    <td colSpan={6}></td>
                                    <td className="px-4 py-3 text-indigo-800">{selectedSummary.rows.reduce((sum, r) => sum + r.uberWeekOs, 0).toFixed(2)}</td>
                                    <td colSpan={3}></td>
                                    <td className="px-4 py-3 text-slate-900 sticky right-0 bg-slate-100 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        {selectedSummary.rows.reduce((sum, r) => sum + r.currentOs, 0).toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                
                <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50 rounded-b-2xl">
                    <button onClick={() => setSelectedSummary(null)} className="px-6 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-900 font-bold shadow-lg">Close</button>
                </div>
            </div>
        </div>
      )}

      {/* --- POPUPS --- */}
      {popupType === 'PENALTY' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-t-4 border-amber-500">
                  <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><AlertTriangle className="text-amber-500"/> Penalty Warning</h3>
                  <p className="text-slate-600 text-sm mb-6">{popupMessage}</p>
                  <div className="flex gap-3">
                      <button onClick={() => handlePenaltyAction(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50">Reject</button>
                      <button onClick={() => handlePenaltyAction(true)} className="flex-1 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-500/20">Allow</button>
                  </div>
              </div>
          </div>
      )}

      {popupType === 'OVERRIDE' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-t-4 border-indigo-500">
                  <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><AlertTriangle className="text-indigo-500"/> Override Existing?</h3>
                  <p className="text-slate-600 text-sm mb-6">{popupMessage}</p>
                  <div className="flex gap-3">
                      <button onClick={() => handleOverrideAction(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50">Cancel</button>
                      <button onClick={() => handleOverrideAction(true)} className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20">Override</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default CompanySettlementPage;