# Product Decisions

Lightweight record of intentional product/UX decisions and the reasoning behind
them. Useful context for future feature work.

---

## MC Shepherd permissions — no GROUP_VIEW (2026-06-29)

**Decision:** The MC Shepherd role does not include `GROUP_VIEW` or `GROUP_EDIT`.

**Reasoning:**
- Their core workflow is Reports + CRM. Both are fully covered by
  `REPORT_VIEW`, `REPORT_SUBMIT`, `CRM_VIEW`, `CRM_EDIT`.
- Member management happens through the CRM, not the group detail page.
- Fellowship schedule setup is handled inline in the report submission form
  (see below) — no group page access needed.
- Giving them `GROUP_VIEW` would surface the Groups nav section without
  a clear job to do, adding confusion rather than value.

**Known gap — MC name changes:**
MC leaders come up with their own MC names, so self-service renaming is
desirable. However, this does not justify opening up the full group management
UI. When prioritised, the right solution is a targeted "Rename my MC" action
scoped to the leader's own group(s) — not GROUP_VIEW broadly.

---

## Fellowship schedule setup — inline in the report form (2026-06-29)

**Decision:** MC leaders set their fellowship meeting schedule from inside the
report submission form, not from a group detail page.

**Reasoning:**
- MC Shepherds cannot reach the group detail page (no GROUP_VIEW).
- Even if they could, putting schedule setup there would be unintuitive —
  the leader only thinks about their meeting schedule when they are about
  to submit a report.
- Inline setup is contextual: when the `dynamic_fellowship_schedule` field
  comes back with `{ exists: false }`, the form surfaces a prompt to set
  the schedule right there, then re-fetches and auto-populates the field.

**Default:** Wednesday (meetingDay = 3). Most WHM MCs meet on Wednesdays.
Children's and teens MCs that meet on other days can override this in the
same dialog.

---
