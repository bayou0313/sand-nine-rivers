

## Fix Button Visibility and Hover States

### Single file change

**`src/components/ui/button.tsx`** — Update three variant definitions (lines 14–16):

| Variant | Before | After |
|---------|--------|-------|
| `outline` | `border border-input bg-background hover:bg-muted hover:text-foreground` | `border border-border bg-background text-foreground hover:bg-secondary hover:border-foreground/20` |
| `secondary` | unchanged | unchanged |
| `ghost` | `hover:bg-muted hover:text-foreground` | `text-foreground hover:bg-secondary hover:text-foreground` |

### What this fixes
- Outline buttons get visible navy text (`text-foreground`) and a stronger hover background (`bg-secondary` instead of nearly-invisible `bg-muted`)
- Ghost buttons get explicit text color so they don't disappear on white containers
- Hover states now produce a visible warm-sand shift instead of a near-invisible tint change

### Files NOT touched
Everything else — no page files, no edge functions, no database, no protected files.

