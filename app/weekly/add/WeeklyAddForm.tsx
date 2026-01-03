"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { weeklyEntrySchema, type WeeklyEntryInput } from "@/lib/validations";
import { addDaysToISODate, formatWeekRange, getWeekKeyISO } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


type DriverOpt = { id: string; name: string };
type NormalizedEntry = WeeklyEntryInput & { weekEnd: string; weekStart: string };

type ExistingEntry = {
  id: number | string;
  weekStart?: string;
  weekEnd?: string;
  driver?: { id: string; name: string };
};
export default function WeeklyAddForm({ drivers }: { drivers: DriverOpt[] }) {
  const form = useForm<WeeklyEntryInput>({
    resolver: zodResolver(weeklyEntrySchema),
    defaultValues: {
      weekStart: "",
      earnings: 0,
      trips: 0,
      notes: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
  } = form;

  const ws = watch("weekStart");
  const weekPreview = useMemo(() => (ws ? formatWeekRange(ws) : ""), [ws]);

 const [duplicateEntry, setDuplicateEntry] = useState<ExistingEntry | null>(null);
  const [pendingPayload, setPendingPayload] = useState<NormalizedEntry | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);

  const clearDuplicateState = () => {
    setDuplicateEntry(null);
    setPendingPayload(null);
    setIsConfirmOpen(false);
  };

  const submitPayload = async (payload: NormalizedEntry) => {
    const res = await fetch("/api/weekly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j?.error ?? "Failed to save weekly entry");
      return;
    }
    reset();
    toast.success("Weekly entry saved");
  };

  const onSubmit = async (data: WeeklyEntryInput) => {
      const normalizedWeekStart = getWeekKeyISO(data.weekStart);
    const weekEnd = addDaysToISODate(normalizedWeekStart, 6);
    const payload = { ...data, weekStart: normalizedWeekStart, weekEnd };

try {
      const params = new URLSearchParams({
        driverId: payload.driverId,
        rangeStart: normalizedWeekStart,
        rangeEnd: weekEnd,
      });
      const dupRes = await fetch(`/api/weekly?${params.toString()}`);
      if (!dupRes.ok) {
        throw new Error("Failed to verify duplicates");
      }
      const existing = await dupRes.json();
      if (Array.isArray(existing) && existing.length) {
        setDuplicateEntry(existing[0]);
        setPendingPayload(payload);
        setIsConfirmOpen(true);
        return;
      }
    } catch (err) {
      toast.error("Unable to check existing entries. Please try again.");
      return;
    }

      await submitPayload(payload);
  };

  const handleOverride = async () => {
    if (!duplicateEntry || !pendingPayload) return;
    setIsOverriding(true);
    const res = await fetch(`/api/weekly/${duplicateEntry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
        weekStart: pendingPayload.weekStart,
        weekEnd: pendingPayload.weekEnd,
        earnings: pendingPayload.earnings,
        trips: pendingPayload.trips,
        notes: pendingPayload.notes ?? "",
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j?.error ?? "Failed to override weekly entry");
      setIsOverriding(false);
      return;
    }
    toast.success("Weekly entry updated");
    reset();
 setIsOverriding(false);
    clearDuplicateState();

  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="driverId">Driver</Label>
          <select id="driverId" className="mt-2 w-full rounded-md border p-2" {...register("driverId")}>
            <option value="">Select driver…</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {errors.driverId && <p className="mt-1 text-sm text-red-600">{errors.driverId.message}</p>}
        </div>
        <div>
          <Label htmlFor="weekStart">Week Start (Monday)</Label>
          <Input id="weekStart" type="date" {...register("weekStart")} />
          {errors.weekStart && <p className="mt-1 text-sm text-red-600">{errors.weekStart.message}</p>}
          {weekPreview && <p className="text-xs text-slate-500 mt-1">{weekPreview}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="earnings">Earnings (INR)</Label>
          <Input id="earnings" type="number" step="1" {...register("earnings")} />
          {errors.earnings && <p className="mt-1 text-sm text-red-600">{errors.earnings.message}</p>}
        </div>
        <div>
          <Label htmlFor="trips">Trips</Label>
          <Input id="trips" type="number" step="1" {...register("trips")} />
          {errors.trips && <p className="mt-1 text-sm text-red-600">{errors.trips.message}</p>}
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          className="mt-2 w-full rounded-md border p-2"
          rows={4}
          {...register("notes")}
          placeholder="Optional notes"
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Checking…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={() => reset()}>
          Reset
        </Button>
      </div>
      <Dialog
        open={isConfirmOpen}
        onOpenChange={(next) => {
          setIsConfirmOpen(next);
          if (!next) {
            clearDuplicateState();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entry already exists</DialogTitle>
            <DialogDescription>
              {duplicateEntry?.driver?.name || "This driver"} already has an entry for this
              week. Do you want to replace it with the new earnings and trips?
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Week of {pendingPayload?.weekStart} → {pendingPayload?.weekEnd}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={clearDuplicateState} disabled={isOverriding}>
              Cancel
            </Button>
            <Button type="button" onClick={handleOverride} disabled={isOverriding}>
              {isOverriding ? "Updating…" : "Override entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
