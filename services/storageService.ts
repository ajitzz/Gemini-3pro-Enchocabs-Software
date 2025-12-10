
import { DailyEntry, WeeklyWallet, DriverSummary, GlobalSummary, Driver, LeaveRecord, AssetMaster, DriverShiftRecord, RentalSlab, CompanyWeeklySummary, HeaderMapping, ManagerAccess, AdminAccess } from '../types';

// Use relative path for production (Vercel) compatibility. 
// Vercel rewrites /api requests to the backend serverless function.
const API_BASE = '/api'; 

const api = {
  get: async (endpoint: string) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      if (!response.ok) {
        const text = await response.text();
        let msg = `API Error ${response.status}: ${response.statusText}`;
        try {
            const json = JSON.parse(text);
            if(json.error) msg = json.error;
        } catch(e) {}
        throw new Error(msg);
      }
      return response.json();
    } catch (error: any) {
      console.error(`API GET Error (${endpoint}):`, error);
      const msg = error.message === 'Failed to fetch' || error.message.includes('Unexpected token')
        ? `Network/Server Error: Backend unreachable. Check if server is running and DB is connected.` 
        : error.message;
      throw new Error(msg);
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
        try {
            const json = JSON.parse(text);
            if(json.error) msg = json.error;
        } catch(e) {}
        throw new Error(msg);
      }
      return response.json();
    } catch (error: any) {
      console.error(`API POST Error (${endpoint}):`, error);
      const msg = error.message === 'Failed to fetch' || error.message.includes('Unexpected token')
        ? `Network/Server Error: Backend unreachable. Check if server is running and DB is connected.` 
        : error.message;
      throw new Error(msg);
    }
  },
  delete: async (endpoint: string) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
      if (!response.ok) {
        const text = await response.text();
        let msg = `API Error ${response.status}: ${response.statusText}`;
        try {
            const json = JSON.parse(text);
            if(json.error) msg = json.error;
        } catch(e) {}
        throw new Error(msg);
      }
      return response.json();
    } catch (error: any) {
      console.error(`API DELETE Error (${endpoint}):`, error);
      const msg = error.message === 'Failed to fetch' 
        ? `Network/Server Error: Backend unreachable. Check if server is running and DB is connected.` 
        : error.message;
      throw new Error(msg);
    }
  }
};

