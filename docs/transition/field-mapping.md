# Field Mapping

## 1. Jira Field Mapping
| CSV-Spalte | Jira-Feld | Datentyp | Pflicht/Optional | Beispielwert |
| --- | --- | --- | --- | --- |
| `External Key` | `External Key` (Custom) | Text | Pflicht | `NIMA-STORY-SEC-001` |
| `Issue Type` | `Issue Type` | System (Select) | Pflicht | `Story` |
| `Summary` | `Summary` | Text | Pflicht | `API Auth Enforcement` |
| `Description` | `Description` | Rich Text | Optional | `PUBLIC_API_TOKEN ...` |
| `Initiative Key` | `Initiative Link` (oder Custom Text) | Issue Link / Text | Optional (abhängig vom Setup) | `NIMA-INIT-001` |
| `Epic Key` | `Epic Link` | Issue Link | Optional (für Story/Task) | `NIMA-EPIC-SEC-001` |
| `Parent External Key` | `Parent` (indirekt via Mapping) | Issue Link | Optional in Phase 1, Pflicht in Phase 3 für Child-Issues | `NIMA-STORY-SEC-001` |
| `Runtime Scope` | `Runtime Scope` (Custom) | Single-select/Text | Optional | `api` |
| `Risk` | `Risk` (Custom) | Single-select | Pflicht | `P0` |
| `Migration Phase` | `Migration Phase` (Custom) | Single-select | Optional | `MIGRATION_PHASE=A` |
| `ADR Ref` | `ADR Ref` (Custom) | Text | Optional | `ADR-001` |
| `Architecture Constraint Ref` | `Architecture Constraint Ref` (Custom) | Text | Optional | `ARCH-CONSTR-API-AUTH` |
| `Blocking Dependencies` | `Blocking Dependencies` (Custom) | Text | Optional | `NIMA-STORY-QA-001;NIMA-STORY-QA-002` |
| `Rollback Strategy` | `Rollback Strategy` (Custom) | Paragraph Text | Optional | `Feature-Flag ...` |
| `Observability Requirement` | `Observability Requirement` (Custom) | Paragraph Text | Optional | `pipeline pass/fail KPIs` |
| `Constraint Test Required` | `Constraint Test Required` (Custom) | Boolean | Optional | `Yes` |
| `Security Review Required` | `Security Review Required` (Custom) | Boolean | Optional | `Yes` |
| `Exit Criteria Ref` | `Exit Criteria Ref` (Custom) | Text | Optional | `EXIT-SECURITY` |
| `Audit Requirement` | `Audit Requirement` (Custom) | Boolean | Optional | `Yes` |
| `Replay Safety Required` | `Replay Safety Required` (Custom) | Boolean | Optional | `No` |
| `Feature Freeze Exempt` | `Feature Freeze Exempt` (Custom) | Boolean | Optional | `Yes` |
| `Runbook Required` | `Runbook Required` (Custom) | Boolean | Optional | `Yes` |
| `DRI` | `DRI` (Custom) | User/Text | Optional | `DRI-TBD` |
| `Secondary Owner` | `Secondary Owner` (Custom) | User/Text | Optional | `SECONDARY-TBD` |
| `Approval Owner` | `Approval Owner` (Custom) | User/Text | Optional | `SEC-APPROVER-TBD` |
| `Labels` | `Labels` | Multi-value Text | Optional | `story,security,week1` |
| `Priority` | `Priority` | System (Select) | Optional | `Highest` |
| `Lifecycle State` | `Lifecycle State` (Custom) | Single-select | Optional | `PROPOSED` |
| `Change Risk Score` | `Change Risk Score` (Custom) | Single-select | Optional | `CRITICAL` |
| `Rollback Verified` | `Rollback Verified` (Custom) | Boolean | Optional | `false` |
| `Constraint Test ID` | `Constraint Test ID` (Custom) | Text | Optional | `ARCH-TEST-ARCHCONSTRAPIAUTH` |

