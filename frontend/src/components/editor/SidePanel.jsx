import React, { useState, useRef, useCallback, useEffect } from "react";
import "./SidePanel.css";

export default function SidePanel({ isOpen, onToggle, activeTab, onTabChange, children }) {
  const [width, setWidth] = useState(360);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const panelRef = useRef(null);
  const tabIndicatorRef = useRef(null);
  const tabsRef = useRef({});

  // Update tab indicator position
  useEffect(() => {
    const activeEl = tabsRef.current[activeTab];
    const indicator = tabIndicatorRef.current;
    if (activeEl && indicator) {
      indicator.style.width = `${activeEl.offsetWidth}px`;
      indicator.style.transform = `translateX(${activeEl.offsetLeft}px)`;
    }
  }, [activeTab, isOpen]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const maxWidth = window.innerWidth * 0.5;
      const newWidth = Math.min(maxWidth, Math.max(280, startWidth.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [width]);

  return (
    <div
      ref={panelRef}
      className={`side-panel ${isOpen ? "side-panel-open" : ""}`}
      style={{ width: isOpen ? `${width}px` : "0px" }}
    >
      <div className="side-panel-drag-handle" onMouseDown={handleMouseDown} />
      <div className="side-panel-inner">
        <div className="side-panel-header">
          <div className="side-panel-tabs">
            <button
              ref={(el) => (tabsRef.current["ai"] = el)}
              className={`side-panel-tab ${activeTab === "ai" ? "active" : ""}`}
              onClick={() => onTabChange("ai")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                <line x1="10" y1="22" x2="14" y2="22" />
              </svg>
              AI 助手
            </button>
            <button
              ref={(el) => (tabsRef.current["logs"] = el)}
              className={`side-panel-tab ${activeTab === "logs" ? "active" : ""}`}
              onClick={() => onTabChange("logs")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              测试日志
            </button>
            <div ref={tabIndicatorRef} className="side-panel-tab-indicator" />
          </div>
          <button className="side-panel-close" onClick={onToggle} title="关闭面板">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="side-panel-body">
          {children}
        </div>
      </div>
    </div>
  );
}
