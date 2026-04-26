import { BillDetailData } from '../components/BillDetailContent';

export const buildBillSharePayload = (bill: BillDetailData): Record<string, unknown> => ({
  id: bill.id,
  driverId: bill.driverId,
  driver: bill.driver || bill.driverName,
  driverName: bill.driverName || bill.driver || 'Driver',
  qrCode: bill.qrCode,
  weekRange: bill.weekRange,
  weekStartDate: bill.weekStartDate,
  weekEndDate: bill.weekEndDate,
  trips: bill.trips,
  rentPerDay: bill.rentPerDay,
  daysWorked: bill.daysWorked,
  rentTotal: bill.rentTotal,
  collection: bill.collection,
  fuel: bill.fuel,
  overdue: bill.overdue ?? bill.due ?? 0,
  due: bill.overdue ?? bill.due ?? 0,
  wallet: bill.wallet,
  walletOverdue: bill.overdue ?? bill.due ?? 0,
  adjustments: bill.adjustments ?? 0,
  expenses: bill.expenses || 0,
  payout: bill.payout,
  status: bill.status || 'Finalized',
  generatedAt: bill.generatedAt || new Date().toISOString(),
  labeledDueRows: bill.labeledDueRows || [],
  weeklyDetails: bill.weeklyDetails || null,
  deposit: bill.deposit || 0,
});

export const asBillDetailData = (bill: unknown): BillDetailData | null => {
  if (!bill || typeof bill !== 'object') return null;
  return bill as BillDetailData;
};
