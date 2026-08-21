import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  api,
  ApiAuthError,
  ApiHttpError,
  ApiOfflineError,
  loadTokens,
  type ApiUser,
  type InboxShare,
} from "@/api/client";
import { db, type Account, type Client, type SessionNote, type StoredShare } from "@/db/database";
import { buildExampleData } from "@/db/example-data";
import { newId } from "@/domain/ids";
import type { AnyShare, ShareExport, WellspringShare } from "@/domain/share-types";
import { isThemeId, type ThemeId } from "@/ui/theme";

const THEME_KEY = "one-current-psycho/theme";
const SESSION_KEY = "one-current-psycho/session";

/** Dummy auth: a ready-made account so the app can be tried right away. */
export const DEMO_EMAIL = "demo@onecurrent.app";
export const DEMO_PASSWORD = "demo1234";

export type AuthUser = { name: string; email: string };

export type View =
  | { kind: "clients" }
  | { kind: "client"; clientId: string }
  | { kind: "share"; clientId: string; shareId: string }
  | { kind: "client-history"; clientId: string };

type AppState = {
  ready: boolean;
  theme: ThemeId;
  view: View;
  clients: Client[];
  shares: StoredShare[];
  sessionNotes: SessionNote[];
  /** The signed-in practitioner, or null when the auth screens should show. */
  user: AuthUser | null;
  /** How the last sign-in happened — "local" means the server was unreachable. */
  lastLoginMode: "api" | "local" | null;
  /**
   * A registration (or sign-in) waiting on the emailed verification code.
   * The password is kept so the local account can be created after verify.
   * devCode is present when the server has no email provider and handed
   * the code back directly so the app can show it.
   */
  pendingVerification: { email: string; password: string; devCode?: string } | null;
  /** Shares patients addressed to this practitioner, waiting to be accepted. */
  inbox: InboxShare[];
  inboxStatus: "idle" | "loading" | "error";

  init: () => Promise<void>;
  /** API-first auth, falling back to local accounts when the server is unreachable. */
  login: (email: string, password: string) => Promise<void>;
  /** API-first registration with a local-account fallback. Throws a readable Error. */
  register: (name: string, email: string, password: string) => Promise<void>;
  /** Trade the emailed code for a session and finish signing in. Throws a readable Error. */
  verifyEmail: (code: string) => Promise<void>;
  /** Ask the server to email a fresh verification code. Quiet on failure. */
  resendVerification: () => Promise<void>;
  /** Abandon the verification screen and go back to sign-in. */
  cancelVerification: () => void;
  /**
   * Asks the server for a reset code; stays quiet about whether the account
   * exists. Returns the code when the server has no email provider.
   */
  requestPasswordReset: (email: string) => Promise<string | undefined>;
  /** Set a new password with the emailed reset code. Throws a readable Error. */
  completePasswordReset: (token: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  setView: (view: View) => void;
  setTheme: (theme: ThemeId) => void;
  /** Refresh the incoming-shares inbox. Quiet on failure — it's an extra, not a blocker. */
  loadInbox: () => Promise<void>;
  /** Accept an inbox share into a client's record. Throws a readable Error. */
  acceptInboxShare: (shareId: string, clientId: string) => Promise<void>;
  addClient: (name: string, notes?: string) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  /** Parse and store a share file's text for a client. Throws a readable Error. */
  importShare: (clientId: string, text: string) => Promise<void>;
  /** Redeem a one-time share code against the API. Throws a readable Error. */
  redeemShareCode: (clientId: string, code: string) => Promise<void>;
  deleteShare: (id: string) => Promise<void>;
  addSessionNote: (clientId: string, text: string, on?: string) => Promise<void>;
  updateSessionNote: (id: string, text: string) => Promise<void>;
  deleteSessionNote: (id: string) => Promise<void>;
  loadExampleClients: () => Promise<void>;
};

function byName(a: Client, b: Client): number {
  return a.name.localeCompare(b.name);
}

function byImportedDesc(a: StoredShare, b: StoredShare): number {
  return b.importedAt.localeCompare(a.importedAt);
}

function byNoteDateDesc(a: SessionNote, b: SessionNote): number {
  return (b.on ?? b.createdAt).localeCompare(a.on ?? a.createdAt);
}

/** Check that parsed JSON is a One Current share document. Throws a readable Error. */
function asAnyShare(data: unknown): AnyShare {
  const doc = data as AnyShare | null;
  if (
    doc != null &&
    doc.app === "wellspring-share" &&
    doc.version === 1 &&
    Array.isArray((doc as WellspringShare).springs)
  ) {
    return doc;
  }
  return asShareExportReal(data);
}

function asShareExportReal(data: unknown): ShareExport {
  const share = data as ShareExport | null;
  if (
    share == null ||
    share.app !== "one-current-share" ||
    share.version !== 1 ||
    !Array.isArray(share.threads)
  ) {
    throw new Error("That file is not a One Current or Wellspring share.");
  }
  return share;
}

/**
 * Keep a local account row in step with an API sign-in so the stored
 * session (an email) can be restored by init() on the next launch.
 */
async function upsertLocalAccount(user: ApiUser, password: string): Promise<Account> {
  const accounts = await db.accounts.toArray();
  const existing = accounts.find(
    (a) => a.email.toLowerCase() === user.email.toLowerCase(),
  );
  const account: Account = existing
    ? { ...existing, name: user.name || existing.name, password }
    : {
        id: newId("account"),
        name: user.name || user.email,
        email: user.email,
        password,
        createdAt: new Date().toISOString(),
      };
  await db.accounts.put(account);
  return account;
}

/** Readable message for an API sign-in failure (no local fallback for these). */
function loginErrorMessage(e: unknown): string {
  if (e instanceof ApiHttpError) {
    if (e.status === 401) return "That email and password don't match.";
    if (e.code === "rate_limited") return "Too many attempts. Wait a moment and try again.";
  }
  return "That did not work. Try again in a moment.";
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  theme: "riverbed",
  view: { kind: "clients" },
  clients: [],
  shares: [],
  sessionNotes: [],
  user: null,
  lastLoginMode: null,
  pendingVerification: null,
  inbox: [],
  inboxStatus: "idle",

  init: async () => {
    const [clients, shares, sessionNotes, accounts, storedTheme, sessionEmail] =
      await Promise.all([
        db.clients.toArray(),
        db.shares.toArray(),
        db.sessionNotes.toArray(),
        db.accounts.toArray(),
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(SESSION_KEY),
      ]);
    if (accounts.length === 0) {
      const demo: Account = {
        id: newId("account"),
        name: "Demo Practitioner",
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        createdAt: new Date().toISOString(),
      };
      await db.accounts.put(demo);
      accounts.push(demo);
    }
    const session = sessionEmail
      ? accounts.find((a) => a.email === sessionEmail)
      : undefined;
    set({
      ready: true,
      clients: clients.sort(byName),
      shares: shares.sort(byImportedDesc),
      sessionNotes: sessionNotes.sort(byNoteDateDesc),
      user: session ? { name: session.name, email: session.email } : null,
      theme: storedTheme && isThemeId(storedTheme) ? storedTheme : "riverbed",
    });
    if (session) void get().loadInbox();
  },

  login: async (email, password) => {
    const norm = email.trim().toLowerCase();
    let apiUser: ApiUser | null = null;
    try {
      apiUser = await api.login(norm, password);
    } catch (e) {
      if (e instanceof ApiHttpError && e.code === "email_unverified") {
        // The account exists but the emailed code was never entered.
        set({ pendingVerification: { email: norm, password } });
        return;
      }
      if (!(e instanceof ApiOfflineError)) throw new Error(loginErrorMessage(e));
    }
    if (apiUser) {
      if (!apiUser.roles.includes("practitioner")) {
        void api.logout();
        throw new Error("This account is not a practitioner account.");
      }
      const account = await upsertLocalAccount(apiUser, password);
      await AsyncStorage.setItem(SESSION_KEY, account.email);
      set({
        user: { name: account.name, email: account.email },
        lastLoginMode: "api",
      });
      void get().loadInbox();
      return;
    }
    // Server unreachable — the local accounts still open the door.
    const accounts = await db.accounts.toArray();
    const account = accounts.find((a) => a.email.toLowerCase() === norm);
    if (!account || account.password !== password) {
      throw new Error("That email and password don't match.");
    }
    await AsyncStorage.setItem(SESSION_KEY, account.email);
    set({
      user: { name: account.name, email: account.email },
      lastLoginMode: "local",
    });
  },

  register: async (name, email, password) => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (cleanName === "") throw new Error("Please tell us your name.");
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      throw new Error("That doesn't look like an email address.");
    }
    if (password.length < 8) {
      throw new Error("Please use a password of at least 8 characters.");
    }
    let registered: { devCode?: string } | null = null;
    try {
      registered = await api.register(cleanEmail, password, cleanName);
    } catch (e) {
      if (!(e instanceof ApiOfflineError)) {
        if (e instanceof ApiHttpError && e.code === "email_taken") {
          throw new Error("An account with this email already exists.");
        }
        throw new Error("The account could not be created. Try again in a moment.");
      }
    }
    if (registered) {
      // The account exists now but stays locked until the emailed code is entered.
      set({
        pendingVerification: {
          email: cleanEmail.toLowerCase(),
          password,
          devCode: registered.devCode,
        },
      });
      return;
    }
    // Server unreachable — create the account on this device only.
    const accounts = await db.accounts.toArray();
    if (accounts.some((a) => a.email.toLowerCase() === cleanEmail.toLowerCase())) {
      throw new Error("An account with this email already exists.");
    }
    const account: Account = {
      id: newId("account"),
      name: cleanName,
      email: cleanEmail,
      password,
      createdAt: new Date().toISOString(),
    };
    await db.accounts.put(account);
    await AsyncStorage.setItem(SESSION_KEY, account.email);
    set({
      user: { name: account.name, email: account.email },
      lastLoginMode: "local",
    });
  },

  verifyEmail: async (code) => {
    const pending = get().pendingVerification;
    if (!pending) throw new Error("There is nothing to verify — sign in again.");
    if (code.trim() === "") throw new Error("Paste the code from the email first.");
    let apiUser: ApiUser;
    try {
      apiUser = await api.verifyEmail(pending.email, code.trim());
    } catch (e) {
      if (e instanceof ApiOfflineError) {
        throw new Error("The server could not be reached.");
      }
      if (e instanceof ApiHttpError && e.code === "rate_limited") {
        throw new Error("Too many attempts. Wait a moment and try again.");
      }
      throw new Error("That code is not valid — request a new one and try again.");
    }
    if (!apiUser.roles.includes("practitioner")) {
      void api.logout();
      set({ pendingVerification: null });
      throw new Error("This account is not a practitioner account.");
    }
    const account = await upsertLocalAccount(apiUser, pending.password);
    await AsyncStorage.setItem(SESSION_KEY, account.email);
    set({
      user: { name: account.name, email: account.email },
      lastLoginMode: "api",
      pendingVerification: null,
    });
    void get().loadInbox();
  },

  resendVerification: async () => {
    const pending = get().pendingVerification;
    if (!pending) return;
    try {
      const res = await api.resendVerification(pending.email);
      if (res.devCode) {
        set({ pendingVerification: { ...pending, devCode: res.devCode } });
      }
    } catch {
      // Offline or server error: stay quiet, same as the enumeration-safe answer.
    }
  },

  cancelVerification: () => set({ pendingVerification: null }),

  requestPasswordReset: async (email) => {
    if (email.trim() === "") throw new Error("Please enter your email address.");
    try {
      const res = await api.forgotPassword(email.trim().toLowerCase());
      return res.devCode;
    } catch {
      // Offline or server error: stay quiet, same as the enumeration-safe answer.
      return undefined;
    }
  },

  completePasswordReset: async (token, newPassword) => {
    if (token.trim() === "") throw new Error("Paste the code from the email first.");
    if (newPassword.length < 8) {
      throw new Error("Please use a password of at least 8 characters.");
    }
    try {
      await api.resetPassword(token.trim(), newPassword);
    } catch (e) {
      if (e instanceof ApiOfflineError) {
        throw new Error("The server could not be reached.");
      }
      if (e instanceof ApiHttpError && e.code === "rate_limited") {
        throw new Error("Too many attempts. Wait a moment and try again.");
      }
      throw new Error("That reset code is not valid any more — request a new one.");
    }
  },

  logout: async () => {
    void api.logout();
    await AsyncStorage.removeItem(SESSION_KEY);
    set({
      user: null,
      view: { kind: "clients" },
      lastLoginMode: null,
      inbox: [],
      inboxStatus: "idle",
    });
  },

  loadInbox: async () => {
    if (!(await loadTokens())) return;
    set({ inboxStatus: "loading" });
    try {
      const { shares } = await api.shareInbox();
      set({ inbox: shares.filter((s) => !s.redeemed), inboxStatus: "idle" });
    } catch {
      // The inbox is an enhancement, never a blocker — surface a quiet retry.
      set({ inboxStatus: "error" });
    }
  },

  acceptInboxShare: async (shareId, clientId) => {
    let document: unknown;
    try {
      ({ document } = await api.acceptShare(shareId));
    } catch (e) {
      if (e instanceof ApiOfflineError) {
        throw new Error("The server could not be reached.");
      }
      if (e instanceof ApiHttpError && e.status === 404) {
        throw new Error(
          "That share is no longer available — it may have expired or been accepted already.",
        );
      }
      if (e instanceof ApiHttpError && e.code === "rate_limited") {
        throw new Error("Too many attempts. Wait a moment and try again.");
      }
      if (e instanceof ApiAuthError) {
        throw new Error("Your session has expired — sign in again to accept shares.");
      }
      throw new Error("The share could not be accepted. Try again in a moment.");
    }
    const data = asAnyShare(document);
    const share: StoredShare = {
      id: newId("share"),
      clientId,
      importedAt: new Date().toISOString(),
      data,
    };
    await db.shares.put(share);
    set((s) => ({
      shares: [share, ...s.shares].sort(byImportedDesc),
      inbox: s.inbox.filter((item) => item.id !== shareId),
    }));
  },

  setView: (view) => set({ view }),

  setTheme: (theme) => {
    set({ theme });
    void AsyncStorage.setItem(THEME_KEY, theme);
  },

  addClient: async (name, notes) => {
    const client: Client = {
      id: newId("client"),
      name: name.trim(),
      notes: notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await db.clients.put(client);
    set((s) => ({ clients: [...s.clients, client].sort(byName) }));
    return client;
  },

  deleteClient: async (id) => {
    const orphanedShares = get().shares.filter((sh) => sh.clientId === id);
    const orphanedNotes = get().sessionNotes.filter((n) => n.clientId === id);
    await Promise.all([
      db.clients.delete(id),
      ...orphanedShares.map((sh) => db.shares.delete(sh.id)),
      ...orphanedNotes.map((n) => db.sessionNotes.delete(n.id)),
    ]);
    set((s) => ({
      clients: s.clients.filter((c) => c.id !== id),
      shares: s.shares.filter((sh) => sh.clientId !== id),
      sessionNotes: s.sessionNotes.filter((n) => n.clientId !== id),
      view: { kind: "clients" },
    }));
  },

  importShare: async (clientId, text) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("That file is not valid JSON.");
    }
    const data = asAnyShare(parsed);
    const share: StoredShare = {
      id: newId("share"),
      clientId,
      importedAt: new Date().toISOString(),
      data,
    };
    await db.shares.put(share);
    set((s) => ({ shares: [share, ...s.shares].sort(byImportedDesc) }));
  },

  redeemShareCode: async (clientId, code) => {
    if (!(await loadTokens())) {
      throw new Error("Sign in while the server is reachable to redeem codes.");
    }
    let document: unknown;
    try {
      ({ document } = await api.redeemShare(code.trim()));
    } catch (e) {
      if (e instanceof ApiOfflineError) {
        throw new Error("The server could not be reached.");
      }
      if (e instanceof ApiHttpError && e.status === 404) {
        throw new Error("That code doesn't work — it may have expired or been used already.");
      }
      if (e instanceof ApiHttpError && e.code === "rate_limited") {
        throw new Error("Too many attempts. Wait a moment and try again.");
      }
      if (e instanceof ApiAuthError) {
        throw new Error("Your session has expired — sign in again to redeem codes.");
      }
      throw new Error("The code could not be redeemed. Try again in a moment.");
    }
    const data = asAnyShare(document);
    const share: StoredShare = {
      id: newId("share"),
      clientId,
      importedAt: new Date().toISOString(),
      data,
    };
    await db.shares.put(share);
    set((s) => ({ shares: [share, ...s.shares].sort(byImportedDesc) }));
  },

  deleteShare: async (id) => {
    await db.shares.delete(id);
    set((s) => ({ shares: s.shares.filter((sh) => sh.id !== id) }));
  },

  addSessionNote: async (clientId, text, on) => {
    const note: SessionNote = {
      id: newId("note"),
      clientId,
      createdAt: new Date().toISOString(),
      on: on ?? new Date().toISOString().slice(0, 10),
      text: text.trim(),
    };
    await db.sessionNotes.put(note);
    set((s) => ({ sessionNotes: [...s.sessionNotes, note].sort(byNoteDateDesc) }));
  },

  updateSessionNote: async (id, text) => {
    const existing = get().sessionNotes.find((n) => n.id === id);
    if (!existing) return;
    const note: SessionNote = { ...existing, text: text.trim() };
    await db.sessionNotes.put(note);
    set((s) => ({ sessionNotes: s.sessionNotes.map((n) => (n.id === id ? note : n)) }));
  },

  deleteSessionNote: async (id) => {
    await db.sessionNotes.delete(id);
    set((s) => ({ sessionNotes: s.sessionNotes.filter((n) => n.id !== id) }));
  },

  loadExampleClients: async () => {
    const { clients, shares } = buildExampleData(new Date());
    await Promise.all([db.clients.bulkPut(clients), db.shares.bulkPut(shares)]);
    const [allClients, allShares] = await Promise.all([
      db.clients.toArray(),
      db.shares.toArray(),
    ]);
    set({ clients: allClients.sort(byName), shares: allShares.sort(byImportedDesc) });
  },
}));
