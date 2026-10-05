# Product activity tracking — 5 October 2026

Implementation status: local working-tree changes, tested and built. No deployment,
push, database mutation, test purchase, provider connection, or live event injection
was performed by this instrumentation work. Tracking starts for visitors after the
updated application is deployed and its DataFast script loads.

## Measurement contract

`lib/client-analytics.js` accepts only enumerated, categorical properties. It rejects
unknown keys and values, names, email addresses, workspace/organization slugs,
record IDs, URLs, questions, answers, file names, and other user content. Counts
use `0`, `1`, `2-5`, `6-20`, `21+`; question length uses short/medium/long.
Payloads contain at most ten properties, including `cohort`. Analytics failures
never prevent a product action. Successful events fired before the SDK loads use
DataFast's documented queue; a blocked SDK can still prevent delivery.

The server emits only one cohort category to the browser:

| Cohort | Meaning |
| --- | --- |
| `anonymous` | No authenticated email in the current session |
| `unknown` | Authenticated, but the exclusion list is not configured |
| `internal_pilot` | Exact match in server-only `ANALYTICS_INTERNAL_EMAILS` |
| `external` | Authenticated and not in the configured exclusion list |

Configure the exact owner and pilot email list on the deployment server. Include
all known owner/test identities and the relevant pilot organization members. The
list is never included in event metadata. A missing or incomplete list limits
cohort accuracy. These categories apply to future events and do not reconstruct
or deanonymize historical visits. Anonymous visits cannot be excluded reliably as
owner/pilot traffic. A client boundary synchronizes fresh server classification
props after authentication navigation or refresh; it does not depend on the cached
initial Script rerunning. A changed configuration requires redeployment.

## Instrumented events

Every event includes the cohort above. The following table lists useful additional
properties; values are enumerated/bucketed by the central schema.

| Event | Trigger and interpretation | Properties |
| --- | --- | --- |
| `auth_started` (existing) | Auth action requested; Google or email | method, source |
| `auth_link_sent` | Email-signin API accepts the request; does not prove email delivery/open | method, source |
| `auth_failed` | Email-signin request fails | method, source |
| `auth_success` (existing) | Authenticated dashboard rendered, once per browser session/account | source |
| `access_gateway_viewed` (existing) | Setup/access gate displayed | requires_checkout, has_invites |
| `organization_created_started` (existing) | Organization creation requested | source |
| `organization_created` (existing, expanded) | Organization creation API succeeds | source |
| `organization_create_failed` | Creation request fails | source, stage |
| `workspace_create_started` (existing) | Workspace creation requested | has_description, has_invites |
| `workspace_created` (existing) | Workspace creation API succeeds | source, has_description, has_invites |
| `workspace_create_failed` | Workspace creation request fails | source, stage |
| `workspace_section_viewed` | Authorized workspace section mounted; one per mount, with React effect deduplication | section |
| `checkout_started` (existing, expanded) | Checkout intent before API call; all four client entry points | source, interval, quantity |
| `checkout_redirected` | Checkout API supplies a URL and browser navigation is initiated | source, interval, quantity |
| `checkout_failed` | Checkout preparation fails; auth, validation/conflict, server, missing-URL and network/client categories | source, interval, stage, failure_category |
| `billing_portal_redirected` | Portal API supplies a URL and navigation is initiated | source |
| `knowledge_file_added` (existing, expanded) | File upload API succeeds, including Updates attachments; SharePoint emits once per successful batch | source/input_method, file_type, item_count for imports |
| `knowledge_note_added` | Typed/voice knowledge note is saved and returned by API | source, input_method |
| `knowledge_capture_failed` | Knowledge saving fails, possibly after another item saved successfully | source, stage |
| `knowledge_summary_result` | Summary API returns, including insufficient/partial context | source, status |
| `knowledge_summary_failed` | Summary API fails | source, stage |
| `knowledge_export_requested` | Browser CSV/JSON download is initiated | source, format, item_count |
| `knowledge_file_download_requested` | Saved-file download link selected | source, file_type |
| `workspace_update_added` (existing) | Structured update is saved | source, input_method, has_attachments, channel |
| `workspace_capture_failed` | Update capture fails, possibly after attachments saved | source, stage, input_method |
| `updates_export_requested` | Browser CSV/JSON download is initiated | source, format, item_count |
| `update_action_state_changed` | Follow-up state PATCH succeeds | source, status |
| `ai_privacy_changed` | File/update privacy PATCH succeeds | scope, ai_private |
| `knowledge_base_question_asked` (existing) | Valid chat request initiated | source, question_length |
| `knowledge_base_answer_received` | Nonempty streamed answer ends with server completion metadata and the stream closes normally | source, has_sources, source_count |
| `knowledge_base_answer_failed` | HTTP, parse, stream, empty-answer, or incomplete-stream failure | source, stage |
| `answer_source_opened` | Answer citation selected; does not prove destination loaded | source |
| `answer_followup_selected` | Suggested question copied to input; does not count as another submitted question | source |
| `report_generation_started` | Report generation requested | source, template_id |
| `report_clarification_required` | API requests missing information; no generated-report event | source, template_id, item_count |
| `report_generated` (existing) | Report API returns a validated, renderable ready result after clarification branch | source, template_id |
| `report_generation_failed` | Generation fails | source, template_id, stage |
| `report_preview_requested` | Browser preview opening is attempted; pop-up success is not asserted | source, template_id, format |
| `report_export_requested` | HTML download initiated; file save/open is not asserted | source, template_id, format |
| `task_created` | Creation API succeeds in board, reviewed update suggestion, or knowledge suggestion | source, has_assignee, has_due_date |
| `task_updated` | Task PATCH succeeds, including drag-and-drop; not the optimistic UI update | source, field, status |
| `task_completed` | API-confirmed transition from another status to done | source |
| `task_action_failed` | Task create/update request fails | source, action |
| `member_invited` | Invitation/member API succeeds; does not prove email delivery or acceptance | scope, role |
| `member_removed` | Member removal API succeeds | scope |
| `invite_delivery_failed` | API succeeds but returns an email-send warning | scope, stage |
| `invite_accepted`, `invite_declined` | Invitation Inbox API action succeeds | scope |
| `invite_action_failed` | Invitation/member creation or inbox action fails | scope, action, stage |
| `member_action_failed` | Member removal request fails | scope, action |
| `integration_connect_started` | SharePoint OAuth navigation requested; no connection success claimed | integration, source |
| `integration_disconnected` | SharePoint DELETE API succeeds | integration |
| `integration_import_completed` | Import response processed, with successful and failed item counts | integration, item_count, failed_count |
| `integration_action_failed` | SharePoint import/disconnect fails | integration, stage |

