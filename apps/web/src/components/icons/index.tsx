import type { ReactNode, SVGProps } from 'react';

/*
 * SmartPack's own icon set. Drawn on a 24px grid with a 1.5px stroke, square caps and mitred
 * joins so the marks look engineered rather than friendly. Icons are decorative by default
 * (aria-hidden); the visible text label next to them carries the meaning.
 */

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

function Svg({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function OverviewIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="7" height="9" />
      <rect x="13.5" y="3.5" width="7" height="5" />
      <rect x="13.5" y="11.5" width="7" height="9" />
      <rect x="3.5" y="15.5" width="7" height="5" />
    </Svg>
  );
}

export function PackIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 20.5V10a6 6 0 0 1 12 0v10.5z" />
      <path d="M9.5 5V3.5h5V5" />
      <path d="M8.5 20.5v-6h7v6" />
    </Svg>
  );
}

export function WorkersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20.5c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </Svg>
  );
}

export function VerificationIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </Svg>
  );
}

export function TrackingIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.25" />
    </Svg>
  );
}

export function CustodyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h15M15 4l4 4-4 4" />
      <path d="M20 16H5M9 12l-4 4 4 4" />
    </Svg>
  );
}

export function InspectionsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="4.5" width="14" height="16" />
      <path d="M9 4.5V3h6v1.5" />
      <path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" />
    </Svg>
  );
}

export function AlertsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 1.5h-15z" />
      <path d="M10 21h4" />
    </Svg>
  );
}

export function ReportsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5.5" y="11" width="3" height="9" />
      <rect x="10.5" y="4" width="3" height="16" />
      <rect x="15.5" y="8" width="3" height="12" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2" />
      <circle cx="9" cy="16" r="2" />
    </Svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4.5M12 17.5v.5" />
    </Svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.75v.5" />
    </Svg>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5" />
      <path d="M3.5 13.5l2.5-8h12l2.5 8v6h-17z" />
    </Svg>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 9l7 7 7-7" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.5 5.5" />
    </Svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </Svg>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 12S6 5.5 12 5.5c1.6 0 3 .5 4.2 1.1M21.5 12S18 18.5 12 18.5c-1.6 0-3-.5-4.2-1.1" />
      <path d="M9.5 9.7a3.5 3.5 0 0 0 4.8 4.8M4 4l16 16" />
    </Svg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 16.75v.25" />
    </Svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" />
      <path d="M15.5 8.5v-4h-11v11h4" />
    </Svg>
  );
}
