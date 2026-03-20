import React, { useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import "./AIChatPanel.css";

export default function AIChatPanel({
  messages,
  isStreaming,
  error,
  onSendMessage,
  onApplyCode,
}) {
  const listRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = listRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages]);

  const hasMessages = messages.length > 0;

  return (
    <div className="ai-chat-panel">
      {error && (
        <div className="ai-chat-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>请先在设置中配置 AI 模型</span>
        </div>
      )}
      <div ref={listRef} className="ai-chat-messages">
        {!hasMessages && (
          <div className="ai-chat-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>向 AI 描述你的修改需求</span>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role}
            content={msg.content}
            isStreaming={
              isStreaming &&
              msg.role === "assistant" &&
              i === messages.length - 1
            }
            onApplyCode={onApplyCode}
          />
        ))}
      </div>
      <ChatInput
        onSend={onSendMessage}
        disabled={isStreaming}
      />
    </div>
  );
}
