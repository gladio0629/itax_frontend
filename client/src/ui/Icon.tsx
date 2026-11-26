// Icon set copied from design-v2/client/*.dc.html (24×24, stroke icons).
// Generated once by hand-run script; edit here, not in the design files.
import type { SVGProps } from "react";

const PATHS = {
  back: <><path d="M15 5l-7 7 7 7" /></>,
  check: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
  arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  star: <><path d="M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z" /></>,
  chevronRight: <><path d="M9 5l7 7-7 7" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.6" /></>,
  phone: <><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  car: <><path d="M4 16v-4l2-5h12l2 5v4" /><path d="M3 16h18v2H3z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  locate: <><path d="M20 4L4 11l7 2 2 7z" /></>,
  support: <><path d="M5 13v-1a7 7 0 0 1 14 0v1" /><rect x="3.5" y="13" width="4" height="6" rx="1.5" /><rect x="16.5" y="13" width="4" height="6" rx="1.5" /></>,
  swap: <><path d="M8 4v16M8 20l-3-3M8 20l3-3M16 20V4M16 4l-3 3M16 4l3 3" /></>,
  bell: <><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></>,
  gift: <><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M3 9h18M12 9v11M12 9c-2-4-6-3-5 0M12 9c2-4 6-3 5 0" /></>,
  userPlus: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M18 8v6M15 11h6" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  minus: <><path d="M6 12h12" /></>,
  plusSmall: <><path d="M6 12h12M12 6v12" /></>,
  wifiOff: <><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01M3 3l18 18" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M8 3v4M16 3v4" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /></>,
  arrowDown: <><path d="M12 5v14M6 13l6 6 6-6" /></>,
  arrowUp: <><path d="M12 19V5M6 11l6-6 6 6" /></>,
  menu: <><path d="M4 8h16M4 16h10" /></>,
  home: <><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-5h4v5" /></>,
  briefcase: <><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M9 8V5h6v3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  cash: <><rect x="3" y="6" width="18" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.5" /></>,
  tag: <><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z" /><circle cx="8" cy="8" r="1.5" /></>,
  megaphone: <><path d="M4 10v4h3l6 4V6l-6 4z" /><path d="M17 9a4 4 0 0 1 0 6" /></>,
  luggage: <><rect x="5" y="7" width="14" height="13" rx="2" /><path d="M9 7V4h6v3M9 20v1M15 20v1" /></>,
  keypad: <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M9 7h6M9.5 12h.01M12 12h.01M14.5 12h.01M9.5 15h.01M12 15h.01M14.5 15h.01" /></>,
  doc: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></>,
  shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></>,
  chat: <><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2z" /><path d="M8 10.500h.010M12 10.500h.010M16 10.500h.01" /></>,
  alert: <><path d="M12 3l9.5 17H2.5z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  moon: <><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  logout: <><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9" /></>,
  homeFilled: <><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></>,
  seats: <><circle cx="12" cy="7" r="3" /><circle cx="5.5" cy="8.5" r="2.3" /><circle cx="18.5" cy="8.5" r="2.3" /><path d="M6.5 19c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6z" /><path d="M1 18.5c0-2.8 1.8-4.6 4.2-4.6 1 0 1.8.3 2.5.8-1.2 1.1-1.9 2.6-2.1 3.8z" /><path d="M23 18.5c0-2.8-1.8-4.6-4.2-4.6-1 0-1.8.3-2.5.8 1.2 1.1 1.9 2.6 2.1 3.8z" /></>,
  chevronDown: <><path d="M5 9l7 7 7-7" /></>,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18" /></>,
  box: <><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></>,
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  grip: <><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>,
  starSharp: <><path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z" /></>,
} as const;

export type IconName = keyof typeof PATHS;

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: IconName;
  /** px; default 20 (design: 20 in tiles, 18 in rows, 22 in banners). */
  size?: number;
  /** default 2; the primary-button arrow uses 2.4. */
  strokeWidth?: number;
  /** Solid shape in the current colour (rating stars, seat badge). */
  filled?: boolean;
};

/** Decorative by default (aria-hidden). Give it `aria-label` + role="img" only when it carries meaning on its own. */
export function Icon({ name, size = 20, strokeWidth = 2, filled, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden={rest["aria-label"] ? undefined : true}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
