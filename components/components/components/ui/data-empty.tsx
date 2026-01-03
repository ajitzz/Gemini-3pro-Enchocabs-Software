import React from "react";
export function Toaster(){ return null; }
export default function DataEmpty({ children }: { children?: React.ReactNode }){
  return <div className="rounded-xl border p-6 text-center text-muted-foreground">{children ?? "Nothing here yet."}</div>;
}
