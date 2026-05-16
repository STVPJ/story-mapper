# StoryMapper -- Security Overview

## Design Philosophy

StoryMapper is a **local-first** application. By default, all data stays in your browser's IndexedDB -- nothing leaves your machine, no account is needed, and no network requests are made. There is no server to attack, no API to abuse, and no user credentials to steal.

However, the codebase has been designed from the ground up with a **cloud-ready security posture**. An optional Supabase backend can be enabled for multi-device sync, and when it is, every layer of the application enforces defence in depth: database-level access control, validated inputs, strict content security, and minimal trust in the client.

This document covers security at both tiers: the local default and the optional cloud mode.

---

## Local Mode (Default)

### No Network Surface

When running in local mode (no `VITE_SUPABASE_URL` configured), the application makes **zero network requests**. The Supabase SDK is not loaded at all -- it is behind a dynamic import that only fires when cloud credentials are present. The production bundle in local mode contains no authentication code, no API client, and no outbound fetch calls.

### Browser-Sandboxed Storage

All data is stored in IndexedDB, which is sandboxed by the browser's same-origin policy. Other websites cannot read, write, or enumerate your story maps. Each map is stored as a single self-contained record, so there are no cross-record references that could leak data through timing or enumeration attacks.

### No Credentials, No Secrets

Local mode requires no environment variables, API keys, or credentials of any kind. There is nothing to leak, rotate, or misconfigure.

### Import Validation

Even in local mode, all imported JSON files are rigorously validated before they enter the system. Files are parsed with `JSON.parse` (no `eval`, no `Function` constructor) and immediately validated through a Zod schema (`importSchema.safeParse()`) which enforces:

| Field | Constraint |
|---|---|
| Map name | Max 200 characters |
| Feature / Epic / Story titles | Max 500 characters |
| Descriptions | Max 10,000 characters |
| Acceptance criteria | Max 10,000 characters |
| Release name | Max 200 characters |
| Release colour | Must match `/^#[0-9a-fA-F]{6}$/` |
| Features per import | Max 100 |
| Epics per feature | Max 50 |
| Stories per epic | Max 200 |

Any field that fails validation is rejected with a specific error message. Malformed data never reaches the store or the storage adapter. Imported entities are assigned fresh UUIDs generated via `crypto.randomUUID()`, so there is no risk of ID collision or injection through crafted identifiers.

---

## Cloud Mode (Optional Supabase Backend)

When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, StoryMapper connects to a Supabase PostgreSQL instance for multi-device sync. The following security measures apply in this mode.

### Architecture

```
Browser (React SPA)
        |
        |  HTTPS only, JWT bearer token
        |
        v
Supabase (managed PostgreSQL + Auth)
        |
        |  Row-Level Security on every table
        |
        v
PostgreSQL (Supabase-managed)
```

There is **no custom backend server**. The browser talks directly to Supabase's PostgREST API over HTTPS. All authorisation is enforced at the database layer.

### Authentication

- **GitHub OAuth only** -- no passwords are stored or managed by the application.
- The OAuth flow is handled entirely by Supabase Auth, which issues short-lived JWTs and enforces PKCE.
- The OAuth redirect URL is explicitly scoped to `window.location.origin`, preventing open-redirect attacks.
- Session tokens are managed by the Supabase SDK (stored in the browser, auto-refreshed). No manual token handling exists in application code.
- No service-role key, signing secret, or admin credential appears anywhere in the client codebase.

### Invite-Only Access Control

Authentication alone does not grant access. An allowlist gate requires that the user's email exists in the `allowed_users` table:

1. User authenticates via GitHub OAuth.
2. The app checks the `allowed_users` table for a matching email.
3. If absent, the user sees an access request form (not the application).
4. An admin approves or denies the request from the Manage Access panel.
5. On next visit, the allowlist check passes and the user gains access.

### Data Isolation -- Row-Level Security

All five data tables have **RLS enabled** with CRUD policies enforcing `auth.uid() = user_id`:

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `story_maps` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `features` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `epics` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `stories` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `releases` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |

This means:

- **No user can read, write, modify, or delete another user's data** -- enforced at the PostgreSQL level, not in application code.
- Even if someone crafted a malicious API request with a valid JWT, they would only see their own rows.
- The `user_id` column has a foreign key constraint to `auth.users.id`, preventing spoofing.
- The `user_id` is always set from the authenticated session within the `SupabaseAdapter`, never from user input.

### Data in Transit

- All communication uses **HTTPS** (TLS). Supabase enforces HTTPS on its API endpoint.
- The Supabase anon key included in the client is a **public, non-secret key** by design -- it only grants access to the PostgREST API, with RLS determining what data is returned. It cannot bypass security policies.

### Data at Rest

