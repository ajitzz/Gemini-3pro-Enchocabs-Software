import { LeaveRecord } from '../types';

const asISODateOnly = (value: string | undefined | null): string | null => {
  if (!value) return null;
  return value.split('T')[0] || null;
};


/**
 * Business rule:
 * - Leave starts on startDate (inclusive).
 * - If actualReturnDate exists, that day is still considered leave.
 *   Driver becomes available from the next day.
 * - If actualReturnDate is missing, leave continues until actual return is entered
 *   (planned endDate is informational only).
 */
export const isDriverUnavailableOnDate = (leave: LeaveRecord, targetDate: string): boolean => {
  const target = asISODateOnly(targetDate);
  if (!target) return false;

  const start = asISODateOnly(leave.startDate);
  const end = asISODateOnly(leave.endDate);
  if (!start || !end) return false;

  const actualReturn = asISODateOnly(leave.actualReturnDate);
  if (actualReturn) {
    return target >= start && target <= actualReturn;
  }

  return target >= start;
};
