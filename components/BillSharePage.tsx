import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Download, FileCode2, Loader2 } from 'lucide-react';
import { storageService } from '../services/storageService';
import BillDetailContent, { BillDetailData } from './BillDetailContent';
import { asBillDetailData } from '../lib/driverBilling';

const BillSharePage: React.FC = () => {
  const { billId, shareToken } = useParams();
  const location = useLocation();
  const [bill, setBill] = useState<BillDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'html' | 'pdf' | null>(null);
  const billRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const decodePayload = (encodedPayload: string): BillDetailData | null => {
      try {
        const decoded = JSON.parse(decodeURIComponent(encodedPayload));
        return asBillDetailData(decoded);
      } catch (error) {
        console.error('Failed to decode legacy bill payload:', error);
        return null;
      }
    };

    const decodeCompactPayload = (compactPayload: string): BillDetailData | null => {
      try {
        const normalized = compactPayload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
        const binary = atob(padded);
        const percentEncoded = Array.from(binary)
          .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join('');
        const decodedJson = decodeURIComponent(percentEncoded);
        return asBillDetailData(JSON.parse(decodedJson));
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
            setBill(asBillDetailData(billFromShareToken));
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
          setBill(asBillDetailData(remoteBill));
        }
      } catch (error) {
        console.error('Failed to load bill for sharing:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBill();
  }, [billId, shareToken, location.search]);

  const downloadHtml = () => {
    if (!billRef.current || !bill) return;
    setDownloading('html');
    try {
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Bill ${bill.id}</title><style>body{font-family:Inter,Arial,sans-serif;background:#fff;margin:0;padding:24px;color:#0f172a}.wrap{max-width:900px;margin:0 auto}</style></head><body><div class="wrap">${billRef.current.innerHTML}</div></body></html>`;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bill_${(bill.driverName || bill.driver || 'Driver')}_${bill.id.slice(0, 6)}.html`;
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
            <h1 className="text-lg font-bold text-slate-900">{bill.driverName || bill.driver || 'Driver'}</h1>
            <p className="text-sm text-slate-500">{bill.weekRange || `${bill.weekStartDate} to ${bill.weekEndDate}`}</p>
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
          <BillDetailContent bill={bill} />
        </div>
      </div>
    </div>
  );
};

export default BillSharePage;
