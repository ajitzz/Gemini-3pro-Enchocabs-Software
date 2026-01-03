import React from "react";

export class QueryClient {}

export const QueryClientProvider: React.FC<{ client: QueryClient; children?: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);
