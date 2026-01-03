"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Row shape coming from app/weekly/manage/page.tsx
export type Row = {
  id: number;
  driverName: string;
  driverId: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  earnings: number;
  trips: number;
  notes: string;
};

interface Props {
  // NOTE: At runtime this may be undefined/null, so the component defensively
  // falls back to an empty array. Server code should still try to always
  // provide an array, even if it's empty.
  initialRows: Row[] | null | undefined;
}

type SortKey = "driverName" | "weekStart" | "weekEnd" | "earnings" | "trips";

export default function DeleteWeeklyTableClient({ initialRows }: Props) {
  // In dev, surface a warning if we don't get an array as expected.
  if (process.env.NODE_ENV !== "production" && !Array.isArray(initialRows)) {
    console.warn(
      "DeleteWeeklyTableClient: expected initialRows to be an array, but got",
      initialRows,
    );
  }

  const safeInitialRows = Array.isArray(initialRows) ? initialRows : [];

  // Local copy of rows so edits/deletes show immediately on /weekly/manage
  // Guard against initialRows being null/undefined to avoid spread errors.
  const [rows, setRows] = useState<Row[]>(() => [...safeInitialRows]);

  // Editing state for a single row
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftEarnings, setDraftEarnings] = useState("");
  const [draftTrips, setDraftTrips] = useState("");
  const [draftNotes, setDraftNotes] = useState("");

  // Simple Excel‑style filter + sort
  const [filterText, setFilterText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("weekStart");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // ───────────────── helpers ─────────────────
  const startEdit = (row: Row) => {
    const ok = window.confirm("Do you want to edit this weekly entry?");
    if (!ok) return;

    setEditingId(row.id);
    setDraftEarnings(row.earnings.toString());
    setDraftTrips(row.trips.toString());
    setDraftNotes(row.notes ?? "");
  };

  const saveEdit = async (row: Row) => {
    const ok = window.confirm("Save changes to this weekly entry?");
    if (!ok) return;

    const earningsNumber = Number(draftEarnings);
    const tripsNumber = Number(draftTrips);

    if (!Number.isFinite(earningsNumber) || earningsNumber < 0) {
      alert("Please enter a valid Earnings (>= 0).");
      return;
    }

    if (!Number.isInteger(tripsNumber) || tripsNumber < 0) {
      alert("Please enter a valid Trips value (whole number >= 0).");
      return;
    }

    const res = await fetch(`/api/weekly/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        earnings: earningsNumber,
        trips: tripsNumber,
        notes: draftNotes,
      }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => null);
      alert(j?.error ?? "Failed to update weekly entry");
      return;
    }

    const updated = await res.json().catch(() => null);

    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              earnings:
                typeof updated?.earnings === "number"
                  ? updated.earnings
                  : typeof updated?.earningsInINR === "number"
                  ? updated.earningsInINR
                  : earningsNumber,
              trips:
                typeof updated?.trips === "number"
                  ? updated.trips
                  : typeof updated?.tripsCompleted === "number"
                  ? updated.tripsCompleted
                  : tripsNumber,
              notes: typeof updated?.notes === "string" ? updated.notes : draftNotes,
            }
          : r,
      ),
    );

    // Exit edit mode
    setEditingId(null);
  };

  const handleDelete = async (row: Row) => {
    const ok = window.confirm(
      "Delete this weekly entry? This will remove it from the Manage page and the Performance page.",
    );
    if (!ok) return;

    const res = await fetch(`/api/weekly/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      alert(j?.error ?? "Failed to delete weekly entry");
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== row.id));
    if (editingId === row.id) setEditingId(null);
  };

  const toggleSort = (key: SortKey) => {
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        return currentKey;
      }
      setSortDirection("asc");
      return key;
    });
  };

  const displayRows = useMemo(() => {
    let data = [...rows];

    // Filter similar to Excel search box
    if (filterText.trim()) {
      const term = filterText.trim().toLowerCase();
      data = data.filter((r) => {
        return (
          r.driverName.toLowerCase().includes(term) ||
          r.weekStart.toLowerCase().includes(term) ||
          r.weekEnd.toLowerCase().includes(term) ||
          (r.notes ?? "").toLowerCase().includes(term)
        );
      });
    }

    // Sort by selected column
    if (sortKey) {
      data.sort((a, b) => {
        let aVal: string | number = a[sortKey];
        let bVal: string | number = b[sortKey];

        if (typeof aVal === "string" && typeof bVal === "string") {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [rows, filterText, sortKey, sortDirection]);

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span className="ml-1 text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  // ───────────────── Manual test cases (for you to try) ─────────────────
  // 1. initialRows = undefined/null (e.g. API returns nothing): component should
  //    render with 0 rows and NOT crash.
  // 2. initialRows = []: table loads with "No weekly entries found" message.
  // 3. initialRows with 2+ entries: verify sorting (click each header), filter
  //    (type in driver name / notes), Edit → Save, and Delete flows.
  // 4. Try entering negative earnings/trips: save should be blocked with
  //    validation alerts.

  // ───────────────── render ─────────────────
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="font-medium text-sm text-slate-700">Total Entries: {rows.length}</div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Filter</span>
          <Input
            placeholder="Search driver, dates or notes..."
            className="max-w-xs"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => toggleSort("driverName")}
                >
                  Driver
                  {renderSortIndicator("driverName")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => toggleSort("weekStart")}
                >
                  Week Start
                  {renderSortIndicator("weekStart")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => toggleSort("weekEnd")}
                >
                  Week End (Sun)
                  {renderSortIndicator("weekEnd")}
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  className="flex items-center gap-1 ml-auto"
                  onClick={() => toggleSort("earnings")}
                >
                  Earnings (INR)
                  {renderSortIndicator("earnings")}
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  className="flex items-center gap-1 ml-auto"
                  onClick={() => toggleSort("trips")}
                >
                  Trips
                  {renderSortIndicator("trips")}
                </button>
              </TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row) => {
              const isEditing = row.id === editingId;

              return (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{row.driverName}</TableCell>
                  <TableCell className="whitespace-nowrap">{row.weekStart}</TableCell>
                  <TableCell className="whitespace-nowrap">{row.weekEnd}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={0}
                        value={draftEarnings}
                        onChange={(e) => setDraftEarnings(e.target.value)}
                      />
                    ) : (
                      row.earnings.toLocaleString("en-IN")
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={draftTrips}
                        onChange={(e) => setDraftTrips(e.target.value)}
                      />
                    ) : (
                      row.trips
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {isEditing ? (
                      <Input value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} />
                    ) : (
                      <span className="line-clamp-2 break-words text-sm">{row.notes}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap space-x-2">
                    <Button
                      size="sm"
                      variant={isEditing ? "default" : "outline"}
                      onClick={() => (isEditing ? saveEdit(row) : startEdit(row))}
                    >
                      {isEditing ? "Save" : "Edit"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(row)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!displayRows.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500">
                  No weekly entries found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
