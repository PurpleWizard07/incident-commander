/**
 * Hand-drawn inline icon set — 24x24 viewBox, 1.75 stroke, round joins.
 * Deliberately not an icon-font or npm icon package: zero network request,
 * zero extra dependency, and full control over the exact stroke weight that
 * matches this console's line-forward aesthetic.
 */
import type { SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={17}
      height={17}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IncidentsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3.3 2.4 20h19.2L12 3.3Z" />
      <path d="M12 9.5v4.2" />
      <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function ServicesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </Icon>
  );
}

export function DeploymentsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 19.5V6" />
      <path d="m6 12 6-6 6 6" />
      <path d="M4.5 19.5h15" />
    </Icon>
  );
}

export function AlertsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3.2a5 5 0 0 0-5 5v3.3c0 .95-.4 1.85-1.05 2.55L4.5 15.6h15l-1.45-1.55A3.7 3.7 0 0 1 17 11.5V8.2a5 5 0 0 0-5-5Z" />
      <path d="M9.6 18.6a2.5 2.5 0 0 0 4.8 0" />
    </Icon>
  );
}

export function RunbooksIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4.5 5.8A2.3 2.3 0 0 1 6.8 3.5H19a0.8 0.8 0 0 1 0.8 0.8v14a0.8 0.8 0 0 1-0.8 0.8H6.8A2.3 2.3 0 0 1 4.5 16.8V5.8Z" />
      <path d="M4.5 16.8A2.3 2.3 0 0 1 6.8 14.5H19.8" />
      <path d="M8 7.5h8" />
      <path d="M8 10.3h8" />
    </Icon>
  );
}

export function ActivityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 12.5h4l2-7.5 4 15 2-7.5h6" />
    </Icon>
  );
}

export function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon strokeWidth={2} {...props}>
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    </Icon>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon strokeWidth={2.25} {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Icon>
  );
}

export function CrossIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon strokeWidth={2.25} {...props}>
      <path d="M5 5l14 14M19 5 5 19" />
    </Icon>
  );
}
