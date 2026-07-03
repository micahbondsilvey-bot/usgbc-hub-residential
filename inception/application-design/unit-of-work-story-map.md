# Unit-of-Work ↔ Story Map — GBCI Certify: LEED Residential

Maps every user story (Epics 1–11 in `aidlc-docs/inception/user-stories/stories.md`) to exactly one
unit. Build order column matches `unit-of-work.md`.

## Per-Unit Story Lists

### Unit 1 — Platform Foundation (Build Order 1)
| Story | Title | Personas | FR/NFR | Status |
|---|---|---|---|---|
| US-1.1 | Email/password registration & login | P1, P2, P3, P4 | FR-1.1, NFR-5.2/5.3 | [x] U1 |
| US-1.2 | Manage basic profile | All | FR-1.3 | [x] U1 |
| US-1.3 | Password reset & email verification (mocked delivery) | All | FR-1.4 | [x] U1 |
| US-1.4 | Pre-seeded demo accounts | All | FR-1.5, NFR-6.2 | [x] U1 |
| US-2.6 | Invite users to a project (membership half) | P1, P2 | Personas, FR-11 | [x] U1 (membership half) |
| US-11.1 | RBAC (four roles + per-project hybrid) | All | FR-11.1/.2, NFR-5.1 | [x] U1 |
| US-11.3 | Audit trails & timestamps | All | NFR-2.3 | [x] U1 |

### Unit 2 — LEED Catalog & Scorecard (Build Order 2)
| Story | Title | Personas | FR/NFR | Status |
|---|---|---|---|---|
| US-3.1 | Seed real LEED v4.1 SF credit catalog | system / P2/P3 | FR-3.8, NFR-2.4 | [x] U2 |
| US-3.2 | View scorecard with categories and credits | All | FR-3.1/3.2 | [x] U2 |
| US-3.3 | Toggle attempted credits & enter points (flag-and-override) | P2 | FR-3.3/3.4 | [x] U2 |
| US-3.4 | Live summary bar with certification level (PBT invariants) | All | FR-3.5, NFR-3.1, NFR-4.1 | [x] U2 |
| US-3.5 | Scorecard view-tab filtering | P2, P3 | FR-3.6, FR-4.6 | [x] U2 (placeholder tabs disabled until U4) |
| US-3.6 | Editable project-info panel | P1, P2 | FR-3.7 | [x] U2 (read-only; editing in U3) |

### Unit 3 — Project Registration & Fees (Build Order 3)
| Story | Title | Personas | FR/NFR | Status |
|---|---|---|---|---|
| US-2.1 | Register an individual project (agreement w/ name + date) | P1, P2 | FR-2.1/2.3/2.4 | [x] U3 |
| US-2.2 | Generate GBCI-Certify project number (post-payment) | P1, P2 | FR-2.7, NFR-2.1 | [x] U3 |
| US-2.3 | Capture payment/commitment, generate invoice & confirmation email | P1, P2 | FR-2.5/2.4/2.7, Q9/Q10 | [x] U3 |
| US-2.4 | Bulk register via Excel (idempotent re-upload) | P1, P2 | FR-2.6, NFR-3.2, NFR-4.1 | [x] U3 |
| US-2.5 | Edit registration details post-registration | All | FR-2.8 | [x] U3 |
| US-2.6 | Invite users to a project (UI side) | P1, P2 | Personas, FR-11 | [x] U3 |

### Unit 4 — Workbook (Build Order 4)
| Story | Title | Personas | FR/NFR | Status |
|---|---|---|---|---|
| US-4.1 | Scorecard↔Workbook binding | P2 | FR-4.7 | [x] U4 |
| US-4.2 | Field Verification section | P2 | FR-4.2 | [x] U4 |
| US-4.3 | Submittals with named upload slots (expanded file types, local storage) | P2 | FR-4.3, NFR-1.4, NFR-3.2 | [x] U4 |
| US-4.4 | Three-column verification notes (Provider QC) | P2, P3 | FR-4.4, FR-11 | [x] U4 |
| US-4.5 | Section collapse/expand | P2, P3 | FR-4.1/4.5 | [x] U4 |

