import { fetchLatestReleaseVersion } from "@/utils/appUpdate";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface AppUpdateState {
  /** Newest GitHub release version ("1.4.0"), once a check has succeeded. */
  latestVersion: string | null;
  checking: boolean;
  /** Fetches the newest release version; throws if the check fails. */
  checkForUpdate: () => Promise<string>;
}

// Deliberately not persisted: it's re-checked on every launch, and a stale
// saved version could keep flagging an update that's already installed.
export const useAppUpdateStore = create<AppUpdateState>()(
  immer((set) => ({
    latestVersion: null,
    checking: false,

    checkForUpdate: async () => {
      set((state) => {
        state.checking = true;
      });
      try {
        const latest = await fetchLatestReleaseVersion();
        set((state) => {
          state.latestVersion = latest;
        });
        return latest;
      } finally {
        set((state) => {
          state.checking = false;
        });
      }
    },
  })),
);
