# Financial model — assumptions, not earnings

Executable model: `server/phase21/financialModel.ts`, integer cents/BigInt. All inputs below are UNVERIFIED planning assumptions; no current-price, stock, exchange-rate or realized-profit claim is made. Current authenticated supplier quotes are unavailable. Both USD and ZAR outputs use assumed USD 1 = ZAR 18, not a verified tradable FX rate.

100 reserved GPU-hours at assumed USD 0.50/h, customer USD 1.20/billable hour; storage/network USD 5, operating labor USD 10, payment fee 3.5% of revenue, refund reserve 5%, contingency 10% of GPU+storage/network and fixed infrastructure USD 20. These are deliberately explicit and must be replaced by fresh actual quotes and tax treatment. No paid services are provisioned.

| Utilization | Revenue USD | GPU USD | Fees + refund reserve USD | Contingency USD | Contribution USD before fixed overhead | Net USD | Revenue ZAR | Net ZAR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Low 25% | 30.00 | 50.00 | 2.55 | 5.50 | -43.05 | -63.05 | 540.00 | -1134.90 |
| Base 60% | 72.00 | 50.00 | 6.12 | 5.50 | -4.62 | -24.62 | 1296.00 | -443.16 |
| High 90% | 108.00 | 50.00 | 9.18 | 5.50 | 28.32 | 8.32 | 1944.00 | 149.76 |

Net margins: approximately -210.2%, -34.2%, 7.7%. This illustrates that catalog spread is not a business margin. Contribution above includes direct labor/fees/reserves; statutory gross-margin classification needs accountant review. At 100% billable utilization, conservative per-hour contribution USD 0.38 implies 53 billed hours and USD 63.60 contract revenue to cover USD 20 fixed cost. This is a model threshold, not a binding minimum quote; acquisition/support costs and tax may raise it.

Capital-light recommendation: do not reserve 100 hours speculatively. Negotiate enforceable workload scope and cancellation terms, verify buyer authority, then require settled customer prepayment plus agreed reserve before capacity commitment. At full utilization of only a prepaid job, direct GPU cost and failure contingency are funded from the job rather than speculative working capital. Keep refunds segregated; customer prepayment remains a liability until delivery is earned. No supplier-credit borrowing or card auto-top-up.

Sensitivity: +20% GPU price adds USD 10 GPU cost and USD 1 contingency to this block, turning high net to -USD 2.68. A 10% adverse ZAR conversion on USD costs increases local cost; quote in USD where lawful and acceptable, otherwise bound FX expiry and reserve explicitly. A failed 10-hour job costs at least assumed USD 5 GPU plus ancillary charges and possible full customer refund. Nonpayment exposure is avoided through final prepaid assurance; a forged payment receipt is not assurance. Customer refund/chargeback rights can outlive supplier billing and need adequate working capital.

Live emergency spending limit is zero. Simulation limits do not approve funds. No tax exemption or zero-rate assumption is authoritative; the quote engine accepts explicit policy tax basis but cannot decide tax law. Obtain actual payment fees, supplier minimums/storage/egress, independent FX evidence, VAT and revenue policy before any binding quote. Stress model includes overprovisioning and failure reserve but no historical empirical failure rate exists.

For comparison, GPU-only gross margins at low/base/high utilization are approximately -66.7%, 30.6% and 53.7%; complete contribution margins are -143.5%, -6.4% and 26.2% before fixed overhead. Accountant-approved cost classification is still required. Working-capital stress for a fully refunded failed 10-hour prepaid job at the assumed USD 12 selling price: GPU USD 5 + ancillary USD 0.50 + labor USD 1 + nonrefundable payment fee USD 0.42 leaves at least USD 6.92 (ZAR 124.56 at assumed FX) of cash shortfall to restore a full refund, before extra charges/disputes. Prepayment therefore reduces nonpayment risk but does not remove refund/chargeback capital needs. Keep this exposure unfunded and live spend at zero until owner approves a realistic reserve.
