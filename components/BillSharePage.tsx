import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Download, FileCode2, FileText, Loader2 } from 'lucide-react';
import { storageService } from '../services/storageService';
import { DriverBillingRecord } from '../types';

const BillSharePage: React.FC = () => {
  const { billId, shareToken } = useParams();
  const location = useLocation();
  const [bill, setBill] = useState<DriverBillingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'html' | 'pdf' | null>(null);
  const billRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const decodePayload = (encodedPayload: string): DriverBillingRecord | null => {
      try {
        const decoded = JSON.parse(decodeURIComponent(encodedPayload));
        return decoded as DriverBillingRecord;
      } catch (error) {
        console.error('Failed to decode legacy bill payload:', error);
        return null;
      }
    };

    const decodeCompactPayload = (compactPayload: string): DriverBillingRecord | null => {
      try {
        const normalized = compactPayload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
        const binary = atob(padded);
        const percentEncoded = Array.from(binary)
          .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join('');
        const decodedJson = decodeURIComponent(percentEncoded);
        return JSON.parse(decodedJson) as DriverBillingRecord;
      } catch (error) {
        console.error('Failed to decode compact bill payload:', error);
        return null;
      }
    };

    const loadBill = async () => {
      const query = new URLSearchParams(location.search);
      const encodedPayload = query.get('payload');
      const compactPayload = query.get('p');
      const payloadBill = compactPayload
        ? decodeCompactPayload(compactPayload)
        : (encodedPayload ? decodePayload(encodedPayload) : null);

      if (shareToken) {
        try {
          const billFromShareToken = await storageService.getDriverBillingByShareToken(shareToken);
          if (billFromShareToken) {
            setBill(billFromShareToken);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error('Failed to load bill from share token:', error);
        }
      }

      if (payloadBill) {
        setBill(payloadBill);
        setLoading(false);
        return;
      }

      if (!billId) {
        setLoading(false);
        return;
      }

      try {
        const remoteBill = await storageService.getDriverBillingById(billId);
        if (remoteBill) {
          setBill(remoteBill);
        }
      } catch (error) {
        console.error('Failed to load bill for sharing:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBill();
  }, [billId, shareToken, location.search]);

  const weekRange = useMemo(() => {
    if (!bill) return '-';
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return '-';
      return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
      });
    };

    if ((bill as any).weekRange) return String((bill as any).weekRange);
    return `${formatDate((bill as any).weekStartDate)} to ${formatDate((bill as any).weekEndDate)}`;
  }, [bill]);

  const formatCurrency = (value?: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  };

  const downloadHtml = () => {
    if (!billRef.current || !bill) return;
    setDownloading('html');
    try {
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Bill ${bill.id}</title><style>body{font-family:Inter,Arial,sans-serif;background:#fff;margin:0;padding:24px;color:#0f172a}.wrap{max-width:900px;margin:0 auto}</style></head><body><div class="wrap">${billRef.current.innerHTML}</div></body></html>`;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bill_${((bill as any).driverName || (bill as any).driver || 'Driver')}_${bill.id.slice(0, 6)}.html`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const downloadPdf = () => {
    setDownloading('pdf');
    try {
      window.print();
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 gap-2">
        <Loader2 className="animate-spin" size={18} /> Loading bill...
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center max-w-md">
          <h1 className="text-lg font-bold text-slate-900">Bill not found</h1>
          <p className="text-sm text-slate-500 mt-2">This bill link is invalid or the bill has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Driver Bill</p>
            <h1 className="text-lg font-bold text-slate-900">{(bill as any).driverName || (bill as any).driver || 'Driver'}</h1>
            <p className="text-sm text-slate-500">{weekRange}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={downloadHtml}
              disabled={downloading !== null}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
            >
              <FileCode2 size={16} /> {downloading === 'html' ? 'Preparing...' : 'Download HTML'}
            </button>
            <button
              onClick={downloadPdf}
              disabled={downloading !== null}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-black disabled:opacity-60"
            >
              <Download size={16} /> Download PDF
            </button>
          </div>
        </div>

        <div ref={billRef} className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 print:rounded-none print:border-none space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-indigo-700 uppercase tracking-tight">Encho Cabs</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">A Unit of Encho Enterprises</p>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 flex flex-col md:flex-row justify-between gap-4 text-xs">
            <div className="space-y-1.5">
              <p className="text-slate-500 uppercase font-bold text-[10px]">Driver Name</p>
              <p className="text-slate-900 font-bold text-base">{(bill as any).driverName || (bill as any).driver || 'Driver'}</p>
              <p className="text-slate-500">Vehicle QR: <strong className="text-slate-700">{bill.qrCode || '-'}</strong></p>
            </div>
            <div className="md:text-right space-y-1.5 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-5">
              <p className="text-slate-500 uppercase font-bold text-[10px]">Billing Period</p>
              <p className="text-slate-900 font-bold">{weekRange}</p>
              <p className="text-slate-500">Generated: <strong className="text-slate-700">{new Date((bill as any).generatedAt || Date.now()).toLocaleDateString('en-IN')}</strong></p>
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
              <div className="flex justify-between"><span className="text-slate-600 font-medium">Shared Expenses</span><span className="font-bold text-rose-600">- {formatCurrency((bill as any).expenses || 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600 font-medium">Wallet Earnings (Weekly)</span><span className="font-bold text-emerald-600">+ {formatCurrency(bill.wallet)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600 font-medium">Rental Collection</span><span className="font-bold text-emerald-600">+ {formatCurrency(bill.collection)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600 font-medium">Previous Dues/Credit</span><span className="font-bold text-slate-800">{formatCurrency((bill as any).overdue ?? (bill as any).due ?? 0)}</span></div>
              {((bill as any).deposit || 0) > 0 && (
                <div className="flex justify-between"><span className="text-slate-600 font-medium">Deposit</span><span className="font-bold text-slate-800">- {formatCurrency((bill as any).deposit)}</span></div>
              )}
              {Array.isArray((bill as any).labeledDueRows) && (bill as any).labeledDueRows.map((item: { label: string; amount: number; }) => (
                <div key={`bill-due-${item.label}`} className="flex justify-between">
                  <span className="text-slate-600 font-medium">{item.label}</span>
                  <span className="font-bold text-slate-800">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
            {((((bill as any).weeklyDetails?.cash || 0) - (bill.collection || 0)) > 0) && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700">⚠ Cash Collection Warning</p>
                <p className="text-[11px] text-rose-600 mt-1 font-semibold">Cash collected by driver = Cash (Wallet) - Rental Collection</p>
                <p className="text-xl font-black text-rose-700 mt-2">
                  {formatCurrency(((bill as any).weeklyDetails?.cash || 0) - (bill.collection || 0))}
                </p>
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
              <div className="text-slate-500 font-medium">Gross Earnings</div><div className="text-right font-bold text-slate-800">{formatCurrency((bill as any).weeklyDetails?.earnings)}</div>
              <div className="text-slate-500 font-medium">Refunds</div><div className="text-right font-bold text-slate-800">{formatCurrency((bill as any).weeklyDetails?.refund)}</div>
              <div className="text-slate-500 font-medium">Deductions</div><div className="text-right font-bold text-rose-600">-{formatCurrency((bill as any).weeklyDetails?.diff)}</div>
              <div className="text-slate-500 font-medium">Charges</div><div className="text-right font-bold text-rose-600">-{formatCurrency((bill as any).weeklyDetails?.charges)}</div>
              <div className="text-slate-500 font-medium">Cash (Wallet)</div><div className="text-right font-bold text-rose-600">-{formatCurrency((bill as any).weeklyDetails?.cash)}</div>
              <div className="col-span-2 h-px bg-slate-100 my-1"></div>
              <div className="text-indigo-600 font-bold">Wallet Total</div><div className="text-right font-bold text-indigo-600">{formatCurrency(bill.wallet)}</div>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-400 font-medium pt-4 border-t border-slate-100">
            System Generated Bill • Encho Cabs
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillSharePage;
