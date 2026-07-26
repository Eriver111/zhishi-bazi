# Task 1 Report: Deterministic Poster Content Model

## Status

Complete.

Created:

- `js/poster-templates.js`
- `tests/poster-templates.test.js`

The browser module exposes `window.BaZiPosterTemplates.resolve({ bazi, gender, pattern })` and returns the exact requested result fields. It includes literal, deterministic copy pairs for all 10 day masters × 16 patterns.

## TDD Evidence

### RED

Command:

```text
node --test tests/poster-templates.test.js
```

Result:

```text
exit code: 1
tests: 6
pass: 0
fail: 6

Error: ENOENT: no such file or directory, open '...\js\poster-templates.js'
```

The focused tests failed for the expected reason: the production module had not yet been created.

### GREEN

Command:

```text
node --test tests/poster-templates.test.js
```

Result:

```text
exit code: 0
tests: 6
pass: 6
fail: 0
```

Covered behaviors:

- all 160 supported day-master × pattern combinations;
- exactly two non-empty copy lines and a unique reviewed pair per combination;
- the approved 乙木正官 pair verbatim;
- deterministic equality across repeated calls;
- gender-independent core copy;
- male/female identity labels and background keys;
- empty, unknown, exact, and contained-keyword pattern resolution;
- absence of random, seeded, hashed, cycling, “换一句”, and refresh-based variation.

## Full Test Result

Command:

```text
node --test tests/*.test.js
```

Fresh final result:

```text
exit code: 0
tests: 88
pass: 88
fail: 0
cancelled: 0
skipped: 0
todo: 0
duration_ms: 572.7155
```

Additional check:

```text
git diff --check
exit code: 0
```

## Self-review

- Rechecked the brief line by line against the public resolver, return shape, exact identity metadata, pinyin background keys, seal, footer, fallback rules, and deterministic behavior.
- Reviewed all 160 literal copy pairs by pattern family. Every pair combines the day master's distinct image/temperament with the requested pattern tendency; no runtime copy assembly or interchangeable adjective list is used.
- Confirmed exact patterns resolve before a fixed, longest-first keyword list. When a future name contains more than one base keyword, the declared fixed order selects one result.
- Confirmed `copyLines` is returned as a fresh two-item array so a consumer cannot mutate the stored matrix.
- Removed an unnecessary unsupported-input error branch during review to keep the implementation within the tested ten-day-master contract.
- Left the unrelated untracked `.superpowers/brainstorm/` directory untouched and out of the commit.

## Commit

Implementation and tests:

```text
4480b44 feat: add deterministic BaZi poster templates
```

## Concerns

No Task 1 blockers or known defects. Loading the new browser module from a page and rendering the Canvas poster are intentionally deferred to later tasks.
