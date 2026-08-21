import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AnyShare } from "@/domain/share-types";

/**
 * Cross-platform persistence: each table is one JSON document in
 * AsyncStorage (localStorage on web, native storage on iOS/Android).
 * An in-memory map fronts every table so reads are instant and writes
 * serialize the whole (small) table.
 */
const PREFIX = "one-current-psycho/table/";

export type Client = {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
};

export type StoredShare = {
  id: string;
  clientId: string;
  /** ISO timestamp of when the file was imported here. */
  importedAt: string;
  data: AnyShare;
};

/**
 * A local practitioner account. Dummy auth for now: accounts live only in
 * this device's storage and the password is kept as-is — replace with a
 * real auth backend before real accounts exist.
 */
export type Account = {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
};

/**
 * A private note the psychologist keeps about a client. Notes live only
 * in this app's local storage and are never part of any share file.
 */
export type SessionNote = {
  id: string;
  clientId: string;
  /** ISO timestamp of when the note was written. */
  createdAt: string;
  /** ISO date of the session the note belongs to, if any. */
  on?: string;
  text: string;
};

export class Table<T extends { id: string }> {
  private cache: Map<string, T> | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(private name: string) {}

  private async ensure(): Promise<Map<string, T>> {
    if (this.cache) return this.cache;
    const raw = await AsyncStorage.getItem(PREFIX + this.name);
    const rows: T[] = raw ? JSON.parse(raw) : [];
    this.cache = new Map(rows.map((r) => [r.id, r]));
    return this.cache;
  }

  private persist(map: Map<string, T>): Promise<void> {
    // Chain writes so concurrent mutations never interleave a stale snapshot.
    const snapshot = JSON.stringify([...map.values()]);
    this.writing = this.writing.then(() =>
      AsyncStorage.setItem(PREFIX + this.name, snapshot),
    );
    return this.writing;
  }

  async toArray(): Promise<T[]> {
    return [...(await this.ensure()).values()];
  }

  async put(item: T): Promise<void> {
    const map = await this.ensure();
    map.set(item.id, item);
    await this.persist(map);
  }

  async bulkPut(items: T[]): Promise<void> {
    const map = await this.ensure();
    for (const item of items) map.set(item.id, item);
    await this.persist(map);
  }

  async delete(id: string): Promise<void> {
    const map = await this.ensure();
    map.delete(id);
    await this.persist(map);
  }

  async clear(): Promise<void> {
    const map = await this.ensure();
    map.clear();
    await this.persist(map);
  }
}

export const db = {
  clients: new Table<Client>("clients"),
  shares: new Table<StoredShare>("shares"),
  sessionNotes: new Table<SessionNote>("sessionNotes"),
  accounts: new Table<Account>("accounts"),
};
