
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { storageService } from '../services/storageService';
import { useLiveUpdates, type LiveUpdateEvent } from '../lib/useLiveUpdates';
import { CashMode, DailyEntry, WeeklyWallet, Driver, RentalSlab, DriverExpense } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Download, Calendar, Wallet, FileText, ChevronRight, LogOut, 
  UserCircle, TrendingUp, TrendingDown, DollarSign, MapPin, 
  CheckCircle, AlertCircle, Eye, X, ShieldCheck, Users, ArrowLeft, Lock, ArrowRight, Gauge, BarChart3, ChevronDown, Copy, AlertTriangle, ArrowUpRight, Clock, Ticket, Utensils, Bell, Phone, MessageCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NetCalculationPopup from './NetCalculationPopup';
import { registerDriverPushNotifications } from '../lib/pushNotifications';

type PortalDailyEntry = DailyEntry & { adjustmentApplied?: number; adjustedDue?: number };
type ExpenseDailySummary = { total: number; labels: string[] };

const getDueLabel = (entry: DailyEntry) => {
  const custom = String(entry.dueLabel || '').trim();
  return custom || 'Due';
};

const getExpenseLabel = (expense: DriverExpense) => {
  const custom = String(expense.customType || '').trim();
  if (custom) return custom;
  const category = String(expense.category || '').trim();
  return category || 'Expense';
};

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
  const [rawExpenses, setRawExpenses] = useState<DriverExpense[]>([]);
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
  const [unreadUpdateCount, setUnreadUpdateCount] = useState(0);
  const [lastUpdateLabel, setLastUpdateLabel] = useState<string | null>(null);
  const [calcPopup, setCalcPopup] = useState<{
      metric: 'netPayout' | 'netBalance';
      values: {
          collection: number;
          rent: number;
          fuel: number;
          due: number;
          wallet: number;
          payout: number;
          expenses: number;
      };
      netValue: number;
      title?: string;
      sourceNote?: string;
  } | null>(null);

  const PORTAL_FALLBACK_REFRESH_MS = 60000;
  const CASHMODE_FALLBACK_REFRESH_MS = 20000;
  const DRIVERS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
  const portalRefreshTimerRef = useRef<number | null>(null);
  const cashModeRefreshTimerRef = useRef<number | null>(null);
  const lastDriversRefreshRef = useRef(0);
  const previousNetBalanceRef = useRef<number | null>(null);

  const tabOptions: {
      key: 'home' | 'daily' | 'billing';
      label: string;
      icon: LucideIcon;
  }[] = [
      { key: 'home', label: 'Overview', icon: Gauge },
      { key: 'daily', label: 'Daily Log', icon: Calendar },
      { key: 'billing', label: 'Billings', icon: FileText }
  ];

  const activeTabMeta = tabOptions.find(tab => tab.key === activeTab) || tabOptions[0];
  const ActiveTabIcon = activeTabMeta.icon;

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

  const foodTicketDate = useMemo(() => {
      const now = new Date();
      const datePart = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      const dayPart = now.toLocaleDateString('en-GB', { weekday: 'short' });
      return `${datePart} (${dayPart})`;
  }, []);

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

  const dailyWithAdjustments = useMemo<PortalDailyEntry[]>(() => {
      if (!rawWeekly.length) {
          return rawDaily.map(entry => ({ ...entry, adjustedDue: entry.due }));
      }

      const mapped: PortalDailyEntry[] = rawDaily.map(entry => ({
          ...entry,
          adjustmentApplied: 0,
          adjustedDue: entry.due
      }));

      rawWeekly.forEach(wallet => {
          const adjustment = Math.max(0, wallet.adjustments || 0);
          if (!adjustment) return;

          const candidates = mapped.filter(e =>
              e.driver === wallet.driver &&
              e.date >= wallet.weekStartDate &&
              e.date <= wallet.weekEndDate
          );

          if (candidates.length === 0) return;

          const targetDate = wallet.weekEndDate;
          let targetIndex = mapped.findIndex(e =>
              e.driver === wallet.driver && e.date === targetDate
          );

          if (targetIndex === -1) {
              const latest = [...candidates].sort((a, b) => b.date.localeCompare(a.date))[0];
              targetIndex = mapped.findIndex(e => e.id === latest.id);
          }

          if (targetIndex === -1) return;

          const target = mapped[targetIndex];
          const applied = (target.adjustmentApplied || 0) + adjustment;
          mapped[targetIndex] = {
              ...target,
              adjustmentApplied: applied,
              adjustedDue: (target.due || 0) + applied
          };
      });

      return mapped.map(entry => ({
          ...entry,
          adjustedDue: entry.adjustedDue ?? (entry.due || 0) + (entry.adjustmentApplied || 0)
      }));
  }, [rawDaily, rawWeekly]);

  const filteredDaily = useMemo(() => {
      const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
      const end = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

      return dailyWithAdjustments.filter(entry => {
          const entryTime = new Date(entry.date).getTime();
          if (start !== null && entryTime < start) return false;
          if (end !== null && entryTime > end) return false;
          return true;
      });
  }, [dailyWithAdjustments, fromDate, toDate]);

  const weeklyWalletByEntryId = useMemo(() => {
      const map = new Map<string, WeeklyWallet>();
      if (!dailyWithAdjustments.length || !rawWeekly.length) {
          return map;
      }

      rawWeekly.forEach(wallet => {
          const relevantDaily = dailyWithAdjustments.filter(entry =>
              entry.driver === wallet.driver &&
              entry.date >= wallet.weekStartDate &&
              entry.date <= wallet.weekEndDate
          );

          if (!relevantDaily.length) return;

          const latestEntry = relevantDaily.reduce((latest, entry) => (
              entry.date > latest.date ? entry : latest
          ), relevantDaily[0]);

          map.set(latestEntry.id, wallet);
      });

      return map;
  }, [dailyWithAdjustments, rawWeekly]);

  const filteredWeekly = useMemo(() => {
      const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
      const end = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

      return rawWeekly.filter(week => {
          const weekStart = new Date(week.weekStartDate).getTime();
          const weekEnd = new Date(week.weekEndDate).getTime();

          if (start !== null && weekEnd < start) return false;
          if (end !== null && weekStart > end) return false;
          return true;
      });
  }, [fromDate, rawWeekly, toDate]);

  const filteredExpenses = useMemo(() => {
      const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
      const end = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

      return rawExpenses.filter(expense => {
          const expenseTime = new Date(expense.expenseDate).getTime();
          if (start !== null && expenseTime < start) return false;
          if (end !== null && expenseTime > end) return false;
          return true;
      });
  }, [fromDate, rawExpenses, toDate]);

  const expensesByDate = useMemo(() => {
      return rawExpenses.reduce<Record<string, ExpenseDailySummary>>((acc, expense) => {
          const key = expense.expenseDate;
          if (!acc[key]) {
              acc[key] = { total: 0, labels: [] };
          }
          acc[key].total += Number(expense.amount || 0);
          const label = getExpenseLabel(expense);
          if (label && !acc[key].labels.includes(label)) {
              acc[key].labels.push(label);
          }
          return acc;
      }, {});
  }, [rawExpenses]);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    // Initial Load based on Authenticated User
    if (user) {
        initializePortal();
    }
  }, [user]);

  useEffect(() => {
      if (user?.role !== 'driver') return;
      const targetDriverId = user.driverId || viewingAsDriver?.id;
      if (!targetDriverId) return;

      registerDriverPushNotifications(targetDriverId).catch((error) => {
          console.warn('Push registration skipped:', error);
      });
  }, [user?.driverId, user?.role, viewingAsDriver?.id]);

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
          const [allDrivers, slabs] = await Promise.all([
              storageService.getDrivers(),
              storageService.getDriverRentalSlabs()
          ]);
          const visibleDrivers = allDrivers.filter(d => !d.isHidden);
          const sortedSlabs = slabs.sort((a, b) => a.minTrips - b.minTrips);
          setRentalSlabs(sortedSlabs);

          setDriversList(visibleDrivers.sort((a, b) => a.name.localeCompare(b.name)));
          if (user?.role === 'admin' || user?.role === 'super_admin') {
              lastDriversRefreshRef.current = Date.now();
          }

          let targetDriver: Driver | undefined;

          if (user?.role === 'driver' && user.driverId) {
              targetDriver = visibleDrivers.find(d => d.id === user.driverId);
          } else if ((user?.role === 'admin' || user?.role === 'super_admin')) {
              targetDriver = visibleDrivers.find(d => d.email === user.email);
              if (!targetDriver) {
                  targetDriver = visibleDrivers.find(d => !d.terminationDate) || visibleDrivers[0];
              }
          }

          if (!targetDriver) {
              setInitError("No driver profile found linked to this account.");
              return;
          }

          let allDaily: DailyEntry[] = [];
          let allWeekly: WeeklyWallet[] = [];
          let allExpenses: DriverExpense[] = [];

          let teamMembers: Driver[] = [];
          if (targetDriver.isManager) {
              const myAccess = await storageService.getManagerAccessByManagerId(targetDriver.id);
              if (myAccess && myAccess.childDriverIds.length > 0) {
                  teamMembers = visibleDrivers.filter(d => myAccess.childDriverIds.includes(d.id));
                  setMyTeam(teamMembers);
              }
          }

          const driversToLoad = [targetDriver.name, ...teamMembers.map(member => member.name)].filter(Boolean);
          const uniqueDrivers = Array.from(new Set(driversToLoad));

          const [bootstrapPayload, expensesPayload] = await Promise.all([
              storageService.getDailyEntriesBootstrap({
                  drivers: uniqueDrivers,
                  includeMeta: false,
              }),
              storageService.getDriverExpenses({ drivers: uniqueDrivers })
          ]);
          allDaily = bootstrapPayload.entries;
          allWeekly = bootstrapPayload.weeklyWallets;
          allExpenses = expensesPayload;

          setGlobalDaily(allDaily);
          setGlobalWeekly(allWeekly);
          setRawExpenses(allExpenses.filter(e => e.driver === targetDriver.name).sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()));

          if (teamMembers.length > 0) {
              const balances: Record<string, number> = {};
              teamMembers.forEach(member => {
                  const stats = storageService.calculateDriverStats(member.name, allDaily, allWeekly, sortedSlabs, allExpenses);
                  balances[member.id] = stats.finalTotal;
              });
              setTeamBalances(balances);

              const cashModes: Record<string, CashMode> = {};
              await Promise.all(teamMembers.map(async member => {
                  const mode = await storageService.getDriverCashMode(member.id);
                  cashModes[member.id] = mode;
              }));
              setTeamCashModes(cashModes);
          }

          setPrimaryDriver(targetDriver);
          switchToDriverView(targetDriver, allDaily, allWeekly, allExpenses);
          refreshCashMode(targetDriver.id, true);
      } catch (err: any) {
          console.error("Portal Initialization Error:", err);
          setInitError(err.message || "Failed to load portal data. Check connection.");
      }
  };

  const getScopedDriverNames = useCallback((activeDriverName?: string) => {
      const scopedDrivers = [
          activeDriverName,
          primaryDriver?.name,
          ...myTeam.map(member => member.name)
      ].filter(Boolean) as string[];

      return Array.from(new Set(scopedDrivers));
  }, [myTeam, primaryDriver?.name]);

  const refreshPortalData = useCallback(async (options?: { includeDrivers?: boolean }) => {
      if (!user || !viewingAsDriver) return;
      try {
          const shouldLoadDrivers = options?.includeDrivers ?? false;
          const scopedDriverNames = getScopedDriverNames(viewingAsDriver.name);

          const [drivers, bootstrapPayload, expensesPayload] = await Promise.all([
              shouldLoadDrivers ? storageService.getDrivers() : Promise.resolve(null),
              storageService.getDailyEntriesBootstrap({ drivers: scopedDriverNames, fresh: 1, includeMeta: false }),
              storageService.getDriverExpenses({ drivers: scopedDriverNames, fresh: 1 })
          ]);
          const dailyEntries = bootstrapPayload.entries;
          const weeklyWallets = bootstrapPayload.weeklyWallets;
          const expenses = expensesPayload;

          if (drivers) {
              const visibleDrivers = drivers.filter(d => !d.isHidden);
              setDriversList(visibleDrivers.sort((a, b) => a.name.localeCompare(b.name)));
          }

          const updatedDriver = drivers?.find(d => d.id === viewingAsDriver.id);
          if (updatedDriver) {
              setViewingAsDriver(updatedDriver);
              if (primaryDriver && primaryDriver.id === updatedDriver.id) {
                  setPrimaryDriver(updatedDriver);
              }
          }

          const allDaily = dailyEntries;
          const allWeekly = weeklyWallets;

          setGlobalDaily(allDaily);
          setGlobalWeekly(allWeekly);

          const activeName = updatedDriver?.name || viewingAsDriver.name;
          setRawDaily(allDaily.filter(d => d.driver === activeName).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
          setRawWeekly(allWeekly.filter(w => w.driver === activeName).sort((a,b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime()));
          setRawExpenses(expenses.filter(e => e.driver === activeName).sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()));

          if (myTeam.length > 0) {
              const balances: Record<string, number> = {};
              myTeam.forEach(member => {
                  const stats = storageService.calculateDriverStats(member.name, allDaily, allWeekly, rentalSlabs, expenses);
                  balances[member.id] = stats.finalTotal;
              });
              setTeamBalances(balances);
          }
      } catch (err) {
          console.error('Failed to refresh portal data', err);
      }
  }, [getScopedDriverNames, myTeam, primaryDriver, rentalSlabs, user, viewingAsDriver]);

  const { connected: liveUpdatesConnected } = useLiveUpdates((event) => {
      const type = event?.type;
      if (!type) return;

      const formatLiveUpdateLabel = (payload: LiveUpdateEvent): string | null => {
          if (payload.type === 'weekly_wallets_changed') {
              const hasWalletBalance = typeof payload.walletBalance === 'number' && !Number.isNaN(payload.walletBalance);
              const driverLabel = payload.driver ? `${payload.driver}: ` : '';

              if (hasWalletBalance) {
                  return `${driverLabel}Weekly wallet balance ${formatCurrencyInt(payload.walletBalance || 0)}`;
              }

              return `${driverLabel}Weekly wallet updated`;
          }

          const updateLabels: Record<string, string> = {
              daily_entries_changed: 'Daily log updated',
              driver_expenses_changed: 'Expenses updated',
              drivers_changed: 'Driver profile updated',
              leaves_changed: 'Leave data updated',
              cash_mode_changed: 'Cash mode changed'
          };

          return updateLabels[payload.type || ''] || null;
      };

      const notificationLabel = formatLiveUpdateLabel(event);
      if (notificationLabel) {
          setUnreadUpdateCount(prev => Math.min(prev + 1, 99));
          setLastUpdateLabel(notificationLabel);
      }

      if (['daily_entries_changed', 'weekly_wallets_changed', 'driver_expenses_changed', 'drivers_changed', 'leaves_changed'].includes(type)) {
          if (portalRefreshTimerRef.current !== null) {
              window.clearTimeout(portalRefreshTimerRef.current);
          }
          portalRefreshTimerRef.current = window.setTimeout(() => {
              const now = Date.now();
              const includeDrivers = type === 'drivers_changed' || (now - lastDriversRefreshRef.current) > DRIVERS_REFRESH_INTERVAL_MS;
              if (includeDrivers) {
                  lastDriversRefreshRef.current = now;
              }
              refreshPortalData({ includeDrivers });
              portalRefreshTimerRef.current = null;
          }, 300);
      }

      if (type === 'cash_mode_changed' && viewingAsDriver?.id) {
          if (cashModeRefreshTimerRef.current !== null) {
              window.clearTimeout(cashModeRefreshTimerRef.current);
          }
          const driverId = viewingAsDriver.id;
          cashModeRefreshTimerRef.current = window.setTimeout(() => {
              refreshCashMode(driverId);
              cashModeRefreshTimerRef.current = null;
          }, 200);
      }
  }, !!user);

  useEffect(() => {
      return () => {
          if (portalRefreshTimerRef.current !== null) {
              window.clearTimeout(portalRefreshTimerRef.current);
              portalRefreshTimerRef.current = null;
          }
          if (cashModeRefreshTimerRef.current !== null) {
              window.clearTimeout(cashModeRefreshTimerRef.current);
              cashModeRefreshTimerRef.current = null;
          }
      };
  }, []);

  useEffect(() => {
      if (!user || !viewingAsDriver) return;
      let isMounted = true;
      const poll = async () => {
          if (!isMounted || liveUpdatesConnected) return;
          await refreshPortalData({ includeDrivers: false });
      };

      poll();
      const interval = window.setInterval(poll, PORTAL_FALLBACK_REFRESH_MS);
      return () => {
          isMounted = false;
          window.clearInterval(interval);
      };
  }, [liveUpdatesConnected, refreshPortalData, user, viewingAsDriver]);

  const switchToDriverView = (targetDriver: Driver, allDaily: DailyEntry[], allWeekly: WeeklyWallet[], allExpenses: DriverExpense[] = []) => {
      setViewingAsDriver(targetDriver);
      const myDaily = allDaily.filter(d => d.driver === targetDriver.name).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const myWeekly = allWeekly.filter(w => w.driver === targetDriver.name).sort((a,b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime());
      const myExpenses = allExpenses.filter(e => e.driver === targetDriver.name).sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());
      setRawDaily(myDaily);
      setRawWeekly(myWeekly);
      setRawExpenses(myExpenses);
      setActiveTab('home');
      window.scrollTo(0, 0);
      refreshCashMode(targetDriver.id, true);
  };

  const handleAdminDriverSwitch = async (driverId: string) => {
      const target = driversList.find(d => d.id === driverId);
      if (target) {
          try {
              const bootstrapPayload = await storageService.getDailyEntriesBootstrap({
                  drivers: getScopedDriverNames(target.name),
                  fresh: 1,
                  includeMeta: false,
              });
              const dailyEntries = bootstrapPayload.entries;
              const weeklyWallets = bootstrapPayload.weeklyWallets;

              setGlobalDaily(dailyEntries);
              setGlobalWeekly(weeklyWallets);
              const expenses = await storageService.getDriverExpenses({ drivers: getScopedDriverNames(target.name), fresh: 1 });
              switchToDriverView(target, dailyEntries, weeklyWallets, expenses);
          } catch (err) {
              console.error('Failed to switch admin driver view', err);
              alert('Could not load selected driver data. Please try again.');
          }
      }
  };

  const returnToDashboard = async () => {
      navigate('/app');
  };

  const exitView = async () => {
      if (user?.role === 'driver') {
          if (user.driverId && viewingAsDriver && primaryDriver && viewingAsDriver.id !== user.driverId) {
              const scopedDrivers = getScopedDriverNames(primaryDriver.name);
              const expenses = await storageService.getDriverExpenses({ drivers: scopedDrivers, fresh: 1 });
              switchToDriverView(primaryDriver, globalDaily, globalWeekly, expenses);
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

  // Continuously sync cash mode across admin/manager/driver views (fallback when live stream disconnects)
  useEffect(() => {
      if (!viewingAsDriver) return;

      let isMounted = true;
      const driverId = viewingAsDriver.id;

      const sync = async () => {
          if (!isMounted || liveUpdatesConnected) return;
          await refreshCashMode(driverId);
      };

      sync();
      const interval = setInterval(sync, CASHMODE_FALLBACK_REFRESH_MS);

      return () => {
          isMounted = false;
          clearInterval(interval);
      };
  }, [liveUpdatesConnected, refreshCashMode, viewingAsDriver?.id]);
  
  const viewTeamMember = async (member: Driver) => {
      try {
        const bootstrapPayload = await storageService.getDailyEntriesBootstrap({ driver: member.name, includeMeta: false });
        const allDaily = bootstrapPayload.entries;
        const allWeekly = bootstrapPayload.weeklyWallets;
        const scopedDrivers = getScopedDriverNames(member.name);
        const expenses = await storageService.getDriverExpenses({ drivers: scopedDrivers, fresh: 1 });
        switchToDriverView(member, allDaily, allWeekly, expenses);
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


  const getAdjustedDue = useCallback((entry: DailyEntry | PortalDailyEntry) => {
      const adjusted = (entry as PortalDailyEntry).adjustedDue;
      if (typeof adjusted === 'number') {
          return adjusted;
      }

      return entry.due;
  }, []);

  const calculateWalletWeek = (wallet: WeeklyWallet) => {
      const earnings = Number(wallet.earnings) || 0;
      const refund = Number(wallet.refund) || 0;
      const diff = Number(wallet.diff) || 0;
      const cash = Number(wallet.cash) || 0;
      const charges = Number(wallet.charges) || 0;

      return earnings + refund - (diff + cash + charges);
  };

  // --- 1. BILLING CALCULATION ENGINE ---
  const billingData = useMemo(() => {
    if (!viewingAsDriver) return [];

    return rawWeekly.map(wallet => {
       const startDate = new Date(wallet.weekStartDate);
       const endDate = new Date(wallet.weekEndDate);
       
       const relevantDaily = dailyWithAdjustments.filter(d => {
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
       const overdue = relevantDaily.reduce((sum, d) => sum + getAdjustedDue(d), 0);
       const weeklyExpenses = rawExpenses
           .filter(expense => expense.expenseDate >= wallet.weekStartDate && expense.expenseDate <= wallet.weekEndDate)
           .reduce((sum, expense) => sum + (expense.amount || 0), 0);
       const walletAmount = calculateWalletWeek(wallet);
       const grossEarnings = wallet.earnings || 0; 

      const adjustments = Math.max(0, wallet.adjustments || 0);

      const payout = collection - rentTotal - fuel + overdue + walletAmount - weeklyExpenses;
       
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
           expenses: weeklyExpenses,
           wallet: walletAmount,
           overdue,
           adjustments,
           payout,
           dailyDetails: relevantDaily,
           weeklyDetails: wallet,
           isAdjusted: !!slab || (wallet.rentOverride !== undefined && wallet.rentOverride !== null)
       };
    });
  }, [dailyWithAdjustments, rawWeekly, rentalSlabs, rawExpenses, viewingAsDriver]);

  // --- 2. BALANCE CALCULATION ---
  const driverStats = useMemo(() => {
      if (!viewingAsDriver) return null;
      return storageService.calculateDriverStats(viewingAsDriver.name, rawDaily, rawWeekly, rentalSlabs, rawExpenses);
  }, [viewingAsDriver, rawDaily, rawWeekly, rentalSlabs, rawExpenses]);

  const openCalculationPopup = (metric: 'netPayout' | 'netBalance') => {
      if (!viewingAsDriver) return;

      const activeStats = isDateFilterActive
          ? storageService.calculateDriverStats(viewingAsDriver.name, filteredDaily, filteredWeekly, rentalSlabs, filteredExpenses)
          : driverStats;

      if (!activeStats) return;

      const filterStart = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
      const filterEnd = toDate ? new Date(`${toDate}T23:59:59`) : null;
      const dailyDates = filteredDaily.map(entry => new Date(entry.date));
      const weeklyStarts = filteredWeekly.map(week => new Date(week.weekStartDate));
      const weeklyEnds = filteredWeekly.map(week => new Date(week.weekEndDate));
      const rangeStart = filterStart ?? (dailyDates.length || weeklyStarts.length
          ? [...dailyDates, ...weeklyStarts].reduce((min, date) => (date < min ? date : min))
          : undefined);
      const rangeEnd = filterEnd ?? (dailyDates.length || weeklyEnds.length
          ? [...dailyDates, ...weeklyEnds].reduce((max, date) => (date > max ? date : max))
          : undefined);
      const rangeLabel = isDateFilterActive ? formatShortRange(rangeStart, rangeEnd) : undefined;

      setCalcPopup({
          metric,
          values: {
              collection: activeStats.totalCollection,
              rent: activeStats.totalRent,
              fuel: activeStats.totalFuel,
              due: activeStats.totalDue,
              wallet: activeStats.totalWalletWeek,
              payout: activeStats.totalPayout,
              expenses: activeStats.totalExpenses
          },
          netValue: metric === 'netPayout' ? activeStats.netPayout : activeStats.finalTotal,
          title: `${metric === 'netPayout' ? 'Net Payout' : 'Net Balance'}${viewingAsDriver ? ` • ${viewingAsDriver.name}` : ''}`,
          sourceNote: isDateFilterActive
              ? `Using filtered activity${rangeLabel ? ` (${rangeLabel})` : ''}.`
              : metric === 'netPayout'
                  ? (activeStats.netPayoutSource === 'latest-wallet' && activeStats.netPayoutRange
                      ? `Using the latest wallet window (${activeStats.netPayoutRange}) to stay conservative.`
                      : 'Using overall balance across all recorded activity.')
                  : 'Overall balance across all recorded activity.'
      });
  };

  const balanceSummary = useMemo(() => {
      if (!driverStats) return { netPayout: 0, totalCollection: 0, totalRawRent: 0, totalFuel: 0, totalWallet: 0, totalExpenses: 0, netRange: undefined as string | undefined };
      return {
          netPayout: driverStats.netPayout,
          netRange: driverStats.netPayoutSource === 'latest-wallet' ? driverStats.netPayoutRange : undefined,
          totalCollection: driverStats.totalCollection,
          totalRawRent: driverStats.totalRent,
          totalFuel: driverStats.totalFuel,
          totalWallet: driverStats.totalWalletWeek,
          totalExpenses: driverStats.totalExpenses
      };
  }, [driverStats]);

  const netBalance = driverStats?.finalTotal ?? 0;
  const hasFoodAccess = user?.role === 'driver' && Boolean(viewingAsDriver?.foodOption);

  const vehiclePartnerDriver = useMemo(() => {
      if (!viewingAsDriver?.vehicle) return null;

      return driversList.find(driver =>
          !driver.terminationDate &&
          driver.id !== viewingAsDriver.id &&
          driver.vehicle === viewingAsDriver.vehicle
      ) || null;
  }, [driversList, viewingAsDriver]);

  const normalizePhoneForWhatsApp = (value?: string) => {
      const digits = (value || '').replace(/[^\d]/g, '');
      if (!digits) return '';

      if (digits.length === 10) {
          return `91${digits}`;
      }

      if (digits.length === 11 && digits.startsWith('0')) {
          return `91${digits.slice(1)}`;
      }

      return digits;
  };
  const isFoodTicketActive = netBalance >= 0;

  useEffect(() => {
      if (!viewingAsDriver) return;

      if (previousNetBalanceRef.current === null) {
          previousNetBalanceRef.current = netBalance;
          return;
      }

      if (previousNetBalanceRef.current !== netBalance) {
          setLastUpdateLabel(`Net balance updated: ${formatCurrencyInt(netBalance)}`);
          previousNetBalanceRef.current = netBalance;
      }
  }, [netBalance, viewingAsDriver]);

  // --- 3. AGGREGATED STATS (Month/Prev Month/Year) ---
    const aggregatedStats = useMemo(() => {
        if (!viewingAsDriver || (rawDaily.length === 0 && rawWeekly.length === 0)) {
            return {
                monthCollection: 0,
                monthRent: 0,
                monthPayout: 0,
                monthWallet: 0,
                monthFuel: 0,
                monthExpenses: 0,
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
                rangeExpenses: 0,
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
        let monthExpenses = 0;
        let totalDues = 0;
        let yearCollection = 0;
        let monthTrips = 0;

        dailyWithAdjustments.forEach(entry => {
            const d = new Date(entry.date);
            const eYear = d.getFullYear();
            const eMonth = d.getMonth();

            // Current Year
            if (eYear === currentYear) {
                yearCollection += entry.collection;
                // Current Month
                if (eMonth === currentMonth) {
                    monthCollection += entry.collection;
                    monthRent += entry.rent;
                    monthFuel += entry.fuel;
                    monthPayout += (entry.payout || 0);
                    totalDues += getAdjustedDue(entry);
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
        monthWallet = currentMonthWeeks.reduce((sum, w) => sum + calculateWalletWeek(w), 0);

        const monthDaily = rawDaily.filter(entry => {
            const d = new Date(entry.date);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });

        const monthWeekly = rawWeekly.filter(w => {
            const startD = new Date(w.weekStartDate);
            const endD = new Date(w.weekEndDate);
            return startD <= monthEnd && endD >= monthStart;
        });
        const monthExpensesList = rawExpenses.filter(expense => {
            const e = new Date(expense.expenseDate);
            return e.getFullYear() === currentYear && e.getMonth() === currentMonth;
        });
        monthExpenses = monthExpensesList.reduce((sum, expense) => sum + (expense.amount || 0), 0);

        const monthStats = storageService.calculateDriverStats(
            viewingAsDriver.name,
            monthDaily,
            monthWeekly,
            rentalSlabs,
            monthExpensesList
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
        let rangeExpenses = 0;

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
                rangeDues += getAdjustedDue(entry);
                rangeFuel += entry.fuel;
                rangePayout += (entry.payout || 0);
            });

            rangeWallet = rangeWeekly.reduce((sum, week) => sum + calculateWalletWeek(week), 0);
            rangeEarnings = rangeWeekly.reduce((sum, week) => sum + (week.earnings || 0), 0);
            rangeExpenses = filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
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
            monthExpenses,
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
            rangeExpenses,
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
    }, [dailyWithAdjustments, filteredDaily, filteredExpenses, fromDate, getAdjustedDue, isDateFilterActive, rawDaily, rawWeekly, rentalSlabs, rawExpenses, toDate, viewingAsDriver]);

  // --- 4. DYNAMIC CARD DATA ---
    const topCards: any = useMemo(() => {
        const latestBill = billingData[0];

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
                        },
                        {
                            label: 'Total Expenses',
                            value: balanceSummary.totalExpenses,
                            colorClass: 'text-rose-600'
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
                            },
                            {
                                label: 'Expenses',
                                value: aggregatedStats.rangeExpenses,
                                colorClass: 'text-rose-600'
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
                            },
                            {
                                label: 'Month Expenses',
                                value: aggregatedStats.monthExpenses,
                                colorClass: 'text-rose-600'
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
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #334155;">${formatCurrency(getAdjustedDue(d))}</td>
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
               <div class="st-row"><span class="st-label">Shared Expenses</span><span class="st-val red">- ${formatCurrency(bill.expenses || 0)}</span></div>
               <div class="st-row"><span class="st-label">Wallet Earnings (Weekly)</span><span class="st-val green">+ ${formatCurrency(bill.wallet)}</span></div>
               <div class="st-row"><span class="st-label">Rental Collection</span><span class="st-val green">+ ${formatCurrency(bill.collection)}</span></div>
               <div class="st-row"><span class="st-label">Previous Dues/Credit</span><span class="st-val">${formatCurrency(bill.overdue)}</span></div>
            </div>
            <div class="net-box">
               <span class="net-label">WEEK PAYOUT</span>
               <span class="net-val">${formatCurrency(bill.payout)}</span>
            </div>
            <div class="section-title" style="margin-top: 40px; text-align: left;">Daily Activity Log</div>
            <table>
              <thead><tr><th>Date</th><th>Driver</th><th style="text-align:right">Rent</th><th style="text-align:right">Collection</th><th style="text-align:right">Fuel</th><th style="text-align:right">Dues</th></tr></thead>
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
               <div className="flex items-center gap-2">
                   <div className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${netBalance >= 0 ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300' : 'bg-rose-500/10 border-rose-400/30 text-rose-300'}`}>
                       Net {formatCurrencyInt(netBalance)}
                   </div>
                   <button
                       onClick={() => setUnreadUpdateCount(0)}
                       className="relative p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-300"
                       title={lastUpdateLabel ? `${lastUpdateLabel} • Tap to mark as seen` : 'Live updates'}
                   >
                       <Bell size={20} />
                       {unreadUpdateCount > 0 && (
                           <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center border border-slate-900">
                               {unreadUpdateCount}
                           </span>
                       )}
                   </button>
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

           {lastUpdateLabel && (
               <div className="max-w-md mx-auto px-6 pb-3">
                   <p className="inline-flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 px-2.5 py-1 rounded-full font-semibold">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                       {lastUpdateLabel}
                   </p>
               </div>
           )}
           
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
                <div className="flex items-center gap-3">
                    {hasFoodAccess && (
                        <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-white via-amber-50 to-amber-100 px-4 py-3 shadow-sm">
                            <div className="absolute inset-y-0 right-0 w-10 bg-amber-200/50 blur-2xl" aria-hidden="true" />
                            <div className="relative flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isFoodTicketActive ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                    <Utensils size={18} />
                                </div>
                                <div className="min-w-[110px]">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">Food Ticket</p>
                                    
                                    <p className="text-sm font-extrabold text-slate-900 flex items-center gap-1">
                                       <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border text-sm ${isFoodTicketActive ? ' font-extrabold  bg-emerald-50 text-emerald-700 border-emerald-200' : ' font-extrabold bg-rose-50 text-rose-700 border-rose-200'}`}>
                                        {isFoodTicketActive ? 'Active' : 'Payment Due'}
                                    </span> <Ticket size={14} className="text-amber-500" />
                                    </p>
                                  <p className="text-[11px] font-semibold text-slate-500 mt-1">{foodTicketDate}</p>
                                    
                                </div>
                            </div>
                        </div>
                    )}
                    {!hasFoodAccess && (
                        <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 border border-indigo-100">
                            <UserCircle size={24} />
                        </div>
                    )}
                </div>
           </div>

           <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                  <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Assigned Vehicle</p>
                      <p className="text-base font-bold text-slate-800 mt-1">{viewingAsDriver.vehicle || 'No Vehicle Assigned'}</p>
                  </div>
                  <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Current Shift</p>
                      <p className="text-sm font-semibold text-slate-700 mt-1">{viewingAsDriver.currentShift}</p>
                  </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">Other Driver on Same Vehicle</p>
                  {vehiclePartnerDriver ? (
                      <div className="flex items-start justify-between gap-3">
                          <div>
                              <p className="text-sm font-bold text-slate-800">{vehiclePartnerDriver.name}</p>
                              <p className="text-xs text-slate-500">📞 {vehiclePartnerDriver.mobile}</p>
                          </div>
                          <div className="flex items-center gap-2">
                              <a
                                  href={`tel:${vehiclePartnerDriver.mobile}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                              >
                                  <Phone size={12} /> Call
                              </a>
                              <a
                                  href={`https://wa.me/${normalizePhoneForWhatsApp(vehiclePartnerDriver.mobile)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                              >
                                  <MessageCircle size={12} /> WhatsApp
                              </a>
                          </div>
                      </div>
                  ) : (
                      <p className="text-xs text-slate-500">No other driver assigned to this vehicle right now.</p>
                  )}
              </div>
           </div>

           {/* Top Cards Grid (Dynamic) */}
           <div className="grid grid-cols-2 gap-4 mb-2">
               {/* Check if consolidated card (Daily Log Tab Special) */}
               {topCards.isConsolidated ? (
                   <div className="col-span-2 bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-center space-y-4">
                       <div className="flex items-start justify-between gap-4">
                           <div className="flex-1 space-y-1">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">{topCards.data.headerLabel}</p>
                               <p className="text-2xl font-extrabold text-slate-900">{formatCurrencyInt(topCards.data.headerValue || 0)}</p>
                               <p className="text-[10px] text-slate-500 font-semibold leading-tight">{topCards.data.headerSubtext || 'No data available'}</p>
                               {topCards.data.headerBadge && (
                                   <span className="inline-flex items-center mt-1 px-2 py-1 rounded-full bg-indigo-50 text-[10px] font-semibold text-indigo-700 border border-indigo-100 tracking-[0.12em]">
                                       {topCards.data.headerBadge}
                                   </span>
                               )}
                           </div>
                           {typeof topCards.data.payout === 'number' && (
                               <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 text-right shadow-inner min-w-[160px]">
                                   <p className="text-[10px] uppercase font-bold text-indigo-500 tracking-[0.16em]">Monthly Payout</p>
                                   <p className={`text-lg font-extrabold ${topCards.data.payout < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                       {formatCurrencyInt(topCards.data.payout)}
                                   </p>
                                   <p className="text-[10px] text-indigo-400 font-semibold">Cleared / Payable</p>
                               </div>
                           )}
                       </div>
                       <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                           {topCards.data.stats?.map((stat: any) => {
                               const isNetPayout = stat.label === 'Net Payout';
                               const isNetBalance = stat.label === 'Net Balance';

                               return (
                                   <div
                                       key={stat.label}
                                       onClick={(isNetPayout || isNetBalance) ? () => openCalculationPopup(isNetPayout ? 'netPayout' : 'netBalance') : undefined}
                                       className={`bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 text-center shadow-sm ${
                                           (isNetPayout || isNetBalance) ? 'cursor-pointer hover:shadow-md transition' : ''
                                       }`}
                                   >
                                       <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 tracking-[0.12em]">{stat.label}</p>
                                       <p className={`text-base font-extrabold ${stat.colorClass || 'text-slate-800'}`}>
                                           {typeof stat.value === 'number' ? formatCurrencyInt(stat.value) : stat.value}
                                       </p>
                                       {stat.subtext && (
                                           <p className="text-[9px] text-slate-400 font-semibold leading-tight">{stat.subtext}</p>
                                       )}
                                   </div>
                               );
                           })}
                       </div>
                   </div>
               ) : (
                   <>
                       {/* Left Card */}
                       <div
                           onClick={activeTab === 'home' ? () => openCalculationPopup('netPayout') : undefined}
                           className={`${topCards.left?.colorClass ?? ''} p-6 rounded-[24px] text-white relative overflow-hidden shadow-xl flex flex-col justify-center ${topCards.left?.colSpan ? `col-span-${topCards.left.colSpan}` : ''} ${activeTab === 'home' ? 'cursor-pointer transition transform hover:-translate-y-0.5' : ''}`}
                       >
                           <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 mb-1">{topCards.left.label}</p>
                           <h3 className={`text-3xl font-bold tracking-tight mb-1 ${topCards.left.isCurrency && typeof topCards.left.value === 'number' && topCards.left.value < 0 ? 'text-rose-300' : 'text-white'}`}>
                               {topCards.left.isCurrency && typeof topCards.left.value === 'number' ? formatCurrencyInt(topCards.left.value) : topCards.left.value}
                           </h3>
                           <p className="text-[10px] text-indigo-200/80 flex items-center gap-1">
                               {topCards.left?.range ? (
                                   <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10 tracking-[0.14em] uppercase text-[9px] leading-none">{topCards.left.range}</span>
                               ) : (
                                   topCards.left?.subtext
                               )}
                           </p>
                       </div>

                       {/* Right Card */}
                       <div className={`${topCards.right.colorClass} p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center ${topCards.right.colSpan ? `col-span-${topCards.right.colSpan}` : ''}`}>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{topCards.right.label}</p>
                            <h3 className="text-3xl font-bold text-slate-800 mb-1">
                               {topCards.right.isCurrency && typeof topCards.right.value === 'number' ? formatCurrencyInt(topCards.right.value) : topCards.right.value}
                            </h3>
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
            <div className="sticky top-3 z-30">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-white to-violet-50 blur-xl opacity-80 pointer-events-none"></div>
                    <div className="relative rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-100 shadow-xl shadow-indigo-100 p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
                                    <ActiveTabIcon size={18} />
                                </div>
                                <div>
                                    <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-indigo-400">Activity Views</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">Stay pinned while you browse</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400 px-2 py-1 rounded-full bg-slate-50 border border-slate-100">Fixed</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {tabOptions.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${isActive
                                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-lg shadow-indigo-200'
                                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-white hover:border-indigo-200'}`}
                                        aria-pressed={isActive}
                                    >
                                        <span className="flex items-center gap-2">
                                            <Icon size={16} className={isActive ? 'text-white' : 'text-indigo-500'} />
                                            {tab.label}
                                        </span>
                                        <ChevronRight size={16} className={isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-70 transition'} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
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
                                                          Net Balance: <span className={bal < 0 ? "text-rose-300 font-bold" : "text-emerald-300 font-bold"}>{formatCurrency(bal)}</span>
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
                          {recentLogs.map(entry => {
                              const expenseSummary = expensesByDate[entry.date] || { total: 0, labels: [] };
                              const dueLabel = getDueLabel(entry);

                              return (
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
                                       <p className="text-[10px] text-slate-500 font-semibold">{dueLabel}: {getAdjustedDue(entry) > 0 ? '+' : ''}{getAdjustedDue(entry)}</p>
                                       {expenseSummary.total > 0 && (
                                           <p className="text-[10px] text-rose-500 font-semibold">
                                             {expenseSummary.labels.length ? expenseSummary.labels.join(', ') : 'Expense'}: {formatCurrency(expenseSummary.total)}
                                           </p>
                                       )}
                                   </div>
                              </div>
                              );
                          })}
                          {recentLogs.length === 0 && <p className="text-center text-xs text-slate-400 py-4 bg-white rounded-2xl border border-slate-100 border-dashed">No recent activity found</p>}
                      </div>
                  </div>

                  {/* 3. Wallet Overview Card */}
                  <div className="bg-white p-6 rounded-[28px] border-4 border-slate-50/50 shadow-sm relative">
                      <div className="flex items-center gap-2 mb-6">
                        <Wallet size={20} className="text-emerald-500"/>
                        <h3 className="font-bold text-slate-800">Wallet Overview</h3>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8">
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
                          <div className="text-center">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Total Expenses</p>
                              <p className="text-xl font-bold text-rose-600">{formatCurrency(balanceSummary.totalExpenses)}</p>
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
                              className="text-base font-semibold border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">To</span>
                          <input
                              type="date"
                              value={toDate}
                              onChange={(e) => setToDate(e.target.value)}
                              className="text-base font-semibold border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
                          filteredDaily.map(entry => {
                                      const adjustedDue = getAdjustedDue(entry);
                                      const expenseSummary = expensesByDate[entry.date] || { total: 0, labels: [] };
                                      const showExpense = expenseSummary.total > 0;
                                      const dueLabel = getDueLabel(entry);

                              return (
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

                                      <div className={`grid ${showExpense ? 'grid-cols-6' : 'grid-cols-5'} gap-2 text-[10px] text-slate-500 bg-slate-50/50 p-2 rounded-lg`}>
                                          <div>
                                              <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Rent</span>
                                              {formatCurrency(entry.rent)}
                                          </div>
                                          <div>
                                              <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Fuel</span>
                                              {formatCurrency(entry.fuel)}
                                          </div>
                                          <div>
                                              <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">{dueLabel}</span>
                                              <div className="flex flex-col items-start gap-0.5">
                                                  <span className={adjustedDue !== 0 ? (adjustedDue > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold') : ''}>
                                                      {adjustedDue > 0 ? '+' : ''}{adjustedDue}
                                                  </span>
                                                  {entry.adjustmentApplied ? (
                                                      <span className="text-[9px] font-semibold text-amber-600 uppercase tracking-wide">
                                                          Adjustment: {entry.adjustmentApplied > 0 ? '+' : ''}{entry.adjustmentApplied}
                                                      </span>
                                                  ) : null}
                                              </div>
                                          </div>
                                          {showExpense && (
                                              <div>
                                                  <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">{expenseSummary.labels.length ? expenseSummary.labels.join(', ') : 'Expense'}</span>
                                                  <span className="text-rose-600 font-semibold">{formatCurrency(expenseSummary.total)}</span>
                                              </div>
                                          )}
                                          <div>
                                              {(() => {
                                                  const weeklyWallet = weeklyWalletByEntryId.get(entry.id);
                                                  if (!weeklyWallet) return null;
                                                  const walletAmount = calculateWalletWeek(weeklyWallet);
                                                  const walletColor = walletAmount === 0
                                                      ? ''
                                                      : walletAmount > 0
                                                          ? 'text-emerald-600 font-bold'
                                                          : 'text-rose-600 font-bold';

                                                  return (
                                                      <>
                                                          <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Wallet</span>
                                                          <span className={walletColor}>
                                                              {formatCurrency(walletAmount)}
                                                          </span>
                                                      </>
                                                  );
                                              })()}
                                          </div>
                                          <div>
                                              <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Payout</span>
                                              <div className="flex flex-col items-start gap-0.5">
                                                  <span className="text-slate-600 font-semibold">
                                                      {typeof entry.payout === 'number' ? formatCurrency(entry.payout) : '—'}
                                                  </span>
                                                  <span className="text-[9px] text-slate-400">
                                                      {entry.payoutDate ? formatDate(entry.payoutDate) : '—'}
                                                  </span>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              );
                          })
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
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Shared Expenses</span><span className="font-bold text-rose-600">- {formatCurrency(selectedBill.expenses || 0)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Wallet Earnings (Weekly)</span><span className="font-bold text-emerald-600">+ {formatCurrency(selectedBill.wallet)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Rental Collection</span><span className="font-bold text-emerald-600">+ {formatCurrency(selectedBill.collection)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600 font-medium">Previous Dues/Credit</span><span className="font-bold text-slate-800">{formatCurrency(selectedBill.overdue)}</span></div>
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
