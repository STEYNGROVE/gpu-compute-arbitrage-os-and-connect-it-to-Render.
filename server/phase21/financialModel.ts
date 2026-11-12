/** Assumptions only. Integer USD cents and ZAR cents, never realized earnings. */
export function modelScenario(utilizationBps:number) {
 if(!Number.isSafeInteger(utilizationBps)||utilizationBps<1||utilizationBps>10000)throw Error('INVALID_UTILIZATION');
 const ceil=(n:bigint,d:bigint)=>(n+d-1n)/d;
 const hours=100n,util=BigInt(utilizationBps),revenue=120n*hours*util/10000n;
 const gpu=50n*hours,storageNetwork=500n,operations=1000n;
 const fees=ceil(revenue*350n,10000n),reserve=ceil(revenue*500n,10000n),contingency=ceil((gpu+storageNetwork)*1000n,10000n);
 const costs=gpu+storageNetwork+operations+fees+reserve+contingency;
 const fixed=2000n;const net=revenue-costs-fixed;
 const fx=18n; // Unverified planning assumption: R18 per USD. No FX trade or current-rate claim.
 const contributionPerBilledHour=120n-50n-5n-10n-ceil(120n*850n,10000n)-6n;
 const minimumHours=ceil(fixed,contributionPerBilledHour);
 return {origin:'UNVERIFIED_ASSUMPTIONS',utilizationBps,usd:{revenueCents:revenue.toString(),gpuCents:gpu.toString(),storageNetworkCents:storageNetwork.toString(),operationsCents:operations.toString(),feesCents:fees.toString(),refundReserveCents:reserve.toString(),contingencyCents:contingency.toString(),fixedOverheadCents:fixed.toString(),grossContributionCents:(revenue-costs).toString(),netCents:net.toString()},
  zar:{revenueCents:(revenue*fx).toString(),netCents:(net*fx).toString()},breakEvenBilledHoursAtFullUtilization:minimumHours.toString(),minimumContractUsdCents:(minimumHours*120n).toString(),
  realizedRevenueCents:'0',recommendedPrepayment:'FULL_CUSTOMER_PRICE_PLUS_AGREED_EXPOSURE_RESERVE',liveSpendingLimitCents:0};
}
