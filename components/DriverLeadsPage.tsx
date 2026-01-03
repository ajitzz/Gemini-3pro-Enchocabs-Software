import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  Clock,
  AlertTriangle,
  Database,
  Edit3,
  FileSpreadsheet,
  Filter,
  Loader2,
  Activity,
  BarChart3,
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<'recent' | 'oldest' | 'status'>('recent');
  const [isXLSXReady, setIsXLSXReady] = useState<boolean>(typeof XLSX !== 'undefined');
  const [importing, setImporting] = useState(false);
  const [updateEditor, setUpdateEditor] = useState<{ leadId: string; text: string; date: string } | null>(null);
  const [isStatusesOpen, setIsStatusesOpen] = useState(false);
  const [sheetToDelete, setSheetToDelete] = useState<LeadSheet | null>(null);
  const [sheetEditor, setSheetEditor] = useState<{ sheetId: string; name: string; description: string } | null>(null);
  const [confirmSheetEdit, setConfirmSheetEdit] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<LeadRecord | null>(null);
  const [sheetAction, setSheetAction] = useState<'clear' | 'delete' | null>(null);
  const [expandedLatestUpdates, setExpandedLatestUpdates] = useState<Set<string>>(new Set());
  const [expandedHistories, setExpandedHistories] = useState<Set<string>>(new Set());
  const [duplicateWarning, setDuplicateWarning] = useState<{
    active: boolean;
    existingId: string;
    payload: LeadRecord;
    remaining: LeadRecord[];
    workingLeads: LeadRecord[];
  } | null>(null);

  const downloadCSV = (headers: string[], rows: (string | number | null | undefined)[][], filename: string) => {
    const escapeCell = (cell: string | number | null | undefined) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
    const csvContent = [headers.join(','), ...rows.map((row) => row.map(escapeCell).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
    if (activeSheetId === sheetId) {
      setActiveSheetId(filtered[0]?.id || '');
    }
  };

  const confirmDeleteSheet = () => {
    if (!sheetToDelete) return;
    if (sheetAction === 'clear') {
      clearSheetLeads(sheetToDelete.id);
    } else {
      deleteSheet(sheetToDelete.id);
    }
    setSheetToDelete(null);
    setSheetAction(null);
  };

  const duplicateSheet = (sheetId: string) => {
    const source = sheets.find((s) => s.id === sheetId);
    if (!source) return;
    const clonedStatuses = source.statuses.map((status) => ({ ...status }));
    const clonedSheetId = uuidv4();
    const clonedLeads = source.leads.map((lead) => ({
      ...lead,
      id: uuidv4(),
      sheetId: clonedSheetId,
      updates: lead.updates.map((update) => ({ ...update, id: uuidv4() }))
    }));
    const copy: LeadSheet = {
      ...source,
      id: clonedSheetId,
      name: `${source.name} (Copy)`,
      createdAt: new Date().toISOString(),
      leads: clonedLeads,
      statuses: clonedStatuses
    };
    setSheets((prev) => [copy, ...prev]);
    setActiveSheetId(copy.id);
  };

  const clearSheetLeads = (sheetId: string) => {
    updateSheet(sheetId, (sheet) => ({ ...sheet, leads: [] }));
  };

  const confirmActiveSheetClear = () => {
    if (!activeSheet) return;
    setSheetAction('clear');
    setSheetToDelete(activeSheet);
  };

  const confirmActiveSheetDelete = () => {
    if (!activeSheet) return;
    setSheetAction('delete');
    setSheetToDelete(activeSheet);
  };

  const saveSheetEdits = () => {
    if (!sheetEditor) return;
    const name = sheetEditor.name.trim();
    const description = sheetEditor.description.trim();
    if (!name) return;
    updateSheet(sheetEditor.sheetId, (sheet) => ({ ...sheet, name, description }));
    setSheetEditor(null);
    setConfirmSheetEdit(false);
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

    const queuedSuccessfully = processLeadQueue([lead]);
    if (queuedSuccessfully) {
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
    }
  };

  const deleteLead = (leadId: string) => {
    if (!activeSheet) return;
    updateSheet(activeSheet.id, (sheet) => ({ ...sheet, leads: sheet.leads.filter((lead) => lead.id !== leadId) }));
  };

  const downloadTemplate = () => {
    const headers = ['created_time', 'platform', 'full_name', 'phone', 'city', 'status', 'admin', 'update', 'note'];
    const rows = [
      ['2024-05-01', 'Organic', 'Sample Lead', '+91 90000 12345', 'Chennai', 'Interested', 'Admin', 'Shared pricing deck', 'Notes stay here']
    ];
    downloadCSV(headers, rows, 'driver-leads-template');
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

  const exportActiveSheet = () => {
    if (!activeSheet) return;
    const headers = ['Created', 'Lead', 'Phone', 'Status', 'Latest Update', 'Last Touch', 'Note'];
    const rows = activeSheet.leads.map((lead) => {
      const statusLabel = mapStatus(activeSheet, lead.statusId)?.label || 'Unknown';
      const update = latestUpdate(lead);
      const touchDate = latestTouch(lead);
      const daysAgo = daysSince(touchDate);
      return [
        `${lead.createdTime} (Platform: ${lead.platform || '—'})`,
        `${lead.fullName}${lead.city ? `, ${lead.city}` : ''}`,
        lead.phone,
        statusLabel,
        update ? `${update.date} - ${update.text}` : '',
        `${touchDate} (${daysAgo === 0 ? 'Today' : `${daysAgo}d ago`})`,
        lead.note
      ];
    });
    const sheetLabel = activeSheet.name.trim().replace(/\s+/g, '-').toLowerCase() || 'leads';
    downloadCSV(headers, rows, `${sheetLabel}-leads`);
  };

  const mapStatus = (sheet: LeadSheet, statusId: string) => sheet.statuses.find((s) => s.id === statusId);

  const latestTouch = (lead: LeadRecord) => lead.updates[0]?.date || lead.createdTime;
  const latestUpdate = (lead: LeadRecord) => lead.updates[0];

  const toggleExpandedLatest = (leadId: string) => {
    setExpandedLatestUpdates((prev) => {
      const next = new Set(prev);
      next.has(leadId) ? next.delete(leadId) : next.add(leadId);
      return next;
    });
  };

  const toggleHistory = (leadId: string) => {
    setExpandedHistories((prev) => {
      const next = new Set(prev);
      next.has(leadId) ? next.delete(leadId) : next.add(leadId);
      return next;
    });
  };

  const updateLeadStatus = (leadId: string, statusId: string) => {
    if (!activeSheet) return;
    updateSheet(activeSheet.id, (sheet) => ({
      ...sheet,
      leads: sheet.leads.map((lead) => (lead.id === leadId ? { ...lead, statusId } : lead))
    }));
  };

  const daysSince = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return Number.isFinite(diff) ? Math.max(diff, 0) : 0;
  };

  const filteredLeads = useMemo(() => {
    if (!activeSheet) return [] as LeadRecord[];
    const term = filterText.toLowerCase();
    const byText = (lead: LeadRecord) =>
      !term ||
      lead.fullName.toLowerCase().includes(term) ||
      lead.phone.toLowerCase().includes(term) ||
      lead.city.toLowerCase().includes(term) ||
      mapStatus(activeSheet, lead.statusId)?.label.toLowerCase().includes(term);

    const byStatus = (lead: LeadRecord) => statusFilter === 'all' || lead.statusId === statusFilter;

    const sorters: Record<typeof sortOption, (a: LeadRecord, b: LeadRecord) => number> = {
      recent: (a, b) => new Date(latestTouch(b)).getTime() - new Date(latestTouch(a)).getTime(),
      oldest: (a, b) => new Date(latestTouch(a)).getTime() - new Date(latestTouch(b)).getTime(),
      status: (a, b) =>
        (mapStatus(activeSheet, a.statusId)?.label || '').localeCompare(
          mapStatus(activeSheet, b.statusId)?.label || ''
        )
    };

    return [...activeSheet.leads].filter((lead) => byText(lead) && byStatus(lead)).sort(sorters[sortOption]);
  }, [activeSheet, filterText, sortOption, statusFilter]);

  const isFiltered = filterText.trim().length > 0 || statusFilter !== 'all' || sortOption !== 'recent';

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
        processLeadQueue(leads);
      } else if (isXLSXReady) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { raw: true });
        const leads = rows.map((r: Record<string, any>) => normalizeImportedRow(
          Object.fromEntries(Object.entries(r).map(([key, value]) => [String(key).toLowerCase(), value]))
        ));
        processLeadQueue(leads);
      }
    } finally {
      setImporting(false);
    }
  };

  const normalizePhone = (phone: string) => phone.replace(/\D+/g, '');

  const findDuplicateLead = (leads: LeadRecord[], candidate: LeadRecord) => {
    const phoneKey = normalizePhone(candidate.phone || '');
    if (phoneKey) {
      const byPhone = leads.find((lead) => normalizePhone(lead.phone || '') === phoneKey);
      if (byPhone) return byPhone;
    }

    const nameKey = candidate.fullName.trim().toLowerCase();
    if (nameKey) {
      const byName = leads.find((lead) => lead.fullName.trim().toLowerCase() === nameKey);
      if (byName) return byName;
    }

    return undefined;
  };

  const processLeadQueue = (queue: LeadRecord[], workingLeads?: LeadRecord[]): boolean => {
    if (!activeSheet || queue.length === 0) return false;

    const currentLeads = workingLeads ?? activeSheet.leads;
    const [candidate, ...rest] = queue;
    const duplicate = findDuplicateLead(currentLeads, candidate);

    if (duplicate) {
      setDuplicateWarning({
        active: true,
        existingId: duplicate.id,
        payload: candidate,
        remaining: rest,
        workingLeads: currentLeads
      });
      return false;
    }

    const nextLeads = [candidate, ...currentLeads];
    updateSheet(activeSheet.id, (sheet) => ({ ...sheet, leads: nextLeads }));

    if (rest.length) {
      return processLeadQueue(rest, nextLeads);
    }

    return true;
  };

  const overrideDuplicateLead = () => {
    if (!duplicateWarning || !activeSheet) return;

    const updatedLead: LeadRecord = {
      ...duplicateWarning.payload,
      id: duplicateWarning.existingId,
      sheetId: activeSheet.id
    };

    const mergedLeads = [
      updatedLead,
      ...duplicateWarning.workingLeads.filter((lead) => lead.id !== duplicateWarning.existingId)
    ];

    updateSheet(activeSheet.id, (sheet) => ({ ...sheet, leads: mergedLeads }));

    const remaining = duplicateWarning.remaining || [];
    setDuplicateWarning(null);

    if (remaining.length) {
      processLeadQueue(remaining, mergedLeads);
    } else {
      setLeadForm((prev) => ({
        ...prev,
        platform: 'Organic',
        fullName: '',
        phone: '',
        city: '',
        note: '',
        statusId: activeSheet.statuses[0]?.id || DEFAULT_STATUSES[0].id,
        createdTime: new Date().toISOString().slice(0, 10),
        admin: user?.name || ''
      }));
    }
  };

  const cancelDuplicateLead = () => {
    if (!duplicateWarning) return;

    const remaining = duplicateWarning.remaining || [];
    const workingLeads = duplicateWarning.workingLeads;
    setDuplicateWarning(null);

    if (remaining.length) {
      processLeadQueue(remaining, workingLeads);
    }
  };

  const leadMetrics = useMemo(() => {
    if (!activeSheet)
      return {
        total: 0,
        stale: 0,
        waiting: 0,
        confirmed: 0,
        withNotes: 0
      };

    const waitingIds = new Set(
      activeSheet.statuses.filter((s) => s.label.toLowerCase().includes('wait')).map((s) => s.id)
    );
    const confirmedIds = new Set(
      activeSheet.statuses.filter((s) => s.label.toLowerCase().includes('confirm')).map((s) => s.id)
    );

    return activeSheet.leads.reduce(
      (acc, lead) => {
        const touch = latestTouch(lead);
        const days = daysSince(touch);
        acc.total += 1;
        if (waitingIds.has(lead.statusId)) acc.waiting += 1;
        if (confirmedIds.has(lead.statusId)) acc.confirmed += 1;
        if (days >= 7) acc.stale += 1;
        if (lead.note?.trim() || lead.updates.length) acc.withNotes += 1;
        return acc;
      },
      { total: 0, stale: 0, waiting: 0, confirmed: 0, withNotes: 0 }
    );
  }, [activeSheet]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[320px,minmax(0,1fr)] gap-4 xl:gap-6 items-start">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 font-semibold">Driver Lead Workspace</p>
              <h1 className="text-xl font-bold text-slate-900">Sheets to organise leads</h1>
              <p className="text-sm text-slate-500">Create sheets, import XLS/CSV, and keep updates with dated history.</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setIsStatusesOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label={isStatusesOpen ? 'Hide statuses manager' : 'Show statuses manager'}
              >
                <NotebookPen size={14} /> Statuses
              </button>
              {isStatusesOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-xl p-3 space-y-3 z-20">
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                    <span>Statuses</span>
                    <button
                      onClick={() => setIsStatusesOpen(false)}
                      className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
                      aria-label="Close statuses manager"
                    >
                      <X size={14} />
                    </button>
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
                  <div className="space-y-2 max-h-[220px] overflow-auto pr-1 text-sm">
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
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between text-[11px] uppercase text-slate-500 font-semibold">Total leads</div>
              <div className="flex items-center gap-2 mt-2 text-xl font-bold text-slate-900">
                <BarChart3 size={16} className="text-indigo-500" />
                {leadMetrics.total}
              </div>
              <p className="text-[12px] text-slate-500 mt-1">Across {activeSheet?.statuses.length || 0} statuses</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between text-[11px] uppercase text-amber-600 font-semibold">Waiting</div>
              <div className="flex items-center gap-2 mt-2 text-xl font-bold text-amber-700">
                <Clock size={16} />
                {leadMetrics.waiting}
              </div>
              <p className="text-[12px] text-amber-700/80">Keep these moving</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between text-[11px] uppercase text-emerald-700 font-semibold">Confirmed</div>
              <div className="flex items-center gap-2 mt-2 text-xl font-bold text-emerald-700">
                <Check size={16} />
                {leadMetrics.confirmed}
              </div>
              <p className="text-[12px] text-emerald-700/80">Ready for onboarding</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center justify-between text-[11px] uppercase text-rose-600 font-semibold">Stale</div>
              <div className="flex items-center gap-2 mt-2 text-xl font-bold text-rose-700">
                <Activity size={16} />
                {leadMetrics.stale}
              </div>
              <p className="text-[12px] text-rose-700/80">No update in 7+ days</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-600 font-semibold">
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
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                rows={2}
              />
              <div className="flex justify-end">
                <button
                  onClick={createSheet}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl shadow hover:bg-indigo-700 transition disabled:opacity-50"
                  disabled={!sheetForm.name.trim()}
                >
                  <Plus size={16} /> New Sheet
                </button>
              </div>
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
              <div className="flex flex-col gap-2 mt-2 text-xs text-slate-500">
                <p>Headers supported: created_time, platform, full_name, phone, city, status, admin, update, note</p>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold hover:border-indigo-200"
                >
                  <FileSpreadsheet size={12} /> Download sample CSV
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl p-4 shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Sheets</h3>
                <CalendarDays size={16} className="text-slate-400" />
              </div>
              <div className="mt-3 space-y-2 overflow-y-auto pr-1 flex-1 max-h-[60vh]">
                {sheets.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600 text-center">
                    No sheets yet. Create your first list to start tracking leads.
                  </div>
                )}
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
                      <span className="line-clamp-1">{sheet.name}</span>
                      <span className="text-[11px] text-slate-500">{sheet.leads.length} leads</span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{sheet.description || 'No description added'}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <Clock size={12} /> {new Date(sheet.createdAt).toLocaleDateString()}
                      <span>•</span>
                      {sheet.createdBy || 'Admin'}
                    </div>
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSheetEditor({ sheetId: sheet.id, name: sheet.name, description: sheet.description || '' });
                        }}
                        className="flex items-center gap-1 hover:text-indigo-600"
                      >
                        <Edit3 size={12} /> Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSheetAction('delete');
                          setSheetToDelete(sheet);
                        }}
                        className="flex items-center gap-1 text-rose-500 hover:text-rose-600"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 w-full">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs text-slate-500">Active sheet</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-semibold text-slate-900">{activeSheet?.name || 'No sheet selected'}</h3>
                  {activeSheet && (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-[12px] text-slate-600 border border-slate-200">
                      {activeSheet.leads.length} leads
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto flex-wrap justify-end">
                {activeSheet && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => duplicateSheet(activeSheet.id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:border-indigo-200"
                      title="Clone this sheet with its statuses and leads"
                    >
                      <Copy size={14} /> Duplicate
                    </button>
                    <button
                      onClick={() => setSheetEditor({ sheetId: activeSheet.id, name: activeSheet.name, description: activeSheet.description || '' })}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:border-indigo-200"
                    >
                      <Edit3 size={14} /> Rename
                    </button>
                    <button
                      onClick={() => {
                        setSheetAction('clear');
                        setSheetToDelete(activeSheet);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      disabled={!activeSheet.leads.length}
                    >
                      <Database size={14} /> Clear leads
                    </button>
                    <button
                      onClick={() => {
                        setSheetAction('delete');
                        setSheetToDelete(activeSheet);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-sm text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                    <button
                      onClick={exportActiveSheet}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:border-indigo-200"
                      disabled={!activeSheet.leads.length}
                    >
                      <FileSpreadsheet size={14} /> Export
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 w-full md:w-64">
                  <Filter size={14} />
                  <input
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Search name, city, status"
                    className="flex-1 bg-transparent outline-none"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white w-full md:w-48"
                >
                  <option value="all">All statuses</option>
                  {activeSheet?.statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white w-full md:w-40"
                >
                  <option value="recent">Latest touch</option>
                  <option value="oldest">Oldest first</option>
                  <option value="status">Group by status</option>
                </select>
                <label className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 cursor-pointer hover:border-indigo-200">
                  <FileSpreadsheet size={14} />
                  <span>Import</span>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {activeSheet?.statuses.map((status) => {
                const count = activeSheet.leads.filter((lead) => lead.statusId === status.id).length;
                return (
                  <button
                    key={status.id}
                    onClick={() => setStatusFilter((prev) => (prev === status.id ? 'all' : status.id))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      statusFilter === status.id
                        ? `${colorMap[status.color || 'slate']} border-transparent`
                        : 'border-slate-200 text-slate-600 hover:border-indigo-200'
                    }`}
                  >
                    <span>{status.label}</span>
                    <span className="text-[11px] text-slate-500">{count}</span>
                  </button>
                );
              })}
              {!!leadMetrics.withNotes && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200">
                  <NotebookPen size={12} />
                  {leadMetrics.withNotes} with updates
                </span>
              )}
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
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden w-full xl:col-span-2">
          <div className="overflow-auto w-full">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-[12px] text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Latest update</th>
                  <th className="px-4 py-3">Last touch</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
                <tbody>
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={8}>
                        {isFiltered
                          ? 'No leads match the current filters. Try clearing the search or status filter.'
                          : 'No leads yet for this sheet. Add manually or import a file to get started.'}
                      </td>
                    </tr>
                  )}
                {filteredLeads.map((lead) => {
                  const update = latestUpdate(lead);
                  const touchDate = latestTouch(lead);
                  const days = daysSince(touchDate);
                  const stale = days >= 7;
                  return (
                    <tr
                      key={lead.id}
                      className={`border-b border-slate-100 hover:bg-slate-50/60 ${stale ? 'bg-amber-50/60' : ''}`}
                    >
                      <td className="px-4 py-3 text-slate-700 text-xs">
                        <div className="font-semibold text-slate-800 text-sm">{lead.createdTime}</div>
                        <div className="text-[11px] text-slate-500">Platform: {lead.platform || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{lead.fullName}</div>
                        <div className="text-[11px] text-slate-500">{lead.city || 'City not set'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{lead.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.statusId}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                          className={`w-full rounded-lg border text-xs font-semibold px-2 py-1 ${
                            statusFilter === lead.statusId
                              ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                              : 'border-slate-200 bg-white text-slate-800'
                          }`}
                        >
                          {activeSheet?.statuses.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {update ? (
                          <div className="flex flex-col gap-1 text-xs text-slate-600">
                            <div className="flex items-start gap-2">
                              <CalendarDays size={14} className="text-slate-400" />
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-800">{update.date}</span>
                                  {lead.updates.length > 1 && (
                                    <button
                                      onClick={() => toggleHistory(lead.id)}
                                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200"
                                    >
                                      {expandedHistories.has(lead.id)
                                        ? 'Hide previous'
                                        : `+${lead.updates.length - 1} more`}
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-500">
                                    {expandedLatestUpdates.has(lead.id) || update.text.length <= 80
                                      ? update.text
                                      : `${update.text.slice(0, 80)}...`}
                                  </span>
                                  {update.text.length > 80 && (
                                    <button
                                      onClick={() => toggleExpandedLatest(lead.id)}
                                      className="text-[11px] text-indigo-600 font-semibold hover:underline"
                                    >
                                      {expandedLatestUpdates.has(lead.id) ? 'Show less' : '...more'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {expandedHistories.has(lead.id) && lead.updates.slice(1).length > 0 && (
                              <div className="mt-1 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                                {lead.updates.slice(1).map((previous) => (
                                  <div key={previous.id} className="flex items-start gap-2">
                                    <CalendarDays size={12} className="text-slate-400 mt-0.5" />
                                    <div>
                                      <div className="font-semibold text-slate-700">{previous.date}</div>
                                      <div className="text-slate-500">{previous.text}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No updates</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-xs">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-slate-400" />
                          <div>
                            <div className="font-semibold text-slate-800">{touchDate}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2">
                              <span>{days === 0 ? 'Today' : `${days}d ago`}</span>
                              {stale && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Follow up</span>}
                            </div>
                          </div>
                        </div>
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
                            onClick={() => setLeadToDelete(lead)}
                            className="p-2 rounded-lg border border-slate-200 text-rose-500 hover:border-rose-200"
                            title="Delete lead"
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

      {duplicateWarning && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6">
            <div className="flex items-center gap-3 text-amber-600 font-semibold mb-2">
              <AlertTriangle size={18} /> Duplicate lead detected
            </div>
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{duplicateWarning.payload.fullName || 'Unnamed lead'}</span>{' '}
              {duplicateWarning.payload.phone ? `(${duplicateWarning.payload.phone})` : ''} already exists in{' '}
              <span className="font-semibold">{activeSheet?.name || 'this sheet'}</span>. Do you want to override the
              existing record?
            </p>
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
              <div className="font-semibold text-amber-900">Existing lead</div>
              <div>Name: {duplicateWarning.workingLeads.find((lead) => lead.id === duplicateWarning.existingId)?.fullName || '—'}</div>
              <div>Phone: {duplicateWarning.workingLeads.find((lead) => lead.id === duplicateWarning.existingId)?.phone || '—'}</div>
              <div>Status will change to: {mapStatus(activeSheet!, duplicateWarning.payload.statusId)?.label || 'Unknown'}</div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={cancelDuplicateLead}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={overrideDuplicateLead}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700"
              >
                <Check size={16} className="inline-block mr-1" /> Override & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetEditor && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <Edit3 size={18} /> Rename sheet
              </div>
              <button
                onClick={() => {
                  setSheetEditor(null);
                  setConfirmSheetEdit(false);
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-600 font-semibold">Sheet name</label>
                <input
                  value={sheetEditor.name}
                  onChange={(e) => setSheetEditor((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                  className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 font-semibold">Description</label>
                <textarea
                  value={sheetEditor.description}
                  onChange={(e) => setSheetEditor((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                  className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setSheetEditor(null);
                    setConfirmSheetEdit(false);
                  }}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setConfirmSheetEdit(true)}
                  disabled={!sheetEditor.name.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={16} className="inline-block mr-1" /> Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sheetEditor && confirmSheetEdit && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center gap-3 text-amber-600 font-semibold mb-2">
              <AlertTriangle size={18} /> Confirm sheet changes
            </div>
            <p className="text-sm text-slate-600">
              Save updates to <span className="font-semibold">{sheetEditor.name || 'this sheet'}</span>? This will update the
              sheet name and description for everyone who can view it.
            </p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setConfirmSheetEdit(false)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600"
              >
                Review again
              </button>
              <button
                onClick={saveSheetEdits}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
              >
                <Check size={16} className="inline-block mr-1" /> Confirm save
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center gap-3 text-rose-600 font-semibold mb-3">
              <AlertTriangle size={18} />
              {sheetAction === 'clear' ? 'Clear all leads?' : 'Delete sheet?'}
            </div>
            <p className="text-sm text-slate-600">
              {sheetAction === 'clear'
                ? (
                  <>Remove all leads inside <span className="font-semibold">{sheetToDelete.name}</span>? The sheet stays but the table will reset.</>
                )
                : (
                  <>This will permanently remove <span className="font-semibold">{sheetToDelete.name}</span> and all of its leads. This action cannot be undone.</>
                )}
            </p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setSheetToDelete(null);
                  setSheetAction(null);
                }}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSheet}
                className={`px-4 py-2 rounded-lg text-white font-semibold ${sheetAction === 'clear' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                <Trash2 size={16} className="inline-block mr-1" />
                {sheetAction === 'clear' ? 'Clear leads' : 'Delete sheet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {leadToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center gap-3 text-rose-600 font-semibold mb-2">
              <AlertTriangle size={18} /> Remove lead?
            </div>
            <p className="text-sm text-slate-600">
              Delete <span className="font-semibold">{leadToDelete.fullName}</span> from <span className="font-semibold">{activeSheet?.name}</span>? This cannot be undone.
            </p>
            <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">Last touch: {latestTouch(leadToDelete)}</div>
              <div>Phone: {leadToDelete.phone || '—'}</div>
              <div>Status: {mapStatus(activeSheet!, leadToDelete.statusId)?.label || 'Unknown'}</div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setLeadToDelete(null)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteLead(leadToDelete.id);
                  setLeadToDelete(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700"
              >
                <Trash2 size={16} className="inline-block mr-1" /> Delete lead
              </button>
            </div>
          </div>
        </div>
      )}

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
