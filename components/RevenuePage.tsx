import React, { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { CompanyWeeklySummary, DailyEntry, WeeklyWallet } from '../types';
import { Calculator, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, DollarSign, Wallet, ShieldCheck, ShieldAlert } from 'lucide-react';

const RevenuePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<CompanyWeeklySummary[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [weeklyWallets, setWeeklyWallets] = useState<WeeklyWallet[]>([]);

  // Constant
  const ROOM_RENT = 4666;

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
    // Sort summaries by date descending
    setSummaries(s.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    setDailyEntries(d);
    setWeeklyWallets(w);
    setLoading(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
  };

  // --- CALCULATION LOGIC PER WEEK ---
  const renderWeekCard = (summary: CompanyWeeklySummary) => {
    const startDate = new Date(summary.startDate);
    const endDate = new Date(summary.endDate);

    // 1. COMPANY SETTLEMENT INPUTS
    // Summing up rows from the imported excel for this week
    const vehicleRent = summary.rows.reduce((sum, r) => sum + r.netWeeklyLeaseRental, 0); // NET LEASE
    const companyWallet = summary.rows.reduce((sum, r) => sum + (r.uberWeekOs || 0) + (r.olaWeekOs || 0), 0); // WALLET O/S
    const currentOs = summary.rows.reduce((sum, r) => sum + r.currentOs, 0); // CURRENT O/S

    // Calculate "Other Head Sections" (Difference between Current O/S and (Rent + Wallet))
    const otherHeadSections = currentOs - (vehicleRent + companyWallet);

    // 2. DAILY ENTRIES INPUT
    const driversPayments = dailyEntries
      .filter(d => {
        const dt = new Date(d.date);
        return dt >= startDate && dt <= endDate;
      })
      .reduce((sum, d) => sum + d.rent, 0);

    // 3. WEEKLY WALLET INPUT
    const relevantWeeklyWallets = weeklyWallets.filter(w => w.weekStartDate === summary.startDate);
    
    const driversWalletRaw = relevantWeeklyWallets.reduce((sum, w) => sum + w.walletWeek, 0);
    const totalCharges = relevantWeeklyWallets.reduce((sum, w) => sum + w.charges, 0);
    
    // Adjusted Driver Wallet (Excluding Charges from the deduction)
    // WalletWeek was = Earnings + Refund - (Deductions + Charges + Cash)
    // To exclude Charges, we add them back:
    const driversWalletAdjusted = driversWalletRaw + totalCharges;

    // --- DERIVED TOTALS ---
    const totalRent = vehicleRent + companyWallet;
    
    // --- VALIDATION 1: Settlement Consistency ---
    const settlementDiff = Math.abs(currentOs - totalRent);
    const hasSettlementIssue = settlementDiff > 5;

    // --- VALIDATION 2: Wallet Integrity Check (Fraud Detection) ---
    // Logic: Company Wallet (O/S) should mirror Drivers Wallet (Adjusted).
    // If Company Wallet is Positive (Driver Pays), Driver Wallet should be Negative.
    // So Sum should be roughly 0.
    // Formula: Diff = DriversWalletAdjusted + CompanyWallet
    // Example: Company says 500 (Pos). Driver wallet should be -500. Sum = 0.
    // Example: Company says -500 (Neg, Pay Driver). Driver wallet should be 500. Sum = 0.
    
    const fraudCheckDiff = driversWalletAdjusted + companyWallet;
    const isWalletSafe = Math.abs(fraudCheckDiff) < 10; // Allow small tolerance

    // --- VALIDATION 3: Profit/Loss ---
    // Formula: Drivers Payments - Drivers Wallet(Raw) - CURRENT O/S - Room Rent
    // Note: P/L usually uses the actual final wallet balance (Raw), not adjusted.
    const profitLoss = driversPayments - driversWalletRaw - currentOs - ROOM_RENT;

    return (
      <div key={summary.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
           <div>
              <h3 className="text-lg font-bold text-slate-800">
                Week: {new Date(summary.startDate).toLocaleDateString('en-GB')} – {new Date(summary.endDate).toLocaleDateString('en-GB')}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-1">Source: {summary.fileName}</p>
           </div>
           <div className={`px-4 py-1.5 rounded-full text-xs font-bold ${profitLoss >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              NET: {formatCurrency(profitLoss)} ({profitLoss >= 0 ? 'PROFIT' : 'LOSS'})
           </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* LEFT COLUMN: INPUTS & CALCULATIONS */}
           <div className="space-y-6">
              
              {/* Company Settlement Data */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Company Settlement Inputs</h4>
                 <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                       <span className="text-slate-600">Vehicle Rent (NET LEASE)</span>
                       <span className="font-bold text-slate-800">{formatCurrency(vehicleRent)}</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-slate-600">Company Wallet (WALLET O/S)</span>
                       <span className="font-bold text-slate-800">{formatCurrency(companyWallet)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200">
                       <span className="text-slate-600 font-bold">Total Rent</span>
                       <span className="font-bold text-indigo-600">{formatCurrency(totalRent)}</span>
                    </div>
                    <div className="flex justify-between mt-2">
                       <span className="text-slate-600">Other Head Sections</span>
                       <span className="font-bold text-slate-800">{formatCurrency(otherHeadSections)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200 bg-indigo-50/50 -mx-4 px-4 py-1">
                       <span className="text-indigo-700 font-bold">CURRENT O/S (Settlement Total)</span>
                       <span className="font-bold text-indigo-700">{formatCurrency(currentOs)}</span>
                    </div>
                 </div>
              </div>

              {/* Driver & Other Data */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Daily Entries</h4>
                    <div className="flex flex-col">
                       <span className="text-xs text-slate-500">Drivers Payments (Rent)</span>
                       <span className="text-lg font-bold text-slate-800">{formatCurrency(driversPayments)}</span>
                    </div>
                 </div>
                 <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Weekly Wallet</h4>
                    <div className="flex flex-col gap-1">
                       <span className="text-xs text-slate-500">Drivers Wallet (Net)</span>
                       <span className="text-lg font-bold text-slate-800">{formatCurrency(driversWalletRaw)}</span>
                       <span className="text-[10px] text-slate-400 mt-1">Excl. Charges: {formatCurrency(driversWalletAdjusted)}</span>
                    </div>
                 </div>
              </div>

              {/* Fixed Costs */}
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex justify-between items-center">
                 <span className="text-sm font-bold text-amber-700">Room Rent (Fixed)</span>
                 <span className="font-bold text-amber-800">{formatCurrency(ROOM_RENT)}</span>
              </div>
           </div>

           {/* RIGHT COLUMN: VALIDATION & RESULTS */}
           <div className="space-y-6">
              <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Validation & Warnings</h4>

              {/* Validation 1: Settlement Consistency */}
              <div className={`p-4 rounded-xl border ${hasSettlementIssue ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className="flex items-start gap-3">
                     {hasSettlementIssue ? <AlertTriangle className="text-rose-500 mt-1" size={20} /> : <CheckCircle className="text-emerald-500 mt-1" size={20} />}
                     <div className="flex-1">
                        <h5 className={`font-bold ${hasSettlementIssue ? 'text-rose-700' : 'text-emerald-700'}`}>
                           {hasSettlementIssue ? "Some Extra Payments added in the company Bill" : "Settlement Consistent"}
                        </h5>
                        {hasSettlementIssue && (
                           <div className="mt-2 text-xs text-rose-600 bg-white/60 p-2 rounded-lg">
                              <p><strong>CURRENT O/S:</strong> {formatCurrency(currentOs)}</p>
                              <p><strong>Total Rent (Calc):</strong> {formatCurrency(totalRent)}</p>
                              <p className="mt-1 font-bold">Difference: {formatCurrency(otherHeadSections)}</p>
                           </div>
                        )}
                     </div>
                  </div>
              </div>

              {/* Validation 2: Wallet Integrity Check (Fraud Detection) */}
              <div className={`p-4 rounded-xl border ${!isWalletSafe ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-start gap-3">
                     <div className={`mt-1 ${!isWalletSafe ? 'text-rose-500' : 'text-blue-500'}`}>
                        {!isWalletSafe ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
                     </div>
                     <div className="flex-1">
                        <h5 className={`font-bold ${!isWalletSafe ? 'text-rose-800' : 'text-blue-800'}`}>
                           {isWalletSafe ? "Wallet Integrity Verified" : "Fraudulent Activity Suspected"}
                        </h5>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                           <div className="bg-white/60 p-2 rounded">
                              <span className="block text-slate-500 text-[10px] uppercase">Company O/S</span>
                              <span className="font-bold text-sm">{formatCurrency(companyWallet)}</span>
                              <span className="block text-[9px] text-slate-400">{companyWallet > 0 ? "Driver to Pay" : "Company to Pay"}</span>
                           </div>
                           <div className="bg-white/60 p-2 rounded">
                              <span className="block text-slate-500 text-[10px] uppercase">Driver Wallet (Adj)</span>
                              <span className="font-bold text-sm">{formatCurrency(driversWalletAdjusted)}</span>
                              <span className="block text-[9px] text-slate-400">{driversWalletAdjusted > 0 ? "Company to Pay" : "Driver to Pay"}</span>
                           </div>
                        </div>
                        {!isWalletSafe && (
                            <p className="mt-2 text-xs font-bold text-rose-600 bg-rose-100/50 p-1.5 rounded">
                               Mismatch Amount: {formatCurrency(Math.abs(fraudCheckDiff))}
                            </p>
                        )}
                     </div>
                  </div>
              </div>

              {/* Validation 3: PROFIT / LOSS */}
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                 <div className="relative z-10">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Net Profit / Loss</h4>
                    <div className="flex items-center gap-3">
                       <h2 className="text-4xl font-bold">{formatCurrency(profitLoss)}</h2>
                       {profitLoss >= 0 ? <TrendingUp className="text-emerald-400" size={32}/> : <TrendingDown className="text-rose-400" size={32}/>}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-700 text-[10px] text-slate-400 font-mono leading-relaxed">
                       Formula: Drivers Payments - Drivers Wallet (Raw) - CURRENT O/S - Room Rent
                       <br/>
                       = {driversPayments.toFixed(0)} - {driversWalletRaw.toFixed(0)} - {currentOs.toFixed(0)} - {ROOM_RENT}
                    </div>
                 </div>
                 {/* Background Decor */}
                 <div className="absolute -right-6 -bottom-6 text-slate-800 opacity-50">
                    <DollarSign size={150} />
                 </div>
              </div>

           </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Revenue Data...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
       <div className="flex items-center space-x-4 mb-2">
          <div className="p-3 bg-indigo-900/10 rounded-xl text-indigo-700 shadow-sm border border-indigo-100">
             <Calculator size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Revenue Calculation</h2>
            <p className="text-slate-500 mt-1 font-medium">Reconcile company settlements with driver wallets.</p>
          </div>
       </div>

       {summaries.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 border-dashed text-slate-400">
             No company settlements found. Please import data first.
          </div>
       ) : (
          <div>{summaries.map(renderWeekCard)}</div>
       )}
    </div>
  );
};

export default RevenuePage;