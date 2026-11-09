type LogoProps = {
  size?: number;
  className?: string;
};

export function Logo({ size = 40, className }: LogoProps) {
  return (
    <img
      src="/izgo-logo.png"
      alt="IZGO"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: "var(--radius-button)" }}
    />
  );
}
