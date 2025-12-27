import { LeadList, LeadRecord, LeadImportResult } from '../types';

const API_BASE = '/api';

const parseJson = async (res: Response) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
};

export const leadService = {
  async listLeadLists(role: string): Promise<LeadList[]> {
    const res = await fetch(`${API_BASE}/lead-lists`, {
      headers: { 'x-user-role': role },
    });
    return parseJson(res);
  },
  async createLeadList(name: string, role: string): Promise<LeadList> {
    const res = await fetch(`${API_BASE}/lead-lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': role },
      body: JSON.stringify({ name }),
    });
    return parseJson(res);
  },
  async renameLeadList(id: string, name: string, role: string): Promise<LeadList> {
    const res = await fetch(`${API_BASE}/lead-lists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-role': role },
      body: JSON.stringify({ name }),
    });
    return parseJson(res);
  },
  async fetchLeads(params: { listId: string; role: string; view?: string; cursor?: string | null; limit?: number; q?: string; statusId?: string; assignedTo?: string; quick?: string; sort?: string; }): Promise<{ items: LeadRecord[]; nextCursor?: string | null }> {
    const query = new URLSearchParams();
    ['q', 'statusId', 'assignedTo', 'quick', 'sort', 'cursor', 'limit'].forEach((key) => {
      const value = (params as any)[key];
      if (value !== undefined && value !== null && value !== '') query.append(key, String(value));
    });
    const res = await fetch(`${API_BASE}/lead-lists/${params.listId}/${params.view === 'kanban' ? 'kanban' : 'leads'}?${query.toString()}`, {
      headers: { 'x-user-role': params.role },
    });
    return parseJson(res);
  },
  async updateLead(id: string, patch: Partial<LeadRecord>, role: string): Promise<LeadRecord> {
    const res = await fetch(`${API_BASE}/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-role': role },
      body: JSON.stringify(patch),
    });
    return parseJson(res);
  },
  async importLeads(listId: string, file: File, options: { dedupeMode: string; columnMap?: any; defaultCountry?: string; role: string; }): Promise<LeadImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dedupeMode', options.dedupeMode);
    if (options.defaultCountry) formData.append('defaultCountry', options.defaultCountry);
    if (options.columnMap) formData.append('columnMap', JSON.stringify(options.columnMap));
    const res = await fetch(`${API_BASE}/lead-lists/${listId}/import`, {
      method: 'POST',
      headers: { 'x-user-role': options.role },
      body: formData,
    });
    return parseJson(res);
  },
  async exportLeads(listId: string, role: string): Promise<Blob> {
    const res = await fetch(`${API_BASE}/lead-lists/${listId}/export`, {
      headers: { 'x-user-role': role },
    });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },
};
