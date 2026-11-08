import React, { useEffect, useState } from 'react';

type Offer = {
  provider: string;
  offerId: string;
  model: string;
  gpuCount: number;
  supplierHourlyUsd: number;
  supplierPerGpuHourUsd: number;
  estimatedMarginPerGpuHourUsd: number | null;
  estimatedMarginPct: number | null;
  checkedAt: string;
};

type ResponseData = {
  mode: string;
  procurementBlocked: boolean;
  tradingBlocked: boolean;
  payoutsBlocked: boolean;
  pricingStatus: string;
  comparisons: Offer[];
};

export function GpuComparisonDashboard() {
  const [quote, setQuote] = useState('0.75');
  const [cost, setCost] = useState('0.10');
  const [provider, setProvider] = useState('all');
  const [demandModel, setDemandModel] = useState('4090');
  const [demandCount, setDemandCount] = useState('1');
  const [demandHours, setDemandHours] = useState('10');
  const [demandBudget, setDemandBudget] = useState('0.75');
  const [demandMatches, setDemandMatches] = useState<Array<{
    provider: string;
    offerId: string;
    model: string;
    gpuCount: number;
    estimatedSupplierCostUsd: number;
    estimatedAdditionalCostUsd: number;
    estimatedGrossSpreadUsd: number;
    purchasingAllowed: false;
  }>>([]);
  const [demandError, setDemandError] = useState('');
  const [demandLoading, setDemandLoading] = useState(false);
  const [demandChecked, setDemandChecked] = useState(false);


  const [data, setData] = useState<ResponseData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const q = Number(quote);
    const c = Number(cost);

    if (!Number.isFinite(q) || q <= 0 ||
        !Number.isFinite(c) || c < 0 ||
        quote.trim() === '' || cost.trim() === '') {
      setError('Enter a positive customer price and a nonnegative cost.');
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      const params = new URLSearchParams({
        customerPerGpuHourUsd: String(q),
        additionalCostPerGpuHourUsd: String(c)
      });

      const response = await fetch(
        '/api/owner/gpu-price-comparison-normalized?' + params,
        { credentials: 'same-origin', cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'Owner session required.'
            : `Supplier comparison unavailable (HTTP ${response.status}).`
        );
      }

      const json: ResponseData = await response.json();

      if (json.mode !== 'READ_ONLY' ||
          json.pricingStatus !== 'CATALOG_ONLY' ||
          json.procurementBlocked !== true ||
          json.tradingBlocked !== true ||
          json.payoutsBlocked !== true ||
          !Array.isArray(json.comparisons)) {
        throw new Error('Unexpected or unsafe API response.');
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const rows = (data?.comparisons ?? []).filter(
    item => provider === 'all' || item.provider === provider
  );


  const count = Number(demandCount);
  const hours = Number(demandHours);
  const budget = Number(demandBudget);

  const demandValid =
    demandModel.trim().length > 0 &&
    Number.isInteger(count) && count > 0 &&
    Number.isFinite(hours) && hours > 0 &&
    Number.isFinite(budget) && budget > 0;



  const demandRequestVersion = React.useRef(0);

  function invalidateDemandMatches() {
    demandRequestVersion.current += 1;
    setDemandLoading(false);
    setDemandMatches([]);
    setDemandChecked(false);
    setDemandError('');
  }

  async function runDemandMatch() {
    const requestVersion = ++demandRequestVersion.current;
    setDemandMatches([]);
    setDemandChecked(false);
    setDemandError('');

    if (!demandValid || cost.trim() === '' ||
        !Number.isFinite(Number(cost)) ||
        Number(cost) < 0) {
      setDemandError('Invalid demand or additional cost.');
      return;
    }

    setDemandLoading(true);

    try {
      const response = await fetch('/api/owner/gpu-demand-match', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gpuModel: demandModel.trim(),
          gpuCount: count,
          durationHours: hours,
          maxCustomerPricePerGpuHourUsd: budget,
          additionalCostPerGpuHourUsd: Number(cost)
        })
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'Owner authentication required.'
            : `Matching unavailable (HTTP ${response.status}).`
        );
      }

      const result = await response.json();

      if (result.mode !== 'READ_ONLY' ||
          result.pricingStatus !== 'CATALOG_ONLY' ||
          result.procurementBlocked !== true ||
          result.tradingBlocked !== true ||
          result.payoutsBlocked !== true ||
          result.verifiedCustomer !== false ||
          result.confirmedAvailability !== false ||
          result.paymentVerified !== false ||
          !Array.isArray(result.matches) ||
          !result.matches.every((m: any) =>
            m.purchasingAllowed === false &&
            m.availabilityVerified === false &&
            m.paymentVerified === false &&
            m.status === 'CATALOG_MATCH_ONLY' &&
            Number.isFinite(m.estimatedGrossSpreadUsd) &&
            m.estimatedGrossSpreadUsd > 0
          )) {
        throw new Error('Unsafe matching response rejected.');
      }

      if (requestVersion !== demandRequestVersion.current) return;
      setDemandMatches(result.matches);
      setDemandChecked(true);
    } catch (err) {
      if (requestVersion !== demandRequestVersion.current) return;
      setDemandError(
        err instanceof Error ? err.message : 'Matching failed.'
      );
    } finally {
      if (requestVersion === demandRequestVersion.current) {
        setDemandLoading(false);
      }
    }
  }

  const money = (value: number) =>
    '$' + value.toFixed(4);

  return (
    <section className="space-y-5 pb-10">
      <div>
        <h2 className="text-2xl font-bold">
          GPU Supplier Comparison
        </h2>
        <p className="text-amber-300 text-sm mt-2">
          READ ONLY · Catalog prices · No confirmed availability
          · No verified customer · No realized profit
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm">
          Customer price / GPU-hour (USD)
          <input
            aria-label="Customer price per GPU-hour"
            type="number"
            min="0.0001"
            step="any"
            value={quote}
            onChange={e => setQuote(e.target.value)}
            className="block mt-1 w-full rounded bg-slate-900 border border-slate-700 p-3"
          />
        </label>

        <label className="text-sm">
          Additional cost / GPU-hour (USD)
          <input
            aria-label="Additional cost per GPU-hour"
            type="number"
            min="0"
            step="any"
            value={cost}
            onChange={e => { setCost(e.target.value); invalidateDemandMatches(); }}
            className="block mt-1 w-full rounded bg-slate-900 border border-slate-700 p-3"
          />
        </label>

        <label className="text-sm">
          Supplier
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            className="block mt-1 w-full rounded bg-slate-900 border border-slate-700 p-3"
          >
            <option value="all">All suppliers</option>
            <option value="vast_ai">Vast.ai</option>
            <option value="runpod">RunPod</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={() => void refresh()}
        disabled={loading}
        className="rounded bg-cyan-700 px-5 py-3 font-semibold disabled:opacity-50"
      >
        {loading ? 'Checking catalog…' : 'Refresh comparison'}
      </button>

      {error && (
        <p role="alert" className="text-red-300">{error}</p>
      )}

      <p className="text-slate-400 text-sm">
        {rows.length} catalog entries. Margins are hypothetical,
        before unmodeled fees, taxes and operational risks.
      </p>


      <section className="space-y-3 rounded-lg border border-cyan-800 p-4">
        <h3 className="text-xl font-bold">
          Customer Demand Matching
        </h3>
        <p className="text-sm text-amber-300">
          Hypothetical requirements only. No verified customer,
          confirmed availability, payment or purchasing.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label>
            GPU model
            <input aria-label="Demand GPU model"
              value={demandModel}
              onChange={e => { setDemandModel(e.target.value); invalidateDemandMatches(); }}
              className="w-full bg-slate-900 border p-2 rounded" />
          </label>
          <label>
            GPU quantity
            <input aria-label="Demand GPU quantity"
              type="number" min="1" step="1"
              value={demandCount}
              onChange={e => { setDemandCount(e.target.value); invalidateDemandMatches(); }}
              className="w-full bg-slate-900 border p-2 rounded" />
          </label>
          <label>
            Duration (hours)
            <input aria-label="Demand duration"
              type="number" min="0.01" step="any"
              value={demandHours}
              onChange={e => { setDemandHours(e.target.value); invalidateDemandMatches(); }}
              className="w-full bg-slate-900 border p-2 rounded" />
          </label>
          <label>
            Maximum USD/GPU-hour
            <input aria-label="Demand budget"
              type="number" min="0.01" step="any"
              value={demandBudget}
              onChange={e => { setDemandBudget(e.target.value); invalidateDemandMatches(); }}
              className="w-full bg-slate-900 border p-2 rounded" />
          </label>
        </div>

        <button type="button"
          onClick={() => void runDemandMatch()}
          disabled={demandLoading || !demandValid}
          className="rounded bg-cyan-700 px-4 py-2 disabled:opacity-50">
          {demandLoading ? 'Matching…' : 'Match GPU demand'}
        </button>

        {demandError && <p role="alert"
          className="text-red-300">{demandError}</p>}

        <p className="font-semibold">
          {demandChecked
            ? `${demandMatches.length} hypothetical catalog matches`
            : 'Run matching to see catalog results'}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">GPU / Supplier</th>
                <th className="p-2">Listed GPUs</th>
                <th className="p-2">Estimated supplier cost</th>
                <th className="p-2">Hypothetical gross spread</th>
              </tr>
            </thead>
            <tbody>
              {demandMatches.map((item, index) => (
                <tr key={`${item.provider}:${item.offerId}:${index}`}
                  className="border-t border-slate-800">
                  <td className="p-2">
                    {item.model} — {item.provider}
                  </td>
                  <td className="p-2 text-center">
                    {item.gpuCount}
                  </td>
                  <td className="p-2 text-center">
                    ${item.estimatedSupplierCostUsd.toFixed(2)}
                  </td>
                  <td className="p-2 text-center">
                    ${item.estimatedGrossSpreadUsd.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          Full listed offer cost is counted. Spread excludes
          additional operating costs, fees and taxes.
          All results are catalog-only and non-executable.
        </p>
      </section>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900 text-slate-300">
            <tr>
              <th className="p-3">GPU / Supplier</th>
              <th className="p-3">GPUs</th>
              <th className="p-3">Cost / GPU-h</th>
              <th className="p-3">Margin / GPU-h</th>
              <th className="p-3">Margin %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => (
              <tr
                key={`${item.provider}:${item.offerId}:${index}`}
                className="border-t border-slate-800"
              >
                <td className="p-3">
                  <div className="font-semibold">{item.model}</div>
                  <div className="text-slate-400">{item.provider}</div>
                </td>
                <td className="p-3">{item.gpuCount}</td>
                <td className="p-3">
                  {money(item.supplierPerGpuHourUsd)}
                </td>
                <td className="p-3">
                  {item.estimatedMarginPerGpuHourUsd === null
                    ? '—'
                    : money(item.estimatedMarginPerGpuHourUsd)}
                </td>
                <td className="p-3">
                  {item.estimatedMarginPct === null
                    ? '—'
                    : item.estimatedMarginPct.toFixed(1) + '%'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
