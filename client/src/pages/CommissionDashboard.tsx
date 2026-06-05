import { useState, useCallback } from "react";
import {
  DollarSign, TrendingUp, Users, ChevronDown, ChevronUp,
  Moon, Sun, BarChart2, Calculator, Save, CheckCircle2, Trash2,
  AlertCircle, FileText, Download
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

// ─── Types & Constants ─────────────────────────────────────────────────────────

interface RepConfig {
  name: string;
  startDate: Date;
  /** Returns the base deduction for commission math (0 during guarantee months) */
  getCommBase: (empMonth: number) => number;
  /** Returns the guaranteed draw amount (shown as info only, not deducted) */
  getGuarantee: (empMonth: number) => number;
  startLabel: string;
}

const REPS: RepConfig[] = [
  {
    name: "Joanna Jones",
    startDate: new Date(2025, 0, 2),
    getCommBase: () => 25000,
    getGuarantee: () => 0,
    startLabel: "Jan 2025",
  },
  {
    name: "Rachael Turner",
    startDate: new Date(2023, 0, 3),
    getCommBase: () => 25000,
    getGuarantee: () => 0,
    startLabel: "Jan 2023",
  },
  {
    name: "Tricia Shipley",
    startDate: new Date(2022, 6, 5),
    getCommBase: () => 25000,
    getGuarantee: () => 0,
    startLabel: "Jul 2022",
  },
  {
    name: "Jackie Jarquin",
    startDate: new Date(2022, 1, 16),
    getCommBase: () => 25000,
    getGuarantee: () => 0,
    startLabel: "Feb 2022",
  },
  {
    name: "Carrie Shuler",
    startDate: new Date(2026, 0, 5),
    // Mo 1–4: guaranteed draw (NOT a base deduction). Mo 5–13: $0. Mo 14+: $25k base
    getCommBase: (m) => (m <= 4 ? 0 : m <= 13 ? 0 : 25000),
    getGuarantee: (m) => (m <= 4 ? 5000 : 0),
    startLabel: "Jan 2026",
  },
  {
    name: "Victoria Ming",
    startDate: new Date(2026, 3, 6),
    // Mo 1–4: guaranteed draw. Mo 5–12: $0. Mo 13+: $25k base
    getCommBase: (m) => (m <= 4 ? 0 : m <= 12 ? 0 : 25000),
    getGuarantee: (m) => (m <= 4 ? 4000 : 0),
    startLabel: "Apr 2026",
  },
  {
    name: "Cristina Polanco",
    startDate: new Date(2026, 2, 4),
    // Mo 1–4: guaranteed draw. Mo 5–8: $0. Mo 9+: $25k base
    getCommBase: (m) => (m <= 4 ? 0 : m <= 8 ? 0 : 25000),
    getGuarantee: (m) => (m <= 4 ? 3000 : 0),
    startLabel: "Mar 2026",
  },
  {
    name: "Sarah Perkins",
    startDate: new Date(2022, 11, 28),
    getCommBase: () => 25000,
    getGuarantee: () => 0,
    startLabel: "Dec 2022",
  },
  {
    name: "Hannah Pfleiger",
    startDate: new Date(2025, 11, 3),
    getCommBase: () => 0,
    getGuarantee: () => 0,
    startLabel: "Dec 2025",
  },
];

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const REP_COLORS  = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#14b8a6"];

// Per-rep resale deduction (default $250; Sarah Perkins is $75; Hannah Pfleiger is $0)
const RESALE_DEDUCTION: Record<string, number> = { "Sarah Perkins": 75, "Hannah Pfleiger": 0 };
function getResaleDed(repName: string) { return RESALE_DEDUCTION[repName] ?? 250; }

// Reps with custom commission structures (bypasses standard calcCommission)
function calcHannahCommission(gross: number): { commission: number; t2: number; t4: number; t2amt: number; t4amt: number } {
  if (gross <= 0) return { commission: 0, t2: 0, t4: 0, t2amt: 0, t4amt: 0 };
  const t2 = Math.min(gross, 200000);
  const t4 = Math.max(0, gross - 200000);
  return { commission: t2*0.02 + t4*0.04, t2, t4, t2amt: t2*0.02, t4amt: t4*0.04 };
}
const CUSTOM_COMM_REPS = new Set(["Hannah Pfleiger"]);

// ─── Commission Math ───────────────────────────────────────────────────────────

function getEmpMonth(rep: RepConfig, year: number, month: number) {
  const s = new Date(rep.startDate.getFullYear(), rep.startDate.getMonth(), 1);
  const t = new Date(year, month - 1, 1);
  return Math.max(1, (t.getFullYear()-s.getFullYear())*12 + (t.getMonth()-s.getMonth()) + 1);
}

function calcCommission(gross: number, resale: number, commBase: number, resaleDedAmt = 250) {
  const rd    = resale * resaleDedAmt;
  const after = Math.max(0, gross - rd);
  const comm  = Math.max(0, after - commBase);
  let commission = 0, t10 = 0, t125 = 0;
  if (comm > 0) {
    if (after <= 200000) { t10 = comm; commission = t10 * 0.10; }
    else { t10 = Math.max(0, 200000 - commBase); t125 = after - 200000; commission = t10*0.10 + t125*0.125; }
  }
  return { resaleDeduction: rd, afterDeduction: after, commissionable: comm, t10, t125, commission };
}

function fmt(v: number)  { return v.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}); }
function fmtD(v: number) { return v.toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtS(v: number) {
  if (v>=1e6) return `$${(v/1e6).toFixed(1)}M`;
  if (v>=1e3) return `$${(v/1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

// ─── Saved Entry Type ──────────────────────────────────────────────────────────

interface SavedEntry {
  repName: string;
  year: number;
  month: number;
  grossRevenue: number;
  closedResale: number;
  totalClosed: number;
  commission: number;
  commBase: number;
  guarantee: number;
  empMonth: number;
  resaleDeductionAmt?: number;
}

// ─── Print / Export Helpers ────────────────────────────────────────────────────

function downloadHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportRepPDF(rep: RepConfig, entries: SavedEntry[], allEntries: SavedEntry[]) {
  const repEntries = entries
    .filter(e => e.repName === rep.name)
    .sort((a,b) => a.year!==b.year ? a.year-b.year : a.month-b.month);

  if (!repEntries.length) { alert(`No saved data for ${rep.name}.`); return; }

  const color = REP_COLORS[REPS.findIndex(r => r.name === rep.name)] ?? "#3b82f6";

  const rows = repEntries.map(e => {
    const rda       = e.resaleDeductionAmt ?? getResaleDed(e.repName);
    const resaleDed = e.closedResale * rda;
    const afterDed  = e.grossRevenue - resaleDed;
    const commable  = Math.max(0, afterDed - e.commBase);
    return `
      <tr>
        <td>${MONTH_FULL[e.month-1]} ${e.year}</td>
        <td>${fmtD(e.grossRevenue)}</td>
        <td style="text-align:center">${e.totalClosed ?? "—"}</td>
        <td>${e.closedResale > 0 ? `${e.closedResale} (−${fmt(resaleDed)})` : "—"}</td>
        <td>${e.commBase > 0 ? fmt(e.commBase) : e.guarantee > 0 ? `${fmt(e.guarantee)} draw` : "—"}</td>
        <td>${fmtD(commable)}</td>
        <td class="highlight">${fmtD(e.commission)}</td>
      </tr>`;
  }).join("");

  const totalRev  = repEntries.reduce((s,e)=>s+e.grossRevenue, 0);
  const totalComm = repEntries.reduce((s,e)=>s+e.commission,   0);

  // Build sparkline data string for a simple SVG line
  const maxRev = Math.max(...repEntries.map(e=>e.grossRevenue), 1);
  const pts = repEntries.map((e,i) => {
    const x = repEntries.length===1 ? 400 : (i/(repEntries.length-1))*740+30;
    const y = 120 - (e.grossRevenue/maxRev)*100;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const dotsPts = repEntries.map((e,i) => {
    const x = repEntries.length===1 ? 400 : (i/(repEntries.length-1))*740+30;
    const y = 120 - (e.grossRevenue/maxRev)*100;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${color}"/>`;
  }).join("");
  const labelsPts = repEntries.map((e,i) => {
    const x = repEntries.length===1 ? 400 : (i/(repEntries.length-1))*740+30;
    return `<text x="${x.toFixed(1)}" y="145" text-anchor="middle" font-size="10" fill="#6b7280">${MONTH_NAMES[e.month-1]} ${e.year}</text>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <script>window.onload=function(){window.print();}<\/script>
  <title>Commission Report — ${rep.name}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#111827;background:#fff;padding:40px 48px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${color};padding-bottom:20px;margin-bottom:28px}
    .logo{font-size:22px;font-weight:800;color:${color};letter-spacing:-0.5px}
    .logo-sub{font-size:11px;color:#6b7280;font-weight:500;margin-top:2px}
    .rep-info h1{font-size:24px;font-weight:700;color:#111827}
    .rep-info .sub{font-size:13px;color:#6b7280;margin-top:4px}
    .kpi-row{display:flex;gap:20px;margin-bottom:28px}
    .kpi{flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;border-top:3px solid ${color}}
    .kpi-label{font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
    .kpi-value{font-size:22px;font-weight:700;color:#111827}
    .kpi-value.accent{color:${color}}
    .chart-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:28px}
    .chart-title{font-size:13px;font-weight:600;color:#374151;margin-bottom:12px}
    svg{width:100%;overflow:visible}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#f3f4f6;padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px}
    td{padding:10px 12px;border-bottom:1px solid #f3f4f6}
    tr:last-child td{border-bottom:none}
    .highlight{font-weight:700;color:${color}}
    .totals td{font-weight:700;background:#f9fafb;border-top:2px solid #e5e7eb}
    .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
    @media print{body{padding:20px 24px}.header{padding-bottom:14px}}
  </style></head><body>
  <div class="header">
    <div>
      <div class="logo">Navi Title</div>
      <div class="logo-sub">Commission Report</div>
    </div>
    <div class="rep-info" style="text-align:right">
      <h1>${rep.name}</h1>
      <div class="sub">Started ${rep.startLabel} · Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi">
      <div class="kpi-label">Total Revenue</div>
      <div class="kpi-value">${fmtD(totalRev)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total Commission</div>
      <div class="kpi-value accent">${fmtD(totalComm)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Months Tracked</div>
      <div class="kpi-value">${repEntries.length}</div>
    </div>
  </div>

  <div class="chart-box">
    <div class="chart-title">Monthly Revenue</div>
    <svg viewBox="0 0 800 160" height="160">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
      ${dotsPts}
      ${labelsPts}
    </svg>
  </div>

  <table>
    <thead>
      <tr>
        <th>Period</th><th>Gross Revenue</th><th>Total Closed</th><th>Resale Adj.</th><th>Base / Draw</th><th>Commissionable</th><th>Commission</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr class="totals">
        <td>Total</td>
        <td>${fmtD(totalRev)}</td>
        <td>—</td><td>—</td><td>—</td>
        <td class="highlight">${fmtD(totalComm)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <span>Navi Title Agency · Confidential</span>
    <span>$250 deducted per resale · 10% on first $200k commissionable · 12.5% above $200k</span>
  </div>
  </body></html>`;

  downloadHTML(html, `${rep.name.replace(/ /g,"_")}_Commission_${new Date().toISOString().slice(0,7)}.html`);
}

function exportAccountingPDF(month: number, year: number, entries: SavedEntry[]) {
  const monthEntries = entries.filter(e => e.month===month && e.year===year);
  if (!monthEntries.length) { alert(`No saved data for ${MONTH_FULL[month-1]} ${year}.`); return; }

  const totalComm = monthEntries.reduce((s,e)=>s+e.commission, 0);
  const totalRev  = monthEntries.reduce((s,e)=>s+e.grossRevenue, 0);

  const rows = REPS.map(rep => {
    const e = monthEntries.find(e=>e.repName===rep.name);
    if (!e) return `<tr style="color:#9ca3af"><td>${rep.name}</td><td colspan="5" style="text-align:center;font-size:12px">No data for this period</td></tr>`;
    const color = REP_COLORS[REPS.findIndex(r=>r.name===rep.name)] ?? "#6b7280";
    const rda = e.resaleDeductionAmt ?? getResaleDed(e.repName);
    return `
      <tr>
        <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:8px"></span>${rep.name}</td>
        <td>${fmtD(e.grossRevenue)}</td>
        <td style="text-align:center">${e.totalClosed ?? "—"}</td>
        <td>${e.closedResale > 0 ? `${e.closedResale} (−${fmt(e.closedResale*rda)})` : "—"}</td>
        <td>${e.commBase > 0 ? fmt(e.commBase) : e.guarantee > 0 ? `${fmt(e.guarantee)} draw` : "—"}</td>
        <td>${fmtD(Math.max(0, e.grossRevenue - e.closedResale*rda - e.commBase))}</td>
        <td class="pay-amt">${fmtD(e.commission)}</td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <script>window.onload=function(){window.print();}<\/script>
  <title>Commission Payroll — ${MONTH_FULL[month-1]} ${year}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#111827;background:#fff;padding:40px 48px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e40af;padding-bottom:20px;margin-bottom:28px}
    .logo{font-size:22px;font-weight:800;color:#1e40af;letter-spacing:-0.5px}
    .logo-sub{font-size:11px;color:#6b7280;font-weight:500;margin-top:2px}
    .doc-title{text-align:right}
    .doc-title h1{font-size:20px;font-weight:700;color:#111827}
    .doc-title .sub{font-size:13px;color:#6b7280;margin-top:4px}
    .kpi-row{display:flex;gap:20px;margin-bottom:28px}
    .kpi{flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;border-top:3px solid #1e40af}
    .kpi-label{font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
    .kpi-value{font-size:22px;font-weight:700;color:#111827}
    .kpi-value.accent{color:#1e40af}
    .section-title{font-size:14px;font-weight:700;color:#111827;margin-bottom:12px;display:flex;align-items:center;gap:8px}
    .badge{background:#1e40af;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:0.5px}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px}
    th{background:#1e40af;color:#fff;padding:11px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px}
    td{padding:11px 14px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#f9fafb}
    .pay-amt{font-weight:700;color:#1e40af;font-size:14px}
    .totals-row td{font-weight:700;background:#eff6ff;border-top:2px solid #bfdbfe;font-size:14px}
    .totals-row .pay-amt{color:#1e40af;font-size:16px}
    .note-box{background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:12px;color:#92400e}
    .note-box strong{display:block;margin-bottom:4px}
    .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
    .sig-block{display:flex;gap:40px;margin-top:32px}
    .sig-line{flex:1}
    .sig-line .line{border-bottom:1px solid #9ca3af;margin-bottom:6px;height:32px}
    .sig-line .label{font-size:11px;color:#6b7280}
    @media print{body{padding:20px 24px}}
  </style></head><body>
  <div class="header">
    <div>
      <div class="logo">Navi Title</div>
      <div class="logo-sub">Accounting · Commission Payroll</div>
    </div>
    <div class="doc-title">
      <h1>${MONTH_FULL[month-1]} ${year}</h1>
      <div class="sub">Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi">
      <div class="kpi-label">Total Team Revenue</div>
      <div class="kpi-value">${fmtD(totalRev)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total Commission to Pay</div>
      <div class="kpi-value accent">${fmtD(totalComm)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Reps with Earnings</div>
      <div class="kpi-value">${monthEntries.filter(e=>e.commission>0).length} of ${monthEntries.length}</div>
    </div>
  </div>

  <div class="note-box">
    <strong>Commission Calculation Rules</strong>
    $250 deducted per closed resale transaction · $25,000 annual base absorbed before commission starts (some reps on draw schedule) · 10% on commissionable revenue up to $200,000 gross · 12.5% on gross revenue above $200,000
  </div>

  <div class="section-title">Commission Breakdown <span class="badge">${MONTH_FULL[month-1]} ${year}</span></div>
  <table>
    <thead>
      <tr><th>Sales Rep</th><th>Gross Revenue</th><th>Total Closed</th><th>Resale Adj.</th><th>Base / Draw</th><th>Commissionable</th><th>Commission to Pay</th></tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr class="totals-row">
        <td>TOTAL</td>
        <td>${fmtD(totalRev)}</td>
        <td>—</td><td>—</td><td>—</td>
        <td class="pay-amt">${fmtD(totalComm)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="sig-block">
    <div class="sig-line"><div class="line"></div><div class="label">Approved By</div></div>
    <div class="sig-line"><div class="line"></div><div class="label">Date</div></div>
    <div class="sig-line"><div class="line"></div><div class="label">Processed By (Accounting)</div></div>
  </div>

  <div class="footer">
    <span>Navi Title Agency · Confidential — For Internal Use Only</span>
    <span>Commission Dashboard · ${new Date().getFullYear()}</span>
  </div>
  </body></html>`;

  downloadHTML(html, `Navi_Title_Commission_Payroll_${MONTH_FULL[month-1]}_${year}.html`);
}

// ─── Rep Row ───────────────────────────────────────────────────────────────────

interface RepRowProps {
  rep: RepConfig;
  year: number;
  month: number;
  revenue: string;
  resale: string;
  totalClosed: string;
  onRevenueChange:     (v: string) => void;
  onResaleChange:      (v: string) => void;
  onTotalClosedChange: (v: string) => void;
  savedEntry?: SavedEntry;
}

function RepRow({ rep, year, month, revenue, resale, totalClosed, onRevenueChange, onResaleChange, onTotalClosedChange, savedEntry }: RepRowProps) {
  const [expanded, setExpanded] = useState(false);
  const empMonth  = getEmpMonth(rep, year, month);
  const commBase  = rep.getCommBase(empMonth);
  const guarantee = rep.getGuarantee(empMonth);
  const gross     = parseFloat(revenue.replace(/[^0-9.]/g,"")) || 0;
  const res       = parseInt(resale) || 0;
  const resaleDedAmt = getResaleDed(rep.name);
  const isHannah  = rep.name === "Hannah Pfleiger";
  const hannah    = isHannah ? calcHannahCommission(gross) : null;
  const r         = isHannah ? { commission: hannah!.commission, resaleDeduction:0, afterDeduction:gross, commissionable:gross, t10:0, t125:0 } : calcCommission(gross, res, commBase, resaleDedAmt);
  const hasTimeline = ["Carrie Shuler","Victoria Ming","Cristina Polanco"].includes(rep.name);

  let baseLabel: string;
  let baseColor: string;
  if (isHannah)            { baseLabel = "2% / 4% Tiers";                          baseColor = "color-amber"; }
  else if (guarantee > 0)  { baseLabel = `$${guarantee.toLocaleString()} Draw`;    baseColor = "color-blue"; }
  else if (commBase === 0) { baseLabel = "No Base";                                baseColor = "color-amber"; }
  else                     { baseLabel = `$${commBase.toLocaleString()} Base`;     baseColor = "color-green"; }

  const isDirty = savedEntry
    ? Math.abs(savedEntry.grossRevenue - gross) > 0.5 || savedEntry.closedResale !== res
    : gross > 0 || res > 0 || parseInt(totalClosed) > 0;

  return (
    <div className="rep-card">
      <div className="rep-card-header">
        <div className="rep-info">
          <div className="rep-avatar">{rep.name.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
          <div>
            <h2 className="rep-name">{rep.name}</h2>
            <div className="rep-meta">
              <span>Started {rep.startLabel}</span>
              <span className="meta-divider">·</span>
              <span className={`base-badge ${baseColor}`}>{baseLabel}</span>
              {hasTimeline && <span className="emp-month-badge">Month {empMonth}</span>}
            </div>
          </div>
        </div>
        <div className="rep-header-right">
          {savedEntry && !isDirty && <span className="saved-pill"><CheckCircle2 size={11}/> Saved</span>}
          {isDirty && <span className="unsaved-pill"><AlertCircle size={11}/> Unsaved</span>}
          {gross > 0 && <div className="commission-badge">{fmt(r.commission)}</div>}
        </div>
      </div>

      <div className="input-grid">
        <div className="input-group">
          <label className="input-label">Total Revenue</label>
          <div className="input-wrapper">
            <span className="input-prefix">$</span>
            <input type="text" className="calc-input" placeholder="0" value={revenue}
              onChange={e => {
                const v = e.target.value.replace(/[^0-9]/g,"");
                onRevenueChange(v ? parseInt(v).toLocaleString() : "");
              }}/>
          </div>
        </div>
        <div className="input-group">
          <label className="input-label">Closed Resale Transactions</label>
          <div className="input-wrapper">
            <input type="number" className="calc-input" placeholder="0" min="0" value={resale}
              onChange={e => onResaleChange(e.target.value)}/>
          </div>
        </div>
        <div className="input-group">
          <label className="input-label">Total Closed Transactions</label>
          <div className="input-wrapper">
            <input type="number" className="calc-input" placeholder="0" min="0" value={totalClosed}
              onChange={e => onTotalClosedChange(e.target.value)}/>
          </div>
        </div>
      </div>

      {gross > 0 && (
        <div className="breakdown">
          <button className="breakdown-toggle" onClick={() => setExpanded(x=>!x)}>
            <span>Commission Breakdown</span>
            {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          {expanded && (
            <div className="breakdown-rows">
              <div className="breakdown-row"><span className="breakdown-label">Gross Revenue</span><span className="breakdown-value">{fmt(gross)}</span></div>
              {isHannah ? (
                <>
                  <div className="breakdown-row highlight"><span className="breakdown-label">Commissionable Revenue (no deductions)</span><span className="breakdown-value">{fmt(gross)}</span></div>
                  {hannah!.t2 > 0 && <div className="breakdown-row"><span className="breakdown-label">2% tier — up to $200k ({fmt(hannah!.t2)})</span><span className="breakdown-value">{fmt(hannah!.t2amt)}</span></div>}
                  {hannah!.t4 > 0 && <div className="breakdown-row"><span className="breakdown-label">4% tier — above $200k ({fmt(hannah!.t4)})</span><span className="breakdown-value">{fmt(hannah!.t4amt)}</span></div>}
                </>
              ) : (
                <>
                  {res>0 && <div className="breakdown-row deduction"><span className="breakdown-label">Resale Deduction ({res} × ${resaleDedAmt})</span><span className="breakdown-value">−{fmt(r.resaleDeduction)}</span></div>}
                  <div className="breakdown-row"><span className="breakdown-label">After Resale Deduction</span><span className="breakdown-value">{fmt(r.afterDeduction)}</span></div>
                  {commBase > 0
                    ? <div className="breakdown-row deduction"><span className="breakdown-label">Commission Base (−{fmt(Math.min(commBase,r.afterDeduction))})</span><span className="breakdown-value">{fmt(r.commissionable)}</span></div>
                    : guarantee > 0
                      ? <div className="breakdown-row"><span className="breakdown-label">Draw (guaranteed min, not deducted)</span><span className="breakdown-value">{fmt(guarantee)}</span></div>
                      : null
                  }
                  <div className="breakdown-row highlight"><span className="breakdown-label">Commissionable Revenue</span><span className="breakdown-value">{fmt(r.commissionable)}</span></div>
                  {r.commissionable > 0 && (r.t125===0
                    ? <div className="breakdown-row"><span className="breakdown-label">@ 10%</span><span className="breakdown-value">{fmt(r.t10*0.10)}</span></div>
                    : <><div className="breakdown-row"><span className="breakdown-label">10% tier — up to $200k ({fmt(r.t10)})</span><span className="breakdown-value">{fmt(r.t10*0.10)}</span></div>
                        <div className="breakdown-row"><span className="breakdown-label">12.5% tier — above $200k ({fmt(r.t125)})</span><span className="breakdown-value">{fmt(r.t125*0.125)}</span></div></>
                  )}
                </>
              )}
              <div className="breakdown-row total"><span className="breakdown-label">Total Commission</span><span className="breakdown-value">{fmt(r.commission)}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Calculator Tab ────────────────────────────────────────────────────────────

interface CalcTabProps {
  savedEntries: SavedEntry[];
  onSaveMonth: (entries: SavedEntry[]) => void;
}

function CalcTab({ savedEntries, onSaveMonth }: CalcTabProps) {
  const [selYear,  setSelYear]  = useState(2026);
  const [selMonth, setSelMonth] = useState(5);
  const [revenues,     setRevenues]     = useState<Record<string,string>>(() => Object.fromEntries(REPS.map(r=>[r.name,""])));
  const [resales,      setResales]      = useState<Record<string,string>>(() => Object.fromEntries(REPS.map(r=>[r.name,""])));
  const [totalCloseds, setTotalCloseds] = useState<Record<string,string>>(() => Object.fromEntries(REPS.map(r=>[r.name,""])));
  const [saveStatus, setSaveStatus] = useState<"idle"|"saved">("idle");

  const loadMonth = useCallback((year: number, month: number) => {
    const rev: Record<string,string> = {};
    const res: Record<string,string> = {};
    const tc:  Record<string,string> = {};
    REPS.forEach(rep => {
      const e = savedEntries.find(s => s.repName===rep.name && s.year===year && s.month===month);
      rev[rep.name] = e ? e.grossRevenue.toLocaleString("en-US",{maximumFractionDigits:0}) : "";
      res[rep.name] = e ? String(e.closedResale) : "";
      tc[rep.name]  = e ? String(e.totalClosed ?? "") : "";
    });
    setRevenues(rev); setResales(res); setTotalCloseds(tc); setSaveStatus("idle");
  }, [savedEntries]);

  const handleMonthChange = (year: number, month: number) => {
    setSelYear(year); setSelMonth(month);
    loadMonth(year, month);
  };

  const getSaved = (repName: string) =>
    savedEntries.find(s => s.repName===repName && s.year===selYear && s.month===selMonth);

  const monthAlreadySaved = REPS.some(r => getSaved(r.name));

  const totals = REPS.reduce((acc, rep) => {
    const gross    = parseFloat(revenues[rep.name]?.replace(/[^0-9.]/g,"")) || 0;
    const res      = parseInt(resales[rep.name]) || 0;
    const empM      = getEmpMonth(rep, selYear, selMonth);
    const commBase  = rep.getCommBase(empM);
    const resaleDed = getResaleDed(rep.name);
    const commission = rep.name === "Hannah Pfleiger"
      ? calcHannahCommission(gross).commission
      : calcCommission(gross, res, commBase, resaleDed).commission;
    return { revenue: acc.revenue + gross, commission: acc.commission + commission };
  }, { revenue: 0, commission: 0 });

  const hasInput = REPS.some(r => parseFloat(revenues[r.name]?.replace(/[^0-9.]/g,"")) > 0);

  const handleSave = () => {
    const entries: SavedEntry[] = REPS.map(rep => {
      const gross      = parseFloat(revenues[rep.name]?.replace(/[^0-9.]/g,"")) || 0;
      const res        = parseInt(resales[rep.name]) || 0;
      const tc         = parseInt(totalCloseds[rep.name]) || 0;
      const empM       = getEmpMonth(rep, selYear, selMonth);
      const commBase   = rep.getCommBase(empM);
      const guarantee  = rep.getGuarantee(empM);
      const resaleDed  = getResaleDed(rep.name);
      const commission = rep.name === "Hannah Pfleiger"
        ? calcHannahCommission(gross).commission
        : calcCommission(gross, res, commBase, resaleDed).commission;
      return { repName: rep.name, year: selYear, month: selMonth, grossRevenue: gross, closedResale: res, totalClosed: tc, commission, commBase, guarantee, empMonth: empM, resaleDeductionAmt: resaleDed };
    });
    onSaveMonth(entries);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 3000);
  };

  return (
    <div className="calc-tab">
      <div className="month-bar">
        <div className="month-bar-left">
          <div className="month-selects">
            <div className="input-group">
              <label className="input-label">Month</label>
              <select className="modal-select month-sel" value={selMonth}
                onChange={e => handleMonthChange(selYear, parseInt(e.target.value))}>
                {MONTH_NAMES.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Year</label>
              <select className="modal-select month-sel" value={selYear}
                onChange={e => handleMonthChange(parseInt(e.target.value), selMonth)}>
                {[2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          {monthAlreadySaved && saveStatus!=="saved" && (
            <span className="month-saved-badge"><CheckCircle2 size={12}/> {MONTH_NAMES[selMonth-1]} {selYear} saved</span>
          )}
          {saveStatus==="saved" && (
            <span className="month-saved-badge"><CheckCircle2 size={12}/> Saved!</span>
          )}
        </div>

        <div className="month-bar-right">
          {hasInput && (
            <div className="month-totals">
              <div className="month-total-item">
                <span className="month-total-label">Total Revenue</span>
                <span className="month-total-value">{fmt(totals.revenue)}</span>
              </div>
              <div className="month-total-divider"/>
              <div className="month-total-item">
                <span className="month-total-label">Total Commission</span>
                <span className="month-total-value commission-green">{fmt(totals.commission)}</span>
              </div>
            </div>
          )}
          <button className={`save-month-btn${saveStatus==="saved"?" save-month-btn-saved":""}`}
            onClick={handleSave} disabled={!hasInput || saveStatus==="saved"}>
            {saveStatus==="saved"
              ? <><CheckCircle2 size={15}/> Saved</>
              : <><Save size={15}/> Save {MONTH_NAMES[selMonth-1]} {selYear}</>}
          </button>
        </div>
      </div>

      <div className="rep-grid">
        {REPS.map(rep => (
          <RepRow
            key={rep.name} rep={rep} year={selYear} month={selMonth}
            revenue={revenues[rep.name] ?? ""} resale={resales[rep.name] ?? ""}
            totalClosed={totalCloseds[rep.name] ?? ""}
            onRevenueChange    ={v => setRevenues    (prev => ({...prev, [rep.name]: v}))}
            onResaleChange     ={v => setResales     (prev => ({...prev, [rep.name]: v}))}
            onTotalClosedChange={v => setTotalCloseds(prev => ({...prev, [rep.name]: v}))}
            savedEntry={getSaved(rep.name)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Charts Tab ────────────────────────────────────────────────────────────────

interface ChartsTabProps {
  savedEntries: SavedEntry[];
  onDelete: (repName: string, year: number, month: number) => void;
  darkMode: boolean;
}

function ChartsTab({ savedEntries, onDelete, darkMode }: ChartsTabProps) {
  const [selRep,      setSelRep]      = useState("All");
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exportYear,  setExportYear]  = useState(2026);

  const axisColor = darkMode?"#8b949e":"#6b7280";
  const gridColor = darkMode?"#21262d":"#e8eaef";
  const ttBg      = darkMode?"#1c2128":"#ffffff";
  const ttBorder  = darkMode?"#30363d":"#dde1e9";
  const ttText    = darkMode?"#e6edf3":"#111827";

  const filteredReps = selRep==="All" ? REPS : REPS.filter(r=>r.name===selRep);

  const periods = Array.from(
    new Set(savedEntries.map(e=>`${e.year}-${String(e.month).padStart(2,"0")}`))
  ).sort();

  const periodLabels = periods.map(p => {
    const [y,m] = p.split("-");
    return { key:p, label:`${MONTH_NAMES[parseInt(m)-1]} ${y}` };
  });

  const makeChart = (field: "grossRevenue"|"commission") =>
    periodLabels.map(({key,label}) => {
      const [y,m] = key.split("-");
      const row: Record<string,string|number> = { period: label };
      filteredReps.forEach(rep => {
        const e = savedEntries.find(d=>d.repName===rep.name && d.year===parseInt(y) && d.month===parseInt(m));
        row[rep.name] = e ? e[field] : 0;
      });
      return row;
    });

  const repTotals = REPS.map((rep,i) => {
    const rows = savedEntries.filter(e=>e.repName===rep.name);
    return { rep, color:REP_COLORS[i],
      totalRevenue:    rows.reduce((s,e)=>s+e.grossRevenue,0),
      totalCommission: rows.reduce((s,e)=>s+e.commission,0) };
  });

  const ttStyle = { backgroundColor:ttBg, border:`1px solid ${ttBorder}`, borderRadius:"8px", color:ttText, fontSize:"12px" };

  const CustomTooltip = ({active,payload,label}: any) => {
    if (!active||!payload?.length) return null;
    return (
      <div style={{...ttStyle,padding:"10px 14px",maxWidth:240}}>
        <p style={{fontWeight:700,marginBottom:6,fontSize:13}}>{label}</p>
        {payload.map((e:any) => (
          <div key={e.name} style={{display:"flex",justifyContent:"space-between",gap:16,marginBottom:2}}>
            <span style={{color:e.color}}>{e.name.split(" ")[0]}</span>
            <span style={{fontVariantNumeric:"tabular-nums",fontWeight:600}}>{fmt(e.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const tableRows = savedEntries
    .filter(e => selRep==="All" || e.repName===selRep)
    .sort((a,b) => b.year!==a.year ? b.year-a.year : b.month!==a.month ? b.month-a.month : a.repName.localeCompare(b.repName));

  // Available months from saved data
  const savedPeriods = Array.from(
    new Set(savedEntries.map(e=>`${e.year}-${String(e.month).padStart(2,"0")}`))
  ).sort().reverse();

  return (
    <div className="charts-tab">
      <div className="charts-controls">
        <div className="charts-filter">
          <label className="input-label">Filter by Rep</label>
          <select className="modal-select" value={selRep} onChange={e=>setSelRep(e.target.value)}>
            <option value="All">All Reps</option>
            {REPS.map(r=><option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-row">
        {repTotals.map(({rep,color,totalRevenue,totalCommission}) => (
          <div className="kpi-card" key={rep.name} style={{borderTopColor:color}}>
            <div className="kpi-avatar" style={{background:color+"22",color}}>
              {rep.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
            </div>
            <div className="kpi-name">{rep.name.split(" ")[0]}</div>
            <div className="kpi-revenue">{fmtS(totalRevenue)}</div>
            <div className="kpi-label">Revenue</div>
            <div className="kpi-commission" style={{color}}>{fmtS(totalCommission)}</div>
            <div className="kpi-label">Commission</div>
          </div>
        ))}
      </div>

      {/* ── Export Panel ── */}
      <div className="export-panel">
        <div className="export-section">
          <div className="export-section-header">
            <FileText size={15}/>
            <span>Rep Statement</span>
          </div>
          <p className="export-desc">Full monthly history + revenue chart for a rep — send directly to them.</p>
          <div className="export-row">
            <select className="modal-select export-sel" value={selRep==="All" ? "" : selRep}
              onChange={e => setSelRep(e.target.value)}>
              <option value="">— Select Rep —</option>
              {REPS.map(r=><option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
            <button className="export-btn export-btn-rep"
              onClick={() => {
                const rep = REPS.find(r=>r.name===selRep);
                if (!rep) { alert("Select a rep first."); return; }
                exportRepPDF(rep, savedEntries, savedEntries);
              }}
              disabled={selRep==="All"}>
              <Download size={13}/> Export PDF
            </button>
          </div>
        </div>

        <div className="export-divider"/>

        <div className="export-section">
          <div className="export-section-header">
            <FileText size={15}/>
            <span>Accounting Payroll Sheet</span>
          </div>
          <p className="export-desc">All reps for a selected month — shows commissions owed for payroll processing.</p>
          <div className="export-row">
            <select className="modal-select export-sel" value={`${exportYear}-${String(exportMonth).padStart(2,"0")}`}
              onChange={e => {
                const [y,m] = e.target.value.split("-");
                setExportYear(parseInt(y)); setExportMonth(parseInt(m));
              }}>
              {savedPeriods.length > 0
                ? savedPeriods.map(p => {
                    const [y,m] = p.split("-");
                    return <option key={p} value={p}>{MONTH_FULL[parseInt(m)-1]} {y}</option>;
                  })
                : <option value="">No saved months</option>
              }
            </select>
            <button className="export-btn export-btn-acct"
              onClick={() => exportAccountingPDF(exportMonth, exportYear, savedEntries)}
              disabled={savedPeriods.length===0}>
              <Download size={13}/> Export PDF
            </button>
          </div>
        </div>
      </div>

      {savedEntries.length===0 ? (
        <div className="empty-state">
          <BarChart2 size={40} className="empty-icon"/>
          <p>No saved data yet. Use the Calculator tab to enter and save a month.</p>
        </div>
      ) : (
        <>
          <div className="chart-section">
            <h3 className="chart-title">Monthly Revenue by Rep</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={makeChart("grossRevenue")} margin={{top:8,right:16,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false}/>
                  <XAxis dataKey="period" tick={{fill:axisColor,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={fmtS} tick={{fill:axisColor,fontSize:11}} axisLine={false} tickLine={false} width={56}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{fontSize:11,paddingTop:12,color:axisColor}} formatter={(n:string)=>n.split(" ")[0]}/>
                  {filteredReps.map(rep=>(
                    <Line key={rep.name} type="monotone" dataKey={rep.name}
                      stroke={REP_COLORS[REPS.findIndex(r=>r.name===rep.name)]}
                      strokeWidth={2.5} dot={{r:4}} activeDot={{r:6}}/>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-section">
            <h3 className="chart-title">Monthly Commission Earned</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={makeChart("commission")} margin={{top:8,right:16,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false}/>
                  <XAxis dataKey="period" tick={{fill:axisColor,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={fmtS} tick={{fill:axisColor,fontSize:11}} axisLine={false} tickLine={false} width={56}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{fontSize:11,paddingTop:12,color:axisColor}} formatter={(n:string)=>n.split(" ")[0]}/>
                  {filteredReps.map(rep=>(
                    <Line key={rep.name} type="monotone" dataKey={rep.name}
                      stroke={REP_COLORS[REPS.findIndex(r=>r.name===rep.name)]}
                      strokeWidth={2.5} dot={{r:4}} activeDot={{r:6}}/>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* History table */}
      <div className="chart-section">
        <h3 className="chart-title">Monthly History</h3>
        <div className="history-table-wrapper">
          <table className="history-table">
            <thead>
              <tr><th>Rep</th><th>Period</th><th>Gross Revenue</th><th>Total Closed</th><th>Resale</th><th>Base / Draw</th><th>Commission</th><th>Emp. Mo.</th><th></th></tr>
            </thead>
            <tbody>
              {tableRows.map((row,i) => {
                const ci    = REPS.findIndex(r=>r.name===row.repName);
                const color = REP_COLORS[ci]??"#6b7280";
                const baseDisplay = row.commBase > 0
                  ? fmt(row.commBase)
                  : row.guarantee > 0
                    ? `${fmt(row.guarantee)} draw`
                    : "—";
                return (
                  <tr key={`${row.repName}-${row.year}-${row.month}-${i}`}>
                    <td className="td-rep">
                      <div className="td-rep-inner">
                        <div className="td-avatar" style={{background:color+"22",color}}>
                          {row.repName.split(" ").map(n=>n[0]).join("").slice(0,2)}
                        </div>
                        {row.repName}
                      </div>
                    </td>
                    <td>{MONTH_NAMES[row.month-1]} {row.year}</td>
                    <td className="td-num">{fmt(row.grossRevenue)}</td>
                    <td className="td-num">{row.totalClosed ?? "—"}</td>
                    <td className="td-num">{row.closedResale}</td>
                    <td className="td-num">{baseDisplay}</td>
                    <td className="td-num td-commission">{fmt(row.commission)}</td>
                    <td className="td-num">{row.empMonth}</td>
                    <td>
                      <button className="delete-btn" title="Delete"
                        onClick={()=>onDelete(row.repName,row.year,row.month)}>
                        <Trash2 size={13}/>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {tableRows.length===0 && <tr><td colSpan={8} className="table-empty-cell">No entries.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function CommissionDashboard() {
  const [darkMode, setDarkMode] = useState(
    typeof window!=="undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [activeTab, setActiveTab] = useState<"calculator"|"charts">("calculator");

  // Seed Jan–Mar 2026 SPR data (0 resale deductions — user corrects via Calculator tab)
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>(() => {
    const sprData: Array<{ repName: string; year: number; month: number; grossRevenue: number }> = [
      { repName: "Joanna Jones",     year: 2026, month: 1, grossRevenue: 326821.90 },
      { repName: "Joanna Jones",     year: 2026, month: 2, grossRevenue: 421380.60 },
      { repName: "Joanna Jones",     year: 2026, month: 3, grossRevenue: 425223.90 },
      { repName: "Rachael Turner",   year: 2026, month: 1, grossRevenue: 283904.70 },
      { repName: "Rachael Turner",   year: 2026, month: 2, grossRevenue: 240292.60 },
      { repName: "Rachael Turner",   year: 2026, month: 3, grossRevenue: 400026.20 },
      { repName: "Jackie Jarquin",   year: 2026, month: 1, grossRevenue: 195705.60 },
      { repName: "Jackie Jarquin",   year: 2026, month: 2, grossRevenue: 254606.09 },
      { repName: "Jackie Jarquin",   year: 2026, month: 3, grossRevenue: 274494.70 },
      { repName: "Tricia Shipley",   year: 2026, month: 1, grossRevenue: 69262.20 },
      { repName: "Tricia Shipley",   year: 2026, month: 2, grossRevenue: 126801.65 },
      { repName: "Tricia Shipley",   year: 2026, month: 3, grossRevenue: 141208.30 },
      { repName: "Carrie Shuler",    year: 2026, month: 2, grossRevenue: 31995.20 },
      { repName: "Carrie Shuler",    year: 2026, month: 3, grossRevenue: 30384.50 },
      { repName: "Sarah Perkins",    year: 2026, month: 1, grossRevenue: 211087.74 },
      { repName: "Sarah Perkins",    year: 2026, month: 2, grossRevenue: 214527.90 },
      { repName: "Sarah Perkins",    year: 2026, month: 3, grossRevenue: 246857.90 },
    ];
    return sprData.map(d => {
      const rep       = REPS.find(r => r.name === d.repName)!;
      const empMonth  = getEmpMonth(rep, d.year, d.month);
      const commBase  = rep.getCommBase(empMonth);
      const guarantee = rep.getGuarantee(empMonth);
      const resaleDed = getResaleDed(d.repName);
      const commission = d.repName === "Hannah Pfleiger"
        ? calcHannahCommission(d.grossRevenue).commission
        : calcCommission(d.grossRevenue, 0, commBase, resaleDed).commission;
      return { repName: d.repName, year: d.year, month: d.month, grossRevenue: d.grossRevenue, closedResale: 0, totalClosed: 0, commission, commBase, guarantee, empMonth, resaleDeductionAmt: resaleDed };
    });
  });

  useState(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  });

  const toggleTheme = () => {
    setDarkMode(d => {
      document.documentElement.setAttribute("data-theme", !d?"dark":"light");
      return !d;
    });
  };

  const handleSaveMonth = (entries: SavedEntry[]) => {
    setSavedEntries(prev => {
      const { year, month } = entries[0];
      const filtered = prev.filter(e => !(e.year===year && e.month===month));
      return [...filtered, ...entries.filter(e => e.grossRevenue > 0)];
    });
  };

  const handleDelete = (repName: string, year: number, month: number) => {
    setSavedEntries(prev => prev.filter(e => !(e.repName===repName && e.year===year && e.month===month)));
  };

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="Navi Title">
              <rect width="32" height="32" rx="8" fill="currentColor" className="logo-bg"/>
              <text x="16" y="22" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="system-ui,sans-serif" letterSpacing="0.5">NT</text>
            </svg>
            <div>
              <div className="dash-logo-name">Navi Title</div>
              <div className="dash-logo-sub">Commission Calculator</div>
            </div>
          </div>

          <div className="tab-switcher">
            <button className={`tab-btn${activeTab==="calculator"?" tab-btn-active":""}`}
              onClick={()=>setActiveTab("calculator")}>
              <Calculator size={14}/> Calculator
            </button>
            <button className={`tab-btn${activeTab==="charts"?" tab-btn-active":""}`}
              onClick={()=>setActiveTab("charts")}>
              <BarChart2 size={14}/> Charts &amp; History
            </button>
          </div>

          <div className="dash-header-right">
            <div className="dash-date">May 2026</div>
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode">
              {darkMode ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
          </div>
        </div>
      </header>

      <div className="info-bar">
        <div className="info-bar-inner">
          <div className="info-pill"><DollarSign size={13}/><span>Base deducted before commission calculates</span></div>
          <div className="info-pill"><TrendingUp size={13}/><span>10% up to $200k · 12.5% above $200k</span></div>
          <div className="info-pill"><Users size={13}/><span>$250 deducted per closed resale</span></div>
        </div>
      </div>

      {activeTab==="calculator" ? (
        <main className="rep-grid-wrapper">
          <CalcTab savedEntries={savedEntries} onSaveMonth={handleSaveMonth}/>
        </main>
      ) : (
        <main className="rep-grid-wrapper">
          <ChartsTab savedEntries={savedEntries} onDelete={handleDelete} darkMode={darkMode}/>
        </main>
      )}

      {/* Mobile bottom tab bar — visible on screens ≤768px */}
      <nav className="mobile-tab-bar">
        <button
          className={`mobile-tab-btn${activeTab==="calculator" ? " active" : ""}`}
          onClick={() => setActiveTab("calculator")}>
          <Calculator size={22}/>
          Calculator
        </button>
        <button
          className={`mobile-tab-btn${activeTab==="charts" ? " active" : ""}`}
          onClick={() => setActiveTab("charts")}>
          <BarChart2 size={22}/>
          Charts &amp; History
        </button>
      </nav>
    </div>
  );
}
