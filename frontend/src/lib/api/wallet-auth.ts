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

interface WalletApiSession {
  address: string;
  token: string;
  expiresAtMs: number;
}

// Backend accepts signed timestamps within 5 minutes.
// Keep client-side signature cache below that window.
const SESSION_TTL_MS = 4 * 60 * 1000;
const API_SESSION_STORAGE_KEY = "zawyafi.walletApiSession.v1";
let cachedSession: WalletAuthSession | null = null;
let cachedApiSession: WalletApiSession | null = null;

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

const isWalletApiSession = (value: unknown): value is WalletApiSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<WalletApiSession>;
  return (
    typeof candidate.address === "string" &&
    typeof candidate.token === "string" &&
    typeof candidate.expiresAtMs === "number"
  );
};

const getStorage = (): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  const storage = window.localStorage as Partial<Storage>;
  if (
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    return null;
  }

  return storage as Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

const readStoredApiSession = (): WalletApiSession | null => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(API_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isWalletApiSession(parsed)) {
      storage.removeItem(API_SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(API_SESSION_STORAGE_KEY);
    return null;
  }
};

const writeStoredApiSession = (session: WalletApiSession): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.setItem(API_SESSION_STORAGE_KEY, JSON.stringify(session));
};

const clearStoredApiSession = (): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(API_SESSION_STORAGE_KEY);
};

const getCachedApiSession = (
  address: string,
  nowMs: number,
): WalletApiSession | null => {
  if (cachedApiSession) {
    if (
      cachedApiSession.address === address &&
      cachedApiSession.expiresAtMs > nowMs
    ) {
      return cachedApiSession;
    }
    cachedApiSession = null;
  }

  const stored = readStoredApiSession();
  if (!stored) {
    return null;
  }

  if (stored.address !== address || stored.expiresAtMs <= nowMs) {
    clearStoredApiSession();
    return null;
  }

  cachedApiSession = stored;
  return stored;
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

const requestWalletApiSession = async (
  account: WalletAuthAccount,
  baseUrl: string,
): Promise<WalletApiSession> => {
  const bootstrapHeaders = await getWalletAuthHeaders(account);
  const response = await fetch(`${baseUrl}/auth/session`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...bootstrapHeaders,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Wallet session bootstrap failed ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as {
    token?: unknown;
    address?: unknown;
    expiresAt?: unknown;
  };
  const token = typeof payload.token === "string" ? payload.token : "";
  const address = typeof payload.address === "string" ? payload.address.toLowerCase() : "";
  const expiresAtIso = typeof payload.expiresAt === "string" ? payload.expiresAt : "";
  const expiresAtMs = Date.parse(expiresAtIso);

  if (!token || !address || !Number.isFinite(expiresAtMs)) {
    throw new Error("Wallet session bootstrap returned invalid payload");
  }

  const session: WalletApiSession = {
    token,
    address,
    expiresAtMs,
  };
  cachedApiSession = session;
  writeStoredApiSession(session);
  return session;
};

export const getWalletApiAuthHeaders = async (
  account: WalletAuthAccount | undefined,
  baseUrl: string,
): Promise<Record<string, string>> => {
  const address = account?.address?.toLowerCase();
  if (!address) {
    throw new Error("Wallet authentication is required");
  }

  const nowMs = Date.now();
  const cached = getCachedApiSession(address, nowMs);
  if (cached) {
    return {
      "x-auth-session": cached.token,
    };
  }

  const session = await requestWalletApiSession(account, baseUrl);
  return {
    "x-auth-session": session.token,
  };
};

export const clearWalletAuthSession = (): void => {
  cachedSession = null;
  cachedApiSession = null;
  clearStoredApiSession();
};
