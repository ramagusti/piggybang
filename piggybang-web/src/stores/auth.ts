import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  currentOrgId: number | null;
  setCurrentOrg: (id: number | null) => void;
}

// Token lives in the pb_token cookie (see lib/api.ts) so the proxy can read it; user/memberships come from useMe().
export const useAuthStore = create<AuthState>()(
  persist((set) => ({ currentOrgId: null, setCurrentOrg: (currentOrgId) => set({ currentOrgId }) }), {
    name: "pb-auth",
  }),
);
