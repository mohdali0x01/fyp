import { ShieldCheck, Cpu, Link2, FileCheck, Bell, CreditCard } from "lucide-react";

const FEATURES = [
  {
    icon: FileCheck,
    title: "Automated KYC",
    description:
      "Every applicant is verified against 130,000+ simulated NADRA records. No human in the loop — CNIC hash is anchored on-chain.",
    color: "from-emerald-500/20 to-emerald-600/5",
    iconColor: "text-emerald-400",
    tag: "NADRA Integration",
  },
  {
    icon: Cpu,
    title: "PMT Score Engine",
    description:
      "A Proxy Means Test engine scores applicants on salary, utilities, family size, and location (Urban/Rural). Identical to BISP methodology.",
    color: "from-blue-500/20 to-blue-600/5",
    iconColor: "text-blue-400",
    tag: "BISP Algorithm",
  },
  {
    icon: Link2,
    title: "Blockchain Anchoring",
    description:
      "Every pipeline decision — KYC pass/fail, PMT score, eligibility — is pushed as an immutable transaction to Hyperledger Besu.",
    color: "from-purple-500/20 to-purple-600/5",
    iconColor: "text-purple-400",
    tag: "Hyperledger Besu",
  },
  {
    icon: ShieldCheck,
    title: "Smart Contract GRC",
    description:
      "AidLedgerGov enforces global budget limits (350B PKR), quarterly caps (25K PKR), and PMT thresholds on-chain with role-based access.",
    color: "from-amber-500/20 to-amber-600/5",
    iconColor: "text-amber-400",
    tag: "Solidity",
  },
  {
    icon: Bell,
    title: "Urdu Notifications",
    description:
      "Real-time status updates delivered in Urdu — the native language of Pakistan — keeping beneficiaries informed at every pipeline stage.",
    color: "from-rose-500/20 to-rose-600/5",
    iconColor: "text-rose-400",
    tag: "Bilingual",
  },
  {
    icon: CreditCard,
    title: "Virtual Card Issuance",
    description:
      "Eligible beneficiaries receive a virtual aid card linked to their blockchain approval hash. Transactions are logged on-chain for auditing.",
    color: "from-cyan-500/20 to-cyan-600/5",
    iconColor: "text-cyan-400",
    tag: "Card Management",
  },
];

export function LandingFeatures() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 py-20 w-full overflow-x-hidden">
      <div className="max-w-5xl mx-auto w-full">
        {/* Section header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-700 bg-slate-800/50 text-slate-400 text-xs mb-4">
            Core Capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4 text-center">
            Built for <span className="gradient-text">Accountability</span>
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed text-center">
            A fully automated pipeline from application to disbursement. No manual overrides. No single points of failure.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="glass-card p-6 group hover:-translate-y-1 transition-all duration-300"
            >
              {/* Icon */}
              <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${feature.color} mb-4`}>
                <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
              </div>

              {/* Tag */}
              <div className="text-xs font-mono text-slate-600 mb-2">{feature.tag}</div>

              {/* Content */}
              <h3 className="font-semibold text-slate-200 mb-2 text-[15px]">{feature.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
