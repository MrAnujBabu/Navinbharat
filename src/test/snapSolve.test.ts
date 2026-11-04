import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ native: vi.fn(), open: vi.fn(), system: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/native/core", () => ({ loadCore: async () => ({ Capacitor: { isNativePlatform: mocks.native } }) }));
vi.mock("@capacitor/inappbrowser", () => ({ InAppBrowser: { openInWebView: mocks.open, openInSystemBrowser: mocks.system }, DefaultWebViewOptions: { android: {} } }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
import { openSnapSolve } from "@/lib/native/snapSolve";
describe("SnapSolve APK-only opening", () => {
 beforeEach(() => { vi.clearAllMocks(); mocks.native.mockReturnValue(true); mocks.open.mockResolvedValue(undefined); });
 it("opens the requested site in the APK embedded WebView", async () => { await openSnapSolve(); expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ url: "https://snapsolveanuj.vercel.app/" })); });
 it("never redirects externally when the embedded bridge fails", async () => { const external = vi.spyOn(window, "open").mockImplementation(() => null); mocks.open.mockRejectedValue(new Error("Bridge unavailable")); await openSnapSolve(); expect(mocks.system).not.toHaveBeenCalled(); expect(external).not.toHaveBeenCalled(); expect(mocks.error).toHaveBeenCalledOnce(); external.mockRestore(); });
 it("does not open SnapSolve outside the APK", async () => { mocks.native.mockReturnValue(false); await openSnapSolve(); expect(mocks.open).not.toHaveBeenCalled(); expect(mocks.system).not.toHaveBeenCalled(); expect(mocks.error).toHaveBeenCalledOnce(); });
});
