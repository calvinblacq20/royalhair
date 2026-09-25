import { Check, EyeOff, MessageSquareReply, Star } from "lucide-react";
import { useState } from "react";
import { Badge, Stars } from "../../components/Bits";
import { Button } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { Sheet } from "../../components/Sheet";
import { branchById } from "../../data/business";
import { serviceById } from "../../data/catalog";
import { desk, useAppData } from "../../data/store";
import type { Review } from "../../data/types";
import { fmtDate } from "../../lib/format";
import { useBranchScope } from "../branch";
import { AdminPage, BranchSwitch, EmptyState } from "../Shell";

const TONE = { pending: "gold", published: "sage", hidden: "mist" } as const;
const LABEL = { pending: "Waiting", published: "On the site", hidden: "Hidden" } as const;

/** Nothing a client writes goes on the site until someone here has read it. */
export function Reviews() {
  const data = useAppData();
  const notify = useNotify();
  const scope = useBranchScope();
  const [replying, setReplying] = useState<Review | null>(null);

  const reviews = data.reviews
    .filter((r) => scope === "all" || r.branchId === scope)
    .sort((a, b) => (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0) || b.at.localeCompare(a.at));
  const published = reviews.filter((r) => r.status === "published");
  const average = published.length ? published.reduce((sum, r) => sum + r.rating, 0) / published.length : 0;

  return (
    <AdminPage
      title="Reviews"
      status={published.length ? `${average.toFixed(1)} average from ${published.length} on the site` : "None published yet"}
      actions={<BranchSwitch />}
    >
      {reviews.length === 0 ? (
        <EmptyState icon={<Star size={24} />} title="No reviews yet" body="Reviews clients leave after a visit wait here for approval." />
      ) : (
        <div className="adm-stack">
          {reviews.map((review) => (
            <article key={review.id} className="adm-card">
              <div className="adm-card-body stack gap-8">
                <div className="between">
                  <div className="inline gap-8">
                    <Stars value={review.rating} />
                    <span className="t-title">{review.name}</span>
                  </div>
                  <Badge tone={TONE[review.status]}>{LABEL[review.status]}</Badge>
                </div>
                <p>{review.text}</p>
                <p className="adm-meta">
                  {fmtDate(new Date(review.at))} · {branchById(review.branchId)?.name}
                  {review.serviceId && ` · ${serviceById(review.serviceId)?.name}`}
                  {review.staffId && ` · with ${data.staff.find((s) => s.id === review.staffId)?.name}`}
                </p>
                {review.reply && (
                  <p className="review-reply">
                    <b>Your reply:</b> {review.reply}
                  </p>
                )}
              </div>
              <div className="adm-card-foot">
                {review.status !== "published" && (
                  <Button
                    size="sm"
                    variant="dark"
                    icon={<Check size={15} />}
                    onClick={() => {
                      desk.setReviewStatus(review.id, "published");
                      notify("Published", `${review.name}'s review is on the site.`);
                    }}
                  >
                    Publish
                  </Button>
                )}
                {review.status !== "hidden" && (
                  <Button size="sm" icon={<EyeOff size={15} />} onClick={() => desk.setReviewStatus(review.id, "hidden")}>
                    Hide
                  </Button>
                )}
                <Button size="sm" icon={<MessageSquareReply size={15} />} onClick={() => setReplying(review)}>
                  {review.reply ? "Edit reply" : "Reply"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <ReplySheet review={replying} onClose={() => setReplying(null)} onSaved={() => notify("Reply saved", "It shows under the review on the site.")} />
    </AdminPage>
  );
}

function ReplySheet({ review, onClose, onSaved }: { review: Review | null; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [forId, setForId] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (review && review.id !== forId) {
    setForId(review.id);
    setText(review.reply ?? "");
    setError("");
  }
  return (
    <Sheet open={review !== null} onClose={onClose} title="Reply to review">
      <div className="stack gap-12">
        {review && <p className="muted">"{review.text}"</p>}
        <label className="field">
          <span>Your reply</span>
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={600} />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Button
          variant="dark"
          block
          onClick={() => {
            if (!review) return;
            const result = desk.replyToReview(review.id, text);
            if ("error" in result) {
              setError(result.error);
              return;
            }
            onSaved();
            onClose();
          }}
        >
          Save reply
        </Button>
      </div>
    </Sheet>
  );
}
