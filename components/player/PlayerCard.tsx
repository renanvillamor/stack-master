import { Player, PlayerRating } from "@/types";
import { formatLastPlayed } from "@/utils/time";
import React from "react";
import { View } from "react-native";
import { Card, Chip, Icon, Text, useTheme } from "react-native-paper";

interface PlayerCardProps {
  player: Player;
  selected?: boolean;
  selectionMode?: boolean;
  /** Name of the player this player is lock-paired with, if any. */
  lockedPartnerName?: string | null;
  onPress?: () => void;
  onLongPress?: () => void;
}

const STATUS_CONFIG = {
  Available: { bg: "#DCFCE7", text: "#15803D", border: "#16A34A" },
  Idle:      { bg: "#F3E8FF", text: "#7E22CE", border: "#A855F7" },
  Stacked:   { bg: "#FEF9C3", text: "#92400E", border: "#F59E0B" },
  Playing:   { bg: "#DBEAFE", text: "#1D4ED8", border: "#1D4ED8" },
  Inactive:  { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" },
} as const;


function formatRating(rating: PlayerRating): string {
  return rating === "NR" ? "NR" : rating.toFixed(1);
}

export default function PlayerCard({
  player,
  selected = false,
  selectionMode = false,
  lockedPartnerName,
  onPress,
  onLongPress,
}: PlayerCardProps) {
  const theme = useTheme();
  const statusStyle = STATUS_CONFIG[player.status];

  const wins = player.history.filter((m) => m.result === "win").length;
  const losses = player.history.filter((m) => m.result === "loss").length;
  const hasMatches = player.matches > 0;

  const avatarBorderColor = selected
    ? theme.colors.primary
    : statusStyle.border;

  return (
    <Card
      mode="elevated"
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        borderRadius: 14,
        borderLeftWidth: 4,
        borderLeftColor: selected ? theme.colors.primary : statusStyle.border,
      }}
      contentStyle={{ padding: 0 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 14,
        }}
      >
        {/* Avatar */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            borderWidth: 2.5,
            borderColor: avatarBorderColor,
            backgroundColor: avatarBorderColor + "18",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {selectionMode ? (
            <Icon
              source={selected ? "check-circle" : "checkbox-blank-circle-outline"}
              size={22}
              color={selected ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          ) : (
            <Icon
              source="account"
              size={28}
              color={avatarBorderColor}
            />
          )}
        </View>

        {/* Content */}
        <View style={{ flex: 1, gap: 6 }}>
          {/* Row 1: name + rating + status */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                variant="titleSmall"
                style={{ fontWeight: "700", fontSize: 14, flexShrink: 1 }}
                numberOfLines={1}
              >
                {player.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                <Icon source="medal-outline" size={12} color={theme.colors.onSurfaceVariant} />
                <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11, fontWeight: "700" }}>
                  {formatRating(player.rating)}
                </Text>
              </View>
            </View>
            {lockedPartnerName ? (
              <Icon source="lock" size={14} color={theme.colors.primary} />
            ) : null}
            <Chip
              compact
              style={{ backgroundColor: statusStyle.bg }}
              textStyle={{ color: statusStyle.text, fontSize: 11, fontWeight: "600" }}
            >
              {player.status}
            </Chip>
          </View>

          {/* Row 2: record · last played */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon source="trophy-outline" size={13} color={theme.colors.onSurfaceVariant} />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}
              >
                {hasMatches ? `${wins}W · ${losses}L` : "No matches"}
              </Text>
            </View>

            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon source="clock-outline" size={13} color={theme.colors.onSurfaceVariant} />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
                numberOfLines={1}
              >
                {formatLastPlayed(player.lastPlayed)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}
