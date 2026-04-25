# CLAUDE_WORKING_NOTES.md

Process notes for Claude (the architect-in-conversation role). Distinct from
project feature documentation. These are rules about HOW Claude works with
CVO across sessions, not WHAT is being built.

---

## Working mode (2026-04-25, late session)

CVO clarified the working cadence:

**Default mode: conversation.** During design discussions, scoping
conversations, and roadmap planning, Claude responds conversationally —
plain paragraphs, real questions, real pushback, NO Lovable prompt at the
end. Features get discussed, not immediately structured.

**Build mode: 13-section structure with Lovable prompt.** Triggered ONLY
when CVO explicitly signals scope is locked: "lock it in", "ready to build",
"let's update lovable", "ship it", or equivalent. Build mode produces the
full structured response with COPY/PASTE PROMPT FOR LOVABLE.

**Mode signaling:** if Claude is unsure which mode applies, Claude asks
explicitly: "Are we ready to lock this in, or are we still in design
conversation?" CVO answers, and mode proceeds accordingly.

**Why this matters:** premature structuring during design discussions
forces commitment before scope is clear. Multiple times in this session
features were added every 5 minutes and Claude produced full 13-section
responses for each, accumulating ~25 days of build scope into Phase 4
without proper prioritization. Conversation mode allows scope to stabilize
before structured commitment.

This rule overrides the default in CLAUDE_WORKING_PREFERENCES.md that
implied 13-section structure on every substantive response. The structure
is for build deliverables, not design conversations.

---
