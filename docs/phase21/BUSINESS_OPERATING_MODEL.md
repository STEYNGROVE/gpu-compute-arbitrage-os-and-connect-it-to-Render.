# Single-owner operating model

Owner remains accountable for the company and all consequential decisions. AI can prepare evidence, code, forecasts and administrative drafts; it cannot sign, contact customers, allocate funds or activate financial production. A single owner may hold multiple roles but must obtain independent professional review for legal/accounting/security claims beyond their competence.

| Function | Owner responsibility | AI preparation | Required approval/evidence |
| --- | --- | --- | --- |
| Executive | Strategy, risk appetite, capital allocation, release decision | Prioritized risks and executive dossier | Written owner authorization, zero spend until separately approved |
| Engineering/release | Architecture, maintenance, reviewed PR, staging acceptance | Code/tests/documentation | Independent review and CI; agent never merges its own PR |
| Infrastructure | Capacity, provider accounts, availability, on-call and recovery | Read-only stock/health comparison, alerts | Owner supplier/account choice; explicit paid lifecycle authorization |
| Commercial | Lawful sourcing, buyer authority, pricing, contracts/account management | Lead filtering, quote/proposal drafts | Human outreach/bid/binding offer/contract approval |
| Finance | Cash flow, books, tax, cost reconciliation, refunds, statements | Deterministic minor-unit scenarios and reconciliation queue | Accountant policy and owner approval for every financial action |
| Security/privacy | Access, audit, secret rotation, incidents, supplier risk | Sanitized findings and evidence | Qualified POPIA/legal review and owner risk acceptance |
| Customer success | Onboarding, workload limits, acceptance, support and disputes | Checklists and delivery evidence | Customer-approved scope/SLA and human support escalation |

Cadence: owner reviews unresolved exposure/security daily; supply/cost freshness before every draft; weekly pipeline and cash forecast; monthly accountant reconciliation and access review; quarterly restore/incident rehearsal. No staffing or response-time capacity is assumed before an actual contract. A single owner must not promise 24/7 SLA without funded backup coverage.

Approval boundaries: documentation and isolated tests are reversible administrative work. Production deployment/schema change, payment activation, purchase/cancellation, financial settlement, customer outreach and signatures require explicit separate authorization. Keep approval record bound to exact request/commit, duration, maximum exposure and operator; an AI-written recommendation is not approval.

Operational ownership matrix and incident/escalation steps are in RELEASE_AND_ROLLBACK.md. External counsel/accountant/security reviewer must be appointed before claims of compliance, certified finance or paid launch.
