"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Blocks,
  Wifi,
  Link2,
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  ShieldCheck,
  Server,
} from "lucide-react";

interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result: T;
}

interface NetworkState {
  blockNumber: number | null;
  peerCount: number | null;
  chainId: number | null;
  isSyncing: boolean | null;
  gasPrice: string | null;
  isConnected: boolean;
  lastUpdated: string | null;
  error: string | null;
}

const BESU_RPC = process.env.NEXT_PUBLIC_BESU_RPC_URL || "http://localhost:8545";

async function rpcCall<T>(method: string, params: unknown[] = [], id = 1): Promise<T> {
  const response = await fetch(BESU_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: RpcResponse<T> = await response.json();
  return data.result;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
  sub?: string;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="glass-card p-5">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 bg-current/10 ${color}`}>
        <Icon className="w-5 h-5" style={{ color: "currentcolor" }} />
      </div>
      <div className="text-2xl font-bold text-slate-100 mb-0.5 font-mono">
        {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-600" /> : (value ?? "—")}
      </div>
      <div className="text-xs font-medium text-slate-400">{label}</div>
      {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

const NODES = [
  { name: "Validator 1 / Member 1", role: "SBP (State Bank of Pakistan)", key: "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73", color: "text-emerald-400", port: 8545 },
  { name: "Validator 2 / Member 2", role: "AidLedger Authority",          key: "0x627306090abaB3A6e1400e9345bC60c78a8BEf57", color: "text-blue-400",    port: 8546 },
  { name: "Validator 3 / Member 3", role: "Retail Banks / Vendors",       key: "0xf17f52151EbEF6C7334FAD080c5704D77216b732", color: "text-purple-400",  port: 8547 },
  { name: "Validator 4",            role: "Auditor (Read-Only)",           key: "0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef", color: "text-amber-400",  port: 8548 },
];

const CONTRACTS = [
  {
    name: "AidLedgerGov",
    address: "0x42699A7612A82f1d9C36148af9C77354759b210b",
    role: "Global Budget, PMT limits, Quarterly caps",
    color: "text-emerald-400",
  },
  {
    name: "AidRegistry",
    address: "0xa50a51c09a5c451C52BB714527E1974b686D8e77",
    role: "Applicant eligibility, KYC records, Ineligibility logs",
    color: "text-blue-400",
  },
];

const GRC_RULES = [
  ["Global Budget", "350,000,000,000 PKR"],
  ["Urban PMT Limit", "≤ 38.00"],
  ["Rural PMT Limit", "≤ 32.00"],
  ["Max Cash Withdrawal", "PKR 10,000"],
  ["Quarterly Spending Cap", "PKR 25,000"],
  ["Chain ID", "1337"],
];

export function NetworkDashboard() {
  const [state, setState] = useState<NetworkState>({
    blockNumber: null,
    peerCount: null,
    chainId: null,
    isSyncing: null,
    gasPrice: null,
    isConnected: false,
    lastUpdated: null,
    error: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [blockHex, peerHex, chainHex, syncing] = await Promise.all([
        rpcCall<string>("eth_blockNumber"),
        rpcCall<string>("net_peerCount"),
        rpcCall<string>("eth_chainId"),
        rpcCall<boolean>("eth_syncing"),
      ]);

      setState({
        blockNumber: parseInt(blockHex, 16),
        peerCount: parseInt(peerHex, 16),
        chainId: parseInt(chainHex, 16),
        isSyncing: syncing === false ? false : true,
        gasPrice: null,
        isConnected: true,
        lastUpdated: new Date().toLocaleTimeString("en-PK"),
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: "Cannot reach Besu RPC — ensure the network is running on port 8545.",
        lastUpdated: new Date().toLocaleTimeString("en-PK"),
      }));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <div className="space-y-6 w-full">

      {/* Connection status + refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${
          state.isConnected
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
            : "bg-red-500/10 border-red-500/25 text-red-400"
        }`}>
          {state.isConnected
            ? <><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Besu Network: Connected</>
            : <><span className="w-2 h-2 rounded-full bg-red-400" /> Besu Network: Offline</>
          }
        </div>
        <div className="flex items-center gap-3">
          {state.lastUpdated && (
            <span className="text-xs text-slate-600">Updated: {state.lastUpdated}</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {state.error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {state.error}
        </div>
      )}

      {/* Live stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Blocks}   label="Block Number"  value={state.blockNumber?.toLocaleString() ?? null} sub="Latest sealed block"     color="text-emerald-400" loading={loading} />
        <StatCard icon={Wifi}     label="Connected Peers" value={state.peerCount !== null ? `${state.peerCount} / 3` : null} sub="Active peer connections" color="text-blue-400" loading={loading} />
        <StatCard icon={Link2}    label="Chain ID"      value={state.chainId?.toString() ?? null} sub="Hyperledger Besu Quorum" color="text-purple-400" loading={loading} />
        <StatCard icon={Activity} label="Sync Status"   value={state.isSyncing === false ? "Synced" : state.isSyncing === true ? "Syncing" : null} sub="Network consensus" color={state.isSyncing === false ? "text-emerald-400" : "text-amber-400"} loading={loading} />
      </div>

      {/* Node roles */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          4-Node Quorum Architecture
        </h3>
        <div className="space-y-3">
          {NODES.map((node, i) => (
            <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-slate-900/50 border border-slate-800/50 hover:border-slate-700 transition-all">
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${node.color.replace("text-", "bg-")}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${node.color}`}>{node.name}</span>
                  <span className="text-xs text-slate-600">Port {node.port}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{node.role}</p>
                <code className="text-xs font-mono text-slate-600 mt-1 block truncate">{node.key}</code>
              </div>
              <div className="flex-shrink-0">
                {state.isConnected
                  ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                  : <XCircle className="w-4 h-4 text-red-400/50" />
                }
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Smart contracts */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Deployed Smart Contracts
        </h3>
        <div className="space-y-4">
          {CONTRACTS.map((c) => (
            <div key={c.name} className="p-4 rounded-lg bg-slate-900/50 border border-slate-800/50 min-w-0">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2 min-w-0">
                <span className={`font-semibold text-sm flex-shrink-0 ${c.color}`}>{c.name}.sol</span>
                <span className="text-xs font-mono text-slate-600 break-all">{c.address}</span>
              </div>
              <p className="text-xs text-slate-500">{c.role}</p>
            </div>
          ))}
        </div>
      </div>

      {/* GRC rules */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-slate-200 mb-4">On-Chain GRC Rules</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {GRC_RULES.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800/50">
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-xs font-mono font-semibold text-emerald-400">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security architecture note */}
      <div className="glass-card p-6 border border-blue-500/15">
        <h3 className="font-semibold text-slate-200 mb-3 text-sm">Dual-Identity Security Architecture</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-blue-400 font-medium mb-1 text-xs">Consensus Keys (Engine)</div>
            <p className="text-slate-500 text-xs">Used strictly for sealing blocks via QBFT. Never interact with smart contracts.</p>
          </div>
          <div>
            <div className="text-emerald-400 font-medium mb-1 text-xs">Account Keys (Proxy)</div>
            <p className="text-slate-500 text-xs">Locked in EthSigner vault (Port 18545). These interact with AidLedgerGov and AidRegistry.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
