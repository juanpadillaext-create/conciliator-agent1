# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## What this is

"Agente Conciliador" — a Google Apps Script (GAS) web app (V8 runtime, `America/Santiago`) for PedidosYa/Dmarts Chile (SAP Sociedad 6202, CD 36). It reconciles supplier electronic invoices (DTE, from the Axteroid API) against purchase orders / goods receipts (BigQuery `peya-data-origins-pro.cl_dmarts.purchase_orders`), computes discrepancies, and generates Credit Note (NC) claims and balanced SAP JEV vouchers. Domain rules live in `.agents/skills/axteroid-matching-webapp/` (SKILL.md plus `references/reconciliation_rules.md` and `references/accounting_sap_6202.md`) — read them before changing matching or accounting logic.

## Commands

All deployment goes through `clasp` (`.clasp.json` has `rootDir: apps-script-webapp`; `.claspignore` excludes `*.md`, `*.py`, `*.csv`, `*.sql`, `package*.json`, etc.).

- `npm run push` / `npm run status` / `npm run open` — clasp push / status / open
- `npm run deploy` — creates a new production deployment. The description string is hardcoded in `package.json`; update it per release.
- `node .agents/skills/axteroid-matching-webapp/scripts/validate_and_deploy.js` — syntax-checks every `.gs` (via `new Function`) and then deploys. Its hardcoded file list must be kept in sync when adding `.gs` files.
- `npm test` — Puppeteer suites (`test:buscador`, `test:dif_ml`, `test:botones`); single suite: `npm run test:buscador`, or `node tests/puppeteer/<file>.js`. Uses `puppeteer-core` (needs a local Chrome).
- Other `tests/*.js` are ad-hoc audit/debug scripts, not part of `npm test`.

Note: the script ID in `.clasp.json` differs from the one documented in SKILL.md and `.clasp.json.old`; trust `.clasp.json` for what `clasp` actually targets. SKILL.md's layout also lists files that no longer exist in `apps-script-webapp/` (`AuditoriaData.gs`, and the `.gs` check list in its pre-deploy snippet) — verify against the actual directory.

## Architecture

Everything lives in `apps-script-webapp/` (GAS has a single global namespace — all `.gs` files share scope, no imports):

- `Codigo.gs` — controller: `doGet()` and the `api*` functions called from the browser via `google.script.run`. Add new RPC endpoints here.
- `AxteroidAPI.gs` — DTE REST client; `XmlParser.gs` parses Chilean SII DTE XML.
- `BigQueryAPI.gs` — BigQuery (advanced service `BigQuery` v2) queries for POs/receipts.
- `CruceEngine.gs` — discrepancy engine: per-SKU diagnosis `DIFERENCIA_FISICA`, `DIFERENCIA_PRECIO`, `SKU_NO_ORDENADO`, `RECEPCION_CONFORME` (physical shortage kept separate from PPV).
- `JournalEntryVoucher.gs` — balanced SAP voucher (SUM Debe == SUM Haber); `JevTypeSafeAPI.gs` — AI triage / root-cause classification.
- `AutonomousAgents.gs` — three agents (DTE ingestion, reconciliation, SAP JEV).
- `SheetsAPI.gs` — Google Sheets sync (Casos Tribu, Aforos) and the official finance reconciliation spreadsheet generator (formats/formulas specified in SKILL.md §5). `GenerarSlides.gs` — slide generation.
- Frontend is server-templated HTML: `Index.html` (3-step wizard: select invoices/POs → inspect lines → differences/NC/JEV), `Estilos.html` (CSS), `JavaScript.html` (~6k-line client state machine), plus `Modal*.html`. These are included into `Index.html` via GAS includes, so editing client code means editing `JavaScript.html`, not a `.js` file.

`appsscript.json` sets webapp `executeAs: USER_DEPLOYING`, `access: DOMAIN`, and OAuth scopes (BigQuery, Sheets, mail, external requests) — new Google services require adding scopes there.

`archive/` (old Python exploration scripts, legacy GAS backups) and `scratch/` are not part of the deployed app; don't edit them for app changes.
