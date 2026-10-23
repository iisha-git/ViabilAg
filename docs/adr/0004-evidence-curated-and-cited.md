# 0004 Evidence is curated and cited, never generated
Date: 2026-10-20. Status: accepted

## Context
Farmers could act on what the app says. A wrong claim has real cost.

## Decision
Every claim in `data/evidence/evidence.json` is written from a source a person opened, and shows its source name and URL. The app never produces survival numbers. Our own display thresholds are labelled `app_threshold`.

## Consequences
Content grows slowly and needs review, but the app stays trustworthy. No claim ships without a source.
