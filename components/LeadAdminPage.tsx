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
  Lightbulb,
  RefreshCcw,
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

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const defaultStatusOptions: OptionItem[] = [
  { id: uid(), label: 'Interested' },
  { id: uid(), label: 'Shortlisted' },
  { id: uid(), label: 'Not Interested' },
  { id: uid(), label: 'Follow-up' },
];

const defaultUpdateOptions: OptionItem[] = [
  { id: uid(), label: 'Coming in 2 days' },
  { id: uid(), label: 'Call today' },
  { id: uid(), label: 'Documents pending' },
];

const storageKey = (listId: string, key: 'statuses' | 'updates') => `lead-${key}-${listId}`;

const loadOptions = (listId: string, key: 'statuses' | 'updates', fallback: OptionItem[]) => {
  if (!listId) return fallback;
  const saved = localStorage.getItem(storageKey(listId, key));
  return saved ? (JSON.parse(saved) as OptionItem[]) : fallback;
};

const saveOptions = (listId: string, key: 'statuses' | 'updates', items: OptionItem[]) => {
  if (!listId) return;
  localStorage.setItem(storageKey(listId, key), JSON.stringify(items));
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
  const [newLead, setNewLead] = useState<Partial<LeadRecord>>({ platform: 'Walk-in', source: 'Walk-in' });
  const [creatingLead, setCreatingLead] = useState(false);
  const [statusOptions, setStatusOptions] = useState<OptionItem[]>(defaultStatusOptions);
  const [updateOptions, setUpdateOptions] = useState<OptionItem[]>(defaultUpdateOptions);

  useEffect(() => {
    leadService.listLeadLists(role).then((lists) => {
      setLeadLists(lists);
      if (lists[0]) setActiveListId(lists[0].id);
    });
  }, [role]);

  useEffect(() => {
    if (!activeListId) return;
    setLoading(true);
    setStatusOptions(loadOptions(activeListId, 'statuses', defaultStatusOptions));
    setUpdateOptions(loadOptions(activeListId, 'updates', defaultUpdateOptions));
    leadService
      .fetchLeads({ listId: activeListId, role, limit: 200 })
      .then((res) => setLeads(res.items))
      .finally(() => setLoading(false));
  }, [activeListId, role]);

  const handleLeadUpdate = async (lead: LeadRecord, patch: Partial<LeadRecord>) => {
    const mergedPatch = { ...patch } as Partial<LeadRecord>;
    if (patch.custom_fields) {
      mergedPatch.custom_fields = { ...lead.custom_fields, ...patch.custom_fields };
    }
    const updated = await leadService.updateLead(lead.id, mergedPatch, role);
    setLeads((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
  };

  const handleCreateLead = async () => {
    if (!activeListId || !newLead.name || !newLead.phone) return;
    setCreatingLead(true);
    try {
      const created = await leadService.createLead(activeListId, newLead, role);
      setLeads((prev) => [created, ...prev]);
      setNewLead({ platform: 'Walk-in', source: 'Walk-in' });
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
      const refreshed = await leadService.fetchLeads({ listId: activeListId, role, limit: 200 });
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

  const statusOptionsWithEmpty = useMemo(() => [{ id: '', label: 'No status' }, ...statusOptions], [statusOptions]);

  const promptText = `You are building a driver lead manager. Always ask which sheet to open first. Inside a sheet you can:\n- import/export leads\n- add manual leads with name, phone, platform, city\n- update status options (Interested, Shortlisted, Not Interested, Follow-up)\n- update recent update tags (Coming in 2 days, Call today, Documents pending)\n- edit each lead inline: status, recent update tag, notes, follow-up timing.\nFocus on keeping records tidy for recruiters.`;

  const addOption = (type: 'statuses' | 'updates', label: string) => {
    if (!label.trim() || !activeListId) return;
    const option: OptionItem = { id: uid(), label: label.trim() };
    if (type === 'statuses') {
      const items = [...statusOptions, option];
      setStatusOptions(items);
      saveOptions(activeListId, 'statuses', items);
    } else {
      const items = [...updateOptions, option];
      setUpdateOptions(items);
      saveOptions(activeListId, 'updates', items);
    }
  };

  const editOption = (type: 'statuses' | 'updates', option: OptionItem) => {
    const label = prompt('Update name', option.label);
    if (!label || !activeListId) return;
    if (type === 'statuses') {
      const items = statusOptions.map((o) => (o.id === option.id ? { ...o, label } : o));
      setStatusOptions(items);
      saveOptions(activeListId, 'statuses', items);
    } else {
      const items = updateOptions.map((o) => (o.id === option.id ? { ...o, label } : o));
      setUpdateOptions(items);
      saveOptions(activeListId, 'updates', items);
    }
  };

  const removeOption = (type: 'statuses' | 'updates', optionId: string) => {
    if (!activeListId) return;
    if (type === 'statuses') {
      const items = statusOptions.filter((o) => o.id !== optionId);
      setStatusOptions(items);
      saveOptions(activeListId, 'statuses', items);
    } else {
      const items = updateOptions.filter((o) => o.id !== optionId);
      setUpdateOptions(items);
      saveOptions(activeListId, 'updates', items);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-slate-500 font-semibold tracking-widest">Driver pipeline</p>
          <h1 className="text-3xl font-black text-slate-900">Lead workbook</h1>
          <p className="text-sm text-slate-600">Create named sheets, import/export data, and keep live notes on every driver prospect.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm flex items-center gap-2"
            onClick={handleExport}
            disabled={!activeListId}
          >
            <Download size={16} /> Export
          </button>
          <label className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm flex items-center gap-2 cursor-pointer">
            <Upload size={16} />
            <span>{importing ? 'Importing...' : 'Import'}</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={dedupeMode}
            onChange={(e) => setDedupeMode(e.target.value)}
          >
            <option value="skip">Skip duplicates</option>
            <option value="update">Update matches</option>
            <option value="keep_both">Keep both</option>
          </select>
          <button
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
            disabled={!file || importing}
            onClick={handleImport}
          >
            {importing && <Loader2 size={16} className="animate-spin" />} Start import
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <NotebookTabs size={18} className="text-indigo-600" />
            <div>
              <p className="font-semibold text-slate-800">Sheets</p>
              <p className="text-xs text-slate-500">Keep cities, campaigns, or recruiters in separate sheets.</p>
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

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="text-lg font-bold text-slate-900">{leadLists.length}</div>
              <div className="text-slate-500">Sheets</div>
            </div>
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
              <div className="text-lg font-bold text-indigo-800">{leads.length}</div>
              <div className="text-indigo-700">Leads in sheet</div>
            </div>
          </div>

          {importSummary && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
              <div className="font-semibold text-slate-800">Last import</div>
              <div>Imported: {importSummary.importedCount}</div>
              <div>Updated: {importSummary.updatedCount}</div>
              <div>Skipped: {importSummary.skippedCount}</div>
              {importSummary.errors?.length > 0 && (
                <div className="text-rose-600">Errors: {importSummary.errors.slice(0, 2).map((e) => `Row ${e.row}` ).join(', ')}</div>
              )}
              <div className="text-[11px] text-slate-500">Dedupe: {dedupeMode}</div>
            </div>
          )}
        </section>

        <section className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-700">
              <ListChecks size={18} className="text-indigo-600" />
              <div>
                <p className="font-semibold">Quick add lead</p>
                <p className="text-xs text-slate-500">Capture phone calls and walk-ins instantly.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Name"
                value={newLead.name || ''}
                onChange={(e) => setNewLead((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Phone"
                value={newLead.phone || ''}
                onChange={(e) => setNewLead((prev) => ({ ...prev, phone: e.target.value }))}
              />
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="City / Area"
                value={newLead.city || ''}
                onChange={(e) => setNewLead((prev) => ({ ...prev, city: e.target.value }))}
              />
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Platform"
                value={newLead.platform || ''}
                onChange={(e) => setNewLead((prev) => ({ ...prev, platform: e.target.value }))}
              />
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Source"
                value={newLead.source || ''}
                onChange={(e) => setNewLead((prev) => ({ ...prev, source: e.target.value }))}
              />
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                onClick={handleCreateLead}
                disabled={creatingLead || !activeListId}
              >
                {creatingLead && <Loader2 size={16} className="animate-spin" />} Create lead
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <StickyNote size={18} className="text-indigo-600" />
                  <div>
                    <p className="font-semibold">Status options</p>
                    <p className="text-xs text-slate-500">Create, edit, or delete lead status labels.</p>
                  </div>
                </div>
                <button className="text-xs text-indigo-600" onClick={() => addOption('statuses', 'New status')}>+ Quick add</button>
              </div>
              <div className="space-y-2">
                {statusOptions.map((option) => (
                  <div key={option.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="flex-1 text-sm text-slate-800">{option.label}</span>
                    <button className="text-slate-500 hover:text-indigo-600" onClick={() => editOption('statuses', option)}>
                      <Pencil size={14} />
                    </button>
                    <button className="text-slate-400 hover:text-rose-600" onClick={() => removeOption('statuses', option.id)}>
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
                      addOption('statuses', (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <button
                  className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm"
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>('input[placeholder="Add status label"]');
                    if (input) {
                      addOption('statuses', input.value);
                      input.value = '';
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone size={18} className="text-indigo-600" />
                  <div>
                    <p className="font-semibold">Recent updates</p>
                    <p className="text-xs text-slate-500">Reusable follow-up notes like "Coming in 2 days".</p>
                  </div>
                </div>
                <button className="text-xs text-indigo-600" onClick={() => addOption('updates', 'New update')}>+ Quick add</button>
              </div>
              <div className="space-y-2">
                {updateOptions.map((option) => (
                  <div key={option.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="flex-1 text-sm text-slate-800">{option.label}</span>
                    <button className="text-slate-500 hover:text-indigo-600" onClick={() => editOption('updates', option)}>
                      <Pencil size={14} />
                    </button>
                    <button className="text-slate-400 hover:text-rose-600" onClick={() => removeOption('updates', option.id)}>
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Add update tag"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addOption('updates', (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <button
                  className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm"
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>('input[placeholder="Add update tag"]');
                    if (input) {
                      addOption('updates', input.value);
                      input.value = '';
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 text-slate-700">
              <RefreshCcw size={18} className={loading ? 'animate-spin text-indigo-600' : 'text-indigo-600'} />
              <div>
                <p className="font-semibold">Live board</p>
                <p className="text-xs text-slate-500">Update status, recent update tag, and notes inline. Everything auto-saves.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3">Lead</th>
                    <th className="text-left px-4 py-3">Phone</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Recent update</th>
                    <th className="text-left px-4 py-3">Notes</th>
                    <th className="text-left px-4 py-3">Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{lead.name}</div>
                        <div className="text-xs text-slate-500">{lead.city || '—'} · {lead.platform}</div>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-indigo-600 hover:underline" onClick={() => window.open(`tel:${lead.phone_normalized}`)}>
                          {lead.phone_normalized}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="border border-slate-200 rounded-lg px-2 py-1 text-sm"
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
                        <select
                          className="border border-slate-200 rounded-lg px-2 py-1 text-sm"
                          value={lead.custom_fields?.recent_update || ''}
                          onChange={(e) => handleLeadUpdate(lead, { custom_fields: { recent_update: e.target.value } })}
                        >
                          <option value="">Select update</option>
                          {updateOptions.map((option) => (
                            <option key={option.id} value={option.label}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm"
                          rows={2}
                          value={lead.notes || ''}
                          onChange={(e) => handleLeadUpdate(lead, { notes: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(lead.lead_capture_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No leads in this sheet yet. Import a file or add a lead to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Lightbulb size={20} className="text-amber-500" />
              <div className="space-y-1 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">Suggested layout</div>
                <ul className="list-disc ml-4 space-y-1 text-slate-600">
                  <li>Use one sheet per city or recruiter to keep ownership clear.</li>
                  <li>Statuses show pipeline position; update tags log the latest promise or ETA.</li>
                  <li>Notes capture context from calls; keep them short and time-stamped.</li>
                  <li>Export weekly to share progress and re-import after bulk edits.</li>
                </ul>
              </div>
            </div>
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 text-sm text-slate-700">
              <div className="font-semibold text-slate-900 mb-2">Prompt to brief an AI assistant</div>
              <pre className="whitespace-pre-wrap text-xs bg-white border border-slate-200 rounded-lg p-3 text-slate-800">{promptText}</pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LeadAdminPage;
