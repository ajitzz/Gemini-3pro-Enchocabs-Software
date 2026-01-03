// app/drivers/_components/DriversClient.tsx
"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
/* ----------------------------- Forms & Types ---------------------------- */

const formSchema = z.object({
  name: z.string().min(2, "Enter full name"),
  licenseNumber: z.string().min(3, "Licence number is too short"),
  phone: z.string().min(1, "Phone is required"), // server normalizes to digits
  joinDate: z.string().min(1, "Pick a date"),    // yyyy-mm-dd
  profileImageUrl: z
    .string()
    .url("Enter a valid URL")
    .optional()
    .or(z.literal(""))
    .optional(),
});

type FormValues = z.infer<typeof formSchema>;

export type DriverListItem = {
  id: string;
  name: string;
  licenseNumber: string;
  phone: string;
  joinDate: string | null; // yyyy-mm-dd
  profileImageUrl: string;
  hidden: boolean;
  createdAt: string;
};

/* --------------------------------- UI ---------------------------------- */

export default function DriversClient({ initialDrivers }: { initialDrivers: DriverListItem[] }) {
  const [drivers, setDrivers] = useState<DriverListItem[]>(initialDrivers);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError, // <-- used for server-side field errors
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  // Optional: re-hydrate from API on mount (keep commented if SSR list is enough)
  useEffect(() => {
    // fetch("/api/drivers").then(r => r.json()).then(setDrivers).catch(() => {});
  }, []);

  /* ------------------------------ Handlers ------------------------------ */

  const onCreate = async (v: FormValues) => {
      const normalizedLicense = v.licenseNumber.trim().toLowerCase();
    const duplicate = drivers.find((d) => d.licenseNumber.trim().toLowerCase() === normalizedLicense);
    if (duplicate) {
      toast.warning("Licence already registered", {
        description: `${v.licenseNumber} belongs to ${duplicate.name}.`,
      });
      return;
    }


    const res = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });

    // Validation errors from API (422) -> map into RHF errors
    if (res.status === 422) {
      const j = await res.json();
      const fieldErrors = j?.issues?.fieldErrors ?? {};
      Object.entries(fieldErrors).forEach(([field, msgs]) => {
        if (Array.isArray(msgs) && msgs[0]) {
          setError(field as keyof FormValues, { type: "server", message: String(msgs[0]) });
        }
      });
      if (!Object.keys(fieldErrors).length) {
          toast.error(j?.error ?? "Validation failed");
      }
      return;
    }

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
     toast.error(j?.error ?? "Failed to create driver");
      return;
    }

    const created = await res.json();
    const item: DriverListItem = {
      id: created.id,
      name: created.name,
      licenseNumber: created.licenseNumber ?? "",
      phone: created.phone ?? "",
      joinDate: created.joinDate?.slice?.(0, 10) ?? null,
      profileImageUrl: created.profileImageUrl ?? "",
      hidden: !!created.hidden,
      createdAt: created.createdAt,
    };
    setDrivers((prev) => [item, ...prev]);
    reset();
    toast.success("Driver registered");
  };

  const onToggleHidden = async (id: string, nextHidden: boolean) => {
    const res = await fetch(`/api/drivers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: nextHidden }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
        toast.error(j?.error ?? "Failed to update");
      return;
    }
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, hidden: nextHidden } : d)));
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete driver permanently? This also removes all weekly entries.")) return;
    const res = await fetch(`/api/drivers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
         toast.error(j?.error ?? "Delete failed");
      return;
    }
    setDrivers((prev) => prev.filter((d) => d.id !== id));
  };

  /* -------------------------------- Render ------------------------------ */

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-6">
      <h1 className="text-2xl font-bold">/drivers</h1>

      {/* Create Form */}
      <Card className="p-5">
        <h3 className="mb-4 text-base font-semibold">Register New Driver</h3>
        <form onSubmit={handleSubmit(onCreate)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Driver Name</Label>
            <Input placeholder="Aarav Kumar" {...register("name")} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <Label>Licence Number</Label>
            <Input placeholder="DL-123-456" {...register("licenseNumber")} />
            {errors.licenseNumber && (
              <p className="mt-1 text-xs text-red-600">{errors.licenseNumber.message}</p>
            )}
          </div>

          <div>
            <Label>Phone</Label>
            <Input placeholder="10-digit or +91..." {...register("phone")} />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
          </div>

          <div>
            <Label>Join Date</Label>
            <Input type="date" {...register("joinDate")} />
            {errors.joinDate && <p className="mt-1 text-xs text-red-600">{errors.joinDate.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <Label>Profile Image URL (optional)</Label>
            <Input placeholder="https://..." {...register("profileImageUrl")} />
            {errors.profileImageUrl && (
              <p className="mt-1 text-xs text-red-600">{errors.profileImageUrl.message}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              Create Driver
            </Button>
          </div>
        </form>
      </Card>

      {/* List */}
      <section>
        <h2 className="mb-3 text-base font-semibold">Drivers</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drivers.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {d.profileImageUrl ? (
                      <AvatarImage src={d.profileImageUrl} alt={d.name} />
                    ) : (
                      <AvatarFallback>{(d.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{d.name}</div>
                    <div className="text-xs text-muted-foreground">DL: {d.licenseNumber || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      📞 {d.phone || "—"} · Joined {d.joinDate || "—"}
                    </div>
                    {d.hidden && <Badge className="mt-1" variant="secondary">Hidden</Badge>}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {d.hidden ? (
                  <Button size="sm" onClick={() => onToggleHidden(d.id, false)}>Unhide</Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => onToggleHidden(d.id, true)}>
                    Hide
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => onDelete(d.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
