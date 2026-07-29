# Task 7 report — live integration and final verification

## Scope

- Verify the approved 乙木女 · 正官格 poster through the production result-page integration.
- Verify representative day-master, gender, and pattern combinations.
- Verify desktop and mobile modal behavior.
- Verify real browser downloads and failure isolation.

## Findings and fixes

1. The live calculator supplies a pattern object. Template normalization previously accepted only a string, so a valid pattern could fall back to 杂格. `normalizePattern()` now accepts `pattern.name`.
2. The success status remained in the flex preview layout and reduced the mobile Canvas width. The success path now hides the status node.

Both fixes have focused regression tests.

## Evidence

- Code under test: `a072259b524d5a441e25932acbf301cf6b8fb14e`
- Full suite: 130 passed, 0 failed.
- Syntax and whitespace checks: passed.
- Real browser downloads: three WebP files, all decoded at 1080×1920.
- Responsive checks: 1440×900, 390×844, 430×932.
- Failure injection: retry and close remained available; result/share/AI content remained intact; focus and scroll state restored after close.
- Detailed record: `docs/verification/2026-07-26-personalized-posters.md`

## Review status

Implementation behavior, scope, assets, failure containment, accessibility hooks, and regression coverage were manually reviewed after the fresh verification run. No open Task 7 defect remains.
