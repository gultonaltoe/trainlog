# Permissions & Roles (RBAC) — for sign-off

*This defines who can do what once the club/box product exists. Sign off on this before any code is written. Plain-language; no coding needed.*

## The mental model

- A **user** is one person with one login (your athletes today).
- An **organization** is one box/gym/club.
- A **membership** connects a user to an organization and carries their **role**. One user can belong to several organizations (e.g. coach at one box, member at another), or to none (a solo athlete — that's product A today).

So permissions are always answered as: *"What is this user's role in **this** organization?"*

## The four roles

| Role | Who | In one line |
|------|-----|-------------|
| **Owner** | Box owner / manager | Full control of their organization, including billing and staff. |
| **Coach** | Coaches | Run the training side: schedule, programming, see members' progress. |
| **Staff** | Front desk / admin | Run the day-to-day: bookings, check-ins, member admin. No training/billing depth. |
| **Member** | Athletes | Book classes, follow programming, own their training data. |

Plus, outside the org model:
- **Solo athlete** = a user with no organization. Owns only their own training data (product A today).
- **Platform admin** = us / back-office. Uses the secret `service_role` key for support and operations; never a normal app role.

## The matrix (role × what they can do)

✅ full · 👁️ read-only · ⚠️ own records only · ❌ none

| Capability | Owner | Coach | Staff | Member |
|---|:---:|:---:|:---:|:---:|
| Organization settings & branding | ✅ | ❌ | ❌ | ❌ |
| Billing & subscription | ✅ | ❌ | ❌ | — |
| Invite/manage staff & assign roles | ✅ | 👁️ | ❌ | ❌ |
| Member roster (add / edit / remove) | ✅ | 👁️ | ✅ | ❌ |
| Class schedule & templates | ✅ | ✅ | ✅ | 👁️ |
| Programming / WODs (publish to members) | ✅ | ✅ | ❌ | 👁️ |
| Bookings — any member | ✅ | ✅ | ✅ | ⚠️ own |
| Check-in / attendance | ✅ | ✅ | ✅ | 👁️ own |
| A member's training data (sessions, PRs) | 👁️\* | 👁️\* | ❌ | ✅ own |
| Org reports & analytics | ✅ | 👁️ | 👁️ | ❌ |
| Announcements / messaging | ✅ | ✅ | ✅ | 👁️ |

\* Subject to the member's data-sharing setting — see the decision below.

## Key decision needed from you ⚠️

**Can a box's coaches see a member's training data by default?**

This is a privacy/GDPR-sensitive choice, so it's yours to make. Options:

- **A (recommended): Shared by default, member can revoke.** When you join a box, its coaches can see your logged training data, with a clear toggle in your profile to turn it off. Best coaching experience; transparent.
- **B: Private by default, member opts in.** Coaches see nothing until the member explicitly shares. Most privacy-conservative; more friction, weaker coaching value out of the box.

Either way: a member always sees their *own* data fully, and data is **never** visible across organizations or to other members.

## Principles that hold regardless of role

1. **Members own their training data.** Org roles get *visibility* (when shared), never ownership.
2. **No cross-organization leakage.** Your role in box X grants nothing in box Y.
3. **Least privilege.** Staff can run the desk without seeing coaching analytics or billing.
4. **Enforced in the database.** These rules become RLS policies (see [06-multi-tenant-data-model.md](06-multi-tenant-data-model.md)), not just UI hiding — same principle as Phase 0.
