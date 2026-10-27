'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Plus, FileText, Square, X } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from '@/components/ToastProvider';

// Replace citation markers [n] with inline-code tokens, then render those
// as highlight chips via the `code` component override.
const citationize = (text: string) => text.replace(/(?<!`)\[(\d+)\](?!`)/g, '`[$1]`');

const markdownComponents: Components = {
    code: ({ className, children, ...props }) => {
        const text = String(children ?? '');
        if (!className && /^\[\d+\]$/.test(text)) {
            return (
                <span className="mx-0.5 inline-block rounded bg-indigo-100 px-1.5 py-0.5 align-middle text-xs font-semibold text-indigo-700">
                    {text}
                </span>
            );
        }
        return (
            <code className={className} {...props}>
                {children}
            </code>
        );
    },
};

type Source = {
    title: string;
    pageNumbers?: number[];
    documentId: string;
    score: number;
};

type Message = {
    role: 'user' | 'assistant';
    content: string;
    sources?: Source[];
};

// Minimal Web Speech API surface — the browser types vary between Chrome
// (webkitSpeechRecognition) and others, so we type the shape we use.
type SpeechResult = { isFinal: boolean; 0?: { transcript?: string } };
type SpeechRecognitionLike = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((e: { resultIndex: number; results: { length: number; [index: number]: SpeechResult } }) => void) | null;
    onerror: ((e: { error?: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
};

export type ChatDocument = {
    id: string;
    title: string;
};

export default function ChatZone({
    documents,
}: {
    documents: ChatDocument[];
}) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const toast = useToast();

    const micFinalRef = useRef('');
    const micRecognitionRef = useRef<SpeechRecognitionLike | null>(null);

    const getRecognition = (): SpeechRecognitionLike | null => {
        const w = window as unknown as {
            SpeechRecognition?: new () => SpeechRecognitionLike;
            webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        };
        const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
        return Ctor ? new Ctor() : null;
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Stop in-flight recognition when the component unmounts.
    useEffect(() => {
        return () => micRecognitionRef.current?.abort();
    }, []);

    const toggleDoc = (id: string) => {
        setSelectedDocIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const clearDocs = () => setSelectedDocIds([]);

    const toggleVoiceInput = () => {
        if (isStreaming) return;

        if (isListening) {
            micRecognitionRef.current?.stop();
            return;
        }

        const recognition = getRecognition();
        if (!recognition) {
            toast.error('Voice input is not supported in this browser. Use Chrome or Edge.');
            return;
        }

        // Continue from whatever text is already in the box.
        micFinalRef.current = input ? input.trim() + ' ' : '';
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (e) => {
            let final = micFinalRef.current;
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const result = e.results[i];
                if (result.isFinal) {
                    final += result[0]?.transcript ?? '';
                    if (final && !final.endsWith(' ')) final += ' ';
                } else {
                    interim += result[0]?.transcript ?? '';
                }
            }
            micFinalRef.current = final;
            setInput(final + interim);
        };

        recognition.onerror = (e) => {
            if (e.error === 'not-allowed') {
                toast.error('Microphone access was denied.');
            } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
                toast.error('Voice input failed. Try again.');
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            micRecognitionRef.current = null;
        };

        micRecognitionRef.current = recognition;
        setIsListening(true);
        recognition.start();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const question = input.trim();
        if (!question || isStreaming) return;

        setMessages((prev) => [
            ...prev,
            { role: 'user', content: question },
            { role: 'assistant', content: '' },
        ]);
        setInput('');
        setIsStreaming(true);

        const appendAssistant = (update: (content: string, sources?: Source[]) => { content: string; sources?: Source[] }) => {
            // Pure updater: always build a new message object.
            setMessages((prev) => {
                if (prev.length === 0) return prev;
                const last = prev[prev.length - 1];
                if (last?.role !== 'assistant') return prev;
                const nextMsg = update(last.content, last.sources);
                return [...prev.slice(0, -1), { ...last, ...nextMsg }];
            });
        };

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question,
                    prioritizeDocumentIds: selectedDocIds,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Request failed (${res.status})`);
            }

            if (!res.body) throw new Error('No response stream');

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            let pendingSources: Source[] | undefined;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                let sep = buffer.indexOf('\n\n');
                while (sep !== -1) {
                    const rawEvent = buffer.slice(0, sep);
                    buffer = buffer.slice(sep + 2);
                    processEvent(rawEvent);
                    sep = buffer.indexOf('\n\n');
                }
            }
            buffer += decoder.decode();

            function processEvent(rawEvent: string) {
                const lines = rawEvent.split('\n');
                const type = lines.find((l) => l.startsWith('event: '))?.slice(7);
                const dataLine = lines.find((l) => l.startsWith('data: '))?.slice(6);

                if (type === 'error' && dataLine) {
                    appendAssistant(() => ({ content: parseErrorMessage(dataLine) }));
                } else if (type === 'delta' && dataLine) {
                    appendAssistant((content) => ({ content: content + parseDelta(dataLine) }));
                } else if (type === 'sources' && dataLine) {
                    pendingSources = parseSources(dataLine);
                } else if (type === 'done' && pendingSources) {
                    appendAssistant((content) => ({ content, sources: pendingSources }));
                }
            }

            function parseDelta(line: string) {
                try {
                    const j = JSON.parse(line);
                    return typeof j === 'string' ? j : '';
                } catch {
                    return '';
                }
            }

            function parseSources(line: string): Source[] {
                try {
                    const arr = JSON.parse(line);
                    if (Array.isArray(arr)) return arr as Source[];
                } catch { /* ignore */ }
                return [];
            }

            function parseErrorMessage(line: string) {
                try {
                    return JSON.parse(line) as string;
                } catch {
                    return 'Something went wrong. Please try again.';
                }
            }
        } catch (err) {
            console.error('Chat error:', err);
            appendAssistant(() => ({
                content:
                    err instanceof Error && err.message !== 'Failed to fetch'
                        ? err.message
                        : 'Failed to connect. Please try again.',
            }));
        } finally {
            setIsStreaming(false);
        }
    };

    return (
        <div className="flex flex-col">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto max-w-4xl">
                    {messages.length === 0 ? (
                        <div className="flex h-[30vh] items-center justify-center">
                            <div className="text-center">
                                <h1 className="mb-3 text-2xl font-semibold">
                                    Chat with your documents
                                </h1>
                                <p className="text-zinc-500">
                                    Ask questions and get instant answers
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {messages.map((msg, i) => {
                                const isThinking =
                                    msg.role === 'assistant' &&
                                    isStreaming &&
                                    i === messages.length - 1 &&
                                    msg.content === '';
                                return (
                                <div
                                    key={i}
                                    className={
                                        msg.role === 'user'
                                            ? 'flex justify-end'
                                            : 'flex justify-start'
                                    }
                                >
                                    <div
                                        className={
                                            msg.role === 'user'
                                                ? 'max-w-[80%] rounded-2xl bg-indigo-600 px-4 py-2 text-white whitespace-pre-wrap'
                                                : 'max-w-[90%] rounded-2xl bg-zinc-100 px-4 py-2 text-zinc-900'
                                        }
                                    >
                                        {isThinking ? (
                                            <span className="flex items-center gap-1 py-1">
                                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
                                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
                                            </span>
                                        ) : msg.role === 'assistant' ? (
                                            <div className="markdown-body [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-3 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_strong]:text-zinc-900 [&_a]:text-indigo-600 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                                    {citationize(msg.content)}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <span className="whitespace-pre-wrap">{msg.content}</span>
                                        )}
                                        {msg.sources && msg.sources.length > 0 && (
                                            <div className="mt-3 space-y-1 border-t border-zinc-200 pt-2">
                                                <div className="text-xs text-zinc-500">
                                                    Sources:
                                                </div>
                                                {msg.sources.map((s, j) => (
                                                    <div
                                                        key={j}
                                                        className="flex items-center gap-2 text-xs text-zinc-600"
                                                    >
                                                        <FileText className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">
                                                            {s.title}
                                                        </span>
                                                        {s.pageNumbers?.length ? (
                                                            <span className="shrink-0 text-zinc-500">
                                                                · page {s.pageNumbers.join(', ')}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Input Section */}
            <div className="sticky bottom-0 px-4 pb-6">
                <div className="mx-auto max-w-4xl">
                    <form onSubmit={handleSubmit}>
                        <div className="relative rounded-[32px] border border-zinc-200 bg-white shadow-sm">
                            <textarea
                                rows={3}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                                placeholder={
                                    selectedDocIds.length > 0
                                        ? `Ask about ${
                                              documents
                                                  .filter((d) => selectedDocIds.includes(d.id))
                                                  .map((d) => d.title)
                                                  .join(', ')
                                          } (prioritized)...`
                                        : 'Ask anything about your documents...'
                                }
                                className="w-full resize-none bg-transparent px-6 pt-5 text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                                disabled={isStreaming}
                            />

                            <div className="flex items-center justify-between px-4 pb-4">
                                <div className="relative flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPickerOpen((o) => !o)}
                                        disabled={isStreaming}
                                        className={`relative flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-40 ${
                                            pickerOpen || selectedDocIds.length > 0
                                                ? 'bg-indigo-50 text-indigo-600'
                                                : 'text-zinc-500 hover:bg-zinc-100'
                                        }`}
                                        title={
                                            pickerOpen
                                                ? 'Close document picker'
                                                : 'Prioritize documents'
                                        }
                                    >
                                        {pickerOpen ? <X size={18} /> : <Plus size={18} />}
                                        {!pickerOpen && selectedDocIds.length > 0 && (
                                            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                                                {selectedDocIds.length}
                                            </span>
                                        )}
                                    </button>

                                    {pickerOpen && (
                                        <div className="absolute bottom-full left-0 z-20 mb-3 w-80 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl">
                                            <div className="mb-2 flex items-center justify-between">
                                                <span className="text-sm font-semibold">
                                                    Prioritize documents
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setPickerOpen(false)}
                                                    className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                                                    title="Close"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                            <p className="mb-2 text-xs text-zinc-500">
                                                Selected documents get matched first and fill the
                                                answer context before any other uploads.
                                            </p>
                                            {documents.length === 0 ? (
                                                <p className="text-xs text-zinc-500">
                                                    No documents uploaded yet.
                                                </p>
                                            ) : (
                                                <div className="max-h-60 space-y-1 overflow-y-auto">
                                                    {documents.map((doc) => {
                                                        const checked = selectedDocIds.includes(doc.id);
                                                        return (
                                                            <label
                                                                key={doc.id}
                                                                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-100"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => toggleDoc(doc.id)}
                                                                    className="accent-indigo-600"
                                                                />
                                                                <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                                                                <span
                                                                    className={`truncate text-sm ${
                                                                        checked ? 'text-indigo-700 font-medium' : 'text-zinc-700'
                                                                    }`}
                                                                >
                                                                    {doc.title}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <div className="mt-2 flex items-center justify-between border-t border-zinc-200 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={clearDocs}
                                                    className="text-xs text-zinc-500 hover:text-red-600"
                                                >
                                                    Clear selection
                                                </button>
                                                <span className="text-xs text-zinc-500">
                                                    {selectedDocIds.length} selected
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={toggleVoiceInput}
                                        disabled={isStreaming}
                                        className={`flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-40 ${
                                            isListening
                                                ? 'animate-pulse bg-red-500/90 text-white'
                                                : 'text-zinc-500 hover:bg-zinc-100'
                                        }`}
                                        title={isListening ? 'Stop listening' : 'Voice input'}
                                    >
                                        {isListening ? <Square size={14} /> : <Mic size={18} />}
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={isStreaming || !input.trim()}
                                        className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600"
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