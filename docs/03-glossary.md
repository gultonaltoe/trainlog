# Glossary — Technical Terms in Plain Language

Quick reference for the words used across these docs and in our conversations.

| Term | Plain meaning |
|------|---------------|
| **Frontend** | What you see and tap. Runs on the user's phone/browser. |
| **Backend** | The logic and rules that run on a server, not the user's device. |
| **Database** | Where data is stored (sessions, PRs, profiles). Ours is Postgres. |
| **Postgres** | The most widely trusted open-source database. Portable between hosts. |
| **Supabase** | A service that bundles a Postgres database + login + auto-generated access. Our current backend-in-a-box. |
| **Vercel** | Where the app is hosted/served. Scales automatically. |
| **RLS (Row Level Security)** | A privacy rule enforced *by the database itself*: it refuses to return a row unless you're allowed to see it. Can't be bypassed from a phone. |
| **anon key / public key** | The non-secret key that lets the app reach the database. It's meant to be public; RLS is what makes that safe. |
| **service_role key** | The *secret* master key that bypasses all privacy rules. Never goes in frontend code. Server-only. |
| **Session (login session)** | Proof that you're logged in. We use it as the single source of truth for "who you are." |
| **Magic link** | Passwordless login: we email you a link, clicking it logs you in. |
| **Multi-tenant** | Many organizations (e.g. gyms) share one system but are fully walled off from each other. |
| **Organization** | In the club product: one box/gym. |
| **Membership** | The link between a person and an organization, carrying their role. |
| **Role (RBAC)** | What someone is allowed to do, based on their job: owner / coach / staff / member. RBAC = Role-Based Access Control. |
| **Migration** | A database change written down as a file and version-controlled, instead of clicked by hand in a dashboard. Makes changes repeatable and reviewable. |
| **Schema** | The structure of the database: what tables exist and what columns they have. |
| **Introspection** | Asking the database to describe its own structure (tables, columns, links), so we can build correct rules on top. |
| **Foreign key** | A link from one table to another (e.g. a "set" points to the "session" it belongs to). |
| **Type / TypeScript types** | A written description of the shape of data, so the code catches mistakes before users do. |
| **Typegen (`supabase gen types`)** | Auto-generating those type descriptions *from the real database*, so code and database can't silently drift apart. |
| **Monorepo** | One code repository holding multiple projects (e.g. athlete app + club app + shared core) side by side. |
| **Shared core / domain layer** | The backend "brain" both apps share: data rules + the intelligence engine. |
| **Intelligence engine** | Our PR detection, training analysis, recommendations, and AI photo-reading — the strategic asset. |
| **CI (Continuous Integration)** | Automatic checks (does it build? do types pass?) that run every time we save code, catching breakage early. |
| **POC (Proof of Concept)** | An early version built to prove the idea works before investing in the polished, scalable build. |
| **PR** | Ambiguous on purpose: in fitness = **Personal Record**; in coding = **Pull Request** (a proposed code change). Context decides. |
