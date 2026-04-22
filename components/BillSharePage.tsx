import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, FileImage, FileText, Loader2 } from 'lucide-react';
import { storageService } from '../services/storageService';
import { DriverBillingRecord } from '../types';

const BillSharePage: React.FC = () => {
  const { billId } = useParams();
  const [bill, setBill] = useState<DriverBillingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'image' | 'pdf' | null>(null);
  const billRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadBill = async () => {
      if (!billId) {
        setLoading(false);
        return;
      }

      try {
        const bills = await storageService.getDriverBillings();
        const targetBill = bills.find((entry) => entry.id === billId) || null;
        setBill(targetBill);
      } catch (error) {
        console.error('Failed to load bill for sharing:', error);
        setBill(null);
      } finally {
        setLoading(false);
      }
    };

    loadBill();
  }, [billId]);

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

    return `${formatDate(bill.weekStartDate)} to ${formatDate(bill.weekEndDate)}`;
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
      link.download = `Bill_${bill.driverName}_${bill.id.slice(0, 6)}.png`;
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
            <h1 className="text-lg font-bold text-slate-900">{bill.driverName}</h1>
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
            <div><p className="text-slate-500">Driver</p><p className="font-semibold text-slate-900">{bill.driverName}</p></div>
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
              { label: 'Due', value: formatCurrency(bill.due) },
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
        </div>
      </div>
    </div>
  );
};

export default BillSharePage;
