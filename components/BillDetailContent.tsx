import React from 'react';
type LabeledDueRow = { label: string; amount: number };
type WeeklyDetails = { earnings?: number; refund?: number; diff?: number; charges?: number; cash?: number };

export type BillDetailData = {
  id: string;
  driverId?: string;
  driverName?: string;
  driver?: string;
  qrCode?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  daysWorked?: number;
  trips?: number;
  rentPerDay?: number;
  rentTotal?: number;
  collection?: number;
  due?: number;
  fuel?: number;
  wallet?: number;
  walletOverdue?: number;
  adjustments?: number;
  payout?: number;
  status?: 'Pending' | 'Paid' | 'Finalized' | string;
  generatedAt?: string;
  weekRange?: string;
  overdue?: number;
  expenses?: number;
  labeledDueRows?: LabeledDueRow[];
  weeklyDetails?: WeeklyDetails | null;
  deposit?: number;
};

const formatCurrency = (value?: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
}).format(Number(value) || 0);

const formatWeekRange = (bill: BillDetailData) => {
  if (bill.weekRange) return bill.weekRange;
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };
  return `${formatDate(bill.weekStartDate)} to ${formatDate(bill.weekEndDate)}`;
};

const BillDetailContent: React.FC<{ bill: BillDetailData; generatedDateOverride?: string }> = ({ bill, generatedDateOverride }) => {
  const driverName = bill.driverName || bill.driver || 'Driver';
  const previousDue = bill.overdue ?? bill.due ?? 0;
  const weeklyDetails = bill.weeklyDetails || {};
  const cashWarningAmount = (Number(weeklyDetails.cash || 0) - Number(bill.collection || 0));

  return (
    <>
      <div className="text-center">
        <h2 className="text-3xl font-extrabold text-indigo-700 uppercase tracking-tight">Encho Cabs</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">A Unit of Encho Enterprises</p>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 flex flex-col md:flex-row justify-between gap-4 text-xs">
        <div className="space-y-1.5">
          <p className="text-slate-500 uppercase font-bold text-[10px]">Driver Name</p>
          <p className="text-slate-900 font-bold text-base">{driverName}</p>
          <p className="text-slate-500">Vehicle QR: <strong className="text-slate-700">{bill.qrCode || '-'}</strong></p>
        </div>
        <div className="md:text-right space-y-1.5 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-5">
          <p className="text-slate-500 uppercase font-bold text-[10px]">Billing Period</p>
          <p className="text-slate-900 font-bold">{formatWeekRange(bill)}</p>
          <p className="text-slate-500">Generated: <strong className="text-slate-700">{new Date(generatedDateOverride || bill.generatedAt || Date.now()).toLocaleDateString('en-IN')}</strong></p>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 border-b-2 border-slate-100 pb-2">Payment Statement</h4>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-600 font-medium">Total Trips Completed</span><span className="font-bold text-slate-800">{Number(bill.trips || 0)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600 font-medium">Rent / Day (Applied)</span><span className="font-bold text-slate-800">{formatCurrency(bill.rentPerDay)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600 font-medium">Days Worked</span><span className="font-bold text-slate-800">{bill.daysWorked || 0}</span></div>
          <div className="flex justify-between"><span className="text-slate-600 font-medium">Weekly Rent Deduction</span><span className="font-bold text-rose-600">- {formatCurrency(bill.rentTotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600 font-medium">Fuel Advances</span><span className="font-bold text-rose-600">- {formatCurrency(bill.fuel)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600 font-medium">Shared Expenses</span><span className="font-bold text-rose-600">- {formatCurrency(bill.expenses || 0)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600 font-medium">Wallet Earnings (Weekly)</span><span className="font-bold text-emerald-600">+ {formatCurrency(bill.wallet)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600 font-medium">Rental Collection</span><span className="font-bold text-emerald-600">+ {formatCurrency(bill.collection)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600 font-medium">Previous Dues/Credit</span><span className="font-bold text-slate-800">{formatCurrency(previousDue)}</span></div>
          {(Number(bill.deposit || 0) > 0) && (
            <div className="flex justify-between"><span className="text-slate-600 font-medium">Deposit</span><span className="font-bold text-slate-800">- {formatCurrency(bill.deposit)}</span></div>
          )}
          {Array.isArray(bill.labeledDueRows) && bill.labeledDueRows.map((item) => (
            <div key={`bill-due-${item.label}`} className="flex justify-between">
              <span className="text-slate-600 font-medium">{item.label}</span>
              <span className="font-bold text-slate-800">{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>
        {cashWarningAmount > 0 && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700">⚠ Cash Collection Warning</p>
            <p className="text-[11px] text-rose-600 mt-1 font-semibold">Cash collected by driver = Cash (Wallet) - Rental Collection</p>
            <p className="text-xl font-black text-rose-700 mt-2">{formatCurrency(cashWarningAmount)}</p>
          </div>
        )}
        <div className="mt-6 bg-slate-100 p-4 rounded-xl flex justify-between items-center border-l-4 border-slate-800">
          <span className="text-sm font-bold text-slate-700 uppercase">Week Payout</span>
          <span className="text-2xl font-black text-slate-900">{formatCurrency(bill.payout)}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Weekly Wallet Breakdown</h4>
        <div className="grid grid-cols-2 gap-y-3 text-xs">
          <div className="text-slate-500 font-medium">Gross Earnings</div><div className="text-right font-bold text-slate-800">{formatCurrency(weeklyDetails.earnings)}</div>
          <div className="text-slate-500 font-medium">Refunds</div><div className="text-right font-bold text-slate-800">{formatCurrency(weeklyDetails.refund)}</div>
          <div className="text-slate-500 font-medium">Deductions</div><div className="text-right font-bold text-rose-600">-{formatCurrency(weeklyDetails.diff)}</div>
          <div className="text-slate-500 font-medium">Charges</div><div className="text-right font-bold text-rose-600">-{formatCurrency(weeklyDetails.charges)}</div>
          <div className="text-slate-500 font-medium">Cash (Wallet)</div><div className="text-right font-bold text-rose-600">-{formatCurrency(weeklyDetails.cash)}</div>
          <div className="col-span-2 h-px bg-slate-100 my-1"></div>
          <div className="text-indigo-600 font-bold">Wallet Total</div><div className="text-right font-bold text-indigo-600">{formatCurrency(bill.wallet)}</div>
        </div>
      </div>

      <div className="text-center text-[10px] text-slate-400 font-medium pt-4 border-t border-slate-100">
        System Generated Bill • Encho Cabs
      </div>
    </>
  );
};

export default BillDetailContent;
