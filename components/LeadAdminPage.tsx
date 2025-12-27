import React, { useEffect, useMemo, useState } from 'react';
import { leadService } from '../services/leadsService';
import { LeadList, LeadRecord, LeadImportResult } from '../types';
import { Plus, Upload, Download, LayoutTemplate, Kanban, Search, Filter, Loader2, Phone, Calendar, MapPin } from 'lucide-react';
import { FixedSizeList as VirtualList } from 'react-window';
import { motion } from 'framer-motion';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

interface LeadAdminPageProps {
  role: string;
}

const ColumnHeader: React.FC<{ label: string } > = ({ label }) => (
  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</div>
);

const LeadRow: React.FC<{ lead: LeadRecord; onEdit: (lead: LeadRecord, patch: Partial<LeadRecord>) => void; } > = ({ lead, onEdit }) => {
  return (
    <div className="grid grid-cols-6 gap-3 px-3 py-2 bg-white/70 rounded-lg shadow-sm border border-slate-100">
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold text-slate-800">{lead.name}</div>
        <span className="text-xs text-indigo-600 bg-indigo-50 px-2 rounded-full">{lead.platform}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <Phone size={14} className="text-slate-400" />
        <button className="text-indigo-600 hover:underline" onClick={() => window.open(`tel:${lead.phone_normalized}`)}>{lead.phone_normalized}</button>
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
    </div>
  );
};

const KanbanCard: React.FC<{ lead: LeadRecord; onEdit: (lead: LeadRecord, patch: Partial<LeadRecord>) => void; }> = ({ lead, onEdit }) => (
  <motion.div layout className="bg-white rounded-lg shadow-sm border border-slate-100 p-3 space-y-2">
    <div className="flex items-center justify-between">
      <div className="font-semibold text-slate-800">{lead.name}</div>
      <span className="text-xs text-indigo-600 bg-indigo-50 px-2 rounded-full">{lead.platform}</span>
    </div>
    <div className="text-sm text-slate-600 flex items-center gap-1">
      <Phone size={14} className="text-slate-400" />
      <button className="text-indigo-600" onClick={() => window.open(`tel:${lead.phone_normalized}`)}>{lead.phone_normalized}</button>
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
  </motion.div>
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
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Upload size={18} className="text-indigo-600" />
        <div>
          <p className="text-sm font-semibold text-slate-800">Import leads</p>
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
      <button disabled={!file || loading} onClick={handleSubmit} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
        {loading && <Loader2 size={14} className="animate-spin" />} Start import
      </button>
      {summary && (
        <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3">
          Imported {summary.importedCount}, updated {summary.updatedCount}, skipped {summary.skippedCount}
          {summary.errors.length > 0 && (
            <ul className="list-disc ml-4 mt-2 text-rose-500">
              {summary.errors.slice(0, 3).map((e) => (
                <li key={e.row}>Row {e.row}: {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const LeadsTable: React.FC<{ leads: LeadRecord[]; onEdit: (lead: LeadRecord, patch: Partial<LeadRecord>) => void; height: number; }> = ({ leads, onEdit, height }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style} className="px-1">
      <LeadRow lead={leads[index]} onEdit={onEdit} />
    </div>
  );
  return <VirtualList height={height} itemCount={leads.length} itemSize={96} width="100%" className="rounded-xl border border-slate-100 bg-slate-50"> <Row /> </VirtualList>;
};

const LeadAdminPage: React.FC<LeadAdminPageProps> = ({ role }) => {
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [activeList, setActiveList] = useState<string>('');
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [statusBuckets, setStatusBuckets] = useState<Record<string, LeadRecord[]>>({});

  useEffect(() => {
    leadService.listLeadLists(role).then((lists) => {
      setLeadLists(lists);
      if (lists.length > 0) setActiveList(lists[0].id);
    });
  }, [role]);

  useEffect(() => {
    if (!activeList) return;
    setLoading(true);
    leadService.fetchLeads({ listId: activeList, role, q: query, limit: 200 }).then((data) => {
      setLeads(data.items);
      setCursor(data.nextCursor || null);
      setLoading(false);
    });
  }, [activeList, query, role]);

  const handleEdit = async (lead: LeadRecord, patch: Partial<LeadRecord>) => {
    const optimistic = leads.map((l) => l.id === lead.id ? { ...l, ...patch } : l);
    setLeads(optimistic);
    try {
      const updated = await leadService.updateLead(lead.id, patch, role);
      setLeads((prev) => prev.map((l) => l.id === lead.id ? updated : l));
    } catch (err) {
      setLeads(leads);
      console.error(err);
    }
  };

  const handleImport = async (file: File, dedupeMode: string) => {
    if (!activeList) throw new Error('Select a list');
    return leadService.importLeads(activeList, file, { dedupeMode, role });
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

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const leadId = result.draggableId;
    const statusId = result.destination.droppableId;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    handleEdit(lead, { status_id: statusId });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Driver Leads Management</h1>
          <p className="text-sm text-slate-500">Import, dedupe, and organize driver leads efficiently.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 bg-white border border-slate-200 rounded-lg flex items-center gap-2" onClick={() => setView('table')}>
            <LayoutTemplate size={16} /> Table
          </button>
          <button className="px-3 py-2 bg-white border border-slate-200 rounded-lg flex items-center gap-2" onClick={() => setView('kanban')}>
            <Kanban size={16} /> Kanban
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Lead lists</p>
            <button className="text-xs text-indigo-600 flex items-center gap-1" onClick={async () => {
              const name = prompt('List name');
              if (!name) return;
              const created = await leadService.createLeadList(name, role);
              setLeadLists((prev) => [created, ...prev]);
              setActiveList(created.id);
            }}><Plus size={14} /> New</button>
          </div>
          <div className="space-y-2">
            {leadLists.map((list) => (
              <button key={list.id} onClick={() => setActiveList(list.id)} className={`w-full text-left px-3 py-2 rounded-lg border ${activeList === list.id ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-700'}`}>
                {list.name}
              </button>
            ))}
          </div>
          <ImportWizard onImport={handleImport} />
          <button
            onClick={async () => {
              if (!activeList) return;
              const blob = await leadService.exportLeads(activeList, role);
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'leads.csv';
              a.click();
            }}
            className="w-full flex items-center gap-2 justify-center px-3 py-2 text-sm bg-slate-900 text-white rounded-lg"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>

        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <Search size={16} className="text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads" className="flex-1 bg-transparent focus:outline-none text-sm" />
              </div>
              <button className="px-3 py-2 text-sm border border-slate-200 rounded-lg flex items-center gap-1"><Filter size={14} /> Filters</button>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-600"><Loader2 size={16} className="animate-spin" /> Loading leads...</div>
          )}

          {view === 'table' && !loading && (
            <LeadsTable leads={leads} onEdit={handleEdit} height={520} />
          )}

          {view === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DragDropContext onDragEnd={onDragEnd}>
                {Object.entries(groupedStatuses).map(([statusId, bucket]) => (
                  <Droppable droppableId={statusId} key={statusId}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2 min-h-[200px]">
                        <ColumnHeader label={statusId === 'backlog' ? 'Unassigned' : statusId} />
                        {bucket.slice(0, 20).map((lead, idx) => (
                          <Draggable draggableId={lead.id} index={idx} key={lead.id}>
                            {(dragProvided) => (
                              <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}>
                                <KanbanCard lead={lead} onEdit={handleEdit} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {bucket.length > 20 && <div className="text-xs text-slate-500">Load more from server per column</div>}
                      </div>
                    )}
                  </Droppable>
                ))}
              </DragDropContext>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadAdminPage;
