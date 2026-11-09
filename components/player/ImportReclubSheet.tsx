import ConfirmDialog from "@/components/common/ConfirmDialog";
import { usePlayerStore } from "@/store/playerStore";
import { useQuorumStore } from "@/store/quorumStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useStackStore } from "@/store/stackStore";
import { parseReclubParticipants } from "@/utils/reclub";
import { fetchReclubText } from "@/utils/reclubLink";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
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
import { TouchableOpacity, View } from "react-native";
import {
  Button,
  Divider,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";
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
  const { clearAll: clearQuorums } = useQuorumStore();
  const { reclubImportLink, setReclubImportLink } = useSettingsStore();

  const [text, setText] = useState("");
  const [inputKey, setInputKey] = useState(0);
  // Text a remounted input starts with (a loaded file). Kept apart from
  // `text`: RN re-sends defaultValue to the native view on every render, so
  // binding it to `text` would make the input controlled again.
  const [inputSeed, setInputSeed] = useState("");
  const [deselected, setDeselected] = useState<Set<number>>(new Set());
  const [pendingNames, setPendingNames] = useState<string[] | null>(null);
  // The link field is uncontrolled like the paste box (same Android cursor
  // race): it starts from the saved link and remounts via linkKey.
  const [linkInput, setLinkInput] = useState(reclubImportLink);
  const [linkKey, setLinkKey] = useState(0);
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  // Saved settings rehydrate asynchronously; pick the link up once they do.
  useEffect(() => {
    setLinkInput(reclubImportLink);
  }, [reclubImportLink]);

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
    // Quorums reference player ids, so they'd dangle once the roster is replaced.
    clearQuorums();
    clearPlayers();
    pendingNames.forEach((name) => addPlayer(name, "NR"));
    setPendingNames(null);
  };

  const handleReset = () => {
    setText("");
    setInputSeed("");
    setInputKey((k) => k + 1);
    setDeselected(new Set());
    setLinkInput(reclubImportLink);
    setLinkKey((k) => k + 1);
    setLinkError(null);
  };

  // The input is uncontrolled, so loaded text goes in through a remount.
  const showLoadedText = (loaded: string) => {
    setText(loaded);
    setInputSeed(loaded);
    setInputKey((k) => k + 1);
  };

  // The link is saved as soon as it's used, so it's there next time even if
  // this load fails (e.g. offline at the venue).
  const handleLoadLink = async () => {
    const link = linkInput.trim();
    if (!link) return;
    setReclubImportLink(link);
    setLinkError(null);
    setLoadingLink(true);
    try {
      showLoadedText(await fetchReclubText(link));
    } catch (err) {
      setLinkError(
        err instanceof Error ? err.message : "Couldn't load that link.",
      );
    } finally {
      setLoadingLink(false);
    }
  };

  const handleClearLink = () => {
    setReclubImportLink("");
    setLinkInput("");
    setLinkKey((k) => k + 1);
    setLinkError(null);
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

  // Pinned via the sheet's footer slot so Cancel/Import stay on screen however
  // long the participant list gets; the list scrolls above it.
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View style={{ backgroundColor: theme.colors.surface }}>
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
        </View>
      </BottomSheetFooter>
    ),
    // handleRequestImport closes over parsedNames/deselected, which
    // selectedCount changes with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, insets.bottom, selectedCount, parsedNames, deselected],
  );

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["92%"]}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        footerComponent={renderFooter}
        backgroundStyle={{ backgroundColor: theme.colors.surface }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.outlineVariant }}
        onDismiss={handleReset}
      >
        {/* The scroll view must be the sheet's direct child: BottomSheetView
            is absolutely positioned (sized to its content, for dynamic-sizing
            sheets), so wrapping the list in it let a long participant list
            grow past the sheet instead of scrolling. enableFooterMarginAdjustment
            pads the end of the list by the footer's height. */}
        <BottomSheetScrollView
          enableFooterMarginAdjustment
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 4,
              paddingBottom: 12,
            }}
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
              Paste the session details you copied from Reclub, or load them
              from a link to a .txt file (e.g. Google Drive). Names
              listed under &quot;Participants&quot; will replace your
              current player roster and queue. Courts are kept.
            </Text>
          </View>
          <Divider />

          <View style={{ padding: 20, paddingBottom: 12, gap: 12 }}>
            <View style={{ gap: 4 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View style={{ flex: 1, justifyContent: "center" }}>
                  <BottomSheetTextInput
                    key={linkKey}
                    defaultValue={reclubImportLink}
                    onChangeText={setLinkInput}
                    placeholder="Google Drive link to a .txt file"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="go"
                    onSubmitEditing={handleLoadLink}
                    editable={!loadingLink}
                    testID="import-reclub-link-input"
                    style={{
                      borderWidth: 1,
                      borderColor: theme.colors.outlineVariant,
                      borderRadius: 10,
                      paddingVertical: 10,
                      paddingLeft: 12,
                      paddingRight: linkInput ? 36 : 12,
                      color: theme.colors.onSurface,
                      backgroundColor: theme.colors.surfaceVariant + "40",
                      fontSize: 14,
                    }}
                  />
                  {!!linkInput && (
                    <IconButton
                      icon="close"
                      size={16}
                      onPress={handleClearLink}
                      disabled={loadingLink}
                      accessibilityLabel="Clear saved link"
                      testID="import-reclub-clear-link"
                      style={{ position: "absolute", right: 0, margin: 0 }}
                    />
                  )}
                </View>
                <Button
                  mode="contained-tonal"
                  icon="download"
                  onPress={handleLoadLink}
                  loading={loadingLink}
                  disabled={!linkInput.trim() || loadingLink}
                  testID="import-reclub-load-link"
                >
                  Load
                </Button>
              </View>
              {linkError && (
                <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                  {linkError}
                </Text>
              )}
            </View>
            {/* BottomSheetTextInput, not RN's TextInput, so the sheet's
                keyboard handling cooperates with it. Deliberately
                uncontrolled (no `value`): echoing every keystroke back
                through this heavy re-render (parse + chip list) races the
                native input on Android and jumps the cursor, garbling
                typed text. handleReset remounts it via `inputKey`. */}
            <BottomSheetTextInput
              key={inputKey}
              defaultValue={inputSeed}
              onChangeText={setText}
              placeholder="...or paste Reclub data here"
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

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              paddingHorizontal: 12,
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
                    width: "33.333%",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    gap: 8,
                  }}
                >
                  <MaterialCommunityIcons
                    name={
                      isSelected
                        ? "checkbox-marked"
                        : "checkbox-blank-outline"
                    }
                    size={18}
                    color={
                      isSelected
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant
                    }
                  />
                  <Text
                    variant="bodyMedium"
                    numberOfLines={1}
                    ellipsizeMode="tail"
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
          </View>
        </BottomSheetScrollView>
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
