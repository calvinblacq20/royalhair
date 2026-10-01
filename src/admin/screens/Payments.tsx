import { ChevronRight, CircleAlert, Printer, ReceiptText, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Skeleton } from "../../components/Bits";
import { Button } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { ReceiptDoc, receiptShareText } from "../../components/ReceiptDoc";
import { branchById } from "../../data/business";
import { customerById, useAppData } from "../../data/store";
import type { PaymentMethod } from "../../data/types";
import { fmtDate, fmtDayShort, fmtTime, money, plural } from "../../lib/format";
import { delta, METHOD_LABEL, metricValue, paymentsByMethod, periodLabel, periodRange, previousRange } from "../../lib/trends";
import { balanceDue, isActive } from "../../lib/visits";
import { SegmentedBar } from "../charts";
import { CardHead, DeltaPill, PeriodSelect } from "../controls";
import { useFirstLoad, useFirstVisit, useNow } from "../hooks";
import { AdminPage, BranchSwitch, EmptyState } from "../Shell";
import { usePeriod, useScopedVisits } from "./Today";

export const METHOD_COLOR: Record<PaymentMethod, string> = { momo: "#fc5aa3", cash: "#b8deff", bank: "#c0adff", card: "#e0c5b6" };
const KIND = { deposit: "Deposit", part: "Part", final: "Final" } as const;
const PAGE_SIZE = 20;

