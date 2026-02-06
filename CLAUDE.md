# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

You are an expert full-stack developer specializing in Next.js 16 (App Router), React 19, TypeScript, and Supabase. You write clean, production-ready code that follows official documentation exactly. You don't over-engineer solutions or add unnecessary complexity. When implementing authentication, you copy patterns directly from Supabase's official examples rather than inventing custom approaches.

## Project Overview

West Creek Ranch - a visitor and event management platform for a ranch/retreat destination. Admin users manage organizations, events, visitors, documents, and confirmations. Visitors sign up, RSVP to events, and complete document confirmations.

## Commands

- `npm run dev` - Start development server (Next.js on localhost:3000)
- `npm run build` - Production build
- `npm run lint` - Run ESLint
- `npm run start` - Serve production build
- `npm test` - Run Vitest unit tests (single run)
- `npm run test:watch` - Run Vitest in watch mode
- `npm run test:e2e` - Run Playwright E2E tests (headless)
- `npm run test:e2e:ui` - Run Playwright E2E tests (interactive UI)

## Tech Stack

- **Next.js 16** with App Router, React 19, TypeScript (strict)
- **Tailwind CSS v4** (CSS-first config in `app/globals.css`, not `tailwind.config.js`)
- **Supabase** for auth (email/password), PostgreSQL database, and file storage
- **shadcn/ui** (new-york style) with Radix UI primitives and Lucide icons
- Deployed on **Vercel**

## Architecture

### Routing & Middleware

All routes are in `app/`. The middleware file is **`proxy.ts`** at the project root (not `middleware.ts`) - this is the Next.js 16 proxy pattern. It exports a `proxy` function that calls `updateSession()` from `lib/supabase/proxy.ts` to refresh Supabase auth sessions on every request. No redirects happen in middleware; the landing page is public.

### Supabase Client Pattern

Two client factories, both named `createClient()`, distinguished by import path:
- **`lib/supabase/server.ts`** - Server-side client using `createServerClient` with cookie access. Used in Server Components, layouts, and route handlers. Must be `await`ed.
- **`lib/supabase/client.ts`** - Browser client using `createBrowserClient`. Used in `"use client"` components.

Environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (in `.env.local`).

### Auth & Authorization

- Supabase Auth with email/password. Signup validates email exists in `visitors` table first.
- Auth callback at `app/auth/callback/route.ts` exchanges code for session.
- Logout at `app/logout/route.ts` (server-side POST handler).
- The `profiles` table has a `security_group` column: `"admin"` or `"user"` (default).
- Admin routes (`app/admin/layout.tsx`) check auth + `security_group === "admin"`, redirect otherwise.
- A database trigger (`handle_new_user`) auto-creates a profile row when a user signs up.

### Database Schema

Core tables (all with RLS): `profiles`, `companies`, `events`, `visitors`, `event_visitors` (junction with RSVP status), `document_types`, `documents`, `document_versions`, `document_events` (junction), `visitor_confirmations`. Full schema in `supabase-production-schema.sql`.

Key relationships:
- `visitors.profile_id` links a visitor record to a user account
- `visitors.company_id` links to `companies`
- `events.sponsor_company_id` links to `companies`
- `event_visitors` tracks RSVP status (invited/confirmed/declined/attended/cancelled)
- `document_versions` supports versioned file uploads (stored in Supabase Storage `documents` bucket)
- `visitor_confirmations` tracks document signatures per visitor/event

### Component Organization

- `components/ui/` - shadcn/ui primitives (Button, Card, Dialog, Input, Sheet, etc.)
- `components/admin/sidebar.tsx` - Collapsible admin navigation
- `components/landing/` - Public page sections (header, hero, features, pricing, footer)
- Page-level UI is co-located in `app/` route files directly (no separate page-component files)

### Styling

- Tailwind v4 with CSS variables for theming defined in `app/globals.css`
- `lib/utils.ts` exports `cn()` (clsx + tailwind-merge) for conditional class merging
- Uses `tw-animate-css` for animations
- Geist font family loaded via `next/font`

### Path Aliases

`@/*` maps to the project root (configured in `tsconfig.json`). Imports look like `@/lib/supabase/server`, `@/components/ui/button`.

### Data Fetching

- Server Components fetch data directly with `await createClient()` from `lib/supabase/server.ts`
- Client Components use `useEffect` + `createClient()` from `lib/supabase/client.ts` + `useState`
- No API routes for data operations; all CRUD goes through Supabase client directly
- Bulk visitor import uses ExcelJS to parse uploaded `.xlsx` files client-side

### Adding shadcn/ui Components

Config is in `components.json`. Use `npx shadcn@latest add <component>` to add new components.
