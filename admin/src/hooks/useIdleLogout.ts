import { useEffect, useRef, useState } from "react";
import { DEMO_MODE } from "@/config";
import { useScenarioStore } from "@/stores/scenarioStore";

const REAL_TIMEOUT = 15 * 60_000;
const REAL_WARNING = 60_000;
const SHORT_TIMEOUT = 20_000;
const SHORT_WARNING = 8_000;

/** 15-minute inactivity auto-logout with a warning before it fires. The
 * "shortSession" test scenario (sample-data build only) compresses both
 * numbers so the behaviour can be checked without waiting a quarter hour. */
export function useIdleLogout(onTimeout: () => void) {
  const shortScenario = useScenarioStore((s) => s.scenarios.shortSession);
  const shortSession = DEMO_MODE && shortScenario;
  const timeout = shortSession ? SHORT_TIMEOUT : REAL_TIMEOUT;
  const warningMs = shortSession ? SHORT_WARNING : REAL_WARNING;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());
  const warningActive = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    function markActive() {
      if (!warningActive.current) lastActivity.current = Date.now();
    }
    const events = ["mousedown", "keydown", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, markActive));
    return () => events.forEach((e) => window.removeEventListener(e, markActive));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = timeout - (Date.now() - lastActivity.current);
      if (remaining <= 0) {
        warningActive.current = false;
        onTimeoutRef.current();
      } else if (remaining <= warningMs) {
        warningActive.current = true;
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else {
        warningActive.current = false;
        setSecondsLeft(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timeout, warningMs]);

  function extend() {
    lastActivity.current = Date.now();
    warningActive.current = false;
    setSecondsLeft(null);
  }

  return { warning: secondsLeft !== null, secondsLeft, extend };
}
