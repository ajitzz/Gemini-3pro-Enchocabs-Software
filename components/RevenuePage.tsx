
import React, { useEffect, useState, useMemo } from 'react';
import { storageService } from '../services/storageService';
import { CompanyWeeklySummary, DailyEntry, WeeklyWallet } from '../types';
import { Calculator, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, DollarSign, Wallet, ShieldCheck, ShieldAlert, Calendar, RefreshCcw, ArrowRight, Filter, ChevronRight, History, Layers, ChevronDown } from 'lucide-react';

// --- Types for Internal Calculations ---
interface ProcessedWeek {
  id: string;
  startDate: string;
  endDate: string;
  fileName: string;
  label: string;
  
  // Metrics
  vehicleRent: number;
  companyWallet: number;
  currentOs: number;
  otherHeadSections: number;
  driversPayments: number;
  driversWalletRaw: number;
  driversWalletAdjusted: number;
  totalCharges: number;
  totalRent: number;
  
  // Results
  profitLoss: number;
  
  // Validations
  hasSettlementIssue: boolean;
  isWalletSafe: boolean;
  fraudCheckDiff: number;
}

const ROOM_RENT_PER_WEEK = 4666;

const RevenuePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rawSummaries, setRawSummaries] = useState<CompanyWeeklySummary[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [weeklyWallets, setWeeklyWallets] = useState<WeeklyWallet[]>([]);

  // Selection State
  const [selectionMode, setSelectionMode] = useState<'SINGLE' | 'RANGE'>('SINGLE');
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  
  // Range State
  const [rangeStartId, setRangeStartId] = useState<string>('');
  const [rangeEndId, setRangeEndId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [s, d, w] = await Promise.all([
      storageService.getCompanySummaries(),
      storageService.getDailyEntries(),
      storageService.getWeeklyWallets(),
    ]);
    const sortedSummaries = s.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    
    setRawSummaries(sortedSummaries);
    setDailyEntries(d);
    setWeeklyWallets(w);
    
    // Default to latest week
    if (sortedSummaries.length > 0) {
      setSelectedWeekId(sortedSummaries[0].id);
      setRangeStartId(sortedSummaries[sortedSummaries.length - 1].id); // Oldest
      setRangeEndId(sortedSummaries[0].id); // Newest
    }
    
    setLoading(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  // --- 1. CORE CALCULATION ENGINE ---
  const processedWeeks: ProcessedWeek[] = useMemo(() => {
    return rawSummaries.map(summary => {
      const startDate = new Date(summary.startDate);
      const endDate = new Date(summary.endDate);

      // Inputs from Company File
      const vehicleRent = summary.rows.reduce((sum, r) => sum + r.netWeeklyLeaseRental, 0);
      const companyWallet = summary.rows.reduce((sum, r) => sum + (r.uberWeekOs || 0) + (r.olaWeekOs || 0), 0);
      const currentOs = summary.rows.reduce((sum, r) => sum + r.currentOs, 0);

      // Derived Company Metrics
      const totalRent = vehicleRent + companyWallet;
      const otherHeadSections = currentOs - totalRent;

      // Inputs from Daily Entries (Revenue)
      const driversPayments = dailyEntries
        .filter(d => {
          const dt = new Date(d.date);
          return dt >= startDate && dt <= endDate;
        })
        .reduce((sum, d) => sum + d.rent, 0);

      // Inputs from Weekly Wallets
      const relevantWallets = weeklyWallets.filter(w => w.weekStartDate === summary.startDate);
      const driversWalletRaw = relevantWallets.reduce((sum, w) => sum + w.walletWeek, 0);
      const totalCharges = relevantWallets.reduce((sum, w) => sum + w.charges, 0);
      const driversWalletAdjusted = driversWalletRaw + totalCharges;

      // Profit / Loss Logic
      // Formula: Income (Drivers Payments) - Expenses (Wallet Payouts + Current O/S + Fixed Rent)
      const profitLoss = driversPayments - driversWalletRaw - currentOs - ROOM_RENT_PER_WEEK;

      // Validations
      const settlementDiff = Math.abs(currentOs - totalRent);
      const hasSettlementIssue = settlementDiff > 5;

      const fraudCheckDiff = driversWalletAdjusted + companyWallet;
      const isWalletSafe = Math.abs(fraudCheckDiff) < 100;

      return {
        id: summary.id,
        startDate: summary.startDate,
        endDate: summary.endDate,
        fileName: summary.fileName,
        label: `${formatDate(summary.startDate)} - ${formatDate(summary.endDate)}`,
        vehicleRent,
        companyWallet,
        currentOs,
        otherHeadSections,
        driversPayments,
        driversWalletRaw,
        driversWalletAdjusted,
        totalCharges,
        totalRent,
        profitLoss,
        hasSettlementIssue,
        isWalletSafe,
        fraudCheckDiff
      };
    });
  }, [rawSummaries, dailyEntries, weeklyWallets]);

  // --- 2. SELECTION LOGIC ---
  const activeWeeks = useMemo(() => {
    if (selectionMode === 'SINGLE') {
      return processedWeeks.filter(w => w.id === selectedWeekId);
    } else {
      // Range Mode
      const startIdx = processedWeeks.findIndex(w => w.id === rangeStartId);
      const endIdx = processedWeeks.findIndex(w => w.id === rangeEndId);
      
      if (startIdx === -1 || endIdx === -1) return [];

      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);
      
      // processedWeeks is sorted DESC. So Range needs slice from min to max+1.
      return processedWeeks.slice(minIdx, maxIdx + 1);
    }
  }, [processedWeeks, selectionMode, selectedWeekId, rangeStartId, rangeEndId]);

  // --- 3. CONSOLIDATED STATS ---
  const consolidatedStats = useMemo(() => {
    if (activeWeeks.length === 0) return null;

    const base = activeWeeks.reduce((acc, week) => ({
        vehicleRent: acc.vehicleRent + week.vehicleRent,
        companyWallet: acc.companyWallet + week.companyWallet,
        currentOs: acc.currentOs + week.currentOs,
        otherHeadSections: acc.otherHeadSections + week.otherHeadSections,
        driversPayments: acc.driversPayments + week.driversPayments,
        driversWalletRaw: acc.driversWalletRaw + week.driversWalletRaw,
        driversWalletAdjusted: acc.driversWalletAdjusted + week.driversWalletAdjusted,
        totalRent: acc.totalRent + week.totalRent,
        fraudCheckDiff: acc.fraudCheckDiff + week.fraudCheckDiff,
        profitLoss: acc.profitLoss + week.profitLoss
    }), {
        vehicleRent: 0,
        companyWallet: 0,
        currentOs: 0,
        otherHeadSections: 0,
        driversPayments: 0,
        driversWalletRaw: 0,
        driversWalletAdjusted: 0,
        totalRent: 0,
        fraudCheckDiff: 0,
        profitLoss: 0
    });
    
    const weeksCount = activeWeeks.length;
    const totalRoomRent = ROOM_RENT_PER_WEEK * weeksCount;
    
    // Strict Net Result Calculation for Display
    // Revenue - Wallet - OS - RoomRent
    const strictProfit = base.driversPayments - base.driversWalletRaw - base.currentOs - totalRoomRent;

    return {
        ...base,
        weeksCount,
        totalRoomRent,
        strictProfit,
        // For aggregation, we check if the net difference is significant over the period
        isWalletSafe: Math.abs(base.fraudCheckDiff) < (100 * weeksCount)
    };
  }, [activeWeeks]);

  // --- HANDLERS ---
  const handleReset = () => {
    if (processedWeeks.length > 0) {
      setSelectionMode('SINGLE');
      setSelectedWeekId(processedWeeks[0].id);
    }
  };

  const handleApplyRange = () => {
    setSelectionMode('RANGE');
  };

  const handleHistoryClick = (id: string) => {
    setSelectionMode('SINGLE');
    setSelectedWeekId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center flex-col gap-4">
       <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
       <p className="text-slate-500 font-medium">Crunching numbers...</p>
    </div>
  );

  return (
    <div className="max-w-[1920px] mx-auto space-y-8 animate-fade-in pb-20">
       {/* HEADER & CONTROLS */}
       <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div className="flex items-center space-x-4">
              <div className="p-3 bg-indigo-900/10 rounded-xl text-indigo-700 shadow-sm border border-indigo-100">
                <Calculator size={28} />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Revenue Calculation</h2>
                <p className="text-slate-500 mt-1 font-medium">Weekly settlements and profit/loss analysis.</p>
              </div>
          </div>

          <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center gap-2">
              <div className="flex items-center gap-4 px-4 py-2">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Start Week</span>
                    <div className="relative group">
                       <select 
                          value={rangeStartId} 
                          onChange={e => setRangeStartId(e.target.value)}
                          className="appearance-none bg-transparent font-bold text-sm text-slate-700 pr-6 focus:outline-none cursor-pointer w-40"
                       >
                          {processedWeeks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                       </select>
                       <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                    </div>
                 </div>
                 
                 <div className="text-slate-300"><ArrowRight size={16}/></div>
                 
                 <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">End Week</span>
                    <div className="relative group">
                       <select 
                          value={rangeEndId} 
                          onChange={e => setRangeEndId(e.target.value)}
                          className="appearance-none bg-transparent font-bold text-sm text-slate-700 pr-6 focus:outline-none cursor-pointer w-40"
                       >
                          {processedWeeks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                       </select>
                       <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                    </div>
                 </div>
              </div>

              <div className="h-8 w-px bg-slate-100 hidden sm:block"></div>

              <div className="flex gap-2 p-1">
                 <button 
                   onClick={handleApplyRange}
                   className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 ${selectionMode === 'RANGE' ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                 >
                   <Filter size={14} /> Apply Range
                 </button>
                 <button 
                   onClick={handleReset}
                   className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                   title="Reset to Latest"
                 >
                   <RefreshCcw size={18} />
                 </button>
              </div>
          </div>
       </div>

       <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* LEFT COLUMN: ACTIVE VIEW (2/3 width) */}
          <div className="xl:col-span-2 space-y-8">
              
              {/* 1. AGGREGATED HERO CARDS */}
              {consolidatedStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                           <DollarSign size={80} />
                        </div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Revenue</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(consolidatedStats.driversPayments)}</h3>
                        <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
                           <TrendingUp size={12} /> Driver Collections
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                           <Wallet size={80} />
                        </div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Expenses</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">
                           {formatCurrency(consolidatedStats.currentOs + consolidatedStats.driversWalletRaw + consolidatedStats.totalRoomRent)}
                        </h3>
                        <p className="text-xs text-rose-500 font-medium mt-2 flex items-center gap-1">
                           <TrendingDown size={12} /> Outflows + O/S + Rent
                        </p>
                    </div>

                    <div className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden group text-white ${consolidatedStats.strictProfit >= 0 ? 'bg-slate-900 border-slate-800' : 'bg-rose-600 border-rose-700'}`}>
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                           {consolidatedStats.strictProfit >= 0 ? <TrendingUp size={80} /> : <TrendingDown size={80} />}
                        </div>
                        <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Net Profit / Loss</p>
                        <h3 className="text-3xl font-bold mt-1">{formatCurrency(consolidatedStats.strictProfit)}</h3>
                        <p className="text-xs text-white/80 font-medium mt-2">
                           {consolidatedStats.weeksCount} Week{consolidatedStats.weeksCount > 1 ? 's' : ''} Selected
                        </p>
                    </div>
                </div>
              )}

              {/* 2. CONSOLIDATED STATEMENT / DETAILED BREAKDOWN */}
              <div className="space-y-6">
                 <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                       {selectionMode === 'RANGE' ? <Layers size={20} className="text-indigo-600" /> : <RefreshCcw size={20} className="text-indigo-600" />}
                       {selectionMode === 'RANGE' ? 'Consolidated Statement' : 'Detailed Breakdown'}
                    </h3>
                    {selectionMode === 'RANGE' && <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{activeWeeks.length} Weeks Aggregated</span>}
                 </div>

                 {/* Consolidated / Active Card */}
                 {consolidatedStats ? (
                   <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      {/* Card Header */}
                      <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                         <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm text-slate-500">
                               <Calendar size={20} />
                            </div>
                            <div>
                               <h4 className="font-bold text-slate-800 text-sm">
                                  {selectionMode === 'RANGE' ? `Aggregated Report (${consolidatedStats.weeksCount} Weeks)` : processedWeeks.find(w => w.id === selectedWeekId)?.label}
                               </h4>
                               <p className="text-[10px] text-slate-400 font-mono">
                                  {selectionMode === 'RANGE' ? `Room Rent Applied: ${consolidatedStats.weeksCount} x ${ROOM_RENT_PER_WEEK}` : processedWeeks.find(w => w.id === selectedWeekId)?.fileName}
                               </p>
                            </div>
                         </div>
                         <div className={`px-4 py-1.5 rounded-lg text-sm font-bold border ${consolidatedStats.strictProfit >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                            {formatCurrency(consolidatedStats.strictProfit)}
                         </div>
                      </div>

                      {/* Detail Grid */}
                      <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
                         {/* Left: Financial Inputs */}
                         <div className="space-y-8">
                            {/* RENT SECTION */}
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 relative">
                               <span className="absolute -top-3 left-4 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">Rental Breakdown</span>
                               <div className="space-y-3 text-sm mt-2">
                                  <div className="flex justify-between items-center">
                                     <span className="text-slate-600">Vehicle Rent</span>
                                     <span className="font-bold text-slate-800">{formatCurrency(consolidatedStats.vehicleRent)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                     <span className="text-slate-600">Company Wallet</span>
                                     <span className="font-bold text-slate-800">{formatCurrency(consolidatedStats.companyWallet)}</span>
                                  </div>
                                  <div className="h-px bg-slate-200 my-2"></div>
                                  <div className="flex justify-between items-center">
                                     <span className="text-slate-700 font-bold">Total Rent</span>
                                     <span className="font-bold text-indigo-600 text-base">{formatCurrency(consolidatedStats.totalRent)}</span>
                                  </div>
                               </div>
                            </div>

                            {/* REVENUE & WALLET */}
                            <div className="grid grid-cols-2 gap-4">
                               <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Revenue</p>
                                  <p className="text-xs text-emerald-700/70 mb-2">Drivers Payments</p>
                                  <p className="text-xl font-bold text-emerald-800">{formatCurrency(consolidatedStats.driversPayments)}</p>
                               </div>
                               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Driver Wallet</p>
                                  <p className="text-xs text-slate-400 mb-2">Net Balance (Raw)</p>
                                  <p className="text-xl font-bold text-slate-800">{formatCurrency(consolidatedStats.driversWalletRaw)}</p>
                               </div>
                            </div>
                         </div>

                         {/* Right: Deductions & Result */}
                         <div className="space-y-6 flex flex-col">
                            {/* DEDUCTIONS LIST */}
                            <div className="space-y-3 text-sm bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                               <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Operational Costs & O/S</h5>
                               <div className="flex justify-between">
                                  <span className="text-slate-600">Current O/S</span>
                                  <span className="font-bold text-slate-800">{formatCurrency(consolidatedStats.currentOs)}</span>
                               </div>
                               <div className="flex justify-between">
                                  <span className="text-slate-600">Room Rent ({consolidatedStats.weeksCount} wks)</span>
                                  <span className="font-bold text-slate-800">{formatCurrency(consolidatedStats.totalRoomRent)}</span>
                               </div>
                               <div className="flex justify-between text-xs text-slate-400 mt-1">
                                  <span>Other Head Sections</span>
                                  <span>{formatCurrency(consolidatedStats.otherHeadSections)}</span>
                               </div>
                            </div>

                            {/* FRAUD CHECK AGGREGATED */}
                            <div className={`px-4 py-3 rounded-xl border flex gap-3 ${!consolidatedStats.isWalletSafe ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-200'}`}>
                               <div className={`mt-0.5 ${!consolidatedStats.isWalletSafe ? 'text-rose-500' : 'text-blue-500'}`}>
                                  {!consolidatedStats.isWalletSafe ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                                </div>
                               <div className="flex-1">
                                  <div className="flex justify-between items-center">
                                      <p className={`text-xs font-bold ${!consolidatedStats.isWalletSafe ? 'text-rose-700' : 'text-blue-700'}`}>
                                         {!consolidatedStats.isWalletSafe ? 'Fraud Suspected (Aggregated)' : 'Wallet Integrity Verified'}
                                      </p>
                                      {Math.abs(consolidatedStats.fraudCheckDiff) > 0 && (
                                         <span className="text-[10px] font-bold bg-white/50 px-2 py-0.5 rounded text-slate-600">
                                            Diff: {formatCurrency(Math.abs(consolidatedStats.fraudCheckDiff))}
                                         </span>
                                      )}
                                  </div>
                                  <p className="text-[10px] opacity-80 mt-1 leading-relaxed">
                                     {!consolidatedStats.isWalletSafe 
                                        ? `Significant cumulative mismatch of ${formatCurrency(Math.abs(consolidatedStats.fraudCheckDiff))} detected between Wallet Adjusted and Company Wallet across ${consolidatedStats.weeksCount} weeks.` 
                                        : `Minor cumulative variance of ${formatCurrency(Math.abs(consolidatedStats.fraudCheckDiff))} is within tolerance levels.`}
                                  </p>
                               </div>
                            </div>

                            {/* NET RESULT BOX */}
                            <div className="bg-slate-900 text-white p-6 rounded-2xl mt-auto relative overflow-hidden shadow-xl shadow-slate-900/10">
                               <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-1/4 translate-y-1/4">
                                  <DollarSign size={120} />
                               </div>
                               <div className="relative z-10">
                                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-bold">Net Consolidated Result</p>
                                  <div className="flex items-end gap-3">
                                     <span className="text-4xl font-bold tracking-tight">{formatCurrency(consolidatedStats.strictProfit)}</span>
                                     <div className={`mb-1.5 flex items-center gap-1 text-sm font-bold ${consolidatedStats.strictProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {consolidatedStats.strictProfit >= 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                                        {consolidatedStats.strictProfit >= 0 ? 'Profit' : 'Loss'}
                                     </div>
                                  </div>
                                  <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
                                     Formula: Revenue ({formatCurrency(consolidatedStats.driversPayments)}) - Wallet ({formatCurrency(consolidatedStats.driversWalletRaw)}) - O/S ({formatCurrency(consolidatedStats.currentOs)}) - RoomRent ({formatCurrency(consolidatedStats.totalRoomRent)})
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                 ) : (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed text-slate-400">
                       No data selected.
                    </div>
                 )}

                 {/* Optional: Weekly Breakdown List in Range Mode */}
                 {selectionMode === 'RANGE' && activeWeeks.length > 0 && (
                    <div className="pt-8">
                       <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Weekly Breakdown</h4>
                       <div className="grid grid-cols-1 gap-4">
                          {activeWeeks.map(week => (
                             <div key={week.id} className="bg-white px-6 py-4 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-4">
                                   <div className="bg-slate-100 p-2 rounded-lg text-slate-500"><Calendar size={16}/></div>
                                   <div>
                                      <p className="text-sm font-bold text-slate-800">{week.label}</p>
                                      <p className="text-xs text-slate-400">Rev: {formatCurrency(week.driversPayments)} • Exp: {formatCurrency(week.currentOs + week.driversWalletRaw + ROOM_RENT_PER_WEEK)}</p>
                                   </div>
                                </div>
                                <div className={`text-sm font-bold px-3 py-1 rounded-lg ${week.profitLoss >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                   {formatCurrency(week.profitLoss)}
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 )}
              </div>
          </div>

          {/* RIGHT COLUMN: HISTORY LIST (1/3 width) */}
          <div className="xl:col-span-1">
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6 max-h-[calc(100vh-100px)] flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <History size={18} className="text-indigo-500"/> Revenue History
                   </h3>
                   <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-500 font-medium">{processedWeeks.length} Weeks</span>
                </div>
                
                <div className="overflow-y-auto p-2 space-y-2 flex-1 scrollbar-thin">
                   {processedWeeks.map(week => {
                      const isActive = selectionMode === 'SINGLE' && selectedWeekId === week.id;
                      const isInRange = selectionMode === 'RANGE' && activeWeeks.some(aw => aw.id === week.id);
                      
                      return (
                         <button 
                           key={week.id}
                           onClick={() => handleHistoryClick(week.id)}
                           className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group flex items-center justify-between ${isActive 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                              : isInRange 
                                ? 'bg-indigo-50 border-indigo-200 text-slate-800'
                                : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-600'
                           }`}
                         >
                            <div>
                               <p className={`text-xs font-bold ${isActive ? 'text-indigo-200' : 'text-slate-400'} uppercase tracking-wider mb-0.5`}>Week Ending</p>
                               <p className={`text-sm font-bold ${isActive ? 'text-white' : 'text-slate-800'}`}>{formatDate(week.endDate)}</p>
                            </div>
                            <div className="text-right">
                               <div className={`text-sm font-bold ${isActive ? 'text-white' : week.profitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {formatCurrency(week.profitLoss)}
                               </div>
                               <div className={`text-[10px] flex items-center justify-end gap-1 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                                  {week.profitLoss >= 0 ? 'Profit' : 'Loss'} 
                                  <ChevronRight size={12} className={`transition-transform ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`} />
                               </div>
                            </div>
                         </button>
                      );
                   })}
                   {processedWeeks.length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-sm">No history available.</div>
                   )}
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default RevenuePage;
