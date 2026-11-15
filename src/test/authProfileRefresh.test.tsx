import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { screen, waitFor } from "@testing-library/dom";

const h = vi.hoisted(() => {
  const listeners: Array<(event: string, session: unknown) => void> = [];
  const session = { user: { id: "u1", email: "student@example.com", user_metadata: { full_name: "Signup Name" } } };
  const profileRow = {
    id: "u1", full_name: "Saved Name", email: "student@example.com",
    avatar_url: "https://cdn.example.com/a.png", mobile: "9876543210", is_blocked: false,
  };
  return { listeners, session, profileRow };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        h.listeners.push(cb);
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession: () => Promise.resolve({ data: { session: h.session } }),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: h.profileRow, error: null }) }) }) }),
    rpc: () => Promise.resolve({ data: "student", error: null }),
  },
}));
vi.mock("@/lib/native/sessionTracker", () => ({ startSessionTracking: vi.fn(), stopSessionTracking: vi.fn() }));
vi.mock("@/lib/native/push", () => ({ initPushNotifications: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { AuthProvider, useAuth } from "../contexts/AuthContext";

function Probe() {
  const { profile } = useAuth();
  return <div data-testid="who">{`${profile?.fullName ?? ""}|${profile?.mobile ?? ""}|${profile?.avatarUrl ?? ""}`}</div>;
}

describe("signed-in student's profile", () => {
  it("keeps the saved name, mobile and photo when the session token refreshes", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    const saved = "Saved Name|9876543210|https://cdn.example.com/a.png";
    await waitFor(() => expect(screen.getByTestId("who")).toHaveTextContent(saved));

    // Supabase refreshes the access token about once an hour.
    act(() => { h.listeners.forEach((cb) => cb("TOKEN_REFRESHED", h.session)); });

    expect(screen.getByTestId("who")).toHaveTextContent(saved);
    expect(screen.getByTestId("who")).not.toHaveTextContent("Signup Name");
  });
});
