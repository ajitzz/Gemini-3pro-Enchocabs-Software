
import React, { useEffect, useState, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { DailyEntry, Driver, LeaveRecord, WeeklyWallet } from '../types';
import { storageService } from '../services/storageService';
import { useLiveUpdates } from '../lib/useLiveUpdates';
import { isDriverUnavailableOnDate } from '../lib/leaveUtils';
import { Plus, Trash2, Calendar as CalIcon, Filter, Search, Edit2, X, AlertTriangle, FileText, ChevronDown, ChevronUp, Check, AlertOctagon, FileDown } from 'lucide-react';
import { clearDraft, getCompleteness, getTodayISODate, queueEntry, readDraft, readQueuedEntries, saveDraft, validateEntry } from '../lib/mobileAdmin';

// MOVED OUTSIDE: Prevents re-rendering focus loss
const InputField = ({ label, name, type = "text", value, onChange, onKeyDown, placeholder, required = false, className = "", readOnly = false, inputMode, onFocus, inputRef }: any) => (
  <div className="flex flex-col gap-1.5">
     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
     <input 
       required={required}
       name={name}
       type={type}
       inputMode={inputMode || (type === 'number' ? 'decimal' : undefined)}
       value={value ?? ''}
       onChange={onChange}
       onKeyDown={onKeyDown}
       onFocus={onFocus}
       ref={inputRef}
       placeholder={placeholder}
       readOnly={readOnly}
       step="0.01"
       className={`w-full px-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 text-base placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none ${className}`}
     />
  </div>
);

type DisplayDailyEntry = DailyEntry & { adjustmentApplied?: number };

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
                  className="w-full px-2 py-1.5 text-base bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
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
      const val = String((item as any)[columnKey] ?? '');
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
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-base focus:ring-2 focus:ring-indigo-500 outline-none"
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
  const RECENT_DAYS = 60;
  const FALLBACK_LIVE_REFRESH_MS = 60000;
  const normalizeDateValue = (raw?: string | null) => {
    if (!raw) return '';
    const direct = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
    const parsed = new Date(direct);
    if (Number.isNaN(parsed.getTime())) return '';
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const sanitizeEntryDate = (entry: DailyEntry): DailyEntry => ({
    ...entry,
    date: normalizeDateValue(entry.date) || getTodayISODate(),
  });

  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]); // Added Leaves state
  const [weeklyWallets, setWeeklyWallets] = useState<WeeklyWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // UI State for optional fields
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Global Filters
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterDriver, setFilterDriver] = useState(''); // New Global Driver Filter
  
  // Column Filters State
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  // Pagination State
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Duplicate Warning State
  const [duplicateWarning, setDuplicateWarning] = useState<{ active: boolean, existingId: string, payload: DailyEntry } | null>(null);

  // Form State
  const initialFormState: Partial<DailyEntry> = {
    date: getTodayISODate(),
    vehicle: '',
    driver: '',
    shift: 'Day',
    rent: undefined,
    collection: undefined,
    fuel: 0,
    due: 0,
    payout: 0, // New field
    payoutDate: '',
    qrCode: '',
    notes: ''
  };
  const [formData, setFormData] = useState<Partial<DailyEntry>>(initialFormState);
  const liveRefreshTimerRef = useRef<number | null>(null);
  const [quickEntryMode, setQuickEntryMode] = useState(true);
  const [saveAndAddNext, setSaveAndAddNext] = useState(true);
  const [inlineIssues, setInlineIssues] = useState<ReturnType<typeof validateEntry>>([]);
  const [syncState, setSyncState] = useState<'synced' | 'pending' | 'failed' | 'offline'>(() => navigator.onLine ? 'synced' : 'offline');
  const [showRecoveryNotice, setShowRecoveryNotice] = useState(false);
  const [showConfirmSummary, setShowConfirmSummary] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const getISODateDaysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  };

  const recentFromDate = showFullHistory ? '' : getISODateDaysAgo(RECENT_DAYS);

  const sortEntriesByDateDesc = useCallback((records: DailyEntry[]) =>
    [...records].sort((a, b) => b.date.localeCompare(a.date)), []);

  const areEntriesEquivalent = useCallback((a: DailyEntry[], b: DailyEntry[]) => {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i += 1) {
      const left = a[i];
      const right = b[i];

      if (
        left.id !== right.id ||
        left.date !== right.date ||
        left.day !== right.day ||
        left.vehicle !== right.vehicle ||
        left.driver !== right.driver ||
        left.shift !== right.shift ||
        left.collection !== right.collection ||
        left.rent !== right.rent ||
        left.fuel !== right.fuel ||
        left.due !== right.due ||
        left.payout !== right.payout ||
        (left.payoutDate || '') !== (right.payoutDate || '') ||
        (left.qrCode || '') !== (right.qrCode || '') ||
        (left.notes || '') !== (right.notes || '')
      ) {
        return false;
      }
    }

    return true;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const dailyParams = showFullHistory ? undefined : { from: recentFromDate };

    try {
      const bootstrap = await storageService.getDailyEntriesBootstrap(dailyParams);

      setEntries(sortEntriesByDateDesc(bootstrap.entries.map(sanitizeEntryDate)));
      setDrivers(bootstrap.drivers.filter(driver => !driver.terminationDate));
      setLeaves(bootstrap.leaves);
      setWeeklyWallets(bootstrap.weeklyWallets);
      setLoading(false);
    } catch (error) {
      console.warn('Daily bootstrap failed, falling back to parallel requests:', error);

      try {
        const entriesPromise = storageService.getDailyEntries(dailyParams);
        const asyncMetaPromise = Promise.all([
          storageService.getDrivers(),
          storageService.getLeaves(),
          storageService.getWeeklyWallets()
        ]);

        const e = await entriesPromise;
        setEntries(sortEntriesByDateDesc(e.map(sanitizeEntryDate)));
        setLoading(false);

        asyncMetaPromise
          .then(([d, l, w]) => {
            setDrivers(d.filter(driver => !driver.terminationDate));
            setLeaves(l);
            setWeeklyWallets(w);
          })
          .catch((metaError) => {
            console.error('Failed to load secondary daily entry metadata:', metaError);
          });
      } catch (fallbackError) {
        console.error('Failed to load daily entries:', fallbackError);
        setLoading(false);
      }
    }
  }, [showFullHistory, recentFromDate, sortEntriesByDateDesc]);

  const refreshEntriesOnly = useCallback(async () => {
    const dailyParams = showFullHistory ? undefined : { from: recentFromDate };
    const entries = sortEntriesByDateDesc((await storageService.getDailyEntries(dailyParams, { skipMemoryCache: true })).map(sanitizeEntryDate));
    setEntries(prev => {
      if (areEntriesEquivalent(prev, entries)) return prev;
      return entries;
    });
  }, [showFullHistory, recentFromDate, sortEntriesByDateDesc, areEntriesEquivalent]);

  const refreshLiveData = useCallback(async (mode: 'entries-only' | 'full' = 'entries-only') => {
    if (document.visibilityState !== 'visible') return;

    try {
      if (mode === 'entries-only') {
        await refreshEntriesOnly();
        return;
      }

      const dailyParams = showFullHistory ? undefined : { from: recentFromDate };
      const bootstrap = await storageService.getDailyEntriesBootstrap(dailyParams, { skipMemoryCache: true });
      const nextEntries = sortEntriesByDateDesc(bootstrap.entries.map(sanitizeEntryDate));
      setEntries(prev => {
        if (areEntriesEquivalent(prev, nextEntries)) return prev;
        return nextEntries;
      });
      setDrivers(bootstrap.drivers.filter(driver => !driver.terminationDate));
      setLeaves(bootstrap.leaves);
      setWeeklyWallets(bootstrap.weeklyWallets);
    } catch (error) {
      console.warn('Live refresh skipped due to transient failure:', error);
    }
  }, [refreshEntriesOnly, showFullHistory, recentFromDate, sortEntriesByDateDesc, areEntriesEquivalent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const savedDraft = readDraft();
    if (savedDraft?.driver || savedDraft?.collection || savedDraft?.rent) {
      setFormData(prev => ({ ...prev, ...savedDraft }));
      setIsFormOpen(true);
      setShowRecoveryNotice(true);
    }
  }, []);

  useEffect(() => {
    if (!isFormOpen) return;
    saveDraft(formData);
  }, [formData, isFormOpen]);

  useEffect(() => {
    if (!isFormOpen || !quickEntryMode) return;
    const timer = window.setTimeout(() => firstInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [isFormOpen, quickEntryMode]);

  const flushQueuedEntries = useCallback(async () => {
    if (!navigator.onLine) return;
    const queued = readQueuedEntries();
    if (!queued.length) {
      setSyncState('synced');
      return;
    }
    setSyncState('pending');
    try {
      for (const queuedEntry of queued) {
        await storageService.saveDailyEntry(queuedEntry);
      }
      localStorage.removeItem('daily_entry_mobile_queue_v1');
      setSyncState('synced');
      refreshEntriesOnly();
    } catch (error) {
      console.warn('Sync queue failed:', error);
      setSyncState('failed');
    }
  }, [refreshEntriesOnly]);

  useEffect(() => {
    const onOnline = () => {
      setSyncState('pending');
      flushQueuedEntries();
    };
    const onOffline = () => setSyncState('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    flushQueuedEntries();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flushQueuedEntries]);

  const { connected: liveUpdatesConnected } = useLiveUpdates((event) => {
    const type = event?.type;
    if (!type || !['daily_entries_changed', 'weekly_wallets_changed', 'drivers_changed', 'leaves_changed'].includes(type)) {
      return;
    }

    if (liveRefreshTimerRef.current !== null) {
      window.clearTimeout(liveRefreshTimerRef.current);
    }

    liveRefreshTimerRef.current = window.setTimeout(() => {
      const refreshMode = type === 'daily_entries_changed' ? 'entries-only' : 'full';
      refreshLiveData(refreshMode);
      liveRefreshTimerRef.current = null;
    }, 250);
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!liveUpdatesConnected) {
        refreshLiveData('entries-only');
      }
    }, FALLBACK_LIVE_REFRESH_MS);

    const onFocus = () => refreshLiveData('entries-only');
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshLiveData('entries-only');
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      if (liveRefreshTimerRef.current !== null) {
        window.clearTimeout(liveRefreshTimerRef.current);
        liveRefreshTimerRef.current = null;
      }
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [liveUpdatesConnected, refreshLiveData]);

  const upsertEntry = (entry: DailyEntry) => {
    setEntries(prev => {
      const next = prev.filter(item => item.id !== entry.id);
      if (!showFullHistory && recentFromDate && entry.date < recentFromDate) {
        return next;
      }
      return sortEntriesByDateDesc([entry, ...next]);
    });
  };

  const entriesWithAdjustments = useMemo<DisplayDailyEntry[]>(() => {
      if (!weeklyWallets.length) return entries as DisplayDailyEntry[];

      const mapped = entries.map(entry => ({ ...entry })) as DisplayDailyEntry[];

      weeklyWallets.forEach(wallet => {
          const adjustment = Math.max(0, wallet.adjustments || 0);
          if (!adjustment) return;

          const candidates = mapped.filter(e =>
              e.driver === wallet.driver &&
              e.date >= wallet.weekStartDate &&
              e.date <= wallet.weekEndDate
          );

          if (candidates.length === 0) return;

          const targetDate = wallet.weekEndDate;
          let targetIndex = mapped.findIndex(e =>
              e.driver === wallet.driver && e.date === targetDate
          );

          if (targetIndex === -1) {
              const latest = [...candidates].sort((a, b) => b.date.localeCompare(a.date))[0];
              targetIndex = mapped.findIndex(e => e.id === latest.id);
          }

          if (targetIndex === -1) return;

          const target = mapped[targetIndex];
          mapped[targetIndex] = {
              ...target,
              due: (target.due || 0) + adjustment,
              adjustmentApplied: (target.adjustmentApplied || 0) + adjustment
          };
      });

      return mapped;
  }, [entries, weeklyWallets]);

  const enteredDrivers = useMemo(() => {
      const uniqueNames = new Set(entriesWithAdjustments.map(e => e.driver));
      return Array.from(uniqueNames).sort();
  }, [entriesWithAdjustments]);

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
            rent: selectedDriver?.defaultRent // Let undefined flow if no default set
        }));
    } else {
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value
        }));
    }
  };

  const saveEntryPayload = async (newEntry: DailyEntry, normalizedDate: string) => {
    try {
      const savedEntry = await storageService.saveDailyEntry(newEntry);
      setSyncState('synced');
      if (editingId || !saveAndAddNext) {
        resetForm();
      } else {
        resetFormAfterSave(normalizedDate);
      }
      clearDraft();
      upsertEntry({ ...newEntry, ...savedEntry });
    } catch (error: any) {
      console.error('Save daily entry failed:', error);
      if (!navigator.onLine || /network|failed to fetch/i.test(error?.message || '')) {
        queueEntry(newEntry);
        setSyncState('pending');
        upsertEntry(newEntry);
        if (editingId || !saveAndAddNext) {
          resetForm();
        } else {
          resetFormAfterSave(normalizedDate);
        }
        return;
      }
      setSyncState('failed');
      alert(error?.message || 'Failed to save daily entry. Ensure the driver has only one entry per day.');
    }
  };

  const handleSubmit = async (e: React.FormEvent | React.KeyboardEvent) => {
    if (e.type === 'submit' || (e as React.KeyboardEvent).key === 'Enter') {
        e.preventDefault();
        
        const normalizedDate = normalizeDateValue(formData.date);
        const issues = validateEntry({ ...formData, date: normalizedDate || formData.date }, entries);
        setInlineIssues(issues);
        if (issues.some(issue => issue.severity === 'error')) return;

        // Check for duplicate entry on same day
        const duplicateEntry = entries.find(entry => 
          entry.date === normalizedDate && 
          entry.driver === formData.driver && 
          entry.id !== editingId
        );

        const dateObj = new Date(normalizedDate);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

        // Use existing ID if editing, otherwise generate new one (but will be overridden if duplicate exists)
        const newEntry: DailyEntry = {
          id: formData.id || crypto.randomUUID(),
          date: normalizedDate,
          day: dayName,
          vehicle: formData.vehicle || 'Unknown',
          driver: formData.driver || 'Unknown',
          shift: formData.shift || 'Day',
          rent: Number(formData.rent),
          collection: Number(formData.collection),
          fuel: Number(formData.fuel || 0),
          due: Number(formData.due || 0),
          payout: Number(formData.payout || 0),
          payoutDate: formData.payoutDate || undefined,
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

        if (quickEntryMode && !editingId && (Number(newEntry.collection) > 0 || Number(newEntry.rent) > 0)) {
          setShowConfirmSummary(true);
          setFormData(newEntry);
          return;
        }

        await saveEntryPayload(newEntry, normalizedDate);
    }
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
       setEntries(prev => prev.filter(entry => entry.id !== editingId));
    }

    try {
      const savedEntry = await storageService.saveDailyEntry(entryToSave);
      upsertEntry({ ...entryToSave, ...savedEntry });
    } catch (error: any) {
      console.error('Duplicate override failed:', error);
      alert(error?.message || 'Unable to override the existing entry.');
      return;
    }
    setDuplicateWarning(null);
    
    if (editingId) {
        resetForm();
    } else {
        resetFormAfterSave(entryToSave.date);
    }
  };

  const handleConfirmAndSave = async () => {
    const normalizedDate = normalizeDateValue(formData.date);
    if (!normalizedDate) return;
    const dayName = new Date(normalizedDate).toLocaleDateString('en-US', { weekday: 'long' });
    const payload: DailyEntry = {
      id: formData.id || crypto.randomUUID(),
      date: normalizedDate,
      day: dayName,
      vehicle: formData.vehicle || 'Unknown',
      driver: formData.driver || 'Unknown',
      shift: formData.shift || 'Day',
      rent: Number(formData.rent),
      collection: Number(formData.collection),
      fuel: Number(formData.fuel || 0),
      due: Number(formData.due || 0),
      payout: Number(formData.payout || 0),
      payoutDate: formData.payoutDate || undefined,
      qrCode: formData.qrCode,
      notes: formData.notes
    };
    setShowConfirmSummary(false);
    await saveEntryPayload(payload, normalizedDate);
  };

  const resetFormAfterSave = (preserveDate: string) => {
    setFormData({
      ...initialFormState,
      date: normalizeDateValue(preserveDate) || getTodayISODate(),
    });
    setEditingId(null);
    setShowOptionalFields(false);
  };

  const handleEdit = (entry: DailyEntry) => {
    setFormData({
      ...initialFormState,
      ...entry,
      date: normalizeDateValue(entry.date) || getTodayISODate(),
      payoutDate: normalizeDateValue(entry.payoutDate) || '',
    });
    setEditingId(entry.id);
    if ((entry.fuel && entry.fuel !== 0) || (entry.due && entry.due !== 0) || (entry.payout && entry.payout !== 0) || entry.payoutDate) {
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
    setInlineIssues([]);
    clearDraft();
    setIsFormOpen(false); 
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
        await storageService.deleteDailyEntry(id);
        setEntries(prev => prev.filter(entry => entry.id !== id));
      } catch (error: any) {
        console.error('Delete daily entry failed:', error);
        alert(error?.message || 'Failed to delete the entry. Please try again.');
      }
    }
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

  const getWeekStartDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const day = date.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      date.setDate(date.getDate() - diffToMonday);
      return date;
  };

  const getWeekRangeForDate = (dateStr: string) => {
      const start = getWeekStartDate(dateStr);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const startISO = start.toISOString().split('T')[0];
      const endISO = end.toISOString().split('T')[0];
      return { start: startISO, end: endISO };
  };

  // Helper to check if driver is on leave for the selected form date
  const isDriverOnLeave = (driverId: string) => {
    if (!formData.date) return false;
    const selectedDate = formData.date;
    return leaves.some((leave) => leave.driverId === driverId && isDriverUnavailableOnDate(leave, selectedDate));
  };

  const existingDriversForDate = useMemo(() => {
    if (!formData.date) return new Set<string>();
    return new Set(
      entries
        .filter(entry => entry.date === formData.date && entry.id !== editingId)
        .map(entry => entry.driver)
    );
  }, [entries, formData.date, editingId]);

  const missingDailyDriversForDate = useMemo(() => {
    if (!formData.date) return [] as Driver[];
    return drivers
      .filter(driver => !existingDriversForDate.has(driver.name))
      .filter(driver => !isDriverOnLeave(driver.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [drivers, existingDriversForDate, formData.date, leaves]);

  const missingWeeklyWalletsForWeek = useMemo(() => {
    if (!formData.date) return [] as { driver: string; weekStart: string; weekEnd: string }[];
    const { start, end } = getWeekRangeForDate(formData.date);
    const driversWithEntries = new Set(
      entriesWithAdjustments
        .filter(entry => entry.date >= start && entry.date <= end)
        .map(entry => entry.driver)
    );
    const driversWithWallets = new Set(
      weeklyWallets
        .filter(wallet => wallet.weekStartDate === start && wallet.weekEndDate === end)
        .map(wallet => wallet.driver)
    );
    return Array.from(driversWithEntries)
      .filter(driverName => !driversWithWallets.has(driverName))
      .sort((a, b) => a.localeCompare(b))
      .map(driver => ({ driver, weekStart: start, weekEnd: end }));
  }, [entriesWithAdjustments, weeklyWallets, formData.date]);

  const availableDrivers = useMemo(() => {
    return drivers.filter(driver => {
      const isSelected = formData.driver === driver.name;
      const alreadyEntered = formData.date ? existingDriversForDate.has(driver.name) : false;
      const onLeave = isDriverOnLeave(driver.id);

      if (alreadyEntered && !isSelected) return false;
      if (onLeave && !isSelected) return false;
      return true;
    });
  }, [drivers, existingDriversForDate, formData.date, formData.driver, leaves]);

  useEffect(() => {
    if (!quickEntryMode || editingId) return;
    const lastEntry = entries.find(entry => entry.driver === formData.driver) || entries[0];
    if (!lastEntry) return;
    setFormData(prev => ({
      ...prev,
      date: prev.date || getTodayISODate(),
      shift: prev.shift || lastEntry.shift || 'Day',
      rent: prev.rent ?? lastEntry.rent,
      fuel: prev.fuel ?? 0,
      due: prev.due ?? 0,
      payout: prev.payout ?? 0,
      vehicle: prev.vehicle || lastEntry.vehicle || '',
      qrCode: prev.qrCode || lastEntry.qrCode || '',
    }));
  }, [quickEntryMode, editingId, entries, formData.driver]);

  const handleColumnFilterChange = (key: string, values: string[]) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: values
    }));
  };

  const downloadCSV = (headers: string[], rows: (string | number | null | undefined)[][], filename: string) => {
    const csvRows = [headers.join(',')];

    rows.forEach(row => {
      const formatted = row.map((val) => {
        if (val === undefined || val === null) return '';
        const strVal = String(val).replace(/"/g, '""');
        return /[",\n]/.test(strVal) ? `"${strVal}"` : strVal;
      });
      csvRows.push(formatted.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleExportDailyEntries = () => {
    if (filteredEntries.length === 0) {
      alert('No entries available to export.');
      return;
    }

    const headers = ['Date', 'Driver', 'Vehicle', 'Shift', 'Collection', 'Rent', 'Fuel', 'Due', 'Payout', 'Payout Date', 'Notes'];
    const rows = filteredEntries.map(entry => [
      formatDate(entry.date),
      entry.driver,
      entry.vehicle,
      entry.shift,
      entry.collection,
      entry.rent,
      entry.fuel,
      entry.due,
      entry.payout,
      entry.payoutDate ? formatDate(entry.payoutDate) : '',
      entry.notes || ''
    ]);

    const driverLabel = filterDriver ? filterDriver.replace(/\s+/g, '-').toLowerCase() : 'all-drivers';
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(headers, rows, `daily-entries-${driverLabel}-${timestamp}`);
  };

  // Filter Logic: Global Dates AND Column Specific Filters
  const deferredEntriesWithAdjustments = useDeferredValue(entriesWithAdjustments);

  const filteredEntries = useMemo(() => {
    return deferredEntriesWithAdjustments.filter(entry => {
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

            // @ts-expect-error - Dynamic key access
            const entryVal = String(entry[key] ?? '');

            // If entry value is NOT in selected list, exclude it
            if (!selectedValues.includes(entryVal)) {
                return false;
            }
        }

        return true;
    });
  }, [deferredEntriesWithAdjustments, filterDateStart, filterDateEnd, filterDriver, columnFilters]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const paginatedPages = useMemo(() => {
      if (filteredEntries.length === 0) return [] as any[];

      const sorted = [...filteredEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const pages: any[] = [];
      let currentPage: any = null;

      sorted.forEach(entry => {
          const entryDate = new Date(entry.date);
          const entryMonth = entryDate.getMonth();
          const entryYear = entryDate.getFullYear();
          const weekStart = getWeekStartDate(entry.date);
          const weekStartMonth = weekStart.getMonth();
          const weekStartYear = weekStart.getFullYear();

          if (!currentPage) {
              currentPage = {
                  month: entryMonth,
                  year: entryYear,
                  entries: [],
                  startDate: entry.date,
                  endDate: entry.date,
                  hasSpillover: false
              };
          }

          const belongsToCurrentMonth = entryMonth === currentPage.month && entryYear === currentPage.year;
          const continuesCurrentWeek = weekStartMonth === currentPage.month && weekStartYear === currentPage.year;

          if (belongsToCurrentMonth || continuesCurrentWeek) {
              currentPage.entries.push(entry);
              currentPage.endDate = entry.date;
              if (!belongsToCurrentMonth && continuesCurrentWeek) {
                  currentPage.hasSpillover = true;
              }
          } else {
              pages.push({
                  ...currentPage,
                  entries: [...currentPage.entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                  label: `${monthNames[currentPage.month]} ${currentPage.year}${currentPage.hasSpillover ? ' (week overlap)' : ''}`
              });

              currentPage = {
                  month: entryMonth,
                  year: entryYear,
                  entries: [entry],
                  startDate: entry.date,
                  endDate: entry.date,
                  hasSpillover: false
              };
          }
      });

      if (currentPage) {
          pages.push({
              ...currentPage,
              entries: [...currentPage.entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
              label: `${monthNames[currentPage.month]} ${currentPage.year}${currentPage.hasSpillover ? ' (week overlap)' : ''}`
          });
      }

      return pages;
  }, [filteredEntries]);

  useEffect(() => {
      if (paginatedPages.length === 0) {
          setCurrentPageIndex(0);
      } else {
          setCurrentPageIndex(paginatedPages.length - 1);
      }
  }, [paginatedPages.length]);

  const displayedEntries = paginatedPages[currentPageIndex]?.entries || [];
  const currentPageMeta = paginatedPages[currentPageIndex];
  const currentPageLabel = currentPageMeta ? currentPageMeta.label : 'No data';
  const currentPageRange = currentPageMeta ? `${formatDate(currentPageMeta.startDate)} – ${formatDate(currentPageMeta.endDate)}` : '';

  const totals = useMemo(() => {
      const sumField = (key: keyof DailyEntry) =>
          Math.round(
              displayedEntries.reduce(
                  (sum: number, entry: DailyEntry) => sum + Number(entry[key] ?? 0),
                  0
              )
          );

      return {
            rent: sumField('rent'),
          collection: sumField('collection'),
          fuel: sumField('fuel'),
          due: sumField('due'),
          payout: sumField('payout'),
      };
  }, [displayedEntries]);

  const goToPreviousPage = () => {
      setCurrentPageIndex(prev => Math.max(0, prev - 1));
  };

  const goToNextPage = () => {
      setCurrentPageIndex(prev => Math.min(paginatedPages.length - 1, prev + 1));
  };

  // Determine if any filter is active
  const isAnyFilterActive = filterDateStart !== '' || filterDateEnd !== '' || filterDriver !== '' || Object.values(columnFilters).some((v) => (v as string[]).length > 0);

  const clearAllFilters = () => {
      setFilterDateStart('');
      setFilterDateEnd('');
      setFilterDriver('');
      setColumnFilters({});
  };

  const completeness = getCompleteness(formData);
  const warningIssues = inlineIssues.filter(issue => issue.severity === 'warning');

  return (
    <div className="max-w-[1920px] mx-auto space-y-5 md:space-y-8 pb-28 md:pb-20">
      <div className="sticky top-16 md:top-0 z-30 bg-slate-50/95 backdrop-blur border border-slate-100 rounded-2xl p-3 md:p-0 md:border-0 md:bg-transparent md:backdrop-blur-none">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Daily Entries</h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">Quick mobile-first entry with validation guardrails.</p>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={handleExportDailyEntries}
            className="bg-white text-indigo-600 border border-indigo-100 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all hover:border-indigo-200 hover:shadow-md"
          >
            <FileDown size={18} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            {isFormOpen ? <X size={20} /> : <Plus size={20} />}
            <span>{isFormOpen ? 'Close Form' : 'New Entry'}</span>
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setQuickEntryMode(prev => !prev)} className={`px-3 py-2 rounded-full text-xs font-semibold border ${quickEntryMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}>Quick Entry {quickEntryMode ? 'On' : 'Off'}</button>
        <span className="px-3 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600">Completion {completeness.percent}%</span>
        <span className={`px-3 py-2 rounded-full text-xs font-semibold border ${syncState === 'synced' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : syncState === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100' : syncState === 'offline' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>Sync: {syncState}</span>
      </div>
      </div>

      {/* Entry Form */}
      <div className={`${isFormOpen ? 'block' : 'hidden'} bg-white p-4 md:p-8 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 animate-fade-in`}>
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
        
        {showRecoveryNotice && (
          <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold flex items-center justify-between gap-2">
            <span>Recovered unsaved draft from this device.</span>
            <button type="button" onClick={() => { setShowRecoveryNotice(false); clearDraft(); }} className="underline">Discard</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <InputField label="Date" name="date" type="date" value={formData.date} onChange={handleInputChange} required />
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Driver Name</label>
            <div className="relative">
              <select required name="driver" value={formData.driver} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 text-base focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none appearance-none cursor-pointer">
                  <option value="">-- Select Driver --</option>
                  {availableDrivers.map(d => {
                      const onLeave = isDriverOnLeave(d.id);
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
              <select name="shift" value={formData.shift} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 text-base focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none appearance-none cursor-pointer">
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
              <ChevronDown className="absolute right-4 top-3 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>

          <div className="lg:col-span-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex-1">
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Missing Daily Entries</h4>
                <p className="text-[11px] text-slate-500 mb-2">
                  {formData.date ? `Date: ${formatDate(formData.date)}` : 'Select a date to see missing daily entries.'}
                </p>
                {formData.date && missingDailyDriversForDate.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {missingDailyDriversForDate.map(driver => (
                      <li key={driver.id} className="px-3 py-1 bg-white border border-indigo-100 rounded-full text-xs font-semibold text-slate-700">
                        {driver.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">
                    {formData.date ? 'No missing daily entries for this date.' : 'No date selected.'}
                  </p>
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Missing Weekly Wallets</h4>
                <p className="text-[11px] text-slate-500 mb-2">
                  {formData.date ? `Week: ${formatDate(getWeekRangeForDate(formData.date).start)} – ${formatDate(getWeekRangeForDate(formData.date).end)}` : 'Select a date to see missing weekly wallets.'}
                </p>
                {formData.date && missingWeeklyWalletsForWeek.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {missingWeeklyWalletsForWeek.map(item => (
                      <li key={`${item.driver}-${item.weekStart}`} className="flex flex-wrap items-center justify-between gap-2 bg-white border border-indigo-100 rounded-xl px-3 py-2 text-xs text-slate-700">
                        <span className="font-semibold">{item.driver}</span>
                        <span className="text-[11px] text-slate-500">
                          {formatDate(item.weekStart)} – {formatDate(item.weekEnd)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">
                    {formData.date ? 'No missing weekly wallets for this week.' : 'No date selected.'}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-4 h-px bg-slate-100 my-2"></div>

          {/* Primary Financials */}
          <InputField label="Collection (₹)" name="collection" type="number" value={formData.collection} onChange={handleInputChange} onKeyDown={handleSubmit} required className="font-bold text-emerald-700 text-lg" placeholder="Enter Amount" inputRef={firstInputRef} onFocus={(event: React.FocusEvent<HTMLInputElement>) => event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
          
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
            <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100 animate-fade-in">
              <InputField label="Fuel Given (₹)" name="fuel" type="number" value={formData.fuel === 0 ? '' : formData.fuel} onChange={handleInputChange} className="border-amber-200 focus:ring-amber-500 text-amber-700" placeholder="0" />
              <div className="lg:col-span-1">
                 <InputField label="Due (+/-)" name="due" type="number" value={formData.due === 0 ? '' : formData.due} onChange={handleInputChange} placeholder="0" />
                 <p className="text-[10px] text-slate-400 mt-1 ml-1">+ Driver Owes / - You Owe</p>
              </div>
              <div className="lg:col-span-1">
                 <InputField label="Payout (Paid to Driver)" name="payout" type="number" value={formData.payout === 0 ? '' : formData.payout} onChange={handleInputChange} className="border-emerald-200 focus:ring-emerald-500 text-emerald-700" placeholder="0" />
              </div>
              <div className="lg:col-span-1">
                 <InputField label="Payout Date" name="payoutDate" type="date" value={formData.payoutDate} onChange={handleInputChange} required={!!(formData.payout && formData.payout !== 0)} />
                 <p className="text-[10px] text-emerald-600 mt-1 ml-1 font-semibold">Required when payout entered</p>
              </div>
              <div className="lg:col-span-1 flex items-center">
                 <p className="text-xs text-slate-400 leading-relaxed">Use these fields for specific adjustments or payments made directly.</p>
              </div>
            </div>
          )}

          <div className="lg:col-span-4 mt-2">
             <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">Notes</label>
             <textarea name="notes" placeholder="Optional notes for this entry..." value={formData.notes || ''} onChange={handleInputChange} className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-base text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none h-24" />
          </div>

          {inlineIssues.length > 0 && (
            <div className="lg:col-span-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold mb-1">Review before saving:</p>
              <ul className="list-disc ml-4 space-y-1">
                {inlineIssues.map(issue => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}
              </ul>
            </div>
          )}

          <div className="hidden md:flex lg:col-span-4 justify-end gap-3 mt-6 pt-6 border-t border-slate-100">
            <button type="button" onClick={resetForm} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
              {editingId ? 'Update Record' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>

      {showConfirmSummary && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-3">
          <div className="w-full md:max-w-md bg-white rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-slate-900">Confirm Entry</h4>
            <div className="text-sm text-slate-600 space-y-1">
              <p><strong>{formData.driver}</strong> • {formatDate(String(formData.date || ''))}</p>
              <p>Collection: ₹{Number(formData.collection || 0)}</p>
              <p>Rent: ₹{Number(formData.rent || 0)} • Fuel: ₹{Number(formData.fuel || 0)}</p>
              <p>Due: ₹{Number(formData.due || 0)} • Payout: ₹{Number(formData.payout || 0)}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowConfirmSummary(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold">Edit</button>
              <button type="button" onClick={handleConfirmAndSave} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold">Confirm & Save</button>
            </div>
          </div>
        </div>
      )}

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

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setIsFormOpen(prev => !prev)} className="min-h-11 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm">
            {isFormOpen ? 'Hide' : 'Quick Entry'}
          </button>
          <button type="button" onClick={() => setSaveAndAddNext(prev => !prev)} className={`min-h-11 px-3 rounded-xl border text-xs font-semibold ${saveAndAddNext ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200'}`}>
            Save & Add Next
          </button>
          <button type="button" onClick={(event) => { setIsFormOpen(true); handleSubmit(event as any); }} className="min-h-11 flex-1 rounded-xl bg-indigo-600 text-white font-semibold">
            {editingId ? 'Update' : 'Save Entry'}
          </button>
        </div>
        {warningIssues.length > 0 && <p className="mt-2 text-[11px] text-amber-700 font-medium">{warningIssues[0].message}</p>}
      </div>

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
                  className="bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl px-3 py-2.5 text-base text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-slate-300">-</span>
                <input 
                  type="date" 
                  value={filterDateEnd} 
                  onChange={e => setFilterDateEnd(e.target.value)} 
                  className="bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl px-3 py-2.5 text-base text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                />
             </div>

             <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase">History</span>
                <button
                  onClick={() => setShowFullHistory(prev => !prev)}
                  className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  {showFullHistory ? `Show last ${RECENT_DAYS} days` : 'Load full history'}
                </button>
                {!showFullHistory && recentFromDate && (
                  <span className="text-[11px] text-slate-400">Since {formatDate(recentFromDate)}</span>
                )}
             </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Records Window</p>
                <p className="text-sm font-bold text-slate-800">{currentPageLabel}</p>
                {currentPageRange && <p className="text-xs text-slate-400">{currentPageRange}</p>}
                {currentPageMeta?.hasSpillover && (
                    <p className="text-[11px] text-amber-600 font-semibold">Includes next month dates to complete the week.</p>
                )}
            </div>
            <div className="flex items-center gap-2">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPageIndex === 0 || paginatedPages.length === 0}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold disabled:opacity-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                >
                    Prev
                </button>
                <span className="text-xs text-slate-500 font-semibold">
                    Page {paginatedPages.length === 0 ? 0 : currentPageIndex + 1} of {paginatedPages.length}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={paginatedPages.length === 0 || currentPageIndex >= paginatedPages.length - 1}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold disabled:opacity-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                >
                    Next
                </button>
            </div>
        </div>
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider min-w-[120px]">
                    <ColumnFilter columnKey="date" label="Date" data={entriesWithAdjustments} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} formatter={formatDate} />
                </th>
                <th className="px-6 py-4 font-semibold tracking-wider min-w-[180px]">
                    <div className="flex items-center gap-1">
                        <ColumnFilter columnKey="driver" label="Driver" data={entriesWithAdjustments} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} />
                        <span className="text-slate-300">/</span>
                        <ColumnFilter columnKey="qrCode" label="QR" data={entriesWithAdjustments} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} />
                    </div>
                </th>
                <th className="px-6 py-4 font-semibold tracking-wider min-w-[140px]">
                    <ColumnFilter columnKey="vehicle" label="Vehicle" data={entriesWithAdjustments} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} />
                </th>
                <th className="px-6 py-4 font-semibold tracking-wider min-w-[100px]">
                    <ColumnFilter columnKey="shift" label="Shift" data={entriesWithAdjustments} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} />
                </th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider min-w-[100px]">
                    <ColumnFilter columnKey="rent" label="Rent" data={entriesWithAdjustments} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} alignRight />
                </th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider min-w-[120px]">
                    <ColumnFilter columnKey="collection" label="Collection" data={entriesWithAdjustments} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} alignRight />
                </th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider min-w-[100px]">
                    <ColumnFilter columnKey="fuel" label="Fuel" data={entriesWithAdjustments} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} alignRight />
                </th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider min-w-[100px]">
                    <ColumnFilter columnKey="due" label="Due" data={entriesWithAdjustments} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} alignRight />
                </th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider min-w-[100px]">
                    <ColumnFilter columnKey="payout" label="Payout" data={entriesWithAdjustments} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} alignRight />
                </th>
                <th className="px-6 py-4 font-semibold text-left tracking-wider min-w-[150px]">
                    <ColumnFilter columnKey="notes" label="Notes" data={entriesWithAdjustments} activeFilters={columnFilters} onFilterChange={handleColumnFilterChange} />
                </th>
                <th className="px-6 py-4 font-semibold text-center tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={11} className="px-6 py-12 text-center text-slate-400">Loading entries...</td></tr>
              ) : displayedEntries.length === 0 ? (
                <tr><td colSpan={11} className="px-6 py-12 text-center text-slate-400">No entries found matching criteria.</td></tr>
              ) : (
                displayedEntries.map((entry: DisplayDailyEntry) => (
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
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={entry.due > 0 ? 'text-emerald-600' : entry.due < 0 ? 'text-rose-600' : 'text-slate-300'}>
                          {entry.due > 0 ? '+' : ''}{entry.due}
                        </span>
                        {entry.adjustmentApplied ? (
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Adjustment included in due</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-indigo-600 font-medium">
                      {entry.payout ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span>₹{entry.payout}</span>
                          {entry.payoutDate && (
                            <span className="text-[10px] text-slate-400 font-semibold tracking-wide"> {formatDate(entry.payoutDate)}</span>
                          )}
                        </div>
                      ) : '-'}
                    </td>
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
            <tfoot className="bg-slate-50 border-t border-slate-100">
              <tr>
                <td className="px-6 py-4 font-bold text-slate-700" colSpan={4}>Totals</td>
                <td className="px-6 py-4 text-right font-bold text-slate-700">₹{totals.rent}</td>
                <td className="px-6 py-4 text-right font-bold text-slate-700">₹{totals.collection}</td>
                <td className="px-6 py-4 text-right font-bold text-slate-700">₹{totals.fuel}</td>
                <td className="px-6 py-4 text-right font-bold text-slate-700">{totals.due > 0 ? '+' : ''}{totals.due}</td>
                <td className="px-6 py-4 text-right font-bold text-slate-700">₹{totals.payout}</td>
                <td className="px-6 py-4"></td>
                <td className="px-6 py-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyEntryPage;
