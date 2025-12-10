
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storageService } from '../services/storageService';
import { AdminAccess } from '../types';
import { Shield, Plus, Trash2, Mail, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminAccessPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<AdminAccess[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Security Check
    if (user?.role !== 'super_admin') {
        navigate('/');
        return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
      setLoading(true);
      const data = await storageService.getAuthorizedAdmins();
      setAdmins(data);
      setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newEmail.trim()) return;
      
      const newAdmin: AdminAccess = {
          email: newEmail.trim().toLowerCase(),
          addedBy: user?.email || 'Unknown',
          addedAt: new Date().toISOString()
      };

      await storageService.addAuthorizedAdmin(newAdmin);
      setNewEmail('');
      loadData();
  };

  const handleRemove = async (email: string) => {
      if (confirm(`Revoke admin access for ${email}?`)) {
          await storageService.removeAuthorizedAdmin(email);
          loadData();
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-center space-x-4 mb-2">
            <div className="p-3 bg-slate-900 rounded-xl text-white shadow-lg">
                <Shield size={24} />
            </div>
            <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Access Control</h2>
                <p className="text-slate-500 mt-1">Manage staff members who can access the dashboard.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 text-lg mb-4">Grant Access</h3>
                <form onSubmit={handleAdd} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Google Email Address</label>
                        <div className="relative">
                            <input 
                                type="email" 
                                required
                                placeholder="colleague@gmail.com"
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <Mail size={18} className="absolute left-3.5 top-3.5 text-slate-400"/>
                        </div>
                    </div>
                    <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                        <Plus size={18} /> Add Administrator
                    </button>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Note: Added users must log in with this exact Google account to access the dashboard.
                    </p>
                </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Authorized Staff</h3>
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">{admins.length} Active</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {/* Super Admin Static Entry */}
                    <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">S</div>
                            <div>
                                <p className="text-sm font-bold text-indigo-900">enchoenterprises@gmail.com</p>
                                <p className="text-[10px] text-indigo-500 font-bold uppercase">Super Admin (You)</p>
                            </div>
                        </div>
                        <Shield size={16} className="text-indigo-400"/>
                    </div>

                    {admins.map(admin => (
                        <div key={admin.email} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-300 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs">
                                    {admin.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-700">{admin.email}</p>
                                    <p className="text-[10px] text-slate-400">Added: {new Date(admin.addedAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <button onClick={() => handleRemove(admin.email)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    
                    {admins.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">No other admins added.</div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default AdminAccessPage;
