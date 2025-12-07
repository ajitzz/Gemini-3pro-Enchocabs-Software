import { DailyEntry, WeeklyWallet, DriverSummary, GlobalSummary, Driver, LeaveRecord, AssetMaster, DriverShiftRecord, RentalSlab, CompanyWeeklySummary } from '../types';

const DAILY_KEY = 'driver_app_daily_entries';
const WEEKLY_KEY = 'driver_app_weekly_wallets';
const DRIVER_KEY = 'driver_app_drivers';
const LEAVE_KEY = 'driver_app_leaves';
const ASSET_KEY = 'driver_app_assets';
const SHIFT_KEY = 'driver_app_shifts';
const RENTAL_SLAB_KEY = 'driver_app_rental_slabs';
const COMPANY_SUMMARY_KEY = 'driver_app_company_summaries';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const storageService = {
  // --- Daily Entries ---
  getDailyEntries: async (): Promise<DailyEntry[]> => {
    await delay(100);
    const data = localStorage.getItem(DAILY_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveDailyEntry: async (entry: DailyEntry): Promise<DailyEntry> => {
    await delay(100);
    const entries = await storageService.getDailyEntries();
    const existingIndex = entries.findIndex(e => e.id === entry.id);
    let newEntries;
    if (existingIndex >= 0) {
      newEntries = [...entries];
      newEntries[existingIndex] = entry;
    } else {
      newEntries = [entry, ...entries];
    }
    localStorage.setItem(DAILY_KEY, JSON.stringify(newEntries));
    return entry;
  },

  saveDailyEntriesBulk: async (newEntries: DailyEntry[]): Promise<void> => {
    await delay(200);
    const currentEntries = await storageService.getDailyEntries();
    const updatedEntries = [...newEntries, ...currentEntries];
    localStorage.setItem(DAILY_KEY, JSON.stringify(updatedEntries));
  },

  deleteDailyEntry: async (id: string): Promise<void> => {
    await delay(100);
    const entries = await storageService.getDailyEntries();
    const newEntries = entries.filter(e => e.id !== id);
    localStorage.setItem(DAILY_KEY, JSON.stringify(newEntries));
  },

  // --- Weekly Wallets ---
  getWeeklyWallets: async (): Promise<WeeklyWallet[]> => {
    await delay(100);
    const data = localStorage.getItem(WEEKLY_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveWeeklyWallet: async (wallet: WeeklyWallet): Promise<WeeklyWallet> => {
    await delay(100);
    const wallets = await storageService.getWeeklyWallets();
    const existingIndex = wallets.findIndex(w => w.id === wallet.id);
    let newWallets;
    if (existingIndex >= 0) {
      newWallets = [...wallets];
      newWallets[existingIndex] = wallet;
    } else {
      newWallets = [wallet, ...wallets];
    }
    localStorage.setItem(WEEKLY_KEY, JSON.stringify(newWallets));
    return wallet;
  },

  saveWeeklyWalletsBulk: async (newWallets: WeeklyWallet[]): Promise<void> => {
    await delay(200);
    const currentWallets = await storageService.getWeeklyWallets();
    const updatedWallets = [...newWallets, ...currentWallets];
    localStorage.setItem(WEEKLY_KEY, JSON.stringify(updatedWallets));
  },

  deleteWeeklyWallet: async (id: string): Promise<void> => {
    await delay(100);
    const wallets = await storageService.getWeeklyWallets();
    const newWallets = wallets.filter(w => w.id !== id);
    localStorage.setItem(WEEKLY_KEY, JSON.stringify(newWallets));
  },

  // --- Drivers ---
  getDrivers: async (): Promise<Driver[]> => {
    await delay(100);
    const data = localStorage.getItem(DRIVER_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveDriver: async (driver: Driver): Promise<Driver> => {
    await delay(100);
    const drivers = await storageService.getDrivers();
    const existingIndex = drivers.findIndex(d => d.id === driver.id);
    let newDrivers;
    if (existingIndex >= 0) {
      newDrivers = [...drivers];
      newDrivers[existingIndex] = driver;
    } else {
      newDrivers = [driver, ...drivers];
    }
    localStorage.setItem(DRIVER_KEY, JSON.stringify(newDrivers));
    return driver;
  },

  // --- Shifts ---
  getDriverShifts: async (): Promise<DriverShiftRecord[]> => {
    await delay(100);
    const data = localStorage.getItem(SHIFT_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveDriverShift: async (shift: DriverShiftRecord): Promise<DriverShiftRecord> => {
    await delay(50);
    const shifts = await storageService.getDriverShifts();
    const existingIndex = shifts.findIndex(s => s.id === shift.id);
    let newShifts;
    if (existingIndex >= 0) {
      newShifts = [...shifts];
      newShifts[existingIndex] = shift;
    } else {
      newShifts = [shift, ...shifts];
    }
    localStorage.setItem(SHIFT_KEY, JSON.stringify(newShifts));
    return shift;
  },

  // --- Leaves ---
  getLeaves: async (): Promise<LeaveRecord[]> => {
    await delay(100);
    const data = localStorage.getItem(LEAVE_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveLeave: async (leave: LeaveRecord): Promise<LeaveRecord> => {
    await delay(100);
    const leaves = await storageService.getLeaves();
    const newLeaves = [leave, ...leaves];
    localStorage.setItem(LEAVE_KEY, JSON.stringify(newLeaves));
    return leave;
  },
  
  deleteLeave: async (id: string): Promise<void> => {
    await delay(100);
    const leaves = await storageService.getLeaves();
    const newLeaves = leaves.filter(l => l.id !== id);
    localStorage.setItem(LEAVE_KEY, JSON.stringify(newLeaves));
  },

  // --- Assets (QR & Vehicles) ---
  getAssets: async (): Promise<AssetMaster> => {
    await delay(100);
    const data = localStorage.getItem(ASSET_KEY);
    return data ? JSON.parse(data) : { vehicles: [], qrCodes: [] };
  },

  saveAssets: async (assets: AssetMaster): Promise<AssetMaster> => {
    await delay(100);
    localStorage.setItem(ASSET_KEY, JSON.stringify(assets));
    return assets;
  },

  // --- Rental Slabs ---
  getRentalSlabs: async (): Promise<RentalSlab[]> => {
    await delay(100);
    const data = localStorage.getItem(RENTAL_SLAB_KEY);
    if (data) return JSON.parse(data);
    
    // Default Slabs - Updated to user request
    const defaults: RentalSlab[] = [
        { id: '1', minTrips: 0, maxTrips: 64, rentAmount: 950, notes: 'Base rent' },
        { id: '2', minTrips: 65, maxTrips: 79, rentAmount: 885, notes: 'Reduced rent' },
        { id: '3', minTrips: 80, maxTrips: 94, rentAmount: 842, notes: 'Incentive rent' },
        { id: '4', minTrips: 95, maxTrips: 109, rentAmount: 772, notes: 'Performance tier 1' },
        { id: '5', minTrips: 110, maxTrips: 124, rentAmount: 700, notes: 'Performance tier 2' },
        { id: '6', minTrips: 125, maxTrips: null, rentAmount: 550, notes: 'Top performer rate' }
    ];
    localStorage.setItem(RENTAL_SLAB_KEY, JSON.stringify(defaults));
    return defaults;
  },

  saveRentalSlabs: async (slabs: RentalSlab[]): Promise<void> => {
    await delay(100);
    localStorage.setItem(RENTAL_SLAB_KEY, JSON.stringify(slabs));
  },

  // --- Company Summaries (Weekly) ---
  getCompanySummaries: async (): Promise<CompanyWeeklySummary[]> => {
    await delay(100);
    const data = localStorage.getItem(COMPANY_SUMMARY_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveCompanySummary: async (summary: CompanyWeeklySummary): Promise<CompanyWeeklySummary> => {
    await delay(200);
    const summaries = await storageService.getCompanySummaries();
    // If we are overriding, we filter out the old one by date range
    const filtered = summaries.filter(s => s.startDate !== summary.startDate);
    const updated = [summary, ...filtered];
    localStorage.setItem(COMPANY_SUMMARY_KEY, JSON.stringify(updated));
    return summary;
  },

  // --- Aggregation ---
  getSummary: async (): Promise<{ driverSummaries: DriverSummary[], global: GlobalSummary }> => {
    const dailyEntries = await storageService.getDailyEntries();
    const weeklyWallets = await storageService.getWeeklyWallets();
    
    const drivers = Array.from(new Set([
      ...dailyEntries.map(d => d.driver),
      ...weeklyWallets.map(w => w.driver)
    ])).sort();

    const driverSummaries: DriverSummary[] = drivers.map(driver => {
      const driverDaily = dailyEntries.filter(d => d.driver === driver);
      const driverWeekly = weeklyWallets.filter(w => w.driver === driver);

      const totalCollection = driverDaily.reduce((sum, d) => sum + (d.collection || 0), 0);
      const totalRent = driverDaily.reduce((sum, d) => sum + (d.rent || 0), 0);
      const totalFuel = driverDaily.reduce((sum, d) => sum + (d.fuel || 0), 0);
      const totalDue = driverDaily.reduce((sum, d) => sum + (d.due || 0), 0);
      const totalPayout = driverDaily.reduce((sum, d) => sum + (d.payout || 0), 0); // New Field Sum
      const totalWalletWeek = driverWeekly.reduce((sum, w) => sum + (w.walletWeek || 0), 0);

      // Formula: Total = Collection - Rent - Fuel + Due + WalletWeek - Payout
      const finalTotal = totalCollection - totalRent - totalFuel + totalDue + totalWalletWeek - totalPayout;

      return {
        driver,
        totalCollection,
        totalRent,
        totalFuel,
        totalDue,
        totalPayout,
        totalWalletWeek,
        finalTotal
      };
    });

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