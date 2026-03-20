import React, { useRef, useCallback } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import "./EditorMain.css";

const EDITOR_OPTIONS = {
  fontSize: 14,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontFamily: "'JetBrains Mono', 'Consolas', monospace",
  padding: { top: 12, bottom: 12 },
  lineNumbers: "on",
  renderLineHighlight: "line",
  wordWrap: "on",
  automaticLayout: true,
  scrollbar: {
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
    useShadows: false,
  },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  contextmenu: true,
  smoothScrolling: true,
  cursorSmoothCaretAnimation: "on",
  cursorBlinking: "smooth",
  bracketPairColorization: { enabled: true },
};

const DIFF_OPTIONS = {
  ...EDITOR_OPTIONS,
  readOnly: false,
  renderSideBySide: true,
  originalEditable: false,
};

function defineTheme(monaco) {
  monaco.editor.defineTheme("rpa-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0A0C10",
      "editor.foreground": "#E4E6EF",
      "editorLineNumber.foreground": "#8F93A2",
      "editorLineNumber.activeForeground": "#E4E6EF",
      "editorCursor.foreground": "#6C5CE7",
      "editor.selectionBackground": "#6C5CE733",
      "editor.lineHighlightBackground": "#161822",
      "editorWidget.background": "#161822",
      "editorWidget.border": "#ffffff10",
      "editorSuggestWidget.background": "#161822",
      "editorSuggestWidget.border": "#ffffff10",
      "editorSuggestWidget.selectedBackground": "#1C1F2E",
      "input.background": "#0A0C10",
      "input.border": "#ffffff10",
      "scrollbarSlider.background": "#ffffff15",
      "scrollbarSlider.hoverBackground": "#ffffff25",
      "scrollbarSlider.activeBackground": "#ffffff30",
    },
  });
}

export default function EditorMain({ viewMode, draftCode, originalCode, loading, onChange }) {
  const monacoRef = useRef(null);

  const handleBeforeMount = useCallback((monaco) => {
    monacoRef.current = monaco;
    defineTheme(monaco);
  }, []);

  const handleChange = useCallback((value) => {
    if (value !== undefined) {
      onChange(value);
    }
  }, [onChange]);

  const renderLoading = () => (
    <div className="editor-loading">
      <div className="editor-spinner" />
    </div>
  );

  return (
    <div className="editor-main">
      {loading && renderLoading()}
      <div className="monaco-wrapper">
        {viewMode === "diff" ? (
          <DiffEditor
            original={originalCode}
            modified={draftCode}
            language="python"
            theme="rpa-dark"
            options={DIFF_OPTIONS}
            beforeMount={handleBeforeMount}
            loading={renderLoading()}
          />
        ) : (
          <Editor
            value={draftCode}
            language="python"
            theme="rpa-dark"
            options={EDITOR_OPTIONS}
            onChange={handleChange}
            beforeMount={handleBeforeMount}
            loading={renderLoading()}
          />
        )}
      </div>
    </div>
  );
}
