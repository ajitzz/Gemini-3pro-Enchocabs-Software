
import React, { useEffect, useState, useMemo } from 'react';
import { storageService } from '../services/storageService';
import { DriverSummary, RentalSlab, WeeklyWallet, DailyEntry, Driver, DriverBillingRecord } from '../types';
import { Users, ChevronDown, FileText, Briefcase, Download, Edit2, Save, X, Calendar, ChevronLeft, ChevronRight, Check, Copy, RotateCcw, Search, Clock, ChevronUp, Lock, AlertTriangle } from 'lucide-react';

const DriverBillingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<DriverSummary[]>([]);
  const [rentalSlabs, setRentalSlabs] = useState<RentalSlab[]>([]);
  const [weeklyWallets, setWeeklyWallets] = useState<WeeklyWallet[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [billingRecords, setBillingRecords] = useState<DriverBillingRecord[]>([]);
  const [billingApiError, setBillingApiError] = useState(false);
  
  // Filter & View State
  const [filterDriver, setFilterDriver] = useState('');
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0); // 0 = Latest week, -1 = All Time
  const [expandedBillIds, setExpandedBillIds] = useState<Set<string>>(new Set());
  
  // UI Toggles
  const [isBalancesExpanded, setIsBalancesExpanded] = useState(false); 
  const [isRentalExpanded, setIsRentalExpanded] = useState(false);
  const [isBillingExpanded, setIsBillingExpanded] = useState(true);

  // Edit Modal State
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
      daysWorked: 0,
      rentPerDay: 0,
      adjustments: 0
  });
  
  // UI Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const {
            summaries: calculatedSummaries,
            sortedDaily,
            sortedSlabs,
            weeklyWallets: loadedWeeklyWallets,
            drivers: driverData
        } = await storageService.getDriverBalanceSummaries();

        setSummaries(calculatedSummaries);
        setRentalSlabs(sortedSlabs);
        setWeeklyWallets(loadedWeeklyWallets);
        setDailyEntries(sortedDaily);
        setDrivers(driverData);

        // Attempt to load billings separately to handle 404/500 gracefully during deployment/migration
        try {
            const billingData = await storageService.getDriverBillings();
            setBillingRecords(billingData);
            setBillingApiError(false);
        } catch (billingErr) {
            console.warn("Could not load saved billings (endpoint might be missing):", billingErr);
            setBillingRecords([]);
            setBillingApiError(true);
        }

    } catch (err) {
        console.error("Error loading billing data:", err);
    } finally {
        setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
  };

  const formatIntegerCurrency = (val: number) => {
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  // --- ROBUST DATE HELPERS (UTC STRICT) ---
  const isValidDateStr = (dateStr: any) => {
      if (!dateStr || typeof dateStr !== 'string') return false;
      const clean = dateStr.substring(0, 10);
      // Basic format check YYYY-MM-DD
      return /^\d{4}-\d{2}-\d{2}$/.test(clean) && !clean.startsWith('1970');
  };

  // Forces any date to its Week Start (Monday) in UTC to align imports and manual data
  const getMondayISO = (dateStr: string) => {
      if (!isValidDateStr(dateStr)) return '';
      const clean = dateStr.substring(0, 10);
      const parts = clean.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      
      const d = new Date(Date.UTC(year, month, day));
      const dayOfWeek = d.getUTCDay(); // 0 (Sun) to 6 (Sat)
      
      // Calculate diff to Monday (Sun=0 -> -6, Mon=1 -> 0, Tue=2 -> -1)
      const diff = d.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      
      d.setUTCDate(diff);
      return d.toISOString().split('T')[0];
  };

  const getWeekRange = (dateStr: string) => {
      const startISO = getMondayISO(dateStr);
      if (!startISO) return { start: '', end: '' };
      
      const parts = startISO.split('-');
      const startUTC = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2])));
      
      startUTC.setUTCDate(startUTC.getUTCDate() + 6);
      const endISO = startUTC.toISOString().split('T')[0];
      
      return { start: startISO, end: endISO };
  };

  const toDisplayDate = (isoDate: string) => {
      if (!isValidDateStr(isoDate)) return '-';
      return isoDate.substring(0, 10).split('-').reverse().join('-');
  };

  const filteredSummaries = summaries.filter(s =>
    filterDriver === '' || s.driver.toLowerCase().includes(filterDriver.toLowerCase())
  );

  const balanceTotals = filteredSummaries.reduce(
    (acc, driver) => ({
      collection: acc.collection + driver.totalCollection,
      rent: acc.rent + driver.totalRent,
      fuel: acc.fuel + driver.totalFuel,
      wallet: acc.wallet + driver.totalWalletWeek,
      netPayout: acc.netPayout + driver.netPayout,
      finalTotal: acc.finalTotal + driver.finalTotal,
    }),
    { collection: 0, rent: 0, fuel: 0, wallet: 0, netPayout: 0, finalTotal: 0 }
  );

  const normalize = (s: string) => s ? s.toLowerCase().replace(/[^a-z0-9]/g, '').trim() : '';

  // --- 1. BILLING ENGINE ---
  const allBills = useMemo(() => {
    const mapped = billingRecords.map((bill) => {
        const weekKey = bill.weekStartDate;
        const weekRange = `${toDisplayDate(bill.weekStartDate)} to ${toDisplayDate(bill.weekEndDate)}`;
        const matchingWallet = weeklyWallets.find(w =>
            getMondayISO(w.weekStartDate) === weekKey && normalize(w.driver) === normalize(bill.driverName)
        );
        const isRentOverridden = matchingWallet?.rentOverride !== undefined && matchingWallet?.rentOverride !== null;
        const dailyDetails = dailyEntries.filter(d => {
            const range = getWeekRange(d.date);
            return range.start === weekKey && normalize(d.driver) === normalize(bill.driverName);
        });
        const normalizedDue = bill.due !== undefined ? bill.due : (bill.walletOverdue || 0);
        const normalizedWalletOverdue = bill.walletOverdue !== undefined ? bill.walletOverdue : normalizedDue;

        return {
            ...bill,
            due: normalizedDue,
            walletOverdue: normalizedWalletOverdue,
            driver: bill.driverName,
            weekRange,
            weekKey,
            startDate: bill.weekStartDate,
            endDate: bill.weekEndDate,
            calculatedDays: bill.daysWorked,
            dailyDetails,
            weeklyDetails: matchingWallet ?? null,
            isProvisional: false,
            isRentOverridden,
            isAggregate: false,
            isSaved: true
        };
    });

    return mapped.sort((a, b) => {
        if (b.weekKey !== a.weekKey) return b.weekKey.localeCompare(a.weekKey);
        return a.driver.localeCompare(b.driver);
    });
  }, [billingRecords, dailyEntries, weeklyWallets]);

  // --- FILTERS ---
  const availableWeeks = useMemo(() => {
      const weeks = Array.from(new Set(allBills.map(b => b.weekKey))) as string[];
      return weeks.sort((a, b) => b.localeCompare(a));
  }, [allBills]);

  const weekOptions = useMemo(() => {
      const opts = availableWeeks.map((weekKey, index) => {
           const bill = allBills.find(b => b.weekKey === weekKey);
           return { 
               index: index, 
               label: bill ? bill.weekRange : toDisplayDate(weekKey as string)
           };
      });
      return [{ index: -1, label: "All Time (Aggregate)" }, ...opts];
  }, [availableWeeks, allBills]);

  const currentWeekKey = availableWeeks[currentWeekIndex];
  
  const displayedBills = useMemo(() => {
      if (currentWeekIndex === -1) {
          // --- ALL TIME AGGREGATE LOGIC ---
          const aggMap = new Map<string, any>();
          
          allBills.forEach(bill => {
              if (filterDriver && !bill.driver.toLowerCase().includes(filterDriver.toLowerCase())) return;

              if (!aggMap.has(bill.driver)) {
                  aggMap.set(bill.driver, {
                      id: `agg-${bill.driver}`,
                      driver: bill.driver,
                  qrCode: bill.qrCode,
                  daysWorked: 0,
                  trips: 0,
                  rentTotal: 0,
                  collection: 0,
                  due: 0,
                  fuel: 0,
                  wallet: 0,
                  walletOverdue: 0,
                  adjustments: 0,
                  payout: 0,
                  weekRange: 'All Time',
                  isAggregate: true,
                  isProvisional: false,
                      isSaved: false
                  });
              }
              
              const entry = aggMap.get(bill.driver);
              // Use standardized field
              const ovr = (bill as any).walletOverdue || 0;
              const dueVal = (bill as any).due !== undefined ? (bill as any).due : ovr;

              entry.daysWorked += (bill.daysWorked || 0);
              entry.trips += (bill.trips || 0);
              entry.rentTotal += (bill.rentTotal || 0);
              entry.collection += (bill.collection || 0);
              entry.due += dueVal;
              entry.fuel += (bill.fuel || 0);
              entry.wallet += (bill.wallet || 0);
              entry.walletOverdue += ovr;
              entry.adjustments += (bill.adjustments || 0);
              entry.payout += (bill.payout || 0);
          });

          return Array.from(aggMap.values()).map(e => ({
              ...e,
              rentPerDay: e.daysWorked > 0 ? e.rentTotal / e.daysWorked : 0
          }));
      }

      if (!currentWeekKey) return [];
      
      return allBills.filter(b => b.weekKey === currentWeekKey && 
        (filterDriver === '' || b.driver.toLowerCase().includes(filterDriver.toLowerCase()))
      );
  }, [allBills, currentWeekKey, filterDriver, currentWeekIndex]);

  const currentWeekRange = currentWeekIndex === -1 ? "All Time Summary" : (displayedBills.length > 0 && displayedBills[0] ? displayedBills[0].weekRange : (
      currentWeekKey ? `${toDisplayDate(currentWeekKey as string)}` : ''
  ));

  const calculateWalletWeek = (source: any) => {
      const earnings = Number(source?.earnings ?? source?.collection ?? 0) || 0;
      const refund = Number(source?.refund ?? 0) || 0;
      const diff = Number(source?.diff ?? 0) || 0;
      const cash = Number(source?.cash ?? 0) || 0;
      const charges = Number(source?.charges ?? 0) || 0;

      return earnings + refund - (diff + cash + charges);
  };

  const deriveWalletWeek = (bill: any) => {
      if (bill.weeklyDetails) return calculateWalletWeek(bill.weeklyDetails);
      if (bill.wallet !== undefined && bill.wallet !== null) return Number(bill.wallet) || 0;
      return calculateWalletWeek(bill);
  };

  const billingTotals = useMemo(() => {
      const totals = displayedBills.reduce((acc, bill) => {
          acc.daysWorked += bill.daysWorked || 0;
          acc.trips += bill.trips || 0;
          acc.rentTotal += bill.rentTotal || 0;
          acc.collection += bill.collection || 0;
          acc.due += bill.due || 0;
          acc.fuel += bill.fuel || 0;
          acc.wallet += deriveWalletWeek(bill);
          acc.walletOverdue += bill.walletOverdue || 0;
          acc.adjustments += bill.adjustments || 0;
          acc.payout += bill.payout || 0;
          return acc;
      }, {
          daysWorked: 0,
          trips: 0,
          rentTotal: 0,
          collection: 0,
          due: 0,
          fuel: 0,
          wallet: 0,
          walletOverdue: 0,
          adjustments: 0,
          payout: 0
      });

      return {
          daysWorked: Math.round(totals.daysWorked),
          trips: Math.round(totals.trips),
          rentTotal: Math.round(totals.rentTotal),
          collection: Math.round(totals.collection),
          due: Math.round(totals.due),
          fuel: Math.round(totals.fuel),
          wallet: Math.round(totals.wallet),
          walletOverdue: Math.round(totals.walletOverdue),
          adjustments: Math.round(totals.adjustments),
          payout: Math.round(totals.payout)
      };
  }, [displayedBills]);

  const goToPreviousWeek = () => { if (currentWeekIndex !== -1 && currentWeekIndex < availableWeeks.length - 1) setCurrentWeekIndex(prev => prev + 1); };
  const goToNextWeek = () => { if (currentWeekIndex !== -1 && currentWeekIndex > 0) setCurrentWeekIndex(prev => prev - 1); };

  // --- ACTIONS ---
  const openEditModal = (bill: any) => {
      setEditingBillId(bill.id);
      setEditFormData({
          daysWorked: bill.daysWorked,
          rentPerDay: bill.rentPerDay,
           adjustments: bill.adjustments || 0
      });
  };
    const buildWalletPayload = (bill: any): WeeklyWallet => {
      return {
          id: bill.weeklyDetails?.id || bill.walletId || crypto.randomUUID(),
          driver: bill.driver,
          weekStartDate: bill.startDate,
          weekEndDate: bill.endDate,
          earnings: bill.weeklyDetails?.earnings ?? bill.collection ?? 0,
          refund: bill.weeklyDetails?.refund ?? 0,
          diff: bill.weeklyDetails?.diff ?? 0,
          cash: bill.weeklyDetails?.cash ?? 0,
          charges: bill.weeklyDetails?.charges ?? 0,
          trips: bill.weeklyDetails?.trips ?? bill.trips ?? 0,
          walletWeek: deriveWalletWeek(bill),
          daysWorkedOverride: bill.weeklyDetails?.daysWorkedOverride,
          rentOverride: bill.weeklyDetails?.rentOverride,
          adjustments: bill.weeklyDetails?.adjustments ?? bill.adjustments ?? 0,
          notes: bill.weeklyDetails?.notes || 'Generated from Billing Page'
      };
  };


  const saveBillChanges = async () => {
      if (!editingBillId) return;
      const bill = allBills.find(b => b.id === editingBillId);
      if (!bill) return;

      try {
           // If no weekly record exists, create a stub so the edit persists.
          const baseWallet = buildWalletPayload(bill);
          const updatedWallet: WeeklyWallet = {
              ...baseWallet,
              daysWorkedOverride: editFormData.daysWorked,
              rentOverride: editFormData.rentPerDay,
              adjustments: editFormData.adjustments
          };

          await storageService.saveWeeklyWallet(updatedWallet);
          setEditingBillId(null);
          await loadData();
      } catch (err) {
          console.error(err);
          alert("Failed to save bill changes");
      }
  };

  const finalizeBill = async (bill: any) => {
      if (!confirm(`Are you sure you want to finalize this bill for ${bill.driver}? This will lock the values for history.`)) return;
      
      const newRecord: DriverBillingRecord = {
          id: crypto.randomUUID(),
          driverName: bill.driver,
          driverId: drivers.find(d => d.name === bill.driver)?.id,
          qrCode: bill.qrCode,
          weekStartDate: bill.startDate,
          weekEndDate: bill.endDate,
          daysWorked: bill.daysWorked,
          trips: bill.trips,
          rentPerDay: bill.rentPerDay,
          rentTotal: bill.rentTotal,
          collection: bill.collection,
          due: bill.due,
          fuel: bill.fuel,
          wallet: bill.wallet,
          walletOverdue: bill.walletOverdue, // Uses normalized field
          adjustments: bill.adjustments,
          payout: bill.payout,
          status: 'Finalized',
          generatedAt: new Date().toISOString()
      };

      try {
          await storageService.saveDriverBilling(newRecord);
          await loadData();
          alert("Bill finalized successfully.");
      } catch (err: any) {
          alert("Failed to finalize bill: " + err.message);
      }
  };

  const resetToDefaults = async () => {
      if (!editingBillId) return;
      const bill = allBills.find(b => b.id === editingBillId);
      if (!bill) return;
      if (!confirm("Are you sure? This will revert overrides to standard slab calculations.")) return;

      try {
          if (bill.isProvisional) {
              setEditingBillId(null);
              return;
          }
        const baseWallet = buildWalletPayload(bill);
          const updatedWallet: WeeklyWallet = {
             ...baseWallet,
              daysWorkedOverride: undefined,
              rentOverride: undefined,
              adjustments: 0
          };
          await storageService.saveWeeklyWallet(updatedWallet);
          setEditingBillId(null);
          await loadData();
      } catch (err) { console.error(err); }
  };

  // --- PDF ---
  const generateBillHTML = (bill: any) => {
      const dailyRows = bill.dailyDetails ? bill.dailyDetails.map((d: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${toDisplayDate(d.date)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.driver}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(d.rent)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(d.collection)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(d.fuel)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(d.due)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(d.adjustments ?? 0)}</td>
        </tr>
      `).join('') : '';

      return `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8"><title>Bill - ${bill.driver}</title>
            <style>body{font-family:'Helvetica',sans-serif;padding:40px;color:#333;max-width:800px;mx-auto}.header{text-align:center;margin-bottom:40px;border-bottom:2px solid #eee;padding-bottom:20px}.company-name{font-size:24px;font-weight:bold;color:#4f46e5}.bill-title{font-size:20px;margin-bottom:20px;font-weight:bold;text-align:center;text-transform:uppercase;letter-spacing:1px}.meta{display:flex;justify-content:space-between;margin-bottom:30px;background:#f8fafc;padding:20px;border-radius:8px}.summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:30px;font-size:14px}.label{font-weight:bold;color:#64748b}.value{text-align:right;font-weight:bold}.positive{color:#16a34a}.negative{color:#dc2626}.total-section{background:#f1f5f9;padding:20px;border-radius:8px;margin-top:20px}.total-row{font-size:20px;font-weight:bold;display:flex;justify-content:space-between;border-top:2px solid #cbd5e1;padding-top:15px}.section-title{font-size:14px;font-weight:bold;margin-top:40px;margin-bottom:10px;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;background:#f8fafc;padding:8px;color:#64748b;font-weight:bold}.footer{margin-top:60px;font-size:10px;text-align:center;color:#94a3b8}.provisional-stamp{position:absolute;top:150px;left:50%;transform:translate(-50%,-50%) rotate(-15deg);font-size:60px;color:rgba(200,200,200,0.3);font-weight:bold;border:4px solid rgba(200,200,200,0.3);padding:10px 40px;border-radius:10px;pointer-events:none}</style>
          </head>
          <body>
            ${bill.isProvisional ? '<div class="provisional-stamp">PROVISIONAL</div>' : ''}
            <div class="header"><div class="company-name">ENCHO CABS</div><div>A Unit of Encho Enterprises</div></div>
            <div class="meta"><div><div><strong>Driver:</strong> ${bill.driver}</div><div style="margin-top:5px;"><strong>Vehicle QR:</strong> ${bill.qrCode}</div></div><div style="text-align:right;"><div><strong>Week:</strong> ${bill.weekRange}</div></div></div>
            <div class="bill-title">${bill.isProvisional ? 'Provisional Statement' : (bill.isSaved ? 'Finalized Bill' : 'Payment Statement')}</div>
            <div class="summary-grid">
               <div class="label">Total Trips (Wallet)</div><div class="value">${bill.trips}</div>
               <div class="label">Rent / Day</div><div class="value">${formatCurrency(bill.rentPerDay)}</div>
               <div class="label">Days Worked</div><div class="value">${bill.daysWorked}</div>
               <div class="label">Total Rent</div><div class="value negative">- ${formatCurrency(bill.rentTotal)}</div>
               <div class="label">Fuel Advances</div><div class="value negative">- ${formatCurrency(bill.fuel)}</div>
               <div class="label">Wallet Earnings</div><div class="value positive">+ ${formatCurrency(bill.wallet)}</div>
               <div class="label">Rental Collection</div><div class="value positive">+ ${formatCurrency(bill.collection)}</div>
               <div class="label">Daily Dues</div><div class="value">${formatCurrency(bill.due)}</div>
               <div class="label">Wallet Overdue (Dues)</div><div class="value">${formatCurrency(bill.walletOverdue)}</div>
               <div class="label">Adjustments</div><div class="value">${formatCurrency(bill.adjustments)}</div>
            </div>
            <div class="total-section"><div class="total-row"><div>NET PAYOUT</div><div>${formatCurrency(bill.payout)}</div></div></div>
            ${dailyRows ? `<div class="section-title">DAILY ACTIVITY LOG</div><table><thead><tr><th>DATE</th><th>DRIVER</th><th style="text-align:right">RENT</th><th style="text-align:right">COLLECTION</th><th style="text-align:right">FUEL</th><th style="text-align:right">DUES</th><th style="text-align:right">ADJUSTMENTS</th></tr></thead><tbody>${dailyRows}</tbody></table>` : ''}
            <div class="footer">System Generated Bill • Encho Cabs</div>
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
      setCopiedId(bill.id);
      setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpandBill = (id: string) => {
      const newSet = new Set(expandedBillIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedBillIds(newSet);
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
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
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
                        <th className="px-6 py-4 font-semibold text-right tracking-wider">Net Payout</th>
                        <th className="px-6 py-4 font-semibold text-right tracking-wider">Net Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                         <tr><td colSpan={7} className="p-8 text-center text-slate-400">Loading balances...</td></tr>
                      ) : filteredSummaries.length === 0 ? (
                         <tr><td colSpan={7} className="p-8 text-center text-slate-400">No drivers found.</td></tr>
                      ) : (
                        filteredSummaries.map((driver) => (
                          <tr key={driver.driver} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-6 py-4 font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{driver.driver}</td>
                            <td className="px-6 py-4 text-right text-slate-600 font-medium">{formatCurrency(driver.totalCollection)}</td>
                            <td className="px-6 py-4 text-right text-slate-400">{formatCurrency(driver.totalRent)}</td>
                            <td className="px-6 py-4 text-right text-slate-400">{formatCurrency(driver.totalFuel)}</td>
                            <td className="px-6 py-4 text-right text-slate-500 font-medium">{formatCurrency(driver.totalWalletWeek)}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${
                                  driver.netPayout < 0
                                    ? 'bg-rose-50 text-rose-700 border-rose-100'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}>
                                  {formatCurrency(driver.netPayout)}
                                </span>
                                {driver.netPayoutSource === 'latest-wallet' && driver.netPayoutRange && (
                                  <span className="text-[10px] leading-none text-slate-400 font-semibold uppercase tracking-[0.08em]">
                                    Till {driver.netPayoutRange}
                                  </span>
                                )}
                              </div>
                            </td>
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
                   <tfoot className="bg-slate-50 text-slate-700 font-bold border-t border-slate-100">
                      <tr>
                        <td className="px-6 py-3">Totals</td>
                        <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.collection)}</td>
                        <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.rent)}</td>
                        <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.fuel)}</td>
                        <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.wallet)}</td>
                        <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.netPayout)}</td>
                        <td className="px-6 py-3 text-right">{formatCurrency(balanceTotals.finalTotal)}</td>
                      </tr>
                    </tfoot>
                   {displayedBills.length > 0 && (
                      <tfoot className="bg-slate-50 text-slate-700 font-bold border-t border-slate-100">
                        <tr>
                          <td className="px-6 py-3">Totals</td>
                          <td className="px-6 py-3 text-slate-400">—</td>
                          <td className="px-6 py-3 text-center">{Math.round(billingTotals.daysWorked)}</td>
                          <td className="px-6 py-3 text-center">{Math.round(billingTotals.trips)}</td>
                          <td className="px-6 py-3 text-right text-slate-400">—</td>
                          <td className="px-6 py-3 text-right text-rose-600">-{formatIntegerCurrency(billingTotals.rentTotal)}</td>
                          <td className="px-6 py-3 text-right text-emerald-600">+{formatIntegerCurrency(billingTotals.collection)}</td>
                          <td className="px-6 py-3 text-right">{formatIntegerCurrency(billingTotals.due)}</td>
                          <td className="px-6 py-3 text-right text-rose-500">-{formatIntegerCurrency(billingTotals.fuel)}</td>
                          <td className="px-6 py-3 text-right text-indigo-600">+{formatIntegerCurrency(billingTotals.wallet)}</td>
                          <td className="px-6 py-3 text-right">{formatIntegerCurrency(billingTotals.walletOverdue)}</td>
                          <td className="px-6 py-3 text-right text-amber-600">{formatIntegerCurrency(billingTotals.adjustments)}</td>
                          <td className="px-6 py-3 text-right">{formatIntegerCurrency(billingTotals.payout)}</td>
                          <td className="px-6 py-3 text-center bg-white sticky right-0 shadow-[-4px_0_10px_-2px_rgba(0,0,0,0.02)]">—</td>
                        </tr>
                      </tfoot>
                   )}
                </table>
               </div>
            </div>
          )}
       </div>


       {/* 2. DRIVER BILLING SUMMARY */}
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
                {billingApiError && (
                    <div className="bg-amber-50 p-4 border-b border-amber-100 text-amber-800 text-sm flex items-center gap-2 px-6">
                        <AlertTriangle size={16} />
                        <span><strong>Connection Warning:</strong> Billing history server endpoint is unavailable. Showing calculated data only.</span>
                    </div>
                )}
                
                {/* Week Pagination & Filters */}
                <div className="px-6 py-6 bg-slate-50 border-b border-slate-100 flex flex-col items-center gap-6">
                    
                    {/* Centered Week Navigator */}
                    <div className="flex items-center bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 w-full max-w-md mx-auto justify-between">
                        <button 
                            onClick={goToPreviousWeek} 
                            disabled={currentWeekIndex === -1 || currentWeekIndex >= availableWeeks.length - 1}
                            className="p-3 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex-shrink-0"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        
                        <div className="px-4 text-center flex-1 relative group cursor-pointer">
                            {currentWeekKey || currentWeekIndex === -1 ? (
                                <>
                                    <div className="flex flex-col items-center pointer-events-none">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Billing Period</span>
                                        <span className="text-base md:text-lg font-bold text-slate-800 flex items-center justify-center gap-2 group-hover:text-indigo-600 transition-colors">
                                            <Calendar size={18} className="text-indigo-500 mb-0.5"/>
                                            {currentWeekRange}
                                            <ChevronDown size={14} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                        </span>
                                    </div>
                                    <select
                                        value={currentWeekIndex}
                                        onChange={(e) => setCurrentWeekIndex(Number(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                                        title="Select Week"
                                    >
                                        {weekOptions.map((opt) => (
                                            <option key={opt.index} value={opt.index}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </>
                            ) : (
                                <span className="text-sm text-slate-400 font-medium">No Data Available</span>
                            )}
                        </div>

                        <button 
                            onClick={goToNextWeek} 
                            disabled={currentWeekIndex === -1 || currentWeekIndex === 0}
                            className="p-3 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex-shrink-0"
                        >
                            <ChevronRight size={24} />
                        </button>
                    </div>
                    
                    {/* Driver Search */}
                    <div className="relative group w-full max-w-md">
                        <input 
                          type="text" 
                          placeholder="Search driver in selected week..." 
                          value={filterDriver}
                          onChange={(e) => setFilterDriver(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                        />
                        <Search size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                       <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                          <tr>
                             <th className="px-6 py-4">DRIVER</th>
                             <th className="px-6 py-4">QR</th>
                             <th className="px-6 py-4 text-center">DAYS WORKED</th>
                             <th className="px-6 py-4 text-center">TRIPS</th>
                             <th className="px-6 py-4 text-right">RENT / DAY</th>
                             <th className="px-6 py-4 text-right">RENT TOTAL</th>
                             <th className="px-6 py-4 text-right">COLLECTION</th>
                             <th className="px-6 py-4 text-right">DUE</th>
                             <th className="px-6 py-4 text-right">FUEL</th>
                             <th className="px-6 py-4 text-right">WALLET</th>
                             <th className="px-6 py-4 text-right">WALLET OVERDUE</th>
                             <th className="px-6 py-4 text-right">ADJUSTMENTS</th>
                             <th className="px-6 py-4 text-right">PAYOUT</th>
                             <th className="px-6 py-4 text-center bg-slate-50 sticky right-0 z-10 shadow-[-4px_0_10px_-2px_rgba(0,0,0,0.05)]">ACTIONS</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {displayedBills.length === 0 ? (
                             <tr><td colSpan={14} className="p-12 text-center text-slate-400">No billings found for this week.</td></tr>
                          ) : (
                             displayedBills.map((bill) => (
                                <React.Fragment key={bill.id}>
                                <tr className={`hover:bg-slate-50 transition-colors ${bill.isProvisional ? 'bg-amber-50/30' : bill.isSaved ? 'bg-indigo-50/20' : ''}`}>
                                   <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-2">
                                      <button 
                                        onClick={() => toggleExpandBill(bill.id)} 
                                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                                      >
                                          {expandedBillIds.has(bill.id) ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                      </button>
                                      {bill.driver}
                                      {bill.isProvisional && <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-amber-100 text-amber-700 uppercase tracking-wide border border-amber-200">Prov</span>}
                                      {bill.isSaved && <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-indigo-100 text-indigo-700 uppercase tracking-wide border border-indigo-200 flex items-center gap-0.5"><Lock size={8}/> Saved</span>}
                                   </td>
                                   <td className="px-6 py-4 text-slate-500">{bill.qrCode}</td>
                                   <td className="px-6 py-4 text-center">
                                      <span className={`font-bold ${bill.daysWorked !== bill.calculatedDays && !bill.isAggregate ? 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded' : 'text-slate-800'}`}>
                                          {bill.daysWorked}
                                      </span>
                                   </td>
                                   <td className="px-6 py-4 font-bold text-center">
                                      {bill.isProvisional ? <span className="text-slate-300">-</span> : bill.trips}
                                   </td>
                                   <td className="px-6 py-4 text-right">
                                      <span className={`${bill.isRentOverridden && !bill.isAggregate ? 'text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded' : 'text-slate-500'}`}>
                                          {formatCurrency(bill.rentPerDay)}
                                      </span>
                                   </td>
                                   <td className="px-6 py-4 text-right font-medium text-rose-600">-{formatCurrency(bill.rentTotal)}</td>
                                   <td className="px-6 py-4 text-right font-bold text-emerald-600">+{formatCurrency(bill.collection)}</td>
                                   <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(bill.due)}</td>
                                   <td className="px-6 py-4 text-right text-rose-500">-{formatCurrency(bill.fuel)}</td>
                                   <td className="px-6 py-4 text-right text-indigo-600">
                                       {bill.isProvisional ? <span className="text-slate-300">-</span> : `+${formatCurrency(bill.wallet)}`}
                                   </td>
                                   <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(bill.walletOverdue)}</td>
                                   <td className="px-6 py-4 text-right text-amber-600 font-medium">{formatCurrency(bill.adjustments)}</td>
                                   <td className="px-6 py-4 text-right">
                                      <span className={`px-3 py-1 rounded-lg font-bold border ${bill.payout < 0 ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                         {formatCurrency(bill.payout)}
                                      </span>
                                   </td>
                                   <td className="px-6 py-4 text-center bg-white sticky right-0 z-10 shadow-[-4px_0_10px_-2px_rgba(0,0,0,0.02)]">
                                      <div className="flex items-center justify-center gap-2">
                                         {!bill.isAggregate && (
                                            <>
                                                <button onClick={() => openEditModal(bill)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Adjustments / Rent">
                                                    <Edit2 size={16} />
                                                </button>
                                                {!bill.isSaved && (
                                                  <button
                                                        onClick={() => finalizeBill(bill)}
                                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                        title="Finalize & Save Bill"
                                                    >
                                                        <Save size={16} />
                                                    </button>
                                               
                                                )}
                                               <button
                                                    onClick={() => copyBillLink(bill)}
                                                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors relative"
                                                    title="Copy Bill Link"
                                                >
                                                    {copiedId === bill.id ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                                                </button>
                                                <button onClick={() => downloadBill(bill)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Download Bill">
                                                    <Download size={16} />
                                                </button>
                                            </>
                                         )}
                                         {bill.isAggregate && (
                                             <span className="text-[10px] text-slate-400 italic">Aggregate</span>
                                         )}
                                      </div>
                                   </td>
                                </tr>
                                {expandedBillIds.has(bill.id) && (
                                  <tr key={`${bill.id}-expanded`}>
                                      <td colSpan={14} className="px-6 py-4 bg-slate-50/50 shadow-inner">
                                          <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Daily Breakdown for {bill.driver}</div>
                                          <table className="w-full text-xs bg-white rounded-lg border border-slate-200 overflow-hidden">
                                              <thead className="bg-slate-100 text-slate-500 font-semibold">
                                                  <tr>
                                                      <th className="px-4 py-2 text-left">Date</th>
                                                      <th className="px-4 py-2 text-left">Shift</th>
                                                      <th className="px-4 py-2 text-right">Collection</th>
                                                      <th className="px-4 py-2 text-right">Rent</th>
                                                      <th className="px-4 py-2 text-right">Fuel</th>
                                                      <th className="px-4 py-2 text-right">Due</th>
                                                  </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100">
                                                  {(bill.dailyDetails || []).map((d: any) => (
                                                      <tr key={d.id}>
                                                          <td className="px-4 py-2 text-slate-700">{toDisplayDate(d.date)}</td>
                                                          <td className="px-4 py-2 text-slate-600">{d.shift}</td>
                                                          <td className="px-4 py-2 text-right text-emerald-600 font-medium">{formatCurrency(d.collection)}</td>
                                                          <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(d.rent)}</td>
                                                          <td className="px-4 py-2 text-right text-rose-500">{formatCurrency(d.fuel)}</td>
                                                          <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(d.due)}</td>
                                                      </tr>
                                                  ))}
                                                  {(!bill.dailyDetails || bill.dailyDetails.length === 0) && (
                                                      <tr><td colSpan={6} className="p-4 text-center text-slate-400">No daily entries linked to this bill period.</td></tr>
                                                  )}
                                              </tbody>
                                          </table>
                                      </td>
                                  </tr>
                                )}
                             </React.Fragment>
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
                  <p className="text-slate-500 text-sm mb-4">Modify the parameters for this specific bill. Updates will refresh the billing summary and push rent changes to linked daily entries for the same week.</p>
                  
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
                          <p className="text-[10px] text-amber-600 mt-1">This will override standard slab calculations.</p>
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

