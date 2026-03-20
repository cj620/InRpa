import React, { useState, useEffect, useCallback, useRef } from "react";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import ScriptList from "./components/ScriptList";
import LogPanel from "./components/LogPanel";
import FilesPanel from "./components/FilesPanel";
import SettingsPanel from "./components/SettingsPanel";
import EditorPage from "./components/editor/EditorPage";
import StatusBar from "./components/StatusBar";
import { ToastContainer } from "./components/Toast";
import { fetchScripts, runScript, stopScript } from "./api";
import { useWebSocket } from "./hooks/useWebSocket";
import "./App.css";

export default function App() {
  const [scripts, setScripts] = useState([]);
  const [selectedScript, setSelectedScript] = useState(null);
  const [activePage, setActivePage] = useState("scripts");
  const { connected, logs, statuses, clearLogs } = useWebSocket();
  // Track which pages have been visited so we mount them once and keep them alive
  const [mountedPages, setMountedPages] = useState({ scripts: true });
  const editorOpenScriptRef = useRef(null);

  // Ensure a page gets mounted when navigated to (and stays mounted)
  const handlePageChange = useCallback((page) => {
    setActivePage(page);
    setMountedPages((prev) => (prev[page] ? prev : { ...prev, [page]: true }));
  }, []);

  // Navigate to editor with a specific script pre-selected
  const handleEditScript = useCallback((scriptName) => {
    editorOpenScriptRef.current = scriptName;
    handlePageChange("editor");
  }, [handlePageChange]);

  const loadScripts = useCallback(async () => {
    try {
      const data = await fetchScripts();
      setScripts(data);
    } catch (err) {
      console.error("Failed to fetch scripts:", err);
    }
  }, []);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  const handleRun = async () => {
    if (!selectedScript) return;
    try {
      clearLogs(selectedScript);
      await runScript(selectedScript);
    } catch (err) {
      console.error("Failed to run script:", err);
    }
  };

  const handleStop = async () => {
    if (!selectedScript) return;
    try {
      await stopScript(selectedScript);
    } catch (err) {
      console.error("Failed to stop script:", err);
    }
  };

  const handleClearLogs = () => {
    if (selectedScript) clearLogs(selectedScript);
  };

  return (
    <div className="app">
      <ToastContainer />
      <TitleBar />
      <div className="app-body">
        <Sidebar activePage={activePage} onPageChange={handlePageChange} />
        {/* Scripts page — always mounted */}
        <div className="app-page" style={{ display: activePage === "scripts" ? "contents" : "none" }}>
          <ScriptList
            scripts={scripts}
            statuses={statuses}
            selectedScript={selectedScript}
            onSelect={setSelectedScript}
            onRefresh={loadScripts}
            onEdit={handleEditScript}
          />
          <LogPanel
            scriptName={selectedScript}
            logs={selectedScript ? logs[selectedScript] : []}
            status={selectedScript ? statuses[selectedScript] : null}
            onRun={handleRun}
            onStop={handleStop}
            onClearLogs={handleClearLogs}
          />
        </div>
        {/* Files page */}
        {mountedPages.files && (
          <div className="app-page" style={{ display: activePage === "files" ? "contents" : "none" }}>
            <FilesPanel scripts={scripts} onEdit={handleEditScript} />
          </div>
        )}
        {/* Editor page — stays mounted once visited, preserves state */}
        {mountedPages.editor && (
          <div className="app-page" style={{ display: activePage === "editor" ? "contents" : "none" }}>
            <EditorPage
              scripts={scripts}
              logs={logs}
              statuses={statuses}
              openScriptRef={editorOpenScriptRef}
            />
          </div>
        )}
        {/* Settings page */}
        {mountedPages.settings && (
          <div className="app-page" style={{ display: activePage === "settings" ? "contents" : "none" }}>
            <SettingsPanel />
          </div>
        )}
      </div>
      <StatusBar
        connected={connected}
        scripts={scripts}
        statuses={statuses}
      />
    </div>
  );
}
