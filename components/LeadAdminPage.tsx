import React, { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  PlusCircle,
  Upload,
  Download,
  NotebookTabs,
  Pencil,
  Trash,
  Phone,
  StickyNote,
  ListChecks,
  CalendarClock,
  Sparkles,
  Plus,
} from 'lucide-react';
import { leadService } from '../services/leadsService';
import { LeadList, LeadRecord, LeadImportResult } from '../types';

interface LeadAdminPageProps {
  role: string;
}

interface OptionItem {
  id: string;
  label: string;
}

interface LeadUpdateEntry {
  id: string;
  text: string;
  date: string;
}

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const defaultStatusOptions: OptionItem[] = [
  { id: uid(), label: 'Interested' },
  { id: uid(), label: 'Not Interested' },
  { id: uid(), label: 'Waiting' },
  { id: uid(), label: 'Confirmed' },
];

const storageKey = (listId: string) => `lead-statuses-${listId}`;

const loadStatusOptions = (listId: string) => {
  if (!listId) return defaultStatusOptions;
  const saved = localStorage.getItem(storageKey(listId));
  return saved ? (JSON.parse(saved) as OptionItem[]) : defaultStatusOptions;
};

const saveStatusOptions = (listId: string, items: OptionItem[]) => {
  if (!listId) return;
  localStorage.setItem(storageKey(listId), JSON.stringify(items));
};

