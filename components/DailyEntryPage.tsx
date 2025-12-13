
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { DailyEntry, Driver, LeaveRecord } from '../types';
import { storageService } from '../services/storageService';
import { Plus, Trash2, Calendar as CalIcon, Filter, Search, Edit2, X, AlertTriangle, FileText, ChevronDown, ChevronUp, Check, AlertOctagon } from 'lucide-react';

// MOVED OUTSIDE: Prevents re-rendering focus loss
const InputField = ({ label, name, type = "text", value, onChange, placeholder, required = false, className = "", readOnly = false }: any) => (
  <div className="flex flex-col gap-1.5">
     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
     <input 
       required={required}
       name={name}
       type={type}
       value={value ?? ''}
       onChange={onChange}
       placeholder={placeholder}
       readOnly={readOnly}
       step="0.01"
       className={`w-full px-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none ${className}`}
     />
  </div>
);

// --- GLOBAL DRIVER FILTER COMPONENT ---
interface DriverFilterProps {
  drivers: string[];
  selected: string;
  onChange: (val: string) => void;
}

const GlobalDriverFilter: React.FC<DriverFilterProps> = ({ drivers, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = drivers.filter(d => d.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={wrapperRef} className="relative min-w-[200px]">
       <div 
         className={`flex items-center justify-between w-full px-3 py-2.5 bg-slate-50 border-0 ring-1 ${selected ? 'ring-indigo-500 bg-indigo-50' : 'ring-slate-200'} rounded-xl cursor-pointer transition-all`}
         onClick={() => setIsOpen(!isOpen)}
       >
          <div className="flex items-center gap-2 overflow-hidden">
             <Search size={14} className={selected ? "text-indigo-500" : "text-slate-400"} />
             <span className={`text-sm truncate ${selected ? 'text-indigo-900 font-bold' : 'text-slate-500 font-medium'}`}>
                {selected || 'Filter by Driver...'}
             </span>
          </div>
          <ChevronDown size={14} className={selected ? "text-indigo-500" : "text-slate-400"}/>
       </div>
       
       {isOpen && (
          <div className="absolute top-full mt-2 left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
             <div className="p-2 border-b border-slate-100 bg-slate-50">
                <input 
                  autoFocus
                  placeholder="Type to search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
             </div>
             <div className="max-h-60 overflow-y-auto p-1">
                <div 
                  className="px-3 py-2 hover:bg-rose-50 text-xs text-rose-500 cursor-pointer font-bold rounded-lg mb-1"
                  onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
                >
                   Clear Selection
                </div>
                {filtered.map(d => (
                   <div 
                     key={d}
                     className={`px-3 py-2 hover:bg-indigo-50 text-xs rounded-lg cursor-pointer flex items-center justify-between ${selected === d ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600'}`}
                     onClick={() => { onChange(d); setIsOpen(false); setSearch(''); }}
                   >
                      {d}
                      {selected === d && <Check size={12} />}
                   </div>
                ))}
                {filtered.length === 0 && <div className="px-3 py-4 text-center text-xs text-slate-400">No matches found</div>}
             </div>
          </div>
       )}
    </div>
  );
};

// --- COLUMN FILTER COMPONENT ---
interface ColumnFilterProps {
  columnKey: keyof DailyEntry; 
  data: DailyEntry[];
  activeFilters: Record<string, string[]>;
  onFilterChange: (key: string, values: string[]) => void;
  label: string;
  alignRight?: boolean;
  formatter?: (val: string) => string; // New Formatter Prop
}

const ColumnFilter: React.FC<ColumnFilterProps> = ({ columnKey, data, activeFilters, onFilterChange, label, alignRight = false, formatter }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set(activeFilters[columnKey] || []));
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Extract unique values from data for this column
  const uniqueValues = useMemo(() => {
    const values = new Set<string>();
    data.forEach(item => {
      // @ts-ignore
      const val = String(item[columnKey] ?? '');
      if (val) values.add(val);
    });
    // Sort logic
    return Array.from(values).sort((a, b) => {
       // Heuristic: If formatter is used (likely date), sort descending
       if (formatter) return b.localeCompare(a); 
       return a.localeCompare(b);
    });
  }, [data, columnKey, formatter]);

  const filteredUniqueValues = uniqueValues.filter(v => {
    // Search against formatted value if formatter exists
    const displayVal = formatter ? formatter(v) : v;
    return displayVal.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Sync internal state when external filters change (e.g. clear all)
  useEffect(() => {
    setSelectedValues(new Set(activeFilters[columnKey] || []));
  }, [activeFilters, columnKey]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleValue = (val: string) => {
    const newSet = new Set(selectedValues);
    if (newSet.has(val)) newSet.delete(val);
    else newSet.add(val);
    setSelectedValues(newSet);
  };

  const handleSelectAll = () => {
    if (selectedValues.size === uniqueValues.length) {
      setSelectedValues(new Set());
    } else {
      setSelectedValues(new Set(uniqueValues));
    }
  };

  const applyFilter = () => {
    onFilterChange(columnKey, Array.from(selectedValues));
    setIsOpen(false);
  };

  const clearFilter = () => {
    setSelectedValues(new Set());
    onFilterChange(columnKey, []);
    setIsOpen(false);
  };

  const isActive = (activeFilters[columnKey]?.length || 0) > 0;

  return (
    <div className={`relative flex items-center gap-2 ${alignRight ? 'justify-end' : 'justify-start'}`} ref={wrapperRef}>
      <span>{label}</span>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 rounded transition-colors ${isActive ? 'text-indigo-600 bg-indigo-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
      >
        <Filter size={14} fill={isActive ? "currentColor" : "none"} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 z-50 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 animate-fade-in flex flex-col overflow-hidden text-left left-0">
           {/* Header / Search */}
           <div className="p-3 border-b border-slate-100 bg-slate-50">
              <input 
                autoFocus
                type="text" 
                placeholder={`Search ${label}...`} 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
           </div>
           
           {/* List */}
           <div className="max-h-48 overflow-y-auto p-2 scrollbar-thin">
              <div 
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer"
                onClick={handleSelectAll}
              >
                 <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedValues.size === uniqueValues.length ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                    {selectedValues.size === uniqueValues.length && <Check size={10} className="text-white" />}
                 </div>
                 <span className="text-xs font-bold text-slate-700">Select All</span>
              </div>
              
              <div className="h-px bg-slate-100 my-1"></div>

              {filteredUniqueValues.length === 0 ? (
                 <p className="text-xs text-slate-400 text-center py-2">No matches</p>
              ) : (
                 filteredUniqueValues.map(val => {
                   const isSelected = selectedValues.has(val);
                   const displayVal = formatter ? formatter(val) : val;
                   return (
                     <div 
                        key={val} 
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer"
                        onClick={() => toggleValue(val)}
                     >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                           {isSelected && <Check size={10} className="text-white" />}
                        </div>
                        <span className="text-xs text-slate-600 truncate" title={displayVal}>{displayVal}</span>
                     </div>
                   );
                 })
              )}
           </div>

           {/* Footer Actions */}
           <div className="p-3 border-t border-slate-100 flex justify-between gap-2 bg-slate-50">
              <button 
                onClick={clearFilter}
                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Clear
              </button>
              <button 
                onClick={applyFilter}
                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
              >
                Apply
              </button>
           </div>
        </div>
      )}
    </div>
  );
};


const DailyEntryPage: React.FC = () => {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]); // Added Leaves state
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // UI State for optional fields
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // Global Filters
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterDriver, setFilterDriver] = useState(''); // New Global Driver Filter
  
  // Column Filters State
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  // Duplicate Warning State
  const [duplicateWarning, setDuplicateWarning] = useState<{ active: boolean, existingId: string, payload: DailyEntry } | null>(null);

  // Form State
  const initialFormState: Partial<DailyEntry> = {
    date: new Date().toISOString().split('T')[0],
    vehicle: '',
    driver: '',
    shift: 'Day',
    rent: undefined,
    collection: undefined,
    fuel: 0,
    due: 0,
    payout: 0, // New field
    qrCode: '',
    notes: ''
  };
  const [formData, setFormData] = useState<Partial<DailyEntry>>(initialFormState);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [e, d, l] = await Promise.all([
        storageService.getDailyEntries(),
        storageService.getDrivers(),
        storageService.getLeaves() // Fetch leaves
    ]);
    
    setEntries(e.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setDrivers(d.filter(driver => !driver.terminationDate));
    setLeaves(l);
    setLoading(false);
  };

  const enteredDrivers = useMemo(() => {
      const uniqueNames = new Set(entries.map(e => e.driver));
      return Array.from(uniqueNames).sort();
  }, [entries]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name === 'driver') {
        const selectedDriver = drivers.find(d => d.name === value);
        setFormData(prev => ({
            ...prev,
            driver: value,
            vehicle: selectedDriver?.vehicle || prev.vehicle,
            qrCode: selectedDriver?.qrCode || prev.qrCode,
            shift: selectedDriver?.currentShift || prev.shift || 'Day',
            rent: selectedDriver?.defaultRent || undefined // Treat 0 as undefined to show empty field
        }));
    } else {
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value
        }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.driver) return;
    
    // Explicit Validation for Mandatory Numbers
    if (formData.collection === undefined || formData.rent === undefined) {
        alert("Collection and Rent are mandatory fields.");
        return;
    }

    // Check for duplicate entry on same day
    const duplicateEntry = entries.find(entry => 
      entry.date === formData.date && 
      entry.driver === formData.driver && 
      entry.id !== editingId
    );

    const dateObj = new Date(formData.date);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    // Use existing ID if editing, otherwise generate new one (but will be overridden if duplicate exists)
    const newEntry: DailyEntry = {
      id: formData.id || crypto.randomUUID(),
      date: formData.date,
      day: dayName,
      vehicle: formData.vehicle || 'Unknown',
      driver: formData.driver || 'Unknown',
      shift: formData.shift || 'Day',
      rent: Number(formData.rent),
      collection: Number(formData.collection),
      fuel: Number(formData.fuel || 0),
      due: Number(formData.due || 0),
      payout: Number(formData.payout || 0), 
      qrCode: formData.qrCode,
      notes: formData.notes
    };

    if (duplicateEntry) {
      setDuplicateWarning({
        active: true,
        existingId: duplicateEntry.id,
        payload: newEntry
      });
      return;
    }

    await storageService.saveDailyEntry(newEntry);
    
    if (editingId) {
      resetForm(); 
    } else {
      resetFormAfterSave(formData.date);
    }
    loadData();
  };

  const handleOverrideConfirm = async () => {
    if (!duplicateWarning) return;

    // If we are overriding, we are essentially updating the *existing* duplicate entry
    // with the values from our form.
    const entryToSave = {
        ...duplicateWarning.payload,
        id: duplicateWarning.existingId // Force ID to match existing
    };

    // Edge case: If we were "Editing" a different entry (Entry A) and changed its date/driver
    // to clash with Entry B, and chose to Override, we are essentially merging A into B.
    // So we should delete A to avoid duplicates, and update B.
    if (editingId && editingId !== duplicateWarning.existingId) {
       await storageService.deleteDailyEntry(editingId);
    }

    await storageService.saveDailyEntry(entryToSave);
    setDuplicateWarning(null);
    
    if (editingId) {
        resetForm();
    } else {
        resetFormAfterSave(entryToSave.date);
    }
    loadData();
  };

  const resetFormAfterSave = (preserveDate: string) => {
    setFormData({
      ...initialFormState,
      date: preserveDate,
    });
    setEditingId(null);
    setShowOptionalFields(false);
  };

  const handleEdit = (entry: DailyEntry) => {
    setFormData(entry);
    setEditingId(entry.id);
    if ((entry.fuel && entry.fuel !== 0) || (entry.due && entry.due !== 0) || (entry.payout && entry.payout !== 0)) {
        setShowOptionalFields(true);
    } else {
        setShowOptionalFields(false);
    }
    setIsFormOpen(true); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingId(null);
    setShowOptionalFields(false);
    setIsFormOpen(false); 
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      await storageService.deleteDailyEntry(id);
      loadData();
    }
  };

  // Helper to check if driver is on leave for the selected form date
  const isDriverOnLeave = (driverId: string) => {
    if (!formData.date) return false;
    const selectedDate = formData.date;

    return leaves.some(leave => {
        if (leave.driverId !== driverId) return false;
        
        const start = leave.startDate;
        
        if (leave.actualReturnDate) {
            return selectedDate >= start && selectedDate < leave.actualReturnDate;
        } else {
            return selectedDate >= start && selectedDate <= leave.endDate;
        }
    });
  };

  const handleColumnFilterChange = (key: string, values: string[]) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: values
    }));
  };

  // Filter Logic: Global Dates AND Column Specific Filters
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
        // 1. Global Date Range Filter
        const matchStart = filterDateStart === '' || entry.date >= filterDateStart;
        const matchEnd = filterDateEnd === '' || entry.date <= filterDateEnd;
        if (!matchStart || !matchEnd) return false;

        // 2. Global Driver Filter
        if (filterDriver && entry.driver !== filterDriver) return false;

        // 3. Column Specific Filters (OR logic within column, AND logic across columns)
        for (const [key, val] of Object.entries(columnFilters)) {
            const selectedValues = val as string[];
            if (selectedValues.length === 0) continue; // No filter active for this column

            // @ts-ignore
            const entryVal = String(entry[key] ?? '');

            // If entry value is NOT in selected list, exclude it
            if (!selectedValues.includes(entryVal)) {
                return false;
            }
        }

        return true;
    });
  }, [entries, filterDateStart, filterDateEnd, filterDriver, columnFilters]);

  // Determine if any filter is active
  const isAnyFilterActive = filterDateStart !== '' || filterDateEnd !== '' || filterDriver !== '' || Object.values(columnFilters).some((v) => (v as string[]).length > 0);

  const clearAllFilters = () => {
      setFilterDateStart('');
      setFilterDateEnd('');
      setFilterDriver('');
      setColumnFilters({});
  };

  // Strict DD-MM-YYYY formatter
  const formatDate = (dateStr: string) => {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
  };

  return (
    <div className="max-w-[1920px] mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Daily Entries</h2>
          <p className="text-slate-500 mt-1">Record daily collections and expenses.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
        >
          {isFormOpen ? <X size={20} /> : <Plus size={20} />}
          <span>{isFormOpen ? 'Close Form' : 'New Entry'}</span>
        </button>
      </div>

      {/* Entry Form */}
      <div className={`${isFormOpen ? 'block' : 'hidden'} bg-white p-8 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 animate-fade-in`}>
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
           <div>
             <h3 className="text-xl font-bold text-slate-800">
               {editingId ? 'Edit Daily Record' : 'Add New Daily Record'}
             </h3>
             <p className="text-sm text-slate-400 mt-1">Fill in the details below. Most fields auto-fill based on driver selection.</p>
           </div>
           {editingId && (
             <span className="text-xs px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full font-bold uppercase tracking-wider">Editing Mode</span>
           )}
        </div>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <InputField label="Date" name="date" type="date" value={formData.date} onChange={handleInputChange} required />
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Driver Name</label>
            <div className="relative">
              <select required name="driver" value={formData.driver} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none appearance-none cursor-pointer">
                  <option value="">-- Select Driver --</option>
                  {drivers.map(d => {
                      const onLeave = isDriverOnLeave(d.id);
                      if (onLeave && formData.driver !== d.name) return null;
                      return (
                        <option key={d.id} value={d.name}>
                            {d.name} {onLeave ? '(On Leave)' : ''}
                        </option>
                      );
                  })}
              </select>
              <ChevronDown className="absolute right-4 top-3 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
          
          <InputField label="Vehicle" name="vehicle" value={formData.vehicle} onChange={handleInputChange} className="bg-slate-100 text-slate-500" />
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Shift</label>
            <div className="relative">
              <select name="shift" value={formData.shift} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none appearance-none cursor-pointer">
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
              <ChevronDown className="absolute right-4 top-3 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
          
          <div className="lg:col-span-4 h-px bg-slate-100 my-2"></div>

          {/* Primary Financials */}
          <InputField label="Collection (₹)" name="collection" type="number" value={formData.collection} onChange={handleInputChange} required className="font-bold text-emerald-700 text-lg" placeholder="Enter Amount" />
          
          <div className="relative">
             <InputField label="Rent (₹)" name="rent" type="number" value={formData.rent} onChange={handleInputChange} required placeholder="Enter Rent" />
             <p className="absolute -bottom-5 left-1 text-[10px] text-slate-400 font-medium">Auto-filled if default set</p>
          </div>
          
          <div className="lg:col-span-2">
             <InputField label="QR Code" name="qrCode" value={formData.qrCode} onChange={handleInputChange} className="bg-slate-100 text-slate-500" />
          </div>

          {/* Optional Toggle */}
          <div className="lg:col-span-4 flex justify-start pt-4">
             <button 
               type="button" 
               onClick={() => setShowOptionalFields(!showOptionalFields)}
               className="text-sm font-medium text-indigo-600 flex items-center gap-1.5 hover:text-indigo-800 transition-colors focus:outline-none bg-indigo-50 px-3 py-1.5 rounded-lg"
             >
               {showOptionalFields ? <ChevronUp size={16}/> : <ChevronDown size={16} />}
               <span>{showOptionalFields ? 'Hide' : 'Add'} Fuel, Due & Payout</span>
             </button>
          </div>

          {/* Optional Fields (Fuel / Due / Payout) */}
          {showOptionalFields && (
            <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100 animate-fade-in">
              <InputField label="Fuel Given (₹)" name="fuel" type="number" value={formData.fuel === 0 ? '' : formData.fuel} onChange={handleInputChange} className="border-amber-200 focus:ring-amber-500 text-amber-700" placeholder="0" />
              <div className="lg:col-span-1">
                 <InputField label="Due (+/-)" name="due" type="number" value={formData.due === 0 ? '' : formData.due} onChange={handleInputChange} placeholder="0" />
                 <p className="text-[10px] text-slate-400 mt-1 ml-1">+ Driver Owes / - You Owe</p>
              </div>
              <div className="lg:col-span-1">
                 <InputField label="Payout (Paid to Driver)" name="payout" type="number" value={formData.payout === 0 ? '' : formData.payout} onChange={handleInputChange} className="border-emerald-200 focus:ring-emerald-500 text-emerald-700" placeholder="0" />
              </div>
              <div className="lg:col-span-1 flex items-center">
                 <p className="text-xs text-slate-400 leading-relaxed">Use these fields for specific adjustments or payments made directly.</p>
              </div>
            </div>
          )}

          <div className="lg:col-span-4 mt-2">
             <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">Notes</label>
             <textarea name="notes" placeholder="Optional notes for this entry..." value={formData.notes || ''} onChange={handleInputChange} className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none h-24" />
          </div>

          <div className="lg:col-span-4 flex justify-end gap-3 mt-6 pt-6 border-t border-slate-100">
            <button type="button" onClick={resetForm} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
              {editingId ? 'Update Record' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>

      {/* DUPLICATE WARNING MODAL */}
      {duplicateWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden ring-4 ring-amber-50">
                  <div className="bg-amber-50 p-6 border-b border-amber-100 flex items-center gap-3">
                      <div className="bg-white p-2 rounded-full text-amber-500 shadow-sm"><AlertOctagon size={28} /></div>
                      <div>
                          <h3 className="font-bold text-amber-900 text-lg">Duplicate Entry</h3>
                      </div>
                  </div>
                  <div className="p-6">
                      <p className="text-slate-600 font-medium leading-relaxed mb-4">
                          Driver <strong>{duplicateWarning.payload.driver}</strong> already has a record for <strong>{duplicateWarning.payload.date.split('-').reverse().join('-')}</strong>.
                      </p>
                      <div className="flex gap-3">
                          <button 
                            onClick={() => setDuplicateWarning(null)}
                            className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={handleOverrideConfirm}
                            className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-colors"
                          >
                              Override
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Global Filter Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-5 items-center justify-between">
        <div className="flex items-center gap-3 text-slate-500">
          <Filter size={18} />
          <span className="text-sm font-semibold uppercase tracking-wide">Data View</span>
          {isAnyFilterActive && (
             <button onClick={clearAllFilters} className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-lg hover:bg-rose-100 transition-colors">
                Reset All Filters
             </button>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
             <GlobalDriverFilter drivers={enteredDrivers} selected={filterDriver} onChange={setFilterDriver} />
             
             <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

             <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase mr-2">Global Date Range</span>
                <input 
                  type="date" 
                  value={filterDateStart} 
                  onChange={e => setFilterDateStart(e.target.value)} 
                  className="bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-slate-300">-</span>
                <input 
                  type="date" 
                  value={filterDateEnd} 
                  onChange={e => setFilterDateEnd(e.target.value)} 
                  className="bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                />
             </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider min-w-[120px]">
                    <ColumnFilter columnKey="date" label="Date" data={entries} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} formatter={formatDate} />
                </th>
                <th className="px-6 py-4 font-semibold tracking-wider min-w-[180px]">
                    <div className="flex items-center gap-1">
                        <span>Driver /</span>
                        <ColumnFilter columnKey="qrCode" label="QR" data={entries} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} />
                    </div>
                </th>
                <th className="px-6 py-4 font-semibold tracking-wider min-w-[140px]">
                    <ColumnFilter columnKey="vehicle" label="Vehicle" data={entries} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} />
                </th>
                <th className="px-6 py-4 font-semibold tracking-wider min-w-[100px]">
                    <ColumnFilter columnKey="shift" label="Shift" data={entries} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} />
                </th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider min-w-[100px]">
                    <ColumnFilter columnKey="rent" label="Rent" data={entries} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} alignRight />
                </th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider min-w-[120px]">
                    <ColumnFilter columnKey="collection" label="Collection" data={entries} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} alignRight />
                </th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider min-w-[100px]">
                    <ColumnFilter columnKey="fuel" label="Fuel" data={entries} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} alignRight />
                </th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider min-w-[100px]">
                    <ColumnFilter columnKey="due" label="Due" data={entries} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} alignRight />
                </th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider min-w-[100px]">
                    <ColumnFilter columnKey="payout" label="Payout" data={entries} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} alignRight />
                </th>
                <th className="px-6 py-4 font-semibold text-left tracking-wider min-w-[150px]">
                    <ColumnFilter columnKey="notes" label="Notes" data={entries} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} />
                </th>
                <th className="px-6 py-4 font-semibold text-center tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={11} className="px-6 py-12 text-center text-slate-400">Loading entries...</td></tr>
              ) : filteredEntries.length === 0 ? (
                <tr><td colSpan={11} className="px-6 py-12 text-center text-slate-400">No entries found matching criteria.</td></tr>
              ) : (
                filteredEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 text-slate-900 whitespace-nowrap font-medium">
                      {formatDate(entry.date)} <span className="text-slate-400 text-xs ml-1 font-normal">({entry.day.substring(0,3)})</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                        {entry.driver}
                        {entry.qrCode && <span className="block text-[10px] text-indigo-500 font-medium uppercase tracking-wider mt-0.5">QR: {entry.qrCode}</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{entry.vehicle}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${entry.shift === 'Day' ? 'bg-amber-100 text-amber-700' : 'bg-slate-800 text-slate-200'}`}>
                        {entry.shift}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600 font-medium">₹{entry.rent}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">+₹{entry.collection}</td>
                    <td className="px-6 py-4 text-right text-rose-500 font-medium">-₹{entry.fuel}</td>
                    <td className="px-6 py-4 text-right font-bold">
                      <span className={entry.due > 0 ? 'text-emerald-600' : entry.due < 0 ? 'text-rose-600' : 'text-slate-300'}>
                        {entry.due > 0 ? '+' : ''}{entry.due}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-indigo-600 font-medium">{entry.payout ? `₹${entry.payout}` : '-'}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs max-w-[150px] truncate" title={entry.notes}>
                      {entry.notes || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(entry)} 
                          className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(entry.id)} 
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyEntryPage;

