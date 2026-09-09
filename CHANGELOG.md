# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.10.0] - 2026-09-09
### Changed
- `/api/whatsapp-webhook` now receives Meta's WhatsApp Business webhook directly (GET verification handshake + POST message parsing/classification) instead of via an n8n workflow. Removed `docs/whatsapp-crm-workflow.json`; setup doc moved to `docs/whatsapp-lead-intake-setup.md`.

## [1.9.0] - 2026-09-09
### Added
- `POST /api/whatsapp-webhook` — n8n WhatsApp intake inserts a lead (`source=whatsapp`), idempotent by phone.

## [1.8.0] - 2026-09-05
### Added
- Initial changelog baseline.