Legacy `first_knowledge_item_added` and `first_update_added` remain local empty-view
milestones. They depend on loaded records and must not be treated as account-wide
or lifetime-first activation. The update check now uses the selected workspace.
`first_report_generated` was retired because it previously fired once per component
mount, including for returning users. Use the first occurrence of `report_generated`
in a visitor funnel instead; a lifetime account milestone requires durable state.

## Checkout and revenue attribution

Historical `checkout_started` represents intent only. `checkout_redirected`
confirms that a provider checkout URL was created and redirect was initiated. It
cannot prove that LemonSqueezy loaded, that the checkout was completed, or that
money was collected.

The checkout API now forwards valid `datafast_visitor_id` and `datafast_session_id`
cookies into LemonSqueezy `checkout_data.custom`, following DataFast's native
integration instructions. This uses existing anonymous analytics identifiers,
not names, emails, or workspace content as custom goals. Attribution requires
the LemonSqueezy account to be connected in DataFast. At audit time, that connection
was still pending. No custom paid-conversion event was added and no webhook or
cached subscription status is interpreted as revenue. Payment reporting must
distinguish test/live orders, the intended store and product, refunds and renewals,
and deduplicate provider events. The separate usage audit found test-mode orders
and stale cached subscription statuses; they are not proof of paid adoption.

## Suggested funnels and limits

1. Acquisition: landing page → `auth_started` → `auth_success` → `checkout_started`
   → `checkout_redirected` → verified live payment (once provider connected).
2. Value: `workspace_created` → `knowledge_file_added` / `knowledge_note_added` /
   `workspace_update_added` → `report_generated` → `report_export_requested`.
3. Follow-through: update/knowledge capture → `task_created` → `task_completed`.
4. Collaboration: `member_invited` → `invite_accepted` → capture or report event.
5. Reliability: compare requested/success/failed events for checkout, chat, reports,
   capture, and tasks; compare insufficient-context versus useful summary results.

Filter authenticated product metrics by `cohort=external` once the exclusion list
is complete. Compare distinct visitors as well as event counts; repeated actions
are expected. Return activity can be examined through repeated workspace-section
and successful-product events on later days using DataFast visitor/session data.
Anonymous IDs are not unique people or organizations. Workspace IDs are deliberately
excluded, so exact organization usage remains a read-only database audit task.

Client tracking can be lost to script blocking, disabled JavaScript, tab close, or
network failure. Native server-goal API tracking is a future reliability improvement
requiring a write-scoped website key, visitor cookie, and explicit deduplication;
no analytics credentials were invented or added here. Direct server-side invite
link autoaccept and post-checkout organization creation are not included in the
client success-event counts. Google OAuth failure callbacks, transcription outcomes,
connected-integration confirmation, and verified download completion also remain
unmeasured. The privacy policy now factually describes existing DataFast usage,
visitor/session identifiers, checkout attribution and categorical custom properties.

## Verification

- `node --test tests/client-analytics.test.mjs`: fourteen tests pass for queue ordering, SDK behavior,
  content/identity rejection, property cap, safe failure, naming constraints,
  protected cohort, configured cohort classification, refreshed session props, and
  rejection of malformed or non-renderable report replies.
- `npm run lint`: passes without warnings/errors.
- `npm run build`: production build passes. Only the pre-existing stale Browserslist
  database notice appears.
- `git diff --check`: passes; Git reports Windows line-ending notices.

After deployment, verify one owner/pilot and one external session in DataFast,
each known action and its failure branch, counts/buckets, native revenue setup,
and zero names/emails/slugs/content in custom-goal properties. Use provider sandbox
orders for a test funnel and verify they cannot inflate live revenue reporting.

References: [custom goals](https://datafa.st/docs/custom-goals),
[script limits](https://datafa.st/docs/script-configuration),
[server goals API](https://datafa.st/docs/api/website/goals/create),
[LemonSqueezy revenue attribution](https://datafa.st/docs/lemonsqueezy-checkout-api).
