
import { DailyEntry, WeeklyWallet, DriverSummary, GlobalSummary, Driver, LeaveRecord, AssetMaster, DriverShiftRecord, RentalSlab, CompanyWeeklySummary, HeaderMapping, ManagerAccess, AdminAccess, DriverBillingRecord, CashMode } from '../types';

// logic: Use local proxy in dev (npm run dev), use Render URL in production (Vercel)
const isLocal = ((import.meta as any).env && (import.meta as any).env.DEV) || 
                (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

const getApiBase = () => {
    if (isLocal) return '/api';
    const env = (import.meta as any).env;
    if (env && env.VITE_API_URL) {
        return env.VITE_API_URL.replace(/\/$/, '');
    }
    return 'https://enchocabs-software-orginal-gemini3pro-1.onrender.com/api';
};

const API_BASE = getApiBase();

const api = {
  get: async (endpoint: string) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      if (!response.ok) {
        const text = await response.text();
        let msg = `API Error ${response.status}: ${response.statusText}`;
        try { const json = JSON.parse(text); if(json.error) msg = json.error; } catch(e) {}
        throw new Error(msg);
      }
      return response.json();
    } catch (error: any) {
      console.error(`API GET Error (${endpoint}):`, error);
      throw new Error(error.message);
    }
  },
  post: async (endpoint: string, data: any) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const text = await response.text();
        let msg = `API Error ${response.status}: ${response.statusText}`;
        try { const json = JSON.parse(text); if(json.error) msg = json.error; } catch(e) {}
        throw new Error(msg);
      }
      return response.json();
    } catch (error: any) {
      console.error(`API POST Error (${endpoint}):`, error);
      throw new Error(error.message);
    }
  },
  delete: async (endpoint: string) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`API Error ${response.status}`);
      return response.json();
    } catch (error: any) {
      console.error(`API DELETE Error (${endpoint}):`, error);
      throw new Error(error.message);
    }
  }
};

// --- CENTRALIZED CALCULATION HELPER ---
const formatWeekRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const startFmt = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const endFmt = end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const yearSuffix = start.getFullYear() !== end.getFullYear()
        ? ` '${String(end.getFullYear()).slice(-2)}`
        : '';

    return `${startFmt} - ${endFmt}${yearSuffix}`;
};

// Ensure wallet calculations consistently include charges
const calculateWalletWeek = (wallet: WeeklyWallet) => {
    const earnings = Number(wallet.earnings) || 0;
    const refund = Number(wallet.refund) || 0;
    const diff = Number(wallet.diff) || 0;
    const cash = Number(wallet.cash) || 0;
    const charges = Number(wallet.charges) || 0;

    return earnings + refund - (diff + cash + charges);
};

