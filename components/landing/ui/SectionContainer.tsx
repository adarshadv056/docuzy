"use client"

import { motion, Variants } from "framer-motion";

const sectionFadeIn: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

interface SectionContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "stagger";
}

export default function SectionContainer({
  children,
  className = "",
  variant = "default",
}: SectionContainerProps) {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={variant === "stagger" ? staggerContainer : sectionFadeIn}
      className={className}
    >
      {children}
    </motion.section>
  );
}