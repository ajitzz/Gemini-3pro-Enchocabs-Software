import React, { useEffect, useState } from 'react';
import { Driver, LeaveRecord } from '../types';
import { storageService } from '../services/storageService';
import { UserPlus, Edit2, Clock, FileText, X, AlertTriangle } from 'lucide-react';

// MOVED OUTSIDE: Prevents re-rendering focus loss
const InputField = ({ label, value, onChange, placeholder, type = "text", required = false, className = "" }: any) => (
  <div className="flex flex-col gap-1.5">
     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
     <input 
       required={required}
       type={type}
       value={value}
       onChange={onChange}
       placeholder={placeholder}
       className={`w-full px-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none ${className}`}
     />
  </div>
);

const RegistrationPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);

  // Form States
  const [driverForm, setDriverForm] = useState<Partial<Driver>>({
    joinDate: new Date().toISOString().split('T')[0],
    deposit: 0,
    status: 'Active',
    qrCode: '',
    vehicle: '',
    currentShift: 'Day',
    notes: ''
  });
  const [isDriverFormOpen, setIsDriverFormOpen] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [d, l] = await Promise.all([
      storageService.getDrivers(),
      storageService.getLeaves(),
    ]);
    setDrivers(d);
    setLeaves(l);
    setLoading(false);
  };

  // --- Calculations ---

  const calculateDaysLeftForRefund = (driver: Driver) => {
    if (driver.terminationDate) return 'Terminated';
    
    const join = new Date(driver.joinDate);
    // Normalize to midnight to avoid time-of-day discrepancies
    join.setHours(0,0,0,0);
    
    const now = new Date();
    now.setHours(0,0,0,0);
    
    // 4 months period
    const targetDate = new Date(join);
    targetDate.setMonth(targetDate.getMonth() + 4);

    // Add Leave days
    const driverLeaves = leaves.filter(l => l.driverId === driver.id);
    const totalLeaveDays = driverLeaves.reduce((sum, l) => sum + l.days, 0);
    
    targetDate.setDate(targetDate.getDate() + totalLeaveDays);

    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Refundable Now';
    return `${diffDays} Days Left`;
  };

  // --- Handlers ---

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const name = driverForm.name?.trim();
    if (!name) return;

    // DUPLICATE NAME CHECK
    // We check if another driver exists with the same name (ignoring self if editing)
    const duplicate = drivers.find(d => 
        d.name.toLowerCase() === name.toLowerCase() && 
        d.id !== (driverForm.id || editingDriverId) // Use form ID or state ID
    );

    if (duplicate) {
        alert(`Driver with name "${name}" already exists. Please use a unique name to ensure imports work correctly.`);
        return;
    }

    const isTerminating = !!driverForm.terminationDate;
    let newDriver: Driver;

    if (driverForm.id) {
       // --- UPDATE EXISTING DRIVER ---
       const existingDriver = drivers.find(d => d.id === driverForm.id);
       
       newDriver = {
          ...existingDriver!,
          ...driverForm as Driver,
          name: name, // Ensure trimmed
          // If terminating, clear operational assignments to free them up
          vehicle: isTerminating ? '' : existingDriver!.vehicle,
          qrCode: isTerminating ? '' : existingDriver!.qrCode,
          status: isTerminating ? 'Terminated' : 'Active'
       };
    } else {
       // --- CREATE NEW DRIVER ---
       const id = crypto.randomUUID();
       newDriver = {
         id: id,
         name: name,
         mobile: driverForm.mobile || '',
         joinDate: driverForm.joinDate!,
         terminationDate: driverForm.terminationDate || undefined,
         deposit: Number(driverForm.deposit),
         // New drivers have no assets assigned initially
         qrCode: '',
         vehicle: '',
         status: 'Active',
         currentShift: 'Day', // Default
         notes: driverForm.notes
       };
    }

    await storageService.saveDriver(newDriver);
    setIsDriverFormOpen(false);
    setEditingDriverId(null);
    setDriverForm({ joinDate: new Date().toISOString().split('T')[0], deposit: 0, status: 'Active', qrCode: '', vehicle: '', currentShift: 'Day', notes: '' });
    loadData();
  };

  const openEditDriver = (d: Driver) => {
    setDriverForm(d);
    setEditingDriverId(d.id);
    setIsDriverFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-900 tracking-tight">HR Registration</h2>
           <p className="text-slate-500 mt-1">Onboard drivers and manage deposits.</p>
        </div>
        <button 
           onClick={() => setIsDriverFormOpen(!isDriverFormOpen)} 
           className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
        >
           {isDriverFormOpen ? <X size={20}/> : <UserPlus size={20} />}
           <span>{isDriverFormOpen ? 'Cancel' : 'Register Driver'}</span>
        </button>
      </div>

      {/* Driver Form */}
      {isDriverFormOpen && (
        <div className="bg-white p-8 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 animate-fade-in">
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
            <div>
              <h4 className="text-xl font-bold text-slate-800">
                {editingDriverId ? 'Edit Driver Record' : 'New Driver Registration'}
              </h4>
              <p className="text-sm text-slate-400 mt-1">Enter personal details and deposit information.</p>
            </div>
            {editingDriverId && (
              <span className="text-xs px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full font-bold uppercase tracking-wider">Editing</span>
            )}
          </div>

          <form onSubmit={handleSaveDriver} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <InputField label="Full Name" value={driverForm.name || ''} onChange={(e: any) => setDriverForm({...driverForm, name: e.target.value})} placeholder="e.g. John Doe" required />
              <InputField label="Mobile Number" value={driverForm.mobile || ''} onChange={(e: any) => setDriverForm({...driverForm, mobile: e.target.value})} placeholder="e.g. +1 234 567 890" />
              <InputField label="Join Date" type="date" value={driverForm.joinDate} onChange={(e: any) => setDriverForm({...driverForm, joinDate: e.target.value})} required />
              
              <div className="lg:col-span-3 h-px bg-slate-100 my-2"></div>

              <InputField label="Deposit Amount (₹)" type="number" value={driverForm.deposit} onChange={(e: any) => setDriverForm({...driverForm, deposit: parseFloat(e.target.value)})} required className="font-bold text-slate-700" />
              
              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">HR Notes</label>
                <textarea 
                    value={driverForm.notes || ''} 
                    onChange={e => setDriverForm({...driverForm, notes: e.target.value})} 
                    className="w-full px-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none h-24" 
                    placeholder="General notes about the employee..."
                />
              </div>

              <div className="lg:col-span-3 h-px bg-slate-100 my-2"></div>

              <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 lg:col-span-1">
                <label className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-2 block">Termination Date</label>
                <input 
                  type="date" 
                  value={driverForm.terminationDate || ''} 
                  onChange={e => setDriverForm({...driverForm, terminationDate: e.target.value || undefined})} 
                  className="w-full px-4 py-2.5 bg-white border border-rose-200 rounded-xl text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none" 
                />
                <p className="text-[10px] text-rose-400 mt-2 font-medium">Setting this will automatically release assigned assets.</p>
              </div>

              <div className="lg:col-span-2 flex justify-end items-end pb-2">
                <button type="submit" className="px-8 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-black shadow-lg shadow-slate-900/20 transition-all active:scale-95">
                  {editingDriverId ? 'Update Record' : 'Register Driver'}
                </button>
              </div>
          </form>
        </div>
      )}

      {/* Driver List */}
      <div className="bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
           <h3 className="font-bold text-slate-800 text-lg">Employee Directory</h3>
           <div className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">{drivers.length} Drivers</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Driver Name</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Contact & Status</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Deposit & Refund</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {drivers.length === 0 ? (
                 <tr><td colSpan={4} className="p-12 text-center text-slate-400">No drivers registered yet.</td></tr>
              ) : (
                drivers.map(d => {
                  const refundText = calculateDaysLeftForRefund(d);
                  const isTerminated = !!d.terminationDate;
                  return (
                    <tr key={d.id} className={`group transition-colors ${isTerminated ? 'bg-slate-50/80 grayscale opacity-70' : 'hover:bg-slate-50/80'}`}>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {d.name}
                        {isTerminated && <span className="ml-2 px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] uppercase tracking-wide rounded-full font-bold">Terminated</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{d.mobile || 'N/A'}</span>
                            <span className="text-xs text-slate-400">Joined: {d.joinDate}</span>
                            {d.terminationDate && <span className="text-rose-600 text-xs font-bold">Left: {d.terminationDate}</span>}
                          </div>
                          {d.notes && (
                            <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5 max-w-xs bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                <FileText size={10} />
                                <span className="truncate">{d.notes}</span>
                            </div>
                          )}
                      </td>
                      <td className="px-6 py-4">
                          <div className="font-bold text-slate-700 mb-1 text-base">₹{d.deposit}</div>
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${refundText === 'Refundable Now' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                            <Clock size={12} />
                            <span>{refundText}</span>
                          </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => openEditDriver(d)} 
                            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors"
                            title="Edit HR Details"
                          >
                            <Edit2 size={16} />
                          </button>
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

export default RegistrationPage;