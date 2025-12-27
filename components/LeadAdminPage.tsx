import React, { useEffect, useMemo, useState, useRef } from 'react';
import { leadService } from '../services/leadsService';
import { LeadList, LeadRecord, LeadImportResult } from '../types';
import {
  Plus,
  Upload,
  Download,
  LayoutTemplate,
  Kanban,
  Search,
  Filter,
  Loader2,
  Phone,
  Calendar,
  MapPin,
  Sparkles,
  RefreshCw,
  Clock3,
  ShieldCheck,
  Rows,
} from 'lucide-react';

interface LeadAdminPageProps {
  role: string;
}

const ColumnHeader: React.FC<{ label: string }> = ({ label }) => (
  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</div>
);

const LeadRow: React.FC<{ lead: LeadRecord; onEdit: (lead: LeadRecord, patch: Partial<LeadRecord>) => void }> = ({ lead, onEdit }) => {
  return (
    <div className="grid grid-cols-7 gap-3 px-3 py-2 bg-white/80 rounded-xl shadow-sm border border-slate-100 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold text-slate-900">{lead.name}</div>
        <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 rounded-full capitalize">{lead.platform}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <Phone size={14} className="text-slate-400" />
        <button className="text-indigo-600 hover:underline" onClick={() => window.open(`tel:${lead.phone_normalized}`)}>
          {lead.phone_normalized}
        </button>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <MapPin size={14} className="text-slate-400" />
        {lead.city}
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <Calendar size={14} className="text-slate-400" />
        {new Date(lead.lead_capture_at).toLocaleDateString()}
      </div>
      <input
        className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        value={lead.notes || ''}
        placeholder="Notes"
        onChange={(e) => onEdit(lead, { notes: e.target.value })}
      />
      <input
        className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        value={lead.assigned_to || ''}
        placeholder="Assign email"
        onChange={(e) => onEdit(lead, { assigned_to: e.target.value })}
      />
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Clock3 size={14} className="text-slate-400" />
        {lead.follow_up_at ? new Date(lead.follow_up_at).toLocaleDateString() : 'No follow-up'}
      </div>
    </div>
  );
};

const KanbanCard: React.FC<{ lead: LeadRecord; onEdit: (lead: LeadRecord, patch: Partial<LeadRecord>) => void; onDragStart?: () => void }> = ({ lead, onEdit, onDragStart }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 space-y-2 hover:shadow-md transition" draggable onDragStart={onDragStart}>
    <div className="flex items-center justify-between">
      <div className="font-semibold text-slate-900">{lead.name}</div>
      <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 rounded-full capitalize">{lead.platform}</span>
    </div>
    <div className="text-sm text-slate-600 flex items-center gap-1">
      <Phone size={14} className="text-slate-400" />
      <button className="text-indigo-600" onClick={() => window.open(`tel:${lead.phone_normalized}`)}>
        {lead.phone_normalized}
      </button>
    </div>
    <div className="text-xs text-slate-500 flex items-center gap-1">
      <Calendar size={14} className="text-slate-400" />
      {new Date(lead.lead_capture_at).toLocaleDateString()}
    </div>
    <textarea
      className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      placeholder="Notes"
      value={lead.notes || ''}
      onChange={(e) => onEdit(lead, { notes: e.target.value })}
    />
  </div>
);

