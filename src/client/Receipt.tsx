import { Printer, Share2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { TopBar } from "../components/Chrome";
import { useNotify } from "../components/Notify";
import { ReceiptDoc, receiptShareText } from "../components/ReceiptDoc";
import { accessOf, useAppData } from "../data/store";
import { canViewVisit } from "../lib/checkout";

export function ReceiptPage() {
  const { visitId = "", paymentId = "" } = useParams();
  const data = useAppData();
  const notify = useNotify();

  const visit = data.visits.find((v) => v.id === visitId);
  const payment = visit?.payments.find((p) => p.id === paymentId);

  if (!visit || !payment || !canViewVisit(visit, accessOf(data))) {
    return (
      <main className="screen is-narrow">
        <TopBar back title="Receipt" alwaysSolid backRow="Back" />
        <div className="empty" style={{ marginTop: "18vh" }}>
          <p className="t-title">Receipt not found</p>
          <p className="muted">This receipt isn't on this phone.</p>
          <Link className="btn btn-dark" to="/visits" style={{ marginTop: 12 }}>
            Go to my visits
          </Link>
        </div>
      </main>
    );
  }

  const customer = data.customers.find((c) => c.id === visit.customerId);
  const text = receiptShareText(visit, payment);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Receipt ${payment.receiptNo}`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      notify("Receipt copied", "Paste it into WhatsApp or an email.");
    } catch (error) {
      // A cancelled share dialog is not a failure worth shouting about.
      console.warn("Could not share the receipt.", error);
      notify("Couldn't share", "Try taking a screenshot instead.");
    }
  };

  return (
    <main className="screen is-narrow">
      <TopBar back title={payment.receiptNo} alwaysSolid backRow="Back" />
      <ReceiptDoc visit={visit} payment={payment} customer={customer} />
      <div className="inline gap-8 no-print" style={{ marginTop: 16 }}>
        <Button block icon={<Share2 size={16} />} onClick={share}>
          Share
        </Button>
        <Button block icon={<Printer size={16} />} onClick={() => window.print()}>
          Print
        </Button>
      </div>
    </main>
  );
}
