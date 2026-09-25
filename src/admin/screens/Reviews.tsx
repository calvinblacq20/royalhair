import { EyeOff, MessageSquareReply, Star } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Stars } from "../../components/Bits";
import { Button } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { Sheet } from "../../components/Sheet";
import { branchById } from "../../data/business";
import { serviceById } from "../../data/catalog";
import { desk, useAppData } from "../../data/store";
import type { Review, ReviewStatus } from "../../data/types";
import { fmtDate, plural } from "../../lib/format";
import { useBranchScope } from "../branch";
import { AdminPage, BranchSwitch, EmptyState } from "../Shell";

const TABS: { id: ReviewStatus; label: string; empty: string }[] = [
  { id: "pending", label: "Waiting", empty: "No reviews waiting. New ones from clients show here before they go on the site." },
  { id: "published", label: "Published", empty: "Nothing published yet." },
  { id: "hidden", label: "Hidden", empty: "No hidden reviews." },
];

/** Nothing a client writes goes on the site until someone here has read it. */
export function Reviews() {
  const data = useAppData();
  const notify = useNotify();
  const scope = useBranchScope();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get("status"))?.id ?? "pending";
  const [replying, setReplying] = useState<Review | null>(null);
  const scoped = data.reviews.filter((r) => scope === "all" || r.branchId === scope);
  const count = (s: ReviewStatus) => scoped.filter((r) => r.status === s).length;
  const list = scoped.filter((r) => r.status === tab).sort((a, b) => b.at.localeCompare(a.at));
  const published = scoped.filter((r) => r.status === "published");
  const average = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : 0;

  const setStatus = (r: Review, status: ReviewStatus) => {
    desk.setReviewStatus(r.id, status);
    notify(status === "published" ? "Review published" : "Review hidden", status === "published" ? `${r.name}'s review now shows on the salon page.` : `${r.name}'s review no longer shows to clients.`);
  };

  return (
    <AdminPage
      title="Reviews"
      status={
        published.length ? (
          <>
            <Star size={14} fill="currentColor" strokeWidth={0} /> {average.toFixed(1)} from {plural(published.length, "published review")}
          </>
        ) : (
          "None published yet"
        )
      }
      actions={<BranchSwitch />}
    >
      <div className="chips" role="tablist" aria-label="Review status" style={{ margin: "0 0 16px" }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`chip ${tab === t.id ? "is-active" : ""}`} onClick={() => setParams(t.id === "pending" ? {} : { status: t.id }, { replace: true })}>
            {t.label}
            <span className="chip-count">{count(t.id)}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="adm-card" style={{ maxWidth: 860 }}>
          <EmptyState icon={<Star size={22} />} title={`No ${TABS.find((t) => t.id === tab)?.label.toLowerCase()} reviews`} body={TABS.find((t) => t.id === tab)?.empty} />
        </div>
      ) : (
        <div className="res-list" style={{ maxWidth: 860 }}>
          {list.map((r) => {
            const staff = data.staff.find((s) => s.id === r.staffId);
            return (
              <article key={r.id} className="adm-card" style={{ padding: "18px 20px" }}>
                <div className="stack gap-4">
                  <span className="inline" style={{ gap: 10 }}>
                    <Stars value={r.rating} />
                    <span style={{ fontWeight: 500 }}>{r.name}</span>
                  </span>
                  <span className="t-cap muted">
                    {fmtDate(new Date(r.at))} · {branchById(r.branchId)?.name}
                    {r.serviceId && ` · ${serviceById(r.serviceId)?.name ?? "Service"}`}
                    {staff && ` · with ${staff.name}`}
                    {r.customerId && (
                      <>
                        {" · "}
                        <Link to={`/admin/clients/${r.customerId}`} className="link">
                          Client record
                        </Link>
                      </>
                    )}
                  </span>
                </div>
                <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.55 }}>{r.text}</p>
                {r.reply && (
                  <div className="msg-preview" style={{ marginTop: 12, background: "var(--ground)" }}>
                    <span className="t-cap muted" style={{ display: "block", marginBottom: 2 }}>
                      Your reply
                    </span>
                    {r.reply}
                  </div>
                )}
                <div className="adm-actions" style={{ marginTop: 14 }}>
                  {r.status !== "published" && (
                    <Button variant="dark" size="sm" onClick={() => setStatus(r, "published")}>
                      Publish
                    </Button>
                  )}
                  {r.status !== "hidden" && (
                    <Button size="sm" icon={<EyeOff size={15} />} onClick={() => setStatus(r, "hidden")}>
                      Hide
                    </Button>
                  )}
                  <Button size="sm" icon={<MessageSquareReply size={15} />} onClick={() => setReplying(r)}>
                    {r.reply ? "Edit reply" : "Reply"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <ReplySheet review={replying} onClose={() => setReplying(null)} />
    </AdminPage>
  );
}

function ReplySheet({ review, onClose }: { review: Review | null; onClose: () => void }) {
  const notify = useNotify();
  const [text, setText] = useState("");
  const [forId, setForId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (review && review.id !== forId) {
    setForId(review.id);
    setText(review.reply ?? `Thank you, ${review.name.split(" ")[0]}! `);
    setError(null);
  }
  return (
    <Sheet open={review !== null} onClose={onClose} title="Reply to review">
      {review && (
        <div className="stack gap-12">
          <p className="muted">“{review.text}”</p>
          <label htmlFor="reply" className="t-cap muted">
            Your reply shows under the review on the salon page
          </label>
          <textarea id="reply" className="adm-textarea" value={text} maxLength={600} onChange={(e) => setText(e.target.value)} autoFocus />
          {error && (
            <p className="adm-form-error" role="alert">
              {error}
            </p>
          )}
          <Button
            variant="dark"
            block
            onClick={() => {
              const result = desk.replyToReview(review.id, text);
              if ("error" in result) return setError(result.error);
              onClose();
              notify("Reply saved", `Your reply to ${review.name} is saved.`);
            }}
          >
            Save reply
          </Button>
        </div>
      )}
    </Sheet>
  );
}