const ImportWizard: React.FC<{ onImport: (file: File, dedupe: string) => Promise<LeadImportResult> }> = ({ onImport }) => {
  const [file, setFile] = useState<File | null>(null);
  const [dedupeMode, setDedupeMode] = useState('skip');
  const [summary, setSummary] = useState<LeadImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    const result = await onImport(file, dedupeMode);
    setSummary(result);
    setLoading(false);
  };

  return (
    <div className="bg-white/80 border border-slate-100 rounded-xl p-4 space-y-3 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2">
        <Upload size={18} className="text-indigo-600" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Import leads</p>
          <p className="text-xs text-slate-500">Upload CSV/Excel, map fields, and choose dedupe strategy.</p>
        </div>
      </div>
      <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <div className="flex items-center gap-3 text-sm">
        <label className="font-semibold text-slate-700">Dedupe</label>
        {['skip', 'update', 'keep_both'].map((mode) => (
          <label key={mode} className="inline-flex items-center gap-1 text-xs text-slate-600">
            <input type="radio" name="dedupe" value={mode} checked={dedupeMode === mode} onChange={() => setDedupeMode(mode)} />
            {mode}
          </label>
        ))}
      </div>
      <button
        disabled={!file || loading}
        onClick={handleSubmit}
        className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
      >
        {loading && <Loader2 size={14} className="animate-spin" />} Start import
      </button>
      {summary && (
        <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100">
          Imported {summary.importedCount}, updated {summary.updatedCount}, skipped {summary.skippedCount}
          {summary.errors.length > 0 && (
            <ul className="list-disc ml-4 mt-2 text-rose-500">
              {summary.errors.slice(0, 3).map((e) => (
                <li key={e.row}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const LeadsTable: React.FC<{ leads: LeadRecord[]; onEdit: (lead: LeadRecord, patch: Partial<LeadRecord>) => void; height: number }> = ({ leads, onEdit, height }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const itemHeight = 104;
  const overscan = 4;

  const onScroll = () => {
    if (!containerRef.current) return;
    setScrollTop(containerRef.current.scrollTop);
  };

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(height / itemHeight) + overscan * 2;
  const endIndex = Math.min(leads.length, startIndex + visibleCount);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      style={{ height, overflowY: 'auto', position: 'relative' }}
      className="rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white"
    >
      <div style={{ height: leads.length * itemHeight, position: 'relative' }}>
        {leads.slice(startIndex, endIndex).map((lead, idx) => {
          const absoluteIndex = startIndex + idx;
          return (
            <div key={lead.id} style={{ position: 'absolute', top: absoluteIndex * itemHeight, left: 0, right: 0 }} className="px-1 py-1">
              <LeadRow lead={lead} onEdit={onEdit} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const QuickAddLead: React.FC<{ onSubmit: (payload: Partial<LeadRecord>) => Promise<void>; loading?: boolean }> = ({ onSubmit, loading }) => {
  const [form, setForm] = useState({
    name: '',
    platform: 'fb',
    phone: '',
    city: '',
    lead_capture_at: new Date().toISOString().slice(0, 10),
    follow_up_at: '',
    assigned_to: '',
    notes: '',
  });

  const handleChange = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="bg-white/80 border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-indigo-600" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Add lead to this list</p>
          <p className="text-xs text-slate-500">Capture urgent drivers without leaving the console.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Full name" value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200" value={form.platform} onChange={(e) => handleChange('platform', e.target.value)}>
          <option value="fb">Facebook</option>
          <option value="ig">Instagram</option>
          <option value="organic">Organic</option>
          <option value="referral">Referral</option>
        </select>
        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Phone" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} />
        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="City" value={form.city} onChange={(e) => handleChange('city', e.target.value)} />
        <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" value={form.lead_capture_at} onChange={(e) => handleChange('lead_capture_at', e.target.value)} />
        <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" value={form.follow_up_at} onChange={(e) => handleChange('follow_up_at', e.target.value)} placeholder="Follow-up date" />
        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Assign to (email)" value={form.assigned_to} onChange={(e) => handleChange('assigned_to', e.target.value)} />
        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Notes" value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} />
      </div>
      <button
        className="w-full md:w-auto px-4 py-2 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
        disabled={loading}
        onClick={() => onSubmit(form)}
      >
        {loading && <Loader2 size={14} className="animate-spin" />} Create lead
      </button>
    </div>
  );
};

const StatPill: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/80 border border-slate-100 shadow-sm">
    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">{icon}</div>
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  </div>
);

const LeadAdminPage: React.FC<LeadAdminPageProps> = ({ role }) => {
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [activeList, setActiveList] = useState<string>('');
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draggingLead, setDraggingLead] = useState<LeadRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    leadService.listLeadLists(role).then((lists) => {
      setLeadLists(lists);
      if (lists.length > 0) setActiveList(lists[0].id);
    });
  }, [role]);

  useEffect(() => {
    if (!activeList) return;
    setLoading(true);
    leadService.fetchLeads({ listId: activeList, role, q: query, limit: 300 }).then((data) => {
      setLeads(data.items);
      setCursor(data.nextCursor || null);
      setLoading(false);
    });
  }, [activeList, query, role]);

  const handleEdit = async (lead: LeadRecord, patch: Partial<LeadRecord>) => {
    const optimistic = leads.map((l) => (l.id === lead.id ? { ...l, ...patch } : l));
    setLeads(optimistic);
    try {
      const updated = await leadService.updateLead(lead.id, patch, role);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
    } catch (err) {
      setLeads(leads);
      console.error(err);
    }
  };

  const handleImport = async (file: File, dedupeMode: string) => {
    if (!activeList) throw new Error('Select a list');
    const result = await leadService.importLeads(activeList, file, { dedupeMode, role });
    // Refresh table to reflect imported data quickly
    setLoading(true);
    const refreshed = await leadService.fetchLeads({ listId: activeList, role, q: query, limit: 300 });
    setLeads(refreshed.items);
    setCursor(refreshed.nextCursor || null);
    setLoading(false);
    return result;
  };

  const groupedStatuses = useMemo(() => {
    const groups: Record<string, LeadRecord[]> = {};
    leads.forEach((lead) => {
      const key = lead.status_id || 'backlog';
      groups[key] = groups[key] || [];
      groups[key].push(lead);
    });
    return groups;
  }, [leads]);

  const handleDrop = (statusId: string) => {
    if (!draggingLead) return;
    handleEdit(draggingLead, { status_id: statusId });
    setDraggingLead(null);
  };

  const loadMore = async () => {
    if (!cursor || !activeList) return;
    setLoading(true);
    const res = await leadService.fetchLeads({ listId: activeList, role, q: query, limit: 300, cursor });
    setLeads((prev) => [...prev, ...res.items]);
    setCursor(res.nextCursor || null);
    setLoading(false);
  };

  const handleCreateLead = async (payload: Partial<LeadRecord>) => {
    if (!activeList) return;
    setCreating(true);
    try {
      const created = await leadService.createLead(activeList, payload, role);
      setLeads((prev) => [created, ...prev]);
    } finally {
      setCreating(false);
    }
  };

  const totalFollowUps = leads.filter((l) => l.follow_up_at).length;

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 shadow-xl">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.07), transparent 35%)' }} />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs uppercase tracking-wide">
              <ShieldCheck size={14} /> Admin & Manager only
            </div>
            <h1 className="text-3xl font-bold mt-2">Driver Leads Command Center</h1>
            <p className="text-sm text-slate-100/80 max-w-2xl">
              Import, dedupe, and orchestrate follow-ups even with 10k+ drivers. Lists now carry dedicated Import and Add actions so every crew stays up-to-date.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatPill label="Leads loaded" value={leads.length} icon={<Rows size={16} />} />
              <StatPill label="Follow-ups" value={totalFollowUps} icon={<Clock3 size={16} />} />
              <StatPill label="Active lists" value={leadLists.length} icon={<LayoutTemplate size={16} />} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className={`px-3 py-2 text-sm rounded-lg border ${view === 'table' ? 'bg-white text-slate-900 border-white shadow' : 'border-white/40 text-white/90'}`} onClick={() => setView('table')}>
              <LayoutTemplate size={16} className="inline mr-2" /> Table view
            </button>
            <button className={`px-3 py-2 text-sm rounded-lg border ${view === 'kanban' ? 'bg-white text-slate-900 border-white shadow' : 'border-white/40 text-white/90'}`} onClick={() => setView('kanban')}>
              <Kanban size={16} className="inline mr-2" /> Kanban
            </button>
            <button className="px-3 py-2 text-sm rounded-lg border border-white/40 text-white/90 hover:text-white hover:border-white" onClick={() => setImportOpen((v) => !v)}>
              <Upload size={16} className="inline mr-2" /> Import
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="space-y-4">
          <div className="bg-white/80 border border-slate-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-800">Lead lists</p>
              <button
                className="text-xs text-indigo-600 flex items-center gap-1"
                onClick={async () => {
                  const name = prompt('List name');
                  if (!name) return;
                  const created = await leadService.createLeadList(name, role);
                  setLeadLists((prev) => [created, ...prev]);
                  setActiveList(created.id);
                }}
              >
                <Plus size={14} /> New
              </button>
            </div>
            <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
              {leadLists.map((list) => (
                <div key={list.id} className={`rounded-xl border px-3 py-2 transition shadow-sm ${activeList === list.id ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => setActiveList(list.id)} className="text-left flex-1">
                      <p className={`text-sm font-semibold ${activeList === list.id ? 'text-indigo-800' : 'text-slate-800'}`}>{list.name}</p>
                      <p className="text-[11px] text-slate-500">Tap to open & manage</p>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-2 rounded-lg bg-white text-slate-600 hover:text-indigo-600 border border-slate-200"
                        title="Quick add"
                        onClick={() => setActiveList(list.id)}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        className="p-2 rounded-lg bg-white text-slate-600 hover:text-indigo-600 border border-slate-200"
                        title="Import into this list"
                        onClick={() => {
                          setActiveList(list.id);
                          setImportOpen(true);
                        }}
                      >
                        <Upload size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck size={14} /> Super admins & admins can bulk import and add from every list.
            </div>
          </div>

          {importOpen && <ImportWizard onImport={handleImport} />}
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white/80 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Search size={16} className="text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search leads by name, phone, city, platform"
                  className="flex-1 bg-transparent focus:outline-none text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="px-3 py-2 text-sm border border-slate-200 rounded-lg flex items-center gap-1">
                  <Filter size={14} /> Filters
                </button>
                <button className="px-3 py-2 text-sm border border-slate-200 rounded-lg flex items-center gap-1" onClick={loadMore} disabled={!cursor}>
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {cursor ? 'Load more' : 'All loaded'}
                </button>
                <button
                  className="px-3 py-2 text-sm bg-slate-900 text-white rounded-lg flex items-center gap-1"
                  onClick={async () => {
                    if (!activeList) return;
                    const blob = await leadService.exportLeads(activeList, role);
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'leads.csv';
                    a.click();
                  }}
                >
                  <Download size={16} /> Export CSV
                </button>
              </div>
            </div>
          </div>

          <QuickAddLead onSubmit={handleCreateLead} loading={creating} />

          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 size={16} className="animate-spin" /> Loading leads...
            </div>
          )}

          {view === 'table' && !loading && <LeadsTable leads={leads} onEdit={handleEdit} height={540} />}

          {view === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(groupedStatuses).map(([statusId, bucket]) => (
                <div
                  key={statusId}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(statusId);
                  }}
                  className="bg-slate-50 rounded-2xl border border-slate-200 p-3 space-y-2 min-h-[220px]"
                >
                  <ColumnHeader label={statusId === 'backlog' ? 'Unassigned' : statusId} />
                  {bucket.slice(0, 20).map((lead) => (
                    <KanbanCard key={lead.id} lead={lead} onEdit={handleEdit} onDragStart={() => setDraggingLead(lead)} />
                  ))}
                  {bucket.length > 20 && <div className="text-xs text-slate-500">Load more from server per column</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadAdminPage;
