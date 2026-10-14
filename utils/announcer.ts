import { useSettingsStore } from "@/store/settingsStore";
import { AnnouncerVoice, Stack } from "@/types";
import * as Speech from "expo-speech";

const joinTeam = (names: string[]) => names.join(" and ");

export const SAMPLE_ANNOUNCEMENT =
  "Next Match: Alex and Sam versus Jordan and Casey. Please proceed to Court 1.";

/**
 * "Next Match: A and B versus C and D. Please proceed to Court 1." When no
 * court is known yet (queued stack, every court busy), players are told to
 * wait for the next free court instead.
 */
export function buildMatchAnnouncement(
  stack: Stack,
  getPlayerName: (playerId: string) => string,
  courtName: string | null,
): string {
  const team1 = joinTeam(stack.team1.playerIds.map(getPlayerName));
  const team2 = joinTeam(stack.team2.playerIds.map(getPlayerName));
  const destination = courtName
    ? `Please proceed to ${courtName}.`
    : "Please get ready for the next available court.";
  return `Next Match: ${team1} versus ${team2}. ${destination}`;
}

/**
 * Speaks `text` with the given voice settings, cutting off anything still
 * playing. Android resets to the locale's default voice on every call before
 * applying `voice`, so a null or no-longer-installed voice falls back to the
 * phone default instead of sticking to a previously chosen one.
 */
export function speakWith(
  text: string,
  voiceId: string | null,
  rate: number,
  pitch: number,
): void {
  Speech.stop();
  Speech.speak(text, { voice: voiceId ?? undefined, rate, pitch });
}

/** Speaks the match call-out using the announcer settings from Settings. */
export function announceMatch(
  stack: Stack,
  getPlayerName: (playerId: string) => string,
  courtName: string | null,
): void {
  const { announcerVoice, announcerRate, announcerPitch } =
    useSettingsStore.getState();
  speakWith(
    buildMatchAnnouncement(stack, getPlayerName, courtName),
    announcerVoice?.id ?? null,
    announcerRate,
    announcerPitch,
  );
}

const REGION_NAMES: Record<string, string> = {
  US: "US",
  GB: "UK",
  AU: "Australia",
  IN: "India",
  CA: "Canada",
  IE: "Ireland",
  NZ: "New Zealand",
  ZA: "South Africa",
  NG: "Nigeria",
  PH: "Philippines",
  SG: "Singapore",
};

function regionLabel(language: string): string {
  const region = language.split("-")[1]?.toUpperCase();
  if (!region) return "English";
  return `English (${REGION_NAMES[region] ?? region})`;
}

/**
 * English voices installed on this device, grouped by region with readable
 * labels ("English (UK) · Voice 2"); engine ids like "en-gb-x-rjs-network"
 * mean nothing to a host. Falls back to every voice if none are English.
 */
export async function getAnnouncerVoicesAsync(): Promise<AnnouncerVoice[]> {
  const voices = await Speech.getAvailableVoicesAsync();
  const english = voices.filter((v) =>
    v.language.toLowerCase().startsWith("en"),
  );
  const pool = english.length > 0 ? english : voices;

  const sorted = [...pool].sort(
    (a, b) =>
      a.language.localeCompare(b.language) ||
      a.identifier.localeCompare(b.identifier),
  );

  const countPerRegion: Record<string, number> = {};
  return sorted.map((v) => {
    const region = english.length > 0 ? regionLabel(v.language) : v.language;
    countPerRegion[region] = (countPerRegion[region] ?? 0) + 1;
    return {
      id: v.identifier,
      label: `${region} · Voice ${countPerRegion[region]}`,
      language: v.language,
      online: v.identifier.includes("-network"),
      enhanced: v.quality === Speech.VoiceQuality.Enhanced,
    };
  });
}
