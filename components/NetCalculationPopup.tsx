import React from 'react';
import { X } from 'lucide-react';

type NetMetric = 'netPayout' | 'netBalance';

interface CalculationValues {
  collection: number;
  rent: number;
  fuel: number;
  due: number;
  wallet: number;
  payout: number;
  expenses: number;
}

interface NetCalculationPopupProps {
  metric: NetMetric;
  netValue: number;
  values: CalculationValues;
  title?: string;
  sourceNote?: string;
  onClose: () => void;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);

const NetCalculationPopup: React.FC<NetCalculationPopupProps> = ({
  metric,
  netValue,
  values,
  title,
  sourceNote,
  onClose
}) => {
  const rows = [
    { label: 'Collections', value: values.collection, tone: 'positive' },
    { label: 'Rent', value: -values.rent, tone: 'negative' },
    { label: 'Fuel', value: -values.fuel, tone: 'negative' },
    { label: 'Dues', value: values.due, tone: values.due >= 0 ? 'positive' : 'negative' },
    { label: 'Weekly Wallet', value: values.wallet, tone: values.wallet >= 0 ? 'positive' : 'negative' },
    { label: 'Direct Payouts', value: -values.payout, tone: 'negative' },
    { label: 'Expenses', value: -values.expenses, tone: 'negative' }
  ];

  const heading = title || (metric === 'netPayout' ? 'Net Payout Calculation' : 'Net Balance Calculation');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70 backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">{heading}</p>
            <p className="text-xs text-slate-500 font-semibold">Collections - Rent - Fuel + Dues + Wallet - Payouts - Expenses</p>
          </div>
          <button
            className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            onClick={onClose}
            aria-label="Close calculation popup"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {sourceNote && <p className="text-[11px] text-slate-500 font-semibold leading-snug">{sourceNote}</p>}

          <div className="grid grid-cols-1 gap-2">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-100 bg-slate-50"
              >
                <span className="text-sm font-semibold text-slate-600">{row.label}</span>
                <span
                  className={`text-sm font-bold ${
                    row.tone === 'positive' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {row.value >= 0 ? '+' : '-'}{formatCurrency(Math.abs(row.value))}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-indigo-50 border border-indigo-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">
                {metric === 'netPayout' ? 'Net Payout' : 'Net Balance'}
              </p>
              <p className="text-[11px] text-slate-500 font-semibold">After applying all components</p>
            </div>
            <p
              className={`text-xl font-black ${netValue >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
            >
              {formatCurrency(netValue)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetCalculationPopup;
