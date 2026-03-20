import React from "react";
import { useEditor } from "../../hooks/useEditor";
import { useDraftRunner } from "../../hooks/useDraftRunner";
import EditorToolbar from "./EditorToolbar";
import EditorMain from "./EditorMain";
import EditorActionBar from "./EditorActionBar";
import EmptyState from "./EmptyState";
import "./EditorPage.css";

export default function EditorPage({ scripts, logs, statuses }) {
  const editor = useEditor();
  const draftRunner = useDraftRunner(editor.selectedScript, logs, statuses);

  const handleSelectScript = (name) => {
    editor.loadScript(name);
  };

  const handlePublish = () => {
    if (window.confirm("确认要将草稿发布到正式版吗？此操作将覆盖当前正式版内容。")) {
      editor.publishAction();
    }
  };

  const handleDiscard = () => {
    if (window.confirm("确认要放弃当前草稿吗？未保存的更改将丢失。")) {
      editor.discardDraft();
    }
  };

  return (
    <div className="editor-page">
      <EditorToolbar
        scripts={scripts}
        selectedScript={editor.selectedScript}
        onSelectScript={handleSelectScript}
        hasDraft={editor.hasDraft}
        isDirty={editor.isDirty}
        viewMode={editor.viewMode}
        onToggleDiff={editor.toggleDiff}
        draftStatus={draftRunner.status}
        onRunTest={draftRunner.runTest}
        onStopTest={draftRunner.stopTest}
      />
      <div className="editor-page-content">
        <div className="editor-page-main">
          {editor.selectedScript ? (
            <EditorMain
              viewMode={editor.viewMode}
              draftCode={editor.draftCode}
              originalCode={editor.originalCode}
              loading={editor.loading}
              onChange={editor.updateCode}
            />
          ) : (
            <EmptyState scripts={scripts} onSelectScript={handleSelectScript} />
          )}
        </div>
        {/* Side panel placeholder — Task 13 */}
      </div>
      {editor.selectedScript && (
        <EditorActionBar
          isDirty={editor.isDirty}
          saving={editor.saving}
          hasDraft={editor.hasDraft}
          publishing={editor.publishing}
          onSaveDraft={editor.saveDraftAction}
          onPublish={handlePublish}
          onDiscard={handleDiscard}
          selectedScript={editor.selectedScript}
        />
      )}
    </div>
  );
}
