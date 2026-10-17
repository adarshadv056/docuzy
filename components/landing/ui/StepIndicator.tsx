"use client"

interface StepIndicatorProps {
  number: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function StepIndicator({
  number,
  size = "md",
  className = "",
}: StepIndicatorProps) {
  const sizes = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-xl",
    lg: "w-16 h-16 text-2xl",
  };

  return (
    <div
      className={`
        flex items-center justify-center rounded-full border-2 border-indigo-100
        text-indigo-600 font-bold bg-white
        ${sizes[size]}
        ${className}
      `}
    >
      {number}
    </div>
  );
}