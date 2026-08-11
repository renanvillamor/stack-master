import { usePlayerStore } from "@/store/playerStore";
import { Player, PlayerRating } from "@/types";
import React, { useEffect, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import {
  Button,
  Chip,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

interface PlayerFormModalProps {
  visible: boolean;
  player: Player | null;
  onDismiss: () => void;
}

const RATING_OPTIONS: PlayerRating[] = [
  "NR",
  ...Array.from({ length: 31 }, (_, i) => Math.round((2.0 + i * 0.1) * 10) / 10),
];

function formatRating(r: PlayerRating) {
  return r === "NR" ? "NR" : r.toFixed(1);
}

export default function PlayerFormModal({
  visible,
  player,
  onDismiss,
}: PlayerFormModalProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { addPlayer, editPlayer } = usePlayerStore();
  const [name, setName] = useState("");
  const [rating, setRating] = useState<PlayerRating>("NR");

  useEffect(() => {
    setName(player?.name ?? "");
    setRating(player?.rating ?? "NR");
  }, [player, visible]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (player) {
      editPlayer(player.id, trimmed, rating);
      onDismiss();
      return;
    }

    const names = trimmed
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;
    names.forEach((n) => addPlayer(n, rating));
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={{
          backgroundColor: theme.colors.surface,
          margin: 24,
          borderRadius: 16,
          padding: 24,
          ...(isLandscape && { alignSelf: "center", width: "50%" }),
        }}
      >
        <Text variant="titleLarge" style={{ marginBottom: 16 }}>
          {player ? "Edit Player" : "Add Player"}
        </Text>

        <TextInput
          label="Player Name(s) (comma separated)"
          placeholder="e.g. Alice, Bob, Charlie"
          value={name}
          onChangeText={setName}
          mode="outlined"
          autoFocus
          style={{ marginBottom: 16 }}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
        />

        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
        >
          Rating
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 24,
          }}
        >
          {RATING_OPTIONS.map((option) => {
            const selected = option === rating;
            return (
              <Chip
                key={formatRating(option)}
                onPress={() => setRating(option)}
                style={{
                  backgroundColor: selected
                    ? theme.colors.primary
                    : theme.colors.surfaceVariant,
                  width: 56,
                }}
                textStyle={{
                  color: selected
                    ? theme.colors.onPrimary
                    : theme.colors.onSurfaceVariant,
                  fontSize: 12,
                }}
              >
                {formatRating(option)}
              </Chip>
            );
          })}
        </View>

        <View className="flex-row justify-end gap-2">
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={!name.trim()}
          >
            {player ? "Save" : "Add"}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}
