
import React, { useEffect, useState } from 'react';
import { Driver, LeaveRecord, ManagerAccess } from '../types';
import { storageService } from '../services/storageService';
import { UserPlus, Edit2, Clock, FileText, X, AlertTriangle, ShieldCheck, Users, CheckSquare, Square, AlertOctagon, Mail, Loader2 } from 'lucide-react';

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
  const [saving, setSaving] = useState(false); // New saving state
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
    notes: '',
    isManager: false,
    email: ''
  });
  const [isDriverFormOpen, setIsDriverFormOpen] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);

  // Manager Assignment State
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [managerTeam, setManagerTeam] = useState<string[]>([]); // List of Child Driver IDs
  
  // Warning Modal State
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [d, l] = await Promise.all([
        storageService.getDrivers(),
        storageService.getLeaves(),
      ]);
      setDrivers(d);
      setLeaves(l);
    } catch (err) {
      console.error("Failed to load drivers", err);
      // Optional: Add global error toast here
    } finally {
      setLoading(false);
    }
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

    // Add Leave days (Standard + Late)
    const driverLeaves = leaves.filter(l => l.driverId === driver.id);
    let totalDelayDays = 0;
    
    driverLeaves.forEach(l => {
        const start = new Date(l.startDate);
        // If Actual Return exists, calculate total absence from Start to Actual
        // Otherwise use Start to Planned End
        const end = l.actualReturnDate ? new Date(l.actualReturnDate) : new Date(l.endDate);
        
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalDelayDays += days;
    });
    
    targetDate.setDate(targetDate.getDate() + totalDelayDays);

    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Refundable Now';
    return `${diffDays} Days Left`;
  };

  // --- Handlers ---

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const name = driverForm.name?.trim();
    const mobile = driverForm.mobile?.trim();
    const email = driverForm.email?.trim() || '';
    const currentId = driverForm.id || editingDriverId;

    if (!name) return;

    // 1. DUPLICATE NAME CHECK
    const duplicateName = drivers.find(d => 
        d.name.toLowerCase() === name.toLowerCase() && 
        d.id !== currentId
    );

    if (duplicateName) {
        setWarningMessage(`DUPLICATE NAME DETECTED\n\nA driver named "${duplicateName.name}" is already registered.\n\nRegistration Cancelled.`);
        return;
    }

    // 2. DUPLICATE MOBILE CHECK
    if (mobile) {
        const duplicateMobile = drivers.find(d => 
            d.mobile === mobile && 
            d.id !== currentId
        );

        if (duplicateMobile) {
            setWarningMessage(`DUPLICATE CONTACT DETECTED\n\nMobile number "${mobile}" is already registered to "${duplicateMobile.name}".\n\nRegistration Cancelled.`);
            return;
        }
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
          mobile: mobile || '', // Ensure trimmed
          email: email,
          // If terminating, clear operational assignments to free them up
          vehicle: isTerminating ? '' : existingDriver!.vehicle,
          qrCode: isTerminating ? '' : existingDriver!.qrCode,
          status: isTerminating ? 'Terminated' : 'Active'
       };
    } else {
       // --- CREATE NEW DRIVER ---
       // Fix: Send empty string for ID, allow backend to generate UUID
       newDriver = {
         id: '', 
         name: name,
         mobile: mobile || '',
         email: email,
         joinDate: driverForm.joinDate!,
         terminationDate: driverForm.terminationDate || undefined,
         deposit: Number(driverForm.deposit),
         // New drivers have no assets assigned initially
         qrCode: '',
         vehicle: '',
         status: 'Active',
         currentShift: 'Day', // Default
         notes: driverForm.notes,
         isManager: driverForm.isManager || false
       };
    }

    try {
        setSaving(true);
        await storageService.saveDriver(newDriver);
        setIsDriverFormOpen(false);
        setEditingDriverId(null);
        setDriverForm({ joinDate: new Date().toISOString().split('T')[0], deposit: 0, status: 'Active', qrCode: '', vehicle: '', currentShift: 'Day', notes: '', isManager: false, email: '' });
        loadData();
    } catch (error: any) {
        alert(`Failed to save driver: ${error.message}\n\nPlease check your database connection.`);
    } finally {
        setSaving(false);
    }
  };

  const openEditDriver = (d: Driver) => {
    setDriverForm(d);
    setEditingDriverId(d.id);
    setIsDriverFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Manager Team Management ---

  const openTeamModal = async () => {
      if (!editingDriverId) return;
      try {
        const allAccess = await storageService.getManagerAccess();
        const currentAccess = allAccess.find(a => a.managerId === editingDriverId);
        setManagerTeam(currentAccess ? currentAccess.childDriverIds : []);
        setIsTeamModalOpen(true);
      } catch (err: any) {
        alert("Failed to load team data: " + err.message);
      }
  };

  const toggleTeamMember = (childId: string) => {
      setManagerTeam(prev => {
          if (prev.includes(childId)) {
              return prev.filter(id => id !== childId);
          } else {
              return [...prev, childId];
          }
      });
  };

  const saveTeamMapping = async () => {
      if (!editingDriverId) return;
      
      const accessRecord: ManagerAccess = {
          managerId: editingDriverId,
          childDriverIds: managerTeam
      };
      
      try {
        await storageService.saveManagerAccess(accessRecord);
        setIsTeamModalOpen(false);
        alert("Team assignments saved successfully.");
      } catch (err: any) {
        alert("Failed to save assignments: " + err.message);
      }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-900 tracking-tight">HR Registration</h2>
           <p className="text-slate-500 mt-1">Onboard drivers and manage deposits.</p>
        </div>
        <button 
           onClick={() => {
             setIsDriverFormOpen(!isDriverFormOpen);
             if(!isDriverFormOpen) setDriverForm({ joinDate: new Date().toISOString().split('T')[0], deposit: 0, status: 'Active', qrCode: '', vehicle: '', currentShift: 'Day', notes: '', isManager: false, email: '' });
             setEditingDriverId(null);
           }} 
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
              <InputField label="Mobile Number" value={driverForm.mobile || ''} onChange={(e: any) => setDriverForm({...driverForm, mobile: e.target.value})} placeholder="e.g. +1 234 567 890" required={true} />
              <InputField label="Gmail (Optional)" value={driverForm.email || ''} onChange={(e: any) => setDriverForm({...driverForm, email: e.target.value})} placeholder="e.g. driver@gmail.com" type="email" />
              
              <div className="lg:col-span-3 h-px bg-slate-100 my-2"></div>
              
              <InputField label="Join Date" type="date" value={driverForm.joinDate} onChange={(e: any) => setDriverForm({...driverForm, joinDate: e.target.value})} required />
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

              {/* MANAGER ROLE CONFIGURATION */}
              <div className="lg:col-span-3 bg-indigo-50 rounded-xl p-5 border border-indigo-100 mt-2">
                 <div className="flex justify-between items-center">
                    <div>
                        <h5 className="font-bold text-indigo-900 flex items-center gap-2">
                            <ShieldCheck size={18}/> Manager Access
                        </h5>
                        <p className="text-xs text-indigo-700 mt-1">
                            Grant this driver capability to view other drivers' portals (Read-Only).
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <div className="relative">
                                <input 
                                    type="checkbox" 
                                    checked={driverForm.isManager || false}
                                    onChange={e => setDriverForm({...driverForm, isManager: e.target.checked})}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </div>
                            <span className="text-sm font-bold text-slate-700">Enable Manager Role</span>
                        </label>
                        
                        {driverForm.isManager && editingDriverId && (
                            <button 
                                type="button"
                                onClick={openTeamModal}
                                className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 flex items-center gap-2"
                            >
                                <Users size={14}/> Manage Team
                            </button>
                        )}
                        {driverForm.isManager && !editingDriverId && (
                            <span className="text-xs text-slate-400 italic">(Save first to assign team)</span>
                        )}
                    </div>
                 </div>
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
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-8 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-black shadow-lg shadow-slate-900/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {saving && <Loader2 size={18} className="animate-spin" />}
                  {editingDriverId ? 'Update Record' : 'Register Driver'}
                </button>
              </div>
          </form>
        </div>
      )}

      {/* WARNING MODAL (Duplicate) */}
      {warningMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden ring-4 ring-rose-50">
                  <div className="bg-rose-50 p-6 border-b border-rose-100 flex items-center gap-3">
                      <div className="bg-white p-2 rounded-full text-rose-500 shadow-sm"><AlertOctagon size={28} /></div>
                      <div>
                          <h3 className="font-bold text-rose-900 text-lg">Registration Blocked</h3>
                      </div>
                  </div>
                  <div className="p-6">
                      <p className="text-slate-600 font-medium whitespace-pre-line leading-relaxed">
                          {warningMessage}
                      </p>
                      <button 
                        onClick={() => setWarningMessage(null)}
                        className="mt-6 w-full py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-200"
                      >
                          Okay, I'll Fix It
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* TEAM ASSIGNMENT MODAL */}
      {isTeamModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <Users className="text-indigo-600" size={20}/> Assign Team Members
                      </h3>
                      <button onClick={() => setIsTeamModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  <div className="p-4 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-700">
                      Select drivers that <strong>{driverForm.name}</strong> will be allowed to view in their portal.
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                      {drivers.filter(d => d.id !== editingDriverId && !d.terminationDate).map(d => {
                          const isSelected = managerTeam.includes(d.id);
                          return (
                              <div 
                                key={d.id} 
                                onClick={() => toggleTeamMember(d.id)}
                                className={`p-3 rounded-xl flex items-center justify-between cursor-pointer border mb-2 transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                              >
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                                          {d.name.charAt(0)}
                                      </div>
                                      <div>
                                          <p className={`text-sm font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{d.name}</p>
                                          <p className="text-xs text-slate-400">{d.mobile}</p>
                                      </div>
                                  </div>
                                  <div>
                                      {isSelected ? <CheckSquare className="text-indigo-600" size={20} /> : <Square className="text-slate-300" size={20} />}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                  <div className="p-5 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
                      <button onClick={() => setIsTeamModalOpen(false)} className="px-5 py-2 text-slate-600 font-bold text-sm">Cancel</button>
                      <button onClick={saveTeamMapping} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg">Save Assignments</button>
                  </div>
              </div>
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
              {loading ? (
                 <tr><td colSpan={4} className="p-12 text-center text-slate-400">Loading drivers...</td></tr>
              ) : drivers.length === 0 ? (
                 <tr><td colSpan={4} className="p-12 text-center text-slate-400">No drivers registered yet.</td></tr>
              ) : (
                drivers.map(d => {
                  const refundText = calculateDaysLeftForRefund(d);
                  const isTerminated = !!d.terminationDate;
                  return (
                    <tr key={d.id} className={`group transition-colors ${isTerminated ? 'bg-slate-50/80 grayscale opacity-70' : 'hover:bg-slate-50/80'}`}>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                           {d.name}
                           {d.isManager && (
                             <span title="Manager Access" className="flex items-center">
                               <ShieldCheck size={16} className="text-indigo-500" />
                             </span>
                           )}
                        </div>
                        {isTerminated && <span className="ml-0 px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] uppercase tracking-wide rounded-full font-bold">Terminated</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{d.mobile || 'N/A'}</span>
                            {d.email && (
                              <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                                <Mail size={12}/> {d.email}
                              </div>
                            )}
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
