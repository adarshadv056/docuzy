import WaitlistForm from "@/components/WaitlistForm";
import { Sparkles } from "lucide-react";
import { getWaitlistCount } from "@/actions/waitlist";

export default async function Home() {
  const waitlistCount = await getWaitlistCount();

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-50 overflow-hidden selection:bg-zinc-800">

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[400px] bg-indigo-600/30 blur-[100px] md:blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl px-6 py-24 mx-auto text-center flex flex-col items-center">

        <div className="inline-flex items-center px-3 py-1.5 mb-8 space-x-2 text-sm font-medium rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
          <Sparkles className="w-4 h-4 text-zinc-400" />
          <span>Docuzy · Coming Soon</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-b from-zinc-100 to-zinc-500 selection:text-zinc-900">
          Your Entire Workspace. <br className="hidden md:block" />
          Organized & AI-Powered.
        </h1>

        <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-400 mb-10 font-medium leading-relaxed">
          Every editing tool you need, in one place. Organize your files, share your work,
          and let our AI handle the heavy lifting with <span className="font-bold">Docuzy</span>.
        </p>

        <div className="w-full max-w-md backdrop-blur-md bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800 shadow-2xl">
          <WaitlistForm  initialCount={waitlistCount} />
        </div>

        <div className="mt-10 flex items-center space-x-4 opacity-70">
          <div className="flex -space-x-2">
            <img
              src="https://randomuser.me/api/portraits/women/44.jpg"
              alt="Avatar"
              className="w-8 h-8 rounded-full border-2 border-zinc-950 object-cover"
            />
            <img
              src="https://randomuser.me/api/portraits/men/32.jpg"
              alt="Avatar"
              className="w-8 h-8 rounded-full border-2 border-zinc-950 object-cover"
            />
            <img
              src="https://randomuser.me/api/portraits/women/68.jpg"
              alt="Avatar"
              className="w-8 h-8 rounded-full border-2 border-zinc-950 object-cover"
            />
          </div>
          <p className="text-sm text-zinc-400 font-medium">
            Join, {waitlistCount} people waiting for early access.
          </p>
        </div>

      </div>
    </main>
  );
}