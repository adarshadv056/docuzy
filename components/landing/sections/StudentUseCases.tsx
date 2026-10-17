"use client"

import { motion } from "framer-motion";

const useCases = [
  { title: "Lecture Notes", path: "Store → organize → ask AI" },
  { title: "Research Papers", path: "Read → analyze → ask questions" },
  { title: "Assignments", path: "Write → edit → submit" },
  { title: "Projects", path: "Manage → collaborate → keep everything together" },
  { title: "Career Documents", path: "Resume → certificates → applications" },
];

export default function StudentUseCases() {
  return (
    <section className="w-full max-w-6xl mx-auto px-6 py-12 mb-32 text-center">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-12">Built for the way students work.</h2>
      <div className="flex flex-wrap justify-center gap-4 md:gap-8">
        {useCases.map((useCase, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="flex flex-col items-center bg-white border border-slate-200 px-6 py-5 rounded-2xl shadow-sm hover:border-indigo-300 transition-colors w-full sm:w-auto"
          >
            <span className="font-bold text-slate-800 mb-2">{useCase.title}</span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{useCase.path}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}