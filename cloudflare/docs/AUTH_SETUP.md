# Auth setup (Houdini Bet)

## Secrets (nunca en git)

```bash
cd cloudflare
# 32+ bytes random hex
npx wrangler secret put AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
# optional fixed public origin for OAuth redirect:
# npx wrangler secret put AUTH_PUBLIC_ORIGIN
# value e.g. https://houdini-bet.ivanmarrtin2703.workers.dev
```

## Google Cloud

1. Create OAuth client (Web application).
2. Authorized redirect URIs:
   - `https://houdini-bet.ivanmarrtin2703.workers.dev/api/v1/auth/google/callback`
   - `https://houdini-bet.pages.dev/api/v1/auth/google/callback` (if Host is pages.dev)
3. Enable Google+ / People API / userinfo scopes (openid email profile).

## Migrate

```bash
npx wrangler d1 migrations apply houdini-bet-db --remote
```

Includes `0029_users_auth.sql` (users + sessions) and `0030_users_username.sql` (`username` UNIQUE, nullable for Google).

## Register / login

- Register fields: **username** (ID, `^[a-z0-9_]{3,20}$`, UI example `ej. usuario01`), name, email, phone, password (+ confirm).
- Login accepts **username or email** in `identifier` (legacy body `email` still accepted).
- Password managers: `autocomplete="username"` on ID / login identifier; `new-password` / `current-password` on passwords.
- After email register: welcome banner ~3s, then centered Premium upsell modal (`POST /api/v1/premium/session`).
- Stripe subscriptions (Mensual/Trimestral/Anual): see [`STRIPE_SETUP.md`](./STRIPE_SETUP.md).

## Account self-service

- `POST /api/v1/auth/change-password` — body `{ currentPassword, newPassword, newPassword2 }` (password accounts only).
- `GET /api/v1/auth/export` — JSON portability dump (profile, sessions, premium refs, support tickets).
- `POST /api/v1/auth/delete` — hard-delete user + sessions; scrub linked support tickets when table exists.
- `POST /api/v1/support/tickets` — contact / complaint form (D1 `support_tickets`, migration `0042`). After insert, Worker tries to email the inbox (see Support email below). Response includes `emailed: true|false`.

## Support email (inbox notify)

Tickets always land in D1 (admin panel → Soporte). To also receive them in Gmail:

```bash
cd cloudflare
# Inbox (secret; never shown in public UI)
npx wrangler secret put SUPPORT_INBOX_EMAIL
# value: ivanmarrtin2703@gmail.com

# Resend API key (required for real inbox delivery today)
# 1) Create free account at https://resend.com
# 2) API Keys → Create → copy
# 3) With free sandbox from-address, Resend only delivers to your verified Resend email
npx wrangler secret put RESEND_API_KEY

# Optional: custom from after verifying a domain in Resend
# npx wrangler secret put SUPPORT_FROM_EMAIL
# value e.g. Houdini Analytics <noreply@yourdomain.com>
```

Without `RESEND_API_KEY`, the ticket is still saved (`ok: true`, `emailed: false`) and visible in admin. Optional Cloudflare Email Sending binding (`EMAIL` + onboarded domain + `SUPPORT_FROM_EMAIL`) is a fallback if configured later.

## Smoke

- Register via UI → `GET /api/v1/auth/me` returns user with `username`
- Login with username or email
- Logout → me returns `{ user: null }`
- Google only works after secrets + redirect URIs
- Change password (password provider) + export JSON from Perfil

