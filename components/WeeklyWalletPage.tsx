
import React, { useEffect, useState } from 'react';
import { WeeklyWallet, Driver } from '../types';
import { storageService } from '../services/storageService';
import { Plus, Trash2, Search, Edit2, X, ChevronDown, Wallet, TrendingUp, TrendingDown, Calendar, ArrowRight } from 'lucide-react';

// MOVED OUTSIDE: Prevents re-rendering focus loss
const InputField = ({ label, name, type = "text", value, onChange, placeholder, required = false, className = "", icon: Icon }: any) => (
  <div className="flex flex-col gap-1.5 w-full">
     <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
       {Icon && <Icon size={12} />}
       {label}
     </label>
     <input 
       required={required}
       name={name}
       type={type}
       value={value === 0 ? '' : value}
       onChange={onChange}
       placeholder={placeholder || "0.00"}
       step="0.01"
       className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none ${className}`}
     />
  </div>
);

const WeeklyWalletPage: React.FC = () => {
  const [wallets, setWallets] = useState<WeeklyWallet[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filterDriver, setFilterDriver] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Helper to get Monday of the week for a given date
  const getMonday = (d: Date) => {
    d = new Date(d);
    const day = d.getDay(),
      diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const getWeekRange = (dateStr: string) => {
      if (!dateStr) return { start: '', end: '', label: '' };
      const d = new Date(dateStr);
      const monday = getMonday(d);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
          start: monday.toISOString().split('T')[0],
          end: sunday.toISOString().split('T')[0],
          label: `${monday.toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})} - ${sunday.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}`
      };
  };

  const initialFormState: Partial<WeeklyWallet> = {
    weekStartDate: '', // Explicitly empty
    driver: '',
    earnings: 0,
    refund: 0,
    diff: 0,
    cash: 0,
    charges: 0,
    trips: 0,
    notes: ''
  };

  const [formData, setFormData] = useState<Partial<WeeklyWallet>>(initialFormState);
  // Separate state for the date picker display
  const [selectedDate, setSelectedDate] = useState(''); // Explicitly empty

  useEffect(() => {
    loadData();
    // Removed default date setting
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [w, d] = await Promise.all([
        storageService.getWeeklyWallets(),
        storageService.getDrivers()
    ]);
    setWallets(w.sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime()));
    setDrivers(d.filter(driver => !driver.terminationDate));
    setLoading(false);
  };

  const calculatedWalletWeek = (
    (formData.earnings || 0) + 
    (formData.refund || 0) - 
    ((formData.diff || 0) + (formData.cash || 0) + (formData.charges || 0))
  );

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateVal = e.target.value;
      setSelectedDate(dateVal);
      if (dateVal) {
          const range = getWeekRange(dateVal);
          setFormData(prev => ({ ...prev, weekStartDate: range.start, weekEndDate: range.end }));
      } else {
          setFormData(prev => ({ ...prev, weekStartDate: '', weekEndDate: '' }));
      }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.weekStartDate) {
        alert("Please select a date to determine the week range.");
        return;
    }
    if (!formData.driver) return;

    const range = getWeekRange(selectedDate);
    
    const newWallet: WeeklyWallet = {
      id: formData.id || crypto.randomUUID(),
      weekStartDate: range.start,
      weekEndDate: range.end,
      driver: formData.driver || 'Unknown',
      earnings: Number(formData.earnings),
      refund: Number(formData.refund),
      diff: Number(formData.diff),
      cash: Number(formData.cash),
      charges: Number(formData.charges),
      trips: Number(formData.trips),
      walletWeek: calculatedWalletWeek,
      notes: formData.notes
    };

    await storageService.saveWeeklyWallet(newWallet);
    resetForm();
    loadData();
  };

  const handleEdit = (wallet: WeeklyWallet) => {
    setFormData(wallet);
    setSelectedDate(wallet.weekStartDate); // Set picker to start date
    setEditingId(wallet.id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setSelectedDate('');
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this weekly record?')) {
      await storageService.deleteWeeklyWallet(id);
      loadData();
    }
  };

  const filteredWallets = wallets.filter(w => 
    filterDriver === '' || w.driver.toLowerCase().includes(filterDriver.toLowerCase())
  );
  
  // Format Date Range for Display
  const formatWeekRange = (start: string, end: string) => {
      const s = new Date(start);
      const e = new Date(end);
      return `${s.toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})} - ${e.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Weekly Wallet</h2>
          <p className="text-slate-500 mt-1">Calculate weekly driver payouts and deductions.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
        >
          {isFormOpen ? <X size={20} /> : <Plus size={20} />}
          <span>{isFormOpen ? 'Close Form' : 'Add Weekly Data'}</span>
        </button>
      </div>

      {/* Modern Split Form */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl shadow-xl border border-indigo-100 overflow-hidden ring-4 ring-indigo-50/50">
           {/* Form Header */}
           <div className="bg-slate-50/80 px-8 py-5 border-b border-slate-200 flex justify-between items-center backdrop-blur-sm">
              <div className="flex items-center gap-3">
                 <div className={`p-2 rounded-lg ${editingId ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    <Wallet size={20} />
                 </div>
                 <div>
                    <h3 className="font-bold text-slate-800 text-lg">{editingId ? 'Edit Weekly Record' : 'New Weekly Calculation'}</h3>
                    <p className="text-xs text-slate-500 font-medium">Auto-calculates Wallet Balance</p>
                 </div>
              </div>
              <button onClick={resetForm} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-full transition-all">
                 <X size={20} />
              </button>
           </div>

           <form onSubmit={handleSubmit} className="p-8">
              {/* Context Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 mb-8">
                 <div className="lg:col-span-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">Driver</label>
                    <div className="relative">
                       <select required name="driver" value={formData.driver} onChange={handleInputChange} className="w-full pl-4 pr-10 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer">
                          <option value="">Select Driver...</option>
                          {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                       </select>
                       <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={16} />
                    </div>
                 </div>
                 <div className="lg:col-span-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">Select Date in Week</label>
                    <div className={`relative flex items-center gap-3 p-1 rounded-xl border ${!selectedDate ? 'border-rose-200 bg-rose-50' : 'border-transparent'}`}>
                       <input 
                         type="date" 
                         value={selectedDate} 
                         onChange={handleDateChange} 
                         required 
                         className="flex-1 pl-4 pr-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none" 
                       />
                       <div className="bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 min-w-[140px] text-center">
                          <span className="text-[10px] text-indigo-400 font-bold uppercase block">Week Range</span>
                          <span className="text-xs text-indigo-700 font-bold">{getWeekRange(selectedDate).label || 'Select Date'}</span>
                       </div>
                    </div>
                 </div>
                 <div className="lg:col-span-2">
                    <InputField label="Trips Count" name="trips" type="number" value={formData.trips} onChange={handleInputChange} className="bg-slate-50 border-0 ring-1 ring-slate-200" />
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 relative">
                 {/* Vertical Divider for Desktop */}
                 <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-slate-100 -ml-px"></div>

                 {/* LEFT: Income (Green Theme) */}
                 <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                          <TrendingUp size={16} />
                       </div>
                       <h4 className="font-bold text-slate-700">Earnings & Credits</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <InputField label="Earnings (₹)" name="earnings" type="number" value={formData.earnings} onChange={handleInputChange} className="border-emerald-200 focus:ring-emerald-500 focus:border-emerald-500 text-emerald-900 font-bold" />
                       <InputField label="Refund (₹)" name="refund" type="number" value={formData.refund} onChange={handleInputChange} className="border-emerald-100 focus:ring-emerald-500" />
                    </div>
                 </div>

                 {/* RIGHT: Deductions (Red Theme) */}
                 <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                          <TrendingDown size={16} />
                       </div>
                       <h4 className="font-bold text-slate-700">Deductions</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                       <InputField label="Diff (₹)" name="diff" type="number" value={formData.diff} onChange={handleInputChange} className="border-rose-100 focus:ring-rose-500" />
                       <InputField label="Cash (₹)" name="cash" type="number" value={formData.cash} onChange={handleInputChange} className="border-rose-100 focus:ring-rose-500" />
                       <InputField label="Charges (₹)" name="charges" type="number" value={formData.charges} onChange={handleInputChange} className="border-rose-100 focus:ring-rose-500" />
                    </div>
                 </div>
              </div>

              {/* Calculation & Footer */}
              <div className="mt-10 bg-slate-900 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
                 <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${calculatedWalletWeek < 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                       <Wallet size={24} />
                    </div>
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Calculated Wallet Week</p>
                       <div className="flex items-baseline gap-2">
                          <span className={`text-3xl font-bold ${calculatedWalletWeek < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                             {calculatedWalletWeek < 0 ? '-' : '+'}₹{Math.abs(calculatedWalletWeek).toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-500 font-medium px-2 py-0.5 bg-slate-800 rounded-md">
                             {calculatedWalletWeek < 0 ? 'Driver Owes' : 'Payable to Driver'}
                          </span>
                       </div>
                    </div>
                 </div>

                 <div className="flex gap-3 w-full md:w-auto">
                    <button type="button" onClick={resetForm} className="flex-1 md:flex-none px-6 py-3 text-slate-300 font-bold hover:bg-slate-800 rounded-xl transition-colors">Cancel</button>
                    <button type="submit" className="flex-1 md:flex-none px-8 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-indigo-50 shadow-lg shadow-white/10 transition-all flex items-center justify-center gap-2 active:scale-95">
                       {editingId ? 'Update Record' : 'Save Calculation'} <ArrowRight size={18} />
                    </button>
                 </div>
              </div>
           </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-5 items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Search size={18} />
          <span className="text-sm font-semibold uppercase tracking-wide">Search Records</span>
        </div>
        <div className="w-full md:w-72 relative">
           <input 
             type="text" 
             placeholder="Filter by driver..." 
             value={filterDriver} 
             onChange={e => setFilterDriver(e.target.value)}
             className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
           />
           <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Week Range</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Driver</th>
                <th className="px-6 py-4 font-semibold text-center tracking-wider">Trips</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Earnings</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Refund</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Deductions</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Wallet Week</th>
                <th className="px-6 py-4 font-semibold text-center tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={8} className="p-12 text-center text-slate-400">Loading wallet data...</td></tr>
              ) : filteredWallets.length === 0 ? (
                <tr><td colSpan={8} className="p-12 text-center text-slate-400">No records found.</td></tr>
              ) : (
                filteredWallets.map(w => {
                  const deductions = (w.diff || 0) + (w.cash || 0) + (w.charges || 0);
                  return (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                         <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-slate-400" />
                            {formatWeekRange(w.weekStartDate, w.weekEndDate)}
                         </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">{w.driver}</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-600 bg-slate-50/50">{w.trips || 0}</td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-medium">+₹{w.earnings}</td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-medium">+₹{w.refund}</td>
                      <td className="px-6 py-4 text-right text-rose-500 font-medium">-₹{deductions.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          w.walletWeek < 0 
                            ? 'bg-rose-50 text-rose-700 border-rose-100' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {w.walletWeek < 0 ? '' : '+'}₹{w.walletWeek.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(w)} className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(w.id)} className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WeeklyWalletPage;
