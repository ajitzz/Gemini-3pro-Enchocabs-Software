import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Calendar,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Wallet
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
          .slice(0, 6)
          .map(([monthKey, amount]) => ({
            label: formatMonthLabel(`${monthKey}-01`),
            amount
          }));

        const weekly = driverWallets.slice(0, 6).map(wallet => ({
          label: formatWeekRange(wallet.weekStartDate, wallet.weekEndDate),
          amount: Number(wallet.earnings) || 0
        }));

        const currentMonthKey = new Date().toISOString().slice(0, 7);
        const currentMonth = monthlyMap.get(currentMonthKey) || 0;
        const recentWeek = weekly[0]?.amount || 0;
        const averageWeek = weekly.length
          ? weekly.reduce((acc, item) => acc + item.amount, 0) / weekly.length
          : 0;

        return {
          name,
          currentMonth,
          recentWeek,
          averageWeek,
          monthly,
          weekly
        };
      })
      .filter(driver => driver.monthly.length || driver.weekly.length)
      .sort((a, b) => b.currentMonth - a.currentMonth);
  }, [drivers, wallets]);

  const summary = useMemo(() => {
    const totalMonthly = driverEarnings.reduce((acc, driver) => acc + driver.currentMonth, 0);
    const totalWeekly = driverEarnings.reduce((acc, driver) => acc + driver.recentWeek, 0);
    const averageWeekly = driverEarnings.length
      ? driverEarnings.reduce((acc, driver) => acc + driver.averageWeek, 0) / driverEarnings.length
      : 0;
    const topEarner = driverEarnings[0];
    return {
      totalMonthly,
      totalWeekly,
      averageWeekly,
      topEarner
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
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[32px] bg-slate-950 text-white p-10 md:p-14 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.4),_transparent_55%)]" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_right,_rgba(56,189,248,0.2),_transparent_60%)]" />
        <div className="relative z-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-xs uppercase tracking-[0.3em] text-indigo-200">
              <Sparkles size={14} /> Public Driver Earnings
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight">
              A transparent earnings showcase for every Encho Cabs driver.
            </h1>
            <p className="text-slate-300 text-sm md:text-base max-w-2xl">
              Explore weekly wallet earnings and monthly totals to understand income patterns. This public view is crafted for future drivers and partners who want clarity before joining.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-4 min-w-[170px]">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Monthly Earnings</p>
                <p className="text-2xl font-semibold mt-3">{formatCurrency(summary.totalMonthly)}</p>
                <p className="text-xs text-slate-400 mt-2">Aggregated current month</p>
              </div>
              <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-4 min-w-[170px]">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Latest Week Total</p>
                <p className="text-2xl font-semibold mt-3">{formatCurrency(summary.totalWeekly)}</p>
                <p className="text-xs text-slate-400 mt-2">Most recent wallet week</p>
              </div>
              <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-4 min-w-[170px]">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Avg Weekly</p>
                <p className="text-2xl font-semibold mt-3">{formatCurrency(summary.averageWeekly)}</p>
                <p className="text-xs text-slate-400 mt-2">Across active drivers</p>
              </div>
            </div>
          </div>
          {summary.topEarner && (
            <div className="bg-white/10 border border-white/10 rounded-3xl p-6 md:p-8 self-start">
              <p className="text-xs uppercase tracking-widest text-indigo-200">Top Earner</p>
              <h2 className="text-2xl font-semibold mt-3">{summary.topEarner.name}</h2>
              <p className="text-slate-300 text-sm mt-1">Current month earnings</p>
              <div className="flex items-center justify-between mt-6">
                <span className="text-3xl font-semibold">{formatCurrency(summary.topEarner.currentMonth)}</span>
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-200">
                  <ArrowUpRight size={22} />
                </div>
              </div>
              <div className="mt-6 text-xs text-slate-400 flex items-center gap-2">
                <TrendingUp size={14} /> Weekly earnings update from wallet reports.
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-[0_16px_60px_-40px_rgba(15,23,42,0.3)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">How to Read</p>
          <h2 className="text-xl font-semibold text-slate-900 mt-3">Weekly + Monthly Clarity</h2>
          <p className="text-sm text-slate-500 mt-3">
            Each driver card highlights monthly totals alongside the latest weekly payouts. Use the weekly column to compare short-term performance and the monthly column to track consistency.
          </p>
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Wallet size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Weekly wallet earnings</p>
                <p className="text-xs text-slate-500">Recent six weeks per driver.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Monthly totals</p>
                <p className="text-xs text-slate-500">Rolling six months view.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {driverEarnings.map(driver => (
            <div key={driver.name} className="bg-white border border-slate-200 rounded-3xl shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] p-6 flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Driver</p>
                  <h3 className="text-xl font-semibold text-slate-900 mt-2">{driver.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">Updated from weekly wallet earnings</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">This Month</p>
                  <p className="text-lg font-semibold text-indigo-600 mt-2">{formatCurrency(driver.currentMonth)}</p>
                  <p className="text-xs text-slate-500 mt-1">Avg weekly: {formatCurrency(driver.averageWeek)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-2"><Calendar size={14} /> Monthly</span>
                    <span className="text-slate-400">Last 6 months</span>
                  </div>
                  <div className="mt-4 space-y-3">
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
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-2"><Wallet size={14} /> Weekly</span>
                    <span className="text-slate-400">Latest 6 weeks</span>
                  </div>
                  <div className="mt-4 space-y-3">
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

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
                <span>Latest weekly wallet earnings</span>
                <span className="inline-flex items-center gap-1 text-indigo-500 font-semibold">View details <ChevronRight size={16} /></span>
              </div>
            </div>
          ))}
        </div>
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
