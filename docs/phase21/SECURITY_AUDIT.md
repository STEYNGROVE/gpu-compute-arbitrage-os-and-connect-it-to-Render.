# Threat-driven security audit

Scope: changed Phase 21 modules and adjacent startup/TLS/readiness/provider/evidence boundaries; existing Phase 19/20 and network regression suites retained. This is engineering verification, not independent penetration-test certification of every legacy source file or deployed environment.

| Threat | Implemented protection/evidence | Residual gap |
| --- | --- | --- |
| Auth bypass/session escalation | Existing strict owner auth; new readiness/emergency routes require owner; production preview flags reject | No MFA/SSO integration, shared-process sessions/limits |
| SQL/financial race | Parameterized SQL, advisory/row locks, unique event IDs, deferred balance constraints, stale-fence check | Lab only; production roles/replicas and legacy ledger uncertified |
| SSRF/provider abuse | Fixed operations, public IPv4 DNS pin, TLS verify, redirects denied, six-second/1 MiB bounds | Provider API compatibility/rate limits need real read-only certification |
| Replay/webhook spoof | Ed25519 roots, expiry/account/kind binding, durable receipt/event conflict quarantine | No named production payment webhook raw-body signature adapter |
| Worker crash/uncertainty | DB leases/fences, bounded serialization retry, unknown-commit lookup, durable stop intent | No certified real worker/dispatcher or unattended termination daemon |
| Credential/log disclosure | Production config rejects frontend secrets, normalized strict DB TLS, generic errors/allowlisted operational logs | Full legacy log review/external secret scanner and deployed env review pending |
| Supply chain | Lockfile preserved; registry audit and hosted builds | Registry audit does not prove absence of compromised packages; action SHA pinning not completed |
| Browser/transport | Production HSTS/CSP, nosniff/frame/referrer/permissions headers, bounded request bodies, validated PORT | Browser CSP rehearsal and ingress verification pending; Google-hosted fonts may be blocked intentionally by self-only font/style policy |
| DB privilege/data loss | Append-only triggers, PUBLIC revoked for lab, checksum planning, disposable backup/restore rehearsal | Administrator can rewrite audit data; production least privilege/external immutable anchor/retention not installed |

Confirmed repairs include startup excluding financial initialization in discovery mode, bootstrap-aware readiness, certificate verification that URL options cannot replace, safe request error responses, trust-key revocation/validity, append-only receipts and later-entry ledger balance validation. Regression tests assert denies rather than weaken gates.

No production test, credential dump, paid GPU, cancellation, payment or outreach occurred. Secret scan checks changed text for key/token patterns; synthetic test credentials and digest values must be distinguished from real secrets. Do not claim formal secret-free proof.

South African professional-review questions: responsible-party/operator roles, lawful basis/minimization for public buyer contacts, cross-border transfer safeguards for US hosting and GPU subprocessors, data-subject rights/retention and security compromise procedure under POPIA. Current regulator [security-compromise guidance](https://inforegulator.org.za/2025/08/19/fact-sheet-handling-of-security-compromises/) describes notification channels and responsibilities; qualified counsel must apply it to actual facts. No automated marketing is enabled.

Tax: SARS [current VAT registration guidance](https://www.sars.gov.za/types-of-tax/value-added-tax/register-for-vat/) reports administration of an increased threshold from 1 April 2026 while noting regulation updates. Accountant must determine registration, exports/place of supply, invoicing and currency treatment. Do not rely on old threshold assumptions or assert compliance. Counsel must review contract enforceability, service liability, consumer protections and payment-processor terms. The platform must not operate as an unapproved payment intermediary or hold third-party funds outside reviewed terms.
