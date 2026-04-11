import { DailyEntry } from '../types';

export type EntryValidationIssue = {
  field: keyof DailyEntry | 'general';
  message: string;
  severity: 'error' | 'warning';
};

export type SyncState = 'synced' | 'pending' | 'failed' | 'offline';

export const MOBILE_DRAFT_KEY = 'daily_entry_mobile_draft_v1';
export const MOBILE_QUEUE_KEY = 'daily_entry_mobile_queue_v1';

export const getTodayISODate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const validateEntry = (entry: Partial<DailyEntry>, recentEntries: DailyEntry[]): EntryValidationIssue[] => {
  const issues: EntryValidationIssue[] = [];

  if (!entry.date) issues.push({ field: 'date', message: 'Date is required.', severity: 'error' });
  if (!entry.driver) issues.push({ field: 'driver', message: 'Driver is required.', severity: 'error' });
  if (entry.collection === undefined || Number.isNaN(Number(entry.collection))) {
    issues.push({ field: 'collection', message: 'Collection is required.', severity: 'error' });
  }
  if (entry.rent === undefined || Number.isNaN(Number(entry.rent))) {
    issues.push({ field: 'rent', message: 'Rent is required.', severity: 'error' });
  }
  if (Number(entry.payout || 0) > 0 && !entry.payoutDate) {
    issues.push({ field: 'payoutDate', message: 'Payout date is required when payout is entered.', severity: 'error' });
  }

  const duplicate = recentEntries.find(
    (item) => item.date === entry.date && item.driver === entry.driver && item.id !== entry.id,
  );
  if (duplicate) {
    issues.push({ field: 'general', message: 'Another entry already exists for this driver and date.', severity: 'warning' });
  }

  const prev7 = recentEntries
    .filter((item) => item.driver === entry.driver)
    .slice(0, 7);

  if (prev7.length > 0) {
    const avgCollection = prev7.reduce((sum, item) => sum + Number(item.collection || 0), 0) / prev7.length;
    if (avgCollection > 0 && Number(entry.collection || 0) > avgCollection * 2) {
      issues.push({ field: 'collection', message: 'Collection is much higher than recent entries.', severity: 'warning' });
    }

    const avgDue = prev7.reduce((sum, item) => sum + Math.abs(Number(item.due || 0)), 0) / prev7.length;
    if (avgDue > 0 && Math.abs(Number(entry.due || 0)) > avgDue * 2.5) {
      issues.push({ field: 'due', message: 'Due value is an outlier versus recent entries.', severity: 'warning' });
    }
  }

  return issues;
};

export const getCompleteness = (entry: Partial<DailyEntry>) => {
  const checklist: Array<keyof DailyEntry> = ['date', 'driver', 'collection', 'rent', 'shift'];
  const complete = checklist.filter((key) => {
    const value = entry[key];
    if (key === 'collection' || key === 'rent') return value !== undefined && value !== null;
    return Boolean(value);
  }).length;

  return {
    complete,
    total: checklist.length,
    percent: Math.round((complete / checklist.length) * 100),
  };
};

export const queueEntry = (entry: DailyEntry) => {
  const current = JSON.parse(localStorage.getItem(MOBILE_QUEUE_KEY) || '[]') as DailyEntry[];
  localStorage.setItem(MOBILE_QUEUE_KEY, JSON.stringify([...current, entry]));
};

export const readQueuedEntries = () => JSON.parse(localStorage.getItem(MOBILE_QUEUE_KEY) || '[]') as DailyEntry[];

export const saveDraft = (entry: Partial<DailyEntry>) => {
  localStorage.setItem(MOBILE_DRAFT_KEY, JSON.stringify({ ...entry, savedAt: Date.now() }));
};

export const readDraft = () => {
  try {
    return JSON.parse(localStorage.getItem(MOBILE_DRAFT_KEY) || 'null') as (Partial<DailyEntry> & { savedAt?: number }) | null;
  } catch {
    return null;
  }
};

export const clearDraft = () => localStorage.removeItem(MOBILE_DRAFT_KEY);
