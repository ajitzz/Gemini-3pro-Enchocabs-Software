import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  UploadCloud,
  Database,
  Edit3,
  FileSpreadsheet,
  Filter,
  Loader2,
  NotebookPen,
  Plus,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { LeadRecord, LeadSheet, LeadStatus, LeadUpdate } from '../types';
import { useAuth } from '../contexts/AuthContext';

declare const XLSX: any;

const DEFAULT_STATUSES: LeadStatus[] = [
  { id: 'interested', label: 'Interested', color: 'emerald' },
  { id: 'waiting', label: 'Waiting', color: 'amber' },
  { id: 'confirmed', label: 'Confirmed', color: 'indigo' },
  { id: 'not-interested', label: 'Not Interested', color: 'rose' }
];

const STORAGE_KEY = 'driver-tracker:lead-sheets';

const colorMap: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  rose: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  slate: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
};

const normalizeDate = (value?: string | number | Date) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const date = new Date(str);
  return isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
};

const DriverLeadsPage: React.FC = () => {
  const { user } = useAuth();
  const [sheets, setSheets] = useState<LeadSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>('');
  const [sheetForm, setSheetForm] = useState({ name: '', description: '' });
  const [leadForm, setLeadForm] = useState({
    platform: 'Organic',
    fullName: '',
    phone: '',
    city: '',
    statusId: DEFAULT_STATUSES[0].id,
    admin: '',
    note: '',
    createdTime: new Date().toISOString().slice(0, 10)
  });
  const [statusDraft, setStatusDraft] = useState('');
  const [filterText, setFilterText] = useState('');
  const [isXLSXReady, setIsXLSXReady] = useState<boolean>(typeof XLSX !== 'undefined');
  const [importing, setImporting] = useState(false);
  const [updateEditor, setUpdateEditor] = useState<{ leadId: string; text: string; date: string } | null>(null);

  const activeSheet = useMemo(() => {
    if (!sheets.length) return undefined;
    return sheets.find((s) => s.id === activeSheetId) || sheets[0];
  }, [activeSheetId, sheets]);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      const parsed: LeadSheet[] = JSON.parse(saved);
      setSheets(parsed);
      setActiveSheetId(parsed[0]?.id || '');
      return;
    }

    const seedSheet: LeadSheet = {
      id: uuidv4(),
      name: 'Launch Campaign',
      description: 'Track all onboarding leads in one place. Import XLS/CSV or add manually.',
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'Admin',
      statuses: DEFAULT_STATUSES,
      leads: [
        {
          id: uuidv4(),
          sheetId: '',
          createdTime: new Date().toISOString().slice(0, 10),
          platform: 'WhatsApp',
          fullName: 'Alex Rider',
          phone: '+91 90000 12345',
          city: 'Chennai',
          statusId: 'waiting',
          admin: user?.name || 'Lead Admin',
          note: 'Requested plan comparison',
          updates: [
            { id: uuidv4(), text: 'Shared welcome kit', date: new Date().toISOString().slice(0, 10), author: user?.name || 'Admin' }
          ]
        }
      ]
    };
    seedSheet.leads = seedSheet.leads.map((lead) => ({ ...lead, sheetId: seedSheet.id }));
    setSheets([seedSheet]);
    setActiveSheetId(seedSheet.id);
  }, [user?.name]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sheets.length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets));
  }, [sheets]);

  useEffect(() => {
    if (typeof XLSX !== 'undefined') {
      setIsXLSXReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.async = true;
    script.onload = () => setIsXLSXReady(true);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const updateSheet = (sheetId: string, updater: (sheet: LeadSheet) => LeadSheet) => {
    setSheets((prev) => prev.map((s) => (s.id === sheetId ? updater(s) : s)));
  };

  const createSheet = () => {
    if (!sheetForm.name.trim()) return;
    const newSheet: LeadSheet = {
      id: uuidv4(),
      name: sheetForm.name.trim(),
      description: sheetForm.description.trim(),
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'Admin',
      statuses: DEFAULT_STATUSES,
      leads: []
    };
    setSheets((prev) => [newSheet, ...prev]);
    setActiveSheetId(newSheet.id);
    setSheetForm({ name: '', description: '' });
    setLeadForm((prev) => ({ ...prev, statusId: DEFAULT_STATUSES[0].id }));
  };

  const deleteSheet = (sheetId: string) => {
    const filtered = sheets.filter((s) => s.id !== sheetId);
    setSheets(filtered);
    if (activeSheetId === sheetId && filtered.length) {
      setActiveSheetId(filtered[0].id);
    }
  };

  const addStatus = () => {
    if (!activeSheet) return;
    if (!statusDraft.trim()) return;
    const newStatus: LeadStatus = {
      id: uuidv4(),
      label: statusDraft.trim(),
      color: 'slate'
    };
    updateSheet(activeSheet.id, (sheet) => ({ ...sheet, statuses: [...sheet.statuses, newStatus] }));
    setStatusDraft('');
  };

  const updateStatusLabel = (statusId: string, label: string) => {
    if (!activeSheet) return;
    updateSheet(activeSheet.id, (sheet) => ({
      ...sheet,
      statuses: sheet.statuses.map((status) => (status.id === statusId ? { ...status, label } : status))
    }));
  };

  const removeStatus = (statusId: string) => {
    if (!activeSheet) return;
    updateSheet(activeSheet.id, (sheet) => {
      const remaining = sheet.statuses.filter((s) => s.id !== statusId);
      const fallbackStatus = remaining[0]?.id || DEFAULT_STATUSES[0].id;
      const leads = sheet.leads.map((lead) => (lead.statusId === statusId ? { ...lead, statusId: fallbackStatus } : lead));
      return { ...sheet, statuses: remaining, leads };
    });
  };

  const addLead = () => {
    if (!activeSheet || !leadForm.fullName.trim()) return;
    const lead: LeadRecord = {
      id: uuidv4(),
      sheetId: activeSheet.id,
      createdTime: normalizeDate(leadForm.createdTime),
      platform: leadForm.platform.trim() || 'Organic',
      fullName: leadForm.fullName.trim(),
      phone: leadForm.phone.trim(),
      city: leadForm.city.trim(),
      statusId: leadForm.statusId,
      admin: leadForm.admin.trim() || user?.name || 'Admin',
      note: leadForm.note.trim(),
      updates: leadForm.note
        ? [
            {
              id: uuidv4(),
              text: leadForm.note,
              date: normalizeDate(leadForm.createdTime),
              author: user?.name || 'Admin'
            }
          ]
        : []
    };
    updateSheet(activeSheet.id, (sheet) => ({ ...sheet, leads: [lead, ...sheet.leads] }));
    setLeadForm({
      platform: 'Organic',
      fullName: '',
      phone: '',
      city: '',
      statusId: activeSheet.statuses[0]?.id || DEFAULT_STATUSES[0].id,
      admin: user?.name || '',
      note: '',
      createdTime: new Date().toISOString().slice(0, 10)
    });
  };

  const deleteLead = (leadId: string) => {
    if (!activeSheet) return;
    updateSheet(activeSheet.id, (sheet) => ({ ...sheet, leads: sheet.leads.filter((lead) => lead.id !== leadId) }));
  };

  const addLeadUpdate = () => {
    if (!activeSheet || !updateEditor) return;
    updateSheet(activeSheet.id, (sheet) => ({
      ...sheet,
      leads: sheet.leads.map((lead) => {
        if (lead.id !== updateEditor.leadId) return lead;
        const update: LeadUpdate = {
          id: uuidv4(),
          text: updateEditor.text.trim(),
          date: normalizeDate(updateEditor.date),
          author: user?.name || 'Admin'
        };
        return { ...lead, updates: [update, ...lead.updates] };
      })
    }));
    setUpdateEditor(null);
  };

  const mapStatus = (sheet: LeadSheet, statusId: string) => sheet.statuses.find((s) => s.id === statusId);

  const filteredLeads = useMemo(() => {
    if (!activeSheet) return [] as LeadRecord[];
    if (!filterText.trim()) return activeSheet.leads;
    const term = filterText.toLowerCase();
    return activeSheet.leads.filter(
      (lead) =>
        lead.fullName.toLowerCase().includes(term) ||
        lead.phone.toLowerCase().includes(term) ||
        lead.city.toLowerCase().includes(term) ||
        mapStatus(activeSheet, lead.statusId)?.label.toLowerCase().includes(term)
    );
  }, [activeSheet, filterText]);

  const parseCSV = (content: string) => {
    const rows = content.split(/\r?\n/).filter(Boolean);
    if (rows.length < 2) return [] as LeadRecord[];
    const headers = rows[0].split(',').map((h) => h.trim().toLowerCase());
    const records: LeadRecord[] = [];
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i].split(',');
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] ? values[idx].trim() : '';
      });
      records.push(normalizeImportedRow(row));
    }
    return records;
  };

  const normalizeImportedRow = (row: Record<string, any>): LeadRecord => {
    const get = (...keys: string[]) => {
      for (const key of keys) {
        if (row[key] !== undefined) return row[key];
      }
      return '';
    };

    const statusLabel = String(get('status', 'lead_status', 'state')).trim();
    const createdDate = normalizeDate(get('created_time', 'created', 'date'));
    const note = String(get('note', 'notes', 'update')).trim();

    const statusMatch = activeSheet?.statuses.find((s) => s.label.toLowerCase() === statusLabel.toLowerCase());
    const statusId = statusMatch ? statusMatch.id : activeSheet?.statuses[0]?.id || DEFAULT_STATUSES[0].id;

    const lead: LeadRecord = {
      id: uuidv4(),
      sheetId: activeSheet?.id || '',
      createdTime: createdDate,
      platform: String(get('platform', 'source', 'channel')).trim() || 'Imported',
      fullName: String(get('full_name', 'name', 'lead_name')).trim() || 'Unnamed Lead',
      phone: String(get('phone', 'contact', 'mobile')).trim(),
      city: String(get('city', 'location')).trim(),
      statusId,
      admin: String(get('admin', 'owner', 'handler')).trim() || user?.name || 'Admin',
      note,
      updates: note
        ? [
            {
              id: uuidv4(),
              text: note,
              date: createdDate,
              author: user?.name || 'Admin'
            }
          ]
        : []
    };

    const updateText = String(get('update', 'latest_update')).trim();
    if (updateText) {
      lead.updates = [
        { id: uuidv4(), text: updateText, date: createdDate, author: user?.name || 'Admin' },
        ...lead.updates
      ];
    }

    return lead;
  };

  const importFile = async (file: File) => {
    if (!activeSheet) return;
    setImporting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'csv') {
        const text = await file.text();
        const leads = parseCSV(text);
        updateSheet(activeSheet.id, (sheet) => ({ ...sheet, leads: [...leads, ...sheet.leads] }));
      } else if (isXLSXReady) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { raw: true });
        const leads = rows.map((r: Record<string, any>) => normalizeImportedRow(
          Object.fromEntries(Object.entries(r).map(([key, value]) => [String(key).toLowerCase(), value]))
        ));
        updateSheet(activeSheet.id, (sheet) => ({ ...sheet, leads: [...leads, ...sheet.leads] }));
      }
    } finally {
      setImporting(false);
    }
  };

  const latestUpdate = (lead: LeadRecord) => lead.updates[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 font-semibold">Driver Lead Workspace</p>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Sheets to organise leads</h1>
              <p className="text-slate-500 mt-1">Create sheets, import XLS/CSV, and keep updates with dated history.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={createSheet}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl shadow hover:bg-indigo-700 transition disabled:opacity-50"
                disabled={!sheetForm.name.trim()}
              >
                <Plus size={16} /> New Sheet
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 font-semibold mb-3">
                <ClipboardList size={16} /> New sheet details
              </div>
              <input
                value={sheetForm.name}
                onChange={(e) => setSheetForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Sheet title (e.g., Feb WhatsApp Leads)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <textarea
                value={sheetForm.description}
                onChange={(e) => setSheetForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Short description"
                className="w-full mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                rows={2}
              />
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 font-semibold mb-3">
                <Database size={16} /> Quick import / download
              </div>
              <label className="w-full flex items-center justify-between gap-3 rounded-lg border-2 border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500 cursor-pointer hover:border-indigo-200 hover:bg-indigo-50">
                <div className="flex items-center gap-2">
                  {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  <span>{importing ? 'Importing...' : 'Import XLSX / CSV into active sheet'}</span>
                </div>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
              </label>
              <p className="text-xs text-slate-400 mt-2">Headers supported: created_time, platform, full_name, phone, city, status, admin, update, note</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-xl">
              <UploadCloud size={22} />
            </div>
            <div>
              <p className="text-sm text-slate-300">Database schema</p>
              <p className="font-semibold">Copy & deploy</p>
            </div>
          </div>
          <div className="mt-4 bg-black/20 rounded-xl p-4 text-xs font-mono leading-relaxed">
            CREATE TABLE lead_sheets (...)
            <br />CREATE TABLE lead_statuses (...)
            <br />CREATE TABLE driver_leads (...)
            <br />CREATE TABLE lead_updates (...)
          </div>
          <p className="text-[11px] text-slate-400 mt-3">Full SQL available in <span className="font-semibold">server/lead_management_schema.sql</span>.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Sheets</h3>
              <CalendarDays size={16} className="text-slate-400" />
            </div>
            <div className="mt-3 space-y-2 max-h-[340px] overflow-auto pr-1">
              {sheets.map((sheet) => (
                <button
                  key={sheet.id}
                  onClick={() => setActiveSheetId(sheet.id)}
                  className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-1 ${
                    activeSheet?.id === sheet.id
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-900 shadow-sm'
                      : 'border-slate-200 hover:border-indigo-100'
                  }`}
                >
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{sheet.name}</span>
                    <span className="text-[11px] text-slate-500">{sheet.leads.length} leads</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{sheet.description || 'No description added'}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <Clock size={12} /> {new Date(sheet.createdAt).toLocaleDateString()}
                    <span>•</span>
                    {sheet.createdBy || 'Admin'}
                  </div>
                  {sheets.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSheet(sheet.id);
                      }}
                      className="text-[11px] text-rose-500 hover:text-rose-600 flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Delete sheet
                    </button>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
              <span>Statuses</span>
              <NotebookPen size={16} className="text-slate-400" />
            </div>
            <div className="flex gap-2">
              <input
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value)}
                placeholder="Add status"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                onClick={addStatus}
                className="px-3 rounded-lg bg-slate-900 text-white text-sm hover:bg-indigo-700"
              >
                Add
              </button>
            </div>
            <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
              {activeSheet?.statuses.map((status) => (
                <div key={status.id} className="flex items-center gap-2 group">
                  <div
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${colorMap[status.color || 'slate']}`}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateStatusLabel(status.id, e.currentTarget.textContent || status.label)}
                  >
                    {status.label}
                  </div>
                  {activeSheet.statuses.length > 1 && (
                    <button
                      onClick={() => removeStatus(status.id)}
                      className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs text-slate-500">Active sheet</p>
                <h3 className="text-xl font-semibold text-slate-900">{activeSheet?.name || 'No sheet selected'}</h3>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 w-full md:w-64">
                  <Filter size={14} />
                  <input
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Search name, city, status"
                    className="flex-1 bg-transparent outline-none"
                  />
                </div>
                <label className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 cursor-pointer hover:border-indigo-200">
                  <FileSpreadsheet size={14} />
                  <span>Import</span>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
                </label>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
              <input
                value={leadForm.fullName}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, fullName: e.target.value }))}
                placeholder="Full name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={leadForm.phone}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={leadForm.city}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="City"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={leadForm.platform}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, platform: e.target.value }))}
                placeholder="Platform"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={leadForm.statusId}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, statusId: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {activeSheet?.statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={leadForm.createdTime}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, createdTime: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={leadForm.admin}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, admin: e.target.value }))}
                placeholder="Admin"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={leadForm.note}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Note / Update"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                onClick={addLead}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold px-3 py-2 hover:bg-indigo-700"
              >
                <Plus size={14} /> Add lead
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-[12px] text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Platform</th>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Admin</th>
                    <th className="px-4 py-3">Update</th>
                    <th className="px-4 py-3">Note</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={10}>
                        No leads yet. Add manually or import a file.
                      </td>
                    </tr>
                  )}
                  {filteredLeads.map((lead) => {
                    const status = activeSheet ? mapStatus(activeSheet, lead.statusId) : undefined;
                    const update = latestUpdate(lead);
                    return (
                      <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-slate-700 text-xs">{lead.createdTime}</td>
                        <td className="px-4 py-3 text-slate-800 font-medium">{lead.platform}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{lead.fullName}</div>
                          <div className="text-xs text-slate-500">{lead.city}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{lead.phone || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{lead.city || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colorMap[status?.color || 'slate']}`}>
                            {status?.label || 'Unmapped'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{lead.admin || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {update ? (
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <CalendarDays size={14} className="text-slate-400" />
                              <span className="font-semibold text-slate-800">{update.date}</span>
                              <span className="text-slate-500">{update.text}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">No updates</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700 max-w-xs">
                          <div className="line-clamp-2 text-sm">{lead.note || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                setUpdateEditor({
                                  leadId: lead.id,
                                  text: lead.note || '',
                                  date: new Date().toISOString().slice(0, 10)
                                })
                              }
                              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
                              title="Add dated update"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => deleteLead(lead.id)}
                              className="p-2 rounded-lg border border-slate-200 text-rose-500 hover:border-rose-200"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {updateEditor && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <Edit3 size={18} />
                Add update
              </div>
              <button onClick={() => setUpdateEditor(null)} className="text-slate-500 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="date"
                value={updateEditor.date}
                onChange={(e) => setUpdateEditor((prev) => (prev ? { ...prev, date: e.target.value } : prev))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <textarea
                value={updateEditor.text}
                onChange={(e) => setUpdateEditor((prev) => (prev ? { ...prev, text: e.target.value } : prev))}
                placeholder="What changed?"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={4}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setUpdateEditor(null)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={addLeadUpdate}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                  disabled={!updateEditor.text.trim()}
                >
                  <Check size={16} className="inline-block mr-1" /> Save update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverLeadsPage;
