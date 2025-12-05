import React, { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { DriverSummary, GlobalSummary } from '../types';
import { Users, Banknote, Fuel, TrendingDown, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<DriverSummary[]>([]);
  const [global, setGlobal] = useState<GlobalSummary | null>(null);
  const [filterDriver, setFilterDriver] = useState('');

  const loadData = async () => {
    setLoading(true);
    const data = await storageService.getSummary();
    setSummaries(data.driverSummaries);
    setGlobal(data.global);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSummaries = summaries.filter(s => 
    filterDriver === '' || s.driver.toLowerCase().includes(filterDriver.toLowerCase())
  );

  const StatCard = ({ title, value, colorClass, icon: Icon, subtext, trend }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3.5 rounded-2xl ${colorClass.bg} ${colorClass.text} transition-transform group-hover:scale-110 duration-300`}>
          <Icon size={24} />
        </div>
        {trend && (
           <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border ${trend === 'up' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
             {trend === 'up' ? <ArrowUpRight size={12} strokeWidth={3}/> : <ArrowDownRight size={12} strokeWidth={3}/>}
             <span className="uppercase tracking-wider text-[10px]">{trend === 'up' ? 'Payable' : 'Pending'}</span>
           </span>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-400 mb-1 tracking-wide uppercase text-[11px]">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
        {subtext && <p className="text-xs text-slate-400 mt-2 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> {subtext}</p>}
      </div>
    </div>
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
  };

  if (loading) return (
    <div className="flex h-full min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium text-sm animate-pulse">Computing financials...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Financial Overview</h2>
          <p className="text-slate-500 mt-1 font-medium">Real-time performance metrics and wallet balances.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium bg-white text-slate-600 px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
           Live Data
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Collection" 
          value={formatCurrency(global?.totalCollection || 0)} 
          colorClass={{ bg: 'bg-indigo-50', text: 'text-indigo-600' }}
          icon={Banknote} 
          subtext="Revenue In"
        />
        <StatCard 
          title="Total Fuel Cost" 
          value={formatCurrency(global?.totalFuel || 0)} 
          colorClass={{ bg: 'bg-amber-50', text: 'text-amber-600' }}
          icon={Fuel} 
          subtext="Expenses Out"
        />
        <StatCard 
          title="Pending from Drivers" 
          value={formatCurrency(global?.pendingFromDrivers || 0)} 
          colorClass={{ bg: 'bg-rose-50', text: 'text-rose-600' }}
          icon={TrendingDown}
          trend="down"
        />
        <StatCard 
          title="Payable to Drivers" 
          value={formatCurrency(global?.payableToDrivers || 0)} 
          colorClass={{ bg: 'bg-emerald-50', text: 'text-emerald-600' }}
          icon={Wallet} 
          trend="up"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Driver Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <Users size={20} className="text-indigo-500"/> Driver Balances
            </h3>
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Filter drivers..." 
                value={filterDriver}
                onChange={(e) => setFilterDriver(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all w-64"
              />
              <Users size={16} className="absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1 scrollbar-thin">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">Driver</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Collection</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Rent</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Fuel</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Wallet</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummaries.map((driver) => (
                  <tr key={driver.driver} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{driver.driver}</td>
                    <td className="px-6 py-4 text-right text-slate-600 font-medium">{formatCurrency(driver.totalCollection)}</td>
                    <td className="px-6 py-4 text-right text-slate-400">{formatCurrency(driver.totalRent)}</td>
                    <td className="px-6 py-4 text-right text-slate-400">{formatCurrency(driver.totalFuel)}</td>
                    <td className="px-6 py-4 text-right text-slate-500 font-medium">{formatCurrency(driver.totalWalletWeek)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${
                        driver.finalTotal < 0 
                          ? 'bg-rose-50 text-rose-700 border-rose-100' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {formatCurrency(driver.finalTotal)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredSummaries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={32} className="opacity-20" />
                        <p>No drivers found matching "{filterDriver}"</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts & Helpers */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
             <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
               <TrendingUp size={20} className="text-indigo-500" />
               Visual Balance
             </h3>
             <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredSummaries} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="driver" 
                      type="category" 
                      width={80} 
                      tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} 
                      interval={0} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', background: 'rgba(255,255,255,0.95)'}}
                    />
                    <ReferenceLine x={0} stroke="#cbd5e1" strokeWidth={2} />
                    <Bar dataKey="finalTotal" radius={[4, 4, 4, 4]} barSize={12}>
                      {filteredSummaries.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.finalTotal < 0 ? '#f43f5e' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
             <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
               <div className="flex items-center gap-2">
                 <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></span> Payable
               </div>
               <div className="flex items-center gap-2">
                 <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-200"></span> Pending
               </div>
             </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl shadow-slate-900/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
               <Banknote size={100} />
            </div>
            <div className="relative z-10">
              <div className="flex items-start space-x-4">
                <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-600/30">
                  <AlertCircle className="text-white" size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm mb-1 uppercase tracking-wider">Net Calculation</h4>
                  <p className="text-slate-300 text-xs leading-relaxed font-mono mt-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                    Total = Collection - Rent - Fuel + Due + WalletWeek
                  </p>
                  <div className="mt-4 space-y-2">
                     <div className="flex items-center justify-between text-xs bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                        <span className="text-slate-400">Negative Value</span>
                        <span className="font-bold text-rose-400">Driver Owes You</span>
                     </div>
                     <div className="flex items-center justify-between text-xs bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                        <span className="text-slate-400">Positive Value</span>
                        <span className="font-bold text-emerald-400">You Owe Driver</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;