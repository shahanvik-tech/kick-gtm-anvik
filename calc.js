export const CRITERIA = [
  ["clientFit", "Client fit"],
  ["serviceFit", "Service fit"],
  ["deliveryFit", "Delivery fit"],
  ["whyNow", "Why-now"],
  ["scale", "Scale"],
];

export const SAMPLE_MONTHS = [
  {
    label: "Jul 2026",
    revenue: 395000,
    cogs: 166000,
    rd: 68200,
    sales: 71200,
    ga: 58800,
    depreciation: 7600,
    interest: 4950,
    principal: 7300,
    cash: 358000,
    otherCash: 78000,
  },
  {
    label: "Aug 2026",
    revenue: 408500,
    cogs: 171200,
    rd: 69000,
    sales: 73800,
    ga: 59950,
    depreciation: 7750,
    interest: 4880,
    principal: 7450,
    cash: 371000,
    otherCash: 79500,
  },
  {
    label: "Sep 2026",
    revenue: 421800,
    cogs: 176400,
    rd: 69800,
    sales: 76400,
    ga: 61100,
    depreciation: 7900,
    interest: 4800,
    principal: 7600,
    cash: 389500,
    otherCash: 81200,
  },
  {
    label: "Oct 2026",
    revenue: 486200,
    cogs: 194480,
    rd: 72400,
    sales: 88150,
    ga: 64270,
    depreciation: 8200,
    interest: 4650,
    principal: 7750,
    cash: 412000,
    otherCash: 83000,
  },
];

export const INPUT_LINES = [
  ["revenue", "Net revenue"],
  ["cogs", "Cost of goods sold"],
  ["rd", "Research and development"],
  ["sales", "Sales and marketing"],
  ["ga", "General and administrative"],
  ["depreciation", "Depreciation and amortization"],
  ["interest", "Interest expense"],
  ["principal", "Principal repayment"],
  ["cash", "Cash on hand"],
  ["otherCash", "Other monthly cash uses"],
];

export function weightedScore(firm, weights) {
  return CRITERIA.reduce((sum, [key]) => sum + Number(weights[key] || 0) * Number(firm[key] || 0), 0);
}

export function rankAmong(score, scores) {
  return 1 + scores.filter((other) => other > score).length;
}

export function computeMonth(input) {
  const num = (key) => {
    const value = Number(input[key]);
    return Number.isFinite(value) ? value : 0;
  };
  const revenue = num("revenue");
  const cogs = num("cogs");
  const grossProfit = revenue - cogs;
  const grossMargin = revenue === 0 ? null : grossProfit / revenue;
  const opex = num("rd") + num("sales") + num("ga");
  const ebitda = grossProfit - opex;
  const ebitdaMargin = revenue === 0 ? null : ebitda / revenue;
  const netIncome = ebitda - num("depreciation") - num("interest");
  const debtService = num("interest") + num("principal");
  const dscr = debtService === 0 ? null : ebitda / debtService;
  const netCashFlow = netIncome + num("depreciation") - num("principal") - num("otherCash");
  let runway = null;
  let runwayLabel = "—";
  if (netCashFlow >= 0) {
    runwayLabel = "Cash-flow positive";
  } else if (num("cash") === 0 && netCashFlow < 0) {
    runway = 0;
    runwayLabel = "0.0";
  } else {
    runway = num("cash") / -netCashFlow;
    runwayLabel = runway.toFixed(1);
  }
  return {
    grossProfit,
    grossMargin,
    opex,
    ebitda,
    ebitdaMargin,
    netIncome,
    debtService,
    dscr,
    netCashFlow,
    runway,
    runwayLabel,
  };
}

export function computeRoi({ clients, hoursPerClose, savedPct, billingRate, pricePerClient }) {
  const n = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };
  const clientCount = n(clients);
  const hours = n(hoursPerClose);
  const saved = n(savedPct);
  const rate = n(billingRate);
  const price = n(pricePerClient);
  const annualHours = clientCount * hours * (saved / 100) * 12;
  const capacityFreed = annualHours * rate;
  const annualCost = clientCount * price * 12;
  const netBenefit = capacityFreed - annualCost;
  const netRoi = annualCost === 0 ? null : netBenefit / annualCost;
  const breakEvenPrice = clientCount > 0 ? capacityFreed / (clientCount * 12) : null;
  const capacityBase = clientCount * hours * 12 * rate;
  const breakEvenSavedPct = capacityBase === 0 ? null : (annualCost / capacityBase) * 100;
  return { annualHours, capacityFreed, annualCost, netBenefit, netRoi, breakEvenPrice, breakEvenSavedPct };
}

export const ROI_DEFAULTS = {
  clients: 25,
  hoursPerClose: 8,
  savedPct: 30,
  billingRate: 150,
  pricePerClient: 40,
};
