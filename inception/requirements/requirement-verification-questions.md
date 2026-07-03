# Requirements Verification Questions

Please answer each question by filling in the letter choice after the `[Answer]:` tag. If none of
the options match, choose the last option (Other) and describe your preference after the tag.

Context: The `docs/` LEED material defines the business logic (the "what"); the existing
`usgbc-hub-residential-be` backend and the GBCI Certify HTML prototype represent a candidate
solution (the "how"). The Features draft separates "initial build" scope from "out of scope" items,
and the Technical Design draft proposes a stack (Angular PWA + NestJS API + Python AI service +
PostgreSQL + S3 on AWS). These questions scope what we build now.

---

## Question 1
What is the primary goal of this build right now?

A) Production-grade foundation for the full "initial build" MVP described in the Features draft

B) Working demo for stakeholder presentations (pre-seeded data, mocked AI, local run)

C) A vertical slice of one or two core workflows to prove the architecture end-to-end first

D) Backend/API foundation only, with frontend and AI added in later cycles

X) Other (please describe after [Answer]: tag below)

[Answer]: X - A mix of A and B and mock any data or implementation necessary 

---

## Question 2
Which components/layers should THIS build include? (The Technical Design draft references a NestJS
backend `usgbc-hub-residential-be`, an Angular 21 PWA frontend `usgbc-hub-residential-fe`, and a
Python FastAPI AI microservice.)

A) Backend (NestJS API) only

B) Backend + Frontend (Angular PWA)

C) Backend + Frontend + AI microservice (full stack per Technical Design)

D) Backend + AI microservice (no frontend yet)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 3
How should we treat the existing `usgbc-hub-residential-be` prototype (auth/RBAC slice)?

A) Extend it in place — build new modules (projects, workbook, review, etc.) onto the current NestJS app

B) Use it as a reference but restructure as needed to match the Technical Design

C) Keep auth as-is, add new feature modules alongside without disrupting it

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 4
Which of the "initial build" feature areas should be in scope for THIS build? (Select the set that
best matches; you can choose Other to list a custom subset.) The Features draft initial-build areas
are: Account Management, Project Registration, Scorecard & Credit Tracking, Application/Workbook,
Batch/Portfolio (simplified), AI-Assisted Submission, Submission & Review Workflow, AI-Assisted
Review, Mobile Experience, User Roles, Dashboards.

A) All initial-build feature areas listed in the Features draft

B) Core certification lifecycle only: Account Mgmt, Project Registration, Scorecard/Workbook, Review Workflow, Dashboards (defer Portfolio + AI)

C) Project Registration + Scorecard/Workbook only (the heart of the product) as the first slice

D) Account Management + Project Registration only as the first slice

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 5
Should the AI-assisted features (completeness/consistency checks, pre-review analysis) be built in
this cycle?

A) Yes — build the Python FastAPI AI microservice with real LLM integration

B) Yes, but mocked — stub AI responses now, real LLM later (good for demos)

C) No — defer all AI features to a later cycle

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 6
For the LEED domain data (rating system, credit categories, credits, points, verification/submittal
requirements), how should we populate it? Source docs include the LEED v4.1 SF Rating System and the
Verification Submittals Worksheet.

A) Model the real LEED v4.1 SF credit structure extracted from the provided docs/worksheet

B) Build the generic data model (rating-system lookup + JSON scorecard structure) and seed a representative subset of credits now, full catalog later

C) Build the data model with placeholder/sample credits only for now

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 7
What is the deployment/runtime target for THIS build? (Technical Design proposes AWS cloud-native
with IaC; the current prototype runs locally with Docker Compose Postgres.)

A) Local-only (Docker Compose), matching current prototype — no cloud/IaC yet

B) Local now, but structure code/config to be cloud-ready (S3 abstraction, env-driven) without provisioning AWS

C) AWS cloud-native with IaC (Terraform or CDK) as part of this build

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 8
Document storage for submittals/workbook uploads (Technical Design specifies AWS S3 with presigned
URLs). For this build:

A) Use S3 with presigned URLs (real AWS bucket)

B) Use an S3-compatible abstraction with a local backend (e.g., local disk or MinIO) now, S3 later

C) Defer file uploads entirely for this build

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 9
Email notifications (review returned, submission confirmed, payment due, assignment received) are in
the initial-build scope. For this build:

A) Implement real email sending (SMTP/provider)

B) Implement the notification framework but log/mock delivery now

C) Defer notifications to a later cycle

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 10
Payment/fee handling (Pay now via credit card or Pay later, with fee logic) appears in Project
Registration. Note the prototype README says Stripe is deferred. For this build:

A) Implement fee logic + real payment integration (e.g., Stripe)

B) Implement fee logic and "pay later"/invoice generation; mock the card payment step

C) Defer all payment handling; capture pay-now/pay-later choice only

X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)

B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question: Resiliency Extensions
Should the resiliency baseline be applied to this project?

This applies directional, design-time best practices derived from the AWS Well-Architected
Framework (Reliability Pillar). It is a starting point for resiliency decisions, not a
production-certification or guarantee.

A) Yes — apply the resiliency baseline as directional best practices and design-time guidance (recommended for business-critical workloads)

B) No — skip the resiliency baseline (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)

B) Partial — enforce PBT rules only for pure functions and serialization round-trips

C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers)

X) Other (please describe after [Answer]: tag below)

[Answer]: A