### Unit 5 — Review Workflow & State-Locking (Build Order 5)
| Story | Title | Personas | FR/NFR | Status |
|---|---|---|---|---|
| US-7.1 | Submit for review with phase selection (prelim before final; final skippable) | P2 | FR-7.1/7.2 | [x] U5 |
| US-7.3 | Reviewer credit-by-credit decisions & award points | P3 | FR-7.5 | [x] U5 |
| US-7.4 | Auto-generate & return review report (reviewer first, then GR) | P3, P2 | FR-7.6 | [x] U5 |
| US-7.6 | Accept certification or continue to next phase | P1, P2 | FR-7.7 | [x] U5 |
| US-7.7 | Reviewer enters submittal quality score (authoritative on entry) | P3 | FR-7.8, FR-10.5 | [x] U5 |
| US-11.2 | Submission state-locking (stateful PBT) | P2, P3, P4 | FR-7.4 | [x] U5 |

### Unit 6 — Portfolio (Build Order 6)
| Story | Title | Personas | FR/NFR | Status |
|---|---|---|---|---|
| US-5.1 | Designate a portfolio anchor | P1, P2 | FR-5.1/5.4, NFR-2.2 | [x] U6 |
| US-5.2 | Portfolio dashboard | P1, P2 | FR-5.2 | [x] U6 |
| US-5.3 | Pay & submit portfolio together | P1, P2 | FR-5.3, FR-7.3 | [x] U6 |
| US-7.2 | Batch submit (anchor failure cascades to children) | P2 | FR-7.3 | [x] U6 |

### Unit 7 — Dashboards & Notifications (Build Order 7)
| Story | Title | Personas | FR/NFR | Status |
|---|---|---|---|---|
| US-7.8 | Workflow notifications (mocked delivery) | All | FR-7.9 | [x] U7 |
| US-10.1 | Project dashboard | P1 | FR-10.1 | [x] U7 |
| US-10.2 | Green Rater dashboard | P2 | FR-10.2 | [x] U7 |
| US-10.3 | Reviewer dashboard | P3 | FR-10.3 | [x] U7 |
| US-10.4 | Admin pipeline view & assignment | P4 | FR-10.4 | [x] U7 |
| US-10.5 | Admin inputs or revises Green Rater quality scores | P4 | FR-7.8, FR-10.5 | [x] U7 |

### Unit 8 — Mocked AI (Build Order 8)
| Story | Title | Personas | FR/NFR | Status |
|---|---|---|---|---|
| US-6.1 | Run completeness & consistency check (mocked) | P2 | FR-6.1/6.2/6.3, NFR-3.3/3.4 | [x] U8 |
| US-8.1 | Reviewer pre-review analysis (mocked) | P3, P2 | FR-8.1/8.2/8.3 | [x] U8 |

### Unit 9 — Mobile/PWA & Scheduling (Build Order 9)
| Story | Title | Personas | FR/NFR | Status |
|---|---|---|---|---|
| US-7.5 | Schedule review call via MS Bookings (mocked/link-out) | P3, P2 | FR-7.6 | [x] U9 |
| US-9.1 | Responsive PWA layout | All | FR-9.1/9.4, NFR-7 | [x] U9 |
| US-9.2 | Mobile field verification with camera upload | P2 | FR-9.2/9.5 | [x] U9 |
| US-9.3 | Mobile Green Rater dashboard | P2 | FR-9.3, FR-10.2 | [x] U9 (responsive-only) |

## Coverage Summary
- **Total stories**: 38 (Epic 1: 4, Epic 2: 6, Epic 3: 6, Epic 4: 5, Epic 5: 3, Epic 6: 1, Epic 7: 8,
  Epic 8: 1, Epic 9: 3, Epic 10: 5, Epic 11: 3 = 45 unique IDs; some stories like US-2.6 span unit 1
  (membership) and unit 3 (UI) and are listed in both with explicit halves — no story is missing).
- **Unique-story coverage**: every story ID appears in at least one unit.
- **Cross-cutting**: Epic 11 (RBAC, state-lock, audit) lands in Unit 1 (RBAC, audit) and Unit 5 (state-lock).
- **Personas exercised**: P1–P4 all participate; primary owner per unit:
  - U1: All; U2: P2/P3; U3: P1/P2; U4: P2; U5: P2/P3; U6: P1/P2; U7: P1/P2/P3/P4; U8: P2/P3; U9: P2.
