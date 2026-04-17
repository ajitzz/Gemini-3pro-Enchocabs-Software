import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Coins, PlusCircle, ReceiptText, Trash2, Users } from 'lucide-react';
import { storageService } from '../services/storageService';
import { DailyEntry, Driver, DriverExpense, DriverExpenseGroupInput, LeaveRecord } from '../types';

const CATEGORY_OPTIONS = [
  { value: 'Food', label: '🍛 Food' },
  { value: 'Travel', label: '🚕 Travel' },
  { value: 'Ticket', label: '🎫 Ticket' },
  { value: 'Hotel', label: '🏨 Hotel' },
  { value: 'Etc', label: '🧾 Etc' },
  { value: 'Custom', label: '✨ Custom' },
];

type DatePreset = 'all' | 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom';

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday-start week
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
};
const endOfWeek = (date: Date) => {
  const start = startOfWeek(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
};
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const DriverExpensesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<DriverExpense[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [presentEntries, setPresentEntries] = useState<DailyEntry[]>([]);
  const [form, setForm] = useState<DriverExpenseGroupInput>({
    expenseDate: new Date().toISOString().slice(0, 10),
    category: 'Food',
    amount: 0,
    notes: '',
    splitMode: 'all',
    distributionMode: 'split',
    selectedDrivers: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const getReadableError = (err: any) => {
    const message = String(err?.message || 'Unexpected error');
    if (/\b404\b/.test(message)) {
      return 'Expense API is not available on the server yet (404). Please deploy the latest backend.';
    }
    return message;
  };

  const dateFilter = useMemo(() => {
    const now = new Date();
    const currentDay = startOfDay(now);

    if (datePreset === 'today') {
      const date = toIsoDate(currentDay);
      return { from: date, to: date, label: 'Today' };
    }

    if (datePreset === 'thisWeek') {
      return { from: toIsoDate(startOfWeek(currentDay)), to: toIsoDate(endOfWeek(currentDay)), label: 'This week' };
    }

    if (datePreset === 'lastWeek') {
      const anchor = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate() - 7);
      return { from: toIsoDate(startOfWeek(anchor)), to: toIsoDate(endOfWeek(anchor)), label: 'Last week' };
    }

    if (datePreset === 'thisMonth') {
      return { from: toIsoDate(startOfMonth(currentDay)), to: toIsoDate(endOfMonth(currentDay)), label: 'This month' };
    }

    if (datePreset === 'lastMonth') {
      const anchor = new Date(currentDay.getFullYear(), currentDay.getMonth() - 1, 1);
      return { from: toIsoDate(startOfMonth(anchor)), to: toIsoDate(endOfMonth(anchor)), label: 'Last month' };
    }

    if (datePreset === 'custom') {
      const from = customFrom || undefined;
      const to = customTo || undefined;
      return { from, to, label: from || to ? 'Custom range' : 'Custom range (unselected)' };
    }

    return { from: undefined, to: undefined, label: 'All time' };
  }, [customFrom, customTo, datePreset]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allExpenses, allDrivers, allLeaves] = await Promise.all([
        storageService.getDriverExpenses({ from: dateFilter.from, to: dateFilter.to, fresh: 1 }),
        storageService.getDrivers(),
        storageService.getLeaves(),
      ]);
      setExpenses(allExpenses);
      setDrivers(allDrivers);
      setLeaves(allLeaves);
    } catch (err: any) {
      setError(getReadableError(err) || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFilter.from, dateFilter.to]);

  useEffect(() => {
    const selectedDate = form.expenseDate || new Date().toISOString().slice(0, 10);
    let isMounted = true;
    storageService.getDailyEntries({ from: selectedDate, to: selectedDate, fresh: 1 })
      .then((rows) => {
        if (!isMounted) return;
        setPresentEntries(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setPresentEntries([]);
      });

    return () => {
      isMounted = false;
    };
  }, [form.expenseDate]);

  const expenseDate = form.expenseDate || new Date().toISOString().slice(0, 10);

  const eligibleDrivers = useMemo(() => {
    const presentDriverSet = new Set(
      presentEntries
        .map((entry) => String(entry.driver || '').trim().toLowerCase())
        .filter(Boolean)
    );
    return drivers.filter((driver) => {
      if (driver.isHidden) return false;
      if (driver.status !== 'Active') return false;
      if (!presentDriverSet.has(String(driver.name || '').trim().toLowerCase())) return false;
      if (driver.terminationDate && driver.terminationDate < expenseDate) return false;
      const leaveConflict = leaves.some((leave) => {
        if (leave.driverId !== driver.id) return false;
        if (expenseDate < leave.startDate || expenseDate > leave.endDate) return false;
        if (!leave.actualReturnDate) return true;
        return expenseDate <= leave.actualReturnDate;
      });
      return !leaveConflict;
    });
  }, [drivers, expenseDate, leaves, presentEntries]);

  const targetedDrivers = useMemo(() => {
    if (form.splitMode === 'all') return eligibleDrivers.map((d) => d.name);
    const selected = new Set((form.selectedDrivers || []).map((name) => name.toLowerCase().trim()));
    return eligibleDrivers
      .map((d) => d.name)
      .filter((name) => selected.has(name.toLowerCase().trim()));
  }, [eligibleDrivers, form.selectedDrivers, form.splitMode]);

  const previewSplit = useMemo(() => {
    const count = targetedDrivers.length;
    const amount = Math.max(0, Math.round(Number(form.amount) || 0));
    if (!count || amount <= 0) return [];
    if (form.distributionMode === 'common') {
      return targetedDrivers.map((driver) => ({
        driver,
        amount,
      }));
    }
    const base = Math.floor(amount / count);
    const remainder = amount % count;
    return targetedDrivers.map((driver, index) => ({
      driver,
      amount: base + (index < remainder ? 1 : 0),
    }));
  }, [form.amount, form.distributionMode, targetedDrivers]);

  const groupedExpenses = useMemo(() => {
    const groups = new Map<string, {
      groupId: string;
      expenseDate: string;
      category: string;
      customType?: string;
      splitMode: 'all' | 'selected';
      distributionMode: 'split' | 'common';
      notes?: string;
      entries: DriverExpense[];
      totalAmount: number;
    }>();

    expenses.forEach((expense) => {
      if (!groups.has(expense.groupId)) {
        groups.set(expense.groupId, {
          groupId: expense.groupId,
          expenseDate: expense.expenseDate,
          category: expense.category,
          customType: expense.customType,
          splitMode: expense.splitMode,
          distributionMode: expense.distributionMode === 'common' ? 'common' : 'split',
          notes: expense.notes,
          entries: [],
          totalAmount: 0,
        });
      }
      const group = groups.get(expense.groupId)!;
      group.entries.push(expense);
      group.totalAmount += expense.amount;
    });

    return Array.from(groups.values()).sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  }, [expenses]);

  const payableByDriver = useMemo(() => {
    const totals = new Map<string, { driver: string; total: number; entries: number }>();

    expenses.forEach((expense) => {
      const driverName = String(expense.driver || '').trim();
      if (!driverName) return;
      const key = driverName.toLowerCase();
      if (!totals.has(key)) {
        totals.set(key, { driver: driverName, total: 0, entries: 0 });
      }
      const row = totals.get(key)!;
      row.total += Number(expense.amount) || 0;
      row.entries += 1;
    });

    const visibleDrivers = drivers
      .filter((driver) => !driver.isHidden)
      .map((driver) => String(driver.name || '').trim())
      .filter(Boolean);

    visibleDrivers.forEach((driverName) => {
      const key = driverName.toLowerCase();
      if (!totals.has(key)) {
        totals.set(key, { driver: driverName, total: 0, entries: 0 });
      }
    });

    return Array.from(totals.values()).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.driver.localeCompare(b.driver);
    });
  }, [drivers, expenses]);

  const resetForm = () => {
    setForm({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'Food',
      amount: 0,
      notes: '',
      splitMode: 'all',
      distributionMode: 'split',
      selectedDrivers: [],
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if ((Number(form.amount) || 0) <= 0) {
        throw new Error('Amount must be greater than zero.');
      }
      if (targetedDrivers.length === 0) {
        throw new Error('No eligible drivers selected for this expense.');
      }
      await storageService.saveDriverExpenseGroup({
        ...form,
        distributionMode: form.distributionMode === 'common' ? 'common' : 'split',
        selectedDrivers: form.splitMode === 'all' ? [] : targetedDrivers,
      });
      await loadData();
      resetForm();
    } catch (err: any) {
      setError(getReadableError(err) || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const editGroup = (groupId: string) => {
    const group = groupedExpenses.find((entry) => entry.groupId === groupId);
    if (!group) return;
    setForm({
      id: group.groupId,
      expenseDate: group.expenseDate,
      category: group.category,
      customType: group.customType || '',
      amount: group.distributionMode === 'common'
        ? Number(group.entries[0]?.amount || 0)
        : group.totalAmount,
      notes: group.notes || '',
      splitMode: group.splitMode,
      distributionMode: group.distributionMode,
      selectedDrivers: group.entries.map((entry) => entry.driver),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteGroup = async (groupId: string) => {
    setDeletingGroupId(groupId);
    setError(null);
    try {
      await storageService.deleteDriverExpenseGroup(groupId);
      await loadData();
      if (form.id === groupId) resetForm();
    } catch (err: any) {
      setError(getReadableError(err) || 'Failed to delete expense');
    } finally {
      setDeletingGroupId(null);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

  if (loading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <div className="w-9 h-9 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-none">
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-500">
              <ReceiptText size={14} /> Expense split center
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Driver Expense Deductions</h2>
            <p className="mt-2 text-sm text-slate-600">
              Net Balance = Collection - Rent - Fuel + Due + Wallet Week - Payouts - Expenses
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-right">
            <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Groups</p>
              <p className="text-xl font-black text-slate-800">{groupedExpenses.length}</p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Expenses</p>
              <p className="text-xl font-black text-rose-600">
                {formatCurrency(groupedExpenses.reduce((sum, item) => sum + item.totalAmount, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900">Date Filters</h3>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Showing: {dateFilter.label}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All Time' },
            { key: 'today', label: 'Today' },
            { key: 'thisWeek', label: 'This Week' },
            { key: 'lastWeek', label: 'Last Week' },
            { key: 'thisMonth', label: 'This Month' },
            { key: 'lastMonth', label: 'Last Month' },
            { key: 'custom', label: 'Custom Range' },
          ].map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setDatePreset(preset.key as DatePreset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                datePreset === preset.key
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">From date</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">To date</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold"
              />
            </label>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-medium">{error}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Add / Edit Expense Group</h3>
            {form.id && (
              <button type="button" onClick={resetForm} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                Clear Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expense date</span>
              <input
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm((prev) => ({ ...prev, expenseDate: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount (₹)</span>
              <input
                type="number"
                min={1}
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold"
                required
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type</span>
              <select
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custom label / emoji</span>
              <input
                type="text"
                value={form.customType || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, customType: e.target.value }))}
                placeholder="e.g. 🛠️ Repair"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold"
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Split mode</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, splitMode: 'all' }))}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  form.splitMode === 'all'
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <p className="font-bold text-sm">All eligible drivers</p>
                <p className="text-xs mt-1">Active + present on selected date + not on leave</p>
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, splitMode: 'selected' }))}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  form.splitMode === 'selected'
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <p className="font-bold text-sm">Selected drivers</p>
                <p className="text-xs mt-1">Pick from active drivers present on selected date</p>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Distribution</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, distributionMode: 'split' }))}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  (form.distributionMode || 'split') === 'split'
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <p className="font-bold text-sm">Split amount</p>
                <p className="text-xs mt-1">Amount is divided among selected drivers</p>
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, distributionMode: 'common' }))}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  form.distributionMode === 'common'
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <p className="font-bold text-sm">Add full amount to each</p>
                <p className="text-xs mt-1">Every selected driver gets this full amount</p>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Distribution</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, distributionMode: 'split' }))}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  (form.distributionMode || 'split') === 'split'
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <p className="font-bold text-sm">Split amount</p>
                <p className="text-xs mt-1">Amount is divided among selected drivers</p>
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, distributionMode: 'common' }))}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  form.distributionMode === 'common'
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <p className="font-bold text-sm">Add full amount to each</p>
                <p className="text-xs mt-1">Every selected driver gets this full amount</p>
              </button>
            </div>
          </div>

          {form.splitMode === 'selected' && (
            <div className="rounded-2xl border border-slate-200 p-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Choose drivers</p>
              <div className="flex flex-wrap gap-2">
                {eligibleDrivers.map((driver) => {
                  const selected = (form.selectedDrivers || []).some((name) => name.toLowerCase() === driver.name.toLowerCase());
                  return (
                    <button
                      key={driver.id}
                      type="button"
                      onClick={() => setForm((prev) => {
                        const current = prev.selectedDrivers || [];
                        const exists = current.some((name) => name.toLowerCase() === driver.name.toLowerCase());
                        return {
                          ...prev,
                          selectedDrivers: exists
                            ? current.filter((name) => name.toLowerCase() !== driver.name.toLowerCase())
                            : [...current, driver.name],
                        };
                      })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        selected
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {driver.name}
                    </button>
                  );
                })}
                {eligibleDrivers.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No active & present drivers found for {form.expenseDate}.
                  </p>
                )}
              </div>
            </div>
          )}

          <label className="space-y-1 block">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notes</span>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
              placeholder="Optional notes"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-white py-3 font-bold hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Calendar size={16} className="animate-spin" /> : <PlusCircle size={16} />}
            {form.id ? 'Update Expense Group' : 'Create Expense Group'}
          </button>
        </form>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Distribution Preview</h3>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3 max-h-[520px] overflow-y-auto">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span className="inline-flex items-center gap-1"><Users size={14} /> Drivers: {targetedDrivers.length}</span>
              <span className="inline-flex items-center gap-1">
                <Coins size={14} />
                {(form.distributionMode || 'split') === 'split' ? 'Total' : 'Per driver'}: {formatCurrency(Number(form.amount) || 0)}
              </span>
            </div>
            {previewSplit.length === 0 ? (
              <p className="text-sm text-slate-500">Enter amount and select eligible drivers to preview distribution.</p>
            ) : (
              previewSplit.map((row) => (
                <div key={row.driver} className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-700">{row.driver}</span>
                  <span className="text-sm font-black text-indigo-700">{formatCurrency(row.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Expense History</h3>
        <div className="space-y-3">
          {groupedExpenses.length === 0 ? (
            <p className="text-sm text-slate-500">No expense groups yet.</p>
          ) : (
            groupedExpenses.map((group) => (
              <div key={group.groupId} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-800">
                      {(group.customType || group.category)} · {formatCurrency(group.totalAmount)}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      {group.expenseDate} · {group.entries.length} driver{group.entries.length === 1 ? '' : 's'} · {group.distributionMode === 'common' ? 'common add' : 'split'} · target {group.splitMode}
                    </p>
                    {group.notes && <p className="text-xs text-slate-500 mt-1">{group.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => editGroup(group.groupId)}
                      className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteGroup(group.groupId)}
                      disabled={deletingGroupId === group.groupId}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold disabled:opacity-60 inline-flex items-center gap-1"
                    >
                      {deletingGroupId === group.groupId ? <CheckCircle2 size={12} className="animate-pulse" /> : <Trash2 size={12} />}
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.entries.map((entry) => (
                    <span key={entry.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 font-semibold">
                      {entry.driver}: {formatCurrency(entry.amount)}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-slate-900">Driver Payable Expenses</h3>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{dateFilter.label}</p>
        </div>
        {payableByDriver.length === 0 ? (
          <p className="text-sm text-slate-500">No drivers available.</p>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_80px] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <span>Driver</span>
              <span className="text-right">Payable Expense</span>
              <span className="text-right">Entries</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
              {payableByDriver.map((row) => (
                <div key={row.driver} className="grid grid-cols-[minmax(0,1fr)_120px_80px] items-center px-4 py-2.5 text-sm">
                  <span className="font-semibold text-slate-700 truncate pr-2">{row.driver}</span>
                  <span className={`text-right font-black ${row.total > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {formatCurrency(row.total)}
                  </span>
                  <span className="text-right text-slate-500 font-semibold">{row.entries}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverExpensesPage;