## 2. Linear Field Mapping
| CSV-Spalte | Linear-Feld | Datentyp/Label | Beispielwert |
| --- | --- | --- | --- |
| `Title` | `Title` | Text | `API Auth Enforcement` |
| `Description` | `Description` | Markdown/Text | `PUBLIC_API_TOKEN ...` |
| `Team` | `Team` | Select | `Platform` |
| `Project` | `Project` | Select | `NiMa Transition` |
| `Initiative` | `Parent Initiative` (Custom oder Label-Konvention) | Text/Relation | `Platform Transition Program` |
| `Epic` | `Parent Epic` | Relation/Text | `Security Baseline Hardening` |
| `Parent` | `Parent Issue` | Relation | `Security Baseline Hardening` |
| `State` | `State` | Workflow State | `Backlog` |
| `Priority` | `Priority` | Select | `Urgent` |
| `Labels` | `Labels` | Multi-select | `story,security,week1` |
| `Runtime Scope` | `Runtime Scope` (Custom) | Select/Text | `api` |
| `Risk (P0-P3)` | `Risk` (Custom) | Select | `P0` |
| `Migration Phase (A-D)` | `Migration Phase` (Custom) | Select | `MIGRATION_PHASE=A` |
| `ADR Ref` | `ADR Ref` (Custom) | Text | `ADR-SEC-001` |
| `Blocking Dependencies` | `Dependencies` (Custom Text oder native Links später) | Text | `NIMA-STORY-QA-001` |
| `Rollback Strategy` | `Rollback Strategy` (Custom) | Text | `ALLOW_INSECURE_API ...` |
| `Observability Requirement` | `Observability Requirement` (Custom) | Text | `Auth failures ...` |
| `Constraint Test Required` | `Constraint Test Required` (Custom) | Boolean | `Yes` |
| `Security Review Required` | `Security Review Required` (Custom) | Boolean | `Yes` |
| `Exit Criteria Ref` | `Exit Criteria Ref` (Custom) | Text | `EXIT-SECURITY` |
| `Architecture Constraint Ref` | `Architecture Constraint Ref` (Custom) | Text | `AC-API-AUTH` |
| `Audit Requirement` | `Audit Requirement` (Custom) | Boolean | `Yes` |
| `Replay Safety Required` | `Replay Safety Required` (Custom) | Boolean | `No` |
| `Feature Freeze Exempt` | `Feature Freeze Exempt` (Custom) | Boolean | `Yes` |
| `Runbook Required` | `Runbook Required` (Custom) | Boolean | `Yes` |
| `DRI` | `DRI` (Custom) | User/Text | `DRI-TBD` |
| `Secondary Owner` | `Secondary Owner` (Custom) | User/Text | `SECONDARY-TBD` |
| `Approval Owner` | `Approval Owner` (Custom) | User/Text | `SEC-APPROVER-TBD` |
| `Lifecycle State` | `Lifecycle State` (Custom) | Select | `PROPOSED` |
| `Change Risk Score` | `Change Risk Score` (Custom) | Select | `CRITICAL` |
| `Rollback Verified` | `Rollback Verified` (Custom) | Boolean | `false` |
| `Constraint Test ID` | `Constraint Test ID` (Custom) | Text | `ARCH-TEST-ACAPIAUTH` |

## 3. Custom Field Definitions
| Feld | Typ | Zulässige Werte |
| --- | --- | --- |
| `Lifecycle State` | Single-select | `PROPOSED`, `APPROVED`, `ACTIVE`, `BLOCKED`, `VALIDATING`, `RELEASED`, `RETIRED` |
| `Change Risk Score` | Single-select | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `Rollback Verified` | Boolean | `true`, `false` |
| `Constraint Test ID` | Text | z. B. `ARCH-TEST-ARCHCONSTRAPIAUTH` |
| `Migration Phase` | Single-select | `MIGRATION_PHASE=A`, `MIGRATION_PHASE=B`, `MIGRATION_PHASE=C`, `MIGRATION_PHASE=D` |
| `Security Review Required` | Boolean | `true/false` oder `Yes/No` (import-normalisiert) |

## 4. Import Order
1. Phase 1: Initiatives, Epics, Stories importieren (`jira-transition-backlog-external-keys.csv`).
2. Mapping-Datei befüllen: `jira-external-key-mapping-template.csv` mit echten Jira Keys.
3. Phase 3: Tasks/Subtasks mit `Parent Jira ID` importieren (`jira-phase3-parent-id-template.csv`).

## 5. Validation Rules
1. `External Key` muss global eindeutig sein.
2. Parent muss existieren, bevor Child-Issues importiert werden.
3. `Risk` und `Change Risk Score` müssen konsistent sein:
   - `P0 -> CRITICAL`
   - `P1 -> HIGH`
   - `P2 -> MEDIUM`
   - `P3 -> LOW`
4. `Migration Phase` darf nur `MIGRATION_PHASE=A|B|C|D` enthalten.
5. `Rollback Verified=false` für nicht validierte Migrationen.
6. Wenn `Constraint Test Required=Yes`, muss `Constraint Test ID` gesetzt sein.
7. Wenn `Security Review Required=Yes`, muss `Approval Owner` nicht leer sein.
8. Wenn `Audit Requirement=Yes`, muss `Runbook Required=Yes` sein.
