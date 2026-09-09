# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.11.0] - 2026-09-09
### Added
- Workspace Responsive / Mobile Standard adopted: `scripts/check_responsive.py`
  (copied from ap-ops) runs inside `validate_agent_baseline.py`; layout tokens
  (`--container`, `--gutter`, `--card-min`, `--card-min-lg`, `--space-*`).

### Changed
- `.menu-grid` / `.dashboard-grid` use `auto-fit/minmax` instead of
  `repeat(3, 1fr)`; `.form-row` is mobile-first; the 768/480 menu queries are
  gone (breakpoints are now `sm` 600 / `md` 900).
- Header: brand + HUD controls wrap below 900px instead of overflowing the
  page (this overflow had been masked by `body { overflow-x: hidden }`, now
  removed). Touch targets ≥ 44px below 600px.
- The two retired `architecture-overview.html` redirect stubs gained the
  viewport meta; the header logo carries intrinsic `width`/`height`.

## [1.10.0] - 2026-09-09
### Changed
- `/api/whatsapp-webhook` now receives Meta's WhatsApp Business webhook directly (GET verification handshake + POST message parsing/classification) instead of via an n8n workflow. Removed `docs/whatsapp-crm-workflow.json`; setup doc moved to `docs/whatsapp-lead-intake-setup.md`.

## [1.9.0] - 2026-09-09
### Added
- `POST /api/whatsapp-webhook` — n8n WhatsApp intake inserts a lead (`source=whatsapp`), idempotent by phone.

## [1.8.0] - 2026-09-05
### Added
- Initial changelog baseline.
