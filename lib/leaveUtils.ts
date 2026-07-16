import { LeaveRecord } from '../types';

const asISODateOnly = (value: string | undefined | null): string | null => {
  if (!value) return null;
  return value.split('T')[0] || null;
};


/**
 * Business rule:
 * - Leave starts on startDate (inclusive).
 * - If actualReturnDate exists, the driver is available from that date itself,
 *   so leave is treated as [startDate, actualReturnDate).
 * - If actualReturnDate is missing, planned leave is [startDate, endDate] (inclusive).
 */
export const isDriverUnavailableOnDate = (leave: LeaveRecord, targetDate: string): boolean => {
  const target = asISODateOnly(targetDate);
  if (!target) return false;

  const start = asISODateOnly(leave.startDate);
  const end = asISODateOnly(leave.endDate);
  if (!start || !end) return false;

  const actualReturn = asISODateOnly(leave.actualReturnDate);
  if (actualReturn) {
    return target >= start && target < actualReturn;
  }

  return target >= start && target <= end;
};
