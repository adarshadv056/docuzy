"use client"

import { ReactNode } from "react";
import Link from "next/link";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  "aria-label"?: string;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  href,
  onClick,
  type = "button",
  disabled,
  ...aria
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

  // White or near-black only — the light canvas calls for a dark primary and a
  // white secondary with a definite border (DESIGN.md §10 hero guardrails).
  const variants = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm",
    outline: "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 shadow-sm",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3",
    lg: "px-10 py-5",
  };

  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick} {...aria}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled} {...aria}>
      {children}
    </button>
  );
}
