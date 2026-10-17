"use client"

import { motion } from "framer-motion";
import { Folder, FileText } from "lucide-react";

export default function OneWorkspace() {
  return (
    <div className="bg-slate-50 text-slate-900 pt-32 pb-24 rounded-t-[3rem] -mt-10 relative z-20">
      <section className="w-full max-w-6xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="text-sm font-bold tracking-widest text-indigo-600 uppercase mb-4">ONE WORKSPACE</div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-slate-900">
            Everything you work on, in one place.
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-slate-600 mb-16 leading-relaxed">
            Your notes, assignments, research papers, projects, and everyday files shouldn&apos;t live across a dozen different tools. Docuzy brings your documents, essential file tools, and AI into one workspace.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative w-full aspect-[16/10] bg-white rounded-2xl shadow-xl shadow-slate-200 border border-slate-200 overflow-hidden flex flex-col"
        >
          <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-white/50 backdrop-blur-sm z-10">
            <div className="flex items-center gap-8">
              <div className="font-bold text-slate-800 text-lg">Docuzy</div>
              <div className="hidden md:flex gap-6 text-sm font-medium">
                <span className="text-indigo-600 border-b-2 border-indigo-600 py-4">Documents</span>
                <span className="text-slate-500 py-4">Tools</span>
                <span className="text-slate-500 py-4">AI Chat</span>
              </div>
            </div>
            <div className="w-64 h-9 bg-slate-100 rounded-md flex items-center px-3 gap-2">
              <span className="text-sm text-slate-400">Search workspace...</span>
            </div>
          </div>
          
          <div className="flex-1 flex bg-slate-50/50">
            <div className="w-64 border-r border-slate-100 p-6 hidden md:block">
              <div className="text-xs font-bold text-slate-400 mb-4 tracking-wider">FOLDERS</div>
              <div className="flex flex-col gap-3">
                {['Semester 5', 'Projects', 'Research', 'Career'].map((folder, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer">
                    <Folder className="w-4 h-4 text-slate-400" />
                    {folder}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 p-8 grid grid-cols-2 md:grid-cols-4 gap-6 content-start">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="w-full aspect-[3/4] bg-slate-50 rounded-lg mb-3 flex items-center justify-center border border-slate-100">
                    <FileText className="w-8 h-8 text-slate-300" />
                  </div>
                  <div className="h-4 w-3/4 bg-slate-100 rounded mb-2"></div>
                  <div className="h-3 w-1/2 bg-slate-50 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}