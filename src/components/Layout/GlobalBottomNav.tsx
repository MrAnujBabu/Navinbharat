import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import BottomNav from "./BottomNav";

/**
 * Mounts BottomNav once at the app root so the tab bar is FROZEN at the bottom
 * of every authenticated screen instead of being re-rendered (and forgotten)
 * by each page. The nav itself is already `position: fixed`, so this just
 * guarantees presence + a single instance.
 *
 * Hidden on:
 *   • Unauthenticated routes (login / signup / public landing)
 *   • Fullscreen experiences where the tab bar would obstruct content
 *     (quiz attempts, live classes, payment flow, player test)
 */
const HIDE_EXACT = new Set<string>([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/admin/login",
  "/admin/register",
  "/install",
  "/privacy",
  "/delete-account",
  "/player-test",
]);

const HIDE_PREFIX = ["/quiz/", "/live/", "/teacher/live/", "/buy-course", "/payment-callback"];

export default function GlobalBottomNav() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  if (!isAuthenticated) return null;
  if (HIDE_EXACT.has(pathname)) return null;
  if (HIDE_PREFIX.some((p) => pathname.startsWith(p))) return null;
  return <BottomNav />;
}
