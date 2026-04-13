import type { Metadata } from "next";
import { NotificationsView } from "@/components/dashboard/NotificationsView";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Notifications</h1>
        <p className="text-sm text-slate-500 mt-1">
          Status updates from your verification pipeline — delivered in Urdu.
        </p>
      </div>
      <NotificationsView />
    </div>
  );
}
