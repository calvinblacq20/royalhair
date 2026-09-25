import { Route, Routes } from "react-router-dom";
import { ClientProfile } from "./screens/ClientProfile";
import { Clients } from "./screens/Clients";
import { Diary } from "./screens/Diary";
import { Reports } from "./screens/Reports";
import { Reviews } from "./screens/Reviews";
import { Services } from "./screens/Services";
import { Settings } from "./screens/Settings";
import { Staff } from "./screens/Staff";
import { Today } from "./screens/Today";
import { WalkIn } from "./screens/WalkIn";
import { AdminLayout, EmptyState } from "./Shell";
import "../styles/admin.css";
import "../styles/salon-admin.css";

function NotFound() {
  return (
    <main className="adm-page">
      <EmptyState icon={null} title="Page not found" body="This link doesn't lead anywhere in the salon admin." />
    </main>
  );
}

export function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Today />} />
        <Route path="diary" element={<Diary />} />
        <Route path="walk-in" element={<WalkIn />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:clientId" element={<ClientProfile />} />
        <Route path="staff" element={<Staff />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="reports" element={<Reports />} />
        <Route path="services" element={<Services />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
