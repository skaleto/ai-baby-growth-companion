import type { CSSProperties } from "react";

export type SkeletonProps = {
  /** Width — number is px, string is raw CSS (e.g. "100%") */
  width?: number | string;
  /** Height — number is px, string is raw CSS */
  height?: number | string;
  /** Border radius — number is px, string is raw CSS. Defaults to 8 */
  radius?: number | string;
  /** Render as block vs inline-block. Defaults to block. */
  inline?: boolean;
  /** Optional className for layout overrides */
  className?: string;
};

/**
 * Animated shimmer block used for loading states.
 * Respects prefers-reduced-motion.
 */
export function Skeleton({
  width,
  height,
  radius = 8,
  inline = false,
  className,
}: SkeletonProps) {
  const style: CSSProperties = {
    width: width == null ? "100%" : typeof width === "number" ? `${width}px` : width,
    height: height == null ? "16px" : typeof height === "number" ? `${height}px` : height,
    borderRadius: typeof radius === "number" ? `${radius}px` : radius,
    display: inline ? "inline-block" : "block",
  };
  return (
    <span
      className={["skeleton", className].filter(Boolean).join(" ")}
      style={style}
      aria-hidden="true"
    />
  );
}
