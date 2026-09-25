import { AlertTriangle, CalendarClock, MessageCircle, Search, Users } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Avatar } from "../../components/Bits";
import { SALON } from "../../data/business";
import { useAppData } from "../../data/store";
import { formatGhPhone, whatsappLink } from "../../lib/contact";
import { fmtDate, money, parseLocal, relativeDay } from "../../lib/format";
import { rebookDueList } from "../../lib/metrics";
import { paidTotal } from "../../lib/visits";
import { useBranchScope } from "../branch";
import { useDebounced, useNow } from "../hooks";
import { AdminPage, BranchSwitch, EmptyState } from "../Shell";

type View = "all" | "rebook";

export function Clients() {
  const data = useAppData();
  const now = useNow();
  const scope = useBranchScope();
  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "rebook" ? "rebook" : "all";
  const query = params.get("q") ?? "";
  const debounced = useDebounced(query);

  const rows = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    return data.customers
      .map((customer) => {
        const theirs = data.visits.filter((v) => v.customerId === customer.id && (scope === "all" || v.branchId === scope));
        const last = theirs.filter((v) => v.status === "done").sort((a, b) => b.start.localeCompare(a.start))[0];
        return { customer, visits: theirs.length, spent: theirs.reduce((sum, v) => sum + paidTotal(v), 0), last };
      })
      .filter((row) => scope === "all" || row.visits > 0)
      .filter((row) => {
        if (!needle) return true;
        return row.customer.name.toLowerCase().includes(needle) || (digits.length >= 3 && row.customer.phone.replace(/\D/g, "").includes(digits));
      })
      .sort((a, b) => (b.last?.start ?? "").localeCompare(a.last?.start ?? ""));
  }, [data.customers, data.visits, debounced, scope]);

  const rebook = useMemo(
    () =>
      rebookDueList(data.visits, now).filter((lead) => {
        const visit = data.visits.find((v) => v.id === lead.visitId);
        return scope === "all" || visit?.branchId === scope;
      }),
    [data.visits, now, scope],
  );

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  return (
    <AdminPage title="Clients" status={`${data.customers.length} on record`} actions={<BranchSwitch />}>
      <div className="adm-stack">
        <div className="segmented clients-tabs" role="tablist" aria-label="Client lists">
          <button role="tab" aria-selected={view === "all"} className={view === "all" ? "is-active" : ""} onClick={() => set({ view: "" })}>
            Everyone
          </button>
          <button role="tab" aria-selected={view === "rebook"} className={view === "rebook" ? "is-active" : ""} onClick={() => set({ view: "rebook" })}>
            Due back {rebook.length > 0 && <span className="chip-count">{rebook.length}</span>}
          </button>
        </div>

        {view === "all" ? (
          <>
            <label className="rh-search">
              <Search size={17} strokeWidth={1.8} />
              <input type="search" value={query} onChange={(e) => set({ q: e.target.value })} placeholder="Name or phone number" aria-label="Search clients" />
            </label>
            {rows.length === 0 ? (
              <EmptyState icon={<Users size={24} />} title={query ? `No client matches "${query}"` : "No clients yet"} body="Every walk-in and online booking adds the client here automatically." />
            ) : (
              <section className="adm-card">
                <div className="adm-rows">
                  {rows.map(({ customer, visits, spent, last }) => (
                    <Link key={customer.id} className="adm-row" to={`/admin/clients/${customer.id}`}>
                      <Avatar name={customer.name} size={38} soft />
                      <span className="grow stack gap-4" style={{ minWidth: 0 }}>
                        <span className="t-title truncate">
                          {customer.name}
                          {customer.hair?.allergies && <span className="allergy-dot" title="Allergy on record" aria-label="Allergy on record" />}
                        </span>
                        <span className="muted t-cap truncate">
                          {formatGhPhone(customer.phone)} · {visits} visit{visits === 1 ? "" : "s"}
                          {last ? ` · last ${fmtDate(parseLocal(last.start))}` : ""}
                        </span>
                      </span>
                      <span className="tabular t-cap">{money(spent)}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : rebook.length === 0 ? (
          <EmptyState icon={<CalendarClock size={24} />} title="Nobody is due back yet" body="When a regular's usual service is due and nothing is booked, they appear here." />
        ) : (
          <section className="adm-card">
            <div className="adm-card-head">
              <h2 className="t-title">Due back in the next two weeks</h2>
            </div>
            <p className="adm-meta" style={{ padding: "0 20px 8px" }}>
              Worked out from how often each service is usually repeated. One friendly message each is usually enough.
            </p>
            <div className="adm-rows">
              {rebook.map((lead) => {
                const customer = data.customers.find((c) => c.id === lead.customerId);
                if (!customer) return null;
                const due = parseLocal(lead.due);
                const overdue = due < now;
                const text = `Hello ${customer.name.split(" ")[0]}, it's ${SALON.name}. Your ${lead.serviceNames.toLowerCase()} is due around now. Shall we book you in? Reply with a day that suits you.`;
                return (
                  <div key={lead.customerId} className="adm-row">
                    <Avatar name={customer.name} size={38} soft />
                    <Link to={`/admin/clients/${customer.id}`} className="grow stack gap-4" style={{ minWidth: 0 }}>
                      <span className="t-title truncate">{customer.name}</span>
                      <span className="muted t-cap truncate">{lead.serviceNames}</span>
                      <span className={`t-cap ${overdue ? "is-overdue" : "subtle"}`}>
                        {overdue ? <AlertTriangle size={12} /> : null} Due {relativeDay(due, now).toLowerCase()}
                      </span>
                    </Link>
                    <a className="btn btn-outline btn-sm" href={whatsappLink(customer.phone, text)} target="_blank" rel="noreferrer">
                      <MessageCircle size={15} strokeWidth={1.8} />
                      <span className="desktop-only">Message</span>
                    </a>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AdminPage>
  );
}
