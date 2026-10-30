import { useState, useEffect, useCallback, useRef } from "react";

export interface ExtensionDetectionState {
  isChecking: boolean;
  isInstalled: boolean;
  isConnected: boolean;
  version: string | null;
  checkExtension: () => Promise<{ isInstalled: boolean; isConnected: boolean; version?: string }>;
}

/**
 * Hook to safely verify whether the VoxFlow Chrome extension is installed
 * and connected to the user's account.
 */
export function useExtensionDetection(): ExtensionDetectionState {
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [version, setVersion] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const checkingPromiseRef = useRef<Promise<{ isInstalled: boolean; isConnected: boolean; version?: string }> | null>(null);

  const checkExtension = useCallback((): Promise<{ isInstalled: boolean; isConnected: boolean; version?: string }> => {
    if (checkingPromiseRef.current) {
      return checkingPromiseRef.current;
    }

    if (isMountedRef.current) {
      setIsChecking(true);
    }

    const promise = new Promise<{ isInstalled: boolean; isConnected: boolean; version?: string }>((resolve) => {
      let resolved = false;

      // Safe origin check: handle SSR, tests, and standard browser environment
      const currentOrigin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : "";

      const cleanup = () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("message", handleMessage);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        checkingPromiseRef.current = null;
      };

      const finish = (result: { isInstalled: boolean; isConnected: boolean; version?: string }) => {
        if (resolved) return;
        resolved = true;
        cleanup();

        if (isMountedRef.current) {
          setIsInstalled(result.isInstalled);
          setIsConnected(result.isConnected);
          setVersion(result.version ?? null);
          setIsChecking(false);
        }

        resolve(result);
      };

      const handleMessage = (event: MessageEvent) => {
        // Security: Validate message origin and sender
        if (currentOrigin && event.origin !== currentOrigin) {
          return;
        }

        if (
          !event.data ||
          typeof event.data !== "object" ||
          event.data.type !== "VOXFLOW_PONG_EXTENSION"
        ) {
          return;
        }

        const data = event.data as Record<string, unknown>;
        const detectedInstalled = Boolean(data.installed);
        const detectedConnected = Boolean(data.authenticated);
        const detectedVersion = typeof data.version === "string" ? data.version : undefined;

        finish({
          isInstalled: detectedInstalled,
          isConnected: detectedConnected,
          version: detectedVersion
        });
      };

      if (typeof window !== "undefined") {
        window.addEventListener("message", handleMessage);
      }

      // Check immediate DOM marker as a helpful signal if content script already stamped it
      const hasDomMarker =
        typeof document !== "undefined" &&
        document.documentElement?.getAttribute("data-voxflow-extension") === "installed";

      // Dispatch ping to content script
      if (typeof window !== "undefined") {
        try {
          window.postMessage(
            { type: "VOXFLOW_PING_EXTENSION" },
            currentOrigin || "*"
          );
        } catch (err) {
          console.warn("VoxFlow: Could not dispatch extension ping:", err);
        }
      }

      // Timeout for detection handshake (1000ms for reliable response even during cold start)
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          // If DOM attribute exists but no pong arrived yet, mark installed but unauthenticated
          if (hasDomMarker) {
            finish({
              isInstalled: true,
              isConnected: false,
              version: "0.1.0"
            });
          } else {
            finish({
              isInstalled: false,
              isConnected: false
            });
          }
        }
      }, 1000);
    });

    checkingPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void checkExtension();

    return () => {
      isMountedRef.current = false;
    };
  }, [checkExtension]);

  return {
    isChecking,
    isInstalled,
    isConnected,
    version,
    checkExtension
  };
}