export function Payments() {
  const data = useAppData();
  const visits = useScopedVisits();
  const now = useNow();
  const navigate = useNavigate();
  const [period, setPeriod] = usePeriod();
  const [params, setParams] = useSearchParams();
  const loading = useFirstLoad("payments");
  const first = useFirstVisit("payments");
  const method = (["momo", "cash", "bank", "card"] as const).find((m) => m === params.get("method")) ?? null;
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const range = periodRange(period, now);
  const prev = previousRange(period, range);
  const all = useMemo(
    () =>
      visits
        .flatMap((visit) => visit.payments.map((payment) => ({ visit, payment })))
        .filter(({ payment }) => {
          const t = new Date(payment.at);
          return t >= range.start && t < range.end;
        })
        .sort((a, b) => b.payment.at.localeCompare(a.payment.at)),
    [visits, range.start, range.end],
  );
  const q = query.trim().toLowerCase();
  const rows = all.filter(({ visit, payment }) => {
    if (method && payment.method !== method) return false;
    if (!q) return true;
    const name = customerById(data, visit.customerId)?.name.toLowerCase() ?? "";
    return name.includes(q) || payment.receiptNo.toLowerCase().includes(q) || visit.number.toLowerCase().includes(q) || payment.reference.toLowerCase().includes(q);
  });
  const total = metricValue("cash", visits, range) ?? 0;
  const prevTotal = metricValue("cash", visits, prev) ?? 0;
  const methods = paymentsByMethod(visits, range);
  const owed = visits.filter((v) => isActive(v)).reduce((sum, v) => sum + balanceDue(v), 0);

  const setMethod = (m: PaymentMethod | null) => {
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (m) next.set("method", m);
        else next.delete("method");
        return next;
      },
      { replace: true },
    );
    setLimit(PAGE_SIZE);
  };

  return (
    <AdminPage
      title="Payments"
      status={
        <>
          {periodLabel(period)} · {plural(all.length, "payment")}
        </>
      }
      actions={
        <>
          <BranchSwitch />
          <PeriodSelect value={period} onChange={setPeriod} />
        </>
      }
    >
      <div className="adm-grid adm-grid-2" style={{ marginBottom: 16 }}>
        <section className="adm-card" aria-labelledby="received">
          <CardHead id="received" title="Received" action={<DeltaPill delta={delta(total, prevTotal, "up")} />} />
          <div className="adm-card-body">
            <p className="adm-big" style={{ fontSize: 48, color: "var(--ink)" }}>
              {money(total)}
            </p>
            <dl className="adm-kv-grid" style={{ marginTop: 16 }}>
              <div>
                <dt>Previous period</dt>
                <dd>{money(prevTotal)}</dd>
              </div>
              <div>
                <dt>Still owed on open visits</dt>
                <dd style={{ color: owed ? "var(--warning-ink)" : undefined }}>{money(owed)}</dd>
              </div>
              <div>
                <dt>Payments</dt>
                <dd>{all.length}</dd>
              </div>
              <div>
                <dt>Average payment</dt>
                <dd>{money(all.length ? Math.round(total / all.length) : 0)}</dd>
              </div>
            </dl>
          </div>
        </section>
        <section className="adm-card" aria-labelledby="by-method">
          <CardHead id="by-method" title="By method" />
          <div className="adm-card-body">
            <SegmentedBar
              animate={first}
              format={money}
              ariaLabel={`Payments by method: ${methods.map((m) => `${m.label} ${Math.round(m.share * 100)}%`).join(", ")}`}
              parts={methods.map((m) => ({ key: m.key, label: `${m.label} · ${plural(m.count, "payment")}`, value: m.value, share: m.share, color: METHOD_COLOR[m.key] }))}
            />
          </div>
        </section>
      </div>

      <div className="between" style={{ flexWrap: "wrap", marginBottom: 12 }}>
        <div className="chips" role="radiogroup" aria-label="Method" style={{ margin: 0 }}>
          <button role="radio" aria-checked={!method} className={`chip ${!method ? "is-active" : ""}`} onClick={() => setMethod(null)}>
            All
          </button>
          {(["momo", "cash", "bank", "card"] as const).map((m) => (
            <button key={m} role="radio" aria-checked={method === m} className={`chip ${method === m ? "is-active" : ""}`} onClick={() => setMethod(m)}>
              {METHOD_LABEL[m]}
            </button>
          ))}
        </div>
        <input
          className="adm-input"
          style={{ maxWidth: 320, height: 40, background: "var(--surface)", boxShadow: "var(--sh-soft)", borderRadius: 500 }}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Client, receipt or booking number"
          aria-label="Search payments"
        />
      </div>

      {loading ? (
        <Skeleton h={420} r={8} />
      ) : rows.length === 0 ? (
        <div className="adm-card">
          <EmptyState icon={<ReceiptText size={22} />} title="No payments match" body={all.length ? "Try another method or search." : "Nothing was received in this period."} />
        </div>
      ) : (
        <section className="adm-card" aria-label="Payments list">
          <div className="adm-table-wrap desktop-only">
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Receipt</th>
                  <th scope="col">Client</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Method</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map(({ visit, payment }) => {
                  const at = new Date(payment.at);
                  const to = `/admin/visits/${visit.id}/receipts/${payment.id}`;
                  return (
                    <tr key={payment.id} onClick={() => navigate(to)}>
                      <td>
                        {fmtDayShort(at)}, {fmtTime(at)}
                      </td>
                      <td>
                        <Link to={to} className="t-mono" onClick={(e) => e.stopPropagation()}>
                          {payment.receiptNo}
                        </Link>
                      </td>
                      <td>{customerById(data, visit.customerId)?.name}</td>
                      <td>{branchById(visit.branchId)?.name}</td>
                      <td>
                        {METHOD_LABEL[payment.method]}
                      </td>
                      <td>{KIND[payment.kind]}</td>
                      <td className="num" style={{ fontWeight: 500 }}>
                        {money(payment.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="adm-rows mobile-only" style={{ paddingBlock: 4 }}>
            {rows.slice(0, limit).map(({ visit, payment }) => (
              <Link key={payment.id} to={`/admin/visits/${visit.id}/receipts/${payment.id}`} className="adm-row">
                <span className="grow stack">
                  <span className="truncate">{customerById(data, visit.customerId)?.name}</span>
                  <span className="t-cap muted">
                    {fmtDate(new Date(payment.at))} · {METHOD_LABEL[payment.method]} · <span className="t-mono">{visit.number}</span>
                  </span>
                </span>
                <span className="tabular" style={{ fontWeight: 500 }}>
                  {money(payment.amount)}
                </span>
                <ChevronRight size={18} className="row-chevron" />
              </Link>
            ))}
          </div>
          <div className="adm-card-foot">
            <span className="adm-meta">
              Showing {Math.min(limit, rows.length)} of {rows.length}
            </span>
            {limit < rows.length && (
              <button className="btn btn-outline btn-sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Load more
              </button>
            )}
          </div>
        </section>
      )}
    </AdminPage>
  );
}

/** The official receipt, as the front desk prints or shares it. */
export function AdminReceipt() {
  const { visitId, paymentId } = useParams();
  const data = useAppData();
  const notify = useNotify();
  const visit = data.visits.find((v) => v.id === visitId);
  const payment = visit?.payments.find((p) => p.id === paymentId);
  if (!visit || !payment) {
    return (
      <AdminPage title="Receipt not found" back={{ to: "/admin/payments", label: "Payments" }}>
        <EmptyState icon={<CircleAlert size={22} />} title="We couldn't find that receipt" body="Open it from the payments list." />
      </AdminPage>
    );
  }
  const customer = customerById(data, visit.customerId);
  const share = async () => {
    const text = receiptShareText(visit, payment);
    try {
      if (navigator.share) await navigator.share({ title: `Receipt ${payment.receiptNo}`, text });
      else {
        await navigator.clipboard.writeText(text);
        notify("Receipt copied", "Paste it into WhatsApp for the client.");
      }
    } catch {
      /* share sheet closed */
    }
  };
  return (
    <AdminPage
      title="Receipt"
      barTitle={payment.receiptNo}
      back={{ to: "/admin/payments", label: "Payments" }}
      status={<span className="t-mono">{payment.receiptNo}</span>}
      actions={
        <span className="inline no-print" style={{ gap: 8 }}>
          <Button icon={<Share2 size={16} />} onClick={share}>
            Share
          </Button>
          <Button variant="dark" icon={<Printer size={16} />} onClick={() => window.print()}>
            Print
          </Button>
        </span>
      }
    >
      <div style={{ maxWidth: 640 }}>
        <ReceiptDoc visit={visit} payment={payment} customer={customer} />
      </div>
    </AdminPage>
  );
}
