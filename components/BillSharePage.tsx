import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Download, FileImage, FileText, Loader2 } from 'lucide-react';
import { storageService } from '../services/storageService';
import { DriverBillingRecord } from '../types';

const BillSharePage: React.FC = () => {
  const { billId } = useParams();
  const location = useLocation();
  const [bill, setBill] = useState<DriverBillingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'image' | 'pdf' | null>(null);
  const billRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadBill = async () => {
      const query = new URLSearchParams(location.search);
      const encodedPayload = query.get('payload');

      if (encodedPayload) {
        try {
          const decoded = JSON.parse(decodeURIComponent(encodedPayload));
          setBill(decoded as DriverBillingRecord);
        } catch (error) {
          console.error('Failed to decode bill payload:', error);
        }
      }

      if (!billId) {
        setLoading(false);
        return;
      }

      try {
        const bills = await storageService.getDriverBillings();
        const targetBill = bills.find((entry) => entry.id === billId) || null;
        if (targetBill) {
          setBill(targetBill);
        }
      } catch (error) {
        console.error('Failed to load bill for sharing:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBill();
  }, [billId, location.search]);

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

  const createImageBlobFromElement = async () => {
    if (!billRef.current) return null;

    const element = billRef.current;
    const { width, height } = element.getBoundingClientRect();
    const clonedNode = element.cloneNode(true) as HTMLElement;
    clonedNode.style.margin = '0';

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">${clonedNode.outerHTML}</div>
        </foreignObject>
      </svg>
    `;

    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = svgUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(width * 2);
      canvas.height = Math.ceil(height * 2);
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.scale(2, 2);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  };

  const downloadImage = async () => {
    if (!bill) return;
    setDownloading('image');
    try {
      const imageBlob = await createImageBlobFromElement();
      if (!imageBlob) return;
      const imageUrl = URL.createObjectURL(imageBlob);
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `Bill_${((bill as any).driverName || (bill as any).driver || 'Driver')}_${bill.id.slice(0, 6)}.png`;
      link.click();
      URL.revokeObjectURL(imageUrl);
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
              onClick={downloadImage}
              disabled={downloading !== null}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
            >
              <FileImage size={16} /> {downloading === 'image' ? 'Preparing...' : 'Download Image'}
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

        <div ref={billRef} className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 print:rounded-none print:border-none">
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-indigo-600 font-semibold">Encho Cabs</p>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">Payment Statement</h2>
            </div>
            <FileText className="text-indigo-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-sm">
            <div><p className="text-slate-500">Driver</p><p className="font-semibold text-slate-900">{(bill as any).driverName || (bill as any).driver || 'Driver'}</p></div>
            <div><p className="text-slate-500">Vehicle QR</p><p className="font-semibold text-slate-900">{bill.qrCode || '-'}</p></div>
            <div><p className="text-slate-500">Week</p><p className="font-semibold text-slate-900">{weekRange}</p></div>
            <div><p className="text-slate-500">Status</p><p className="font-semibold text-slate-900 uppercase">{bill.status || 'generated'}</p></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6 text-sm">
            {[{ label: 'Trips', value: String(bill.trips || 0) },
              { label: 'Rent / Day', value: formatCurrency(bill.rentPerDay) },
              { label: 'Days Worked', value: String(bill.daysWorked || 0) },
              { label: 'Rent Total', value: `- ${formatCurrency(bill.rentTotal)}` },
              { label: 'Collection', value: `+ ${formatCurrency(bill.collection)}` },
              { label: 'Fuel', value: `- ${formatCurrency(bill.fuel)}` },
              { label: 'Wallet', value: `+ ${formatCurrency(bill.wallet)}` },
              { label: 'Due', value: formatCurrency((bill as any).due ?? (bill as any).overdue ?? 0) },
              { label: 'Wallet Overdue', value: formatCurrency(bill.walletOverdue) }].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="font-semibold text-slate-900 mt-1">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-slate-900 rounded-xl p-4 text-white flex justify-between items-center">
            <p className="text-sm uppercase tracking-wide">Net payout</p>
            <p className="text-xl font-bold">{formatCurrency(bill.payout)}</p>
          </div>

          {Array.isArray((bill as any).labeledDueRows) && (bill as any).labeledDueRows.length > 0 && (
            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Due Labels</p>
              <div className="space-y-2">
                {(bill as any).labeledDueRows.map((item: { label: string; amount: number }) => (
                  <div key={`due-${item.label}`} className="flex justify-between text-sm">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray((bill as any).dailyDetails) && (bill as any).dailyDetails.length > 0 && (
            <div className="mt-6 rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Daily Activity</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-right px-3 py-2">Collection</th>
                      <th className="text-right px-3 py-2">Rent</th>
                      <th className="text-right px-3 py-2">Fuel</th>
                      <th className="text-right px-3 py-2">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bill as any).dailyDetails.map((item: any, idx: number) => (
                      <tr key={`${item.id || item.date || idx}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">{item.date || '-'}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.collection)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.rent)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.fuel)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.due ?? item.adjustedDue ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillSharePage;
