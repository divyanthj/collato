# Collato.io Product Plan

## Purpose

This file is the working source of truth for product direction, implementation priorities, architecture decisions, and ongoing thinking for the Collato.io workspace app.

It is meant to capture:

- what the product is trying to become,
- what has already been built,
- what still needs to be built,
- important tradeoffs and open questions,
- and the current sequence of execution.

This should evolve as the project evolves.

## Product Vision

Build a workspace-based AI operating system for project-driven consulting work.

The core idea is:

1. A team has a workspace for a client, project, or internal initiative.
2. They upload source material and capture ongoing updates.
3. The app turns that material into a usable knowledge base.
4. AI helps answer questions, structure information, track follow-through, and generate drafts.
5. The system becomes a reliable operational memory layer rather than just a chatbot.

## What Krithika Seems To Need

Based on the transcript and current direction, the intended solution is not just "AI summaries." It is a structured operational workflow.

Main needs:

- A workspace per project/client/process.
- A source of truth for files, meeting notes, and updates.
- Fast capture of post-meeting or in-progress updates from team members.
- AI that turns raw inputs into structured knowledge, action items, risks, and summaries.
- Ability to query the workspace and get useful answers with citations or source grounding.
- Ability to track tasks and follow-through in one place.
- Ability to generate usable progress or client-ready drafts.
- Strong confidentiality, data integrity, and tenant isolation.

## Current Product Shape

The app currently behaves like a multi-workspace project memory system with AI-assisted workflow layers.

Current conceptual modules:

- Organization layer
- Workspace creation and membership
- Knowledge base / file intake
- Team update capture
- Workspace chat
- Task board
- Progress report generation

## What Has Already Been Built

As of now, the codebase already includes:

- Authentication using NextAuth with Google and email-based sign-in
- Workspace creation with owner/member structure
- Workspace membership management
- Workspace-scoped file knowledge entries
- Workspace-scoped update capture
- AI structuring of updates into summary / key points / action items
- RAG-style chunk retrieval for workspace chat
- Workspace chat over retrieved context
- Workspace task tracking
- Workspace progress report generation

## Important Reality Check On Current State

The current app is promising, but it is still a prototype / early product foundation, not yet a hardened enterprise system.

Current strengths:

- Clear product direction
- Strong workspace metaphor
- Early multi-user structure
- AI already integrated into useful workflow steps

Current limitations:

- Security posture is not yet enterprise-grade
- Tenant isolation needs hardening and systematic review
- AI outputs still need stronger grounding and quality controls
- Auditability, logging, permissions, and governance are still minimal
- Confidential / defense-sensitive usage should not be promised yet

## Current Understanding Of The Product Strategy

The real product is probably not "general AI for everything."

The stronger wedge seems to be:

- project memory,
- operational updates,
- action tracking,
- and draft/report generation

for consulting / execution-heavy teams.

This is valuable because it addresses a real coordination problem:

- important project knowledge is scattered,
- follow-through gets lost,
- reporting is expensive,
- and the principal decision-maker becomes the bottleneck.

## Security And Privacy Baseline

Current app-level position:

- Workspace membership checks exist.
- Server-side routes do verify access in major places.
- However, the system still stores and processes sensitive content in ways that are normal for early SaaS, not high-assurance confidential systems.

Important principles going forward:

1. Other customers must never be able to access another workspace's data.
2. Internal operator access must be minimized, audited, and deliberately controlled.
3. Sensitive customer data should only be sent to third-party AI providers under explicit policy and contractual comfort.
4. "Hack-proof" is not realistic; layered risk reduction is the goal.
5. Defense-sensitive or regulated data requires a much stricter architecture and probably a different deployment/security model.

## Working Security Position For Now

Until the app is hardened, the safest honest position is:

- suitable for prototype and internal pilot workflows,
- potentially suitable later for ordinary confidential business data after hardening,
- not yet suitable for defense-sensitive or highly regulated data.

## Open Security Questions

