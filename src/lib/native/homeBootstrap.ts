/** Only the native home waits for session restoration; web and login stay public. */
export function shouldWaitForNativeHome(pathname: string, isLoading: boolean, native: boolean): boolean {
  return pathname === "/" && native && isLoading;
}

export function isNativeShellAtBoot(): boolean {
  if (typeof window === "undefined") return false;
  const bridge = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return bridge?.isNativePlatform?.() === true;
}