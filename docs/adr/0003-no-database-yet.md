# 0003 No database yet
Date: 2026-10-20. Status: accepted

## Context
Content is 4 product types, 26 documents and a few dozen cited claims. Nothing user-specific is stored.

## Decision
Keep content in JSON/CSV under `data/`, versioned in git.

## Consequences
Simple, reviewable diffs, no ops. Revisit when there are hundreds of products, user accounts or saved history.
