import React, { useEffect, useState } from 'react';
import { Driver, LeaveRecord } from '../types';
import { storageService } from '../services/storageService';
import { Coffee, Trash2, Calendar, ChevronDown } from 'lucide-react';

const LeavePage: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    driverId: '',
    startDate: '',
    endDate: '',
    reason: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [d, l] = await Promise.all([
      storageService.getDrivers(),
      storageService.getLeaves()
    ]);
    setDrivers(d.filter(drv => !drv.terminationDate)); // Only show active drivers
    setLeaves(l.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.driverId || !form.startDate || !form.endDate) return;

    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive

    if (days <= 0) return alert('End date must be after start date');

    const newLeave: LeaveRecord = {
      id: crypto.randomUUID(),
      driverId: form.driverId,
      startDate: form.startDate,
      endDate: form.endDate,
      days: days,
      reason: form.reason
    };

    await storageService.saveLeave(newLeave);
    setForm({ driverId: '', startDate: '', endDate: '', reason: '' });
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this leave record?')) {
      await storageService.deleteLeave(id);
      loadData();
    }
  };

  const getDriverName = (id: string) => drivers.find(d => d.id === id)?.name || 'Unknown Driver';

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center space-x-4 mb-2">
        <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 shadow-sm">
           <Coffee size={24} />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Driver Leaves</h2>
          <p className="text-slate-500 mt-1">Track leaves to automatically adjust deposit refund dates.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-1 bg-white p-8 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 h-fit">
           <h3 className="font-bold text-slate-800 text-lg mb-6 pb-4 border-b border-slate-50">Record New Leave</h3>
           <form onSubmit={handleSave} className="space-y-6">
             <div className="flex flex-col gap-1.5">
               <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Driver</label>
               <div className="relative">
                 <select 
                   required 
                   value={form.driverId} 
                   onChange={e => setForm({...form, driverId: e.target.value})} 
                   className="w-full pl-4 pr-8 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none appearance-none cursor-pointer transition-all"
                 >
                   <option value="">-- Select Driver --</option>
                   {drivers.map(d => (
                     <option key={d.id} value={d.id}>{d.name}</option>
                   ))}
                 </select>
                 <ChevronDown size={16} className="absolute right-4 top-4 text-slate-400 pointer-events-none" />
               </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
               <div className="flex flex-col gap-1.5">
                 <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Start Date</label>
                 <input type="date" required value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all" />
               </div>
               <div className="flex flex-col gap-1.5">
                 <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">End Date</label>
                 <input type="date" required value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all" />
               </div>
             </div>

             <div className="flex flex-col gap-1.5">
               <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Reason (Optional)</label>
               <input value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all" placeholder="Sick, Vacation, etc." />
             </div>

             <button type="submit" className="w-full bg-amber-500 text-white py-3 rounded-xl hover:bg-amber-600 transition-all font-bold shadow-lg shadow-amber-500/20 active:scale-95 mt-4">
               Save Leave Record
             </button>
           </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden">
           <div className="p-6 border-b border-slate-100 bg-slate-50/50">
             <h3 className="font-bold text-slate-700">Recent Leaves</h3>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="text-xs text-slate-500 uppercase border-b border-slate-100 bg-slate-50/50">
                 <tr>
                   <th className="px-6 py-4 font-semibold tracking-wider">Driver</th>
                   <th className="px-6 py-4 font-semibold tracking-wider">Duration</th>
                   <th className="px-6 py-4 font-semibold tracking-wider">Total Days</th>
                   <th className="px-6 py-4 font-semibold tracking-wider">Reason</th>
                   <th className="px-6 py-4 font-semibold text-right tracking-wider">Action</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {loading ? (
                   <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading...</td></tr>
                 ) : leaves.length === 0 ? (
                   <tr><td colSpan={5} className="p-12 text-center text-slate-400">No leave records found.</td></tr>
                 ) : (
                   leaves.map(l => (
                     <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4 font-bold text-slate-800">{getDriverName(l.driverId)}</td>
                       <td className="px-6 py-4 text-slate-600 font-medium">
                         {l.startDate} <span className="text-slate-300 mx-1">to</span> {l.endDate}
                       </td>
                       <td className="px-6 py-4">
                         <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">
                           {l.days} Days
                         </span>
                       </td>
                       <td className="px-6 py-4 text-slate-500">{l.reason || '-'}</td>
                       <td className="px-6 py-4 text-right">
                         <button onClick={() => handleDelete(l.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-2 rounded-lg hover:bg-rose-50">
                           <Trash2 size={18} />
                         </button>
                       </td>
                     </tr>
                   ))
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LeavePage;