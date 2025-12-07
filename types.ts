export interface DailyEntry {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  day: string;
  vehicle: string;
  driver: string;
  shift: string;
  qrCode?: string;
  rent: number;
  collection: number;
  fuel: number;
  due: number; // positive = driver owes me, negative = I owe driver
  notes?: string;
}

export interface WeeklyWallet {
  id: string;
  driver: string;
  weekStartDate: string; // ISO string YYYY-MM-DD (Monday)
  weekEndDate: string;   // ISO string YYYY-MM-DD (Sunday)
  earnings: number;
  refund: number;
  diff: number;
  cash: number;
  charges: number;
  trips: number;
  walletWeek: number; // calculated: earnings + refund - (diff + cash + charges)
  notes?: string;
}

export interface Driver {
  id: string;
  name: string;
  mobile: string;
  joinDate: string;
  terminationDate?: string;
  deposit: number;
  qrCode: string; // Must be unique among active drivers
  vehicle: string; // Max 2 active drivers per vehicle
  status: 'Active' | 'Terminated';
  currentShift: 'Day' | 'Night'; // Default current shift
  defaultRent?: number; // Default daily rent amount
  notes?: string;
}

export interface DriverShiftRecord {
  id: string;
  driverId: string;
  shift: 'Day' | 'Night';
  startDate: string;
  endDate?: string; // If undefined, it is the current active shift
}

export interface LeaveRecord {
  id: string;
  driverId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
}

export interface AssetMaster {
  vehicles: string[]; // List of all owned vehicles
  qrCodes: string[];  // List of all owned QR codes
}

export interface DriverSummary {
  driver: string;
  totalCollection: number;
  totalRent: number;
  totalFuel: number;
  totalDue: number;
  totalWalletWeek: number;
  finalTotal: number;
}

export interface GlobalSummary {
  totalCollection: number;
  totalRent: number;
  totalFuel: number;
  totalDue: number;
  totalWalletWeek: number;
  pendingFromDrivers: number;
  payableToDrivers: number;
}

export interface RentalSlab {
  id: string;
  minTrips: number;
  maxTrips: number | null; // null means infinity (e.g. 125+)
  rentAmount: number;
  notes: string;
}

export interface CompanyWeeklySummary {
  id: string;
  startDate: string; // ISO string
  endDate: string;   // ISO string
  fileName: string;
  importedAt: string;
  note: string;
  rows: CompanySummaryRow[];
}

export interface CompanySummaryRow {
  vehicleNumber: string;
  onroadDays: number;
  dailyRentApplied: number;
  weeklyIndemnityFees: number;
  netWeeklyLeaseRental: number;
  performanceDay: number;
  uberTrips: number;
  totalEarning: number;
  uberCashCollection: number;
  toll: number;
  driverSubscriptionCharge: number;
  uberIncentive: number;
  uberWeekOs: number;
  olaWeekOs: number; // Added for formula correctness
  vehicleLevelAdjustment: number;
  tds: number;
  challan: number;
  accident: number;
  deadMile: number;
  currentOs: number;
}

// --- Import Types ---
export interface ImportError {
  row: number;
  column?: string;
  message: string;
  type: 'driver_mismatch' | 'vehicle_mismatch' | 'qr_mismatch' | 'duplicate' | 'format';
}

export interface ImportValidationResult<T> {
  validData: T[];
  errors: ImportError[];
}