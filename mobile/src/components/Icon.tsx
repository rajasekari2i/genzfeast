import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Line icons transcribed path-for-path from the artboards in
 * docs/ui-screen/GenzFeast-Admin-and-Staff.html. Every glyph there is an
 * inline <svg> on a 24x24 viewBox with `fill: none`, `stroke: currentColor`
 * and round caps/joins — these reproduce that exactly rather than
 * approximating with emoji, which is what the Dashboard shipped before and
 * is why the Products glyph "looked different".
 *
 * Stroke widths are per-glyph in the canvas (1.8 for the cloche, 2 for the
 * quick-link glyphs, 2.4 for the chevron), so each entry carries its own
 * rather than inheriting one default.
 */
export type IconName =
  | 'cloche' | 'chevronRight' | 'users' | 'feedback' | 'categories' | 'departments'
  | 'close' | 'dashboard' | 'feedbackReview' | 'profile' | 'contactUs'
  | 'incomingOrders' | 'chevronLeft' | 'edit' | 'lock' | 'logout' | 'check'
  | 'star' | 'arrowRight' | 'clock' | 'email' | 'pin'
  | 'search' | 'plus' | 'trash' | 'menu' | 'refresh';

const STROKE: Record<IconName, number> = {
  cloche: 1.8,
  chevronRight: 2.4,
  users: 2,
  feedback: 2,
  categories: 2,
  departments: 2,
  // The drawer's close control is 2.2, matching the header hamburger.
  close: 2.2,
  dashboard: 2,
  feedbackReview: 2,
  profile: 2,
  contactUs: 2,
  incomingOrders: 2,
  chevronLeft: 2.2,
  edit: 2.2,
  // The read-only lock is drawn at 2.4 in the field label and 2 in
  // the Change-password tile; 2.2 splits them and reads correctly
  // at both 12px and 18px.
  lock: 2.2,
  logout: 2.2,
  check: 2.4,
  // The star is FILLED per rating state, so its stroke is thin (1.6)
  // and only outlines the shape.
  star: 1.6,
  arrowRight: 2.5,
  clock: 2.4,
  email: 2,
  pin: 2,
  search: 2.2,
  plus: 2.8,
  trash: 2.2,
  // Matches AdminHeader's hand-built bars: the third line is SHORTER.
  menu: 2.2,
  refresh: 2.2,
};

export function Icon({
  name,
  size = 22,
  color,
  fill = 'none',
}: {
  name: IconName;
  size?: number;
  color: string;
  /**
   * Only the rating star uses this: the artboard fills it per state and
   * keeps the espresso outline, so fill and stroke are independent.
   */
  fill?: string;
}) {
  const common = {
    stroke: color,
    strokeWidth: STROKE[name],
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'cloche' && (
        <>
          <Path d="M3 11h18a9 9 0 0 1-18 0z" {...common} />
          <Path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5" {...common} />
        </>
      )}

      {name === 'chevronRight' && <Path d="M9 6l6 6-6 6" {...common} />}

      {name === 'users' && (
        <>
          <Circle cx="9" cy="8" r="3.5" {...common} />
          <Path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" {...common} />
          <Path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .7 3.2 2.3 3.8 5" {...common} />
        </>
      )}

      {name === 'feedback' && <Path d="M4 5h16v11H9l-5 4V5z" {...common} />}

      {name === 'categories' && (
        <>
          <Path d="M3 12V4h8l10 10-8 8L3 12z" {...common} />
          <Circle cx="7.5" cy="7.5" r="1.5" {...common} />
        </>
      )}

      {name === 'close' && <Path d="M6 6l12 12M18 6L6 18" {...common} />}

      {/* Four tiles, not a chart — the artboard's own dashboard mark. */}
      {name === 'dashboard' && (
        <>
          <Rect x="4" y="4" width="7" height="7" rx="1.5" {...common} />
          <Rect x="13" y="4" width="7" height="7" rx="1.5" {...common} />
          <Rect x="4" y="13" width="7" height="7" rx="1.5" {...common} />
          <Rect x="13" y="13" width="7" height="7" rx="1.5" {...common} />
        </>
      )}

      {/* Distinct from `feedback`: the review glyph carries an inner line. */}
      {name === 'feedbackReview' && (
        <>
          <Path d="M4 5h16v11H9l-5 4V5z" {...common} />
          <Path d="M8 10h8" {...common} />
        </>
      )}

      {name === 'profile' && (
        <>
          <Circle cx="12" cy="8" r="4" {...common} />
          <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...common} />
        </>
      )}

      {name === 'contactUs' && (
        <Path
          d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"
          {...common}
        />
      )}

      {/* A docket, not a list — the Staff menu's incoming-orders mark. */}
      {name === 'incomingOrders' && (
        <>
          <Path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" {...common} />
          <Path d="M9 8h6M9 12h6" {...common} />
        </>
      )}

      {name === 'chevronLeft' && <Path d="M15 6l-6 6 6 6" {...common} />}

      {name === 'edit' && <Path d="M4 20h4L19 9l-4-4L4 16v4z" {...common} />}

      {name === 'lock' && (
        <>
          <Rect x="5" y="11" width="14" height="10" rx="2" {...common} />
          <Path d="M8 11V7a4 4 0 0 1 8 0v4" {...common} />
        </>
      )}

      {name === 'logout' && <Path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" {...common} />}

      {name === 'check' && <Path d="M5 13l4 4L19 7" {...common} />}

      {name === 'star' && (
        <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" {...common} fill={fill} />
      )}

      {name === 'arrowRight' && <Path d="M5 12h14M13 6l6 6-6 6" {...common} />}

      {name === 'clock' && (
        <>
          <Circle cx="12" cy="12" r="9" {...common} />
          <Path d="M12 7v5l3 2" {...common} />
        </>
      )}

      {name === 'email' && (
        <>
          <Path d="M4 6h16v12H4z" {...common} />
          <Path d="M4 7l8 6 8-6" {...common} />
        </>
      )}

      {name === 'pin' && (
        <>
          <Path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" {...common} />
          <Circle cx="12" cy="9" r="2.5" {...common} />
        </>
      )}

      {name === 'search' && (
        <>
          <Circle cx="11" cy="11" r="7" {...common} />
          <Path d="M20 20l-4-4" {...common} />
        </>
      )}

      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...common} />}

      {name === 'trash' && (
        <>
          <Path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" {...common} />
          <Path d="M10 11v5M14 11v5" {...common} />
        </>
      )}

      {name === 'menu' && <Path d="M4 7h16M4 12h16M4 17h10" {...common} />}

      {/* An arc with an arrowhead, not a full circle — a closed ring reads
          as a loading spinner rather than an action. */}
      {name === 'refresh' && (
        <Path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" {...common} />
      )}

      {name === 'departments' && (
        <Path d="M4 21V5l8-3 8 3v16M9 21v-5h6v5M8 9h2M14 9h2M8 13h2M14 13h2" {...common} />
      )}
    </Svg>
  );
}
