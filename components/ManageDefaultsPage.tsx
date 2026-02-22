import React, { useEffect, useState } from 'react';
import { Driver, AssetMaster, DriverShiftRecord, LeaveRecord } from '../types';
import { storageService } from '../services/storageService';
import { Settings, Plus, Trash2, Car, QrCode, Save, History, Calendar, ChevronDown } from 'lucide-react';

const ManageDefaultsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'assets' | 'assignments'>('assets');
  
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assets, setAssets] = useState<AssetMaster>({ vehicles: [], qrCodes: [] });
  const [shiftRecords, setShiftRecords] = useState<DriverShiftRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);

  // Asset Form State
  const [newAssetValue, setNewAssetValue] = useState('');

  // Editing State for Drivers
  const [editState, setEditState] = useState<Record<string, Partial<Driver>>>({});
  
  // Shift History Modal
  const [showShiftHistory, setShowShiftHistory] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [d, a, s, l] = await Promise.all([
      storageService.getDrivers(),
      storageService.getAssets(),
      storageService.getDriverShifts(),
      storageService.getLeaves()
    ]);
    setDrivers(d);
    setAssets(a);
    setShiftRecords(s);
    setLeaves(l);
    setLoading(false);
  };

  const getActiveDrivers = () => drivers.filter(d => !d.terminationDate);

  // --- ASSET MANAGEMENT ---
  const handleAddAsset = async (type: 'vehicles' | 'qrcodes') => {
    if (!newAssetValue.trim()) return;
    const newAssets = { ...assets };
    if (type === 'vehicles') {
      if (newAssets.vehicles.includes(newAssetValue)) return alert('Vehicle already exists');
      newAssets.vehicles.push(newAssetValue);
    } else {
      if (newAssets.qrCodes.includes(newAssetValue)) return alert('QR Code already exists');
      newAssets.qrCodes.push(newAssetValue);
    }
    await storageService.saveAssets(newAssets);
    setNewAssetValue('');
    setAssets(newAssets); // Optimistic update
  };

  const handleDeleteAsset = async (type: 'vehicles' | 'qrcodes', val: string) => {
    if (!confirm(`Are you sure you want to delete ${val}?`)) return;
    const newAssets = { ...assets };
    if (type === 'vehicles') {
      newAssets.vehicles = newAssets.vehicles.filter(v => v !== val);
    } else {
      newAssets.qrCodes = newAssets.qrCodes.filter(q => q !== val);
    }
    await storageService.saveAssets(newAssets);
    setAssets(newAssets);
  };

  // --- DRIVER ASSIGNMENTS ---
  
  const handleEditChange = (driverId: string, field: keyof Driver, value: any) => {
    setEditState(prev => ({
      ...prev,
      [driverId]: {
        ...prev[driverId],
        [field]: value
      }
    }));
  };

  const saveDriverDefaults = async (driverId: string) => {
    const changes = editState[driverId];
    if (!changes) return;

    const originalDriver = drivers.find(d => d.id === driverId);
    if (!originalDriver) return;

    // Validate Vehicle Capacity
    if (changes.vehicle && changes.vehicle !== originalDriver.vehicle) {
        const currentOccupants = getActiveDrivers().filter(d => d.vehicle === changes.vehicle && d.id !== driverId);
        if (currentOccupants.length >= 2) {
            alert(`Vehicle ${changes.vehicle} is full (Max 2 drivers).`);
            return;
        }
    }

    // Validate QR Uniqueness
    if (changes.qrCode && changes.qrCode !== originalDriver.qrCode) {
        const qrTaken = getActiveDrivers().some(d => d.qrCode === changes.qrCode && d.id !== driverId);
        if (qrTaken) {
            alert(`QR Code ${changes.qrCode} is already assigned to another driver.`);
            return;
        }
    }

    const today = new Date().toISOString().split('T')[0];
    const newShift = changes.currentShift || originalDriver.currentShift;

    // Handle Shift History Logic
    if (originalDriver.currentShift !== newShift) {
        const openShift = shiftRecords.find(s => s.driverId === driverId && !s.endDate);
        if (openShift) {
             if (openShift.startDate === today) {
                // Update today's record
                await storageService.saveDriverShift({ ...openShift, shift: newShift });
             } else {
                // Close previous record
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                await storageService.saveDriverShift({ ...openShift, endDate: yesterday.toISOString().split('T')[0] });
                
                // Open new record
                await storageService.saveDriverShift({
                    id: crypto.randomUUID(),
                    driverId,
                    shift: newShift,
                    startDate: today
                });
             }
        } else {
             await storageService.saveDriverShift({
                 id: crypto.randomUUID(),
                 driverId,
                 shift: newShift,
                 startDate: today
             });
        }
    }

    // Save Driver
    const updatedDriver = { ...originalDriver, ...changes };
    await storageService.saveDriver(updatedDriver);

    // Cleanup state
    const newEditState = { ...editState };
    delete newEditState[driverId];
    setEditState(newEditState);
    loadData(); // Refresh data to confirm saves
  };

  // Helper for Shift History Calc (Same as before)
  const calculateShiftStats = (shift: DriverShiftRecord) => {
     const start = new Date(shift.startDate);
     const end = shift.endDate ? new Date(shift.endDate) : new Date();
     const timeDiff = Math.abs(end.getTime() - start.getTime());
     const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

     const driverLeaves = leaves.filter(l => l.driverId === shift.driverId);
     let leaveDays = 0;
     driverLeaves.forEach(l => {
        const lStart = new Date(l.startDate);
        const lEnd = new Date(l.endDate);
        const overlapStart = lStart > start ? lStart : start;
        const overlapEnd = lEnd < end ? lEnd : end;
        if (overlapStart <= overlapEnd) {
           const overlapTime = Math.abs(overlapEnd.getTime() - overlapStart.getTime());
           leaveDays += Math.ceil(overlapTime / (1000 * 3600 * 24)) + 1;
        }
     });
     return { totalDays, leaveDays, activeDays: Math.max(0, totalDays - leaveDays) };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
       <div className="flex items-center space-x-4 mb-4">
          <div className="p-3 bg-slate-900 rounded-xl text-white shadow-lg shadow-slate-900/20">
            <Settings size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Manage Defaults</h2>
            <p className="text-slate-500 mt-1">Configure assets and operational settings.</p>
          </div>
       </div>

       {/* Tabs */}
       <div className="flex border-b border-slate-200">
          <button 
             onClick={() => setActiveTab('assets')}
             className={`px-8 py-4 font-medium text-sm border-b-2 transition-all duration-200 ${activeTab === 'assets' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
             Asset Pool
          </button>
          <button 
             onClick={() => setActiveTab('assignments')}
             className={`px-8 py-4 font-medium text-sm border-b-2 transition-all duration-200 ${activeTab === 'assignments' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
             Driver Assignments
          </button>
       </div>

       {/* --- ASSETS TAB --- */}
       {activeTab === 'assets' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
             {/* Vehicles */}
             <div className="bg-white p-8 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="font-bold text-slate-800 flex items-center gap-3 text-lg"><Car size={22} className="text-indigo-600" /> Vehicles</h3>
                   <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{assets.vehicles.length} Total</span>
                </div>
                <div className="flex gap-3 mb-6">
                   <input 
                      placeholder="Add Vehicle No." 
                      value={newAssetValue} 
                      onChange={e => setNewAssetValue(e.target.value)} 
                      className="flex-1 px-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                   />
                   <button onClick={() => handleAddAsset('vehicles')} className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-black transition-colors shadow-lg shadow-slate-900/20"><Plus size={20}/></button>
                </div>
                <div className="overflow-y-auto space-y-2 pr-2 flex-1 scrollbar-thin">
                   {assets.vehicles.map(v => (
                      <div key={v} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100 group hover:border-slate-200 transition-colors">
                         <span className="font-semibold text-slate-700">{v}</span>
                         <button onClick={() => handleDeleteAsset('vehicles', v)} className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                      </div>
                   ))}
                </div>
             </div>

             {/* QR Codes */}
             <div className="bg-white p-8 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="font-bold text-slate-800 flex items-center gap-3 text-lg"><QrCode size={22} className="text-indigo-600" /> QR Codes</h3>
                   <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{assets.qrCodes.length} Total</span>
                </div>
                <div className="flex gap-3 mb-6">
                   <input 
                      placeholder="Add QR ID" 
                      value={newAssetValue} 
                      onChange={e => setNewAssetValue(e.target.value)} 
                      className="flex-1 px-4 py-2.5 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                   />
                   <button onClick={() => handleAddAsset('qrcodes')} className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-black transition-colors shadow-lg shadow-slate-900/20"><Plus size={20}/></button>
                </div>
                <div className="overflow-y-auto space-y-2 pr-2 flex-1 scrollbar-thin">
                   {assets.qrCodes.map(q => (
                      <div key={q} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100 group hover:border-slate-200 transition-colors">
                         <span className="font-semibold text-slate-700">{q}</span>
                         <button onClick={() => handleDeleteAsset('qrcodes', q)} className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                      </div>
                   ))}
                </div>
             </div>
          </div>
       )}

       {/* --- ASSIGNMENTS TAB --- */}
       {activeTab === 'assignments' && (
          <div className="bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden animate-fade-in">
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50/50 text-slate-500 uppercase text-xs border-b border-slate-100">
                      <tr>
                         <th className="px-6 py-4 font-semibold tracking-wider">Driver</th>
                         <th className="px-6 py-4 font-semibold tracking-wider">Default Vehicle</th>
                         <th className="px-6 py-4 font-semibold tracking-wider">Default QR</th>
                         <th className="px-6 py-4 font-semibold tracking-wider">Default Shift</th>
                         <th className="px-6 py-4 font-semibold tracking-wider">Default Rent</th>
                         <th className="px-6 py-4 font-semibold text-right tracking-wider">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {getActiveDrivers().map(d => {
                         const changes = editState[d.id] || {};
                         const hasChanges = Object.keys(changes).length > 0;
                         
                         const displayVehicle = changes.vehicle !== undefined ? changes.vehicle : d.vehicle;
                         const displayQr = changes.qrCode !== undefined ? changes.qrCode : d.qrCode;
                         const displayShift = changes.currentShift !== undefined ? changes.currentShift : d.currentShift;
                         const displayRent = changes.defaultRent !== undefined ? changes.defaultRent : d.defaultRent;

                         return (
                            <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                               <td className="px-6 py-4 font-bold text-slate-800">
                                  {d.name}
                                  <div className="text-xs text-slate-400 font-medium mt-0.5">{d.mobile}</div>
                               </td>
                               <td className="px-6 py-4">
                                  <div className="relative">
                                     <select 
                                        value={displayVehicle} 
                                        onChange={e => handleEditChange(d.id, 'vehicle', e.target.value)}
                                        className="w-full pl-3 pr-8 py-2 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                                     >
                                        <option value="">-- None --</option>
                                        {assets.vehicles.map(v => (
                                           <option key={v} value={v}>{v}</option>
                                        ))}
                                     </select>
                                     <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                                  </div>
                               </td>
                               <td className="px-6 py-4">
                                  <div className="relative">
                                     <select 
                                        value={displayQr} 
                                        onChange={e => handleEditChange(d.id, 'qrCode', e.target.value)}
                                        className="w-full pl-3 pr-8 py-2 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                                     >
                                        <option value="">-- None --</option>
                                        {assets.qrCodes.map(q => (
                                           <option key={q} value={q}>{q}</option>
                                        ))}
                                     </select>
                                     <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                                  </div>
                               </td>
                               <td className="px-6 py-4 flex items-center gap-2">
                                  <div className="relative w-28">
                                     <select 
                                        value={displayShift} 
                                        onChange={e => handleEditChange(d.id, 'currentShift', e.target.value)}
                                        className="w-full pl-3 pr-8 py-2 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                                     >
                                        <option value="Day">Day</option>
                                        <option value="Night">Night</option>
                                     </select>
                                     <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                                  </div>
                                  <button onClick={() => setShowShiftHistory(d.id)} className="text-slate-300 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors" title="View History">
                                     <History size={16} />
                                  </button>
                               </td>
                               <td className="px-6 py-4">
                                  <input 
                                     type="number" 
                                     value={displayRent || ''} 
                                     placeholder="0"
                                     onChange={e => handleEditChange(d.id, 'defaultRent', parseFloat(e.target.value))}
                                     className="w-24 px-3 py-2 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-lg text-sm font-medium text-right focus:ring-2 focus:ring-indigo-500 outline-none"
                                  />
                               </td>
                               <td className="px-6 py-4 text-right">
                                  {hasChanges && (
                                     <button 
                                        onClick={() => saveDriverDefaults(d.id)}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all active:scale-95"
                                     >
                                        <Save size={14} /> Save
                                     </button>
                                  )}
                               </td>
                            </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>
          </div>
       )}

      {/* --- SHIFT HISTORY MODAL --- */}
      {showShiftHistory && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-fade-in border border-slate-200">
               <div className="flex justify-between items-center p-6 border-b border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800">
                     Shift History: <span className="text-indigo-600">{drivers.find(d => d.id === showShiftHistory)?.name}</span>
                  </h3>
                  <button onClick={() => setShowShiftHistory(null)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                     <span className="text-2xl leading-none">&times;</span>
                  </button>
               </div>
               
               <div className="p-6 overflow-y-auto">
                  <div className="space-y-4">
                     {shiftRecords
                        .filter(s => s.driverId === showShiftHistory)
                        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                        .map(record => {
                           const stats = calculateShiftStats(record);
                           return (
                              <div key={record.id} className="bg-slate-50 border border-slate-100 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-200 transition-colors">
                                 <div>
                                    <div className="flex items-center gap-2 mb-2">
                                       <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${record.shift === 'Day' ? 'bg-amber-100 text-amber-700' : 'bg-slate-800 text-slate-200'}`}>
                                          {record.shift}
                                       </span>
                                       {!record.endDate && <span className="text-xs text-emerald-600 font-bold px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full animate-pulse">Active</span>}
                                    </div>
                                    <div className="text-sm text-slate-600 flex items-center gap-1.5 font-medium">
                                       <Calendar size={14} className="text-slate-400" />
                                       <span>{record.startDate}</span>
                                       <span className="text-slate-300 mx-1">&rarr;</span>
                                       <span>{record.endDate || 'Present'}</span>
                                    </div>
                                 </div>
                                 
                                 <div className="text-right w-full sm:w-auto bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                    <div className="text-xs text-slate-400 mb-1">Total Duration: <span className="font-semibold text-slate-700">{stats.totalDays} days</span></div>
                                    <div className="text-xs text-rose-400 mb-2">Leaves Taken: <span className="font-semibold text-rose-600">-{stats.leaveDays} days</span></div>
                                    <div className="text-sm font-bold text-slate-800 pt-2 border-t border-slate-50 flex items-center justify-end gap-2">
                                       Net Active: <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{stats.activeDays} days</span>
                                    </div>
                                 </div>
                              </div>
                           );
                        })
                     }
                     {shiftRecords.filter(s => s.driverId === showShiftHistory).length === 0 && (
                        <div className="text-center py-12">
                           <p className="text-slate-400 font-medium">No shift history found.</p>
                        </div>
                     )}
                  </div>
               </div>
               <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
                  <button onClick={() => setShowShiftHistory(null)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium shadow-sm transition-colors">Close</button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default ManageDefaultsPage;