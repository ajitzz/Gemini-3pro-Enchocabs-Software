import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Users } from 'lucide-react';
import { storageService } from '../services/storageService';
import { DriverSummary } from '../types';

const HIDDEN_DRIVERS_STORAGE_KEY = 'driver_app_hidden_drivers_v1';

const loadHiddenDrivers = (): string[] => {
  try {
    const savedHiddenDrivers = localStorage.getItem(HIDDEN_DRIVERS_STORAGE_KEY);
    if (!savedHiddenDrivers) return [];

    const parsedHiddenDrivers = JSON.parse(savedHiddenDrivers);
    if (!Array.isArray(parsedHiddenDrivers)) return [];

    return parsedHiddenDrivers
      .map((name) => (typeof name === 'string' ? name.trim() : ''))
      .filter(Boolean);
  } catch (error) {
    console.warn('Failed to load hidden drivers', error);
    return [];
  }
};

const DriverBalanceInsightsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<DriverSummary[]>([]);
  const [filterDriver, setFilterDriver] = useState('');
  const [hiddenDrivers, setHiddenDrivers] = useState<string[]>(() => loadHiddenDrivers());

  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_DRIVERS_STORAGE_KEY, JSON.stringify(hiddenDrivers));
    } catch (error) {
      console.warn('Failed to save hidden drivers', error);
    }
  }, [hiddenDrivers]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { summaries: driverSummaries } = await storageService.getDriverBalanceSummaries();
        setSummaries(driverSummaries || []);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

  const sortedSummaries = useMemo(() => summaries
    .map((summary) => ({
      ...summary,
      totalWalletWithCharges: summary.totalWalletWeek,
    }))
    .sort((a, b) => a.finalTotal - b.finalTotal), [summaries]);

  const filteredSummaries = useMemo(() => sortedSummaries
    .filter((summary) => !hiddenDrivers.includes(summary.driver))
    .filter((summary) => filterDriver === '' || summary.driver.toLowerCase().includes(filterDriver.toLowerCase())), [sortedSummaries, hiddenDrivers, filterDriver]);

  const hiddenDriverList = useMemo(
    () => [...hiddenDrivers].sort((a, b) => a.localeCompare(b)),
    [hiddenDrivers]
  );

  const totals = useMemo(() => filteredSummaries.reduce(
    (acc, driver) => ({
      collection: acc.collection + driver.totalCollection,
      rent: acc.rent + driver.totalRent,
      fuel: acc.fuel + driver.totalFuel,
      due: acc.due + driver.totalDue,
      wallet: acc.wallet + driver.totalWalletWithCharges,
      payout: acc.payout + driver.totalPayout,
      netPayout: acc.netPayout + driver.netPayout,
      finalTotal: acc.finalTotal + driver.finalTotal,
    }),
    { collection: 0, rent: 0, fuel: 0, due: 0, wallet: 0, payout: 0, netPayout: 0, finalTotal: 0 }
  ), [filteredSummaries]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium text-sm animate-pulse">Loading complete driver balances...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to dashboard
          </button>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Driver Balance Insights</h2>
          <p className="text-slate-500 mt-1 font-medium">Full-table visibility with all rows and all columns in one dedicated page.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Visible Drivers</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{filteredSummaries.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Net Balance</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{formatCurrency(totals.finalTotal)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Net Payout</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{formatCurrency(totals.netPayout)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BarChart3 size={18} />
          </div>
          <p className="text-sm text-slate-500 leading-tight">Use the search box and hide option to focus on priority drivers.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Users size={20} className="text-indigo-500" /> Complete Driver Balance Table
          </h3>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="relative group">
              <input
                type="text"
                placeholder="Filter drivers..."
                value={filterDriver}
                onChange={(e) => setFilterDriver(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all w-64"
              />
              <Users size={16} className="absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            {hiddenDriverList.length > 0 && (
              <button
                type="button"
                onClick={() => setHiddenDrivers([])}
                className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-semibold border border-indigo-100 hover:bg-indigo-100 transition-colors"
              >
                Unhide all ({hiddenDriverList.length})
              </button>
            )}
          </div>
        </div>

        {hiddenDriverList.length > 0 && (
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Hidden Drivers</p>
            <div className="flex flex-wrap gap-2">
              {hiddenDriverList.map((driverName) => (
                <button
                  key={driverName}
                  type="button"
                  onClick={() => setHiddenDrivers((prev) => prev.filter((name) => name !== driverName))}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                >
                  {driverName}
                  <span className="text-[10px] uppercase tracking-wider text-indigo-500">Unhide</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[1100px]">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Driver</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Collection</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Rent</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Fuel</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Dues</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Wallet</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Payout</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Net Payout</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Net Balance</th>
                <th className="px-6 py-4 font-semibold text-right tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSummaries.map((driver) => (
                <tr key={driver.driver} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-700">{driver.driver}</td>
                  <td className="px-6 py-4 text-right text-slate-600 font-medium">{formatCurrency(driver.totalCollection)}</td>
                  <td className="px-6 py-4 text-right text-slate-400">{formatCurrency(driver.totalRent)}</td>
                  <td className="px-6 py-4 text-right text-slate-400">{formatCurrency(driver.totalFuel)}</td>
                  <td className="px-6 py-4 text-right text-slate-400">{formatCurrency(driver.totalDue)}</td>
                  <td className="px-6 py-4 text-right text-slate-500 font-medium">{formatCurrency(driver.totalWalletWithCharges)}</td>
                  <td className="px-6 py-4 text-right text-slate-500 font-medium">{formatCurrency(driver.totalPayout)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${
                      driver.netPayout < 0
                        ? 'bg-rose-50 text-rose-700 border-rose-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {formatCurrency(driver.netPayout)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${
                      driver.finalTotal < 0
                        ? 'bg-rose-50 text-rose-700 border-rose-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {formatCurrency(driver.finalTotal)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setHiddenDrivers((prev) => [...new Set([...prev, driver.driver])])}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      Hide
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSummaries.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Users size={32} className="opacity-20" />
                      <p>No drivers found matching "{filterDriver}"</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 text-slate-700 font-bold border-t border-slate-100">
              <tr>
                <td className="px-6 py-3">Totals</td>
                <td className="px-6 py-3 text-right">{formatCurrency(totals.collection)}</td>
                <td className="px-6 py-3 text-right">{formatCurrency(totals.rent)}</td>
                <td className="px-6 py-3 text-right">{formatCurrency(totals.fuel)}</td>
                <td className="px-6 py-3 text-right">{formatCurrency(totals.due)}</td>
                <td className="px-6 py-3 text-right">{formatCurrency(totals.wallet)}</td>
                <td className="px-6 py-3 text-right">{formatCurrency(totals.payout)}</td>
                <td className="px-6 py-3 text-right">{formatCurrency(totals.netPayout)}</td>
                <td className="px-6 py-3 text-right">{formatCurrency(totals.finalTotal)}</td>
                <td className="px-6 py-3 text-right">-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DriverBalanceInsightsPage;
