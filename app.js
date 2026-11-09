import {
  CRITERIA,
  SAMPLE_MONTHS,
  computeMonth,
  computeRoi,
  rankAmong,
  weightedScore,
} from "./calc.js";

const TOUCHES = [
  {
    id: "email-1",
    kind: "Email",
    day: "Day 0",
    audience: "Managing partner or firm owner, day 0",
    subject: "A lender-ready report template you can reuse across clients",
    body: "Hi [Name], I work with accounting firms that still rebuild the same monthly package in a spreadsheet for every lender or board meeting. On November 6 Kick shipped firm report templates, so your team can set layout, logo, disclaimer, and number format once, then apply that standard across clients, with overrides where a single entity needs something different.\n\nYou can also ask Claude or ChatGPT, through Kick MCP, to create a lender-ready template and assign it to all of your clients. If useful, I can walk you through that flow on a short call and show how it sits next to the Chart of Accounts templates Kick released for accountants on October 16. Here is the note: https://www.kick.co/changelog/report-editor\n\nWould next Tuesday or Wednesday be better for 20 minutes?",
  },
  {
    id: "linkedin",
    kind: "LinkedIn",
    day: "Day 2",
    audience: "Same person, same week as email 1 (or the next day if email is unanswered)",
    subject: "Short connection note or InMail",
    body: "Hi [Name], I help accounting firms that close books for startups and SMBs. Kick just launched firm report templates (Nov 6), so a team can create one lender-ready layout and reuse it across clients instead of rebuilding the package each month. Your site's work on [insert their verified signal, for example multi-entity reporting or QuickBooks monthly close] is why I thought of you. Open to a 15-minute look this week?",
  },
  {
    id: "email-2",
    kind: "Email",
    day: "Day 7",
    audience: "Same person, about five business days after email 1",
    subject: "Re: firm templates, plus the close work around them",
    body: "Hi [Name], a quick follow-up in case November close is already filling the calendar. The report editor is one piece of a broader firm workflow Kick has shipped this fall: checks and deposits extracted from paperwork on October 30, continuous revenue recognition on October 9, free invoicing with accountant-level line coding on October 1, and multi-entity consolidation with an Ownership Canvas on September 24.\n\nIf your team spends time matching check images, maintaining revenue schedules, or rolling up related entities, those releases are meant to draft the mechanical work so reviewers can stay in judgment mode. The changelog is here: https://www.kick.co/changelog\n\nHappy to tailor a walkthrough to the client segment you care about most, whether that is funded startups, ecommerce brands, or multi-entity SMBs.",
  },
  {
    id: "email-3",
    kind: "Email",
    day: "Day 17",
    audience: "Same person, about eight business days after email 2",
    subject: "Last note: free firm account and partner path",
    body: "Hi [Name], I will keep this short. Firms can start with a free Kick firm account, and Kick publishes accountant pricing per client, including an Accountant AI Program with custom pricing and lead generation if you want a tighter partnership. Partner docs are here: https://www.kick.co/accountants and https://docs.kick.co/referrals-and-partnerships/partner-program\n\nIf now is the wrong month, tell me who else on your team owns technology or the monthly reporting standard and I will stop there. If it is the right month, I can show a lender-ready template applied across a sample book of clients in one sitting.",
  },
];

const state = {
  pack: null,
  weights: { clientFit: 1, serviceFit: 1, deliveryFit: 1, whyNow: 1, scale: 1 },
  query: "",
  filters: { state: "all", size: "all", niche: "all" },
  openId: null,
  months: SAMPLE_MONTHS.map((month) => ({ ...month })),
  charts: [],
};

