
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
  payout: number; // New field: Amount paid out to driver
  payoutDate?: string; // Date when payout was issued (required when payout is entered)
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
  daysWorkedOverride?: number; // New: Manual override for days worked calculation
  rentOverride?: number; // New: Manual override for rent per day
  adjustments?: number; // New: Adjustments to final payout
  notes?: string;
}

// NEW: Persisted Billing Record (Required for DriverBillingsPage)
export interface DriverBillingRecord {
  id: string;
  driverId?: string;
  driverName: string;
  qrCode: string;
  weekStartDate: string;
  weekEndDate: string;
  daysWorked: number;
  trips: number;
  rentPerDay: number;
  rentTotal: number;
  collection: number;
  due: number;
  fuel: number;
  wallet: number;
  walletOverdue: number; // From DailyEntry.due
  adjustments: number;
  payout: number;
  status: 'Pending' | 'Paid' | 'Finalized';
  generatedAt: string;
}

export interface Driver {
  id: string;
  name: string;
  mobile: string;
  email?: string; // New: Optional Email/Gmail
  joinDate: string;
  terminationDate?: string;
  isHidden?: boolean; // Hidden from records/portal when true
  deposit: number;
  qrCode: string; // Must be unique among active drivers
  vehicle: string; // Max 2 active drivers per vehicle
  status: 'Active' | 'Terminated';
  currentShift: 'Day' | 'Night'; // Default current shift
  defaultRent?: number; // Default daily rent amount
  notes?: string;
  isManager?: boolean; // New: Manager Role Flag
  foodOption?: boolean; // Food access enabled
}

export interface ManagerAccess {
  managerId: string;
  childDriverIds: string[]; // List of drivers this manager can view
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
  actualReturnDate?: string; // New field for late return logic
  days: number; // Originally planned days
  reason?: string;
}

export interface AssetMaster {
  vehicles: string[]; // List of all owned vehicles
  qrCodes: string[]; // List of all owned QR codes
}

export interface DriverSummary {
  driver: string;
  totalCollection: number;
  totalRent: number;
  totalFuel: number;
  totalDue: number;
  totalPayout: number;
  totalWalletWeek: number;
  finalTotal: number; // Represents overall net balance from start to end
  netPayout: number; // Represents the lowest payout amount (overall vs latest wallet window)
  netPayoutSource: 'overall' | 'latest-wallet';
  netPayoutRange?: string;
}

export interface GlobalSummary {
  totalCollection: number;
  totalRent: number;
  totalFuel: number;
  totalDue: number;
  totalPayout: number;
  totalWalletWeek: number;
  pendingFromDrivers: number;
  payableToDrivers: number;
}

export interface RentalSlab {
  id: string;
  minTrips: number;
  maxTrips: number | null; // null means infinity
  rentAmount: number;
  notes?: string;
  slabType?: string; // 'company' or 'driver'
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
  olaWeekOs?: number;
  vehicleLevelAdjustment: number;
  tds: number;
  challan: number;
  accident: number;
  deadMile: number;
  currentOs: number;
}

export interface CompanyWeeklySummary {
  id: string;
  startDate: string;
  endDate: string;
  fileName: string;
  importedAt: string;
  note?: string;
  rows: CompanySummaryRow[];
}

export interface HeaderMapping {
  internalKey: string;
  label: string;
  excelHeader: string;
  required: boolean;
}

export interface AdminAccess {
  email: string;
  addedBy: string;
  addedAt: string;
}

// --- Lead Management ---
export interface LeadStatus {
  id: string;
  label: string;
  color?: string;
}

export interface LeadUpdate {
  id: string;
  text: string;
  date: string;
  author?: string;
}

export interface LeadRecord {
  id: string;
  sheetId: string;
  createdTime: string;
  platform: string;
  fullName: string;
  phone: string;
  city: string;
  statusId: string;
  admin: string;
  note?: string;
  updates: LeadUpdate[];
}

export interface LeadSheet {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  createdBy?: string;
  statuses: LeadStatus[];
  leads: LeadRecord[];
}

export type UserRole = 'super_admin' | 'admin' | 'driver';

export type CashMode = 'blocked' | 'trips';

export interface AuthUser {
  email: string;
  name: string;
  role: UserRole;
  photoURL?: string;
  driverId?: string;
}


export interface DriverWidgetSummary {
  driverId: string;
  driverName: string;
  netBalance: number;
  netPayout: number;
  netPayoutSource: 'overall' | 'latest-wallet';
  netPayoutRange?: string | null;
  updatedAt: string;
}
