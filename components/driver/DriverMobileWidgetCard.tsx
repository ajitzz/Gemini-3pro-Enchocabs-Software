import React, { useMemo } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

type Props = {
  netBalance: number;
  netPayout: number;
  connected: boolean;
  updatedAt: number;
  onOpenNetPayout: () => void;
  onOpenNetBalance: () => void;
};

const formatCurrencyInt = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);

const DriverMobileWidgetCard: React.FC<Props> = ({
  netBalance,
  netPayout,
  connected,
  updatedAt,
  onOpenNetPayout,
  onOpenNetBalance,
}) => {
  const relativeTime = useMemo(() => {
    const seconds = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
    if (seconds < 10) return 'Updated just now';
    if (seconds < 60) return `Updated ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Updated ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `Updated ${hours}h ago`;
  }, [updatedAt]);

  return (
    <section className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/30 to-sky-50/60 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-indigo-500">Quick Widget</p>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold border ${connected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connected ? 'Live' : 'Syncing'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onOpenNetPayout}
          className="text-left rounded-2xl border border-slate-100 bg-white p-3 shadow-sm hover:shadow transition"
        >
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-bold">Net Payout</p>
          <p className={`mt-1 text-lg font-extrabold ${netPayout < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
            {formatCurrencyInt(netPayout)}
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenNetBalance}
          className="text-left rounded-2xl border border-slate-100 bg-white p-3 shadow-sm hover:shadow transition"
        >
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-bold">Net Balance</p>
          <p className={`mt-1 text-lg font-extrabold ${netBalance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
            {formatCurrencyInt(netBalance)}
          </p>
        </button>
      </div>

      <p className="mt-3 text-[11px] font-semibold text-slate-500">{relativeTime}</p>
    </section>
  );
};

export default DriverMobileWidgetCard;