- Should the long-term product allow the app operator to access customer data for support/admin purposes, or should it aim for customer-controlled encryption?
- Should highly sensitive customers get single-tenant deployments instead of shared SaaS?
- Which AI providers are acceptable for customer data, under what terms?
- What audit logging is needed for every read/write/action involving workspace data?
- What retention, deletion, and export guarantees should customers get?
- What compliance level is actually needed for target customers?

## Product Principles

- The organization is the top-level container.
- The workspace is the core object.
- Every major feature should strengthen the workspace as a source of truth.
- AI should transform and organize work, not produce ungrounded noise.
- Outputs must be tied back to real project evidence whenever possible.
- Simplicity matters more than flashy AI behavior.
- Security and trust will become core product features, not just backend concerns.

## Near-Term Priorities

### 1. Tighten the product loop

Make the product feel like one coherent workflow:

- upload source material,
- capture updates,
- ask questions,
- extract tasks,
- generate reports.

### 2. Improve output quality

Reduce vague or random AI outputs by:

- stronger prompt grounding,
- clearer source citation,
- better structured schemas,
- better distinction between evidence and inference.

### 3. Harden workspace isolation

Review every data path to ensure workspace authorization is enforced consistently at query time and write time.

### 4. Add trust-building features

Potential additions:

- audit trail
- activity history
- source links in AI answers
- explicit confidence / insufficient-context behavior
- admin controls

### 5. Clarify product packaging

Figure out whether the product is:

- a shared multi-tenant SaaS,
- a premium single-tenant deployment for sensitive clients,
- or a layered offering with both options.

## Suggested Feature Backlog

### Product / UX

- Better workspace homepage / dashboard
- Better source management and file metadata
- Better report editing flow
- Timeline view of updates and decisions
- Better task extraction and task-to-update linking
- Better collaboration signals across members

### Trust / Governance

- Audit log
- Role-based permissions beyond owner/member
- Delete / archive / restore policies
- Data export
- Data retention controls
- Support-access policy

### Security / Architecture

- Environment secret hygiene and production-safe defaults
- Stronger tenant filtering and query discipline
- Encryption strategy review
- Infrastructure hardening
- Monitoring and incident response basics
- Vendor and data-processing review

## Immediate Technical Concerns Observed In Current Code

- The auth setup still contains a dev fallback secret and needs production-safe enforcement.
- Security posture should not rely only on UI-level assumptions.
- Data classification and storage strategy are not yet designed for highly sensitive data.
- AI integration currently assumes it is acceptable to send workspace content to the configured provider.

## Execution Log

This section tracks the latest thinking and implementation direction over time.

### 2026-04-03

- Established that the app should be treated as a workspace-centric AI operating layer, not merely a chatbot.
- Confirmed that Krithika's needs center on project memory, update capture, follow-through, and report generation.
- Identified security/privacy as a core product concern, especially because future customer data may be confidential or defense-adjacent.
- Concluded that the current app has basic workspace access control but is not yet ready for high-assurance confidential deployments.
- Decided to create this planning file so future implementation can build from a stable written baseline instead of only chat context.
- Added an organization layer above workspaces.
- Decided that organization members can create workspaces, while the organization owner has visibility across all workspaces in the organization.
- Decided that workspace membership should be a subset of organization membership, and that workspace members should be able to manage workspace membership.
- Added a dedicated organization settings page so org-level membership and workspace oversight have a stable home in the product.

## Current Next Steps

1. Review and harden tenant isolation and authorization paths systematically.
2. Improve AI grounding so answers and reports are more traceable and less noisy.
3. Decide the intended deployment/security model for confidential customers.
4. Build trust features such as auditability and clearer source-based outputs.
5. Keep refining the product around the workflow that appears most valuable: capture -> structure -> ask -> track -> report.

## How To Use This File

Before implementing major changes:

- read this file,
- update any changed assumptions,
- add new decisions to the execution log,
- and make sure new work aligns with the current priorities.

When a major product or security decision is made, write it down here so future work stays consistent.


