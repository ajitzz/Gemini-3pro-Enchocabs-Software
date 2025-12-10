import React, { useEffect, useState } from 'react';
import { DailyEntry, Driver, LeaveRecord } from '../types';
import { storageService } from '../services/storageService';
import { Plus, Trash2, Calendar as CalIcon, Filter, Search, Edit2, X, AlertTriangle, FileText, ChevronDown, ChevronUp } from 'lucide-react';

// MOVED OUTSIDE: Prevents re-rendering focus loss
const InputField = ({ label, name, type = "text", value, onChange, placeholder, required = false, className = "", readOnly = false }: any) => (
  <div className="flex flex-col gap-1.5">
     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
     <input 
       required={required}
       name={name}
       type={type}
       value={value}
       onChange={onChange}
       placeholder={placeholder}
       readOnly={readOnly}
       step="0.01"
       className={`w-full px-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none ${className}`}
     />
  </div>
);

const DailyEntryPage: React.FC = () => {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]); // Added Leaves state
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // UI State for optional fields
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // Filter State
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterDriver, setFilterDriver] = useState('');

  // Form State
  const initialFormState: Partial<DailyEntry> = {
    date: new Date().toISOString().split('T')[0],
    vehicle: '',
    driver: '',
    shift: 'Day',
    rent: 0,
    collection: 0,
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
            rent: selectedDriver?.defaultRent || prev.rent || 0
        }));
    } else {
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.driver) return;

    const duplicateEntry = entries.find(entry => 
      entry.date === formData.date && 
      entry.driver === formData.driver && 
      entry.id !== editingId
    );

    let finalId = formData.id || crypto.randomUUID();

    if (duplicateEntry) {
      const confirmOverride = window.confirm(
        `Warning:\n\nDriver "${formData.driver}" already has an entry for ${formData.date}.\n\nDo you want to OVERWRITE the existing data?`
      );
      if (!confirmOverride) return;
      
      if (editingId && editingId !== duplicateEntry.id) {
         await storageService.deleteDailyEntry(editingId);
      }
      finalId = duplicateEntry.id;
    }

    const dateObj = new Date(formData.date);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    const newEntry: DailyEntry = {
      id: finalId,
      date: formData.date,
      day: dayName,
      vehicle: formData.vehicle || 'Unknown',
      driver: formData.driver || 'Unknown',
      shift: formData.shift || 'Day',
      rent: Number(formData.rent),
      collection: Number(formData.collection),
      fuel: Number(formData.fuel),
      due: Number(formData.due),
      payout: Number(formData.payout), // New field
      qrCode: formData.qrCode,
      notes: formData.notes
    };

    await storageService.saveDailyEntry(newEntry);
    
    if (editingId) {
      resetForm(); 
    } else {
      resetFormAfterSave(formData.date);
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
        
        // Logic:
        // If Actual Return exists: On Leave if Date >= Start AND Date < ActualReturn
        // If NO Actual Return: On Leave if Date >= Start AND Date <= PlannedEnd
        
        const start = leave.startDate;
        
        if (leave.actualReturnDate) {
            // They are back on actualReturnDate, so they are unavailable strictly BEFORE that date
            return selectedDate >= start && selectedDate < leave.actualReturnDate;
        } else {
            // Still away, unavailable up to planned end (inclusive)
            return selectedDate >= start && selectedDate <= leave.endDate;
        }
    });
  };

  const filteredEntries = entries.filter(entry => {
    const matchDriver = filterDriver === '' || entry.driver.toLowerCase().includes(filterDriver.toLowerCase());
    const matchStart = filterDateStart === '' || entry.date >= filterDateStart;
    const matchEnd = filterDateEnd === '' || entry.date <= filterDateEnd;
    return matchDriver && matchStart && matchEnd;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
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
                      // Only show if available OR if it's the currently selected driver (for editing)
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
          <InputField label="Collection (₹)" name="collection" type="number" value={formData.collection} onChange={handleInputChange} required className="font-bold text-emerald-700 text-lg" />
          
          <div className="relative">
             <InputField label="Rent (₹)" name="rent" type="number" value={formData.rent} onChange={handleInputChange} required />
             <p className="absolute -bottom-5 left-1 text-[10px] text-slate-400 font-medium">Auto-filled default</p>
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
              <InputField label="Fuel Given (₹)" name="fuel" type="number" value={formData.fuel} onChange={handleInputChange} className="border-amber-200 focus:ring-amber-500 text-amber-700" />
              <div className="lg:col-span-1">
                 <InputField label="Due (+/-)" name="due" type="number" value={formData.due} onChange={handleInputChange} />
                 <p className="text-[10px] text-slate-400 mt-1 ml-1">+ Driver Owes / - You Owe</p>
              </div>
              <div className="lg:col-span-1">
                 <InputField label="Payout (Paid to Driver)" name="payout" type="number" value={formData.payout} onChange={handleInputChange} className="border-emerald-200 focus:ring-emerald-500 text-emerald-700" />
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

      {/* Filters */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-5 items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter size={18} />
          <span className="text-sm font-semibold uppercase tracking-wide">Filters</span>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="Search driver..." 
              value={filterDriver} 
              onChange={e => setFilterDriver(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
            />
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          </div>
          <div className="flex items-center gap-2">
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Date</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Driver / QR</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Vehicle</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Shift</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Rent</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Collection</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Fuel</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Due</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Payout</th>
                <th className="px-6 py-4 font-semibold text-left tracking-wider">Notes</th>
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
                      {entry.date} <span className="text-slate-400 text-xs ml-1 font-normal">({entry.day.substring(0,3)})</span>
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