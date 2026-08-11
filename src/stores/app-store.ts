import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { db, type Client, type SessionNote, type StoredShare } from "@/db/database";
import { buildExampleData } from "@/db/example-data";
import { newId } from "@/domain/ids";
import type { ShareExport } from "@/domain/share-types";
import { isThemeId, type ThemeId } from "@/ui/theme";

const THEME_KEY = "one-current-psycho/theme";

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

  init: () => Promise<void>;
  setView: (view: View) => void;
  setTheme: (theme: ThemeId) => void;
  addClient: (name: string, notes?: string) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  /** Parse and store a share file's text for a client. Throws a readable Error. */
  importShare: (clientId: string, text: string) => Promise<void>;
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

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  theme: "riverbed",
  view: { kind: "clients" },
  clients: [],
  shares: [],
  sessionNotes: [],

  init: async () => {
    const [clients, shares, sessionNotes, storedTheme] = await Promise.all([
      db.clients.toArray(),
      db.shares.toArray(),
      db.sessionNotes.toArray(),
      AsyncStorage.getItem(THEME_KEY),
    ]);
    set({
      ready: true,
      clients: clients.sort(byName),
      shares: shares.sort(byImportedDesc),
      sessionNotes: sessionNotes.sort(byNoteDateDesc),
      theme: storedTheme && isThemeId(storedTheme) ? storedTheme : "riverbed",
    });
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
    let data: ShareExport;
    try {
      data = JSON.parse(text) as ShareExport;
    } catch {
      throw new Error("That file is not valid JSON.");
    }
    if (
      data == null ||
      data.app !== "one-current-share" ||
      data.version !== 1 ||
      !Array.isArray(data.threads)
    ) {
      throw new Error("That file is not a One Current share.");
    }
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
