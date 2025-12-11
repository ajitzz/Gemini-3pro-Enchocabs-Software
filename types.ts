
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
  notes?: string;
}

export interface Driver {
  id: string;
  name: string;
  mobile: string;
  email?: string; // New: Optional Email/Gmail
  joinDate: string;
  terminationDate?: string;
  deposit: number;
  qrCode: string; // Must be unique among active drivers
  vehicle: string; // Max 2 active drivers per vehicle
  status: 'Active' | 'Terminated';
  currentShift: 'Day' | 'Night'; // Default current shift
  defaultRent?: number; // Default daily rent amount
  notes?: string;
  isManager?: boolean; // New: Manager Role Flag
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
