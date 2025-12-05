
import { DailyEntry, WeeklyWallet, DriverSummary, GlobalSummary, Driver, LeaveRecord, AssetMaster, DriverShiftRecord } from '../types';

const DAILY_KEY = 'driver_app_daily_entries';
const WEEKLY_KEY = 'driver_app_weekly_wallets';
const DRIVER_KEY = 'driver_app_drivers';
const LEAVE_KEY = 'driver_app_leaves';
const ASSET_KEY = 'driver_app_assets';
const SHIFT_KEY = 'driver_app_shifts';

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
    // In a real DB we might upsert, here we append. 
    // The validation logic in ImportPage ensures no duplicates before calling this.
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

  // --- Aggregation ---
  getSummary: async (): Promise<{ driverSummaries: DriverSummary[], global: GlobalSummary }> => {
    const dailyEntries = await storageService.getDailyEntries();
    const weeklyWallets = await storageService.getWeeklyWallets();
    
    // Get unique drivers from entries (including old drivers who might not be in Driver table)
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
      const totalWalletWeek = driverWeekly.reduce((sum, w) => sum + (w.walletWeek || 0), 0);

      const finalTotal = totalCollection - totalRent - totalFuel + totalDue + totalWalletWeek;

      return {
        driver,
        totalCollection,
        totalRent,
        totalFuel,
        totalDue,
        totalWalletWeek,
        finalTotal
      };
    });

    const global: GlobalSummary = {
      totalCollection: driverSummaries.reduce((sum, d) => sum + d.totalCollection, 0),
      totalRent: driverSummaries.reduce((sum, d) => sum + d.totalRent, 0),
      totalFuel: driverSummaries.reduce((sum, d) => sum + d.totalFuel, 0),
      totalDue: driverSummaries.reduce((sum, d) => sum + d.totalDue, 0),
      totalWalletWeek: driverSummaries.reduce((sum, d) => sum + d.totalWalletWeek, 0),
      pendingFromDrivers: driverSummaries.filter(d => d.finalTotal < 0).reduce((sum, d) => sum + Math.abs(d.finalTotal), 0),
      payableToDrivers: driverSummaries.filter(d => d.finalTotal > 0).reduce((sum, d) => sum + d.finalTotal, 0),
    };

    return { driverSummaries, global };
  }
};