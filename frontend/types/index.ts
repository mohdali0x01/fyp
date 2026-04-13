// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  user_id: number;
  username: string;
  role: "BENEFICIARY" | "BANK_ADMIN" | "VENDOR";
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface SignupPayload {
  username: string;
  phone_number: string;
  password: string;
  confirmPassword: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

// ─── Registration ─────────────────────────────────────────────────────────────

export type PipelineStatus =
  | "PENDING"
  | "KYC_FAILED"
  | "FAMILY_INELIGIBLE"
  | "PMT_FAILED"
  | "ELIGIBLE";

export interface RegistrationPayload {
  full_name: string;
  cnic: string;
  address: string;
  city: string;
}

export interface Notification {
  message_text_urdu: string;
  created_at: string;
}

export interface ApplicationStatus {
  registration_id: number;
  cnic: string;
  full_name: string;
  city: string;
  pipeline_status: PipelineStatus;
  created_at: string;
  notifications: Notification[];
}

export interface StatusResponse {
  message: string;
  application: ApplicationStatus;
}

export interface VerificationResult {
  success: boolean;
  message?: string;
  reason?: string;
  status?: string;
  pmtScore?: number;
  blockchainHash?: string;
}

export interface ApplyResponse {
  message: string;
  registration_id: number;
  verification: VerificationResult;
}

// ─── Blockchain / Network ─────────────────────────────────────────────────────

export interface NetworkStats {
  blockNumber: number;
  peerCount: number;
  chainId: number;
  isConnected: boolean;
}

// ─── API Errors ───────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
