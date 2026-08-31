/**
 * Hand-drawn inline icon set — 24×24 viewBox, 1.6 stroke, round joins.
 *
 * Deliberately not an icon font or an npm icon package: zero network request,
 * zero extra dependency, and total control over the one thing that actually
 * makes an icon set feel bespoke rather than bought — a single consistent
 * stroke weight, tuned to sit at the same optical density as the 1px hairlines
 * this design is built from. A heavier stroke (the previous 1.75) made icons
 * the loudest marks in the nav rail; 1.6 puts them level with the rules.
 */
import type { SVGProps } from "react";

/** Every icon accepts an optional `size` in px alongside the usual SVG props. */
export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({
  children,
  size = 18,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/**
 * The brand mark: a signal escalating off a baseline, with one cool dot at its
 * apex — the machine watching the same line the human is. Warm bone stroke, warm
 * hairline floor, a single steel-blue point. The palette's whole thesis in 23px,
 * and it says "incident" rather than "generic geometric logo".
 */
export function BrandMark({ size = 24, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true" {...props}>
      <path
        d="M2.6 17.4h3.1l2.3-3.6 2.5 2.1 2.4-5.1 2.2 3"
        stroke="var(--color-ic-text-dim)"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17.1 13.8 20.4 5" stroke="var(--color-ic-text)" strokeWidth={1.9} strokeLinecap="round" />
      <path d="M2.4 20.9h19.2" stroke="var(--color-ic-border-strong)" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx="20.6" cy="4.4" r="2.5" fill="var(--color-ic-accent)" />
    </svg>
  );
}

export function IncidentsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.6 2.8 19.8h18.4L12 3.6Z" />
      <path d="M12 9.6v4" />
      <circle cx="12" cy="16.7" r="0.85" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function ServicesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="5.4" r="2.4" />
      <circle cx="5.6" cy="17" r="2.4" />
      <circle cx="18.4" cy="17" r="2.4" />
      <path d="M10.2 7.4 7.1 14.7M13.8 7.4l3.1 7.3M8 17h8" />
    </Icon>
  );
}

export function DeploymentsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19.4V5.6" />
      <path d="m7.2 10.4 4.8-4.8 4.8 4.8" />
      <path d="M4.6 21.2h14.8" />
    </Icon>
  );
}

export function AlertsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.4a5 5 0 0 0-5 5v3.2c0 .95-.4 1.85-1.05 2.55L4.6 15.7h14.8l-1.35-1.55A3.7 3.7 0 0 1 17 11.6V8.4a5 5 0 0 0-5-5Z" />
      <path d="M9.7 18.6a2.4 2.4 0 0 0 4.6 0" />
    </Icon>
  );
}

export function RunbooksIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.8 6A2.2 2.2 0 0 1 7 3.8h12v16.4H7A2.2 2.2 0 0 1 4.8 18V6Z" />
      <path d="M4.8 18A2.2 2.2 0 0 1 7 15.8h12" />
      <path d="M8.4 7.6h6.8M8.4 10.6h4.4" />
    </Icon>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.8 12.6h3.6l2-7.4 3.8 14.2 2.1-6.8h6.9" />
    </Icon>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2} {...props}>
      <path d="M12 3.2a8.8 8.8 0 1 0 8.8 8.8" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.1} {...props}>
      <path d="m4.8 12.6 4.8 4.8 9.6-10.8" />
    </Icon>
  );
}

export function CrossIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.1} {...props}>
      <path d="M5.4 5.4l13.2 13.2M18.6 5.4 5.4 18.6" />
    </Icon>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.9} {...props}>
      <path d="m6.6 9.6 5.4 5.2 5.4-5.2" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.4V12l3.2 2.1" />
    </Icon>
  );
}

/** A human actor. Used wherever the console distinguishes a person from a machine. */
export function HumanIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.2" r="3.4" />
      <path d="M5.4 20.2a6.6 6.6 0 0 1 13.2 0" />
    </Icon>
  );
}

/** The agent. A signal reaching a point — never a sparkle. */
export function AgentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" />
      <path d="M6.9 6.9a7.2 7.2 0 0 0 0 10.2M17.1 17.1a7.2 7.2 0 0 0 0-10.2" />
      <path d="M3.6 3.6a11.9 11.9 0 0 0 0 16.8M20.4 20.4a11.9 11.9 0 0 0 0-16.8" opacity={0.45} />
    </Icon>
  );
}

/** Human authority over a production change. A seal, not a padlock. */
export function AuthorityIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.2 4.6 6v6.1c0 4.2 3 7.7 7.4 8.7 4.4-1 7.4-4.5 7.4-8.7V6L12 3.2Z" />
      <path d="m9 12.1 2.2 2.2 4-4.4" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.9} {...props}>
      <path d="M12 5.6v12.8M5.6 12h12.8" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.7} {...props}>
      <path d="M4.6 12h14.2M13.4 6.8 18.8 12l-5.4 5.2" />
    </Icon>
  );
}