const $ = (selector) => document.querySelector(selector);

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
function pct(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}
function num(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
function plain(value) {
  return value == null || value === "" ? "Not published" : String(value);
}

function scoredFirms() {
  const firms = state.pack.firms.map((firm) => ({ ...firm, score: weightedScore(firm, state.weights) }));
  const scores = firms.map((firm) => firm.score);
  return firms
    .map((firm) => ({ ...firm, rank: rankAmong(firm.score, scores) }))
    .sort((a, b) => a.rank - b.rank || a.firm.localeCompare(b.firm));
}

function visibleFirms() {
  const q = state.query.trim().toLowerCase();
  return scoredFirms().filter((firm) => {
    if (state.filters.state !== "all" && firm.state !== state.filters.state) return false;
    if (state.filters.size !== "all" && firm.size !== state.filters.size) return false;
    if (state.filters.niche !== "all" && firm.niche !== state.filters.niche) return false;
    if (!q) return true;
    const hay = [firm.firm, firm.hq, firm.state, firm.niche, firm.size, firm.whyNowSignal, firm.suggestedAngle, firm.website]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function fillSelect(select, values) {
  const current = select.value || "all";
  const options = ["all", ...values.filter((value) => value !== "Not published").sort(), ...values.filter((value) => value === "Not published")];
  select.innerHTML = options
    .map((value) => `<option value="${escapeHtml(value)}">${value === "all" ? "All" : escapeHtml(value)}</option>`)
    .join("");
  select.value = options.includes(current) ? current : "all";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderWeights() {
  const root = $("#weights");
  root.innerHTML = CRITERIA.map(([key, label]) => `
    <div class="weight">
      <label for="weight-${key}">${label} <span>${state.weights[key]}</span></label>
      <p>${escapeHtml(state.pack.rubric[key])}</p>
      <input id="weight-${key}" type="range" min="0" max="5" step="1" value="${state.weights[key]}" data-weight="${key}" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${state.weights[key]}" aria-label="${label} weight">
    </div>
  `).join("");
}

function renderFilters() {
  const firms = state.pack.firms;
  fillSelect($("#filter-state"), [...new Set(firms.map((firm) => firm.state))]);
  fillSelect($("#filter-size"), [...new Set(firms.map((firm) => firm.size))]);
  fillSelect($("#filter-niche"), [...new Set(firms.map((firm) => firm.niche))]);
}

function renderFirms() {
  const rows = visibleFirms();
  $("#firm-count").textContent = `Showing ${rows.length} of ${state.pack.firms.length}. Rank is among all 23 firms at these weights.`;
  const list = $("#firm-list");
  if (!rows.length) {
    list.innerHTML = `<p class="empty">No firms match this search and filter combination. Reset the filters to see all 23.</p>`;
    return;
  }
  list.innerHTML = `
    <div class="firm-head" aria-hidden="true"><span>Rank</span><span>Firm</span><span>State</span><span>Niche</span><span>Size</span><span>Score</span></div>
    ${rows.map((firm) => `
      <button class="firm-row" type="button" data-firm="${escapeHtml(firm.firm)}">
        <span class="rank"><span class="cell-label">Rank</span>${firm.rank}</span>
        <span class="firm-name">${escapeHtml(firm.firm)}</span>
        <span><span class="cell-label">State</span>${escapeHtml(plain(firm.state))}</span>
        <span><span class="cell-label">Niche</span>${escapeHtml(plain(firm.niche))}</span>
        <span><span class="cell-label">Size</span>${escapeHtml(plain(firm.size))}</span>
        <span class="score"><span class="cell-label">Score</span>${num(firm.score, 0)}</span>
      </button>
    `).join("")}
  `;
}

function whyText(firm) {
  const met = CRITERIA.filter(([key]) => firm[key] === 1).map(([, label]) => label);
  const missed = CRITERIA.filter(([key]) => firm[key] !== 1).map(([, label]) => label);
  const metClause = met.length ? `${met.join(", ")} marked 1` : "no rubric point marked 1";
  const missClause = missed.length ? `${missed.join(", ")} marked 0` : "none marked 0";
  return `Weighted score ${num(firm.score, 0)} at the current weights. The workbook has ${metClause}, and ${missClause}. Each point is 0 or 1 from a page opened on November 9, 2026. The recorded signal is the only narrative in the workbook.`;
}

function renderDrawer() {
  const existing = $("#drawer-root");
  if (!state.openId) {
    existing?.remove();
    return;
  }
  const firm = visibleFirms().find((item) => item.firm === state.openId) || scoredFirms().find((item) => item.firm === state.openId);
  if (!firm) {
    state.openId = null;
    existing?.remove();
    return;
  }
  const links = [
    ["Website", firm.website],
    ["Source page", firm.source],
  ].filter(([, href], index, all) => href && all.findIndex((item) => item[1] === href) === index);
  const html = `
    <div class="backdrop" data-close="1"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <button class="drawer-close" type="button" data-close="1">Close</button>
      <p class="meta-line">Rank ${firm.rank} of 23</p>
      <h2 id="drawer-title">${escapeHtml(firm.firm)}</h2>
      <p class="meta-line">${escapeHtml(firm.hq)}</p>
      <p class="meta-line">State: ${escapeHtml(plain(firm.state))} · Niche: ${escapeHtml(plain(firm.niche))} · Size: ${escapeHtml(plain(firm.size))}</p>
      <div class="links">${links.map(([label, href]) => `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`).join("")}</div>
      <div class="prose">
        <h3>Why it scored this way</h3>
        <p>${escapeHtml(whyText(firm))}</p>
      </div>
      <table class="breakdown">
        <thead><tr><th>Criterion</th><th>Mark</th><th>Weight</th><th>Points</th></tr></thead>
        <tbody>
          ${CRITERIA.map(([key, label]) => {
            const mark = Number(firm[key]) || 0;
            const weight = Number(state.weights[key]) || 0;
            return `<tr><td>${label}<br><span class="note">${escapeHtml(state.pack.rubric[key])}</span></td><td class="${mark ? "mark-yes" : "mark-no"}">${mark}</td><td>${weight}</td><td>${num(mark * weight, 0)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
      <div class="prose">
        <h3>Signal</h3>
        <p>${escapeHtml(firm.whyNowSignal)}</p>
        <h3>Suggested angle</h3>
        <p>${escapeHtml(firm.suggestedAngle)}</p>
      </div>
    </aside>
  `;
  if (existing) existing.innerHTML = html;
  else {
    const root = document.createElement("div");
    root.id = "drawer-root";
    root.innerHTML = html;
    document.body.appendChild(root);
    root.querySelector(".drawer-close")?.focus();
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv() {
  const header = ["Rank", "Weighted score", "Firm", "Website", "HQ", "State", "Niche", "Size", "Client fit", "Service fit", "Delivery fit", "Why-now", "Scale", "Why-now signal", "Source", "Suggested angle"];
  const lines = [header.join(",")];
  visibleFirms().forEach((firm) => {
    lines.push([
      firm.rank, firm.score, firm.firm, firm.website, firm.hq, firm.state, firm.niche, firm.size,
      firm.clientFit, firm.serviceFit, firm.deliveryFit, firm.whyNow, firm.scale,
      firm.whyNowSignal, firm.source, firm.suggestedAngle,
    ].map(csvEscape).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "firms-current-view.csv";
  link.click();
  URL.revokeObjectURL(url);
}

const CALC_ROWS = [
  ["grossProfit", "Gross profit", (month) => money(month.grossProfit), true],
  ["grossMargin", "Gross margin", (month) => pct(month.grossMargin), true],
  ["opex", "Total operating expenses", (month) => money(month.opex), true],
  ["ebitda", "EBITDA", (month) => money(month.ebitda), true],
  ["ebitdaMargin", "EBITDA margin", (month) => pct(month.ebitdaMargin), false],
  ["netIncome", "Net income", (month) => money(month.netIncome), true],
  ["debtService", "Debt service", (month) => money(month.debtService), true],
  ["dscr", "DSCR", (month) => num(month.dscr, 2), true],
  ["netCashFlow", "Net monthly cash flow", (month) => money(month.netCashFlow), true],
  ["runwayLabel", "Cash runway (months)", (month) => month.runwayLabel, true],
];

function pnlRow(label, cells, total = false) {
  return `<tr class="${total ? "total" : ""}"><td>${label}</td>${cells}</tr>`;
}

function buildPnlTable() {
  const head = state.months.map((month) => `<th scope="col">${month.label}</th>`).join("");
  const inputRow = (key, label) => pnlRow(
    label,
    state.months.map((month, index) => `<td><input type="number" inputmode="decimal" aria-label="${label}, ${month.label}" data-month="${index}" data-field="${key}" value="${month[key]}"></td>`).join(""),
  );
  const calcRow = (key, label, total) => pnlRow(
    label,
    state.months.map((_, index) => `<td data-calc="${key}" data-month="${index}"></td>`).join(""),
    total,
  );
  $("#pnl-table").innerHTML = `
    <thead><tr><th scope="col">Line item</th>${head}</tr></thead>
    <tbody>
      ${inputRow("revenue", "Net revenue")}
      ${inputRow("cogs", "Cost of goods sold")}
      ${calcRow("grossProfit", "Gross profit", true)}
      ${calcRow("grossMargin", "Gross margin", true)}
      ${inputRow("rd", "Research and development")}
      ${inputRow("sales", "Sales and marketing")}
      ${inputRow("ga", "General and administrative")}
      ${calcRow("opex", "Total operating expenses", true)}
      ${calcRow("ebitda", "EBITDA", true)}
      ${calcRow("ebitdaMargin", "EBITDA margin", false)}
      ${inputRow("depreciation", "Depreciation and amortization")}
      ${inputRow("interest", "Interest expense")}
      ${calcRow("netIncome", "Net income", true)}
      ${inputRow("principal", "Principal repayment")}
      ${calcRow("debtService", "Debt service", true)}
      ${calcRow("dscr", "DSCR", true)}
      ${inputRow("cash", "Cash on hand")}
      ${inputRow("otherCash", "Other monthly cash uses")}
      ${calcRow("netCashFlow", "Net monthly cash flow", true)}
      ${calcRow("runwayLabel", "Cash runway (months)", true)}
    </tbody>
  `;
}

function renderPnl({ rebuild = false } = {}) {
  if (rebuild || !$("#pnl-table").querySelector("[data-calc]")) buildPnlTable();
  const computed = state.months.map(computeMonth);
  CALC_ROWS.forEach(([key, , format]) => {
    computed.forEach((month, index) => {
      const cell = document.querySelector(`[data-calc="${key}"][data-month="${index}"]`);
      if (cell) cell.textContent = format(month);
    });
  });
  drawCharts(computed);
}

function chartSeries(computed) {
  return {
    ebitda: computed.map((month) => month.ebitda),
    margin: computed.map((month) => (month.grossMargin == null ? null : month.grossMargin * 100)),
    dscr: computed.map((month) => month.dscr),
    runway: computed.map((month) => month.runway),
  };
}

function drawCharts(computed) {
  if (!window.Chart || $("#panel-pnl").hidden) return;
  const series = chartSeries(computed);
  if (state.charts.length) {
    state.charts[0].data.datasets[0].data = series.ebitda;
    state.charts[0].data.datasets[1].data = series.margin;
    state.charts[1].data.datasets[0].data = series.dscr;
    state.charts[1].data.datasets[1].data = series.runway;
    state.charts.forEach((chart) => chart.update());
    return;
  }
  const labels = state.months.map((month) => month.label.replace(" 2026", ""));
  const ink = "#0c3d4d";
  const copper = "#9a3d12";
  const green = "#0e6b56";
  const common = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } };
  state.charts = [
    new window.Chart($("#chart-margin"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          { type: "bar", label: "EBITDA", data: series.ebitda, backgroundColor: green, yAxisID: "y" },
          { type: "line", label: "Gross margin", data: series.margin, borderColor: ink, backgroundColor: ink, yAxisID: "y1", tension: 0.25 },
        ],
      },
      options: { ...common, scales: { y: { ticks: { callback: (value) => money(value) } }, y1: { position: "right", grid: { drawOnChartArea: false }, ticks: { callback: (value) => `${value}%` } } } },
    }),
    new window.Chart($("#chart-lender"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "DSCR", data: series.dscr, borderColor: ink, backgroundColor: ink, yAxisID: "y", tension: 0.25 },
          { label: "Runway (months)", data: series.runway, borderColor: copper, backgroundColor: copper, yAxisID: "y1", tension: 0.25 },
        ],
      },
      options: { ...common, scales: { y1: { position: "right", grid: { drawOnChartArea: false } } } },
    }),
  ];
}

function renderRoi() {
  const values = {
    clients: $("#roi-clients").value,
    hoursPerClose: $("#roi-hours").value,
    savedPct: $("#roi-saved").value,
    billingRate: $("#roi-rate").value,
    pricePerClient: $("#roi-price").value,
  };
  const result = computeRoi(values);
  const roiText = result.netRoi == null ? "Undefined while the assumed price is 0" : `${(result.netRoi * 100).toFixed(0)}%`;
  $("#roi-results").innerHTML = `
    <tr><th>Annual hours saved</th><td>${num(result.annualHours, 1)}</td></tr>
    <tr><th>Dollars of capacity freed</th><td>${money(result.capacityFreed)}</td></tr>
    <tr><th>Assumed annual software cost</th><td>${money(result.annualCost)}</td></tr>
    <tr><th>Net benefit</th><td>${money(result.netBenefit)}</td></tr>
    <tr><th>Net ROI</th><td>${roiText}</td></tr>
    <tr><th>Break-even price per client / month</th><td>${result.breakEvenPrice == null ? "—" : money(result.breakEvenPrice)}</td></tr>
    <tr><th>Break-even hours saved</th><td>${result.breakEvenSavedPct == null ? "—" : `${result.breakEvenSavedPct.toFixed(1)}%`}</td></tr>
  `;
}

function renderTouches() {
  $("#touches").innerHTML = TOUCHES.map((touch) => `
    <article class="touch">
      <header>
        <div>
          <h2>${touch.kind} · ${touch.day}</h2>
          <p class="when">${escapeHtml(touch.audience)}</p>
        </div>
        <button class="btn" type="button" data-copy="${touch.id}">Copy</button>
      </header>
      <p class="subject">${escapeHtml(touch.subject)}</p>
      <p class="body">${escapeHtml(touch.body)}</p>
    </article>
  `).join("");
}

function showTab(id) {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const selected = button.dataset.tab === id;
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== id;
  });
  if (id === "pnl") {
    renderPnl();
    state.charts.forEach((chart) => chart.resize());
  }
  history.replaceState(null, "", `#${id}`);
}

async function copyTouch(id, button) {
  const touch = TOUCHES.find((item) => item.id === id);
  const text = `${touch.subject}\n\n${touch.body}`;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  const previous = button.textContent;
  button.textContent = "Copied";
  setTimeout(() => { button.textContent = previous; }, 1400);
}

function bind() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
  });
  $("#weights").addEventListener("input", (event) => {
    const key = event.target.dataset.weight;
    if (!key) return;
    state.weights[key] = Number(event.target.value);
    event.target.setAttribute("aria-valuenow", event.target.value);
    event.target.closest(".weight").querySelector("span").textContent = event.target.value;
    renderFirms();
    if (state.openId) renderDrawer();
  });
  $("#search").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderFirms();
  });
  ["state", "size", "niche"].forEach((key) => {
    $(`#filter-${key}`).addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      renderFirms();
    });
  });
  $("#reset-filters").addEventListener("click", () => {
    state.query = "";
    state.filters = { state: "all", size: "all", niche: "all" };
    $("#search").value = "";
    ["state", "size", "niche"].forEach((key) => { $(`#filter-${key}`).value = "all"; });
    renderFirms();
  });
  $("#reset-weights").addEventListener("click", () => {
    state.weights = { ...state.pack.defaultWeights };
    renderWeights();
    renderFirms();
    if (state.openId) renderDrawer();
  });
  $("#export-csv").addEventListener("click", exportCsv);
  $("#firm-list").addEventListener("click", (event) => {
    const row = event.target.closest("[data-firm]");
    if (!row) return;
    state.openId = row.dataset.firm;
    renderDrawer();
  });
  document.body.addEventListener("click", (event) => {
    if (event.target.dataset.close) {
      state.openId = null;
      renderDrawer();
    }
    const copy = event.target.closest("[data-copy]");
    if (copy) copyTouch(copy.dataset.copy, copy);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.openId) {
      state.openId = null;
      renderDrawer();
    }
  });
  $("#pnl-table").addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    const index = Number(event.target.dataset.month);
    const raw = event.target.value;
    state.months[index][field] = raw === "" || raw === "-" ? 0 : Number(raw);
    renderPnl();
  });
  $("#reset-pnl").addEventListener("click", () => {
    state.months = SAMPLE_MONTHS.map((month) => ({ ...month }));
    state.charts.forEach((chart) => chart.destroy());
    state.charts = [];
    buildPnlTable();
    renderPnl();
  });
  document.querySelectorAll("[data-roi]").forEach((input) => {
    input.addEventListener("input", renderRoi);
  });
  const start = location.hash.replace("#", "");
  if (["firms", "pnl", "roi", "outreach"].includes(start)) showTab(start);
}

async function main() {
  renderTouches();
  renderRoi();
  const response = await fetch("data/firms.json");
  state.pack = await response.json();
  state.weights = { ...state.pack.defaultWeights };
  renderWeights();
  renderFilters();
  renderFirms();
  bind();
  $("#load-error")?.remove();
}

main().catch((error) => {
  console.error(error);
  $("#firm-list").innerHTML = `<p class="empty">The firm list did not load. Reload the page. If it still fails, the workbook download still works.</p>`;
});
