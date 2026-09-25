import { CircleAlert, Printer, Share2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Skeleton, useSkeleton } from "../components/Bits";
import { Button } from "../components/Button";
import { TopBar } from "../components/Chrome";
import { useNotify } from "../components/Notify";
import { ReceiptDoc, receiptShareText } from "../components/ReceiptDoc";
import { accessOf, customerById, useAppData } from "../data/store";
import { canViewVisit } from "../lib/checkout";

export function ReceiptPage() {
  const { visitId, paymentId } = useParams();
  const data = useAppData();
  const notify = useNotify();
  const loading = useSkeleton(500);
  // Receipts are only shown on the phone or account the visit belongs to.
  const found = data.visits.find((v) => v.id === visitId);
  const visit = found && canViewVisit(found, accessOf(data)) ? found : undefined;
  const payment = visit?.payments.find((p) => p.id === paymentId);
  const customer = visit ? customerById(data, visit.customerId) : undefined;

  if (loading) {
    return (
      <main className="screen is-doc" aria-busy="true">
        <TopBar back backRow="Back to visit" title="Receipt" alwaysSolid />
        <Skeleton h={640} r={10} style={{ marginTop: 8 }} />
      </main>
    );
  }

  if (!visit || !payment) {
    return (
      <main className="screen is-doc">
        <TopBar back backRow="Back" title="Receipt" alwaysSolid />
        <div className="empty" style={{ marginTop: "12vh" }}>
          <span className="empty-icon">
            <CircleAlert size={24} />
          </span>
          <p className="t-title">Receipt not found</p>
          <p className="muted">Open it from your visit's receipts. If you booked on another phone, find the booking first.</p>
          <Link to="/visits?tab=receipts" className="btn btn-outline" style={{ marginTop: 8 }}>
            All receipts
          </Link>
        </div>
      </main>
    );
  }

  const share = async () => {
    const text = receiptShareText(visit, payment);
    try {
      if (navigator.share) await navigator.share({ title: `Receipt ${payment.receiptNo}`, text });
      else {
        await navigator.clipboard.writeText(text);
        notify("Receipt copied", "Paste it into WhatsApp or anywhere you need it.");
      }
    } catch {
      /* share sheet closed */
    }
  };

  return (
    <main className="screen is-doc">
      <TopBar
        back
        backRow="Back to visit"
        title={payment.receiptNo}
        alwaysSolid
        right={
          <button className="icon-btn is-plain no-print" onClick={share} aria-label="Share receipt">
            <Share2 size={20} strokeWidth={1.8} />
          </button>
        }
      />

      <ReceiptDoc visit={visit} payment={payment} customer={customer} />

      <div className="stack gap-12 no-print receipt-actions" style={{ marginTop: 16 }}>
        <Button variant="dark" block icon={<Printer size={18} />} onClick={() => window.print()}>
          Print or save as PDF
        </Button>
        <Button block icon={<Share2 size={18} />} onClick={share}>
          Share receipt
        </Button>
      </div>
    </main>
  );
}
