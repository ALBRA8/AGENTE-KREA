# Task: Integrate Product Routes into AppShell & Dashboard

## Agent: ProductDashboard Integration Agent
## Task ID: product-dashboard-integration

## Summary

Integrated Product Architect routes into the KREA V2 AppShell and Dashboard by:

1. **AppShell Navigation** — Added "PRODUCT ARCHITECT" section to sidebar with 4 nav items:
   - Oportunidades (Lightbulb icon, ✨ badge)
   - Dossiers (FolderOpen icon)
   - Producción (Factory icon)
   - Handoff (Send icon)

2. **AppShell Routing** — Added 4 new route cases in `renderPage()`:
   - `product-opportunities` → `<ProductDashboard initialSection="opportunities" />`
   - `product-dossiers` → `<ProductDashboard initialSection="dossiers" />`
   - `product-production` → `<ProductDashboard initialSection="production" />`
   - `product-handoff` → `<ProductDashboard initialSection="handoff" />`

3. **ProductDashboard.tsx** — Created full component with:
   - **OpportunitiesSection**: Create form + list with fit scores + status badges
   - **DossiersSection**: List with pipeline progress bars + detail view with JSON toggle
   - **ProductionSection**: Start production form + job list with progress bars + polling
   - **HandoffSection**: Summary stats + list with action buttons (ready/send/acknowledge/complete)
   - Framer Motion animations, shadcn/ui components, consistent dark theme design

4. **API Routes** — Created/updated 7 route files using Prisma db:
   - `/api/product/opportunities` — GET (list) + POST (create)
   - `/api/product/dossiers` — GET (list) + POST (create)
   - `/api/product/dossiers/[id]` — GET (detail with JSON parsing)
   - `/api/product/produce` — GET (producing dossiers) + POST (start production)
   - `/api/product/produce/[id]` — GET (poll progress)
   - `/api/product/handoff` — GET (list) + POST (create)
   - `/api/product/handoff/[id]` — POST (action transitions)

## Files Modified
- `src/components/app/AppShell.tsx` — Added imports, nav section, routing
- `src/components/app/ProductDashboard.tsx` — New (full component)

## Files Created
- `src/components/app/ProductDashboard.tsx`
- `src/app/api/product/opportunities/route.ts`
- `src/app/api/product/dossiers/route.ts`
- `src/app/api/product/dossiers/[id]/route.ts`
- `src/app/api/product/produce/route.ts`
- `src/app/api/product/produce/[id]/route.ts`
- `src/app/api/product/handoff/route.ts`
- `src/app/api/product/handoff/[id]/route.ts`

## Pre-existing lint issues (not introduced by this change)
- `react-hooks/set-state-in-effect` in AppShell.tsx, AdnDashboard.tsx, dashboard/page.tsx
- `jsx-a11y/alt-text` warnings in AppShell.tsx
- Various issues in scripts/, SettingsPage.tsx, hooks/use-mobile.ts
