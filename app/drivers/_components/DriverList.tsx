"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type Driver = {
  id: string;
  name: string;
  phone?: string | null;
  licenseNo?: string | null;
  profileImageUrl: string | null;
  hidden: boolean;
};

export default function DriverList({ initialDrivers }: { initialDrivers: Driver[] }) {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);

  const onDelete = async (id: string) => {
    if (!confirm("Delete driver permanently? This will remove all weekly entries.")) return;
    const res = await fetch(`/api/drivers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? "Delete failed");
      return;
    }
    setDrivers((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left">Driver</th>
            <th className="px-4 py-3 text-left">Phone</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.id} className="border-t">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={d.profileImageUrl ?? ""} alt={d.name} />
                    <AvatarFallback>{d.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {d.name}
                      {d.hidden ? " (hidden)" : ""}
                    </div>
                    <div className="text-xs text-slate-500">{d.licenseNo ?? "—"}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="text-sm">{d.phone ?? "—"}</div>
              </td>
              <td className="px-4 py-3 text-right space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const res = await fetch(`/api/drivers/${d.id}/toggle`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ hidden: !d.hidden }),
                    });
                    if (res.ok) {
                      setDrivers((prev) =>
                        prev.map((x) => (x.id === d.id ? { ...x, hidden: !x.hidden } : x))
                      );
                    } else {
                      const j = await res.json().catch(() => ({}));
                      alert(j?.error ?? "Failed");
                    }
                  }}
                >
                  {d.hidden ? "Unhide" : "Hide"}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(d.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
          {!drivers.length && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                No drivers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
