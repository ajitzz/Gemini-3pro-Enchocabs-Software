
import React, { useEffect, useState, lazy, Suspense } from 'react';
import { storageService } from '../services/storageService';
import { DriverSummary, GlobalSummary } from '../types';
import { Users, Banknote, Fuel, TrendingDown, AlertCircle, ArrowUpRight, ArrowDownRight, Wallet, ExternalLink, X, ArrowRight } from 'lucide-react';
import NetCalculationPopup from './NetCalculationPopup';
import { useNavigate } from 'react-router-dom';

const NetPayoutChartCard = lazy(() => import('./dashboard/NetPayoutChartCard'));
const HIDDEN_DRIVERS_STORAGE_KEY = 'driver_app_hidden_drivers_v1';
const DEFAULT_VISIBLE_DRIVERS = 8;

const buildGlobalSummary = (driverSummaries: DriverSummary[]): GlobalSummary => ({
  totalCollection: driverSummaries.reduce((sum, d) => sum + d.totalCollection, 0),
  totalRent: driverSummaries.reduce((sum, d) => sum + d.totalRent, 0),
  totalFuel: driverSummaries.reduce((sum, d) => sum + d.totalFuel, 0),
  totalDue: driverSummaries.reduce((sum, d) => sum + d.totalDue, 0),
  totalPayout: driverSummaries.reduce((sum, d) => sum + d.totalPayout, 0),
  totalExpenses: driverSummaries.reduce((sum, d) => sum + d.totalExpenses, 0),
  totalWalletWeek: driverSummaries.reduce((sum, d) => sum + d.totalWalletWeek, 0),
  pendingFromDrivers: driverSummaries
    .filter((d) => d.finalTotal < 0)
    .reduce((sum, d) => sum + Math.abs(d.finalTotal), 0),
  payableToDrivers: driverSummaries
    .filter((d) => d.finalTotal > 0)
    .reduce((sum, d) => sum + d.finalTotal, 0),
});

