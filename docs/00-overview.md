# Trainlog — Product & Vision Overview

*Plain-language docs for understanding the product as it grows. No coding knowledge required.*

## What Trainlog is today

A training journal for athletes (CrossFit focus). You log sessions, the app detects your personal records (PRs), and you can snap a photo of a gym whiteboard and the AI fills in the workout for you. It's currently in **private beta** — a small group of real users logging in by magic link (email link, no password).

## Where it's going — three products on one foundation

The big idea: Trainlog isn't one app, it's a **platform** with three products that share the same engine and data.

| # | Product | Who pays | What it is |
|---|---------|----------|------------|
| **A** | **Athlete app + performance platform** | Athletes (B2C) | The app you have today, made excellent — plus the intelligence layer (recommendations, analysis, progress tracking). |
| **B** | **Club / box management** | Gyms & boxes (B2B) | Scheduling, class booking, member management, staff/coach management. A replacement for tools like ResaWod. |
| **C** | **Coach ↔ athlete marketplace** | Both sides (later) | Matching athletes with coaches using the platform's data: goals, history, recommendations. |

## The strategic asset: the intelligence engine

The single most valuable thing we're building isn't any one of the three apps — it's the **data + intelligence engine** underneath them: PR detection, training analysis, load management, rest-day recommendations, photo→workout reading. All three products plug into it. It's the moat: the more athletes and clubs use it, the smarter and more valuable it gets.

## How we're building it (the principle)

- **Foundation first.** Get security and the data model right before adding features. (We're doing this now — see [02-security-and-data.md](02-security-and-data.md).)
- **Two apps, one shared core.** The athlete app and the club app are built in parallel as separate projects, but they sit on **one shared core** (database + engine). This is what lets them "merge" cleanly later. (See [01-architecture.md](01-architecture.md).)
- **Treat today's stack as the proven starting point**, designed so we can move to bigger/proper hosting later without a rewrite.

## How to read these docs

- **[01-architecture.md](01-architecture.md)** — how the app is built, in plain terms.
- **[02-security-and-data.md](02-security-and-data.md)** — how your users' data is kept private and separate.
- **[03-glossary.md](03-glossary.md)** — every technical term used here, explained simply.

The full technical roadmap lives in the approved plan file (`~/.claude/plans/humming-wandering-haven.md`).
