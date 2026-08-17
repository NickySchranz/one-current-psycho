import { useState } from "react";
import { View } from "react-native";
import { useAppStore } from "@/stores/app-store";
import { fmtDay } from "@/domain/dates";
import { AppTextInput, Button, Card, Hint, Overline, T, rowStyles } from "@/ui/primitives";

/**
 * The psychologist's private notes for one client. Notes live only in
 * this app's local storage — they are never part of any share file.
 */
export function SessionNotes({ clientId }: { clientId: string }) {
  const notes = useAppStore((s) => s.sessionNotes).filter((n) => n.clientId === clientId);
  const addSessionNote = useAppStore((s) => s.addSessionNote);
  const updateSessionNote = useAppStore((s) => s.updateSessionNote);
  const deleteSessionNote = useAppStore((s) => s.deleteSessionNote);

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <>
      <Overline style={{ marginTop: 20 }}>Session notes</Overline>
      <Card>
        <Hint>Your notes stay on this device and are never part of any share.</Hint>
        <AppTextInput
          multiline
          value={draft}
          onChangeText={setDraft}
          accessibilityLabel="New session note"
          placeholder="A note for the next session…"
        />
        <Button
          style={{ alignSelf: "flex-start", marginTop: 8 }}
          disabled={draft.trim() === ""}
          label="Add note"
          onPress={() => {
            void addSessionNote(clientId, draft);
            setDraft("");
          }}
        />
      </Card>
      {notes.map((note) => (
        <Card key={note.id}>
          <T style={{ fontWeight: "600", fontSize: 14 }}>{fmtDay(note.on ?? note.createdAt)}</T>
          {editingId === note.id ? (
            <View style={{ marginTop: 8, gap: 8 }}>
              <AppTextInput
                multiline
                value={editText}
                onChangeText={setEditText}
                accessibilityLabel="Edit session note"
              />
              <View style={rowStyles.filterRow}>
                <Button
                  variant="primary"
                  disabled={editText.trim() === ""}
                  label="Save"
                  onPress={() => {
                    void updateSessionNote(note.id, editText);
                    setEditingId(null);
                  }}
                />
                <Button label="Cancel" onPress={() => setEditingId(null)} />
              </View>
            </View>
          ) : (
            <>
              <T style={{ marginTop: 4 }}>{note.text}</T>
              <View style={[rowStyles.filterRow, { marginTop: 10 }]}>
                <Button
                  label="Edit"
                  onPress={() => {
                    setEditingId(note.id);
                    setEditText(note.text);
                    setConfirmingId(null);
                  }}
                />
                {confirmingId !== note.id ? (
                  <Button
                    variant="danger"
                    label="Delete"
                    onPress={() => setConfirmingId(note.id)}
                  />
                ) : (
                  <>
                    <T style={{ flexShrink: 1, fontSize: 14 }}>Delete this note?</T>
                    <Button
                      variant="danger"
                      label="Yes, delete"
                      onPress={() => {
                        void deleteSessionNote(note.id);
                        setConfirmingId(null);
                      }}
                    />
                    <Button label="Keep" onPress={() => setConfirmingId(null)} />
                  </>
                )}
              </View>
            </>
          )}
        </Card>
      ))}
    </>
  );
}