const LeadAdminPage: React.FC<LeadAdminPageProps> = ({ role }) => {
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [activeListId, setActiveListId] = useState('');
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<LeadImportResult | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dedupeMode, setDedupeMode] = useState('skip');
  const [newListName, setNewListName] = useState('');
  const [newLead, setNewLead] = useState<Partial<LeadRecord>>({ platform: 'Walk-in' });
  const [newLeadDate, setNewLeadDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newLeadStatus, setNewLeadStatus] = useState('');
  const [newLeadAdmin, setNewLeadAdmin] = useState('');
  const [newLeadNote, setNewLeadNote] = useState('');
  const [creatingLead, setCreatingLead] = useState(false);
  const [statusOptions, setStatusOptions] = useState<OptionItem[]>(defaultStatusOptions);
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, { text: string; date: string }>>({});

  useEffect(() => {
    leadService.listLeadLists(role).then((lists) => {
      setLeadLists(lists);
      if (lists[0]) setActiveListId(lists[0].id);
    });
  }, [role]);

  useEffect(() => {
    if (!activeListId) return;
    setLoading(true);
    setStatusOptions(loadStatusOptions(activeListId));
    leadService
      .fetchLeads({ listId: activeListId, role, limit: 300, sort: 'latest' })
      .then((res) => setLeads(res.items))
      .finally(() => setLoading(false));
  }, [activeListId, role]);

  const statusOptionsWithEmpty = useMemo(() => [{ id: '', label: 'No status' }, ...statusOptions], [statusOptions]);

  const handleLeadUpdate = async (lead: LeadRecord, patch: Partial<LeadRecord>) => {
    const mergedPatch = { ...patch } as Partial<LeadRecord>;
    if (patch.custom_fields) {
      mergedPatch.custom_fields = { ...lead.custom_fields, ...patch.custom_fields };
    }
    const updated = await leadService.updateLead(lead.id, mergedPatch, role);
    setLeads((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
  };

  const handleCreateLead = async () => {
    if (!activeListId || !newLead.name?.trim() || !newLead.phone?.trim()) return;
    setCreatingLead(true);
    try {
      const payload: Partial<LeadRecord> = {
        name: newLead.name.trim(),
        phone: newLead.phone.trim(),
        city: newLead.city?.trim() || '',
        platform: newLead.platform || 'Walk-in',
        status_id: newLeadStatus || null,
        notes: newLeadNote || undefined,
        lead_capture_at: new Date(newLeadDate || new Date().toISOString()).toISOString(),
        custom_fields: {
          ...newLead.custom_fields,
          created_time: newLeadDate,
          admin: newLeadAdmin,
          updates: [],
        },
      };
      const created = await leadService.createLead(activeListId, payload, role);
      setLeads((prev) => [created, ...prev]);
      setNewLead({ platform: 'Walk-in' });
      setNewLeadStatus('');
      setNewLeadAdmin('');
      setNewLeadNote('');
      setNewLeadDate(new Date().toISOString().slice(0, 10));
    } finally {
      setCreatingLead(false);
    }
  };

  const handleImport = async () => {
    if (!activeListId || !file) return;
    setImporting(true);
    try {
      const summary = await leadService.importLeads(activeListId, file, { dedupeMode, role });
      setImportSummary(summary);
      const refreshed = await leadService.fetchLeads({ listId: activeListId, role, limit: 300, sort: 'latest' });
      setLeads(refreshed.items);
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    if (!activeListId) return;
    const blob = await leadService.exportLeads(activeListId, role);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'driver-leads.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const addStatusOption = (label: string) => {
    if (!label.trim() || !activeListId) return;
    const option: OptionItem = { id: uid(), label: label.trim() };
    const items = [...statusOptions, option];
    setStatusOptions(items);
    saveStatusOptions(activeListId, items);
  };

  const editStatusOption = (option: OptionItem) => {
    const label = prompt('Update status name', option.label);
    if (!label || !activeListId) return;
    const items = statusOptions.map((o) => (o.id === option.id ? { ...o, label } : o));
    setStatusOptions(items);
    saveStatusOptions(activeListId, items);
  };

  const removeStatusOption = (optionId: string) => {
    if (!activeListId) return;
    const items = statusOptions.filter((o) => o.id !== optionId);
    setStatusOptions(items);
    saveStatusOptions(activeListId, items);
  };

  const promptText = `You are managing driver leads inside named sheets. Always ask which sheet to work in first. Within a sheet you can:\n` +
    `- import or export leads via CSV/Excel\n` +
    `- add leads with date, platform, full name, phone, city, status, admin, and notes\n` +
    `- customize status labels (Interested, Not Interested, Waiting, Confirmed, plus any new ones)\n` +
    `- log dated updates per lead (e.g., 2024-06-01: "Documents collected")\n` +
    `- keep records tidy for recruiters to filter and follow up.`;

  const getLeadCreatedDate = (lead: LeadRecord) => lead.custom_fields?.created_time || lead.lead_capture_at;

  const leadUpdates = (lead: LeadRecord): LeadUpdateEntry[] => {
    const raw = (lead.custom_fields as any)?.updates;
    if (Array.isArray(raw)) return raw as LeadUpdateEntry[];
    return [];
  };

  const handleAddUpdate = (lead: LeadRecord) => {
    const draft = updateDrafts[lead.id] || { text: '', date: '' };
    if (!draft.text.trim() || !draft.date) return;
    const updates = [
      { id: uid(), text: draft.text.trim(), date: draft.date },
      ...leadUpdates(lead),
    ];
    handleLeadUpdate(lead, { custom_fields: { ...lead.custom_fields, updates } });
    setUpdateDrafts((prev) => ({ ...prev, [lead.id]: { text: '', date: '' } }));
  };

  const handleRemoveUpdate = (lead: LeadRecord, updateId: string) => {
    const updates = leadUpdates(lead).filter((item) => item.id !== updateId);
    handleLeadUpdate(lead, { custom_fields: { ...lead.custom_fields, updates } });
  };

  const renderLeadRow = (lead: LeadRecord) => {
    const updates = leadUpdates(lead);
    return (
      <tr key={lead.id} className="border-t border-slate-100 hover:bg-slate-50/70">
        <td className="px-4 py-3 text-sm text-slate-600">{new Date(getLeadCreatedDate(lead)).toLocaleDateString()}</td>
        <td className="px-4 py-3">
          <input
            className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-full"
            value={lead.platform || ''}
            onChange={(e) => handleLeadUpdate(lead, { platform: e.target.value })}
          />
        </td>
        <td className="px-4 py-3">
          <div className="font-semibold text-slate-900">{lead.name}</div>
          <div className="text-xs text-slate-500">{lead.city || '—'}</div>
        </td>
        <td className="px-4 py-3">
          <button className="text-indigo-600 hover:underline" onClick={() => window.open(`tel:${lead.phone_normalized}`)}>
            {lead.phone_normalized}
          </button>
        </td>
        <td className="px-4 py-3">
          <input
            className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-full"
            value={lead.city || ''}
            onChange={(e) => handleLeadUpdate(lead, { city: e.target.value })}
          />
        </td>
        <td className="px-4 py-3">
          <select
            className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-full"
            value={lead.status_id || ''}
            onChange={(e) => handleLeadUpdate(lead, { status_id: e.target.value || null })}
          >
            {statusOptionsWithEmpty.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3">
          <input
            className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-full"
            placeholder="Admin name"
            value={(lead.custom_fields as any)?.admin || ''}
            onChange={(e) =>
              handleLeadUpdate(lead, { custom_fields: { ...lead.custom_fields, admin: e.target.value } })
            }
          />
        </td>
        <td className="px-4 py-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {updates.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-3 py-1 text-xs"
              >
                <span className="font-medium">{item.date}</span>
                <span className="text-slate-700">{item.text}</span>
                <button className="text-slate-400 hover:text-rose-600" onClick={() => handleRemoveUpdate(lead, item.id)}>
                  <Trash size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2 bg-slate-50 border border-dashed border-slate-200 rounded-lg p-2">
            <div className="flex gap-2">
              <input
                type="date"
                className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-36"
                value={updateDrafts[lead.id]?.date || ''}
                onChange={(e) =>
                  setUpdateDrafts((prev) => ({ ...prev, [lead.id]: { ...(prev[lead.id] || { text: '', date: '' }), date: e.target.value } }))
                }
              />
              <input
                className="border border-slate-200 rounded-lg px-2 py-1 text-sm flex-1"
                placeholder="Add update"
                value={updateDrafts[lead.id]?.text || ''}
                onChange={(e) =>
                  setUpdateDrafts((prev) => ({ ...prev, [lead.id]: { ...(prev[lead.id] || { text: '', date: '' }), text: e.target.value } }))
                }
              />
              <button
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs flex items-center gap-1 disabled:opacity-50"
                onClick={() => handleAddUpdate(lead)}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <textarea
            className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm"
            rows={2}
            value={lead.notes || ''}
            onChange={(e) => handleLeadUpdate(lead, { notes: e.target.value })}
          />
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 text-white shadow-xl">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, #fff 0, transparent 30%)' }} />
        <div className="relative p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white px-3 py-1 rounded-full text-xs font-semibold">
              <NotebookTabs size={14} /> Sheets + imports + inline updates
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Driver pipeline</p>
              <h1 className="text-3xl font-black">Lead workspace</h1>
            </div>
            <p className="text-sm text-indigo-100 max-w-2xl">
              Organise leads inside named sheets, import Excel/CSV files, customise statuses, and log dated updates so every recruiter knows the next step.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-indigo-100">
              <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full"><Sparkles size={12} /> Modernised layout</span>
              <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full"><ListChecks size={12} /> Status designer</span>
              <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full"><CalendarClock size={12} /> Dated updates</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="px-3 py-2 bg-white/10 border border-white/30 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-white/20"
              onClick={handleExport}
              disabled={!activeListId}
            >
              <Download size={16} /> Export CSV
            </button>
            <label className="px-3 py-2 bg-white text-slate-900 rounded-lg text-sm flex items-center gap-2 cursor-pointer shadow-sm">
              <Upload size={16} />
              <span>{importing ? 'Importing...' : 'Import'}</span>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <select
              className="border border-white/40 bg-white/10 text-white rounded-lg px-3 py-2 text-sm"
              value={dedupeMode}
              onChange={(e) => setDedupeMode(e.target.value)}
            >
              <option className="text-slate-900" value="skip">Skip duplicates</option>
              <option className="text-slate-900" value="update">Update matches</option>
              <option className="text-slate-900" value="keep_both">Keep both</option>
            </select>
            <button
              className="px-3 py-2 bg-indigo-500 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
              disabled={!file || importing}
              onClick={handleImport}
            >
              {importing && <Loader2 size={16} className="animate-spin" />} Start import
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Active sheet</p>
          <div className="text-2xl font-bold text-slate-900">{leadLists.find((l) => l.id === activeListId)?.name || 'None'}</div>
          <p className="text-xs text-slate-500 mt-1">Created date is pulled into every record for traceability.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Leads in sheet</p>
          <div className="text-2xl font-bold text-indigo-700">{leads.length}</div>
          <p className="text-xs text-slate-500 mt-1">Add via form or import Excel/CSV.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Statuses in use</p>
          <div className="text-2xl font-bold text-emerald-600">{statusOptions.length}</div>
          <p className="text-xs text-slate-500 mt-1">Only the statuses you add appear in the records.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <NotebookTabs size={18} className="text-indigo-600 mt-1" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-800">Sheets</p>
              <p className="text-sm text-slate-600">Create a sheet per city, campaign, or recruiter to keep ownership tidy.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="New sheet name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
              <button
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm"
                onClick={async () => {
                  if (!newListName.trim()) return;
                  const created = await leadService.createLeadList(newListName.trim(), role);
                  setLeadLists((prev) => [created, ...prev]);
                  setActiveListId(created.id);
                  setNewListName('');
                }}
              >
                <PlusCircle size={16} />
              </button>
            </div>
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {leadLists.map((list) => (
                <div
                  key={list.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
                    activeListId === list.id ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <button className="flex-1 text-left" onClick={() => setActiveListId(list.id)}>{list.name}</button>
                  <button
                    className="text-xs text-slate-500 hover:text-indigo-600"
                    onClick={async () => {
                      const name = prompt('Rename sheet', list.name);
                      if (!name) return;
                      const renamed = await leadService.renameLeadList(list.id, name, role);
                      setLeadLists((prev) => prev.map((l) => (l.id === list.id ? renamed : l)));
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              ))}
            </div>
            {importSummary && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                <div className="font-semibold text-slate-800">Last import</div>
                <div>Imported: {importSummary.importedCount}</div>
                <div>Updated: {importSummary.updatedCount}</div>
                <div>Skipped: {importSummary.skippedCount}</div>
                {importSummary.errors?.length > 0 && (
                  <div className="text-rose-600">Errors: {importSummary.errors.slice(0, 2).map((e) => `Row ${e.row}`).join(', ')}</div>
                )}
                <div className="text-[11px] text-slate-500">Dedupe: {dedupeMode}</div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-700">
            <ListChecks size={18} className="text-indigo-600" />
            <div>
              <p className="font-semibold">Import / export</p>
              <p className="text-xs text-slate-500">Bring in Excel/CSV files or export the active sheet.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Upload size={16} className="text-indigo-600" />
              <div>Upload .csv, .xlsx, or .xls and choose how duplicates are handled.</div>
            </div>
            <div className="flex items-center gap-2">
              <Download size={16} className="text-emerald-600" />
              <div>Export the active sheet anytime for reporting.</div>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-amber-500" />
              <div>Created date is auto-extracted into <span className="font-semibold">created_time</span> for filters.</div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-700">
            <Sparkles size={18} className="text-indigo-600" />
            <div>
              <p className="font-semibold">Add lead into current sheet</p>
              <p className="text-xs text-slate-500">Capture created date, platform, status, admin, updates, and notes.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Created date</label>
              <input
                type="date"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={newLeadDate}
                onChange={(e) => setNewLeadDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Platform</label>
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Walk-in / WhatsApp / Meta"
                value={newLead.platform || ''}
                onChange={(e) => setNewLead((prev) => ({ ...prev, platform: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Full name</label>
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Driver name"
                value={newLead.name || ''}
                onChange={(e) => setNewLead((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Phone</label>
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Phone number"
                value={newLead.phone || ''}
                onChange={(e) => setNewLead((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">City</label>
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="City / Area"
                value={newLead.city || ''}
                onChange={(e) => setNewLead((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Status</label>
              <select
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={newLeadStatus}
                onChange={(e) => setNewLeadStatus(e.target.value)}
              >
                {statusOptionsWithEmpty.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Admin</label>
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Owner / recruiter"
                value={newLeadAdmin}
                onChange={(e) => setNewLeadAdmin(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-2">
              <label className="text-xs text-slate-500">Note</label>
              <textarea
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="First call summary, sourcing info, expectations"
                rows={2}
                value={newLeadNote}
                onChange={(e) => setNewLeadNote(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
              onClick={handleCreateLead}
              disabled={creatingLead || !activeListId}
            >
              {creatingLead && <Loader2 size={16} className="animate-spin" />} Save lead
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CalendarClock size={14} /> created_time, admin, and updates are embedded in every record.
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <StickyNote size={18} className="text-indigo-600" />
              <div>
                <p className="font-semibold">Status options</p>
                <p className="text-xs text-slate-500">Add, edit, or delete statuses and they instantly appear in the records.</p>
              </div>
            </div>
            <button className="text-xs text-indigo-600" onClick={() => addStatusOption('New status')}>+ Quick add</button>
          </div>
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <div key={option.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                <span className="flex-1 text-sm text-slate-800">{option.label}</span>
                <button className="text-slate-500 hover:text-indigo-600" onClick={() => editStatusOption(option)}>
                  <Pencil size={14} />
                </button>
                <button className="text-slate-400 hover:text-rose-600" onClick={() => removeStatusOption(option.id)}>
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Add status label"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addStatusOption((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
            <button
              className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm"
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>('input[placeholder="Add status label"]');
                if (input) {
                  addStatusOption(input.value);
                  input.value = '';
                }
              }}
            >
              Add
            </button>
          </div>
        </section>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <Sparkles size={18} className={loading ? 'animate-spin text-indigo-600' : 'text-indigo-600'} />
            <div>
              <p className="font-semibold">Lead records</p>
              <p className="text-xs text-slate-500">Created date, platform, status, admin, dated updates, and notes are inline editable.</p>
            </div>
          </div>
          <div className="text-[11px] text-slate-500">Fields: created_time, platform, full_name, phone, city, status, admin, update, note.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Platform</th>
                <th className="text-left px-4 py-3">Full name</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">City</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Admin</th>
                <th className="text-left px-4 py-3">Updates</th>
                <th className="text-left px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => renderLeadRow(lead))}
              {leads.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No leads in this sheet yet. Import a file or add a lead to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-start gap-3">
          <Phone size={20} className="text-amber-500" />
          <div className="space-y-2 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">Better suggestions for arranging leads</div>
            <ul className="list-disc ml-4 space-y-1 text-slate-600">
              <li>Use one sheet per city, campaign, or recruiter to keep ownership clear.</li>
              <li>Keep the core statuses (Interested, Not Interested, Waiting, Confirmed); add new ones only when reporting needs them.</li>
              <li>Log every call as a dated update so the next recruiter understands the promise and follow-up window.</li>
              <li>Use notes for quick context (who called, next step, required documents) to stay concise.</li>
            </ul>
          </div>
        </div>
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-4 shadow-sm text-sm text-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-indigo-600" />
            <div className="font-semibold text-slate-900">Prompt to brief an AI assistant</div>
          </div>
          <pre className="whitespace-pre-wrap text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800">{promptText}</pre>
        </div>
      </div>
    </div>
  );
};

export default LeadAdminPage;
