import React, { useMemo } from "react";
import CodeDiffBlock from "./CodeDiffBlock";
import "./ChatMessage.css";

/**
 * Parse message content into segments of text and code blocks.
 * Returns array of { type: "text"|"code", content, language? }
 */
function parseContent(content) {
  if (!content) return [];
  const segments = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Text before this code block
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "code",
      language: match[1] || "python",
      content: match[2].replace(/\n$/, ""),
    });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    segments.push({ type: "text", content: content.slice(lastIndex) });
  }

  return segments;
}

export default function ChatMessage({ role, content, isStreaming, onApplyCode }) {
  const segments = useMemo(() => parseContent(content), [content]);
  const isUser = role === "user";

  return (
    <div className={`chat-message chat-message-${role}`}>
      {!isUser && (
        <div className="chat-message-avatar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
            <line x1="10" y1="22" x2="14" y2="22" />
          </svg>
        </div>
      )}
      <div className={`chat-bubble chat-bubble-${role}`}>
        {segments.length === 0 && isStreaming && (
          <span className="chat-streaming-cursor" />
        )}
        {segments.map((seg, i) =>
          seg.type === "code" ? (
            <CodeDiffBlock
              key={i}
              code={seg.content}
              language={seg.language}
              onApplyCode={onApplyCode}
            />
          ) : (
            <span key={i} className="chat-text">{seg.content}</span>
          )
        )}
        {isStreaming && segments.length > 0 && (
          <span className="chat-streaming-cursor" />
        )}
      </div>
    </div>
  );
}
