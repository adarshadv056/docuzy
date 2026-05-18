import Link from "next/link";
import { 
  Sparkles, 
  ArrowRight, 
  Bot, 
  Zap, 
  Layers, 
  Shield, 
  MousePointerClick,
  FileSearch
} from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-zinc-950 text-zinc-50 overflow-x-hidden selection:bg-indigo-500/30 font-sans">
      
      <div className="fixed top-[-10%] left-1/2 -translate-x-1/2 w-[600px] md:w-[1000px] h-[400px] md:h-[600px] bg-indigo-600/15 blur-[120px] md:blur-[180px] rounded-full pointer-events-none z-0" />

      <section className="relative z-10 w-full max-w-6xl px-6 pt-32 pb-24 mx-auto text-center flex flex-col items-center">
        <div className="inline-flex items-center px-3 py-1.5 mb-8 space-x-2 text-sm font-medium rounded-full bg-zinc-900/50 border border-zinc-800 text-zinc-300 backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Docuzy v1.0 · Now Live</span>
        </div>

        <h1 className="text-5xl md:text-8xl font-bold tracking-tight mb-8 text-transparent bg-clip-text bg-gradient-to-b from-zinc-100 to-zinc-500 leading-[1.1]">
          Your Entire Workspace. <br className="hidden md:block" />
          Organized & AI-Powered.
        </h1>

        <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-400 mb-12 font-medium leading-relaxed">
          Every editing tool you need, in one place. Organize your files, share your work, 
          and let our AI handle the heavy lifting.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-24">
          <Link 
            href="/dashboard" 
            className="group relative px-10 py-4 bg-zinc-50 text-zinc-950 font-bold rounded-xl transition-all hover:bg-white hover:scale-105 flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            Start Building
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
          {/* <Link href="/login" className="px-10 py-4 bg-zinc-900/50 text-zinc-300 font-bold rounded-xl border border-zinc-800 transition-all hover:bg-zinc-800 backdrop-blur-md">
            Login to Dashboard  
          </Link> */}
        </div>

        <div className="relative w-full max-w-6xl aspect-[16/10] rounded-2xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-sm overflow-hidden shadow-2xl group">
           <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-transparent opacity-50" />
           <div className="absolute top-0 w-full h-12 border-b border-zinc-800 bg-zinc-900/40 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
           </div>
           <div className="w-full h-full flex items-center justify-center pt-12">
              <div className="flex flex-col items-center gap-6 opacity-40">
                <div className="grid grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="w-24 h-32 rounded-lg border border-zinc-800 bg-zinc-800/20" />
                  ))}
                </div>
                <p className="text-sm font-mono tracking-widest uppercase">Dashboard Preview</p>
              </div>
           </div>
        </div>
      </section>

      <section className="relative z-10 w-full max-w-6xl px-6 py-32 mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Built for Efficiency.</h2>
          <p className="text-zinc-500 text-lg">Powerful features to streamline your document workflow.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          <div className="group p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800 hover:border-indigo-500/50 transition-all duration-500">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold mb-4">Smart Summarization</h3>
            <p className="text-zinc-400 leading-relaxed">
              Instantly condense long documents into actionable insights using our proprietary AI models.
            </p>
          </div>

          <div className="group p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800 hover:border-indigo-500/50 transition-all duration-500">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold mb-4">AI-Powered Editing</h3>
            <p className="text-zinc-400 leading-relaxed">
              Refine your tone, fix complex grammar, and rewrite sections with context-aware AI assistance.
            </p>
          </div>

          <div className="group p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800 hover:border-indigo-500/50 transition-all duration-500">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Layers className="group-hover:scale-110 transition-transform w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold mb-4">All-in-One Hub</h3>
            <p className="text-zinc-400 leading-relaxed">
              Manage PDFs, Markdown files, and rich text documents in a single, cinematic interface.
            </p>
          </div>

          <div className="group p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800 hover:border-indigo-500/50 transition-all duration-500">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <FileSearch className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold mb-4">Semantic Search</h3>
            <p className="text-zinc-400 leading-relaxed">
              Find files based on their meaning, not just keywords. Search your entire workspace instantly.
            </p>
          </div>

          <div className="group p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800 hover:border-indigo-500/50 transition-all duration-500">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <MousePointerClick className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold mb-4">One-Click Export</h3>
            <p className="text-zinc-400 leading-relaxed">
              Share your work in multiple formats with professional branding applied automatically.
            </p>
          </div>

          <div className="group p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800 hover:border-indigo-500/50 transition-all duration-500">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold mb-4">Privacy First</h3>
            <p className="text-zinc-400 leading-relaxed">
              Your data is encrypted at rest and in transit. We never use your documents to train public models.
            </p>
          </div>

        </div>
      </section>

      <section className="relative z-10 w-full max-w-5xl px-6 py-40 mx-auto text-center">
        <div className="relative p-12 md:p-24 rounded-[3rem] bg-zinc-900/20 border border-zinc-800 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
          
          <h2 className="text-4xl md:text-6xl font-bold mb-8">Ready to transform your <br/> workspace?</h2>
          <p className="text-zinc-400 mb-12 max-w-lg mx-auto text-lg">
            Stop juggling multiple apps. Experience the future of document processing today with Docuzy.
          </p>
          
          <Link 
            href="/signup" 
            className="inline-flex items-center px-12 py-5 bg-indigo-600 text-white font-bold rounded-2xl transition-all hover:bg-indigo-500 hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] active:scale-95"
          >
            Create Your Account
          </Link>
          
          <p className="mt-8 text-sm text-zinc-500 font-medium tracking-wide uppercase">
            No credit card required · Instant access
          </p>
        </div>
      </section>

    </main>
  );
}