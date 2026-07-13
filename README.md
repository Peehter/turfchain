# TurfChain — real backend setup

This is a standalone project wired to your real Supabase database.

## 1. Create the storage bucket (for property documents)
In Supabase: menu (☰) → **Storage** → **New bucket** → name it exactly `documents` → set it **Private** (not public) → Create.

## 2. Make yourself an admin
1. Sign up in the app once (via the "Sign in" → "Sign up" screen) using your real email.
2. Confirm your email (check inbox).
3. In Supabase → **SQL Editor** → run:
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'your-email@example.com');
   ```
   Replace with the email you signed up with. Now you'll see the "Review queue" tab.

## 3. Push this to GitHub (no computer needed)
- Go to github.com on your phone browser → **New repository** → name it `turfchain` → Create.
- On the empty repo page, tap **uploading an existing file**.
- Upload every file in this folder, keeping the same folder structure (`src/` files go inside a `src` folder — GitHub's uploader supports dragging a whole folder, or you can create the `src` folder first by naming a file `src/App.jsx` when uploading).
- Commit.

## 4. Deploy on Vercel
- Go to vercel.com → sign in with GitHub → **Add New Project** → select the `turfchain` repo.
- Framework preset: Vite (should auto-detect).
- Deploy. You'll get a live URL in about a minute.

## What's wired up right now
- Real sign up / sign in (email + password)
- Real listings stored in Postgres
- Real document upload to Supabase Storage, hashed with SHA-256 in-browser
- Admin-only review queue enforced by Row Level Security (not just hidden in the UI — the database itself rejects the request if you're not an admin)

## What's not wired up yet (still simulated or removed for this pass)
- Messaging/chat, realtor Trust Score profiles, and the featured-listing payment flow from the earlier prototype aren't in this version yet — they need a bit more backend work (real-time subscriptions for chat, and a Paystack Edge Function for payments). Let's add those next once this is deployed and working.
