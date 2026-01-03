import React from "react";
import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

import Header from "@/components/header/Header";
import { RouteThemeProvider } from "@/components/theme/RouteThemeProvider";
import { Toaster } from "@/components/ui/sonner";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400","500","600","700"],   // add the weights you’ll use
  display: "swap",
  variable: "--font-sans",
});



export const metadata: Metadata = {
 title: "ENCHO — Taxi Rental for Drivers",
  description:
    "Accommodation, food, vehicles — healthy environment to empower drivers to earn more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
      <html lang="en" className={`${montserrat.variable}`}>
      <head>
              <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />

      </head>
      <body>
    <RouteThemeProvider>
          <Header />
          {children}
           <Toaster richColors closeButton />
        </RouteThemeProvider>
      </body>
    </html>
  );
}