- Data is stored in Supabase's managed PostgreSQL instance.
- Supabase encrypts data at rest using AES-256 on the underlying AWS infrastructure.
- Backups are managed by Supabase per their platform policies.

### Database Constraints

Beyond RLS, the database enforces:

- **Foreign key integrity** -- all child records reference valid parents.
- **Hex colour validation** -- release colours must match `^#[0-9a-fA-F]{6}$`.
- **Not-null constraints** on required fields.

---

## Application-Level Security (Both Modes)

### XSS Protection

The codebase contains **zero instances** of `dangerouslySetInnerHTML` or direct `innerHTML` assignment. All user-entered content (titles, descriptions, acceptance criteria) is rendered as React text nodes, which are automatically escaped by React's rendering engine. Event handlers use function references, not string attributes.

### Injection Protection

- **No raw SQL** -- all Supabase queries go through the parameterised PostgREST API. SQL injection is not possible.
- **No `eval` or `Function` constructor** -- JSON imports use `JSON.parse` only.
- **No template string interpolation** into queries or markup.

### Cryptographic Randomness

All entity IDs (maps, features, epics, stories, releases) are generated using `crypto.randomUUID()`, the browser's cryptographically secure UUID generator. No sequential or predictable identifiers are used anywhere.

### Minimal Dependencies

The application has no analytics, tracking, telemetry, or external CDN scripts. All dependencies are bundled at build time. The runtime dependency list is deliberately small: React, Zustand, @dnd-kit, Zod, and Lucide React. The Supabase SDK is only included in the bundle when cloud mode is active (dynamic import).

### Error Handling

Internal errors are caught and displayed as generic user-facing messages via toast notifications. No stack traces, database error details, or internal state are exposed in the UI. Failed optimistic updates are automatically rolled back and the store re-fetches from the storage adapter to ensure consistency.

### Secrets Management

No secrets are committed to the repository. The `.env.local` file is listed in `.gitignore`. The `.env.example` template contains only commented-out placeholders with no real values.

---

## What Data is Stored

Only story mapping content you enter:

- Map names
- Feature, Epic, and Story titles, descriptions, and acceptance criteria
- Release names and colours
- Ordering and position data

No telemetry, analytics, or tracking data is collected. In local mode, no data leaves the browser at all. In cloud mode, no PII beyond what's in your GitHub profile (used for authentication) is stored.

---

## What the App Does NOT Do

- No collaboration or sharing -- strictly single-user per account (cloud mode) or per browser (local mode)
- No file uploads or storage of binary data
- No custom backend servers or serverless functions
- No email, notifications, or webhooks
- No access to other users' data (RLS enforced in cloud mode; browser sandboxing in local mode)

---

## Export Security

- **JSON export** produces a local file containing your map data. The file is not encrypted -- treat it like any other work document.
- **CSV exports** (Jira and Azure DevOps formats) contain the same data in a flat structure. These are generated entirely in the browser and downloaded directly; no server processing is involved.
- **JSON import** validates structure and enforces the size limits documented above. Imported data is assigned to the current user (cloud mode) or the local browser store (local mode).

---

## Security Headers (Cloud Deployment)

When deployed to a CDN such as Vercel, the following HTTP security headers are recommended:

| Header | Value | Purpose |
|---|---|---|
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `Content-Security-Policy` | Restrict scripts, styles, connections to self + Supabase origin | Prevents XSS, data exfiltration |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `Permissions-Policy` | Camera, microphone, geolocation disabled | Blocks unnecessary browser APIs |

The CSP should restrict `connect-src` to only the app's own origin and the Supabase project URL, preventing data from being sent to unauthorised endpoints.

---

## Risk Summary

| Risk Area | Local Mode | Cloud Mode |
|---|---|---|
| Data isolation | Strong (browser same-origin policy) | Strong (RLS on all tables) |
| Authentication | N/A (no auth needed) | Strong (GitHub OAuth, no passwords) |
| Transport security | N/A (no network) | Strong (HTTPS enforced) |
| Injection attacks (SQL/XSS) | Strong (React escaping, no eval) | Strong (parameterised queries, React escaping) |
| Input validation | Strong (Zod schemas on import) | Strong (Zod schemas + DB constraints) |
| Third-party data sharing | None (fully offline) | None (no analytics, no external APIs) |
| Secrets exposure | None (no secrets exist) | Low risk (only public anon key in client) |
| Audit logging | Not implemented | Not implemented |
| Data at rest encryption | Browser-managed | Supabase/AWS managed (AES-256) |

For cloud deployments, evaluate whether Supabase's SOC 2 Type II compliance and your chosen hosting region meet your organisation's data residency and vendor management requirements. Supabase's security documentation is at [supabase.com/security](https://supabase.com/security).
