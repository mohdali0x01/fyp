import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your AidLedger account to apply for aid assistance.",
};

export default function SignupPage() {
  return (
    <div className="hero-gradient grid-bg min-h-screen flex items-center justify-center px-4 py-10 sm:py-20">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Back to home */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors group mb-6"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Home
        </Link>

        {/* Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center group-hover:bg-emerald-500/20 transition-all">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="font-bold text-xl">
              <span className="gradient-text">Aid</span>
              <span className="text-slate-200">Ledger</span>
            </span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-slate-100">Apply for Aid</h1>
          <p className="mt-2 text-sm text-slate-500">
            Create an account to begin your eligibility verification
          </p>
        </div>

        <SignupForm />

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
