import { useState, useCallback, useRef } from "react";
import { streamAIChat } from "../api";

export function useAIChat() {
    const [messages, setMessages] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState(null);
    const abortRef = useRef(null);

    const sendMessage = useCallback((code, userMessage) => {
        setError(null);

        // Build history from existing messages
        const history = messages
            .filter(m => m.role === "user" || m.role === "assistant")
            .map(m => ({ role: m.role, content: m.content }));

        const userMsg = { role: "user", content: userMessage };
        const assistantMsg = { role: "assistant", content: "" };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        setIsStreaming(true);

        const abort = streamAIChat(
            { code, message: userMessage, history },
            (chunk) => {
                if (chunk.type === "text") {
                    setMessages((prev) => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        updated[updated.length - 1] = { ...last, content: last.content + chunk.content };
                        return updated;
                    });
                }
            },
            () => setIsStreaming(false),
            (err) => {
                setError(err.message);
                setIsStreaming(false);
            }
        );

        abortRef.current = abort;
    }, [messages]);

    const clearChat = useCallback(() => {
        if (abortRef.current) abortRef.current();
        setMessages([]);
        setError(null);
        setIsStreaming(false);
    }, []);

    return { messages, isStreaming, error, sendMessage, clearChat };
}
