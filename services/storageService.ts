
import { DailyEntry, WeeklyWallet, DriverSummary, GlobalSummary, Driver, LeaveRecord, AssetMaster, DriverShiftRecord, RentalSlab, CompanyWeeklySummary, HeaderMapping } from '../types';

const DAILY_KEY = 'driver_app_daily_entries';
const WEEKLY_KEY = 'driver_app_weekly_wallets';
const DRIVER_KEY = 'driver_app_drivers';
const LEAVE_KEY = 'driver_app_leaves';
const ASSET_KEY = 'driver_app_assets';
const SHIFT_KEY = 'driver_app_shifts';
// Split keys for distinct plans
const COMPANY_RENTAL_SLAB_KEY = 'driver_app_company_rental_slabs';
const DRIVER_RENTAL_SLAB_KEY = 'driver_app_driver_rental_slabs';
const COMPANY_SUMMARY_KEY = 'driver_app_company_summaries';
const HEADER_MAPPING_KEY = 'driver_app_header_mappings';

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

  // --- Rental Slabs (Company Settlement) ---
  getCompanyRentalSlabs: async (): Promise<RentalSlab[]> => {
    await delay(100);
    const data = localStorage.getItem(COMPANY_RENTAL_SLAB_KEY);
    if (data) return JSON.parse(data);
    
    // Default Slabs for Company Settlement (as requested)
    const defaults: RentalSlab[] = [
        { id: '1', minTrips: 0, maxTrips: 64, rentAmount: 950, notes: 'Base rent' },
        { id: '2', minTrips: 65, maxTrips: 79, rentAmount: 710, notes: 'Reduced rent' },
        { id: '3', minTrips: 80, maxTrips: 94, rentAmount: 600, notes: 'Incentive rent' },
        { id: '4', minTrips: 95, maxTrips: 109, rentAmount: 470, notes: 'Tier 4' },
        { id: '5', minTrips: 110, maxTrips: 124, rentAmount: 380, notes: 'Tier 5' },
        { id: '6', minTrips: 125, maxTrips: null, rentAmount: 260, notes: 'Lowest rent' }
    ];
    localStorage.setItem(COMPANY_RENTAL_SLAB_KEY, JSON.stringify(defaults));
    return defaults;
  },

  saveCompanyRentalSlabs: async (slabs: RentalSlab[]): Promise<void> => {
    await delay(100);
    localStorage.setItem(COMPANY_RENTAL_SLAB_KEY, JSON.stringify(slabs));
  },

  // --- Rental Slabs (Driver Billing) ---
  getDriverRentalSlabs: async (): Promise<RentalSlab[]> => {
    await delay(100);
    const data = localStorage.getItem(DRIVER_RENTAL_SLAB_KEY);
    if (data) return JSON.parse(data);

    // Default Slabs for Driver Billing (as requested)
    const defaults: RentalSlab[] = [
        { id: '1', minTrips: 0, maxTrips: 49, rentAmount: 957, notes: 'Base Driver Rent' },
        { id: '2', minTrips: 50, maxTrips: 54, rentAmount: 885, notes: 'Tier 1' },
        { id: '3', minTrips: 55, maxTrips: 59, rentAmount: 842, notes: 'Tier 2' },
        { id: '4', minTrips: 60, maxTrips: 64, rentAmount: 772, notes: 'Tier 3' },
        { id: '5', minTrips: 65, maxTrips: 69, rentAmount: 700, notes: 'Tier 4' },
        { id: '6', minTrips: 70, maxTrips: null, rentAmount: 550, notes: 'Top Tier' }
    ];
    localStorage.setItem(DRIVER_RENTAL_SLAB_KEY, JSON.stringify(defaults));
    return defaults;
  },

  saveDriverRentalSlabs: async (slabs: RentalSlab[]): Promise<void> => {
    await delay(100);
    localStorage.setItem(DRIVER_RENTAL_SLAB_KEY, JSON.stringify(slabs));
  },
  
  // Legacy alias for compatibility if needed
  getRentalSlabs: async (): Promise<RentalSlab[]> => {
      return storageService.getCompanyRentalSlabs();
  },
  saveRentalSlabs: async (slabs: RentalSlab[]): Promise<void> => {
      return storageService.saveCompanyRentalSlabs(slabs);
  },

  // --- Header Mappings (Company Summary) ---
  getHeaderMappings: async (): Promise<HeaderMapping[]> => {
    await delay(100);
    const data = localStorage.getItem(HEADER_MAPPING_KEY);
    if (data) return JSON.parse(data);
    
    // Default Mappings (Canonical Standard -> Default Excel Header)
    const defaults: HeaderMapping[] = [
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
    localStorage.setItem(HEADER_MAPPING_KEY, JSON.stringify(defaults));
    return defaults;
  },

  saveHeaderMappings: async (mappings: HeaderMapping[]): Promise<void> => {
    await delay(100);
    localStorage.setItem(HEADER_MAPPING_KEY, JSON.stringify(mappings));
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
      const totalPayout = driverDaily.reduce((sum, d) => sum + (d.payout || 0), 0); 
      const totalWalletWeek = driverWeekly.reduce((sum, w) => sum + (w.walletWeek || 0), 0);

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
