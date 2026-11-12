# Financial operations readiness

Live financial readiness: DENIED. Live spending ceiling is zero. Simulation caps remain USD 2/job, USD 5/day, one active request, one hour maximum runtime. Those test limits are not an approval to spend. Emergency latch remains engaged across process restart by construction.

Accounting design for eventual separately reviewed implementation:

| Event | Debit | Credit | Recognition prerequisite |
| --- | --- | --- | --- |
| Settled customer prepayment | Cash/payment clearing | Customer prepaid liability | Authenticated final payment, exact customer/order/currency, atomic event uniqueness |
| Supplier capacity paid in advance | Supplier prepaid asset | Cash | Explicit authorization and verified provider event |
| Supplier usage incurred | Cost of service | Supplier prepaid asset or payable | Resource-bound usage and invoice evidence |
| Customer delivery earned | Customer prepaid liability | Earned service revenue | Acceptance, delivery and final supplier-cost reconciliation |
| Refund/chargeback | Appropriate liability/reversal/receivable | Cash/payment clearing | Original event binding and accountant-approved treatment |

`LedgerLab` demonstrates balanced integer transfers, isolation and full reversal, not this complete production chart/policy. It does not implement tax subledgers, partial refunds, bank settlement ingestion, multi-asset FX postings, accounts receivable loss provisioning, replica consistency or a production least-privilege posting function. These require a reviewed authoritative design and further implementation before any activation. Existing simulation receipt archive never posts money.

No opening balances, account statements, invoices or transfers in the lab establish company funds. Current verified realized revenue is none; report zero only as absence of independently established revenue, not as an audited bank total.

Controls: enforce no live mutation in every repository/HTTP/provider path; retained quarantined resources count toward exposure; a stopped resource is not closed until final billing and storage/network exposure is reconciled. Owner reviews unresolved final invoices and maintains reserve; AI may prepare reconciliations only. Never treat an API timeout, absent resource, cancellation acknowledgement or unsigned invoice as financial finality.

Owner/accountant must define revenue recognition, VAT place-of-supply, currency functional/reporting policy, refund obligations and record retention. CISO/DB owner must approve signing trust roots, append-only privileges, encrypted backups and restoration evidence. Independent provider billing tests and genuine customer/payment contracts are mandatory external gates.
