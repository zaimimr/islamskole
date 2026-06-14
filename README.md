# Islamskole Bærum

Website for Islamskole Bærum, a Sunday Islamic school in Bærum, Norway.

## Stack

- **Next.js 16.2.9** with App Router and Turbopack
- **React 19**
- **Tailwind CSS v4**
- **shadcn/ui** for components
- **next-intl v4** for Norwegian/English i18n (locale prefix `/no`, `/en`)
- **Supabase** for database, auth and file storage

## Local development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`. The middleware redirects `/` to `/no` automatically.

You also need a local Supabase stack running:

```bash
supabase start
```

On first run Docker pulls images - this takes a few minutes. After that, create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from `supabase status --output env`>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status --output env`>
```

To reset the local database and re-apply all migrations including seed data:

```bash
supabase db reset
```

## Changing colors and theme

All design tokens live in one place: `src/app/globals.css`. Edit the CSS variables under `:root` and `.dark` to change the color scheme across the entire site.

## Supabase cloud setup

These steps must be done by the site owner when deploying to production.

### 1. Create a project

Go to [supabase.com](https://supabase.com), create a new project and note the **Project URL**, **anon key** and **service_role key** from Project Settings > API.

### 2. Set environment variables

Add these to your hosting provider (e.g. Vercel):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

### 3. Push migrations to cloud

```bash
supabase link --project-ref <project-ref>
supabase db push
```

This applies all migrations in `supabase/migrations/` to the cloud database, including the schema and seed data.

### 4. Disable public sign-ups

In the Supabase dashboard, go to **Authentication > Settings** and set **Enable sign ups** to off. This ensures only admin users you create explicitly can log in.

### 5. Create an admin user

In the Supabase dashboard, go to **Authentication > Users** and click **Add user**. The `on_auth_user_created` trigger automatically inserts a row in `profiles` with `role = 'admin'`, so any user created this way becomes an admin immediately.

### 6. Refresh TypeScript types

After making schema changes on cloud, regenerate types locally:

```bash
supabase gen types typescript --linked > src/lib/supabase/types.ts
```

For local changes, use:

```bash
supabase gen types typescript --local > src/lib/supabase/types.ts
```

## Storage

The `media` storage bucket is public for reads. Admins can upload, update and delete files. Bucket is created by the migration so no manual setup is needed.
