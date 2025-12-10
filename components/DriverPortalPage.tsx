
import React, { useEffect, useState, useMemo } from 'react';
import { storageService } from '../services/storageService';
import { DailyEntry, WeeklyWallet, Driver, RentalSlab } from '../types';
import { useAuth } from '../contexts/AuthContext'; // Import Auth Context
import { 
  Download, Calendar, Wallet, FileText, ChevronRight, LogOut, 
  UserCircle, TrendingUp, TrendingDown, DollarSign, MapPin, 
  CheckCircle, AlertCircle, Eye, X, ShieldCheck, Users, ArrowLeft, Lock, ArrowRight, Gauge, BarChart3, ChevronDown 
} from 'lucide-react';

const DriverPortalPage: React.FC = () => {
  // Use Global Auth
  const { user, logout } = useAuth();
  
  // Admin Context
  const [driversList, setDriversList] = useState<Driver[]>([]);
  const [globalDaily, setGlobalDaily] = useState<DailyEntry[]>([]);
  const [globalWeekly, setGlobalWeekly] = useState<WeeklyWallet[]>([]);

  // Manager Context
  const [myTeam, setMyTeam] = useState<Driver[]>([]);
  const [teamBalances, setTeamBalances] = useState<Record<string, number>>({});
  
  // View Context (Self vs Managed)
  const [viewingAsDriver, setViewingAsDriver] = useState<Driver | null>(null);

  // Data (Filtered for viewingAsDriver)
  const [rawDaily, setRawDaily] = useState<DailyEntry[]>([]);
  const [rawWeekly, setRawWeekly] = useState<WeeklyWallet[]>([]);
  const [rentalSlabs, setRentalSlabs] = useState<RentalSlab[]>([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'home' | 'daily' | 'billing'>('home');
  const [viewingBill, setViewingBill] = useState<any | null>(null);

  useEffect(() => {
    // Initial Load based on Authenticated User
    if (user) {
        initializePortal();
    }
  }, [user]);

  const initializePortal = async () => {
      // 1. Fetch Global Data needed for calculations
      const [allDrivers, allDaily, allWeekly, slabs] = await Promise.all([
          storageService.getDrivers(),
          storageService.getDailyEntries(),
          storageService.getWeeklyWallets(),
          storageService.getDriverRentalSlabs()
      ]);
      setRentalSlabs(slabs.sort((a, b) => a.minTrips - b.minTrips));

      // Cache data for Admin switching capabilities
      if (user?.role === 'admin' || user?.role === 'super_admin') {
          setDriversList(allDrivers.sort((a, b) => a.name.localeCompare(b.name)));
          setGlobalDaily(allDaily);
          setGlobalWeekly(allWeekly);
      }

      // 2. Identify the Current Driver Context
      let targetDriver: Driver | undefined;

      if (user?.role === 'driver' && user.driverId) {
          targetDriver = allDrivers.find(d => d.id === user.driverId);
      } else if ((user?.role === 'admin' || user?.role === 'super_admin')) {
          // Admin View: If they have a linked driver profile via email, use it.
          // Otherwise, maybe just pick the first active one or show a selector?
          targetDriver = allDrivers.find(d => d.email === user.email);
          
          if (!targetDriver) {
              // Fallback for Admin testing: Pick the first active driver to simulate
              targetDriver = allDrivers.find(d => !d.terminationDate);
          }
      }

      if (targetDriver) {
          // 3. Manager Logic
          if (targetDriver.isManager) {
              const accessList = await storageService.getManagerAccess();
              const myAccess = accessList.find(a => a.managerId === targetDriver!.id);
              if (myAccess && myAccess.childDriverIds.length > 0) {
                  const teamMembers = allDrivers.filter(d => myAccess.childDriverIds.includes(d.id));
                  setMyTeam(teamMembers);
                  
                  // Calculate Team Balances
                  const balances: Record<string, number> = {};
                  teamMembers.forEach(member => {
                      const memberDaily = allDaily.filter(d => d.driver === member.name);
                      const memberWeekly = allWeekly.filter(w => w.driver === member.name);
                      balances[member.id] = calculateNetBalance(memberDaily, memberWeekly);
                  });
                  setTeamBalances(balances);
              }
          }

          // 4. Set View
          switchToDriverView(targetDriver, allDaily, allWeekly);
      }
  };

  const switchToDriverView = (targetDriver: Driver, allDaily: DailyEntry[], allWeekly: WeeklyWallet[]) => {
      setViewingAsDriver(targetDriver);
      const myDaily = allDaily.filter(d => d.driver === targetDriver.name).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const myWeekly = allWeekly.filter(w => w.driver === targetDriver.name).sort((a,b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime());
      setRawDaily(myDaily);
      setRawWeekly(myWeekly);
      setActiveTab('home');
      window.scrollTo(0, 0);
  };

  const handleAdminDriverSwitch = (driverId: string) => {
      const target = driversList.find(d => d.id === driverId);
      if (target) {
          switchToDriverView(target, globalDaily, globalWeekly);
      }
  };

  const returnToDashboard = async () => {
      // Return to "Self" view
      if (user) {
          initializePortal();
      }
  };
  
  const viewTeamMember = async (member: Driver) => {
      const [allDaily, allWeekly] = await Promise.all([
        storageService.getDailyEntries(),
        storageService.getWeeklyWallets()
      ]);
      switchToDriverView(member, allDaily, allWeekly);
  };

  // Helper Calculation
  const calculateNetBalance = (daily: DailyEntry[], weekly: WeeklyWallet[]) => {
      const totalCollection = daily.reduce((sum, d) => sum + d.collection, 0);
      const totalRawRent = daily.reduce((sum, d) => sum + d.rent, 0);
      const totalFuel = daily.reduce((sum, d) => sum + d.fuel, 0);
      const totalDue = daily.reduce((sum, d) => sum + d.due, 0);
      const totalWallet = weekly.reduce((sum, w) => sum + w.walletWeek, 0);
      const totalPayouts = daily.reduce((sum, d) => sum + (d.payout || 0), 0);
      return totalCollection - totalRawRent - totalFuel + totalDue + totalWallet - totalPayouts;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
  };

  // --- 1. BILLING CALCULATION ENGINE ---
  const billingData = useMemo(() => {
    if (!viewingAsDriver) return [];

    return rawWeekly.map(wallet => {
       const startDate = new Date(wallet.weekStartDate);
       const endDate = new Date(wallet.weekEndDate);
       
       const relevantDaily = rawDaily.filter(d => {
          const entryDate = new Date(d.date);
          return entryDate >= startDate && entryDate <= endDate;
       });

       const totalTrips = wallet.trips || 0; 
       let rentTotal = 0;
       let rentRateUsed = 0;
       
       const isLowTrips = totalTrips < 70;

       if (isLowTrips) {
           const slab = rentalSlabs.find(s => 
               totalTrips >= s.minTrips && (s.maxTrips === null || totalTrips <= s.maxTrips)
           );
           rentRateUsed = slab ? slab.rentAmount : 950; 
           rentTotal = rentRateUsed * 7;
       } else {
           rentTotal = relevantDaily.reduce((sum, d) => sum + d.rent, 0);
           rentRateUsed = relevantDaily.length > 0 ? rentTotal / relevantDaily.length : 0; 
       }

       const collection = relevantDaily.reduce((sum, d) => sum + d.collection, 0);
       const fuel = relevantDaily.reduce((sum, d) => sum + d.fuel, 0);
       const overdue = relevantDaily.reduce((sum, d) => sum + d.due, 0);
       const walletAmount = wallet.walletWeek;
       const grossEarnings = wallet.earnings || 0; // Use Gross Earnings for Stats

       const adjustments = 0; // Adjustments not visible/editable in portal, assumed 0 for display consistency
       const payout = collection - rentTotal - fuel + overdue + walletAmount + adjustments;
       
       const avgPerTrip = totalTrips > 0 ? grossEarnings / totalTrips : 0;

       return {
           id: wallet.id,
           weekRange: `${new Date(wallet.weekStartDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})} to ${new Date(wallet.weekEndDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}`,
           startDate: wallet.weekStartDate,
           endDate: wallet.weekEndDate,
           driver: wallet.driver,
           qrCode: relevantDaily[0]?.qrCode || 'N/A',
           trips: totalTrips,
           grossEarnings,
           avgPerTrip,
           rentPerDay: rentRateUsed,
           rentTotal,
           collection,
           fuel,
           wallet: walletAmount,
           overdue,
           adjustments,
           payout,
           dailyDetails: relevantDaily,
           weeklyDetails: wallet,
           isAdjusted: isLowTrips 
       };
    });
  }, [rawWeekly, rawDaily, rentalSlabs, viewingAsDriver]);

  // --- 2. BALANCE CALCULATION ---
  const balanceSummary = useMemo(() => {
      const netBalance = calculateNetBalance(rawDaily, rawWeekly);
      const totalCollection = rawDaily.reduce((sum, d) => sum + d.collection, 0);
      const totalRawRent = rawDaily.reduce((sum, d) => sum + d.rent, 0);
      const totalFuel = rawDaily.reduce((sum, d) => sum + d.fuel, 0);
      const totalWallet = rawWeekly.reduce((sum, w) => sum + w.walletWeek, 0);
      
      return { netBalance, totalCollection, totalRawRent, totalFuel, totalWallet };
  }, [rawDaily, rawWeekly]);

  // --- 3. PERFORMANCE STATS (Monthly/Yearly) ---
  const performanceStats = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      let monthTrips = 0;
      let monthEarnings = 0;
      let yearTrips = 0;
      let yearEarnings = 0;

      rawWeekly.forEach(w => {
          // Strict Date Parsing to avoid UTC Timezone offsets shifting the month
          if (!w.weekEndDate) return;
          const parts = w.weekEndDate.split('-');
          if (parts.length !== 3) return;
          
          const wYear = parseInt(parts[0], 10);
          const wMonth = parseInt(parts[1], 10) - 1; // 0-indexed for comparison with getMonth()

          const earnings = Number(w.earnings) || 0;
          const trips = Number(w.trips) || 0;

          if (wYear === currentYear) {
              yearTrips += trips;
              yearEarnings += earnings;

              if (wMonth === currentMonth) {
                  monthTrips += trips;
                  monthEarnings += earnings;
              }
          }
      });

      return {
          month: { 
              trips: monthTrips, 
              earnings: monthEarnings, 
              avg: monthTrips > 0 ? monthEarnings / monthTrips : 0 
          },
          year: { 
              trips: yearTrips, 
              earnings: yearEarnings, 
              avg: yearTrips > 0 ? yearEarnings / yearTrips : 0 
          }
      };
  }, [rawWeekly]);


  // --- 4. BILL HTML ---
  const generateBillHTML = (bill: any) => {
      const dailyRows = bill.dailyDetails.map((d: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${d.date}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${d.driver}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${d.vehicle}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${d.shift}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 10px;">${d.qrCode || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: right;">${formatCurrency(d.rent)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: right;">${formatCurrency(d.collection)}</td>
        </tr>
      `).join('');

      return `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Bill - ${bill.driver}</title>
            <style>
              body { font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; background: white; }
              .header { text-align: center; margin-bottom: 40px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; }
              .company-name { font-size: 28px; font-weight: 800; color: #4338ca; letter-spacing: -0.5px; }
              .sub-company { font-size: 14px; color: #64748b; margin-top: 4px; font-weight: 500; }
              
              .meta-container { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; }
              .meta-group { display: flex; flex-direction: column; gap: 4px; }
              .meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; }
              .meta-value { font-size: 14px; font-weight: 600; color: #0f172a; }
              
              .section-header { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin: 32px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
              .first-section { margin-top: 0; }
              
              .payment-grid { display: grid; grid-template-columns: 1fr auto; row-gap: 12px; column-gap: 40px; font-size: 14px; }
              .pg-label { color: #475569; font-weight: 500; }
              .pg-value { font-weight: 600; text-align: right; }
              .positive { color: #16a34a; }
              .negative { color: #dc2626; }
              
              .net-payout-box { background: #f1f5f9; border-radius: 8px; padding: 16px 20px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; }
              .np-label { font-size: 16px; font-weight: 700; color: #334155; }
              .np-value { font-size: 24px; font-weight: 800; color: #0f172a; }

              table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
              th { text-align: left; background: #f8fafc; padding: 12px 8px; color: #64748b; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; }
              td { color: #334155; }
              
              .wallet-grid { display: grid; grid-template-columns: 1fr auto; gap: 8px; font-size: 13px; background: #fff; padding: 0; }
              .wg-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; }
              .wg-row:last-child { border-bottom: none; border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 12px; }
              .wg-total { font-weight: 800; color: #4338ca; font-size: 15px; }
              
              .footer { margin-top: 60px; font-size: 11px; text-align: center; color: #94a3b8; font-weight: 500; border-top: 1px solid #f1f5f9; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="company-name">ENCHO CABS</div>
              <div class="sub-company">A Unit of Encho Enterprises</div>
            </div>
            
            <div class="meta-container">
               <div class="meta-group">
                 <div><span class="meta-label">Driver Name</span> <div class="meta-value">${bill.driver}</div></div>
                 <div style="margin-top:12px;"><span class="meta-label">Vehicle QR</span> <div class="meta-value">${bill.qrCode}</div></div>
               </div>
               <div class="meta-group" style="text-align:right;">
                 <div><span class="meta-label">Billing Period</span> <div class="meta-value">${bill.weekRange}</div></div>
                 <div style="margin-top:12px;"><span class="meta-label">Generated On</span> <div class="meta-value">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
               </div>
            </div>

            <div class="section-header first-section">Payment Statement</div>
            <div class="payment-grid">
               <div class="pg-label">Total Trips Completed</div><div class="pg-value">${bill.trips}</div>
               <div class="pg-label">Rent / Day (Applied)</div><div class="pg-value">${formatCurrency(bill.rentPerDay)}</div>
               <div class="pg-label">Weekly Rent Deduction</div><div class="pg-value negative">- ${formatCurrency(bill.rentTotal)}</div>
               <div class="pg-label">Fuel Advances</div><div class="pg-value negative">- ${formatCurrency(bill.fuel)}</div>
               <div class="pg-label">Wallet Earnings (Weekly)</div><div class="pg-value positive">+ ${formatCurrency(bill.wallet)}</div>
               <div class="pg-label">Rental Collection</div><div class="pg-value positive">+ ${formatCurrency(bill.collection)}</div>
               <div class="pg-label">Previous Dues/Credit</div><div class="pg-value">${formatCurrency(bill.overdue)}</div>
               <div class="pg-label">Adjustments</div><div class="pg-value">${formatCurrency(bill.adjustments)}</div>
            </div>
            
            <div class="net-payout-box">
               <div class="np-label">NET PAYOUT</div>
               <div class="np-value">${formatCurrency(bill.payout)}</div>
            </div>

            <div class="section-header">Daily Activity Log</div>
            <table>
              <thead><tr><th>Date</th><th>Driver</th><th>Vehicle</th><th>Shift</th><th>QR</th><th style="text-align:right">Rent</th><th style="text-align:right">Collection</th></tr></thead>
              <tbody>${dailyRows}</tbody>
            </table>

            <div class="section-header">Weekly Wallet Breakdown</div>
             <div class="wallet-grid">
               <div class="wg-row"><span class="pg-label">Gross Earnings</span><span class="pg-value">${formatCurrency(bill.weeklyDetails.earnings)}</span></div>
               <div class="wg-row"><span class="pg-label">Refunds</span><span class="pg-value">${formatCurrency(bill.weeklyDetails.refund)}</span></div>
               <div class="wg-row"><span class="pg-label">Deductions</span><span class="pg-value negative">-${formatCurrency(bill.weeklyDetails.diff)}</span></div>
               <div class="wg-row"><span class="pg-label">Charges</span><span class="pg-value negative">-${formatCurrency(bill.weeklyDetails.charges)}</span></div>
               <div class="wg-row"><span class="pg-label">Cash (Wallet)</span><span class="pg-value negative">-${formatCurrency(bill.weeklyDetails.cash)}</span></div>
               <div class="wg-row wg-total"><span>Wallet Total</span><span>${formatCurrency(bill.wallet)}</span></div>
            </div>

            <div class="footer">
               System Generated Bill • Encho Cabs Driver Portal
            </div>
          </body>
        </html>
      `;
  };

  const handleDownloadBill = (bill: any) => {
      const content = generateBillHTML(bill);
      const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bill_${bill.driver.replace(/\s+/g, '_')}_${bill.startDate}.html`;
      a.click();
  };

  const isReadOnly = user?.role !== 'driver';
  const isSelf = user?.role === 'driver' && viewingAsDriver?.id === user.driverId;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // --- MAIN APP ---
  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-900">
        
        {/* READ ONLY BANNER */}
        {!isSelf && (
            <div className="bg-amber-100 px-4 py-3 text-amber-800 text-xs font-bold border-b border-amber-200 sticky top-0 z-40 flex justify-between items-center transition-all">
                <div className="flex items-center gap-2 flex-1">
                    <Eye size={16}/> 
                    {isAdmin ? (
                        <div className="flex items-center gap-2 w-full max-w-xs">
                            <span className="whitespace-nowrap">Admin Mode: Viewing</span>
                            <div className="relative flex-1">
                                <select 
                                    className="w-full bg-white/50 border border-amber-300 rounded text-amber-900 text-xs font-bold py-1 pl-2 pr-6 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer appearance-none"
                                    value={viewingAsDriver?.id || ''}
                                    onChange={(e) => handleAdminDriverSwitch(e.target.value)}
                                >
                                    {driversList.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-1 top-1.5 text-amber-700 pointer-events-none" />
                            </div>
                        </div>
                    ) : (
                        <span>Viewing as {viewingAsDriver?.name} (Manager View)</span>
                    )}
                </div>
                {/* Allow going back to Self if you are a driver, or back to dashboard if admin */}
                {user?.role === 'driver' && viewingAsDriver?.id !== user.driverId && (
                    <button 
                        onClick={returnToDashboard} 
                        className="bg-white px-3 py-1 rounded-full text-amber-900 shadow-sm flex items-center gap-1 active:scale-95 transition-transform whitespace-nowrap ml-2"
                    >
                        <ArrowLeft size={12}/> My Dashboard
                    </button>
                )}
            </div>
        )}

        {/* HEADER */}
        <div className="bg-white px-5 py-4 shadow-sm border-b border-slate-100 flex justify-between items-center relative z-30">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${!isSelf ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                    <UserCircle size={24} />
                </div>
                <div>
                    <h2 className="font-bold text-slate-800 leading-none flex items-center gap-1">
                        {viewingAsDriver?.name || 'Loading...'}
                        {viewingAsDriver?.isManager && <ShieldCheck size={14} className="text-indigo-500" />}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">{viewingAsDriver?.vehicle || 'No Vehicle Assigned'}</p>
                </div>
            </div>
            
            {/* Logout button only if self (if simulated view, maybe hide logout?) */}
            <button onClick={logout} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                <LogOut size={20} />
            </button>
        </div>

        {/* HERO BALANCE CARD (Home Tab) */}
        {activeTab === 'home' && (
            <div className="p-5 animate-fade-in space-y-6">
                <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-10">
                        <DollarSign size={120} />
                    </div>
                    <div className="relative z-10">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Net Payable Balance</p>
                        <div className="flex items-end gap-3 mb-6">
                            <span className="text-4xl font-bold tracking-tight">{formatCurrency(balanceSummary.netBalance)}</span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold mb-1.5 flex items-center gap-1 ${balanceSummary.netBalance >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                {balanceSummary.netBalance >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                                {balanceSummary.netBalance >= 0 ? 'You are Owed' : 'You Owe'}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 pt-6 border-t border-white/10">
                            <div>
                                <p className="text-slate-400 text-[10px] uppercase font-bold">Total Earnings</p>
                                <p className="text-lg font-bold text-emerald-400">+{formatCurrency(balanceSummary.totalCollection)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-400 uppercase font-bold text-[10px]">Deductions</p>
                                <p className="text-lg font-bold text-rose-400">-{formatCurrency(balanceSummary.totalRawRent + balanceSummary.totalFuel)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TEAM SECTION (Only for Managers) */}
                {viewingAsDriver?.isManager && myTeam.length > 0 && isSelf && (
                    <div>
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Users size={18} className="text-indigo-600"/> Team Overview
                            </h3>
                            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-bold">{myTeam.length} Members</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {myTeam.map(member => {
                                const bal = teamBalances[member.id] || 0;
                                return (
                                    <div 
                                      key={member.id}
                                      onClick={() => viewTeamMember(member)}
                                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center cursor-pointer hover:border-indigo-300 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                {member.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm group-hover:text-indigo-700">{member.name}</p>
                                                <p className="text-xs text-slate-400">{member.mobile}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold text-sm ${bal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {formatCurrency(bal)}
                                            </p>
                                            <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-bold uppercase">
                                                View <ChevronRight size={10}/>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Recent Activity */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">Recent Activity</h3>
                        <button onClick={() => setActiveTab('daily')} className="text-xs font-bold text-indigo-600">View All</button>
                    </div>
                    <div className="space-y-3">
                        {rawDaily.slice(0, 3).map(entry => (
                            <div key={entry.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600"><Calendar size={18} /></div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{entry.date}</p>
                                        <p className="text-xs text-slate-400">{entry.shift}</p>
                                    </div>
                                </div>
                                <span className="font-bold text-emerald-600 text-sm">+{formatCurrency(entry.collection)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* DAILY LOG TAB */}
        {activeTab === 'daily' && (
            <div className="p-5 animate-fade-in space-y-6">
                
                {/* 1. PERFORMANCE SUMMARY (Aggregated from Weekly Wallet) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Gauge className="text-indigo-600" size={20} />
                        <h3 className="font-bold text-slate-800">Performance Summary</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {/* Monthly Card */}
                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-4 text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-20"><Calendar size={40} /></div>
                            <p className="text-[10px] uppercase font-bold tracking-wider opacity-80 mb-1">This Month</p>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-2xl font-bold">{performanceStats.month.trips}</p>
                                    <p className="text-[10px] opacity-80">Trips</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold">{formatCurrency(performanceStats.month.earnings)}</p>
                                    <p className="text-[10px] opacity-80">Earnings</p>
                                </div>
                            </div>
                            <div className="mt-3 pt-2 border-t border-white/20 flex justify-between text-[10px] font-bold">
                                <span>Avg / Trip</span>
                                <span>{formatCurrency(performanceStats.month.avg)}</span>
                            </div>
                        </div>

                        {/* Yearly Card */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-5 text-slate-900"><BarChart3 size={40} /></div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">This Year</p>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-xl font-bold text-slate-800">{performanceStats.year.trips}</p>
                                    <p className="text-[10px] text-slate-400">Total Trips</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-base font-bold text-slate-700">{formatCurrency(performanceStats.year.earnings)}</p>
                                    <p className="text-[10px] text-slate-400">Total Revenue</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-slate-100 w-full"></div>

                {/* 2. DAILY LOG LIST */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-slate-800 text-lg">Daily Log</h3>
                        <span className="text-xs bg-white px-2 py-1 rounded border border-slate-200 text-slate-500 font-bold">{rawDaily.length} Entries</span>
                    </div>
                    
                    {rawDaily.map(entry => {
                        const associatedBill = billingData.find(b => {
                            const d = new Date(entry.date);
                            return d >= new Date(b.startDate) && d <= new Date(b.endDate);
                        });
                        
                        const displayRent = associatedBill ? associatedBill.rentPerDay : entry.rent;
                        const isRentAdjusted = associatedBill && associatedBill.rentPerDay !== entry.rent;

                        return (
                            <div key={entry.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                                {isRentAdjusted && (
                                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-bold px-2 py-1 rounded-bl-xl">
                                        RENT ADJUSTED
                                    </div>
                                )}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-slate-100 p-2 rounded-lg text-slate-500"><Calendar size={16} /></div>
                                        <div>
                                            <span className="font-bold text-slate-800 block">{new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                            <span className="text-xs text-slate-400 font-medium">{entry.shift} Shift</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold text-emerald-600 block text-lg">+{formatCurrency(entry.collection)}</span>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Collection</span>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Rent Applied</p>
                                        <p className={`text-sm font-bold ${isRentAdjusted ? 'text-indigo-600' : 'text-slate-700'}`}>
                                            {formatCurrency(displayRent)}
                                        </p>
                                        {isRentAdjusted && <p className="text-[9px] text-indigo-400">Based on {associatedBill.trips} Trips</p>}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Fuel / Due</p>
                                        <p className="text-sm font-bold text-rose-500">-{formatCurrency(entry.fuel)}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* BILLING / WEEKLY WALLET TAB */}
        {activeTab === 'billing' && (
            <div className="p-5 animate-fade-in space-y-4">
                <h3 className="font-bold text-slate-800 text-lg mb-2">Billing History</h3>
                
                {billingData.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <FileText size={48} className="mx-auto mb-3 opacity-20"/>
                        <p>No generated bills yet.</p>
                    </div>
                ) : (
                    billingData.map(bill => (
                        <div key={bill.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Week Period</p>
                                    <p className="font-bold text-slate-800 text-sm">{bill.weekRange}</p>
                                </div>
                                <div className={`text-right px-3 py-1.5 rounded-lg ${bill.payout >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                    <p className="text-[10px] font-bold uppercase opacity-70">Net Payout</p>
                                    <p className="font-bold text-base">{formatCurrency(bill.payout)}</p>
                                </div>
                            </div>

                            {/* Trip / Performance Stats within Card */}
                            <div className="bg-slate-50 rounded-xl p-3 mb-4 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Trips</p>
                                    <p className="text-lg font-bold text-slate-800">{bill.trips}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Earnings</p>
                                    <p className="text-lg font-bold text-indigo-600">{formatCurrency(bill.grossEarnings)}</p>
                                </div>
                                <div className="col-span-2 pt-2 border-t border-slate-100 flex justify-between text-xs">
                                     <span className="text-slate-500 font-medium">Avg / Trip</span>
                                     <span className="font-bold text-slate-700">{formatCurrency(bill.avgPerTrip)}</span>
                                </div>
                            </div>
                            
                            <div className="flex gap-3 mt-4">
                                <button 
                                    onClick={() => setViewingBill(bill)}
                                    className="flex-1 py-2.5 bg-slate-50 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-100 flex items-center justify-center gap-2"
                                >
                                    <Eye size={16}/> View Bill
                                </button>
                                <button 
                                    onClick={() => handleDownloadBill(bill)}
                                    className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                                >
                                    <Download size={16}/> Download
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}

        {/* BILL VIEWER MODAL */}
        {viewingBill && (
            <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800">Bill Details</h3>
                        <button onClick={() => setViewingBill(null)} className="p-2 bg-white rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                    </div>
                    
                    {/* Rendered HTML Preview (using iframe for isolation and faithful rendering) */}
                    <div className="flex-1 overflow-hidden bg-white">
                        <iframe 
                            srcDoc={generateBillHTML(viewingBill)}
                            className="w-full h-full border-0"
                            title="Bill Preview"
                        />
                    </div>

                    <div className="p-5 border-t border-slate-100 bg-slate-50">
                        <button onClick={() => handleDownloadBill(viewingBill)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                            <Download size={18} /> Download PDF
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* BOTTOM NAV */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 pb-safe px-6 py-3 flex justify-around items-center z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
            <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-indigo-600' : 'text-slate-400'}`}>
                <div className={`p-1.5 rounded-xl ${activeTab === 'home' ? 'bg-indigo-50' : 'bg-transparent'}`}>
                    <UserCircle size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-bold">Home</span>
            </button>
            <button onClick={() => setActiveTab('daily')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'daily' ? 'text-indigo-600' : 'text-slate-400'}`}>
                <div className={`p-1.5 rounded-xl ${activeTab === 'daily' ? 'bg-indigo-50' : 'bg-transparent'}`}>
                    <Calendar size={24} strokeWidth={activeTab === 'daily' ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-bold">Daily</span>
            </button>
            <button onClick={() => setActiveTab('billing')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'billing' ? 'text-indigo-600' : 'text-slate-400'}`}>
                <div className={`p-1.5 rounded-xl ${activeTab === 'billing' ? 'bg-indigo-50' : 'bg-transparent'}`}>
                    <FileText size={24} strokeWidth={activeTab === 'billing' ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-bold">Bills</span>
            </button>
        </div>
    </div>
  );
};

export default DriverPortalPage;