const calculateDriverStats = (
    driverName: string,
    allDaily: DailyEntry[],
    allWallets: WeeklyWallet[],
    sortedSlabs: RentalSlab[]
): DriverSummary => {
    const driverWallets = allWallets.filter(w => w.driver === driverName);
    const driverDaily = allDaily.filter(d => d.driver === driverName);

    let totalCollection = 0;
    let totalRent = 0;
    let totalFuel = 0;
    let totalDue = 0;
    let totalPayout = 0;
    let totalWalletWeek = 0;

    const processedDailyIds = new Set<string>();
    let latestWeekRange: string | undefined;

    // Track balances only up to the latest wallet cutoff (ignoring newer daily entries)
    let cutoffCollection = 0;
    let cutoffRent = 0;
    let cutoffFuel = 0;
    let cutoffDue = 0;
    let cutoffPayout = 0;
    let cutoffWalletWeek = 0;

    const sortedWallets = [...driverWallets].sort((a, b) => b.weekEndDate.localeCompare(a.weekEndDate));
    const latestWallet = sortedWallets[0];
    const latestWalletEndDate = latestWallet?.weekEndDate;
    const latestWalletId = sortedWallets[0]?.id;

    // 1. Process Billing History (Weekly Wallets) - STRICT PRIORITY
    sortedWallets.forEach(wallet => {
        const startDate = wallet.weekStartDate;
        const endDate = wallet.weekEndDate;

        const weekDaily = driverDaily.filter(d => {
            if (processedDailyIds.has(d.id)) return false;
            const date = d.date;
            return date >= startDate && date <= endDate;
        });

        weekDaily.forEach(d => processedDailyIds.add(d.id));

        // Rent Calculation: Prioritize Wallet Override
        const trips = wallet.trips;
        const slab = sortedSlabs.find(s => trips >= s.minTrips && (s.maxTrips === null || trips <= s.maxTrips));

        let rentRateUsed = 0;
        if (wallet.rentOverride !== undefined && wallet.rentOverride !== null) {
            rentRateUsed = wallet.rentOverride;
        } else if (weekDaily.length > 0) {
            rentRateUsed = weekDaily.reduce((sum, d) => sum + d.rent, 0) / weekDaily.length;
        } else {
            rentRateUsed = slab ? slab.rentAmount : 0;
        }

        const daysWorked = (wallet.daysWorkedOverride !== undefined && wallet.daysWorkedOverride !== null)
            ? wallet.daysWorkedOverride
            : weekDaily.length;

        const weeklyRentTotal = rentRateUsed * daysWorked;

        // Sum Daily Values
        const weeklyCollection = weekDaily.reduce((sum, d) => sum + d.collection, 0);
        const weeklyFuel = weekDaily.reduce((sum, d) => sum + d.fuel, 0);
        const weeklyDue = weekDaily.reduce((sum, d) => sum + d.due, 0);
        const weeklyPayout = weekDaily.reduce((sum, d) => sum + (d.payout || 0), 0);
        const weeklyWalletTotal = calculateWalletWeek(wallet) + (wallet.adjustments || 0);

        // Accumulate
        totalCollection += weeklyCollection;
        totalRent += weeklyRentTotal;
        totalFuel += weeklyFuel;
        totalDue += weeklyDue;
        totalPayout += weeklyPayout;
        totalWalletWeek += weeklyWalletTotal;

        if (wallet.id === latestWalletId) {
            latestWeekRange = formatWeekRange(startDate, endDate);
        }

        if (latestWalletEndDate && wallet.weekEndDate <= latestWalletEndDate) {
            cutoffCollection += weeklyCollection;
            cutoffRent += weeklyRentTotal;
            cutoffFuel += weeklyFuel;
            cutoffDue += weeklyDue;
            cutoffPayout += weeklyPayout;
            cutoffWalletWeek += weeklyWalletTotal;
        }
    });

    // 2. Process Remaining Daily Entries (No Bill Generated Yet)
    driverDaily.forEach(d => {
        if (!processedDailyIds.has(d.id)) {
            totalCollection += d.collection;
            totalRent += d.rent;
            totalFuel += d.fuel;
            totalDue += d.due;
            totalPayout += (d.payout || 0);

            if (latestWalletEndDate && d.date <= latestWalletEndDate) {
                cutoffCollection += d.collection;
                cutoffRent += d.rent;
                cutoffFuel += d.fuel;
                cutoffDue += d.due;
                cutoffPayout += (d.payout || 0);
            }
        }
    });

    const finalTotal = totalCollection - totalRent - totalFuel + totalDue + totalWalletWeek - totalPayout;

    const cutoffTotal = latestWalletEndDate
        ? (cutoffCollection - cutoffRent - cutoffFuel + cutoffDue + cutoffWalletWeek - cutoffPayout)
        : finalTotal;

    let netPayout = finalTotal;
    let netPayoutSource: 'overall' | 'latest-wallet' = 'overall';
    let netPayoutRange: string | undefined;

    if (latestWalletEndDate) {
        // Compare overall balance vs balance up to the latest wallet window; pick the lowest value
        const candidate = Math.min(cutoffTotal, finalTotal);
        netPayout = candidate;

        if (candidate === cutoffTotal) {
            netPayoutSource = 'latest-wallet';
            netPayoutRange = latestWeekRange ?? (latestWallet ? formatWeekRange(latestWallet.weekStartDate, latestWallet.weekEndDate) : undefined);
        }
    }

    return {
        driver: driverName,
        totalCollection,
        totalRent,
        totalFuel,
        totalDue,
        totalPayout,
        totalWalletWeek,
        finalTotal,
        netPayout,
        netPayoutSource,
        netPayoutRange
    };
};

