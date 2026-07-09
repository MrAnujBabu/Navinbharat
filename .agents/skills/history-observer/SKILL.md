---
name: history-observer
description: Frog-eye observer that audits prior Lovable chat turns to surface incomplete tasks, dropped follow-ups, and related next-turn work. Use when the user says "observe history", "what did we leave incomplete", "audit previous turns", "kya reh gaya", "/dk observer", or asks to link current work to earlier decisions. Produces a persisted markdown report under `docs/observer/`.
---

# History Observer

Act as a **read-only auditor** of this project's own conversation history. Your job is not to write features — it is to look back at what was said and done in previous turns, spot loose ends, and hand the maintainer a scannable markdown log they can act on next turn.

## When to trigger

- "observe history", "what's incomplete", "loose ends", "kya reh gaya", "pending kya hai"
- "/dk observer", "run observer", "frog-eye view"
- Before a release / after a long multi-turn session
- When the user says "link this to what we did earlier"

## Workflow (5 steps)

1. **Sweep** — pull the relevant chat window with `chat_search--recall_chat_history` (fuzzy) and `chat_search--search_chat_history` (keywords). Start unbounded, then narrow.
2. **Zoom** — `chat_search--read_chat_messages` on the indices that look promising. Tool calls are NOT indexed; only user + assistant text is visible. Note that limitation in the report.
3. **Classify** each finding into one of:
   - `INCOMPLETE` — started, not finished (fix proposed but not applied, migration proposed but not approved, TODO left in code).
   - `FOLLOW-UP` — user asked, agent deferred ("will do next turn", "manual step required").
   - `LINKED` — new turn touches the same file/table/flow as an earlier turn; note the connection.
   - `DROPPED` — user asked, agent never addressed.
   - `RISK` — an ignored finding, TODO, or workaround that could bite later.
4. **Cross-check** against the repo — quick `rg` / file reads to confirm the code state matches what the chat claimed (e.g. "migration applied" → check `supabase/migrations/`).
5. **Persist** — write the report to `docs/observer/YYYY-MM-DD-<slug>.md` and update `docs/observer/INDEX.md` (append one line). Never overwrite prior reports.

## Report format (mandatory)

```markdown
# Observer Report — <YYYY-MM-DD> — <scope>

**Window observed:** turns N…M (or "last session")
**Scope:** <feature / file / flow>

## Incomplete
- [ ] <thing> — *turn N* — evidence: "<quote>" — next action: <one line>

## Follow-ups deferred
- [ ] <thing> — *turn N* — blocker: <manual step / approval>

## Linked to current work
- <current thing> ↔ <earlier turn N thing> — why it matters

## Dropped
- <thing user asked, never resolved> — *turn N*

## Risks / ignored findings
- <thing> — *turn N* — accepted because: <reason>

## Signal-only (nothing to do)
- <bullet>

## Notes on visibility
- Tool activity (migrations, file edits, security scans) is NOT in the chat search index;
  cross-check via the repo when a claim needs proof.
```

## Rules

- **Read-only.** Never edit source, never run migrations, never mark security findings. Only write under `docs/observer/`.
- **Quote, don't paraphrase**, for anything flagged `INCOMPLETE` or `DROPPED` — the maintainer needs the exact turn to re-open it.
- **Prove code claims** with a file:line reference when possible.
- **Frog-eye, not fish-eye** — one screenful of markdown, prioritized by severity. If the list would exceed ~40 items, keep the top 15 and note the rest as "…and N more, see raw sweep".
- **Never re-propose rejected ideas.** If the chat shows the user rejected X, mark it `RISK` at most, don't resurrect it.
- **No secrets in the report** — redact tokens, keys, emails.

## Anti-patterns

- Treating tool-call outputs as chat history (they're not indexed).
- Writing a fresh audit instead of an observation — this skill reports on prior turns, it doesn't re-audit code from scratch.
- Overwriting `docs/observer/` files. Always new date-stamped file.
- Asking the user follow-up questions — the observer works from what's already there.

## Done when

- A dated markdown file exists under `docs/observer/`.
- `docs/observer/INDEX.md` has a new one-line entry.
- Closing reply names the skill and points the user to the report path.
