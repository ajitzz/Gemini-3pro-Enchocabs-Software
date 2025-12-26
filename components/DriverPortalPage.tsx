
import React, { useEffect, useState, useMemo } from 'react';
import { storageService } from '../services/storageService';
import { CashMode, DailyEntry, WeeklyWallet, Driver, RentalSlab } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Download, Calendar, Wallet, FileText, ChevronRight, LogOut, 
  UserCircle, TrendingUp, TrendingDown, DollarSign, MapPin, 
  CheckCircle, AlertCircle, Eye, X, ShieldCheck, Users, ArrowLeft, Lock, ArrowRight, Gauge, BarChart3, ChevronDown, Copy, AlertTriangle, ArrowUpRight, Clock
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
  const [primaryDriver, setPrimaryDriver] = useState<Driver | null>(null);
  
  // View Context (Self vs Managed)
  const [viewingAsDriver, setViewingAsDriver] = useState<Driver | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Data (Filtered for viewingAsDriver)
  const [rawDaily, setRawDaily] = useState<DailyEntry[]>([]);
  const [rawWeekly, setRawWeekly] = useState<WeeklyWallet[]>([]);
  const [rentalSlabs, setRentalSlabs] = useState<RentalSlab[]>([]);

  // UI State
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeTab, setActiveTab] = useState<'home' | 'daily' | 'billing'>('home');
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  const [cashMode, setCashMode] = useState<CashMode>('trips');
  const [globalCashMode, setGlobalCashMode] = useState<CashMode>('trips');
  const [updatingCashMode, setUpdatingCashMode] = useState(false);
  const [copiedDriverId, setCopiedDriverId] = useState<string | null>(null);
  const [teamCashModes, setTeamCashModes] = useState<Record<string, CashMode>>({});
  const [teamCashModeUpdating, setTeamCashModeUpdating] = useState<Record<string, boolean>>({});
  const [showNetPayoutPopup, setShowNetPayoutPopup] = useState(false);

  const isDateFilterActive = useMemo(() => {
      if (fromDate && toDate) {
          const start = new Date(fromDate);
          const end = new Date(toDate);
          return start.getTime() !== end.getTime();
      }

      return Boolean(fromDate || toDate);
  }, [fromDate, toDate]);

  const formatShortRange = (startDate?: Date, endDate?: Date) => {
      if (!startDate || !endDate) return undefined;

      const startDay = String(startDate.getDate()).padStart(2, '0');
      const endDay = String(endDate.getDate()).padStart(2, '0');

      const startMonth = startDate.toLocaleDateString('en-GB', { month: 'short' });
      const endMonth = endDate.toLocaleDateString('en-GB', { month: 'short' });

      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();

      if (startYear !== endYear) {
          return `${startDay} ${startMonth} ${startYear}–${endDay} ${endMonth} ${endYear}`;
      }

      if (startMonth === endMonth) {
          return `${startDay}–${endDay} ${startMonth}`;
      }

      return `${startDay} ${startMonth}–${endDay} ${endMonth}`;
  };

  const latestPayout = useMemo(() => {
      if (!rawDaily.length) return null;
      const withPayout = rawDaily
          .filter(entry => (entry.payout && entry.payout !== 0) || entry.payoutDate)
          .sort((a, b) => {
              const aDate = new Date(a.payoutDate || a.date).getTime();
              const bDate = new Date(b.payoutDate || b.date).getTime();
              return bDate - aDate;
          });

      if (withPayout.length === 0) return null;

      const latest = withPayout[0];
      return {
          amount: latest.payout || 0,
          date: latest.payoutDate || latest.date
      };
  }, [rawDaily]);

  const filteredDaily = useMemo(() => {
      const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
      const end = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

      return rawDaily.filter(entry => {
          const entryTime = new Date(entry.date).getTime();
          if (start !== null && entryTime < start) return false;
          if (end !== null && entryTime > end) return false;
          return true;
      });
  }, [rawDaily, fromDate, toDate]);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    // Initial Load based on Authenticated User
    if (user) {
        initializePortal();
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const loadCashMode = async () => {
        const mode = await storageService.getCashMode();
        if (!isMounted) return;
        setCashMode(mode);
        setGlobalCashMode(mode);
    };

    loadCashMode();

    return () => {
        isMounted = false;
    };
  }, []);

  const refreshCashMode = async (driverId?: string, skipTeamSync?: boolean) => {
      try {
          const [systemMode, driverMode] = await Promise.all([
              storageService.getCashMode(),
              driverId ? storageService.getDriverCashMode(driverId) : Promise.resolve<'trips' | 'blocked'>('trips')
          ]);

          setGlobalCashMode(systemMode);
          setCashMode(driverMode || systemMode);

          if (!skipTeamSync && myTeam.length > 0) {
              const teamModes: Record<string, CashMode> = {};
              await Promise.all(myTeam.map(async member => {
                  teamModes[member.id] = await storageService.getDriverCashMode(member.id);
              }));
              setTeamCashModes(prev => {
                  const changed = Object.keys(teamModes).some(id => prev[id] !== teamModes[id]);
                  return changed ? teamModes : prev;
              });
          }
      } catch (err) {
          console.error('Failed to refresh cash mode state', err);
      }
  };

  const toggleCashMode = async () => {
      if (!isAdmin || !viewingAsDriver) return;
      const nextMode: CashMode = cashMode === 'blocked' ? 'trips' : 'blocked';
      setUpdatingCashMode(true);
      try {
          await storageService.setDriverCashMode(viewingAsDriver.id, nextMode);
          setCashMode(nextMode);
          setTeamCashModes(prev => ({ ...prev, [viewingAsDriver.id]: nextMode }));
      } catch (err) {
          console.error('Failed to update cash mode', err);
          alert('Could not update cash mode. Please try again.');
      } finally {
          setUpdatingCashMode(false);
      }
  };

  const initializePortal = async () => {
      setInitError(null);
      try {
          const [allDrivers, allDaily, allWeekly, slabs] = await Promise.all([
              storageService.getDrivers(),
              storageService.getDailyEntries(),
              storageService.getWeeklyWallets(),
              storageService.getDriverRentalSlabs()
          ]);
          const sortedSlabs = slabs.sort((a, b) => a.minTrips - b.minTrips);
          setRentalSlabs(sortedSlabs);

          setGlobalDaily(allDaily);
          setGlobalWeekly(allWeekly);

          if (user?.role === 'admin' || user?.role === 'super_admin') {
              setDriversList(allDrivers.sort((a, b) => a.name.localeCompare(b.name)));
          }

          let targetDriver: Driver | undefined;

          if (user?.role === 'driver' && user.driverId) {
              targetDriver = allDrivers.find(d => d.id === user.driverId);
          } else if ((user?.role === 'admin' || user?.role === 'super_admin')) {
              targetDriver = allDrivers.find(d => d.email === user.email);
              if (!targetDriver) {
                  targetDriver = allDrivers.find(d => !d.terminationDate);
              }
          }

          if (targetDriver) {
              setPrimaryDriver(targetDriver);
              if (targetDriver.isManager) {
                  const accessList = await storageService.getManagerAccess();
                  const myAccess = accessList.find(a => a.managerId === targetDriver!.id);
                  if (myAccess && myAccess.childDriverIds.length > 0) {
                      const teamMembers = allDrivers.filter(d => myAccess.childDriverIds.includes(d.id));
                      setMyTeam(teamMembers);

                      // USE CENTRALIZED LOGIC FOR TEAM BALANCES
                      const balances: Record<string, number> = {};
                      teamMembers.forEach(member => {
                          const stats = storageService.calculateDriverStats(member.name, allDaily, allWeekly, sortedSlabs);
                          balances[member.id] = stats.netPayout;
                      });
                      setTeamBalances(balances);

                      const cashModes: Record<string, CashMode> = {};
                      await Promise.all(teamMembers.map(async member => {
                          const mode = await storageService.getDriverCashMode(member.id);
                          cashModes[member.id] = mode;
                      }));
                      setTeamCashModes(cashModes);
                  }
              }
              switchToDriverView(targetDriver, allDaily, allWeekly);
              refreshCashMode(targetDriver.id, true);
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
      refreshCashMode(targetDriver.id, true);
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

  const exitView = async () => {
      if (user?.role === 'driver') {
          if (user.driverId && viewingAsDriver && primaryDriver && viewingAsDriver.id !== user.driverId) {
              switchToDriverView(primaryDriver, globalDaily, globalWeekly);
              return;
          }
          logout();
          return;
      }
      returnToDashboard();
  };

  const copyTeamMemberContact = async (member: Driver) => {
      const details = `${member.name} | ${member.mobile}${member.email ? ` | ${member.email}` : ''}`;
      try {
          await navigator.clipboard.writeText(details);
          setCopiedDriverId(member.id);
          setTimeout(() => setCopiedDriverId(null), 2000);
      } catch (err) {
          console.error('Failed to copy team member contact', err);
          alert('Could not copy contact details. Please try again.');
      }
  };

    const toggleTeamMemberCashMode = async (memberId: string) => {
        if (!viewingAsDriver?.isManager) return;

      const currentMode = teamCashModes[memberId] || 'trips';
      const nextMode: CashMode = currentMode === 'blocked' ? 'trips' : 'blocked';

      setTeamCashModeUpdating(prev => ({ ...prev, [memberId]: true }));
      try {
          await storageService.setDriverCashMode(memberId, nextMode);
          setTeamCashModes(prev => ({ ...prev, [memberId]: nextMode }));
          if (viewingAsDriver?.id === memberId) {
              setCashMode(nextMode);
          }
      } catch (err) {
          console.error('Failed to update team member cash mode', err);
          alert('Could not update cash mode. Please try again.');
      } finally {
          setTeamCashModeUpdating(prev => ({ ...prev, [memberId]: false }));
      }
  };

  // Continuously sync cash mode across admin/manager/driver views
  useEffect(() => {
      if (!viewingAsDriver) return;

      let isMounted = true;
      const driverId = viewingAsDriver.id;

      const sync = async () => {
          if (!isMounted) return;
          await refreshCashMode(driverId);
      };

      sync();
      const interval = setInterval(sync, 5000);

      return () => {
          isMounted = false;
          clearInterval(interval);
      };
  }, [viewingAsDriver?.id, myTeam.length]);
  
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
  };

  // Helper for Top Cards to remove decimal
  const formatCurrencyInt = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const formatInt = (val: number) => {
    return Math.floor(val).toString();
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

       const totalTrips = Number(wallet.trips ?? 0);
       
       const slab = rentalSlabs.find(s => 
           totalTrips >= s.minTrips && (s.maxTrips === null || totalTrips <= s.maxTrips)
       );
       
       let rentRateUsed = 0;
       if (wallet.rentOverride !== undefined && wallet.rentOverride !== null) {
           rentRateUsed = wallet.rentOverride;
       } else if (relevantDaily.length > 0) {
           rentRateUsed = relevantDaily.reduce((sum, d) => sum + d.rent, 0) / relevantDaily.length;
       } else {
           rentRateUsed = slab ? slab.rentAmount : 0;
       }
       
       const daysWorked = wallet.daysWorkedOverride !== undefined && wallet.daysWorkedOverride !== null 
           ? wallet.daysWorkedOverride 
           : relevantDaily.length;

       const rentTotal = rentRateUsed * daysWorked;

       const collection = relevantDaily.reduce((sum, d) => sum + d.collection, 0);
       const fuel = relevantDaily.reduce((sum, d) => sum + d.fuel, 0);
       const overdue = relevantDaily.reduce((sum, d) => sum + d.due, 0);
       const walletAmount = wallet.walletWeek;
       const grossEarnings = wallet.earnings || 0; 

       const adjustments = wallet.adjustments || 0;
       
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
  const driverStats = useMemo(() => {
      if (!viewingAsDriver) return null;
      return storageService.calculateDriverStats(viewingAsDriver.name, rawDaily, rawWeekly, rentalSlabs);
  }, [viewingAsDriver, rawDaily, rawWeekly, rentalSlabs]);

  const balanceSummary = useMemo(() => {
      if (!driverStats) return { netPayout: 0, totalCollection: 0, totalRawRent: 0, totalFuel: 0, totalWallet: 0, netRange: undefined as string | undefined };
      return {
          netPayout: driverStats.netPayout,
          netRange: driverStats.netPayoutSource === 'latest-wallet' ? driverStats.netPayoutRange : undefined,
          totalCollection: driverStats.totalCollection,
          totalRawRent: driverStats.totalRent,
          totalFuel: driverStats.totalFuel,
          totalWallet: driverStats.totalWalletWeek
      };
  }, [driverStats]);

  const netPayoutDetails = useMemo(() => {
      if (!driverStats || !viewingAsDriver) return null;

      const earliestDate = rawDaily.length > 0
          ? rawDaily.reduce((min, entry) => entry.date < min ? entry.date : min, rawDaily[0].date)
          : undefined;
      const latestDate = rawDaily.length > 0
          ? rawDaily.reduce((max, entry) => entry.date > max ? entry.date : max, rawDaily[0].date)
          : undefined;

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const currentMonthEnd = new Date(nextMonthStart.getTime() - 1);

      const isWithinRange = (dateString: string, start: Date, end: Date) => {
          const date = new Date(dateString);
          return date >= start && date < end;
      };

      const thisMonthDaily = rawDaily.filter(d => isWithinRange(d.date, currentMonthStart, nextMonthStart));
      const previousDaily = rawDaily.filter(d => new Date(d.date) < currentMonthStart);

      const thisMonthWeekly = rawWeekly.filter(w => isWithinRange(w.weekEndDate, currentMonthStart, nextMonthStart));
      const previousWeekly = rawWeekly.filter(w => new Date(w.weekEndDate) < currentMonthStart);

      const buildBreakdown = (stats: typeof driverStats) => ([
          { label: 'Total Collection', value: stats.totalCollection, tone: 'positive' as const },
          { label: 'Vehicle Rent', value: -stats.totalRent, tone: 'negative' as const },
          { label: 'Fuel', value: -stats.totalFuel, tone: 'negative' as const },
          { label: 'Dues & Adjustments', value: stats.totalDue, tone: stats.totalDue >= 0 ? 'positive' as const : 'negative' as const },
          { label: 'Weekly Wallet & Adjustments', value: stats.totalWalletWeek, tone: stats.totalWalletWeek >= 0 ? 'positive' as const : 'negative' as const },
          { label: 'Direct Payouts Recorded', value: -stats.totalPayout, tone: 'negative' as const }
      ]);

      const thisMonthStats = storageService.calculateDriverStats(
          viewingAsDriver.name,
          thisMonthDaily,
          thisMonthWeekly,
          rentalSlabs
      );

      const previousMonthStats = storageService.calculateDriverStats(
          viewingAsDriver.name,
          previousDaily,
          previousWeekly,
          rentalSlabs
      );

      const monthLabel = currentMonthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const previousLabel = previousDaily.length === 0 && previousWeekly.length === 0
          ? 'Previous Months'
          : `Before ${monthLabel}`;

      const previousEarliest = previousDaily.length > 0
          ? previousDaily.reduce((min, entry) => entry.date < min ? entry.date : min, previousDaily[0].date)
          : (previousWeekly.length > 0
              ? previousWeekly.reduce((min, entry) => entry.weekStartDate < min ? entry.weekStartDate : min, previousWeekly[0].weekStartDate)
              : undefined);

      const previousLatest = previousDaily.length > 0
          ? previousDaily.reduce((max, entry) => entry.date > max ? entry.date : max, previousDaily[0].date)
          : (previousWeekly.length > 0
              ? previousWeekly.reduce((max, entry) => entry.weekEndDate > max ? entry.weekEndDate : max, previousWeekly[0].weekEndDate)
              : undefined);

      return {
          rangeLabel: driverStats.netPayoutRange || (earliestDate && latestDate ? `${formatDate(earliestDate)} - ${formatDate(latestDate)}` : 'No activity found'),
          source: driverStats.netPayoutSource,
          monthly: [
              {
                  label: `${monthLabel} (This Month)`,
                  range: `${currentMonthStart.toLocaleDateString('en-GB')} - ${currentMonthEnd.toLocaleDateString('en-GB')}`,
                  breakdown: buildBreakdown(thisMonthStats),
                  net: thisMonthStats.netPayout
              },
              {
                  label: previousLabel,
                  range: previousEarliest || previousLatest
                      ? `${previousEarliest ? formatDate(previousEarliest) : '-'} - ${previousLatest ? formatDate(previousLatest) : '-'}`
                      : 'No earlier records',
                  breakdown: buildBreakdown(previousMonthStats),
                  net: previousMonthStats.netPayout
              }
          ],
          net: driverStats.netPayout
      };
  }, [driverStats, rawDaily, rawWeekly, rentalSlabs, viewingAsDriver]);

  // --- 3. AGGREGATED STATS (Month/Prev Month/Year) ---
    const aggregatedStats = useMemo(() => {
        if (!viewingAsDriver || (rawDaily.length === 0 && rawWeekly.length === 0)) {
            return {
                monthCollection: 0,
                monthRent: 0,
                monthPayout: 0,
                monthWallet: 0,
                monthFuel: 0,
                totalDues: 0,
                yearCollection: 0,
                latestWeekTrips: 0,
                latestWeekEarnings: 0,
                monthTrips: 0,
                monthEarningsTotal: 0,
                monthEarningRanges: [] as string[],
                monthEarningRangeLabel: undefined as string | undefined,
                latestWeekRange: undefined as string | undefined,
                monthNetPayout: 0,
                rangeWallet: 0,
                rangeFuel: 0,
                rangeCollection: 0,
                rangeRent: 0,
                rangeDues: 0,
                rangePayout: 0,
                rangeEarnings: 0,
                rangeTrips: 0,
                rangeLabel: undefined,
                rangeWalletWeeksLabel: undefined as string | undefined,
                rangeSummary: undefined,
            };
        }

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);

        let monthCollection = 0;
        let monthRent = 0;
        let monthPayout = 0;
        let monthWallet = 0;
        let monthFuel = 0;
        let totalDues = 0;
        let yearCollection = 0;
        let monthTrips = 0;

        rawDaily.forEach(entry => {
            const d = new Date(entry.date);
            const eYear = d.getFullYear();
            const eMonth = d.getMonth();

            totalDues += entry.due;

            // Current Year
            if (eYear === currentYear) {
                yearCollection += entry.collection;
                // Current Month
                if (eMonth === currentMonth) {
                    monthCollection += entry.collection;
                    monthRent += entry.rent;
                    monthFuel += entry.fuel;
                    monthPayout += (entry.payout || 0);
                }
            }

        });

        // Calculate Month Trips from Weekly Data (as Daily doesn't store trips explicitly)
        rawWeekly.forEach(w => {
            if (!w.weekEndDate) return;
            const endD = new Date(w.weekEndDate);
            if (endD.getFullYear() === currentYear && endD.getMonth() === currentMonth) {
                monthTrips += Number(w.trips ?? 0);
            }
        });

        const currentMonthWeeks = rawWeekly.filter(w => {
            const startD = new Date(w.weekStartDate);
            const endD = new Date(w.weekEndDate);

            return startD <= monthEnd && endD >= monthStart;
        });

        let monthEarningRangeLabel: string | undefined = undefined;
        if (currentMonthWeeks.length > 0) {
            const earliestStart = currentMonthWeeks.reduce((min, week) =>
                week.weekStartDate < min ? week.weekStartDate : min,
                currentMonthWeeks[0].weekStartDate
            );

            const latestEnd = currentMonthWeeks.reduce((max, week) =>
                week.weekEndDate > max ? week.weekEndDate : max,
                currentMonthWeeks[0].weekEndDate
            );

            monthEarningRangeLabel = `${formatDate(earliestStart)} - ${formatDate(latestEnd)}`;
        }

        const monthEarningsTotal = currentMonthWeeks.reduce((sum, w) => sum + (w.earnings || 0), 0);
        const monthEarningRanges = currentMonthWeeks.map(w => `${formatDate(w.weekStartDate)} - ${formatDate(w.weekEndDate)}`);
        monthWallet = currentMonthWeeks.reduce((sum, w) => sum + (w.walletWeek || 0), 0);

        const monthDaily = rawDaily.filter(entry => {
            const d = new Date(entry.date);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });

        const monthWeekly = rawWeekly.filter(w => {
            const startD = new Date(w.weekStartDate);
            const endD = new Date(w.weekEndDate);
            return startD <= monthEnd && endD >= monthStart;
        });

        const monthStats = storageService.calculateDriverStats(
            viewingAsDriver.name,
            monthDaily,
            monthWeekly,
            rentalSlabs
        );

        const rangeDaily = filteredDaily;
        const filterStart = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
        const filterEnd = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

        const rangeWeekly = rawWeekly.filter(w => {
            const weekStart = new Date(w.weekStartDate).getTime();
            const weekEnd = new Date(w.weekEndDate).getTime();

            if (filterStart !== null && weekEnd < filterStart) return false;
            if (filterEnd !== null && weekStart > filterEnd) return false;

            return true;
        });

        let rangeCollection = 0;
        let rangeRent = 0;
        let rangeDues = 0;
        let rangePayout = 0;
        let rangeEarnings = 0;
        let rangeTrips = 0;
        let rangeWallet = 0;
        let rangeFuel = 0;

        let rangeLabel: string | undefined;
        let rangeSummary: string | undefined;
        let rangeWalletWeeksLabel: string | undefined;

        if (isDateFilterActive && (rangeDaily.length > 0 || rangeWeekly.length > 0)) {
            const rangeStartDate = filterStart !== null
                ? new Date(filterStart)
                : [
                    ...rangeDaily.map(entry => new Date(entry.date)),
                    ...rangeWeekly.map(entry => new Date(entry.weekStartDate)),
                ].reduce((min, date) => (date < min ? date : min), new Date());

            const rangeEndDate = filterEnd !== null
                ? new Date(filterEnd)
                : [
                    ...rangeDaily.map(entry => new Date(entry.date)),
                    ...rangeWeekly.map(entry => new Date(entry.weekEndDate)),
                ].reduce((max, date) => (date > max ? date : max), new Date(0));

            rangeLabel = formatShortRange(rangeStartDate, rangeEndDate);
            rangeTrips = rangeWeekly.reduce((sum, week) => sum + Number(week.trips ?? 0), 0);
            rangeSummary = rangeWeekly.length > 0
                ? `${formatInt(rangeTrips)} Trip${rangeTrips === 1 ? '' : 's'} - ${formatInt(rangeWeekly.length)} Week${rangeWeekly.length === 1 ? '' : 's'}`
                : `${formatInt(rangeDaily.length)} Entr${rangeDaily.length === 1 ? 'y' : 'ies'}`;
            rangeWalletWeeksLabel = rangeWeekly.length > 0
                ? rangeWeekly
                    .map(week => formatShortRange(new Date(week.weekStartDate), new Date(week.weekEndDate)))
                    .filter(Boolean)
                    .join(' • ')
                : undefined;

            rangeDaily.forEach(entry => {
                rangeCollection += entry.collection;
                rangeRent += entry.rent;
                rangeDues += entry.due;
                rangeFuel += entry.fuel;
                rangePayout += (entry.payout || 0);
            });

            rangeWallet = rangeWeekly.reduce((sum, week) => sum + (week.walletWeek || 0), 0);
            rangeEarnings = rangeWeekly.reduce((sum, week) => sum + (week.earnings || 0), 0);
        }

        // Latest Week Details
        const latestWeekly = rawWeekly.length > 0 ? rawWeekly[0] : null;
        const latestWeekTrips = latestWeekly ? Number(latestWeekly.trips ?? 0) : 0;
        const latestWeekEarnings = latestWeekly ? latestWeekly.earnings : 0;
        const latestWeekRange = latestWeekly
            ? `${formatDate(latestWeekly.weekStartDate)} - ${formatDate(latestWeekly.weekEndDate)}`
            : undefined;

        return {
            monthCollection,
            monthRent,
            monthPayout,
            monthWallet,
            monthFuel,
            totalDues,
            yearCollection,
            latestWeekTrips,
            latestWeekEarnings,
            monthTrips,
            monthEarningsTotal,
            monthEarningRanges,
            monthEarningRangeLabel,
            latestWeekRange,
            monthNetPayout: monthStats.netPayout,
            rangeWallet,
            rangeFuel,
            rangeCollection,
            rangeRent,
            rangeDues,
            rangePayout,
            rangeEarnings,
            rangeTrips,
            rangeLabel,
            rangeWalletWeeksLabel,
            rangeSummary,
        };
    }, [filteredDaily, fromDate, isDateFilterActive, rawDaily, rawWeekly, rentalSlabs, toDate, viewingAsDriver]);

  // --- 4. DYNAMIC CARD DATA ---
    const topCards = useMemo(() => {
        const latestBill = billingData[0];
        const netBalance = driverStats?.finalTotal ?? 0;

        // OVERVIEW: Weekly snapshot with consolidated style
        if (activeTab === 'home') {
            return {
                isConsolidated: true,
                data: {
                    headerLabel: 'Weekly Earnings',
                    headerValue: aggregatedStats.latestWeekEarnings,
                    headerSubtext: aggregatedStats.latestWeekRange || 'No weekly data',
                    headerBadge: aggregatedStats.latestWeekTrips ? `${formatInt(aggregatedStats.latestWeekTrips)} Trips` : undefined,
                    stats: [
                        {
                            label: 'Net Payout',
                            value: balanceSummary.netPayout,
                            colorClass: 'text-slate-800'
                        },
                        {
                            label: 'Net Balance',
                            value: netBalance,
                            colorClass: netBalance >= 0 ? 'text-emerald-600' : 'text-rose-500'
                        },
                        {
                            label: 'Trip/Day Rent',
                            value: latestBill?.rentPerDay || 0,
                            colorClass: 'text-amber-600'
                        }
                    ]
                }
            };
        }
        // DAILY LOG: Single Card with 3 Details
        else if (activeTab === 'daily') {
            const useRangeStats = isDateFilterActive && aggregatedStats.rangeLabel;
            return {
                // We'll use a special flag or structure for this consolidated card
                isConsolidated: true,
                data: {
                    headerLabel: useRangeStats ? aggregatedStats.rangeLabel : 'Month Total Earnings',
                    headerValue: useRangeStats ? aggregatedStats.rangeEarnings : aggregatedStats.monthEarningsTotal,
                    headerSubtext: useRangeStats
                        ? (aggregatedStats.rangeSummary || 'Filtered range')
                        : aggregatedStats.monthEarningRangeLabel || 'No weekly data',
                    stats: useRangeStats
                        ? [
                            {
                                label: 'Payout',
                                value: aggregatedStats.rangePayout,
                                colorClass: 'text-indigo-600'
                            },
                            {
                                label: 'Rent',
                                value: aggregatedStats.rangeRent,
                                colorClass: 'text-slate-800'
                            },
                            {
                                label: 'Collection',
                                value: aggregatedStats.rangeCollection,
                                colorClass: 'text-emerald-600'
                            },
                            {
                                label: 'Wallet',
                                value: aggregatedStats.rangeWallet,
                                colorClass: 'text-indigo-500'
                            },
                            {
                                label: 'Fuel',
                                value: aggregatedStats.rangeFuel,
                                colorClass: 'text-amber-600'
                            },
                            {
                                label: 'Dues',
                                value: aggregatedStats.rangeDues,
                                colorClass: 'text-rose-500'
                            }
                        ]
                        : [
                            {
                                label: 'Month Payout',
                                value: aggregatedStats.monthPayout,
                                colorClass: 'text-indigo-600'
                            },
                            {
                                label: 'Month Rent',
                                value: aggregatedStats.monthRent,
                                colorClass: 'text-slate-800'
                            },
                            {
                                label: 'Month Collection',
                                value: aggregatedStats.monthCollection,
                                colorClass: 'text-emerald-600'
                            },
                            {
                                label: 'Month Wallet',
                                value: aggregatedStats.monthWallet,
                                colorClass: 'text-indigo-500'
                            },
                            {
                                label: 'Month Fuel',
                                value: aggregatedStats.monthFuel,
                                colorClass: 'text-amber-600'
                            },
                            {
                                label: 'Dues',
                                value: aggregatedStats.totalDues,
                                colorClass: 'text-rose-500'
                            }
                        ]
                }
            };
        }
        // BILLING: Week Payout & This Month Total Earnings
        else {
            return {
                left: {
                    label: 'Week Payout',
                    value: balanceSummary.netPayout,
                    subtext: balanceSummary.netRange || (balanceSummary.netPayout < 0 ? 'Payable Amount' : 'Receivable Amount'),
                    range: balanceSummary.netRange,
                    isCurrency: true,
                    colorClass: 'bg-[#1e1b4b]',
                    colSpan: 1
                },
                right: {
                    label: "This Month's Earnings",
                    value: aggregatedStats.monthEarningsTotal, // Value: This Month Collection (weekly rollup)
                    subtext: `${formatInt(aggregatedStats.monthTrips)} Trips (This Month)`,
                    isCurrency: true,
                    colorClass: 'bg-white',
                    colSpan: 1
                }
            };
        }
    }, [activeTab, aggregatedStats, balanceSummary, billingData, driverStats]);


  // --- BILL HTML GENERATOR (unchanged) ---
  const generateBillHTML = (bill: any) => {
      const dailyRows = bill.dailyDetails.map((d: any) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #334155;">${formatDate(d.date)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #334155;">${d.driver}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #334155;">${formatCurrency(d.rent)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #16a34a;">${formatCurrency(d.collection)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #dc2626;">${formatCurrency(d.fuel)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #334155;">${formatCurrency(d.due)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #f59e0b;">${formatCurrency(d.adjustments ?? 0)}</td>
        </tr>
      `).join('');

      const genDate = new Date();
      const genDateStr = `${String(genDate.getDate()).padStart(2,'0')}/${String(genDate.getMonth()+1).padStart(2,'0')}/${genDate.getFullYear()}`;
      const walletDeductions = (bill.weeklyDetails.diff || 0) + (bill.weeklyDetails.charges || 0);

      return `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Bill - ${bill.driver}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
              body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; background: white; -webkit-print-color-adjust: exact; }
              .header { text-align: center; margin-bottom: 30px; }
              .company-name { font-size: 32px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: -0.5px; }
              .sub-company { font-size: 14px; color: #64748b; font-weight: 600; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
              .divider { height: 2px; background: #f1f5f9; margin: 20px 0; }
              .meta-box { background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0; }
              .meta-col div { margin-bottom: 6px; font-size: 14px; color: #334155; }
              .meta-col div strong { color: #0f172a; font-weight: 700; margin-right: 8px; }
              .section-title { font-size: 14px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; text-align: center; }
              .statement-grid { display: grid; grid-template-columns: 1fr auto; gap: 12px; margin-bottom: 30px; font-size: 14px; }
              .st-row { display: flex; justify-content: space-between; padding: 4px 0; }
              .st-label { font-weight: 600; color: #64748b; }
              .st-val { font-weight: 700; color: #0f172a; }
              .st-val.red { color: #dc2626; }
              .st-val.green { color: #16a34a; }
              .net-box { background: #f1f5f9; padding: 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; border-top: 2px solid #cbd5e1; }
              .net-label { font-size: 18px; font-weight: 800; color: #334155; text-transform: uppercase; }
              .net-val { font-size: 24px; font-weight: 800; color: #0f172a; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
              th { text-align: left; background: #f8fafc; padding: 12px 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
              .wallet-section { margin-top: 40px; border-top: 2px solid #f1f5f9; padding-top: 20px; }
              .footer { margin-top: 60px; font-size: 12px; text-align: center; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="company-name">Encho Cabs</div>
              <div class="sub-company">A Unit of Encho Enterprises</div>
            </div>
            <div class="divider"></div>
            <div class="meta-box">
               <div class="meta-col">
                 <div><strong>Driver:</strong> ${bill.driver}</div>
                 <div><strong>Vehicle QR:</strong> ${bill.qrCode}</div>
               </div>
               <div class="meta-col" style="text-align:right;">
                 <div><strong>Week:</strong> ${bill.weekRange}</div>
                 <div><strong>Generated:</strong> ${genDateStr}</div>
               </div>
            </div>
            <div class="section-title">Payment Statement</div>
            <div class="statement-grid">
               <div class="st-row"><span class="st-label">Total Trips Completed</span><span class="st-val">${formatInt(bill.trips)}</span></div>
               <div class="st-row"><span class="st-label">Rent / Day (Applied)</span><span class="st-val">${formatCurrency(bill.rentPerDay)}</span></div>
               <div class="st-row"><span class="st-label">Days Worked</span><span class="st-val">${bill.daysWorked}</span></div>
               <div class="st-row"><span class="st-label">Weekly Rent Deduction</span><span class="st-val red">- ${formatCurrency(bill.rentTotal)}</span></div>
               <div class="st-row"><span class="st-label">Fuel Advances</span><span class="st-val red">- ${formatCurrency(bill.fuel)}</span></div>
               <div class="st-row"><span class="st-label">Wallet Earnings (Weekly)</span><span class="st-val green">+ ${formatCurrency(bill.wallet)}</span></div>
               <div class="st-row"><span class="st-label">Rental Collection</span><span class="st-val green">+ ${formatCurrency(bill.collection)}</span></div>
               <div class="st-row"><span class="st-label">Previous Dues/Credit</span><span class="st-val">${formatCurrency(bill.overdue)}</span></div>
               <div class="st-row"><span class="st-label">Adjustments</span><span class="st-val">${formatCurrency(bill.adjustments)}</span></div>
            </div>
            <div class="net-box">
               <span class="net-label">WEEK PAYOUT</span>
               <span class="net-val">${formatCurrency(bill.payout)}</span>
            </div>
            <div class="section-title" style="margin-top: 40px; text-align: left;">Daily Activity Log</div>
            <table>
              <thead><tr><th>Date</th><th>Driver</th><th style="text-align:right">Rent</th><th style="text-align:right">Collection</th><th style="text-align:right">Fuel</th><th style="text-align:right">Dues</th><th style="text-align:right">Adjustments</th></tr></thead>
              <tbody>${dailyRows}</tbody>
            </table>
            <div class="wallet-section">
                <div class="section-title" style="text-align: left; margin-bottom: 15px;">Weekly Wallet Breakdown</div>
                <div class="statement-grid" style="font-size: 13px;">
                   <div class="st-row"><span class="st-label">Gross Earnings</span><span class="st-val">${formatCurrency(bill.weeklyDetails.earnings)}</span></div>
                   <div class="st-row"><span class="st-label">Refunds</span><span class="st-val">${formatCurrency(bill.weeklyDetails.refund)}</span></div>
                   <div class="st-row"><span class="st-label">Deductions (Diff + Charges)</span><span class="st-val red">-${formatCurrency(walletDeductions)}</span></div>
                   <div class="st-row"><span class="st-label">Cash (Wallet)</span><span class="st-val red">-${formatCurrency(bill.weeklyDetails.cash)}</span></div>
                   <div class="st-row" style="border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 4px;"><span class="st-label" style="color:#4338ca;">Wallet Total</span><span class="st-val" style="color:#4338ca;">${formatCurrency(bill.wallet)}</span></div>
                </div>
            </div>
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

  // Helper for recent logs
  const recentLogs = rawDaily.slice(0, 3);
  // Helper for latest bill
  const latestBill = billingData.length > 0 ? billingData[0] : null;

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
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-24">
      {showNetPayoutPopup && netPayoutDetails && (
          <div
              className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6"
              onClick={() => setShowNetPayoutPopup(false)}
          >
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
              <div
                  className="relative w-full max-w-[430px] sm:max-w-[520px] h-[82vh] max-h-[90vh] rounded-3xl shadow-2xl border border-slate-100 bg-gradient-to-b from-white via-slate-50 to-white overflow-hidden flex flex-col"
                  onClick={(e) => e.stopPropagation()}
              >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(236,72,153,0.08),transparent_30%)] pointer-events-none" />
                  <div className="flex-shrink-0 flex items-start justify-between px-6 py-4 border-b border-slate-100 bg-white/90 backdrop-blur relative">
                      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
                       <div className="space-y-0.5">
                           <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Net Payout Summary</p>
                           <p className="text-base font-black text-slate-900">{netPayoutDetails.rangeLabel}</p>
                          <p className="text-[11px] text-slate-400 font-semibold">{netPayoutDetails.source === 'latest-wallet' ? 'Using latest wallet window (lowest balance)' : 'Across all available records'}</p>
                       </div>
                       <button
                           className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                           onClick={() => setShowNetPayoutPopup(false)}
                           aria-label="Close net payout summary"
                       >
                           <X size={16} />
                       </button>
                   </div>
                  <div className="relative flex-1 overflow-hidden">
                      <div className="absolute inset-0 overflow-y-auto px-6 pb-6 pt-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent overscroll-contain">
                           <div className="space-y-3">
                               {netPayoutDetails.monthly.map(section => (
                                   <div key={section.label} className="border border-slate-100 rounded-2xl p-4 bg-white shadow-sm">
                                       <div className="flex items-start justify-between gap-2">
                                           <div>
                                               <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">{section.label}</p>
                                               <p className="text-[11px] text-slate-500 font-semibold">{section.range}</p>
                                           </div>
                                           <div className="text-right">
                                               <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Net Payout</p>
                                               <p className="text-xl font-black text-slate-800">{formatCurrencyInt(section.net)}</p>
                                               <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${section.net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                   {section.net >= 0 ? 'Receivable' : 'Payable'}
                                               </span>
                                           </div>
                                       </div>
                                       <div className="grid grid-cols-2 gap-2 mt-3">
                                           {section.breakdown.map(item => (
                                               <div key={item.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                   <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
                                                   <p className={`text-sm font-extrabold ${item.tone === 'positive' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                       {formatCurrencyInt(item.value)}
                                                   </p>
                                               </div>
                                           ))}
                                       </div>
                                   </div>
                               ))}
                           </div>
                           <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                               <div>
                                   <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">Overall Net Payout</p>
                                   <p className="text-2xl font-black text-indigo-900">{formatCurrencyInt(netPayoutDetails.net)}</p>
                               </div>
                               <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${netPayoutDetails.net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                   {netPayoutDetails.net >= 0 ? 'Receivable' : 'Payable'}
                               </span>
                           </div>
                           <p className="text-[11px] text-slate-500 leading-snug">
                               Net payout is calculated as collections minus rent and fuel, plus dues and wallet adjustments, minus any direct payouts already recorded.
                           </p>
                       </div>
                   </div>
               </div>
           </div>
       )}
       {/* 1. Header & Nav */}
       <header className="bg-[#1e293b] text-white sticky top-0 z-30 shadow-xl">
           <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
               <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/50">
                       <span className="font-bold text-lg tracking-tighter">EC</span>
                   </div>
                   <div>
                       <h1 className="font-bold text-lg leading-none">Staff Room</h1>
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
                       <button onClick={exitView} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-rose-400" title="Sign Out">
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
           
           {/* Profile Header Block */}
           <div className="flex justify-between items-center px-1">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Hi, {viewingAsDriver.name.split(' ')[0]}</h2>
                    <p className="text-slate-500 text-xs font-medium flex items-center gap-2 mt-1 flex-wrap">
                        <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2  rounded-full ${viewingAsDriver.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            {viewingAsDriver.vehicle || 'No Vehicle Assigned'}
                        </span>
                       
                       <button
                            onClick={isAdmin ? toggleCashMode : undefined}
                            disabled={!isAdmin || updatingCashMode}
                            title={isAdmin ? 'Toggle cash handling mode for this driver' : 'Visible to everyone; only admins can toggle'}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold transition-all ${cashMode === 'blocked' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'} ${isAdmin ? 'hover:shadow-sm' : 'cursor-default'} ${updatingCashMode ? 'opacity-70' : ''}`}
                        >
                         
                            
                            {cashMode === 'blocked' ? 'Cash Blocked' : 'Cash Trips'}
                        </button>
                    </p>
                </div>
                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 border border-indigo-100">
                    <UserCircle size={24} />
                </div>
           </div>

           {/* Top Cards Grid (Dynamic) */}
           <div className="grid grid-cols-2 gap-4 mb-2">
               {/* Check if consolidated card (Daily Log Tab Special) */}
               {/* @ts-ignore */}
               {topCards.isConsolidated ? (
                   <div className="col-span-2 bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-center space-y-4">
                       <div className="flex items-start justify-between gap-4">
                           <div className="flex-1 space-y-1">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">{/* @ts-ignore */}{topCards.data.headerLabel}</p>
                               <p className="text-2xl font-extrabold text-slate-900">{/* @ts-ignore */}{formatCurrencyInt(topCards.data.headerValue || 0)}</p>
                               <p className="text-[10px] text-slate-500 font-semibold leading-tight">{/* @ts-ignore */}{topCards.data.headerSubtext || 'No data available'}</p>
                               {/* @ts-ignore */}
                               {topCards.data.headerBadge && (
                                   <span className="inline-flex items-center mt-1 px-2 py-1 rounded-full bg-indigo-50 text-[10px] font-semibold text-indigo-700 border border-indigo-100 tracking-[0.12em]">
                                       {topCards.data.headerBadge}
                                   </span>
                               )}
                           </div>
                           {/* @ts-ignore */}
                           {typeof topCards.data.payout === 'number' && (
                               <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 text-right shadow-inner min-w-[160px]">
                                   <p className="text-[10px] uppercase font-bold text-indigo-500 tracking-[0.16em]">Monthly Payout</p>
                                   {/* @ts-ignore */}
                                   <p className={`text-lg font-extrabold ${topCards.data.payout < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                       {/* @ts-ignore */}
                                       {formatCurrencyInt(topCards.data.payout)}
                                   </p>
                                   <p className="text-[10px] text-indigo-400 font-semibold">Cleared / Payable</p>
                               </div>
                           )}
                       </div>
                       <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                           {/* @ts-ignore */}
                           {topCards.data.stats?.map((stat: any) => (
                               <div key={stat.label} className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 text-center shadow-sm">
                                   <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 tracking-[0.12em]">{stat.label}</p>
                                   <p className={`text-base font-extrabold ${stat.colorClass || 'text-slate-800'}`}>
                                       {typeof stat.value === 'number' ? formatCurrencyInt(stat.value) : stat.value}
                                   </p>
                                   {stat.subtext && (
                                       <p className="text-[9px] text-slate-400 font-semibold leading-tight">{stat.subtext}</p>
                                   )}
                               </div>
                           ))}
                       </div>
                   </div>
               ) : (
                   <>
                       {/* Left Card */}
                       {/* @ts-ignore */}
                       {/* @ts-ignore */}
                       <div
                           onClick={activeTab === 'home' ? () => setShowNetPayoutPopup(true) : undefined}
                           className={`${topCards.left?.colorClass ?? ''} p-6 rounded-[24px] text-white relative overflow-hidden shadow-xl flex flex-col justify-center ${topCards.left?.colSpan ? `col-span-${topCards.left.colSpan}` : ''} ${activeTab === 'home' ? 'cursor-pointer transition transform hover:-translate-y-0.5' : ''}`}
                       >
                           {/* @ts-ignore */}
                           <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 mb-1">{topCards.left.label}</p>
                           {/* @ts-ignore */}
                           <h3 className={`text-3xl font-bold tracking-tight mb-1 ${topCards.left.isCurrency && typeof topCards.left.value === 'number' && topCards.left.value < 0 ? 'text-rose-300' : 'text-white'}`}>
                               {/* @ts-ignore */}
                               {topCards.left.isCurrency && typeof topCards.left.value === 'number' ? formatCurrencyInt(topCards.left.value) : topCards.left.value}
                           </h3>
                           <p className="text-[10px] text-indigo-200/80 flex items-center gap-1">
                               {/* @ts-ignore */}
                               {topCards.left?.range ? (
                                   <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10 tracking-[0.14em] uppercase text-[9px] leading-none">{topCards.left.range}</span>
                               ) : (
                                   // @ts-ignore
                                   topCards.left?.subtext
                               )}
                           </p>
                       </div>

                       {/* Right Card */}
                       {/* @ts-ignore */}
                       <div className={`${topCards.right.colorClass} p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center ${topCards.right.colSpan ? `col-span-${topCards.right.colSpan}` : ''}`}>
                            {/* @ts-ignore */}
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{topCards.right.label}</p>
                            <h3 className="text-3xl font-bold text-slate-800 mb-1">
                               {/* @ts-ignore */}
                               {topCards.right.isCurrency && typeof topCards.right.value === 'number' ? formatCurrencyInt(topCards.right.value) : topCards.right.value}
                            </h3>
                            {/* @ts-ignore */}
                            <p className="text-[10px] text-slate-400">{topCards.right.subtext}</p>
                       </div>
                    </>
                )}

                {/* Latest Payout Highlight (hidden on Daily Log) */}
                {activeTab !== 'daily' && (
                    <div className="col-span-2 bg-white p-5 rounded-[22px] border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">Latest Payout</p>
                            <p className="text-2xl font-extrabold text-slate-900 mt-1">{latestPayout ? formatCurrency(latestPayout.amount) : formatCurrency(0)}</p>
                            <p className="text-[10px] text-slate-500 font-semibold mt-1">Payout date</p>
                            <p className="text-[11px] text-slate-400">{latestPayout ? formatDate(latestPayout.date) : 'No payout recorded yet'}</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                            <Wallet size={20} />
                        </div>
                    </div>
                )}
            </div>

           {/* Tab Switcher */}
           <div className="flex p-1 bg-white rounded-xl border border-slate-100 shadow-sm">
               <button 
                  onClick={() => setActiveTab('home')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'home' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
               >
                  Overview
               </button>
               <button 
                  onClick={() => setActiveTab('daily')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'daily' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
               >
                  Daily Log
               </button>
               <button 
                  onClick={() => setActiveTab('billing')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'billing' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
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
                      <div className="bg-[#4C4E94] rounded-[32px] p-6 shadow-2xl shadow-indigo-900/30 overflow-hidden relative">
                           {/* Background Decor */}
                           <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                           
                           <div className="relative z-10">
                               <div className="flex justify-between items-start mb-6">
                                   <div>
                                       <h3 className="font-bold text-xl text-white tracking-tight">My Team</h3>
                                       <p className="text-indigo-200 text-xs font-medium mt-1">Managing {myTeam.length} Drivers</p>
                                   </div>
                                   <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-md border border-white/10">
                                       <ShieldCheck size={20} className="text-white" />
                                   </div>
                               </div>

                               <div className="space-y-3">
                                   {myTeam.map(member => {
                                       const bal = teamBalances[member.id] || 0;
                                       const memberCashMode = teamCashModes[member.id] || 'trips';
                                       return (
                                           <div
                                              key={member.id}
                                              onClick={() => viewTeamMember(member)}
                                              className="group flex items-center justify-between p-4 bg-[#5fa5f9]/10 rounded-2xl border border-white/5 hover:bg-[#5fa5f9]/20 transition-all cursor-pointer backdrop-blur-sm"
                                           >
                                              <div className="flex items-center gap-4">
                                                  <div className="w-10 h-10 rounded-full bg-[#6366f1] flex items-center justify-center font-bold text-sm text-white shadow-inner border border-white/10">
                                                      {member.name.charAt(0)}
                                                  </div>
                                                  <div className="space-y-1">
                                                      <div className="flex items-center gap-2 flex-wrap">
                                                          <p className="text-sm font-bold text-white group-hover:text-indigo-100 transition-colors">{member.name}</p>
                                                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${memberCashMode === 'blocked' ? 'bg-rose-500/20 border-rose-300/50 text-rose-100' : 'bg-emerald-500/20 border-emerald-300/50 text-emerald-50'}`}>
                                                              {memberCashMode === 'blocked' ? 'Blocked' : 'Trips'}
                                                          </span>
                                                          <button
                                                             onClick={(e) => { e.stopPropagation(); copyTeamMemberContact(member); }}
                                                             className="px-2 py-1 text-[10px] font-bold text-indigo-50 bg-white/10 border border-white/10 rounded-lg flex items-center gap-1 hover:bg-white/20 transition-colors"
                                                          >
                                                              <Copy size={12} />
                                                              {copiedDriverId === member.id ? 'Copied' : 'Copy'}
                                                          </button>
                                                      </div>
                                                      <p className="text-[11px] text-indigo-200 font-medium">
                                                          Balance: <span className={bal < 0 ? "text-rose-300 font-bold" : "text-emerald-300 font-bold"}>{formatCurrency(bal)}</span>
                                                      </p>
                                                      <div className="flex flex-col text-[11px] text-indigo-100 font-medium">
                                                          <span className="truncate">📞 {member.mobile}</span>
                                                          {member.email && <span className="truncate">✉️ {member.email}</span>}
                                                      </div>
                                                  </div>
                                              </div>
                                              <div className="flex items-center gap-3">
                                                  <button
                                                      onClick={(e) => { e.stopPropagation(); toggleTeamMemberCashMode(member.id); }}
                                                      disabled={!!teamCashModeUpdating[member.id]}
                                                      className={`hidden md:flex relative items-center gap-3 px-3 py-2 rounded-full border border-white/15 shadow-lg backdrop-blur-sm text-white transition-all duration-200 ${
                                                          memberCashMode === 'blocked'
                                                              ? 'bg-gradient-to-r from-rose-500/90 via-amber-400/90 to-orange-400/90 hover:from-rose-500 hover:to-orange-500'
                                                              : 'bg-gradient-to-r from-emerald-500/90 via-teal-400/90 to-cyan-400/90 hover:from-emerald-500 hover:to-cyan-500'
                                                      } ${teamCashModeUpdating[member.id] ? 'opacity-60 cursor-wait' : 'hover:-translate-y-0.5 hover:shadow-xl'}`}
                                                      title="Toggle cash mode for this driver"
                                                  >
                                                      <span className={`h-6 w-11 rounded-full bg-white/20 flex items-center p-1 transition-all duration-200 ${memberCashMode === 'blocked' ? 'justify-end' : 'justify-start'}`}>
                                                          <span className="h-4 w-4 rounded-full bg-white shadow-md shadow-black/20" />
                                                      </span>
                                                      <div className="flex flex-col leading-tight text-left">
                                                          <span className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/80">Cash Mode</span>
                                                          <span className="text-[11px] font-extrabold">{memberCashMode === 'blocked' ? 'Blocked' : 'Trips On'}</span>
                                                      </div>
                                                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 backdrop-blur text-white shadow-inner">
                                                          {memberCashMode === 'blocked' ? <Lock size={14} /> : <DollarSign size={14} />}
                                                      </span>
                                                  </button>
                                                  <ChevronRight className="text-white/70 md:hidden" size={18} />
                                              </div>
                                          </div>
                                      );
                                  })}
                               </div>
                           </div>
                      </div>
                  )}

                  {/* 1. Latest Bill Alert (If available) */}
                  {latestBill && (
                      <div className="bg-white p-5 rounded-[24px] border-2 border-dashed border-indigo-100 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all">
                          <div className="flex justify-between items-center mb-3">
                              <div>
                                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                                      <Clock size={12}/> Latest Bill Generated
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{latestBill.weekRange}</p>
                              </div>
                              <button onClick={() => { setSelectedBill(latestBill); }} className="bg-indigo-50 text-indigo-600 p-2 rounded-full hover:bg-indigo-100 transition-colors">
                                  <ChevronRight size={16} />
                              </button>
                          </div>
                          <div className="flex justify-between items-end bg-slate-50 p-3 rounded-xl">
                              <div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">Week Payout</p>
                                  <p className={`text-xl font-bold ${latestBill.payout < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      {formatCurrency(latestBill.payout)}
                                  </p>
                              </div>
                              <button onClick={() => downloadBill(latestBill)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-slate-50 transition-colors">
                                  <Download size={12}/> PDF
                              </button>
                          </div>
                      </div>
                  )}

                  {/* 2. Recent Daily Activity */}
                  <div>
                      <div className="flex justify-between items-end mb-3 px-2">
                          <h3 className="font-bold text-slate-800 text-sm">Recent Activity</h3>
                          <button onClick={() => setActiveTab('daily')} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700">View All</button>
                      </div>
                      <div className="space-y-3">
                          {recentLogs.map(entry => (
                              <div key={entry.id} className="bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                                   <div className="flex items-center gap-3">
                                       <div className="bg-slate-50 p-2.5 rounded-xl text-slate-400">
                                           <Calendar size={16} />
                                       </div>
                                       <div>
                                           <p className="text-sm font-bold text-slate-800">{formatDate(entry.date)}</p>
                                           <p className="text-[10px] text-slate-400 font-medium">{entry.day}</p>
                                       </div>
                                   </div>
                                   <div className="text-right">
                                       <p className="text-sm font-bold text-emerald-600">+{formatCurrency(entry.collection)}</p>
                                       <p className="text-[10px] text-slate-400">Rent: {formatCurrency(entry.rent)}</p>
                                   </div>
                              </div>
                          ))}
                          {recentLogs.length === 0 && <p className="text-center text-xs text-slate-400 py-4 bg-white rounded-2xl border border-slate-100 border-dashed">No recent activity found</p>}
                      </div>
                  </div>

                  {/* 3. Wallet Overview Card */}
                  <div className="bg-white p-6 rounded-[28px] border-4 border-slate-50/50 shadow-sm relative">
                      <div className="flex items-center gap-2 mb-6">
                        <Wallet size={20} className="text-emerald-500"/>
                        <h3 className="font-bold text-slate-800">Wallet Overview</h3>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-4 gap-y-8">
                          <div className="text-center">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Total Collection</p>
                              <p className="text-xl font-bold text-slate-700">{formatCurrency(balanceSummary.totalCollection)}</p>
                          </div>
                          <div className="text-center">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Total Fuel</p>
                              <p className="text-xl font-bold text-amber-500">{formatCurrency(balanceSummary.totalFuel)}</p>
                          </div>
                          <div className="text-center">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Vehicle Rent</p>
                              <p className="text-xl font-bold text-slate-700">{formatCurrency(balanceSummary.totalRawRent)}</p>
                          </div>
                          <div className="text-center">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Weekly Wallet</p>
                              <p className={`text-xl font-bold ${balanceSummary.totalWallet >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{formatCurrency(balanceSummary.totalWallet)}</p>
                          </div>
                      </div>
                  </div>
              </div>
           )}

           {/* DAILY TAB */}
           {activeTab === 'daily' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                  <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 text-sm">Recent Activity</h3>
                      <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-full text-slate-500 font-bold">{filteredDaily.length} Entries</span>
                  </div>
                  <div className="flex flex-wrap gap-3 items-center text-[11px] font-bold text-slate-600">
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">From</span>
                          <input
                              type="date"
                              value={fromDate}
                              onChange={(e) => setFromDate(e.target.value)}
                              className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">To</span>
                          <input
                              type="date"
                              value={toDate}
                              onChange={(e) => setToDate(e.target.value)}
                              className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                      </div>
                      {(fromDate || toDate) && (
                          <button
                              onClick={() => { setFromDate(''); setToDate(''); }}
                              className="text-[10px] font-extrabold text-indigo-600 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full hover:bg-indigo-100 transition-colors"
                          >
                              Clear Filter
                          </button>
                      )}
                  </div>
              </div>
                  <div className="divide-y divide-slate-50">
                      {filteredDaily.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-sm">No daily records found for the selected dates.</div>
                      ) : (
                          filteredDaily.map(entry => (
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
                                          <p className="text-lg font-bold text-slate-800">{formatInt(bill.trips)}</p>
                                      </div>
                                      <div className="bg-slate-50 p-3 rounded-xl">
                                          <p className="text-[10px] text-slate-400 uppercase font-bold">Rent Total</p>
                                          <p className="text-lg font-bold text-rose-500">-{formatCurrency(bill.rentTotal)}</p>
                                      </div>
                                  </div>

                                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                      <p className="text-xs font-bold text-slate-500 uppercase">Week Payout</p>
                                      <p className={`text-xl font-bold ${bill.payout < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                          {formatCurrency(bill.payout)}
                                      </p>
                                  </div>
                                  
                                  <button onClick={() => setSelectedBill(bill)} className="w-full mt-4 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-colors flex items-center justify-center gap-2">
                                      <Eye size={16}/> View Full Statement
                                  </button>
                              </div>
                          </div>
                      ))
                  )}
              </div>
           )}

       </main>

       {/* VIEW BILL MODAL (High Fidelity) */}
       {selectedBill && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
               <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden my-auto relative">
                   <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 backdrop-blur-md sticky top-0 z-10">
                       <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-indigo-600"/> Bill Details</h3>
                       <button onClick={() => setSelectedBill(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                   </div>
                   
                   <div className="p-6 md:p-8 bg-white space-y-8">
                        {/* Header Branding */}
                        <div className="text-center">
                            <h2 className="text-3xl font-extrabold text-indigo-700 uppercase tracking-tight">Encho Cabs</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">A Unit of Encho Enterprises</p>
                        </div>

                        {/* Info Block */}
                        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 flex flex-col md:flex-row justify-between gap-4 text-xs">
                            <div className="space-y-1.5">
                                <p className="text-slate-500 uppercase font-bold text-[10px]">Driver Name</p>
                                <p className="text-slate-900 font-bold text-base">{selectedBill.driver}</p>
                                <p className="text-slate-500">Vehicle QR: <strong className="text-slate-700">{selectedBill.qrCode}</strong></p>
                            </div>
                            <div className="md:text-right space-y-1.5 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-5">
                                <p className="text-slate-500 uppercase font-bold text-[10px]">Billing Period</p>
                                <p className="text-slate-900 font-bold">{selectedBill.weekRange}</p>
                                <p className="text-slate-500">Generated: <strong className="text-slate-700">{new Date().toLocaleDateString()}</strong></p>
                            </div>
                        </div>

                        {/* Payment Statement Table */}
                        <div>
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 border-b-2 border-slate-100 pb-2">Payment Statement</h4>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Total Trips Completed</span><span className="font-bold text-slate-800">{formatInt(selectedBill.trips)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Rent / Day (Applied)</span><span className="font-bold text-slate-800">{formatCurrency(selectedBill.rentPerDay)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Days Worked</span><span className="font-bold text-slate-800">{selectedBill.daysWorked}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Weekly Rent Deduction</span><span className="font-bold text-rose-600">- {formatCurrency(selectedBill.rentTotal)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Fuel Advances</span><span className="font-bold text-rose-600">- {formatCurrency(selectedBill.fuel)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Wallet Earnings (Weekly)</span><span className="font-bold text-emerald-600">+ {formatCurrency(selectedBill.wallet)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Rental Collection</span><span className="font-bold text-emerald-600">+ {formatCurrency(selectedBill.collection)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Previous Dues/Credit</span><span className="font-bold text-slate-800">{formatCurrency(selectedBill.overdue)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Adjustments</span><span className="font-bold text-slate-800">{formatCurrency(selectedBill.adjustments)}</span></div>
                            </div>
                            <div className="mt-6 bg-slate-100 p-4 rounded-xl flex justify-between items-center border-l-4 border-slate-800">
                                <span className="text-sm font-bold text-slate-700 uppercase">Week Payout</span>
                                <span className="text-2xl font-black text-slate-900">{formatCurrency(selectedBill.payout)}</span>
                            </div>
                        </div>

                        {/* Weekly Wallet Breakdown */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Weekly Wallet Breakdown</h4>
                            <div className="grid grid-cols-2 gap-y-3 text-xs">
                                <div className="text-slate-500 font-medium">Gross Earnings</div><div className="text-right font-bold text-slate-800">{formatCurrency(selectedBill.weeklyDetails.earnings)}</div>
                                <div className="text-slate-500 font-medium">Refunds</div><div className="text-right font-bold text-slate-800">{formatCurrency(selectedBill.weeklyDetails.refund)}</div>
                                <div className="text-slate-500 font-medium">Deductions</div><div className="text-right font-bold text-rose-600">-{formatCurrency(selectedBill.weeklyDetails.diff)}</div>
                                <div className="text-slate-500 font-medium">Charges</div><div className="text-right font-bold text-rose-600">-{formatCurrency(selectedBill.weeklyDetails.charges)}</div>
                                <div className="text-slate-500 font-medium">Cash (Wallet)</div><div className="text-right font-bold text-rose-600">-{formatCurrency(selectedBill.weeklyDetails.cash)}</div>
                                <div className="col-span-2 h-px bg-slate-100 my-1"></div>
                                <div className="text-indigo-600 font-bold">Wallet Total</div><div className="text-right font-bold text-indigo-600">{formatCurrency(selectedBill.wallet)}</div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="text-center text-[10px] text-slate-400 font-medium pt-4 border-t border-slate-100">
                            System Generated Bill • Encho Cabs
                        </div>
                   </div>

                   <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3 sticky bottom-0 z-10">
                       <button onClick={() => downloadBill(selectedBill)} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                           <Download size={18} /> Download PDF
                       </button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default DriverPortalPage;
