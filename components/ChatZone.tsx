'use client';

import { useState } from 'react';
import { Send, Mic, Plus } from 'lucide-react';

export default function ChatZone() {
  const [input, setInput] = useState('');

  return (
    // <div className="flex h-screen flex-col bg-[#111111] text-white">
    <div className="">
      {/* Messages Area */}
      {/* <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="flex h-[50vh] items-center justify-center">
            <div className="text-center">
              <h1 className="mb-3 text-4xl font-semibold">
                Chat with your documents
              </h1>

              <p className="text-zinc-400">
                Ask questions and get instant answers
              </p>
            </div>
          </div>
        </div>
      </div> */}

      {/* Input Section */}
      <div className="sticky bottom-0 px-4 pb-6">
        <div className="mx-auto max-w-4xl">
          <form>
            <div className="rounded-[32px] border border-zinc-800 bg-[#1b1b1b] shadow-2xl">

              {/* Textarea */}
              <textarea
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your documents..."
                className="
                  w-full
                  resize-none
                  bg-transparent
                  px-6
                  pt-5
                  text-white
                  placeholder:text-zinc-500
                  focus:outline-none
                "
              />

              {/* Bottom Toolbar */}
              <div className="flex items-center justify-between px-4 pb-4">

                {/* Left Icons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="
                      flex h-10 w-10 items-center justify-center
                      rounded-full
                      hover:bg-zinc-800
                    "
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="
                      flex h-10 w-10 items-center justify-center
                      rounded-full
                      hover:bg-zinc-800
                    "
                  >
                    <Mic size={18} />
                  </button>

                  <button
                    type="submit"
                    className="
                      flex h-10 w-10 items-center justify-center
                      rounded-full
                      bg-white
                      text-black
                      hover:bg-zinc-200
                    "
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          </form>

          <p className="mt-3 text-center text-xs text-zinc-500">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}