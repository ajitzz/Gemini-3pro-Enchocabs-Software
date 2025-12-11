
import React, { useEffect, useState, useMemo } from 'react';
import { storageService } from '../services/storageService';
import { DailyEntry, WeeklyWallet, Driver, RentalSlab } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  Download, Calendar, Wallet, FileText, ChevronRight, LogOut, 
  UserCircle, TrendingUp, TrendingDown, DollarSign, MapPin, 
  CheckCircle, AlertCircle, Eye, X, ShieldCheck, Users, ArrowLeft, Lock, ArrowRight, Gauge, BarChart3, ChevronDown, Copy, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DriverPortalPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Admin Context
  const [driversList, setDriversList] = useState<Driver[]>([]);
  const [globalDaily, setGlobalDaily] = useState<DailyEntry[]>([]);
  const [globalWeekly, setGlobalWeekly] = useState<WeeklyWallet[]>([]);

  // Manager Context
  const [myTeam, setMyTeam] = useState<Driver[]>([]);
  const [teamBalances, setTeamBalances] = useState<Record<string, number>>({});
  
  // View Context (Self vs Managed)
  const [viewingAsDriver, setViewingAsDriver] = useState<Driver | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

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
      setInitError(null);
      try {
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
              // Otherwise, maybe just pick the first active one.
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
          } else {
              setInitError("No driver profile found linked to this account.");
          }
      } catch (err: any) {
          console.error("Portal Initialization Error:", err);
          setInitError(err.message || "Failed to load portal data. Check connection.");
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
      navigate('/');
  };
  
  const viewTeamMember = async (member: Driver) => {
      try {
        const [allDaily, allWeekly] = await Promise.all([
            storageService.getDailyEntries(),
            storageService.getWeeklyWallets()
        ]);
        switchToDriverView(member, allDaily, allWeekly);
      } catch (err) {
          alert("Could not load team member data.");
      }
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

  const formatDate = (dateString: string) => {
      if(!dateString) return '-';
      return dateString.split('-').reverse().join('-');
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
       
       // --- NEW CALCULATION LOGIC ---
       // 1. Find Slab
       const slab = rentalSlabs.find(s => 
           totalTrips >= s.minTrips && (s.maxTrips === null || totalTrips <= s.maxTrips)
       );
       
       // 2. Determine Rent/Day
       let rentRateUsed = 0;
       if (wallet.rentOverride !== undefined && wallet.rentOverride !== null) {
           rentRateUsed = wallet.rentOverride;
       } else if (relevantDaily.length > 0) {
           rentRateUsed = relevantDaily.reduce((sum, d) => sum + d.rent, 0) / relevantDaily.length;
       } else {
           rentRateUsed = slab ? slab.rentAmount : 0;
       }
       
       // 3. Count Days Worked (Respect Override)
       const daysWorked = wallet.daysWorkedOverride !== undefined && wallet.daysWorkedOverride !== null 
           ? wallet.daysWorkedOverride 
           : relevantDaily.length;

       // 4. Calc Total Rent
       const rentTotal = rentRateUsed * daysWorked;

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
           weekRange: `${formatDate(wallet.weekStartDate)} to ${formatDate(wallet.weekEndDate)}`,
           startDate: wallet.weekStartDate,
           endDate: wallet.weekEndDate,
           driver: wallet.driver,
           qrCode: relevantDaily[0]?.qrCode || 'N/A',
           trips: totalTrips,
           grossEarnings,
           avgPerTrip,
           rentPerDay: rentRateUsed,
           daysWorked: daysWorked,
           rentTotal,
           collection,
           fuel,
           wallet: walletAmount,
           overdue,
           adjustments,
           payout,
           dailyDetails: relevantDaily,
           weeklyDetails: wallet,
           isAdjusted: !!slab || (wallet.rentOverride !== undefined && wallet.rentOverride !== null)
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
          if (!w.weekEndDate) return;
          const parts = w.weekEndDate.split('-');
          if (parts.length !== 3) return;
          
          const wYear = parseInt(parts[0], 10);
          const wMonth = parseInt(parts[1], 10) - 1; 

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
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${formatDate(d.date)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${d.driver}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${d.vehicle}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${d.shift}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 10px;">${d.qrCode || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: right;">${formatCurrency(d.rent)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: right;">${formatCurrency(d.collection)}</td>
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
              body { font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; background: white; }
              .header { text-align: center; margin-bottom: 40px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; }
              .company-name { font-size: 28px; font-weight: 800; color: #4338ca; letter-spacing: -0.5px; }
              .sub-company { font-size: 14px; color: #666; margin-top: 4px; font-weight: 500; }
              
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
                 <div style="margin-top:12px;"><span class="meta-label">Generated On</span> <div class="meta-value">${genDateStr}</div></div>
               </div>
            </div>

            <div class="section-header first-section">Payment Statement</div>
            <div class="payment-grid">
               <div class="pg-label">Total Trips Completed</div><div class="pg-value">${bill.trips}</div>
               <div class="pg-label">Rent / Day (Applied)</div><div class="pg-value">${formatCurrency(bill.rentPerDay)}</div>
               <div class="pg-label">Days Worked</div><div class="pg-value">${bill.daysWorked}</div>
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

  if (!viewingAsDriver) return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 flex-col">
          {initError ? (
             <div className="mb-6 flex flex-col items-center gap-2">
                <AlertTriangle size={48} className="text-rose-500 mb-2" />
                <h3 className="text-lg font-bold text-slate-800">Connection Failed</h3>
                <p className="text-sm text-rose-600 font-medium px-6 text-center max-w-md">{initError}</p>
             </div>
          ) : (
             <div className="flex flex-col items-center gap-3 mb-6">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-medium text-sm">Loading Driver Profile...</p>
             </div>
          )}
          
          <div className="flex gap-3">
              {user?.role !== 'driver' && (
                 <button 
                    onClick={returnToDashboard}
                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
                 >
                    <LogOut size={16} /> Exit to Admin
                 </button>
              )}
              {user?.role === 'driver' && (
                 <button 
                    onClick={logout}
                    className="px-5 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-colors flex items-center gap-2"
                 >
                    <LogOut size={16} /> Sign Out
                 </button>
              )}
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
       {/* 1. Header & Nav */}
       <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-xl">
           <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
               <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/50">
                       <span className="font-bold text-lg tracking-tighter">DT</span>
                   </div>
                   <div>
                       <h1 className="font-bold text-lg leading-none">Driver Portal</h1>
                       <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-1">
                           {user?.role === 'driver' ? 'My Dashboard' : 'View Mode'}
                       </p>
                   </div>
               </div>
               <div className="flex gap-3">
                   {user?.role !== 'driver' && (
                       <button onClick={returnToDashboard} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-300" title="Exit View Mode">
                           <LogOut size={20} />
                       </button>
                   )}
                   {user?.role === 'driver' && (
                       <button onClick={logout} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-rose-400" title="Sign Out">
                           <LogOut size={20} />
                       </button>
                   )}
               </div>
           </div>
           
           {/* Admin Selector (Only for Admins) */}
           {(user?.role === 'admin' || user?.role === 'super_admin') && (
               <div className="bg-slate-800 border-t border-slate-700 py-3 px-6 overflow-x-auto scrollbar-hide">
                  <div className="flex gap-2 max-w-md mx-auto">
                     {driversList.map(d => (
                         <button 
                            key={d.id}
                            onClick={() => handleAdminDriverSwitch(d.id)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${viewingAsDriver.id === d.id ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                         >
                            {d.name}
                         </button>
                     ))}
                  </div>
               </div>
           )}
       </header>

       <main className="max-w-md mx-auto p-6 space-y-6">
           
           {/* Profile Card */}
           <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] -mr-10 -mt-10"></div>
               
               <div className="relative z-10">
                   <div className="flex items-start justify-between mb-6">
                       <div className="flex items-center gap-4">
                           <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center border-4 border-white shadow-sm">
                               <UserCircle size={40} className="text-slate-300" />
                           </div>
                           <div>
                               <h2 className="text-xl font-bold text-slate-800">{viewingAsDriver.name}</h2>
                               <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                                   <MapPin size={12}/> {viewingAsDriver.vehicle || 'No Vehicle'}
                               </p>
                           </div>
                       </div>
                       <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${viewingAsDriver.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                           {viewingAsDriver.status}
                       </div>
                   </div>

                   {/* Quick Stats */}
                   <div className="grid grid-cols-2 gap-4 mb-2">
                       <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
                           <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1">Net Balance</p>
                           <p className={`text-2xl font-bold ${balanceSummary.netBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                               {formatCurrency(balanceSummary.netBalance)}
                           </p>
                           <p className="text-[10px] text-slate-400 mt-1">
                               {balanceSummary.netBalance < 0 ? 'You owe company' : 'Company owes you'}
                           </p>
                       </div>
                       <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">This Month</p>
                           <p className="text-2xl font-bold text-slate-800">{performanceStats.month.trips}</p>
                           <p className="text-[10px] text-slate-400 mt-1">Completed Trips</p>
                       </div>
                   </div>
               </div>
           </div>

           {/* Tab Switcher */}
           <div className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm">
               <button 
                  onClick={() => setActiveTab('home')}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'home' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
               >
                  Overview
               </button>
               <button 
                  onClick={() => setActiveTab('daily')}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'daily' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
               >
                  Daily Log
               </button>
               <button 
                  onClick={() => setActiveTab('billing')}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'billing' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
               >
                  Billings
               </button>
           </div>

           {/* --- TAB CONTENT --- */}
           
           {/* HOME TAB */}
           {activeTab === 'home' && (
              <div className="space-y-6 animate-fade-in">
                  
                  {/* Manager Section (If Applicable) */}
                  {viewingAsDriver.isManager && myTeam.length > 0 && (
                      <div className="bg-indigo-900 rounded-3xl p-6 text-white shadow-xl shadow-indigo-900/20 relative overflow-hidden">
                           <div className="relative z-10">
                               <div className="flex justify-between items-center mb-6">
                                   <div>
                                       <h3 className="font-bold text-lg">My Team</h3>
                                       <p className="text-indigo-300 text-xs">Managing {myTeam.length} Drivers</p>
                                   </div>
                                   <div className="bg-indigo-800 p-2 rounded-lg">
                                       <ShieldCheck size={20} className="text-indigo-200" />
                                   </div>
                               </div>
                               <div className="space-y-3">
                                   {myTeam.map(member => (
                                       <div key={member.id} className="flex items-center justify-between p-3 bg-indigo-800/50 rounded-xl border border-indigo-700/50 hover:bg-indigo-700/50 transition-colors cursor-pointer" onClick={() => viewTeamMember(member)}>
                                           <div className="flex items-center gap-3">
                                               <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-xs text-white">
                                                   {member.name.charAt(0)}
                                               </div>
                                               <div>
                                                   <p className="text-sm font-bold text-white">{member.name}</p>
                                                   <p className="text-[10px] text-indigo-300">Balance: {formatCurrency(teamBalances[member.id] || 0)}</p>
                                               </div>
                                           </div>
                                           <ChevronRight size={16} className="text-indigo-400" />
                                       </div>
                                   ))}
                               </div>
                           </div>
                           {/* Decorative background element */}
                           <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-2xl pointer-events-none"></div>
                      </div>
                  )}

                  {/* Wallet Balance Card - visible for everyone */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Wallet size={20} className="text-emerald-500"/> Wallet Overview
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-center">
                          <div className="p-4 bg-slate-50 rounded-2xl">
                              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Total Collection</p>
                              <p className="text-lg font-bold text-slate-700">{formatCurrency(balanceSummary.totalCollection)}</p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl">
                              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Total Fuel</p>
                              <p className="text-lg font-bold text-amber-600">{formatCurrency(balanceSummary.totalFuel)}</p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl">
                              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Vehicle Rent</p>
                              <p className="text-lg font-bold text-slate-700">{formatCurrency(balanceSummary.totalRawRent)}</p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl">
                              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Weekly Wallet</p>
                              <p className={`text-lg font-bold ${balanceSummary.totalWallet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(balanceSummary.totalWallet)}</p>
                          </div>
                      </div>
                  </div>
              </div>
           )}

           {/* DAILY TAB */}
           {activeTab === 'daily' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 text-sm">Recent Activity</h3>
                      <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-full text-slate-500 font-bold">{rawDaily.length} Entries</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                      {rawDaily.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-sm">No daily records found.</div>
                      ) : (
                          rawDaily.map(entry => (
                              <div key={entry.id} className="p-4 hover:bg-slate-50 transition-colors">
                                  <div className="flex justify-between items-start mb-2">
                                      <div className="flex items-center gap-2">
                                          <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg">
                                              <Calendar size={14} />
                                          </div>
                                          <div>
                                              <p className="text-sm font-bold text-slate-800">{formatDate(entry.date)}</p>
                                              <p className="text-[10px] text-slate-400 uppercase font-medium">{entry.day.substring(0,3)} • {entry.shift}</p>
                                          </div>
                                      </div>
                                      <span className="font-bold text-emerald-600 text-sm bg-emerald-50 px-2 py-1 rounded-lg">
                                          {formatCurrency(entry.collection)}
                                      </span>
                                  </div>
                                  
                                  <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 bg-slate-50/50 p-2 rounded-lg">
                                      <div>
                                          <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Rent</span>
                                          {formatCurrency(entry.rent)}
                                      </div>
                                      <div>
                                          <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Fuel</span>
                                          {formatCurrency(entry.fuel)}
                                      </div>
                                      <div>
                                          <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Due</span>
                                          <span className={entry.due !== 0 ? (entry.due > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold') : ''}>
                                              {entry.due > 0 ? '+' : ''}{entry.due}
                                          </span>
                                      </div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
           )}

           {/* BILLING TAB */}
           {activeTab === 'billing' && (
              <div className="space-y-4 animate-fade-in">
                  {billingData.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-sm">No bills generated yet.</div>
                  ) : (
                      billingData.map(bill => (
                          <div key={bill.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                              {bill.payout > 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-8 -mt-8"></div>}
                              
                              <div className="relative z-10">
                                  <div className="flex justify-between items-start mb-6">
                                      <div>
                                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weekly Bill</p>
                                          <p className="font-bold text-slate-800 mt-1">{bill.weekRange}</p>
                                      </div>
                                      <button onClick={() => downloadBill(bill)} className="bg-indigo-50 text-indigo-600 p-2 rounded-xl hover:bg-indigo-100 transition-colors">
                                          <Download size={20} />
                                      </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 mb-6">
                                      <div className="bg-slate-50 p-3 rounded-xl">
                                          <p className="text-[10px] text-slate-400 uppercase font-bold">Trips</p>
                                          <p className="text-lg font-bold text-slate-800">{bill.trips}</p>
                                      </div>
                                      <div className="bg-slate-50 p-3 rounded-xl">
                                          <p className="text-[10px] text-slate-400 uppercase font-bold">Rent Total</p>
                                          <p className="text-lg font-bold text-rose-500">-{formatCurrency(bill.rentTotal)}</p>
                                      </div>
                                  </div>

                                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                      <p className="text-xs font-bold text-slate-500 uppercase">Net Payout</p>
                                      <p className={`text-xl font-bold ${bill.payout < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                          {formatCurrency(bill.payout)}
                                      </p>
                                  </div>
                              </div>
                          </div>
                      ))
                  )}
              </div>
           )}

       </main>
    </div>
  );
};

export default DriverPortalPage;
