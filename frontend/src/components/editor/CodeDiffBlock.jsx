import React, { useState, useCallback } from "react";
import "./CodeDiffBlock.css";

export default function CodeDiffBlock({ code, language, onApplyCode }) {
  const [applied, setApplied] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: noop
    }
  }, [code]);

  const handleApply = useCallback(() => {
    if (onApplyCode) {
      onApplyCode(code);
    }
    setApplied(true);
  }, [code, onApplyCode]);

  return (
    <div className={`code-diff-block ${applied ? "code-diff-applied" : ""}`}>
      <div className="code-diff-header">
        <span className="code-diff-language">{language || "Python"}</span>
        <button
          className={`code-diff-copy ${copied ? "copied" : ""}`}
          onClick={handleCopy}
          title="复制代码"
        >
          {copied ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
      <div className="code-diff-content">
        <pre><code>{code}</code></pre>
      </div>
      <div className="code-diff-footer">
        {applied ? (
          <span className="code-diff-applied-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            已应用
          </span>
        ) : (
          <>
            <button className="code-diff-apply" onClick={handleApply}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              应用修改
            </button>
            <button className="code-diff-ignore" onClick={() => setApplied(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              忽略
            </button>
          </>
        )}
      </div>
    </div>
  );
}
