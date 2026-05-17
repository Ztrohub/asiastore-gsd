<!-- GSD:project-start source:PROJECT.md -->
## Project

**Asiatek POS Web App**

A responsive, offline-first web Point of Sale (POS) application for a single store in Indonesia, designed to run on desktop and tablet/mobile browsers. It supports daily cashier operations with local-first data storage, automatic synchronization to a central server when connectivity returns, and receipt printing via a local print bridge to a 58mm USB thermal printer. The system prioritizes fast transaction flow and keyboard-driven operation over visual catalog browsing.

**Core Value:** Cashiers can complete end-to-end sales quickly and reliably even without internet, with automatic sync recovery when online.

### Constraints

- **Architecture**: PWA + local database with background synchronization - all core workflows must work offline for up to 7 days
- **Performance**: Item search/qty/add under 2 seconds and search-to-receipt under 15 seconds - supports cashier throughput
- **Concurrency**: 1-3 active devices in one store - sync and stock logic must tolerate concurrent edits
- **Platform**: Browser-based UI on desktop/tablet/mobile with keyboard shortcuts in browser environment - no native app dependency
- **Printer Integration**: 58mm receipt output via local print bridge to USB thermal printer - mandatory checkout completion path
- **Localization**: Indonesian language and IDR currency formatting - operational locale requirement
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
