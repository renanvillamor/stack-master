import { useSettingsStore } from "@/store/settingsStore";
import { AnnouncerVoice } from "@/types";
import {
  getAnnouncerVoicesAsync,
  SAMPLE_ANNOUNCEMENT,
  speakWith,
} from "@/utils/announcer";
import React, { useEffect, useState } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  Divider,
  Icon,
  IconButton,
  Portal,
  SegmentedButtons,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";

interface AnnouncerVoiceDialogProps {
  visible: boolean;
  onDismiss: () => void;
}

const RATE_OPTIONS = [
  { value: "0.75", label: "Slow" },
  { value: "0.9", label: "Normal" },
  { value: "1.1", label: "Fast" },
];

const PITCH_OPTIONS = [
  { value: "0.8", label: "Low" },
  { value: "1", label: "Normal" },
  { value: "1.2", label: "High" },
];

/** "Phone default" sits at the top of the list as a pseudo-voice. */
type VoiceRow = AnnouncerVoice | null;

function SettingLabel({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text
      variant="labelMedium"
      style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}
    >
      {children}
    </Text>
  );
}

/** Pick the Match Announcer's voice, speed and pitch; every change applies immediately and can be previewed. */
export default function AnnouncerVoiceDialog({
  visible,
  onDismiss,
}: AnnouncerVoiceDialogProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const {
    announcerVoice,
    setAnnouncerVoice,
    announcerRate,
    setAnnouncerRate,
    announcerPitch,
    setAnnouncerPitch,
  } = useSettingsStore();

  // undefined = loading, null = engine couldn't list voices
  const [voices, setVoices] = useState<AnnouncerVoice[] | null | undefined>();

  // Re-query on every open: voices can be downloaded/removed in Android settings meanwhile.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setVoices(undefined);
    getAnnouncerVoicesAsync()
      .then((v) => !cancelled && setVoices(v))
      .catch(() => !cancelled && setVoices(null));
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const preview = (voiceId: string | null) =>
    speakWith(SAMPLE_ANNOUNCEMENT, voiceId, announcerRate, announcerPitch);

  const savedVoiceMissing =
    !!announcerVoice &&
    Array.isArray(voices) &&
    !voices.some((v) => v.id === announcerVoice.id);

  const renderVoice = ({ item }: { item: VoiceRow }) => {
    const id = item?.id ?? null;
    const selected = (announcerVoice?.id ?? null) === id;
    return (
      <TouchableRipple
        onPress={() =>
          setAnnouncerVoice(item ? { id: item.id, label: item.label } : null)
        }
        testID={`announcer-voice-${id ?? "default"}`}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: 16,
            paddingRight: 4,
            paddingVertical: 6,
            gap: 12,
          }}
        >
          <Icon
            source={selected ? "radiobox-marked" : "radiobox-blank"}
            size={22}
            color={selected ? theme.colors.primary : theme.colors.outline}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              variant="bodyMedium"
              style={{ fontWeight: selected ? "700" : "400" }}
            >
              {item ? item.label : "Phone default"}
            </Text>
            {item && (item.online || item.enhanced) && (
              <View style={{ flexDirection: "row", gap: 4 }}>
                {item.enhanced && (
                  <Chip
                    compact
                    textStyle={{ fontSize: 10, marginVertical: 0 }}
                    style={{ backgroundColor: theme.colors.secondaryContainer }}
                  >
                    High quality
                  </Chip>
                )}
                {item.online && (
                  <Chip
                    compact
                    icon="wifi"
                    textStyle={{ fontSize: 10, marginVertical: 0 }}
                    style={{ backgroundColor: "#E0E7FF" }}
                  >
                    Online
                  </Chip>
                )}
              </View>
            )}
          </View>
          <IconButton
            icon="play-circle-outline"
            iconColor={theme.colors.primary}
            onPress={() => preview(id)}
            accessibilityLabel="Play sample"
            testID={`announcer-voice-test-${id ?? "default"}`}
          />
        </View>
      </TouchableRipple>
    );
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={{
          maxHeight: "85%",
          ...(isLandscape && { alignSelf: "center", width: "50%" }),
        }}
        testID="announcer-voice-dialog"
      >
        <Dialog.Title>Announcer Settings</Dialog.Title>

        <Dialog.Content style={{ gap: 12, paddingBottom: 8 }}>
          <View>
            <SettingLabel>Speed</SettingLabel>
            <SegmentedButtons
              value={String(announcerRate)}
              onValueChange={(v) => setAnnouncerRate(Number(v))}
              buttons={RATE_OPTIONS}
              density="small"
            />
          </View>
          <View>
            <SettingLabel>Pitch</SettingLabel>
            <SegmentedButtons
              value={String(announcerPitch)}
              onValueChange={(v) => setAnnouncerPitch(Number(v))}
              buttons={PITCH_OPTIONS}
              density="small"
            />
          </View>
          {savedVoiceMissing && (
            <Text variant="bodySmall" style={{ color: theme.colors.error }}>
              {announcerVoice!.label} isn't available on this phone, so the
              phone default voice is used.
            </Text>
          )}
        </Dialog.Content>

        <Divider />
        <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
          {voices === undefined ? (
            <ActivityIndicator style={{ padding: 24 }} />
          ) : (
            <FlatList<VoiceRow>
              data={[null, ...(voices ?? [])]}
              keyExtractor={(item) => item?.id ?? "default"}
              renderItem={renderVoice}
              ItemSeparatorComponent={() => <Divider />}
              ListFooterComponent={
                voices === null ? (
                  <Text
                    variant="bodySmall"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      padding: 16,
                    }}
                  >
                    Couldn't list this phone's voices. The phone default voice
                    will be used.
                  </Text>
                ) : (
                  <Text
                    variant="bodySmall"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      padding: 16,
                    }}
                  >
                    Voices come from your phone's text-to-speech engine. If a
                    voice sounds wrong or stays silent, download it in Android
                    Settings → Text-to-speech. Online voices need internet.
                  </Text>
                )
              }
            />
          )}
        </Dialog.ScrollArea>

        <Dialog.Actions>
          <Button onPress={onDismiss} testID="announcer-voice-done">
            Done
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
