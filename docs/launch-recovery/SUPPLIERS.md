# GPU supplier qualification

| Integration | Evidence obtained | Qualification |
| --- | --- | --- |
| RunPod public GraphQL | Genuine HTTPS response with 12 priced rows in this audit snapshot; each normalized row matched to the exact response | Catalog only; no reserved capacity, firm duration/region quote, ancillary charges, uptime or resale entitlement verified |
| Akash official chain queries | 50 returned order records, 48 open GPU records; actual collector completed with deployment v1beta4 compatibility query | Genuine public demand observations, **funding unverified**, chain freshness and provider award/eligibility unverified |
| Akash deployment v1beta5 | HTTP 501 | Unsupported on this queried node; only documented v1beta4 alternative is used on that specific error |
| Legacy Akash wholesale estimator | Third-party feed previously supplied assumed VRAM, stock, costs and calculated spot price | Quarantined: emits no wholesale inventory/price rows; official order discovery remains available |
| Vast.ai | Official read-operation code and fixtures reviewed; credentialed call not made | Unverified live account, availability, price completeness and rental/resale eligibility |
| TensorDock, Lambda, Salad, Hyperstack, CoreWeave, Hostinger | Existing implementations retained and source URLs/credential names inventoried | Not independently live verified; no procurement certification or eligibility inference |
| io.net, Nosana, Render Network, Bittensor | Existing restricted-network policy retained | Blocked pending officially supported interfaces, eligibility and terms; rewards/queues are not funded customer contracts |

The exact public responses, retrieval times, digests and limited samples are in supplier-public-probe.json and akash-collector.json. They expire and are not current quotes. Official compatibility reference: https://github.com/akash-network/chain-sdk/blob/74cfdba4de8d4fed50ff4603820b8bef160090d9/proto/node/akash/deployment/v1beta4/query.proto . Official public catalog examples: https://docs.runpod.io/sdks/graphql/manage-pods ; Vast reference: https://vast.ai/developers/api . No alternate endpoint bypasses authentication, TLS or schema checks.

Additional audit repairs remove Lightning's static “live” price list and hardware fallback, Hyperstack's GPU-count-derived missing price and synthetic spot discounts, and assumed VRAM/stock counts across legacy readers. Unknown cost components are returned as null, not zero, and legacy automatic profit selection rejects them. Genuine positive published hourly values remain available as catalog observations. Supplier connectivity reports are explicitly CONNECTIVITY_ONLY and cannot declare production readiness. Legacy financial preflight rejects customer payment booleans/max-price budgets before any supplier call.

All aggregated legacy provider rows now explicitly carry catalog-only scope and unverified availability, additional charges and eligibility. Such rows cannot become binding quotes merely because the hourly price was retrieved. Minimum duration, storage, bandwidth/egress, setup, currency/slippage, tax, commissions, uptime, region, rate-limit policy and permitted resale must be established for the exact supplier/account/workload before Mode B. Unknowns remain unknown; the probe does not reserve instances or submit bids.

State separation is mandatory: **catalog offer → independently verified firm quote → eligible supplier → reserved capacity → actual procurement**. This candidate implements discovery/screening and evidence review, not the last two operations. No supplier balance, general wallet balance or public escrow account is treated as customer job entitlement.
