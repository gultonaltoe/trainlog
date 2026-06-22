# Security & Data Privacy (plain language)

*How we keep each user's data private and separated — and what we just fixed.*

## The problem we found

Trainlog's screens talk almost directly to the database (see [01-architecture.md](01-architecture.md)). The database is reached using a **public key** that ships inside every visitor's browser — that's normal and expected.

The danger: with that setup, the *only* thing stopping User A from seeing User B's data was a filter written in the **frontend** code ("only show rows where the owner is me"). But frontend code runs on the user's own device, where it can be changed. So a technical user could remove that filter and read everyone's data.

For a single-person app, that was harmless. With real beta users — and absolutely for storing a club's member data — it's a serious privacy hole and a legal (GDPR) problem.

## The fix, in two halves

### Half 1 — Identity cleanup ✅ (done)

Previously some screens identified "who you are" using a random ID stored in your browser, left over from before login existed. After we added real login, those screens could end up reading or writing under the *wrong* identity.

We replaced all of that with the **logged-in session** as the single source of truth for who you are. One consistent answer everywhere. (Done — committed.)

### Half 2 — Row Level Security (RLS) ⏳ (in progress)

**Row Level Security** is a privacy rule enforced by the **database itself**, not the frontend. Once switched on, the database refuses to return a row unless the rule says you're allowed to see it — even if someone tampered with the app on their phone.

The rule for most tables is simply: *"you can only touch rows that belong to you."*

Because the database enforces it, the protection can't be bypassed from a phone. This is the proper, industry-standard way to isolate users' data.

```
  BEFORE:  phone decides what you can see   ❌ (can be tampered with)
  AFTER:   database decides what you can see ✅ (cannot be bypassed)
```

## A subtlety: data that has no direct owner

Some data doesn't directly say who owns it. Example: an individual **set** of an exercise belongs to a **block**, which belongs to a **session**, which belongs to **you**. The set itself has no "owner" stamp.

For these, the privacy rule walks *up the chain*: "you can see this set if it rolls up to a session that belongs to you." This is why we need the exact shape of the database before writing the rules — getting the chain wrong would either lock people out or leak data. (That's the introspection step.)

## Shared reference data

A few tables are the same for everyone — the catalog of movements (Back Squat, Deadlift…), session types, etc. These are **read-only for all logged-in users** and not private. The privacy rules treat them differently on purpose.

## Why this also makes the product more portable

By moving the rules into the database and (next phase) putting a backend "core" in front of it, we stop trusting the phone for anything sensitive. That same change is what lets us move to bigger hosting later without rewriting the apps. Security and scalability get fixed by the same move.

## Hard rules we never break

- The **secret** database key (`service_role`) is never put in frontend code or committed — it would bypass every privacy rule. Only the public key is used in the app.
- Secrets and personal data files are never committed to GitHub.
