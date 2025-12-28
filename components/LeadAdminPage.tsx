import React, { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  PlusCircle,
  Upload,
  Download,
  NotebookTabs,
  Pencil,
  Trash,
  StickyNote,
  ListChecks,
  CalendarClock,
  Sparkles,
  Plus,
  FileSpreadsheet,
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

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

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
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, { text: string; date: string }>>({});
  const [selectedStatusId, setSelectedStatusId] = useState('');

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
    setNewStatusLabel('');
    setFile(null);
    leadService
      .fetchLeads({ listId: activeListId, role, limit: 300, sort: 'latest' })
      .then((res) => setLeads(res.items))
      .finally(() => setLoading(false));
  }, [activeListId, role]);

  const statusOptionsWithEmpty = useMemo(() => [{ id: '', label: 'No status' }, ...statusOptions], [statusOptions]);
  const hasActiveList = Boolean(activeListId);

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
    setNewStatusLabel('');
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
    if (selectedStatusId === optionId) setSelectedStatusId('');
  };

  const selectedStatus = statusOptions.find((o) => o.id === selectedStatusId);

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
      <tr key={lead.id} className="border-b border-slate-100 hover:bg-indigo-50/30">
        <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(getLeadCreatedDate(lead)).toLocaleDateString()}</td>
        <td className="px-3 py-3">
          <input
            className="border border-slate-200 rounded-md px-2 py-1 text-sm w-full bg-white"
            value={lead.platform || ''}
            onChange={(e) => handleLeadUpdate(lead, { platform: e.target.value })}
          />
        </td>
        <td className="px-3 py-3 min-w-[180px]">
          <div className="font-semibold text-slate-900">{lead.name}</div>
          <div className="text-xs text-slate-500">{lead.city || '—'}</div>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <button className="text-indigo-600 hover:underline" onClick={() => window.open(`tel:${lead.phone_normalized}`)}>
            {lead.phone_normalized}
          </button>
        </td>
        <td className="px-3 py-3">
          <input
            className="border border-slate-200 rounded-md px-2 py-1 text-sm w-full bg-white"
            value={lead.city || ''}
            onChange={(e) => handleLeadUpdate(lead, { city: e.target.value })}
          />
        </td>
        <td className="px-3 py-3">
          <select
            className="border border-slate-200 rounded-md px-2 py-1 text-sm w-full bg-white"
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
        <td className="px-3 py-3">
          <input
            className="border border-slate-200 rounded-md px-2 py-1 text-sm w-full bg-white"
            placeholder="Admin name"
            value={(lead.custom_fields as any)?.admin || ''}
            onChange={(e) => handleLeadUpdate(lead, { custom_fields: { ...lead.custom_fields, admin: e.target.value } })}
          />
        </td>
        <td className="px-3 py-3 min-w-[260px]">
          <div className="flex flex-col gap-2">
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
            <div className="flex items-center gap-2 bg-slate-50 border border-dashed border-slate-200 rounded-lg p-2">
              <input
                type="date"
                className="border border-slate-200 rounded-md px-2 py-1 text-xs w-32 bg-white"
                value={updateDrafts[lead.id]?.date || ''}
                onChange={(e) =>
                  setUpdateDrafts((prev) => ({ ...prev, [lead.id]: { ...(prev[lead.id] || { text: '', date: '' }), date: e.target.value } }))
                }
              />
              <input
                className="border border-slate-200 rounded-md px-2 py-1 text-xs flex-1 bg-white"
                placeholder="Add update with date"
                value={updateDrafts[lead.id]?.text || ''}
                onChange={(e) =>
                  setUpdateDrafts((prev) => ({ ...prev, [lead.id]: { ...(prev[lead.id] || { text: '', date: '' }), text: e.target.value } }))
                }
              />
              <button
                className="px-2 py-2 bg-indigo-600 text-white rounded-md text-xs flex items-center gap-1 disabled:opacity-50"
                onClick={() => handleAddUpdate(lead)}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </td>
        <td className="px-3 py-3">
          <textarea
            className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm bg-white"
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
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, #fff 0, transparent 30%)' }} />
        <div className="relative p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white px-3 py-1 rounded-full text-xs font-semibold">
              <NotebookTabs size={14} /> Driver leads workspace
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Sheets + imports + inline updates</p>
              <h1 className="text-3xl font-black">Lead manager</h1>
            </div>
            <p className="text-sm text-indigo-100 max-w-2xl">
              Organise leads through named sheets, import Excel/CSV, customise statuses, and keep dated updates beside every record so recruiters know the next move.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-indigo-100">
              <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full"><Sparkles size={12} /> Modern layout</span>
              <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full"><CalendarClock size={12} /> Created date captured</span>
              <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full"><StickyNote size={12} /> Status + updates inline</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="bg-white/10 border border-white/20 rounded-2xl p-3">
              <p className="text-indigo-100 text-[11px]">Active sheet</p>
              <p className="text-lg font-bold">{leadLists.find((l) => l.id === activeListId)?.name || 'None'}</p>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-2xl p-3">
              <p className="text-indigo-100 text-[11px]">Leads loaded</p>
              <p className="text-lg font-bold">{leads.length}</p>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-2xl p-3">
              <p className="text-indigo-100 text-[11px]">Statuses</p>
              <p className="text-lg font-bold">{statusOptions.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px,1fr]">
        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-start gap-2 text-slate-700">
              <FileSpreadsheet size={18} className="text-indigo-600" />
              <div>
                <p className="font-semibold">Sheets</p>
                <p className="text-xs text-slate-500">Create, rename, and jump between lead sheets. Created date is auto-pulled into each record.</p>
              </div>
            </div>
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
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
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
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-2 text-slate-700">
              <div className="flex items-center gap-2">
                <ListChecks size={18} className="text-indigo-600" />
                <div>
                  <p className="font-semibold">Import / export</p>
                  <p className="text-[11px] text-slate-500">{hasActiveList ? `Sheet: ${leadLists.find((l) => l.id === activeListId)?.name || 'Select a sheet'}` : 'Choose a sheet to enable'}</p>
                </div>
              </div>
              <button
                className="px-2 py-1 text-xs rounded-md border border-slate-200 text-slate-600 hover:text-indigo-700 disabled:opacity-60"
                onClick={handleExport}
                disabled={!hasActiveList}
              >
                <div className="flex items-center gap-1"><Download size={14} /> Export</div>
              </button>
            </div>
            <div className="flex flex-col gap-2 text-sm text-slate-600">
              <label className="px-3 py-2 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-sm flex items-center gap-2 cursor-pointer">
                <Upload size={16} className="text-indigo-600" />
                <span className="text-slate-700">{file ? file.name : 'Choose Excel/CSV'}</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  disabled={!hasActiveList}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={dedupeMode}
                  onChange={(e) => setDedupeMode(e.target.value)}
                  disabled={!hasActiveList}
                >
                  <option value="skip">Skip duplicates</option>
                  <option value="update">Update matches</option>
                  <option value="keep_both">Keep both</option>
                </select>
                <button
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  disabled={!file || importing || !hasActiveList}
                  onClick={handleImport}
                >
                  {importing && <Loader2 size={16} className="animate-spin" />} Import
                </button>
              </div>
              {importSummary && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700 flex flex-wrap gap-2">
                  <span className="font-semibold text-slate-800">Last import</span>
                  <span>Imported: {importSummary.importedCount}</span>
                  <span>Updated: {importSummary.updatedCount}</span>
                  <span>Skipped: {importSummary.skippedCount}</span>
                  {importSummary.errors?.length > 0 && (
                    <span className="text-rose-600">Errors: {importSummary.errors.slice(0, 2).map((e) => `Row ${e.row}`).join(',')}</span>
                  )}
                  <span className="text-slate-500">Dedupe: {dedupeMode}</span>
                </div>
              )}
            </div>
          </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <StickyNote size={18} className="text-indigo-600" />
                  <div>
                    <p className="font-semibold">Status designer</p>
                    <p className="text-xs text-slate-500">Select an option to edit or remove it.</p>
                  </div>
                </div>
                <button className="text-xs text-indigo-600" onClick={() => addStatusOption('New status')} disabled={!hasActiveList}>
                  + Quick add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`px-3 py-1 rounded-full border text-sm transition ${
                      selectedStatusId === option.id
                        ? 'border-indigo-300 bg-indigo-50 text-slate-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                    onClick={() => hasActiveList && setSelectedStatusId(option.id)}
                    disabled={!hasActiveList}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs justify-between">
                <input
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Add status label"
                  value={newStatusLabel}
                  onChange={(e) => setNewStatusLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addStatusOption(newStatusLabel);
                    }
                  }}
                  disabled={!hasActiveList}
                />
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50"
                    onClick={() => addStatusOption(newStatusLabel)}
                    disabled={!hasActiveList}
                  >
                    Add
                  </button>
                  <button
                    className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm disabled:opacity-50"
                    disabled={!selectedStatus || !hasActiveList}
                    onClick={() => selectedStatus && editStatusOption(selectedStatus)}
                  >
                    Edit
                  </button>
                  <button
                    className="px-3 py-2 border border-slate-200 text-rose-600 rounded-lg text-sm disabled:opacity-50"
                    disabled={!selectedStatus || !hasActiveList}
                    onClick={() => selectedStatus && removeStatusOption(selectedStatus.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </section>
        </div>

        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <PlusCircle size={18} className="text-indigo-600" />
                  <div>
                    <p className="font-semibold">Add new lead</p>
                    <p className="text-xs text-slate-500">{hasActiveList ? 'Saves to the selected sheet' : 'Select a sheet to enable the form'}</p>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">Created date auto-saves.</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Full name</label>
                  <input
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Driver name"
                    value={newLead.name || ''}
                    onChange={(e) => setNewLead((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={!hasActiveList}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Phone</label>
                  <input
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Phone number"
                    value={newLead.phone || ''}
                    onChange={(e) => setNewLead((prev) => ({ ...prev, phone: e.target.value }))}
                    disabled={!hasActiveList}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">City</label>
                  <input
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="City"
                    value={newLead.city || ''}
                    onChange={(e) => setNewLead((prev) => ({ ...prev, city: e.target.value }))}
                    disabled={!hasActiveList}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Platform</label>
                  <input
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Walk-in, website, campaign"
                    value={newLead.platform || ''}
                    onChange={(e) => setNewLead((prev) => ({ ...prev, platform: e.target.value }))}
                    disabled={!hasActiveList}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Lead date</label>
                  <input
                    type="date"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    value={newLeadDate}
                    onChange={(e) => setNewLeadDate(e.target.value)}
                    disabled={!hasActiveList}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Status</label>
                  <select
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    value={newLeadStatus}
                    onChange={(e) => setNewLeadStatus(e.target.value)}
                    disabled={!hasActiveList}
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
                    placeholder="Handled by"
                    value={newLeadAdmin}
                    onChange={(e) => setNewLeadAdmin(e.target.value)}
                    disabled={!hasActiveList}
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-2">
                  <label className="text-xs text-slate-500">Note</label>
                  <textarea
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Next step, promised follow-up, documents needed"
                    value={newLeadNote}
                    onChange={(e) => setNewLeadNote(e.target.value)}
                    disabled={!hasActiveList}
                  />
                </div>
            </div>
            <div className="flex justify-end">
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                onClick={handleCreateLead}
                disabled={creatingLead || !activeListId}
              >
                {creatingLead && <Loader2 size={16} className="animate-spin" />} Add lead
              </button>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <Sparkles size={18} className={loading ? 'animate-spin text-indigo-600' : 'text-indigo-600'} />
                <div>
                  <p className="font-semibold">Lead records</p>
                  <p className="text-xs text-slate-500">Fields: created_time, platform, full_name, phone, city, status, admin, update, note.</p>
                </div>
              </div>
              <div className="text-[11px] text-slate-500">Inline edits save automatically for the active sheet.</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-3">Created</th>
                    <th className="text-left px-3 py-3">Platform</th>
                    <th className="text-left px-3 py-3">Full name</th>
                    <th className="text-left px-3 py-3">Phone</th>
                    <th className="text-left px-3 py-3">City</th>
                    <th className="text-left px-3 py-3">Status</th>
                    <th className="text-left px-3 py-3">Admin</th>
                    <th className="text-left px-3 py-3">Updates</th>
                    <th className="text-left px-3 py-3">Note</th>
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
          </section>
        </div>
      </div>
    </div>
  );
};

export default LeadAdminPage;