export const storageService = {
  // --- Daily Entries ---
  getDailyEntries: async (): Promise<DailyEntry[]> => {
    return api.get('/daily-entries');
  },

  saveDailyEntry: async (entry: DailyEntry): Promise<DailyEntry> => {
    return api.post('/daily-entries', entry);
  },

  saveDailyEntriesBulk: async (newEntries: DailyEntry[]): Promise<void> => {
    return api.post('/daily-entries/bulk', newEntries);
  },

  deleteDailyEntry: async (id: string): Promise<void> => {
    return api.delete(`/daily-entries/${id}`);
  },

  // --- Weekly Wallets ---
  getWeeklyWallets: async (): Promise<WeeklyWallet[]> => {
    return api.get('/weekly-wallets');
  },

  saveWeeklyWallet: async (wallet: WeeklyWallet): Promise<WeeklyWallet> => {
    return api.post('/weekly-wallets', wallet);
  },

  saveWeeklyWalletsBulk: async (newWallets: WeeklyWallet[]): Promise<void> => {
    // Backend doesn't explicitly have bulk for wallets, so looping parallel
    await Promise.all(newWallets.map(w => api.post('/weekly-wallets', w)));
  },

  deleteWeeklyWallet: async (id: string): Promise<void> => {
    return api.delete(`/weekly-wallets/${id}`);
  },

  // --- Drivers ---
  getDrivers: async (): Promise<Driver[]> => {
    return api.get('/drivers');
  },

  saveDriver: async (driver: Driver): Promise<Driver> => {
    return api.post('/drivers', driver);
  },

  // --- Manager Access ---
  getManagerAccess: async (): Promise<ManagerAccess[]> => {
    return api.get('/manager-access');
  },

  saveManagerAccess: async (access: ManagerAccess): Promise<void> => {
    return api.post('/manager-access', access);
  },

  // --- Admin Access ---
  getAuthorizedAdmins: async (): Promise<AdminAccess[]> => {
    return api.get('/admin-access');
  },

  addAuthorizedAdmin: async (admin: AdminAccess): Promise<void> => {
    return api.post('/admin-access', admin);
  },

  removeAuthorizedAdmin: async (email: string): Promise<void> => {
    return api.delete(`/admin-access/${email}`);
  },

  // --- Shifts ---
  getDriverShifts: async (): Promise<DriverShiftRecord[]> => {
    return api.get('/shifts');
  },

  saveDriverShift: async (shift: DriverShiftRecord): Promise<DriverShiftRecord> => {
    return api.post('/shifts', shift);
  },

  // --- Leaves ---
  getLeaves: async (): Promise<LeaveRecord[]> => {
    return api.get('/leaves');
  },

  saveLeave: async (leave: LeaveRecord): Promise<LeaveRecord> => {
    return api.post('/leaves', leave);
  },
  
  deleteLeave: async (id: string): Promise<void> => {
    return api.delete(`/leaves/${id}`);
  },

  // --- Assets (QR & Vehicles) ---
  getAssets: async (): Promise<AssetMaster> => {
    return api.get('/assets');
  },

  saveAssets: async (assets: AssetMaster): Promise<AssetMaster> => {
    // API expects separated structure in body, sends back success
    await api.post('/assets', assets);
    return assets;
  },

  // --- Rental Slabs ---
  getCompanyRentalSlabs: async (): Promise<RentalSlab[]> => {
    const data = await api.get('/rental-slabs/company');
    if (data.length === 0) {
        // Return defaults if DB empty to maintain behavior
        return [
            { id: '1', minTrips: 0, maxTrips: 64, rentAmount: 950, notes: 'Base rent' },
            { id: '2', minTrips: 65, maxTrips: 79, rentAmount: 710, notes: 'Reduced rent' },
            { id: '3', minTrips: 80, maxTrips: 94, rentAmount: 600, notes: 'Incentive rent' },
            { id: '4', minTrips: 95, maxTrips: 109, rentAmount: 470, notes: 'Tier 4' },
            { id: '5', minTrips: 110, maxTrips: 124, rentAmount: 380, notes: 'Tier 5' },
            { id: '6', minTrips: 125, maxTrips: null, rentAmount: 260, notes: 'Lowest rent' }
        ];
    }
    return data;
  },

  saveCompanyRentalSlabs: async (slabs: RentalSlab[]): Promise<void> => {
    return api.post('/rental-slabs/company', slabs);
  },

  getDriverRentalSlabs: async (): Promise<RentalSlab[]> => {
    const data = await api.get('/rental-slabs/driver');
    if (data.length === 0) {
        return [
            { id: '1', minTrips: 0, maxTrips: 49, rentAmount: 957, notes: 'Base Driver Rent' },
            { id: '2', minTrips: 50, maxTrips: 54, rentAmount: 885, notes: 'Tier 1' },
            { id: '3', minTrips: 55, maxTrips: 59, rentAmount: 842, notes: 'Tier 2' },
            { id: '4', minTrips: 60, maxTrips: 64, rentAmount: 772, notes: 'Tier 3' },
            { id: '5', minTrips: 65, maxTrips: 69, rentAmount: 700, notes: 'Tier 4' },
            { id: '6', minTrips: 70, maxTrips: null, rentAmount: 550, notes: 'Top Tier' }
        ];
    }
    return data;
  },

  saveDriverRentalSlabs: async (slabs: RentalSlab[]): Promise<void> => {
    return api.post('/rental-slabs/driver', slabs);
  },
  
  // Legacy aliases
  getRentalSlabs: async (): Promise<RentalSlab[]> => {
      return storageService.getCompanyRentalSlabs();
  },
  saveRentalSlabs: async (slabs: RentalSlab[]): Promise<void> => {
      return storageService.saveCompanyRentalSlabs(slabs);
  },

  // --- Header Mappings ---
  getHeaderMappings: async (): Promise<HeaderMapping[]> => {
    const data = await api.get('/header-mappings');
    if (data.length === 0) {
        // Return defaults if empty
        return [
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
    }
    return data;
  },

  saveHeaderMappings: async (mappings: HeaderMapping[]): Promise<void> => {
    return api.post('/header-mappings', mappings);
  },

  // --- Company Summaries ---
  getCompanySummaries: async (): Promise<CompanyWeeklySummary[]> => {
    return api.get('/company-summaries');
  },

  saveCompanySummary: async (summary: CompanyWeeklySummary): Promise<CompanyWeeklySummary> => {
    return api.post('/company-summaries', summary);
  },

  deleteCompanySummary: async (id: string): Promise<void> => {
    return api.delete(`/company-summaries/${id}`);
  },

  // --- Aggregation (Frontend Logic Preserved) ---
  getSummary: async (): Promise<{ driverSummaries: DriverSummary[], global: GlobalSummary }> => {
    // Fetch raw data from API
    const dailyEntries = await storageService.getDailyEntries();
    const weeklyWallets = await storageService.getWeeklyWallets();
    
    // Aggregation Logic stays on frontend to ensure 100% calculation fidelity during migration
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
