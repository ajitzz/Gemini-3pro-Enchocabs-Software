# Mobile Admin Redesign (Travel-first)

## Information architecture
- **Daily Entry (Primary flow):** sticky context chips (quick mode, completeness, sync) → quick entry form → bottom action bar.
- **Profit/Loss Dashboard:** period toggles (daily/weekly/monthly) → KPI cards (revenue/cost/profit/loss alerts) → what changed insights → deep links.
- **Data Quality:** inline required checks + suspicious/outlier warnings + duplicate detection + confirmation summary.
- **Reliability:** local draft autosave + offline queue sync status.

## UX rationale
- Optimized for one-hand operation with fixed bottom action area and minimum 44px touch targets.
- Reduced cognitive load by making Quick Entry default and keeping one clear primary action.
- Guardrails are visible before submit, preventing silent data gaps.
- Mobile analytics emphasizes scanability in <10 seconds through compact KPI cards.
