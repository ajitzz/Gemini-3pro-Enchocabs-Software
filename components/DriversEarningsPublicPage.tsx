import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Calendar,
  Wallet,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  BadgeIndianRupee,
  Users,
  Clock
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { Driver, WeeklyWallet } from '../types';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);

const formatWeekRange = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
};

const formatMonthLabel = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

const DriversEarningsPublicPage: React.FC = () => {
  const [wallets, setWallets] = useState<WeeklyWallet[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [walletData, driverData] = await Promise.all([
          storageService.getWeeklyWallets(),
          storageService.getDrivers()
        ]);
        setWallets(walletData);
        setDrivers(driverData.filter(driver => !driver.terminationDate));
      } catch (err: any) {
        setError(err?.message || 'Unable to load earnings data.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const driverEarnings = useMemo(() => {
    const driverNames = new Set([
      ...drivers.map(driver => driver.name),
      ...wallets.map(wallet => wallet.driver)
    ]);

    return Array.from(driverNames)
      .map(name => {
        const driverWallets = wallets
          .filter(wallet => wallet.driver === name)
          .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime());

        const monthlyMap = new Map<string, number>();
        driverWallets.forEach(wallet => {
          const monthKey = wallet.weekStartDate.slice(0, 7);
          const prev = monthlyMap.get(monthKey) || 0;
          monthlyMap.set(monthKey, prev + (Number(wallet.earnings) || 0));
        });

        const monthly = Array.from(monthlyMap.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 3)
          .map(([monthKey, amount]) => ({
            label: formatMonthLabel(`${monthKey}-01`),
            amount
          }));

        const weekly = driverWallets.slice(0, 4).map(wallet => ({
          label: formatWeekRange(wallet.weekStartDate, wallet.weekEndDate),
          amount: Number(wallet.earnings) || 0
        }));

        const totalEarned = driverWallets.reduce((acc, wallet) => acc + (Number(wallet.earnings) || 0), 0);
        const weeklyAverage = driverWallets.length ? totalEarned / driverWallets.length : 0;
        const monthlyAverage = monthlyMap.size
          ? Array.from(monthlyMap.values()).reduce((acc, amount) => acc + amount, 0) / monthlyMap.size
          : 0;
        const highestWeek = driverWallets.reduce((max, wallet) => {
          const amount = Number(wallet.earnings) || 0;
          return amount > max.amount
            ? { label: formatWeekRange(wallet.weekStartDate, wallet.weekEndDate), amount }
            : max;
        }, { label: '', amount: 0 });
        const highestMonthEntry = Array.from(monthlyMap.entries()).reduce(
          (max, [monthKey, amount]) =>
            amount > max.amount ? { label: formatMonthLabel(`${monthKey}-01`), amount } : max,
          { label: '', amount: 0 }
        );

        const currentMonthKey = new Date().toISOString().slice(0, 7);
        const currentMonth = monthlyMap.get(currentMonthKey) || 0;
        const recentWeek = weekly[0]?.amount || 0;

        return {
          name,
          currentMonth,
          recentWeek,
          monthly,
          weekly,
          totalEarned,
          weeklyAverage,
          monthlyAverage,
          highestWeek,
          highestMonthEntry
        };
      })
      .filter(driver => driver.monthly.length || driver.weekly.length)
      .sort((a, b) => b.currentMonth - a.currentMonth);
  }, [drivers, wallets]);

  const summary = useMemo(() => {
    const totalMonthly = driverEarnings.reduce((acc, driver) => acc + driver.currentMonth, 0);
    const totalWeekly = driverEarnings.reduce((acc, driver) => acc + driver.recentWeek, 0);
    const topEarner = driverEarnings[0];
    const bestWeek = driverEarnings.reduce(
      (max, driver) => (driver.recentWeek > max.amount ? { amount: driver.recentWeek, name: driver.name } : max),
      { amount: 0, name: '' }
    );
    const averageMonthly = driverEarnings.length ? totalMonthly / driverEarnings.length : 0;
    return {
      totalMonthly,
      totalWeekly,
      topEarner,
      bestWeek,
      averageMonthly,
      activeDrivers: driverEarnings.length
    };
  }, [driverEarnings]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold">Loading driver earnings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="max-w-lg text-center space-y-4">
          <p className="text-lg font-semibold text-slate-700">We are preparing the earnings dashboard.</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-[32px] bg-slate-950 text-white p-10 md:p-14 shadow-[0_45px_120px_-60px_rgba(15,23,42,0.7)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.4),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.35),_transparent_55%)]" />
        <div className="relative z-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-start">
          <div className="space-y-6 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] text-indigo-200">
              <Sparkles size={14} /> Public Driver Earnings
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight">
              Weekly and monthly earnings, micro-tracked for every active driver.
            </h1>
            <p className="text-slate-300 text-sm md:text-base">
              Transparent wallet data helps future drivers understand earning patterns at Encho Cabs. Scan weekly
              movements, monthly totals, and performance cadence in one focused dashboard.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-4">
                <p className="text-xs uppercase tracking-widest text-slate-300">Monthly Earnings</p>
                <p className="text-2xl font-semibold mt-2">{formatCurrency(summary.totalMonthly)}</p>
              </div>
              <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-4">
                <p className="text-xs uppercase tracking-widest text-slate-300">Latest Week Total</p>
                <p className="text-2xl font-semibold mt-2">{formatCurrency(summary.totalWeekly)}</p>
              </div>
              <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-4">
                <p className="text-xs uppercase tracking-widest text-slate-300">Active Drivers</p>
                <p className="text-2xl font-semibold mt-2">{summary.activeDrivers}</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {summary.topEarner && (
              <div className="bg-white/10 border border-white/10 rounded-3xl p-6">
                <p className="text-xs uppercase tracking-widest text-indigo-200">Top Earner</p>
                <h2 className="text-2xl font-semibold mt-3">{summary.topEarner.name}</h2>
                <p className="text-slate-300 text-sm mt-1">Current month earnings</p>
                <div className="flex items-center justify-between mt-5">
                  <span className="text-3xl font-semibold">{formatCurrency(summary.topEarner.currentMonth)}</span>
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-200">
                    <ArrowUpRight size={20} />
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-100">
                  <BadgeIndianRupee size={20} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-indigo-100">Avg monthly / driver</p>
                  <p className="text-lg font-semibold">{formatCurrency(summary.averageMonthly)}</p>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-100">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-indigo-100">Best recent week</p>
                  <p className="text-lg font-semibold">
                    {summary.bestWeek.name ? `${summary.bestWeek.name} · ${formatCurrency(summary.bestWeek.amount)}` : '-'}
                  </p>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-100">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-indigo-100">Drivers tracked</p>
                  <p className="text-lg font-semibold">{summary.activeDrivers}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {driverEarnings.map(driver => (
          <div
            key={driver.name}
            className="bg-white border border-slate-200/70 rounded-[28px] shadow-[0_24px_60px_-35px_rgba(15,23,42,0.35)] p-6 flex flex-col gap-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-semibold">
                  {getInitials(driver.name)}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Driver</p>
                  <h3 className="text-xl font-semibold text-slate-900 mt-1">{driver.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">Total earnings: {formatCurrency(driver.totalEarned)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-slate-400">This Month</p>
                <p className="text-lg font-semibold text-indigo-600 mt-2">{formatCurrency(driver.currentMonth)}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  <Calendar size={14} /> Monthly breakdown
                </div>
                <div className="mt-3 space-y-2">
                  {driver.monthly.map(month => (
                    <div key={month.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{month.label}</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(month.amount)}</span>
                    </div>
                  ))}
                  {!driver.monthly.length && <p className="text-xs text-slate-400">No monthly data yet</p>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  <Wallet size={14} /> Weekly breakdown
                </div>
                <div className="mt-3 space-y-2">
                  {driver.weekly.map(week => (
                    <div key={week.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{week.label}</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(week.amount)}</span>
                    </div>
                  ))}
                  {!driver.weekly.length && <p className="text-xs text-slate-400">No weekly data yet</p>}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                <Clock size={14} /> Micro analysis
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-widest">Weekly avg</p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">{formatCurrency(driver.weeklyAverage)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-widest">Monthly avg</p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">{formatCurrency(driver.monthlyAverage)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-widest">Highest week</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {driver.highestWeek.label ? `${driver.highestWeek.label} · ${formatCurrency(driver.highestWeek.amount)}` : '-'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-widest">Highest month</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {driver.highestMonthEntry.label
                      ? `${driver.highestMonthEntry.label} · ${formatCurrency(driver.highestMonthEntry.amount)}`
                      : '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
              <span>Latest weekly wallet earnings</span>
              <span className="inline-flex items-center gap-1 text-indigo-500 font-semibold">
                View details <ChevronRight size={16} />
              </span>
            </div>
          </div>
        ))}
      </section>

      {driverEarnings.length === 0 && (
        <section className="text-center py-16 text-slate-500">
          <p className="text-lg font-semibold">No weekly wallet earnings available yet.</p>
          <p className="text-sm mt-2">Add weekly wallet entries to highlight driver earnings on this public page.</p>
        </section>
      )}
    </div>
  );
};

export default DriversEarningsPublicPage;
