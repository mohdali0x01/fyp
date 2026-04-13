import type { Metadata } from "next";
import { ApplyForm } from "@/components/dashboard/ApplyForm";

export const metadata: Metadata = { title: "Apply for Aid" };

export default function ApplyPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Aid Application</h1>
        <p className="text-sm text-slate-500 mt-1">
          Submit your details. The verification pipeline runs automatically and produces a blockchain-anchored result within seconds.
        </p>
      </div>
      <ApplyForm />
    </div>
  );
}
