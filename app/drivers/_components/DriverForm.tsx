"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { driverSchema, type DriverInput } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function DriverForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DriverInput>({
    resolver: zodResolver(driverSchema),
      defaultValues: {
      name: "",
      phone: "",
      licenseNumber: "",
      joinDate: "",
      profileImageUrl: "",
      hidden: false,
    },
  });

  const onSubmit = async (data: DriverInput) => {
   const payload = {
      name: data.name,
      phone: data.phone,
      licenseNumber: data.licenseNumber,
      joinDate: data.joinDate,
      profileImageUrl: data.profileImageUrl,
    };
    const res = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? "Failed");
      return;
    }
     reset({
      name: "",
      phone: "",
      licenseNumber: "",
      joinDate: "",
      profileImageUrl: "",
      hidden: false,
    });
    alert("Driver registered!");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...register("name")} placeholder="Driver name" />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register("phone")} placeholder="+91 9XXXXXXXXX" />
          {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
        </div>
        <div className="grid gap-2">
                <Label htmlFor="licenseNumber">License No (optional)</Label>
          <Input id="licenseNumber" {...register("licenseNumber")} placeholder="DL-XXXX-0000" />
        </div>
        <div className="grid gap-2">
     <Label htmlFor="joinDate">Start Date</Label>
          <Input id="joinDate" type="date" {...register("joinDate")} />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Register Driver"}
        </Button>
          <Button
          type="button"
          variant="outline"
          onClick={() =>
            reset({
              name: "",
              phone: "",
              licenseNumber: "",
              joinDate: "",
              profileImageUrl: "",
              hidden: false,
            })
          }
        >
          Reset
        </Button>
      </div>

      <p className="text-xs text-slate-500">Hidden drivers are excluded from Add, Manage, and Performance pages.</p>
    </form>
  );
}
