import React, { useState, useCallback } from "react";
import { useEditor } from "../../hooks/useEditor";
import { useDraftRunner } from "../../hooks/useDraftRunner";
import { useAIChat } from "../../hooks/useAIChat";
import EditorToolbar from "./EditorToolbar";
import EditorMain from "./EditorMain";
import EditorActionBar from "./EditorActionBar";
import EmptyState from "./EmptyState";
import SidePanel from "./SidePanel";
import AIChatPanel from "./AIChatPanel";
import TestLogPanel from "./TestLogPanel";
import "./EditorPage.css";

export default function EditorPage({ scripts, logs, statuses }) {
  const editor = useEditor();
  const draftRunner = useDraftRunner(editor.selectedScript, logs, statuses);
  const aiChat = useAIChat();
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("ai");

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

  const handleSendMessage = useCallback((text) => {
    aiChat.sendMessage(editor.draftCode, text);
  }, [aiChat, editor.draftCode]);

  const handleApplyCode = useCallback((code) => {
    editor.updateCode(code);
  }, [editor]);

  const handleTogglePanel = useCallback(() => {
    setPanelOpen((prev) => !prev);
  }, []);

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
        panelOpen={panelOpen}
        onTogglePanel={handleTogglePanel}
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
        <SidePanel
          isOpen={panelOpen}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onToggle={handleTogglePanel}
        >
          {activeTab === "ai" ? (
            <AIChatPanel
              messages={aiChat.messages}
              isStreaming={aiChat.isStreaming}
              error={aiChat.error}
              onSendMessage={handleSendMessage}
              onApplyCode={handleApplyCode}
            />
          ) : (
            <TestLogPanel
              status={draftRunner.status}
              logs={draftRunner.logs}
            />
          )}
        </SidePanel>
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
