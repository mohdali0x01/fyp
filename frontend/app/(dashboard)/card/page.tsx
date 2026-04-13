import type { Metadata } from "next";
import { CardView } from "@/components/dashboard/CardView";

export const metadata: Metadata = { title: "My Aid Card" };

export default function CardPage() {
  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">My Aid Card</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your virtual aid card is linked to your blockchain approval hash.
        </p>
      </div>
      <CardView />
    </div>
  );
}
