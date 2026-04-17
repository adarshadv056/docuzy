"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { getWaitlistCount, joinWaitlist } from "@/actions/waitlist";

export default function WaitlistForm({ initialCount }: { initialCount: number }) {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [count, setCount] = useState<number>(initialCount);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // const prevCount = count;
        setStatus("loading");
        setMessage("");
        // setCount(prev => prev + 1);

        const result = await joinWaitlist(email);
        
        if (result.success) {
            setStatus("success");
            setEmail("");

            const newCount = await getWaitlistCount();
            setCount(newCount);
        } else {
            setStatus("error");
            setMessage(result.message);
        }
    };

    if (status === "success") {
        return (
            <div className="flex flex-col items-center justify-center p-1 animate-in fade-in zoom-in duration-500">
                <div className="flex items-center space-x-2 text-zinc-200 bg-zinc-800/80 px-6 py-3 rounded-xl border border-zinc-700 font-medium">
                    <CheckCircle2 className="w-5 h-5 text-zinc-300" />
                    <span>You're on the list. We'll be in touch.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                    type="email"
                    required
                    placeholder="Enter your email address..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 h-12 p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-600 transition-all"
                    disabled={status === "loading"}
                />
                <button
                    type="submit"
                    disabled={status === "loading"}
                    className="h-12 px-6 bg-zinc-100 text-zinc-900 rounded-xl hover:bg-white transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                    {status === "loading" ? "Joining..." : "Join Waitlist"}
                </button>
            </form>

            {status === "error" && (
                <p className="mt-2 text-sm text-red-400 font-medium text-left px-2">{message}</p>
            )}
        </div>
    );
}