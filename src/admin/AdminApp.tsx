import { CircleAlert } from "lucide-react";
import { Link, Route, Routes } from "react-router-dom";
import "../styles/admin.css";
import "../styles/salon-admin.css";
import { AdminLayout, AdminPage, EmptyState } from "./Shell";
import { ClientProfile } from "./screens/ClientProfile";
import { Clients } from "./screens/Clients";
import { Diary } from "./screens/Diary";
import { AdminReceipt, Payments } from "./screens/Payments";
import { Reports } from "./screens/Reports";
import { Reviews } from "./screens/Reviews";
import { Services } from "./screens/Services";
import { Settings } from "./screens/Settings";
import { Staff } from "./screens/Staff";
import { Today } from "./screens/Today";
import { WalkIn } from "./screens/WalkIn";

function AdminNotFound() {
  return (
    <AdminPage title="Page not found">
      <EmptyState
        icon={<CircleAlert size={22} />}
        title="This link doesn't lead anywhere"
        body="It may point to a visit or client that was removed when the demo was reset."
        action={
          <Link to="/admin" className="btn btn-dark">
            Go to Today
          </Link>
        }
      />
    </AdminPage>
  );
}

/** Salon side routes, under /admin. */
export function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Today />} />
        <Route path="diary" element={<Diary />} />
        <Route path="walk-in" element={<WalkIn />} />
        <Route path="visits/:visitId/receipts/:paymentId" element={<AdminReceipt />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:clientId" element={<ClientProfile />} />
        <Route path="staff" element={<Staff />} />
        <Route path="payments" element={<Payments />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="services" element={<Services />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<AdminNotFound />} />
      </Route>
    </Routes>
  );
}
