import React, { useState, useCallback, useEffect, useRef } from "react";
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
import ConfirmDialog from "../ConfirmDialog";
import { toast } from "../Toast";
import "./EditorPage.css";

export default function EditorPage({ scripts, logs, statuses, openScriptRef }) {
  const editor = useEditor();
  const draftRunner = useDraftRunner(editor.selectedScript, logs, statuses);
  const aiChat = useAIChat();
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("ai");
  const [confirmAction, setConfirmAction] = useState(null);
  const pendingSwitchRef = useRef(null);

  // Handle external script open requests (e.g. from ScriptList edit button)
  useEffect(() => {
    if (openScriptRef?.current) {
      const name = openScriptRef.current;
      openScriptRef.current = null;
      if (name !== editor.selectedScript) {
        editor.loadScript(name);
      }
    }
  });

  const handleSelectScript = (name) => {
    if (name === editor.selectedScript) return;

    if (editor.isDirty) {
      pendingSwitchRef.current = name;
      setConfirmAction({
        title: "未保存的修改",
        message: "当前草稿有未保存的修改，是否保存后再切换？",
        confirmText: "保存并切换",
        cancelText: "取消",
        confirmVariant: "primary",
        extraAction: {
          text: "放弃修改",
          variant: "danger",
          onClick: () => {
            setConfirmAction(null);
            const target = pendingSwitchRef.current;
            pendingSwitchRef.current = null;
            editor.loadScript(target);
          },
        },
        onConfirm: async () => {
          setConfirmAction(null);
          const target = pendingSwitchRef.current;
          pendingSwitchRef.current = null;
          try {
            await editor.saveDraftAction();
            toast.success("草稿已保存");
          } catch {
            toast.error("保存失败");
          }
          editor.loadScript(target);
        },
        onCancel: () => {
          pendingSwitchRef.current = null;
          setConfirmAction(null);
        },
      });
      return;
    }

    editor.loadScript(name);
  };

  const handlePublish = () => {
    setConfirmAction({
      title: "发布到正式版",
      message: "将草稿覆盖正式版脚本，此操作不可撤销。",
      confirmText: "发布",
      cancelText: "取消",
      confirmVariant: "primary",
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await editor.publishAction();
          toast.success("已发布到正式版");
        } catch {
          toast.error("发布失败");
        }
      },
      onCancel: () => setConfirmAction(null),
    });
  };

  const handleDiscard = () => {
    setConfirmAction({
      title: "放弃草稿",
      message: "将删除当前草稿并恢复到正式版代码，此操作不可撤销。",
      confirmText: "放弃草稿",
      cancelText: "取消",
      confirmVariant: "danger",
      onConfirm: async () => {
        setConfirmAction(null);
        await editor.discardDraft();
        toast.info("已恢复到正式版");
      },
      onCancel: () => setConfirmAction(null),
    });
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S — save draft
      if (e.ctrlKey && !e.shiftKey && e.key === "s") {
        e.preventDefault();
        if (editor.selectedScript && editor.isDirty) {
          editor.saveDraftAction()
            .then(() => toast.success("草稿已保存"))
            .catch(() => toast.error("保存失败"));
        }
      }
      // Ctrl+Shift+A — toggle AI panel
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        setPanelOpen((prev) => !prev);
        setActiveTab("ai");
      }
      // Ctrl+Shift+L — toggle test log panel
      if (e.ctrlKey && e.shiftKey && e.key === "L") {
        e.preventDefault();
        setPanelOpen((prev) => !prev);
        setActiveTab("logs");
      }
      // Ctrl+D — toggle diff view
      if (e.ctrlKey && !e.shiftKey && e.key === "d") {
        e.preventDefault();
        editor.toggleDiff();
      }
      // Ctrl+Enter — test run
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        if (editor.selectedScript) {
          draftRunner.runTest();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor, draftRunner]);

  useEffect(() => {
    if (!aiChat.lastValidationFailure) return;
    toast.error(
      aiChat.lastValidationFailure.message ||
      "AI 生成失败：检测到未允许依赖，已改写一次但仍不符合当前环境。请改用 Playwright 方案。"
    );
  }, [aiChat.lastValidationFailure]);

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
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          cancelText={confirmAction.cancelText}
          confirmVariant={confirmAction.confirmVariant}
          extraAction={confirmAction.extraAction}
          onConfirm={confirmAction.onConfirm}
          onCancel={confirmAction.onCancel}
        />
      )}
    </div>
  );
}
