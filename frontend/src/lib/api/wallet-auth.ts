export interface WalletAuthAccount {
  address?: string;
  signMessage?: (input: unknown) => Promise<string>;
}

interface WalletAuthSession {
  address: string;
  timestamp: string;
  signature: string;
  expiresAtMs: number;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
let cachedSession: WalletAuthSession | null = null;

export const buildWalletAuthMessage = (
  address: string,
  timestamp: string,
): string =>
  [
    `Zawyafi API Session`,
    `address:${address.toLowerCase()}`,
    `timestamp:${timestamp}`,
  ].join("\n");

const signWalletMessage = async (
  signMessage: NonNullable<WalletAuthAccount["signMessage"]>,
  message: string,
): Promise<string> => {
  try {
    return await signMessage({ message });
  } catch {
    return signMessage(message);
  }
};

const getCachedSession = (
  address: string,
  nowMs: number,
): WalletAuthSession | null => {
  if (!cachedSession) {
    return null;
  }

  if (cachedSession.address !== address || cachedSession.expiresAtMs <= nowMs) {
    cachedSession = null;
    return null;
  }

  return cachedSession;
};

export const getWalletAuthHeaders = async (
  account?: WalletAuthAccount,
): Promise<Record<string, string>> => {
  const address = account?.address?.toLowerCase();
  const signMessage = account?.signMessage;

  if (!address || !signMessage) {
    throw new Error("Wallet authentication is required");
  }

  const nowMs = Date.now();
  const cached = getCachedSession(address, nowMs);
  if (cached) {
    return {
      "x-auth-address": cached.address,
      "x-auth-timestamp": cached.timestamp,
      "x-auth-signature": cached.signature,
    };
  }

  const timestamp = String(nowMs);
  const message = buildWalletAuthMessage(address, timestamp);
  const signature = await signWalletMessage(signMessage, message);

  cachedSession = {
    address,
    timestamp,
    signature,
    expiresAtMs: nowMs + SESSION_TTL_MS,
  };

  return {
    "x-auth-address": address,
    "x-auth-timestamp": timestamp,
    "x-auth-signature": signature,
  };
};

export const clearWalletAuthSession = (): void => {
  cachedSession = null;
};
