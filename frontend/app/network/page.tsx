import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { NetworkDashboard } from "@/components/network/NetworkDashboard";

export const metadata: Metadata = {
  title: "Network Status",
  description: "Live Hyperledger Besu blockchain network metrics for AidLedger.",
};

export default function NetworkPage() {
  return (
    <div className="hero-gradient grid-bg min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-700 bg-slate-800/50 text-slate-400 text-xs mb-4">
              Live Network
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2 text-left">
              Blockchain Network Status
            </h1>
            <p className="text-sm text-slate-500 text-left">
              Live metrics from the 4-node Hyperledger Besu Quorum network. All data fetched directly from the RPC endpoint.
            </p>
          </div>
          <NetworkDashboard />
        </div>
      </main>
      <Footer />
    </div>
  );
}
