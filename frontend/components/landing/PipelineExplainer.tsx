import { ClipboardList, ScanLine, Users, BarChart2, CheckCircle, ArrowRight } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: ClipboardList,
    title: "Apply",
    description: "Beneficiary submits their CNIC, name, address, and city. Application is logged on Besu blockchain immediately.",
    status: "apply",
    color: "text-slate-400",
    bg: "bg-slate-700/50",
  },
  {
    number: "02",
    icon: ScanLine,
    title: "KYC Check",
    description: "CNIC is matched against the 130K NADRA dataset. Hash stored on-chain. Failure: KYC_FAILED notification in Urdu.",
    status: "kyc",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    number: "03",
    icon: Users,
    title: "Family Tree",
    description: "System checks if any family member already receives aid. Prevents double-dipping at the household level.",
    status: "family",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    number: "04",
    icon: BarChart2,
    title: "PMT Score",
    description: "Proxy Means Test calculates poverty score from salary, bills, expenses, and family size. Urban: ≤38, Rural: ≤32.",
    status: "pmt",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    number: "05",
    icon: CheckCircle,
    title: "Eligible",
    description: "markEligible() called on AidRegistry.sol. TX hash stored in PostgreSQL. Virtual card issuance triggered.",
    status: "eligible",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
];

export function PipelineExplainer() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 py-20 w-full overflow-x-hidden">
      <div className="max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-700 bg-slate-800/50 text-slate-400 text-xs mb-4">
            Verification Pipeline
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4 text-center">
            <span className="gradient-text">5 Stages.</span> Zero Corruption.
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed text-center">
            Every application passes through an automated, blockchain-anchored pipeline. No human can override any decision.
          </p>
        </div>

        {/* Pipeline steps */}
        <div className="relative">
          {/* Connector line */}
          <div className="hidden lg:block absolute top-10 left-[calc(10%+1.5rem)] right-[calc(10%+1.5rem)] h-0.5 bg-gradient-to-r from-slate-700 via-emerald-500/40 to-slate-700" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {STEPS.map((step, index) => (
              <div key={step.number} className="relative flex flex-col items-center text-center">
                {/* Step circle */}
                <div className={`relative z-10 w-12 h-12 rounded-full ${step.bg} border border-slate-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <step.icon className={`w-5 h-5 ${step.color}`} />
                </div>

                {/* Number */}
                <div className="text-xs font-mono text-slate-600 mb-1">{step.number}</div>

                {/* Title */}
                <h3 className={`font-semibold text-sm mb-2 ${step.color}`}>{step.title}</h3>

                {/* Description */}
                <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>

                {/* Mobile connector arrow */}
                {index < STEPS.length - 1 && (
                  <div className="lg:hidden flex justify-center my-2">
                    <ArrowRight className="w-4 h-4 text-slate-700 rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Code snippet */}
        <div className="mt-12 glass-card p-5 font-mono text-xs w-full">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
            <span className="text-slate-600 ml-2">pipeline.ts</span>
          </div>
          <div className="space-y-1 text-slate-500 overflow-x-auto">
            <div><span className="text-purple-400">await</span> <span className="text-blue-400">onChain_logApplication</span><span className="text-slate-400">(cnic)</span></div>
            <div><span className="text-purple-400">await</span> <span className="text-blue-400">onChain_markKycPassed</span><span className="text-slate-400">(cnic)</span></div>
            <div><span className="text-purple-400">const</span> <span className="text-emerald-400">pmtScore</span> = <span className="text-amber-400">calculatePmtScore</span><span className="text-slate-400">(kycData)</span></div>
            <div><span className="text-purple-400">const</span> <span className="text-emerald-400">hash</span> = <span className="text-purple-400">await</span> <span className="text-blue-400">onChain_markEligible</span><span className="text-slate-400">(cnic, pmtScore, isUrban)</span></div>
            <div><span className="text-purple-400">await</span> <span className="text-blue-400">prisma.eligible.create</span><span className="text-slate-400">{"({"} cnic, blockchain_approval_hash: hash {"})"}</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
