"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { getWaitlistCount, joinWaitlist } from "@/actions/waitlist";

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
    }
}

export default function WaitlistForm({ initialCount }: { initialCount: number }) {
    const [email, setEmail] = useState("");
    const [company, setCompany] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [count, setCount] = useState<number>(initialCount);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setStatus("loading");
        setMessage("");

        const result = await joinWaitlist(email, company);

        if (result.success) {
            setStatus("success");
            setEmail("");
            if (typeof window !== "undefined" && window.gtag) {
                window.gtag('event', 'waitlist_joined', {
                    event_category: 'engagement',
                    event_label: 'waitlist_form',
                });
            }
            const newCount = await getWaitlistCount();
            setCount(newCount);
        } else {
            setStatus("error");
            setMessage(result.message);
        }
    };

    const shareOnX = () => {
        const siteUrl = window.location.origin;

        const tweetText = `All tools. All files. One place 🧠
        Docuzy is building a smarter way to edit, store, and organize everything with AI. I’m on the waitlist: ${siteUrl} `;

        const encodedText = encodeURIComponent(tweetText);
        const encodedUrl = encodeURIComponent(siteUrl);

        window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, "_blank");
    };

    if (status === "success") {
        return (
            <div className="flex items-center justify-between w-full max-w-xl animate-in fade-in zoom-in duration-500">

                <div className="flex items-center gap-2 text-zinc-200 px-4 py-2 font-medium">
                    <CheckCircle2 className="w-5 h-5 text-zinc-400" />
                    <span>You're in the vault. We'll be in touch.</span>
                </div>

                <button
                    onClick={shareOnX}
                    className="group flex items-center gap-2 text-zinc-200 bg-zinc-800/50 px-4 py-2 rounded-xl border border-zinc-700/50 font-medium shadow-xl backdrop-blur-sm hover:bg-zinc-800/70 transition"
                >
                    {/* <X className="w-3.5 h-3.5 transition-transform group-hover:scale-110" /> */}
                    <span className="cursor-pointer border-transparent pb-0.5 transition">
                        Share on X
                    </span>
                </button>

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
                <input type="text" name="company" onChange={(e) => setCompany(e.target.value)} style={{ display: "none" }} />
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