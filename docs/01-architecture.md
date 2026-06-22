# Architecture — How Trainlog is Built (plain language)

*How the pieces fit together, explained without code.*

## The three layers of any web app

Think of any app as three layers:

1. **The frontend** — what you see and tap (screens, buttons). Runs in your phone's browser.
2. **The backend** — the logic and rules ("is this user allowed to do that?", "calculate this PR"). Runs on a server.
3. **The database** — where the data actually lives (your sessions, PRs, profile).

## How Trainlog is built *today*

Today, Trainlog is mostly **frontend + database**, with very little backend in between:

```
  Your phone (frontend)  ───────────►  Database (Supabase)
       React screens                    Postgres tables
```

The screens talk almost **directly** to the database. This was fast to build and fine for one user. But it has two consequences we're now fixing:

- **Trust problem:** because the phone talks straight to the database, the database has to be the thing that enforces "you can only see *your* data." (That's what RLS does — see [02-security-and-data.md](02-security-and-data.md).)
- **Hard to move later:** the database-specific code is scattered across many screens, so swapping databases or hosting later would mean touching everything.

> Note: people sometimes call this a "low-code" setup. It isn't really — it's real code. What makes it *feel* low-code is (a) the database structure was edited by hand in a web dashboard instead of being written down as files, and (b) the missing backend layer. Both are on the fix list.

## Where we're going — the "shared core"

We introduce the missing **backend layer** and turn it into a **shared core** that both apps sit on:

```
        ┌──────────────────────────────────────────────┐
        │              SHARED CORE                       │
        │  • Database (multi-tenant, privacy-enforced)   │
        │  • Backend logic / rules (the "domain layer")  │
        │  • Intelligence engine (PRs, analysis, AI)     │
        └───────────────┬───────────────┬───────────────┘
                        │               │
            ┌───────────▼──────┐  ┌─────▼──────────────┐
            │  Athlete app     │  │  Club app          │
            │  (B2C)           │  │  (B2B scheduling)  │
            └──────────────────┘  └────────────────────┘
```

Why this matters in plain terms:

- **The apps stop talking to the database directly.** They talk to *our* core. So if we later move to bigger hosting, that's an internal change in the core — the apps don't notice.
- **Both apps share one brain.** PR detection, analysis, recommendations are written once in the core and used by both. No duplication.
- **"Separate projects that merge later" becomes real.** The two apps live in one repository (a "monorepo") next to the shared core — separate enough to build in parallel, connected enough to share everything that matters.

## Multi-tenant — the key new concept for the club product

Right now every account is a lone individual. The club product needs **organizations**:

- An **organization** = one box/gym.
- A **membership** connects a person to an organization, with a **role**: owner, coach, staff, or member.
- Your training data stays *yours*, but you can choose to share it with your box so coaches can see it.

"Multi-tenant" just means: many organizations live in the same system, fully walled off from each other. (See [03-glossary.md](03-glossary.md).)

## The technology choices (and why they're safe long-term)

| Piece | What we use | Why it's a safe long-term bet |
|-------|-------------|-------------------------------|
| Frontend | Next.js / React | Industry standard, used by huge companies. |
| Database | Postgres (via Supabase) | The most trusted open database. Portable — not locked to Supabase. |
| Hosting | Vercel | Scales automatically; no servers to babysit. |
| AI | Claude | Powers photo→workout and recommendations. |

The stack scales to very large products. The thing that needs work isn't the stack — it's adding the shared core so our *usage* of it scales too.
