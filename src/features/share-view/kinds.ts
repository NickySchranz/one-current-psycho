import type { SharedEvent } from "@/domain/share-types";
import type { ThemeTokens } from "@/ui/theme";

export type EventKind = SharedEvent["kind"];

export const KIND_LABELS: Record<EventKind, string> = {
  started: "Thread started",
  moment: "Moment",
  "action-decided": "Step decided",
  "action-done": "Step done",
  integrated: "Integrated",
};

/** One marker colour per event kind, drawn from the active theme. */
export function kindColor(kind: EventKind, t: ThemeTokens): string {
  switch (kind) {
    case "started":
      return t.inkFaint;
    case "moment":
      return t.focus;
    case "action-decided":
      return t.lineMain;
    case "action-done":
      return t.accent;
    case "integrated":
      return t.danger;
  }
}

export const ALL_KINDS: EventKind[] = [
  "started",
  "moment",
  "action-decided",
  "action-done",
  "integrated",
];