const loadHiddenDrivers = (): string[] => {
  try {
    const savedHiddenDrivers = localStorage.getItem(HIDDEN_DRIVERS_STORAGE_KEY);
    if (!savedHiddenDrivers) return [];

    const parsedHiddenDrivers = JSON.parse(savedHiddenDrivers);
    if (!Array.isArray(parsedHiddenDrivers)) return [];

    return parsedHiddenDrivers
      .map((name) => (typeof name === 'string' ? name.trim() : ''))
      .filter(Boolean);
  } catch (error) {
    console.warn('Failed to load hidden drivers', error);
    return [];
  }
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<DriverSummary[]>([]);
  const [global, setGlobal] = useState<GlobalSummary | null>(null);
  const [filterDriver, setFilterDriver] = useState('');
  const [showAllDrivers, setShowAllDrivers] = useState(false);
  const [hiddenDrivers, setHiddenDrivers] = useState<string[]>(() => loadHiddenDrivers());
  const [calcPopup, setCalcPopup] = useState<{
    metric: 'netPayout' | 'netBalance';
    netValue: number;
    values: {
      collection: number;
      rent: number;
      fuel: number;
      due: number;
      wallet: number;
      payout: number;
      expenses: number;
    };
    title?: string;
    sourceNote?: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);

    try {
      const { summaries: driverSummaries } = await storageService.getDriverBalanceSummaries();
      const computedGlobal = buildGlobalSummary(driverSummaries || []);

      setSummaries(driverSummaries || []);
      setGlobal(computedGlobal);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_DRIVERS_STORAGE_KEY, JSON.stringify(hiddenDrivers));
    } catch (error) {
      console.warn('Failed to save hidden drivers', error);
    }
  }, [hiddenDrivers]);

  useEffect(() => {
    loadData();
  }, []);

  const openCalcPopup = (driver: DriverSummary, metric: 'netPayout' | 'netBalance') => {
    setCalcPopup({
      metric,
      netValue: metric === 'netPayout' ? driver.netPayout : driver.finalTotal,
      values: {
        collection: driver.totalCollection,
        rent: driver.totalRent,
        fuel: driver.totalFuel,
        due: driver.totalDue,
        wallet: driver.totalWalletWeek,
        payout: driver.totalPayout,
        expenses: driver.totalExpenses,
      },
      title: `${metric === 'netPayout' ? 'Net Payout' : 'Net Balance'} • ${driver.driver}`,
      sourceNote:
        metric === 'netPayout' && driver.netPayoutSource === 'latest-wallet' && driver.netPayoutRange
          ? `Using lowest balance till ${driver.netPayoutRange}`
          : undefined,
    });
  };

  const filteredSummaries = summaries
    .filter((s) => !hiddenDrivers.includes(s.driver))
    .filter(s =>
      filterDriver === '' || s.driver.toLowerCase().includes(filterDriver.toLowerCase())
    );

  const sortedSummaries = [...filteredSummaries].sort((a, b) => a.finalTotal - b.finalTotal);

  const visibleSummaries = showAllDrivers
    ? sortedSummaries
    : sortedSummaries.slice(0, DEFAULT_VISIBLE_DRIVERS);

  const hiddenDriverList = [...hiddenDrivers].sort((a, b) => a.localeCompare(b));

  const balanceTotals = visibleSummaries.reduce(
    (acc, driver) => ({
      collection: acc.collection + driver.totalCollection,
      rent: acc.rent + driver.totalRent,
      fuel: acc.fuel + driver.totalFuel,
      due: acc.due + driver.totalDue,
      wallet: acc.wallet + driver.totalWalletWeek,
      payout: acc.payout + driver.totalPayout,
      expenses: acc.expenses + driver.totalExpenses,
      netPayout: acc.netPayout + driver.netPayout,
      finalTotal: acc.finalTotal + driver.finalTotal,
    }),
    { collection: 0, rent: 0, fuel: 0, due: 0, wallet: 0, payout: 0, expenses: 0, netPayout: 0, finalTotal: 0 }
  );

  const StatCard = ({ title, value, colorClass, icon: Icon, subtext, trend }: any) => (
    <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] transition-transform group-hover:scale-110 duration-500 ${colorClass.bg}`}></div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-3 rounded-xl ${colorClass.bg} ${colorClass.text} transition-transform group-hover:scale-110 duration-300`}>
          <Icon size={20} md={24} />
        </div>
        {trend && (
           <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${trend === 'up' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
             {trend === 'up' ? <ArrowUpRight size={10} strokeWidth={3}/> : <ArrowDownRight size={10} strokeWidth={3}/>}
             <span className="uppercase tracking-wider">{trend === 'up' ? 'Payable' : 'Pending'}</span>
           </span>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-bold text-slate-400 mb-1 tracking-wider uppercase">{title}</p>
        <h3 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
        {subtext && <p className="text-[10px] text-slate-400 mt-2 font-medium flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${colorClass.text} opacity-40`}></span> {subtext}</p>}
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
    <div className="space-y-8 w-full max-w-none animate-fade-in">
      {calcPopup && (
        <NetCalculationPopup
          metric={calcPopup.metric}
          values={calcPopup.values}
          netValue={calcPopup.netValue}
          title={calcPopup.title}
          sourceNote={calcPopup.sourceNote}
          onClose={() => setCalcPopup(null)}
        />
      )}
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

      {/* Driver Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[640px]">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <Users size={20} className="text-indigo-500"/> Driver Balances
            </h3>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => navigate('/app/driver-balances')}
                className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-semibold border border-indigo-100 hover:bg-indigo-100 transition-colors inline-flex items-center gap-1.5"
              >
                View full analysis
                <ExternalLink size={14} />
              </button>
              <button
                type="button"
                onClick={() => setShowAllDrivers((prev) => !prev)}
                className="px-3 py-2 bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                {showAllDrivers ? 'Show fewer drivers' : `Show all (${sortedSummaries.length}) drivers`}
              </button>
              <div className="relative group">
                <input 
                  type="text" 
                  placeholder="Filter drivers..." 
                  value={filterDriver}
                  onChange={(e) => {
                    setFilterDriver(e.target.value);
                    setShowAllDrivers(false);
                  }}
                  className="pl-10 pr-4 py-2 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all w-64"
                />
                <Users size={16} className="absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              {hiddenDriverList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHiddenDrivers([])}
                  className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-semibold border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                  Unhide all ({hiddenDriverList.length})
                </button>
              )}
            </div>
          </div>
          {hiddenDriverList.length > 0 && (
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/70">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Hidden Drivers</p>
              <div className="flex flex-wrap gap-2">
                {hiddenDriverList.map((driverName) => (
                  <button
                    key={driverName}
                    type="button"
                    onClick={() => setHiddenDrivers((prev) => prev.filter((name) => name !== driverName))}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                  >
                    {driverName}
                    <span className="text-[10px] uppercase tracking-wider text-indigo-500">Unhide</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="px-6 py-2 border-b border-slate-100 bg-slate-50/40 text-[11px] text-slate-500 font-medium">
            Net Balance = Collection - Rent - Fuel + Due + Wallet Week - Payout - Expenses · Net Payout = min(Net Balance, latest wallet cutoff balance).
          </div>
          
          {/* Mobile Card View */}
          <div className="md:hidden flex-1 overflow-y-auto bg-slate-50/50 p-4 space-y-4">
            {visibleSummaries.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Users size={24} className="opacity-20" />
                </div>
                <p className="font-medium">No drivers found</p>
                {filterDriver && (
                  <button onClick={() => setFilterDriver('')} className="mt-2 text-indigo-600 text-sm font-bold">Clear Filter</button>
                )}
              </div>
            ) : (
              visibleSummaries.map((driver) => (
                <div key={driver.driver} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 active:scale-[0.98] transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg leading-tight">{driver.driver}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Driver Profile</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHiddenDrivers((prev) => [...new Set([...prev, driver.driver])])}
                      className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 active:bg-slate-100 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100/50">
                      <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Collection</p>
                      <p className="font-bold text-slate-800 text-sm">{formatCurrency(driver.totalCollection)}</p>
                    </div>
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100/50">
                      <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Rent</p>
                      <p className="font-bold text-slate-800 text-sm">{formatCurrency(driver.totalRent)}</p>
                    </div>
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100/50">
                      <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Fuel</p>
                      <p className="font-bold text-amber-600 text-sm">{formatCurrency(driver.totalFuel)}</p>
                    </div>
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100/50">
                      <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Wallet Week</p>
                      <p className="font-bold text-indigo-600 text-sm">{formatCurrency(driver.totalWalletWeek)}</p>
                    </div>
                  </div>
  
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50">
                    <div 
                      className={`p-3 rounded-2xl cursor-pointer transition-all active:scale-95 border ${
                        driver.netPayout < 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
                      }`}
                      onClick={() => openCalcPopup(driver, 'netPayout')}
                    >
                      <p className={`text-[9px] uppercase tracking-wider font-bold mb-1 ${
                        driver.netPayout < 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}>Net Payout</p>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-black ${
                          driver.netPayout < 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}>
                          {formatCurrency(driver.netPayout)}
                        </span>
                        <ArrowRight size={14} className={driver.netPayout < 0 ? 'text-rose-300' : 'text-emerald-300'} />
                      </div>
                    </div>
                    <div 
                      className={`p-3 rounded-2xl cursor-pointer transition-all active:scale-95 border ${
                        driver.finalTotal < 0 ? 'bg-rose-50 border-rose-100' : 'bg-indigo-50 border-indigo-100'
                      }`}
                      onClick={() => openCalcPopup(driver, 'netBalance')}
                    >
                      <p className={`text-[9px] uppercase tracking-wider font-bold mb-1 ${
                        driver.finalTotal < 0 ? 'text-rose-400' : 'text-indigo-400'
                      }`}>Net Balance</p>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-black ${
                          driver.finalTotal < 0 ? 'text-rose-700' : 'text-indigo-700'
                        }`}>
                          {formatCurrency(driver.finalTotal)}
                        </span>
                        <ArrowRight size={14} className={driver.finalTotal < 0 ? 'text-rose-300' : 'text-indigo-300'} />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto flex-1 scrollbar-thin">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">Driver</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Collection</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Rent</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Fuel</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Dues</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Wallet Week</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Payout</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Expenses</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Net Payout</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Net Balance</th>
                  <th className="px-6 py-4 font-semibold text-right tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleSummaries.map((driver) => (
                  <tr key={driver.driver} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{driver.driver}</td>
                    <td className="px-6 py-4 text-right text-slate-600 font-medium">{formatCurrency(driver.totalCollection)}</td>
                    <td className="px-6 py-4 text-right text-slate-400">{formatCurrency(driver.totalRent)}</td>
                    <td className="px-6 py-4 text-right text-slate-400">{formatCurrency(driver.totalFuel)}</td>
                    <td className="px-6 py-4 text-right text-slate-400">{formatCurrency(driver.totalDue)}</td>
                    <td className="px-6 py-4 text-right text-slate-500 font-medium">{formatCurrency(driver.totalWalletWeek)}</td>
                    <td className="px-6 py-4 text-right text-slate-500 font-medium">{formatCurrency(driver.totalPayout)}</td>
                    <td className="px-6 py-4 text-right text-slate-500 font-medium">{formatCurrency(driver.totalExpenses)}</td>
                    <td className="px-6 py-4 text-right">
                      <div
                        className="flex flex-col items-end gap-1 cursor-pointer"
                        onClick={() => openCalcPopup(driver, 'netPayout')}
                        title="View net payout calculation"
                      >
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${
                          driver.netPayout < 0
                            ? 'bg-rose-50 text-rose-700 border-rose-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {formatCurrency(driver.netPayout)}
                        </span>
                        {driver.netPayoutSource === 'latest-wallet' && driver.netPayoutRange && (
                          <span className="text-[10px] leading-none text-slate-400 font-semibold uppercase tracking-[0.08em]">
                            {driver.netPayoutRange}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        onClick={() => openCalcPopup(driver, 'netBalance')}
                        className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${
                          driver.finalTotal < 0
                            ? 'bg-rose-50 text-rose-700 border-rose-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        } cursor-pointer`}
                        title="View net balance calculation"
                      >
                        {formatCurrency(driver.finalTotal)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setHiddenDrivers((prev) => [...new Set([...prev, driver.driver])])}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        Hide
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleSummaries.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-6 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={32} className="opacity-20" />
                        <p>No drivers found matching "{filterDriver}"</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 text-slate-700 font-bold border-t border-slate-100">
                <tr>
                  <td className="px-6 py-3">Totals</td>
                  <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.collection)}</td>
                  <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.rent)}</td>
                  <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.fuel)}</td>
                  <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.due)}</td>
                  <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.wallet)}</td>
                  <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.payout)}</td>
                  <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.expenses)}</td>
                  <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.netPayout)}</td>
                  <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.finalTotal)}</td>
                  <td className="px-6 py-3 text-right">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      {/* Charts & Helpers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <Suspense fallback={<div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[430px] animate-pulse" />}>
            <NetPayoutChartCard filteredSummaries={filteredSummaries} formatCurrency={formatCurrency} />
          </Suspense>
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
                  Total = Collection - Rent - Fuel + Due + WalletWeek - Payouts - Expenses
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
  );
};

export default DashboardPage;
