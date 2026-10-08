import * as Clipboard from "expo-clipboard";
import React, { useEffect, useState } from "react";
import { Share, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import {
  ActivityIndicator,
  Button,
  Dialog,
  Icon,
  IconButton,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

/**
 * Direct APK download: GitHub redirects `releases/latest/download/<asset>` to that
 * asset on the newest release, so the QR never goes stale — but every release
 * must attach the APK under exactly this file name.
 */
export const APP_DOWNLOAD_URL =
  "https://github.com/renanvillamor/stack-master/releases/latest/download/StackMaster.apk";

const RELEASES_API_URL =
  "https://api.github.com/repos/renanvillamor/stack-master/releases?per_page=100";

/**
 * Sums download_count over every asset of every release (unauthenticated: 60 req/hr per IP).
 * GitHub updates download_count lazily — expect ~10 min lag after a download.
 */
async function fetchTotalDownloads(): Promise<number> {
  const res = await fetch(RELEASES_API_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const releases: { assets: { download_count: number }[] }[] =
    await res.json();
  return releases.reduce(
    (sum, r) => sum + r.assets.reduce((s, a) => s + a.download_count, 0),
    0,
  );
}

interface ShareAppDialogProps {
  visible: boolean;
  onDismiss: () => void;
}

/** QR code + link to the app's download page, with copy and native-share actions. */
export default function ShareAppDialog({
  visible,
  onDismiss,
}: ShareAppDialogProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [copied, setCopied] = useState(false);
  // undefined = loading, null = fetch failed (row hidden)
  const [downloads, setDownloads] = useState<number | null | undefined>();

  // Refetch on every open so the count is current.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setDownloads(undefined);
    fetchTotalDownloads()
      .then((n) => !cancelled && setDownloads(n))
      .catch(() => !cancelled && setDownloads(null));
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(APP_DOWNLOAD_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Get StackMaster, the pickleball stacking app: ${APP_DOWNLOAD_URL}`,
      });
    } catch {
      // User dismissed the share sheet or it failed to open — nothing to do.
    }
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={isLandscape ? { alignSelf: "center", width: "50%" } : undefined}
        testID="share-app-dialog"
      >
        <Dialog.Title style={{ textAlign: "center" }}>
          Share StackMaster
        </Dialog.Title>
        <Dialog.Content>
          {/* Landscape puts the QR beside the text so the dialog fits a phone's short height. */}
          <View
            style={{
              flexDirection: isLandscape ? "row" : "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <View
              style={{
                padding: 12,
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
              }}
            >
              <QRCode
                value={APP_DOWNLOAD_URL}
                size={isLandscape ? 140 : 180}
              />
            </View>
            <View
              style={{
                flex: isLandscape ? 1 : undefined,
                minWidth: 0,
                alignItems: "center",
                gap: 8,
              }}
            >
              {downloads !== null && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 16,
                    backgroundColor: theme.colors.secondaryContainer,
                  }}
                  testID="share-app-downloads"
                >
                  <Icon
                    source="download"
                    size={16}
                    color={theme.colors.primary}
                  />
                  {downloads === undefined ? (
                    <ActivityIndicator size={12} color={theme.colors.primary} />
                  ) : (
                    <Text
                      variant="labelLarge"
                      style={{ color: theme.colors.primary }}
                    >
                      {`${downloads.toLocaleString()} download${downloads === 1 ? "" : "s"}`}
                    </Text>
                  )}
                </View>
              )}
              <Text
                variant="bodyMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                }}
              >
                Scan with an Android phone camera to download the app, or share
                the link.
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  alignSelf: "stretch",
                  backgroundColor: theme.colors.surfaceVariant,
                  borderRadius: 8,
                  paddingLeft: 12,
                }}
              >
                <Text
                  variant="bodySmall"
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  style={{ flex: 1, color: theme.colors.onSurface }}
                  testID="share-app-link"
                >
                  {APP_DOWNLOAD_URL}
                </Text>
                <IconButton
                  icon={copied ? "check" : "content-copy"}
                  size={18}
                  onPress={handleCopy}
                  testID="share-app-copy"
                />
              </View>
            </View>
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} testID="share-app-close">
            Close
          </Button>
          <Button
            mode="contained"
            icon="share-variant"
            onPress={handleShare}
            testID="share-app-share"
          >
            Share Link
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
