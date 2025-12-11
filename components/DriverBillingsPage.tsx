import React, { useEffect, useState, useMemo } from 'react';
import { storageService } from '../services/storageService';
import { DriverSummary, RentalSlab, WeeklyWallet, DailyEntry } from '../types';
import { Users, ChevronDown, ChevronUp, FileText, Briefcase, Download, Share2, Edit2, Save, X, Calendar, Filter, ChevronLeft, ChevronRight, Check, Copy, RotateCcw } from 'lucide-react';

const DriverBillingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<DriverSummary[]>([]);
  const [rentalSlabs, setRentalSlabs] = useState<RentalSlab[]>([]);
  const [weeklyWallets, setWeeklyWallets] = useState<WeeklyWallet[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  
  // Filters
  const [filterDriver, setFilterDriver] = useState('');
  
  // Pagination / Week Navigation
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0); // 0 = Latest week
  
  // UI States for Collapsible Sections
  const [isBalancesExpanded, setIsBalancesExpanded] = useState(false); 
  const [isRentalExpanded, setIsRentalExpanded] = useState(false);
  const [isBillingExpanded, setIsBillingExpanded] = useState(true);

  // Edit State for Billing Details
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
      daysWorked: 0,
      rentPerDay: 0,
      adjustments: 0
  });
  const [adjustmentsMap, setAdjustmentsMap] = useState<Record<string, number>>({});
  
  // Copy Feedback State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [summaryData, slabData, weeklyData, dailyData] = await Promise.all([
        storageService.getSummary(),
        storageService.getDriverRentalSlabs(), // Use Driver Slabs
        storageService.getWeeklyWallets(),
        storageService.getDailyEntries()
    ]);
    setSummaries(summaryData.driverSummaries);
    setRentalSlabs(slabData.sort((a, b) => a.minTrips - b.minTrips));
    setWeeklyWallets(weeklyData);
    setDailyEntries(dailyData);
    setLoading(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
  };

  const filteredSummaries = summaries.filter(s => 
    filterDriver === '' || s.driver.toLowerCase().includes(filterDriver.toLowerCase())
  );

  // --- BILLING CALCULATION ENGINE ---
  const allBills = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    return weeklyWallets.map(wallet => {
       const startDate = new Date(wallet.weekStartDate);
       const endDate = new Date(wallet.weekEndDate);
       
       const isWeekCompleted = today > endDate;
       if (!isWeekCompleted) return null; 

       const relevantDaily = dailyEntries.filter(d => {
          const entryDate = new Date(d.date);
          return d.driver === wallet.driver && entryDate >= startDate && entryDate <= endDate;
       });

       const totalTrips = wallet.trips; 
       
       // 1. Find Slab Rate (Default)
       const slab = rentalSlabs.find(s => 
           totalTrips >= s.minTrips && (s.maxTrips === null || totalTrips <= s.maxTrips)
       );
       
       // 2. Determine Rent/Day
       // Priority: Actual Daily Entries Avg (if they exist) -> Slab -> 0
       // This ensures if user edited daily entries previously, we respect that.
       const actualAvgRent = relevantDaily.length > 0 
           ? relevantDaily.reduce((sum, d) => sum + d.rent, 0) / relevantDaily.length 
           : (slab ? slab.rentAmount : 0);
       
       // 3. Count Days Worked (Use Override if present)
       const calculatedDays = relevantDaily.length;
       const daysWorked = wallet.daysWorkedOverride !== undefined && wallet.daysWorkedOverride !== null 
           ? wallet.daysWorkedOverride 
           : calculatedDays;

       // 4. Calculate Total Rent
       const rentTotal = actualAvgRent * daysWorked;

       const collection = relevantDaily.reduce((sum, d) => sum + d.collection, 0);
       const fuel = relevantDaily.reduce((sum, d) => sum + d.fuel, 0);
       const overdue = relevantDaily.reduce((sum, d) => sum + d.due, 0);
       const walletAmount = wallet.walletWeek;

       const adjustment = adjustmentsMap[wallet.id] || 0;
       const payout = collection - rentTotal - fuel + overdue + walletAmount + adjustment;

       return {
           id: wallet.id,
           weekRange: `${wallet.weekStartDate.split('-').reverse().join('-')} to ${wallet.weekEndDate.split('-').reverse().join('-')}`,
           weekKey: wallet.weekStartDate,
           weekEndDate: wallet.weekEndDate,
           driver: wallet.driver,
           qrCode: relevantDaily[0]?.qrCode || 'N/A',
           trips: totalTrips,
           rentPerDay: actualAvgRent,
           slabRent: slab ? slab.rentAmount : 0, // Store standard slab rent for comparison/reset
           daysWorked: daysWorked,
           calculatedDays, 
           rentTotal,
           collection,
           fuel,
           wallet: walletAmount,
           overdue,
           adjustments: adjustment,
           payout,
           dailyDetails: relevantDaily,
           weeklyDetails: wallet
       };
    }).filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => new Date(b.weekKey).getTime() - new Date(a.weekKey).getTime());
  }, [weeklyWallets, dailyEntries, rentalSlabs, adjustmentsMap]);

  // --- WEEK PAGINATION LOGIC ---
  const availableWeeks = useMemo(() => {
      const weeks = Array.from(new Set(allBills.map(b => b.weekKey)));
      // Cast to string to resolve TypeScript error: Argument of type 'unknown' is not assignable to parameter of type 'string | number | Date'.
      return weeks.sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime());
  }, [allBills]);

  const currentWeekKey = availableWeeks[currentWeekIndex];
  
  const displayedBills = useMemo(() => {
      if (!currentWeekKey) return [];
      return allBills.filter(b => b.weekKey === currentWeekKey && 
        (filterDriver === '' || b.driver.toLowerCase().includes(filterDriver.toLowerCase()))
      );
  }, [allBills, currentWeekKey, filterDriver]);

  const goToPreviousWeek = () => {
      if (currentWeekIndex < availableWeeks.length - 1) {
          setCurrentWeekIndex(prev => prev + 1);
      }
  };

  const goToNextWeek = () => {
      if (currentWeekIndex > 0) {
          setCurrentWeekIndex(prev => prev - 1);
      }
  };

  // --- ACTIONS ---

  const openEditModal = (bill: any) => {
      setEditingBillId(bill.id);
      setEditFormData({
          daysWorked: bill.daysWorked,
          rentPerDay: bill.rentPerDay,
          adjustments: bill.adjustments
      });
  };

  const saveBillChanges = async () => {
      if (!editingBillId) return;
      
      const bill = allBills.find(b => b.id === editingBillId);
      if (!bill) return;

      try {
          // 1. Save Adjustments Locally
          setAdjustmentsMap(prev => ({ ...prev, [editingBillId]: editFormData.adjustments }));

          // 2. Save Days Worked Override to Weekly Wallet
          const updatedWallet = { 
              ...bill.weeklyDetails, 
              daysWorkedOverride: editFormData.daysWorked 
          };
          // Always save wallet to persist override even if days didn't change (idempotent)
          await storageService.saveWeeklyWallet(updatedWallet);

          // 3. Save Rent/Day Changes (Propagate to Daily Entries)
          // We apply the new rent to ALL daily entries involved in this bill
          if (bill.dailyDetails.length > 0) {
              const updatedEntries = bill.dailyDetails.map((entry: DailyEntry) => ({
                  ...entry,
                  rent: Number(editFormData.rentPerDay) // Ensure number
              }));
              await storageService.saveDailyEntriesBulk(updatedEntries);
          }

          setEditingBillId(null);
          await loadData(); // Full refresh to ensure consistency
      } catch (err) {
          alert("Failed to save changes. Please try again.");
          console.error(err);
      }
  };

  const resetToDefaults = async () => {
      if (!editingBillId) return;
      
      const bill = allBills.find(b => b.id === editingBillId);
      if (!bill) return;

      if (!confirm("Are you sure? This will revert 'Days Worked' and 'Rent/Day' to the standard calculations based on trips.")) return;

      try {
          // 1. Reset Wallet Override
          const updatedWallet = {
              ...bill.weeklyDetails,
              daysWorkedOverride: null // Clear override (backend must handle null)
          };
          // Workaround for TS optional vs null:
          // @ts-ignore
          updatedWallet.daysWorkedOverride = null;

          await storageService.saveWeeklyWallet(updatedWallet);

          // 2. Reset Daily Rents to Slab Rent
          if (bill.dailyDetails.length > 0) {
              const defaultRent = bill.slabRent;
              const updatedEntries = bill.dailyDetails.map((entry: DailyEntry) => ({
                  ...entry,
                  rent: defaultRent
              }));
              await storageService.saveDailyEntriesBulk(updatedEntries);
          }

          setEditingBillId(null);
          await loadData();
      } catch (err) {
          alert("Failed to reset defaults.");
          console.error(err);
      }
  };

  // --- HTML GENERATION ---
  const generateBillHTML = (bill: any) => {
      const dailyRows = bill.dailyDetails.map((d: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.date.split('-').reverse().join('-')}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.driver}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.vehicle}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.shift}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 10px;">${d.qrCode || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(d.rent)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(d.collection)}</td>
        </tr>
      `).join('');

      const genDate = new Date();
      const genDateStr = `${String(genDate.getDate()).padStart(2,'0')}-${String(genDate.getMonth()+1).padStart(2,'0')}-${genDate.getFullYear()}`;

      return `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Bill - ${bill.driver}</title>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; max-width: 800px; mx-auto; }
              .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
              .company-name { font-size: 24px; font-weight: bold; color: #4f46e5; }
              .sub-company { font-size: 14px; color: #666; margin-top: 5px; }
              .bill-title { font-size: 20px; margin-bottom: 20px; font-weight: bold; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
              .meta { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; }
              .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; font-size: 14px; }
              .label { font-weight: bold; color: #64748b; }
              .value { text-align: right; font-weight: bold; }
              .positive { color: #16a34a; }
              .negative { color: #dc2626; }
              .total-section { background: #f1f5f9; padding: 20px; border-radius: 8px; margin-top: 20px; }
              .total-row { font-size: 20px; font-weight: bold; display: flex; justify-content: space-between; border-top: 2px solid #cbd5e1; padding-top: 15px; }
              .section-title { font-size: 14px; font-weight: bold; margin-top: 40px; margin-bottom: 10px; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 5px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th { text-align: left; background: #f8fafc; padding: 8px; color: #64748b; font-weight: bold; }
              .footer { margin-top: 60px; font-size: 10px; text-align: center; color: #94a3b8; }
              .wallet-total-row { border-top: 1px solid #ccc; margin-top: 5px; padding-top: 5px; font-weight: bold; color: #4f46e5; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="company-name">ENCHO CABS</div>
              <div class="sub-company">A Unit of Encho Enterprises</div>
            </div>
            
            <div class="meta">
               <div>
                 <div><strong>Driver:</strong> ${bill.driver}</div>
                 <div style="margin-top:5px;"><strong>Vehicle QR:</strong> ${bill.qrCode}</div>
               </div>
               <div style="text-align:right;">
                 <div><strong>Week:</strong> ${bill.weekRange}</div>
                 <div style="margin-top:5px;"><strong>Generated:</strong> ${genDateStr}</div>
               </div>
            </div>

            <div class="bill-title">Payment Statement</div>
            
            <div class="summary-grid">
               <div class="label">Total Trips</div><div class="value">${bill.trips}</div>
               <div class="label">Rent / Day (Applied)</div><div class="value">${formatCurrency(bill.rentPerDay)}</div>
               <div class="label">Days Worked</div><div class="value">${bill.daysWorked}</div>
               <div class="label">Total Rent (${formatCurrency(bill.rentPerDay)} × ${bill.daysWorked})</div><div class="value negative">- ${formatCurrency(bill.rentTotal)}</div>
               <div class="label">Fuel Advances</div><div class="value negative">- ${formatCurrency(bill.fuel)}</div>
               <div class="label">Wallet Earnings (Weekly)</div><div class="value positive">+ ${formatCurrency(bill.wallet)}</div>
               <div class="label">Rental Collection</div><div class="value positive">+ ${formatCurrency(bill.collection)}</div>
               <div class="label">Previous Dues/Credit</div><div class="value">${formatCurrency(bill.overdue)}</div>
               <div class="label">Adjustments</div><div class="value">${formatCurrency(bill.adjustments)}</div>
            </div>
            
            <div class="total-section">
               <div class="total-row">
                  <div>NET PAYOUT</div>
                  <div>${formatCurrency(bill.payout)}</div>
               </div>
            </div>

            <div class="section-title">DAILY ACTIVITY LOG</div>
            <table>
              <thead><tr><th>DATE</th><th>DRIVER</th><th>VEHICLE</th><th>SHIFT</th><th>QR</th><th style="text-align:right">RENT</th><th style="text-align:right">COLLECTION</th></tr></thead>
              <tbody>${dailyRows}</tbody>
            </table>

            <div class="section-title">WEEKLY WALLET BREAKDOWN</div>
             <div class="summary-grid" style="grid-template-columns: 1fr 1fr; font-size: 12px; gap: 5px;">
               <div class="label">Gross Earnings</div><div class="value">${formatCurrency(bill.weeklyDetails.earnings)}</div>
               <div class="label">Refunds</div><div class="value">${formatCurrency(bill.weeklyDetails.refund)}</div>
               <div class="label">Deductions</div><div class="value negative">-${formatCurrency(bill.weeklyDetails.diff)}</div>
               <div class="label">Charges</div><div class="value negative">-${formatCurrency(bill.weeklyDetails.charges)}</div>
               <div class="label">Cash (Wallet)</div><div class="value negative">-${formatCurrency(bill.weeklyDetails.cash)}</div>
               <div class="label wallet-total-row">Wallet Total</div><div class="value wallet-total-row">${formatCurrency(bill.wallet)}</div>
            </div>

            <div class="footer">
               System Generated Bill • Encho Cabs
            </div>
          </body>
        </html>
      `;
  };

  const downloadBill = (bill: any) => {
      const content = generateBillHTML(bill);
      const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bill_${bill.driver}_${bill.id.substring(0,6)}.html`;
      a.click();
  };

  const copyBillLink = (bill: any) => {
      const content = generateBillHTML(bill);
      const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      navigator.clipboard.writeText(url).then(() => {
          setCopiedId(bill.id);
          setTimeout(() => setCopiedId(null), 2000);
      });
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-20">
       <div className="flex items-center space-x-4 mb-2">
          <div className="p-3 bg-indigo-900/10 rounded-xl text-indigo-700 shadow-sm border border-indigo-100">
             <FileText size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Driver Billings</h2>
            <p className="text-slate-500 mt-1 font-medium">Manage billing statements and balances.</p>
          </div>
       </div>

       {/* 1. COLLAPSIBLE DRIVER BALANCES SECTION */}
       <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
          <div 
            className={`px-6 py-5 flex justify-between items-center cursor-pointer transition-colors ${isBalancesExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'hover:bg-slate-50'}`}
            onClick={() => setIsBalancesExpanded(!isBalancesExpanded)}
          >
             <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-transform duration-300 ${isBalancesExpanded ? 'bg-slate-200 rotate-180' : 'bg-slate-100'}`}>
                    <ChevronDown size={20} className="text-slate-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                   <Users size={20} className="text-indigo-500"/> Driver Balances (Overall)
                </h3>
             </div>
             
             {!isBalancesExpanded && (
                 <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                    {summaries.length} Drivers
                 </span>
             )}
          </div>

          {isBalancesExpanded && (
            <div className="p-0 animate-fade-in">
               <div className="px-6 py-3 bg-white border-b border-slate-50 flex justify-end">
                  <div className="relative group w-64">
                    <input 
                      type="text" 
                      placeholder="Filter drivers..." 
                      value={filterDriver}
                      onChange={(e) => setFilterDriver(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all w-full"
                    />
                    <Users size={14} className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
               </div>

               <div className="overflow-x-auto max-h-[500px] scrollbar-thin">
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
                      {loading ? (
                         <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading balances...</td></tr>
                      ) : filteredSummaries.length === 0 ? (
                         <tr><td colSpan={6} className="p-8 text-center text-slate-400">No drivers found.</td></tr>
                      ) : (
                        filteredSummaries.map((driver) => (
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
                        ))
                      )}
                    </tbody>
                  </table>
               </div>
            </div>
          )}
       </div>


       {/* 2. DRIVER BILLING SUMMARY (New Section) */}
       <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
          <div 
            className={`px-6 py-5 flex justify-between items-center cursor-pointer transition-colors ${isBillingExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'hover:bg-slate-50'}`}
            onClick={() => setIsBillingExpanded(!isBillingExpanded)}
          >
             <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-transform duration-300 ${isBillingExpanded ? 'bg-slate-200 rotate-180' : 'bg-slate-100'}`}>
                    <ChevronDown size={20} className="text-slate-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                   <Briefcase size={20} className="text-indigo-500"/> Billing History (Weekly View)
                </h3>
             </div>
          </div>

          {isBillingExpanded && (
             <div className="p-0 animate-fade-in">
                {/* Week Pagination & Filters */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
                    
                    {/* Week Navigation */}
                    <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm p-1">
                        <button 
                            onClick={goToPreviousWeek} 
                            disabled={currentWeekIndex >= availableWeeks.length - 1}
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        
                        <div className="px-4 text-center min-w-[200px]">
                            {currentWeekKey ? (
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Week Starting</span>
                                    <span className="text-sm font-bold text-slate-800 flex items-center justify-center gap-2">
                                        <Calendar size={14} className="text-indigo-500"/>
                                        {currentWeekKey.split('-').reverse().join('-')}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-sm text-slate-400 font-medium">No Data Available</span>
                            )}
                        </div>

                        <button 
                            onClick={goToNextWeek} 
                            disabled={currentWeekIndex === 0}
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    
                    {/* Driver Search */}
                    <div className="relative group w-full md:w-64">
                        <input 
                          type="text" 
                          placeholder="Search driver in this week..." 
                          value={filterDriver}
                          onChange={(e) => setFilterDriver(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                        <Users size={16} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                       <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                          <tr>
                             <th className="px-6 py-4">Driver</th>
                             <th className="px-6 py-4">QR</th>
                             <th className="px-6 py-4 text-center">Days Worked</th>
                             <th className="px-6 py-4 text-center">Trips</th>
                             <th className="px-6 py-4 text-right">Rent / Day</th>
                             <th className="px-6 py-4 text-right">Rent Total</th>
                             <th className="px-6 py-4 text-right">Collection</th>
                             <th className="px-6 py-4 text-right">Fuel</th>
                             <th className="px-6 py-4 text-right">Wallet</th>
                             <th className="px-6 py-4 text-right">Overdue</th>
                             <th className="px-6 py-4 text-right">Adjustments</th>
                             <th className="px-6 py-4 text-right">Payout</th>
                             <th className="px-6 py-4 text-center bg-slate-50 sticky right-0 z-10 shadow-[-4px_0_10px_-2px_rgba(0,0,0,0.05)]">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {displayedBills.length === 0 ? (
                             <tr><td colSpan={13} className="p-12 text-center text-slate-400">No billings found for this week.</td></tr>
                          ) : (
                             displayedBills.map((bill) => (
                                <tr key={bill!.id} className="hover:bg-slate-50 transition-colors">
                                   <td className="px-6 py-4 font-bold text-slate-800">{bill!.driver}</td>
                                   <td className="px-6 py-4 text-slate-500">{bill!.qrCode}</td>
                                   <td className="px-6 py-4 text-center">
                                      <span className={`font-bold ${bill!.daysWorked !== bill!.calculatedDays ? 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded' : 'text-slate-800'}`}>
                                          {bill!.daysWorked}
                                      </span>
                                   </td>
                                   <td className="px-6 py-4 font-bold text-center">
                                      {bill!.trips}
                                   </td>
                                   <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(bill!.rentPerDay)}</td>
                                   <td className="px-6 py-4 text-right font-medium text-rose-600">-{formatCurrency(bill!.rentTotal)}</td>
                                   <td className="px-6 py-4 text-right font-medium text-emerald-600">+{formatCurrency(bill!.collection)}</td>
                                   <td className="px-6 py-4 text-right text-rose-500">-{formatCurrency(bill!.fuel)}</td>
                                   <td className="px-6 py-4 text-right text-indigo-600">+{formatCurrency(bill!.wallet)}</td>
                                   <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(bill!.overdue)}</td>
                                   <td className="px-6 py-4 text-right text-amber-600 font-medium">{formatCurrency(bill!.adjustments)}</td>
                                   <td className="px-6 py-4 text-right">
                                      <span className={`px-3 py-1 rounded-lg font-bold border ${bill!.payout < 0 ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                         {formatCurrency(bill!.payout)}
                                      </span>
                                   </td>
                                   <td className="px-6 py-4 text-center bg-white sticky right-0 z-10 shadow-[-4px_0_10px_-2px_rgba(0,0,0,0.02)]">
                                      <div className="flex items-center justify-center gap-2">
                                         <button onClick={() => openEditModal(bill!)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Bill Details">
                                            <Edit2 size={16} />
                                         </button>
                                         <button 
                                            onClick={() => copyBillLink(bill!)} 
                                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors relative" 
                                            title="Copy Bill Link"
                                         >
                                            {copiedId === bill!.id ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                                         </button>
                                         <button onClick={() => downloadBill(bill)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Download Bill">
                                            <Download size={16} />
                                         </button>
                                      </div>
                                   </td>
                                </tr>
                             ))
                          )}
                       </tbody>
                    </table>
                </div>
             </div>
          )}
       </div>


       {/* 3. DRIVER RENTAL REFERENCE SECTION (Collapsible) */}
       <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
          <div 
            className={`px-6 py-5 flex justify-between items-center cursor-pointer transition-colors ${isRentalExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'hover:bg-slate-50'}`}
            onClick={() => setIsRentalExpanded(!isRentalExpanded)}
          >
             <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-transform duration-300 ${isRentalExpanded ? 'bg-slate-200 rotate-180' : 'bg-slate-100'}`}>
                    <ChevronDown size={20} className="text-slate-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Briefcase size={20} className="text-emerald-600"/> Driver Rental Reference
                </h3>
             </div>
          </div>

          {isRentalExpanded && (
              <div className="p-0 animate-fade-in">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-white text-xs uppercase font-bold text-slate-500 border-b border-slate-100">
                       <tr>
                          <th className="px-8 py-4 w-1/2 pl-20">Trip Range</th>
                          <th className="px-8 py-4 w-1/2">Rent Amount</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {rentalSlabs.length === 0 ? (
                          <tr><td colSpan={2} className="p-6 text-center text-slate-400">No rental plan configured.</td></tr>
                       ) : (
                          rentalSlabs.map((slab) => (
                             <tr key={slab.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-8 py-4 pl-20 font-bold text-slate-700">
                                   {slab.minTrips} – {slab.maxTrips === null ? '∞' : slab.maxTrips}
                                </td>
                                <td className="px-8 py-4 font-bold text-emerald-600">
                                   {formatCurrency(slab.rentAmount)}
                                </td>
                             </tr>
                          ))
                       )}
                    </tbody>
                 </table>
              </div>
          )}
       </div>

       {/* EDIT MODAL */}
       {editingBillId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border-t-4 border-amber-500">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800">Edit Bill Details</h3>
                      <button onClick={() => setEditingBillId(null)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  <p className="text-slate-500 text-sm mb-4">Modify the parameters for this specific bill.</p>
                  
                  <div className="space-y-4 mb-6">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Days Worked</label>
                          <input 
                              type="number" 
                              value={editFormData.daysWorked}
                              onChange={(e) => setEditFormData({...editFormData, daysWorked: parseFloat(e.target.value) || 0})}
                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                      </div>
                      
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Rent / Day (₹)</label>
                          <input 
                              type="number" 
                              value={editFormData.rentPerDay}
                              onChange={(e) => setEditFormData({...editFormData, rentPerDay: parseFloat(e.target.value) || 0})}
                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          <p className="text-[10px] text-amber-600 mt-1">Changing this updates all Daily Entries for this week.</p>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Adjustments (₹)</label>
                          <input 
                              type="number" 
                              value={editFormData.adjustments}
                              onChange={(e) => setEditFormData({...editFormData, adjustments: parseFloat(e.target.value) || 0})}
                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                      </div>
                  </div>

                  <div className="flex flex-col gap-3">
                      <div className="flex gap-3">
                          <button onClick={() => setEditingBillId(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50">Cancel</button>
                          <button onClick={saveBillChanges} className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                              <Save size={16} /> Save Changes
                          </button>
                      </div>
                      <button 
                        onClick={resetToDefaults}
                        className="w-full py-2.5 border border-slate-200 text-rose-600 font-bold rounded-xl hover:bg-rose-50 flex items-center justify-center gap-2 text-sm"
                      >
                        <RotateCcw size={14} /> Reset to Defaults (Slab Calc)
                      </button>
                  </div>
              </div>
          </div>
       )}

    </div>
  );
};

export default DriverBillingsPage;