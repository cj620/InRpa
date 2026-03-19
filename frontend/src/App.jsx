import React, { useState, useEffect, useCallback } from "react";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import ScriptList from "./components/ScriptList";
import LogPanel from "./components/LogPanel";
import FilesPanel from "./components/FilesPanel";
import SettingsPanel from "./components/SettingsPanel";
import StatusBar from "./components/StatusBar";
import { fetchScripts, runScript, stopScript } from "./api";
import { useWebSocket } from "./hooks/useWebSocket";
import "./App.css";

export default function App() {
  const [scripts, setScripts] = useState([]);
  const [selectedScript, setSelectedScript] = useState(null);
  const [activePage, setActivePage] = useState("scripts");
  const { connected, logs, statuses, clearLogs } = useWebSocket();

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
      <TitleBar />
      <div className="app-body">
        <Sidebar activePage={activePage} onPageChange={setActivePage} />
        {activePage === "scripts" && (
          <>
            <ScriptList
              scripts={scripts}
              statuses={statuses}
              selectedScript={selectedScript}
              onSelect={setSelectedScript}
              onRefresh={loadScripts}
            />
            <LogPanel
              scriptName={selectedScript}
              logs={selectedScript ? logs[selectedScript] : []}
              status={selectedScript ? statuses[selectedScript] : null}
              onRun={handleRun}
              onStop={handleStop}
              onClearLogs={handleClearLogs}
            />
          </>
        )}
        {activePage === "files" && <FilesPanel scripts={scripts} />}
        {activePage === "settings" && <SettingsPanel />}
      </div>
      <StatusBar
        connected={connected}
        scripts={scripts}
        statuses={statuses}
      />
    </div>
  );
}
