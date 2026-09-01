import ConfirmDialog from "@/components/common/ConfirmDialog";
import { usePlayerStore } from "@/store/playerStore";
import { useStackStore } from "@/store/stackStore";
import { parseReclubParticipants } from "@/utils/reclub";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ImportReclubSheetRef {
  present: () => void;
  dismiss: () => void;
}

export default forwardRef<ImportReclubSheetRef>(function ImportReclubSheet(
  _props,
  ref,
) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const { addPlayer, clearAll: clearPlayers } = usePlayerStore();
  const { clearAll: clearStacks } = useStackStore();

  const [text, setText] = useState("");
  const [deselected, setDeselected] = useState<Set<number>>(new Set());
  const [pendingNames, setPendingNames] = useState<string[] | null>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const parsedNames = useMemo(() => parseReclubParticipants(text), [text]);

  // Every parsed name starts selected whenever the parsed list actually
  // changes (not on every keystroke) so in-progress pastes don't keep
  // clobbering the user's manual checkbox toggles.
  const parsedKey = parsedNames.join(" ");
  useEffect(() => {
    setDeselected(new Set());
  }, [parsedKey]);

  const selectedCount = parsedNames.length - deselected.size;

  const toggleIndex = (index: number) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Bottom sheets in this app render above Paper's Dialog portal, so the
  // confirmation can't show while the sheet is still open — dismiss it
  // first (same sequencing ActionBottomSheet items use) and snapshot the
  // selected names, since the sheet's onDismiss clears `text`/`deselected`.
  const handleRequestImport = () => {
    const names = parsedNames.filter((_, index) => !deselected.has(index));
    setPendingNames(names);
    sheetRef.current?.dismiss();
  };

  const handleConfirmImport = () => {
    if (!pendingNames) return;
    clearStacks();
    clearPlayers();
    pendingNames.forEach((name) => addPlayer(name, "NR"));
    setPendingNames(null);
  };

  const handleReset = () => {
    setText("");
    setDeselected(new Set());
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["92%"]}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.colors.surface }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.outlineVariant }}
        onDismiss={handleReset}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <View
            style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}
          >
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurface }}
            >
              Import from Reclub
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
            >
              Paste the session details you copied from Reclub. Names listed
              under &quot;Participants&quot; will replace your current
              player roster and queue. Courts are kept.
            </Text>
          </View>
          <Divider />

          <View style={{ padding: 20, paddingBottom: 12 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Paste Reclub data here..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline
              textAlignVertical="top"
              testID="import-reclub-text-input"
              style={{
                height: 120,
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
                borderRadius: 10,
                padding: 12,
                color: theme.colors.onSurface,
                backgroundColor: theme.colors.surfaceVariant + "40",
                fontSize: 14,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingBottom: 8,
            }}
          >
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}
            >
              {parsedNames.length > 0
                ? `${parsedNames.length} participant${parsedNames.length === 1 ? "" : "s"} found`
                : text.trim()
                  ? 'No "Participants" list found in the pasted text.'
                  : ""}
            </Text>
          </View>

          <BottomSheetScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            {parsedNames.map((name, index) => {
              const isSelected = !deselected.has(index);
              return (
                <TouchableOpacity
                  key={`${name}-${index}`}
                  testID={`import-reclub-participant-${index}`}
                  onPress={() => toggleIndex(index)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    gap: 14,
                  }}
                >
                  <MaterialCommunityIcons
                    name={
                      isSelected ? "checkbox-marked" : "checkbox-blank-outline"
                    }
                    size={22}
                    color={
                      isSelected
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant
                    }
                  />
                  <Text
                    variant="bodyLarge"
                    style={{
                      flex: 1,
                      color: isSelected
                        ? theme.colors.onSurface
                        : theme.colors.onSurfaceVariant,
                    }}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </BottomSheetScrollView>

          <Divider />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 8,
              padding: 16,
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            <Button
              onPress={() => sheetRef.current?.dismiss()}
              testID="import-reclub-cancel"
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleRequestImport}
              disabled={selectedCount === 0}
              testID="import-reclub-submit"
            >
              {`Import${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
            </Button>
          </View>
        </BottomSheetView>
      </BottomSheetModal>

      <ConfirmDialog
        visible={!!pendingNames}
        title="Replace Player Roster"
        message={`This will permanently delete all current players and clear the stack queue, then add ${pendingNames?.length ?? 0} player${pendingNames?.length === 1 ? "" : "s"} from Reclub. Courts are kept. This action cannot be undone.`}
        confirmLabel="Replace"
        onConfirm={handleConfirmImport}
        onDismiss={() => setPendingNames(null)}
      />
    </>
  );
});
