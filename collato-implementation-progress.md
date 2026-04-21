# Collato Implementation Progress

This is the canonical running log for implementation progress updates.

When asked to "update progress", update this file.

## 2026-04-21

### Meeting Context

- Reviewed latest GreenSketch onboarding call transcript (`GreenSketch-x-Collato-Onboarding-210c38f5-739e.json`, ~42 minutes).
- Session focus was workspace onboarding, file ingestion, and report-generation expectations.

### Confirmed Working In Product

- Workspace onboarding flow and membership/invite access were demonstrated as working.
- Users can add workspace context and use current Ask/Task workflows.
- Data upload flow is usable in general (including successful upload attempts during session).

### Issues Identified During Demo

- PDF upload reliability issue observed during live onboarding.
- Error behavior around upload/processing needs hardening (intermittent failure path surfaced).
- Cloud-source ingestion expectation is clear, but native OneDrive/Google Drive connector coverage is not yet complete.

### Requested / Prioritized By GreenSketch

- High-priority requirement: automated monthly report generation at the beginning of each month.
- Output expectation: report should be generated as PDF and be ready to share with clients.
- Report depth expectation: long-form, comprehensive output (not just short 1-2 page summaries).
- Product direction reaffirmed: centralize scattered information sources into a single workspace system before wider team rollout.

### Next Implementation Targets

- Stabilize PDF ingestion path and close upload bug(s) surfaced during onboarding.
- Harden upload error handling and user feedback for failed file-processing states.
- Build scheduled monthly report generation workflow (generation + PDF export + delivery-ready output).
- Continue improving source-ingestion breadth for client file locations (including OneDrive/Drive-style workflows).

### Notes

- As of this update, GreenSketch has only a small initial user cohort onboarded; broader onboarding is expected after flow stabilization.

## 2026-04-09

### Completed

- Completed owner-only organization settings behavior:
  - Hid organization member directory, billing management, and access model sections from non-owners.
  - Tightened server-side permissions so organization member management is owner-only.
  - Added owner checks to organization-member and billing mutation routes.

- Completed multi-organization handling:
  - Added explicit org context selection via `?org=`.
  - Added organization switching in dashboard and organization settings.
  - Added create-your-own-organization flow for invited users who do not yet own an org.
  - Removed primary-org guessing from workspace creation and made workspace creation explicitly org-scoped.

- Completed AI privacy controls for workspace knowledge inputs:
  - Added owner-only "Private from AI" toggles for files and updates.
  - Excluded private files and updates from workspace chat, knowledge-hub chat answers, report generation, and knowledge summary generation.
  - Updated indexing behavior so private items are removed from retrieval context and re-indexed if made visible again.

- Completed billing model and billing UI improvements:
  - Added canonical subscription selection plus subscription history instead of "latest row wins".
  - Added in-app billing controls for cancel, resume, seat updates, and interval changes.
  - Kept the Lemon portal only as a secondary billing-details fallback.
  - Improved billing copy around cancellation state, entitlement window, next renewal wording, and plan status.

- Completed seat-management behavior changes:
  - Added confirmation modal before billing changes.
  - Added visible price impact in the confirmation flow.
  - Added current monthly cost and projected monthly cost in the modal.
  - Changed seat increases to invoice immediately.
  - Changed seat decreases to schedule at next renewal so already-paid seats remain available through the billing period.
  - Enforced a minimum of 1 total seat in both UI and backend.

- Completed checkout and subscription-linking hardening:
  - Passed expected user identity into checkout creation to prevent account mismatch between Collato and Lemon Squeezy.
  - Added account-level billing portal access where needed.
  - Improved subscription linking and reconciliation behavior across webhook and billing status paths.

- Completed org access and expiry handling:
  - Preserved access to invited orgs even when an owned org subscription expires.
  - Added clearer fallback behavior for gated org selection.
  - Added owner access override support via `.env.local` for local/test use.

- Completed workspace access diagnosis and gating cleanup:
  - Confirmed that the workspace-opening failure was caused by org billing/access gating, not bad slug generation.
  - Added more explicit blocked-state routing and messaging for workspace access failures.
  - Corrected billing entitlement logic so unrelated Lemon Squeezy products under the same customer email do not interfere with Collato access decisions or owner overrides.

### Notes

- `collato-implementation-progress.md` is now the canonical file for implementation progress updates.
- Progress updates should be logged here going forward instead of updating broader planning documents unless explicitly requested.
