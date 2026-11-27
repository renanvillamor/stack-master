import ConfirmDialog from "@/components/common/ConfirmDialog";
import { usePlayerStore } from "@/store/playerStore";
import { useQuorumStore } from "@/store/quorumStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useStackStore } from "@/store/stackStore";
import { parseReclubParticipants } from "@/utils/reclub";
import { pickReclubFile, readReclubFile } from "@/utils/reclubFile";
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
import { Platform, TouchableOpacity, View } from "react-native";
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
  const {
    reclubImportLink,
    setReclubImportLink,
    reclubImportFile,
    setReclubImportFile,
  } = useSettingsStore();

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
  // One load at a time, from either source; they share the error line.
  const [loadingFrom, setLoadingFrom] = useState<"link" | "file" | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
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
    setLoadError(null);
    setLoadingFrom("link");
    try {
      showLoadedText(await fetchReclubText(link));
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Couldn't load that link.",
      );
    } finally {
      setLoadingFrom(null);
    }
  };

  // Opens the system picker (device storage, Google Drive, ...) in the saved
  // file's folder when the provider supports it, and remembers the pick.
  const handleChooseFile = async () => {
    setLoadError(null);
    setLoadingFrom("file");
    try {
      const result = await pickReclubFile(reclubImportFile?.uri);
      if (result) {
        setReclubImportFile(result.file);
        showLoadedText(result.text);
      }
    } catch {
      setLoadError("Couldn't read that file. Choose a plain text (.txt) file.");
    } finally {
      setLoadingFrom(null);
    }
  };

  const handleReloadFile = async () => {
    if (!reclubImportFile) return;
    setLoadError(null);
    setLoadingFrom("file");
    try {
      showLoadedText(await readReclubFile(reclubImportFile.uri));
    } catch {
      setLoadError(
        `Couldn't open ${reclubImportFile.label}. It may have been moved or deleted, or this phone is offline. Choose the file again.`,
      );
    } finally {
      setLoadingFrom(null);
    }
  };

  // The field shows a picked file in place of the link box; Load re-reads
  // whichever is showing. File picking is native-only (expo-file-system).
  const canPickFile = Platform.OS !== "web";
  const showingFile = canPickFile && !!reclubImportFile;
  const handleLoad = showingFile ? handleReloadFile : handleLoadLink;
  const canLoad = showingFile || !!linkInput.trim();

  // Clearing a file brings the saved link back into the field.
  const handleClearFile = () => {
    setReclubImportFile(null);
    setLinkKey((k) => k + 1);
    setLoadError(null);
  };

  const handleClearLink = () => {
    setReclubImportLink("");
    setLinkInput("");
    setLinkKey((k) => k + 1);
    setLoadError(null);
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
              Load your Reclub session from a .txt file, or paste the details
              you copied from Reclub. Names
              listed under &quot;Participants&quot; will replace your
              current player roster and queue. Courts are kept.
            </Text>
          </View>
          <Divider />

          <View style={{ padding: 20, paddingBottom: 12, gap: 12 }}>
            <View style={{ gap: 6 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                {/* One source field: a link box, or the picked file in its place */}
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    minHeight: 48,
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                    borderRadius: 12,
                    backgroundColor: theme.colors.surfaceVariant + "40",
                    paddingLeft: 12,
                  }}
                >
                  <MaterialCommunityIcons
                    name={showingFile ? "file-document-outline" : "link-variant"}
                    size={18}
                    color={theme.colors.onSurfaceVariant}
                  />
                  {showingFile ? (
                    <Text
                      variant="bodyMedium"
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        marginLeft: 8,
                        color: theme.colors.onSurface,
                      }}
                      testID="import-reclub-file-label"
                    >
                      {reclubImportFile!.label}
                    </Text>
                  ) : (
                    <BottomSheetTextInput
                      key={linkKey}
                      defaultValue={reclubImportLink}
                      onChangeText={setLinkInput}
                      placeholder="Google Drive link"
                      placeholderTextColor={theme.colors.onSurfaceVariant}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      returnKeyType="go"
                      onSubmitEditing={handleLoadLink}
                      editable={!loadingFrom}
                      testID="import-reclub-link-input"
                      style={{
                        flex: 1,
                        marginLeft: 8,
                        paddingVertical: 10,
                        color: theme.colors.onSurface,
                        fontSize: 14,
                      }}
                    />
                  )}
                  {(showingFile || !!linkInput) && (
                    <IconButton
                      icon="close"
                      size={16}
                      onPress={showingFile ? handleClearFile : handleClearLink}
                      disabled={!!loadingFrom}
                      accessibilityLabel={
                        showingFile ? "Forget saved file" : "Clear saved link"
                      }
                      testID={
                        showingFile
                          ? "import-reclub-forget-file"
                          : "import-reclub-clear-link"
                      }
                      style={{ margin: 0 }}
                    />
                  )}
                  {canPickFile && (
                    <>
                      <View
                        style={{
                          width: 1,
                          alignSelf: "stretch",
                          marginVertical: 8,
                          backgroundColor: theme.colors.outlineVariant,
                        }}
                      />
                      <IconButton
                        icon="folder-open-outline"
                        size={20}
                        iconColor={theme.colors.primary}
                        onPress={handleChooseFile}
                        disabled={!!loadingFrom}
                        accessibilityLabel="Choose a file from this phone or a drive"
                        testID="import-reclub-choose-file"
                        style={{ margin: 0 }}
                      />
                    </>
                  )}
                </View>
                <Button
                  mode="contained-tonal"
                  icon="download"
                  onPress={handleLoad}
                  loading={!!loadingFrom}
                  disabled={!canLoad || !!loadingFrom}
                  style={{ borderRadius: 12 }}
                  contentStyle={{ height: 48 }}
                  testID="import-reclub-load"
                >
                  Load
                </Button>
              </View>
              {loadError ? (
                <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                  {loadError}
                </Text>
              ) : (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {showingFile
                    ? "Load re-reads this file. Tap the folder to pick another."
                    : canPickFile
                      ? "Paste a link, or tap the folder to pick a file from this phone or a drive."
                      : "Paste a link to a .txt file."}
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