export const storageService = {
  // --- Daily Entries ---
  getDailyEntries: async (): Promise<DailyEntry[]> => api.get('/daily-entries'),
  saveDailyEntry: async (entry: DailyEntry): Promise<DailyEntry> => api.post('/daily-entries', entry),
  saveDailyEntriesBulk: async (newEntries: DailyEntry[]): Promise<void> => api.post('/daily-entries/bulk', newEntries),
  deleteDailyEntry: async (id: string): Promise<void> => api.delete(`/daily-entries/${id}`),

  // --- Weekly Wallets ---
  getWeeklyWallets: async (): Promise<WeeklyWallet[]> => api.get('/weekly-wallets'),
  saveWeeklyWallet: async (wallet: WeeklyWallet): Promise<WeeklyWallet> => api.post('/weekly-wallets', wallet),
  saveWeeklyWalletsBulk: async (newWallets: WeeklyWallet[]): Promise<void> => Promise.all(newWallets.map(w => api.post('/weekly-wallets', w))).then(() => {}),
  deleteWeeklyWallet: async (id: string): Promise<void> => api.delete(`/weekly-wallets/${id}`),

  // --- Driver Billings (NEW) ---
  getDriverBillings: async (): Promise<DriverBillingRecord[]> => api.get('/driver-billings'),
  saveDriverBilling: async (billing: DriverBillingRecord): Promise<DriverBillingRecord> => api.post('/driver-billings', billing),
  deleteDriverBilling: async (id: string): Promise<void> => api.delete(`/driver-billings/${id}`),

  // --- Drivers ---
  getDrivers: async (): Promise<Driver[]> => api.get('/drivers'),
  saveDriver: async (driver: Driver): Promise<Driver> => api.post('/drivers', driver),
  deleteDriver: async (id: string): Promise<void> => api.delete(`/drivers/${id}`),

  // --- Access ---
  getManagerAccess: async (): Promise<ManagerAccess[]> => api.get('/manager-access'),
  saveManagerAccess: async (access: ManagerAccess): Promise<void> => api.post('/manager-access', access),
  getAuthorizedAdmins: async (): Promise<AdminAccess[]> => api.get('/admin-access'),
  addAuthorizedAdmin: async (admin: AdminAccess): Promise<void> => api.post('/admin-access', admin),
  removeAuthorizedAdmin: async (email: string): Promise<void> => api.delete(`/admin-access/${email}`),

  // --- System Flags ---
  getCashMode: async (): Promise<CashMode> => {
    try {
      const res = await api.get('/system-flags/cash-mode');
      return res.value === 'blocked' ? 'blocked' : 'trips';
    } catch (error) {
      console.error('Failed to load cash mode flag:', error);
      return 'trips';
    }
  },
  setCashMode: async (mode: CashMode): Promise<void> => {
    await api.post('/system-flags/cash-mode', { value: mode });
  },

  getDriverCashMode: async (driverId: string): Promise<CashMode> => {
    try {
      const res = await api.get(`/system-flags/cash-mode-${driverId}`);
      return res.value === 'blocked' ? 'blocked' : 'trips';
    } catch (error) {
      console.error(`Failed to load cash mode for driver ${driverId}:`, error);
      return 'trips';
    }
  },
  setDriverCashMode: async (driverId: string, mode: CashMode): Promise<void> => {
    await api.post(`/system-flags/cash-mode-${driverId}`, { value: mode });
  },

  // --- Shifts & Leaves ---
  getDriverShifts: async (): Promise<DriverShiftRecord[]> => api.get('/shifts'),
  saveDriverShift: async (shift: DriverShiftRecord): Promise<DriverShiftRecord> => api.post('/shifts', shift),
  getLeaves: async (): Promise<LeaveRecord[]> => api.get('/leaves'),
  saveLeave: async (leave: LeaveRecord): Promise<LeaveRecord> => api.post('/leaves', leave),
  deleteLeave: async (id: string): Promise<void> => api.delete(`/leaves/${id}`),

  // --- Assets ---
  getAssets: async (): Promise<AssetMaster> => api.get('/assets'),
  saveAssets: async (assets: AssetMaster): Promise<AssetMaster> => { await api.post('/assets', assets); return assets; },

  // --- Rental Slabs ---
  getCompanyRentalSlabs: async (): Promise<RentalSlab[]> => {
    const data = await api.get('/rental-slabs/company');
    return data.length ? data : [
        { id: '1', minTrips: 0, maxTrips: 64, rentAmount: 950, notes: 'Base rent' },
        { id: '2', minTrips: 65, maxTrips: 79, rentAmount: 710, notes: 'Reduced rent' },
        { id: '3', minTrips: 80, maxTrips: 94, rentAmount: 600, notes: 'Incentive rent' },
        { id: '4', minTrips: 95, maxTrips: 109, rentAmount: 470, notes: 'Tier 4' },
        { id: '5', minTrips: 110, maxTrips: 124, rentAmount: 380, notes: 'Tier 5' },
        { id: '6', minTrips: 125, maxTrips: null, rentAmount: 260, notes: 'Lowest rent' }
    ];
  },
  saveCompanyRentalSlabs: async (slabs: RentalSlab[]): Promise<void> => api.post('/rental-slabs/company', slabs),
  getDriverRentalSlabs: async (): Promise<RentalSlab[]> => {
    const data = await api.get('/rental-slabs/driver');
    return data.length ? data : [
        { id: '1', minTrips: 0, maxTrips: 49, rentAmount: 957, notes: 'Base Driver Rent' },
        { id: '2', minTrips: 50, maxTrips: 54, rentAmount: 885, notes: 'Tier 1' },
        { id: '3', minTrips: 55, maxTrips: 59, rentAmount: 842, notes: 'Tier 2' },
        { id: '4', minTrips: 60, maxTrips: 64, rentAmount: 772, notes: 'Tier 3' },
        { id: '5', minTrips: 65, maxTrips: 69, rentAmount: 700, notes: 'Tier 4' },
        { id: '6', minTrips: 70, maxTrips: null, rentAmount: 550, notes: 'Top Tier' }
    ];
  },
  saveDriverRentalSlabs: async (slabs: RentalSlab[]): Promise<void> => api.post('/rental-slabs/driver', slabs),
  
  // Legacy aliases
  getRentalSlabs: async (): Promise<RentalSlab[]> => storageService.getCompanyRentalSlabs(),
  saveRentalSlabs: async (slabs: RentalSlab[]): Promise<void> => storageService.saveCompanyRentalSlabs(slabs),

  // --- Header Mappings ---
  getHeaderMappings: async (): Promise<HeaderMapping[]> => {
    const data = await api.get('/header-mappings');
    return data.length ? data : [
      { internalKey: 'vehicleNumber', label: 'Vehicle Number', excelHeader: 'Vehicle Number', required: true },
      { internalKey: 'onroadDays', label: 'Onroad Days', excelHeader: 'Onroad Days', required: true },
      { internalKey: 'dailyRentApplied', label: 'Daily Rent Applied', excelHeader: 'Daily Rent Applied', required: true },
      { internalKey: 'weeklyIndemnityFees', label: 'Weekly Indemnity Fees', excelHeader: 'Weekly Indemnity Fees', required: true },
      { internalKey: 'netWeeklyLeaseRental', label: 'Net Weekly Lease Rental', excelHeader: 'Net Weekly Lease Rental', required: true },
      { internalKey: 'performanceDay', label: 'Performance Day', excelHeader: 'Performance Day', required: false },
      { internalKey: 'uberTrips', label: 'Uber Trips', excelHeader: 'Uber Trips', required: true },
      { internalKey: 'totalEarning', label: 'Total Earning', excelHeader: 'Total Earning', required: true },
      { internalKey: 'uberCashCollection', label: 'Uber Cash Collection', excelHeader: 'Uber Cash Collection', required: true },
      { internalKey: 'toll', label: 'Toll', excelHeader: 'Toll', required: true },
      { internalKey: 'driverSubscriptionCharge', label: 'Driver Subscription Charge', excelHeader: 'Driver subscription charge', required: true },
      { internalKey: 'uberIncentive', label: 'Uber Incentive', excelHeader: 'Uber Incentive', required: true },
      { internalKey: 'uberWeekOs', label: 'Uber Week O/s', excelHeader: 'Uber Week O/s', required: true },
      { internalKey: 'olaWeekOs', label: 'OLA Week O/s', excelHeader: 'OLA Week O/s', required: false },
      { internalKey: 'vehicleLevelAdjustment', label: 'Vehicle Level Adjustment', excelHeader: 'Vehicle Level Adjustment', required: true },
      { internalKey: 'tds', label: 'TDS', excelHeader: 'TDS', required: true },
      { internalKey: 'challan', label: 'Challan', excelHeader: 'Challan', required: true },
      { internalKey: 'accident', label: 'Accident', excelHeader: 'Accident', required: true },
      { internalKey: 'deadMile', label: 'DeadMile', excelHeader: 'DeadMile', required: true },
      { internalKey: 'currentOs', label: 'Current O/S', excelHeader: 'Current O/S', required: true },
    ];
  },
  saveHeaderMappings: async (mappings: HeaderMapping[]): Promise<void> => api.post('/header-mappings', mappings),

  // --- Company Summaries ---
  getCompanySummaries: async (): Promise<CompanyWeeklySummary[]> => api.get('/company-summaries'),
  saveCompanySummary: async (summary: CompanyWeeklySummary): Promise<CompanyWeeklySummary> => api.post('/company-summaries', summary),
  deleteCompanySummary: async (id: string): Promise<void> => api.delete(`/company-summaries/${id}`),

  // --- Aggregation ---
  // Exposed for specific driver calculation (reused by Portal)
  calculateDriverStats,

  getSummary: async (): Promise<{ driverSummaries: DriverSummary[], global: GlobalSummary }> => {
    try {
      // Prefer server-side aggregation to avoid transferring heavy datasets to the browser
      return await api.get('/summary');
    } catch (err) {
      console.warn('Falling back to client-side summary calculation:', err);
    }

    // Fallback path: compute on the client if the optimized endpoint is unavailable
    const [dailyEntries, weeklyWallets, rentalSlabs] = await Promise.all([
      storageService.getDailyEntries(),
      storageService.getWeeklyWallets(),
      storageService.getDriverRentalSlabs()
    ]);
    const sortedSlabs = rentalSlabs.sort((a, b) => a.minTrips - b.minTrips);

    const drivers = Array.from(new Set([
      ...dailyEntries.map(d => d.driver),
      ...weeklyWallets.map(w => w.driver)
    ])).sort();

    const driverSummaries: DriverSummary[] = drivers.map(driver =>
      calculateDriverStats(driver, dailyEntries, weeklyWallets, sortedSlabs)
    );

    const global: GlobalSummary = {
      totalCollection: driverSummaries.reduce((sum, d) => sum + d.totalCollection, 0),
      totalRent: driverSummaries.reduce((sum, d) => sum + d.totalRent, 0),
      totalFuel: driverSummaries.reduce((sum, d) => sum + d.totalFuel, 0),
      totalDue: driverSummaries.reduce((sum, d) => sum + d.totalDue, 0),
      totalPayout: driverSummaries.reduce((sum, d) => sum + d.totalPayout, 0),
      totalWalletWeek: driverSummaries.reduce((sum, d) => sum + d.totalWalletWeek, 0),
      pendingFromDrivers: driverSummaries.filter(d => d.finalTotal < 0).reduce((sum, d) => sum + Math.abs(d.finalTotal), 0),
      payableToDrivers: driverSummaries.filter(d => d.finalTotal > 0).reduce((sum, d) => sum + d.finalTotal, 0),
    };

    return { driverSummaries, global };
  }
};

