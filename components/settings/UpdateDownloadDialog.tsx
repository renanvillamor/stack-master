import {
  APP_DOWNLOAD_URL,
  downloadUpdateApk,
  installUpdateApk,
  UpdateDownload,
} from "@/utils/appUpdate";
import React, { useEffect, useRef, useState } from "react";
import { Linking, useWindowDimensions, View } from "react-native";
import {
  Button,
  Dialog,
  Portal,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";

interface UpdateDownloadDialogProps {
  /** Version being installed (e.g. "1.3.5"); the dialog is shown while non-null. */
  version: string | null;
  onDismiss: () => void;
}

type Phase = "downloading" | "installing" | "error";

const toMb = (bytes: number) => (bytes / 1_048_576).toFixed(1);

/**
 * Settings → Update Version on Android: downloads the new APK inside the app
 * with a progress bar, then opens Android's installer. The final "Update"
 * tap in Android's own prompt can't be skipped for a sideloaded app. Falls
 * back to the browser download if anything goes wrong.
 */
export default function UpdateDownloadDialog({
  version,
  onDismiss,
}: UpdateDownloadDialogProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [phase, setPhase] = useState<Phase>("downloading");
  const [received, setReceived] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const downloadRef = useRef<UpdateDownload | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!version) return;
    let active = true;
    setPhase("downloading");
    setReceived(0);
    setTotal(0);
    setError(null);

    const download = downloadUpdateApk((r, t) => {
      if (!active) return;
      setReceived(r);
      setTotal(t);
    });
    downloadRef.current = download;

    download.done
      .then(async (uri) => {
        if (!active || !uri) return;
        setPhase("installing");
        await installUpdateApk(uri);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Download failed");
        setPhase("error");
      });

    return () => {
      active = false;
    };
  }, [version, attempt]);

  const handleCancel = () => {
    if (phase === "downloading") downloadRef.current?.cancel();
    downloadRef.current = null;
    onDismiss();
  };

  const progress = total > 0 ? received / total : 0;

  return (
    <Portal>
      <Dialog
        visible={!!version}
        dismissable={false}
        style={isLandscape ? { alignSelf: "center", width: "50%" } : undefined}
        testID="update-download-dialog"
      >
        <Dialog.Title>
          {phase === "error" ? "Update Failed" : `Updating to v${version}`}
        </Dialog.Title>
        <Dialog.Content>
          {phase === "downloading" && (
            <View style={{ gap: 10 }}>
              <ProgressBar
                progress={progress}
                indeterminate={total === 0}
                color={theme.colors.primary}
                style={{ height: 8, borderRadius: 4 }}
              />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {total > 0
                  ? `Downloading… ${toMb(received)} of ${toMb(total)} MB (${Math.round(progress * 100)}%)`
                  : "Starting download…"}
              </Text>
            </View>
          )}
          {phase === "installing" && (
            <Text variant="bodyMedium">
              Download complete. Tap Update in Android&apos;s prompt to finish.
              If Android asks, allow StackMaster to install unknown apps first.
            </Text>
          )}
          {phase === "error" && (
            <Text variant="bodyMedium">
              {`Couldn't download the update (${error}). Check your connection and try again, or download it in your browser instead.`}
            </Text>
          )}
        </Dialog.Content>
        {/* Keyed arrays, not Fragments: Dialog.Actions clones children with `compact`. */}
        <Dialog.Actions>
          {phase === "downloading" && (
            <Button onPress={handleCancel} testID="update-download-cancel">
              Cancel
            </Button>
          )}
          {phase === "installing" && (
            <Button onPress={onDismiss} testID="update-download-close">
              Close
            </Button>
          )}
          {phase === "error" && [
            <Button key="close" onPress={onDismiss}>
              Close
            </Button>,
            <Button
              key="browser"
              onPress={() => {
                Linking.openURL(APP_DOWNLOAD_URL);
                onDismiss();
              }}
              testID="update-download-browser"
            >
              Use Browser
            </Button>,
            <Button
              key="retry"
              mode="contained"
              onPress={() => setAttempt((n) => n + 1)}
              testID="update-download-retry"
            >
              Try Again
            </Button>,
          ]}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
