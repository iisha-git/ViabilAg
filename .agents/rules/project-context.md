---
trigger: always_on
description: Core facts and non-negotiable rules for bioOasis
---
bioOasis checks biological sprays (living-organism products). Pipeline: label photo -> OCR -> small ML classifier -> cited evidence, with a stop state when unsure.
Read `AGENTS.md` and `ARCHITECTURE.md` before large changes. Never fabricate data, sources, statistics, accuracy or survival numbers. Keep content in `data/`. Update `docs/` and `CHANGELOG.md` with behaviour changes.
