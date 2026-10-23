# 0002 Plain JavaScript, no framework or build step
Date: 2026-10-20. Status: accepted

## Context
A small student team and AI agents need to read and run it quickly. The UI is a handful of screens.

## Decision
ES modules, plain CSS with tokens, no framework, no bundler, no npm install.

## Consequences
Zero setup and easy static hosting. Cost: manual DOM updates and no component system. If the UI grows past about 10 screens, consider a framework (new ADR).
