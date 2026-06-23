# Multi-tenant Data Model (ER) — for sign-off

*How the database changes to support organizations, roles, and the club product — while keeping today's athlete data exactly as it is. Sign off alongside [05-permissions-and-roles.md](05-permissions-and-roles.md).*

## What "multi-tenant" adds

Today every table hangs off a single `user`. We add two small tables that introduce **organizations** without disturbing any existing training data:

- **`organizations`** — one row per box/gym.
- **`memberships`** — connects a user to an organization with a role. This is the heart of the whole permissions model.

Everything you already have (`sessions`, `personal_records`, `user_profile`, …) stays keyed on the user and untouched. A solo athlete simply has no membership rows.

## Every user is an athlete (including coaches)

"Athlete" is **not** a role — it's something *every* user is. A user's training data hangs off their user id, completely independent of any organization or role. So coaches, owners, and front-desk staff are all *also* athletes: each has their own personal training space, automatically.

- **No "athlete" role exists.** Roles (owner / coach / staff / member) only describe what you do *inside a box*. Personal training is always yours.
- **One role per box, additive capabilities.** At most one membership per org (`unique(organization_id, user_id)`); a coach can still self-serve as an athlete (log training, book a class). We deliberately do not model multiple roles per box — it keeps things simple; revisit only if a real need appears.
- **Different roles in different boxes** is fine (coach at Box A, member at Box B) — just two membership rows.

**Front-end consequence:** everyone gets the personal athlete experience; users with an org role get an added **context switch** ("My training" ⇄ "Coaching / Box"), not a separate account.

## The map (entity relationships)

```
        auth.users  (one login per person)
           │  1
           │
     ┌─────┴───────────────┐
     │ owns                │ N   (a person can be in many orgs, or none)
     ▼                     ▼
  TRAINING DATA        memberships ──N───1── organizations
  (user-owned)          (role: owner/             │ 1
   • user_profile        coach/staff/member)      │
   • sessions            • data_sharing flag       │ has
   • session_blocks                                ▼  N
   • block_sets                            class_templates
   • wods / wod_components                        │ 1
   • session_pain_alerts                          ▼ N
   • personal_records                      class_instances  (a class on the calendar)
   • body_metrics                                 │ 1
   • nutrition_logs                               ▼ N
   • programs / program_sessions            bookings ──N───1── auth.users (the member)
```

- **`auth.users` 1—N `memberships` N—1 `organizations`** — the many-to-many of people ⇄ boxes, each link carrying a role.
- **Training data stays user-owned.** A coach sees a member's data only via an active membership + the member's data-sharing setting (the decision in doc 05).
- **Club scheduling (Phase 2):** `class_templates` → `class_instances` (actual dated occurrences) → `bookings` (a member reserving a spot). Shown here for the full picture; built after the foundation.

## New tables (Phase 1 scope)

### `organizations`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| name | text | Box name |
| slug | text (unique) | URL-friendly handle |
| owner_user_id | uuid → auth.users | The creating owner |
| settings | jsonb | Branding, preferences |
| subscription_status | text | For billing later |
| created_at | timestamptz | |

### `memberships`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| organization_id | uuid → organizations | |
| user_id | uuid → auth.users | |
| role | text | owner / coach / staff / member (CHECK constraint) |
| status | text | active / invited / inactive |
| data_sharing | boolean | Member's training data visible to this org's coaches |
| created_at | timestamptz | |
| | | **Unique (organization_id, user_id)** — one membership per person per org |

## How permissions get enforced (RLS, extended)

Phase 0 policies key on `auth.uid() = user_id`. Phase 1 adds an organization dimension using a small helper:

```
-- SECURITY DEFINER helper: does the current user hold one of these roles in this org?
has_org_role(org_id, allowed_roles[])  ->  boolean
```

Then:
- **Org-scoped tables** (schedule, bookings, roster): policy calls `has_org_role(organization_id, ...)` with the roles allowed for that action (per the matrix in doc 05).
- **Training-data tables**: policy stays "owner can do everything", **plus** a read path for coaches/owners of an org the member belongs to *when `data_sharing` is on*.
- **Catalogs / feedback / views**: unchanged from Phase 0.

The point: the matrix in doc 05 maps almost one-to-one to these policies — sign off the matrix and the policies follow.

## What does NOT change

- All current training tables and their columns.
- Phase 0 owner policies (they remain the base; org rules layer on top).
- A solo athlete's experience — no membership, no org, identical to today.
