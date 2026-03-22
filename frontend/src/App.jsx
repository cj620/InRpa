import React, { useState, useEffect, useCallback, useRef } from "react";
import TitleBar from "./components/TitleBar";

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
import Sidebar from "./components/Sidebar";
import ScriptList from "./components/ScriptList";
import FolderTree from "./components/FolderTree";
import LogPanel from "./components/LogPanel";
import FilesPanel from "./components/FilesPanel";
import SettingsPanel from "./components/SettingsPanel";
import EditorPage from "./components/editor/EditorPage";
import StatusBar from "./components/StatusBar";
import { ToastContainer } from "./components/Toast";
import MoveToDialog from "./components/MoveToDialog";
import EditTagsDialog from "./components/EditTagsDialog";
import CreateScriptDialog from "./components/CreateScriptDialog";
import MarketPage from "./components/MarketPage";
import {
  fetchFolders,
  fetchScripts,
  runScript, stopScript, runDraft, stopDraft,
  fetchSettings, updateSettings,
  createFolder, renameFolder, deleteFolder,
  moveScriptToFolder, updateScriptMeta,
  syncScripts,
  setCloudUrl,
  createScript,
} from "./api";
import { useWebSocket } from "./hooks/useWebSocket";
import { SettingsProvider } from "./contexts/SettingsContext";
import "./App.css";

export default function App() {
  // ── Folder + script data ────────────────────────────────
  const [folders, setFolders] = useState([]);          // [{name, icon, scripts:[]}]
  const [allScripts, setAllScripts] = useState([]);    // flat list for editor/files
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [folderTreeCollapsed, setFolderTreeCollapsed] = useState(false);

  // ── Selection & navigation ──────────────────────────────
  const [selectedScript, setSelectedScript] = useState(null); // script.name
  const [activePage, setActivePage] = useState("scripts");
  const [mountedPages, setMountedPages] = useState({ scripts: true });
  const editorOpenScriptRef = useRef(null);

  // ── Theme ───────────────────────────────────────────────
  const [theme, setTheme] = useState("dark");

  // ── Dialogs ─────────────────────────────────────────────
  const [moveDialog, setMoveDialog] = useState(null);   // { scripts: [script] }
  const [tagsDialog, setTagsDialog] = useState(null);   // { script }
  const [descDialog, setDescDialog] = useState(null);   // { script }
  const [createScriptDialog, setCreateScriptDialog] = useState(null); // null or folders list

  // ── Drag state ──────────────────────────────────────────
  const [draggingScript, setDraggingScript] = useState(null);

  // ── WebSocket ───────────────────────────────────────────
  const { connected, logs, statuses, clearLogs } = useWebSocket();

  // ── Sync ────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState("idle"); // "idle"|"syncing"|"ok"|"offline"
  const [syncMessage, setSyncMessage] = useState("");

  // ── Derived: all unique tags ────────────────────────────
  const allTags = React.useMemo(() => {
    const tagSet = new Set();
    for (const folder of folders) {
      for (const s of folder.scripts || []) {
        if (Array.isArray(s.tags)) s.tags.forEach((t) => tagSet.add(t));
      }
    }
    return Array.from(tagSet).sort();
  }, [folders]);

  // ── Theme ───────────────────────────────────────────────
  useEffect(() => {
    if (theme === "dark") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  useEffect(() => {
    fetchSettings().then(async (data) => {
      if (data?.theme) setTheme(data.theme);

      const cloudUrl = data?.cloud_url || "http://localhost:8000";
      setCloudUrl(cloudUrl);

      // Sync scripts from cloud at startup
      setSyncStatus("syncing");
      try {
        const result = await syncScripts(cloudUrl);
        if (result.using_cache) {
          setSyncStatus("offline");
          setSyncMessage("云端不可达，使用本地缓存");
        } else {
          setSyncStatus("ok");
          setSyncMessage(`已同步 ${result.synced}/${result.total} 个脚本`);
        }
      } catch {
        setSyncStatus("offline");
        setSyncMessage("同步失败，使用本地缓存");
      }

      // Reload script list after sync
      loadFolders();
    }).catch(() => {
      setSyncStatus("offline");
      setSyncMessage("本地服务不可达");
    });
  }, []);

  const handleThemeChange = useCallback((newTheme) => {
    setTheme(newTheme);
    updateSettings({ theme: newTheme }).catch((err) =>
      console.error("Failed to save theme:", err)
    );
  }, []);

  // ── Page navigation ─────────────────────────────────────
  const handlePageChange = useCallback((page) => {
    setActivePage(page);
    setMountedPages((prev) => (prev[page] ? prev : { ...prev, [page]: true }));
  }, []);

  const handleEditScript = useCallback((scriptName) => {
    editorOpenScriptRef.current = scriptName;
    handlePageChange("editor");
  }, [handlePageChange]);

  // ── Data loading ────────────────────────────────────────
  const loadFolders = useCallback(async () => {
    try {
      const data = await fetchFolders();
      setFolders(data);
    } catch (err) {
      console.error("Failed to fetch folders:", err);
    }
  }, []);

  const loadScripts = useCallback(async () => {
    try {
      const data = await fetchScripts();
      setAllScripts(data);
    } catch (err) {
      console.error("Failed to fetch scripts:", err);
    }
  }, []);

  useEffect(() => {
    loadFolders();
    loadScripts();
  }, [loadFolders, loadScripts]);

  // ── Run / Stop ──────────────────────────────────────────
  const handleRun = async () => {
    if (!selectedScript) return;
    try {
      clearLogs(selectedScript);
      if (selectedScript.endsWith("_draft")) {
        const parentName = selectedScript.slice(0, -6);
        await runDraft(parentName);
      } else {
        await runScript(selectedScript);
      }
    } catch (err) {
      console.error("Failed to run script:", err);
    }
  };

  const handleStop = async () => {
    if (!selectedScript) return;
    try {
      if (selectedScript.endsWith("_draft")) {
        const parentName = selectedScript.slice(0, -6);
        await stopDraft(parentName);
      } else {
        await stopScript(selectedScript);
      }
    } catch (err) {
      console.error("Failed to stop script:", err);
    }
  };

  const handleClearLogs = () => {
    if (selectedScript) clearLogs(selectedScript);
  };

  // ── Folder CRUD ─────────────────────────────────────────
  const handleCreateFolder = useCallback(async (name) => {
    try {
      await createFolder(name);
      await loadFolders();
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  }, [loadFolders]);

  const handleRenameFolder = useCallback(async (oldName, newName) => {
    try {
      await renameFolder(oldName, newName);
      if (selectedFolder === oldName) setSelectedFolder(newName);
      await loadFolders();
    } catch (err) {
      console.error("Failed to rename folder:", err);
    }
  }, [loadFolders, selectedFolder]);

  const handleDeleteFolder = useCallback(async (name) => {
    try {
      await deleteFolder(name);
      if (selectedFolder === name) setSelectedFolder("all");
      await loadFolders();
    } catch (err) {
      console.error("Failed to delete folder:", err);
    }
  }, [loadFolders, selectedFolder]);

  // ── Script actions (from context menu) ──────────────────
  const handleScriptAction = useCallback((action, script) => {
    if (action === "move") {
      setMoveDialog({ scripts: [script] });
    } else if (action === "editTags") {
      setTagsDialog({ script });
    } else if (action === "editDescription") {
      setDescDialog({ script });
    }
  }, []);

  // ── Batch action ─────────────────────────────────────────
  const handleBatchAction = useCallback((action, scripts) => {
    if (action === "move") {
      setMoveDialog({ scripts });
    }
  }, []);

  // ── Move dialog confirm ──────────────────────────────────
  const handleMoveConfirm = useCallback(async (targetFolder) => {
    if (!moveDialog) return;
    try {
      await Promise.all(
        moveDialog.scripts.map((s) =>
          moveScriptToFolder(s.name, targetFolder === "_unsorted" ? null : targetFolder)
        )
      );
      await loadFolders();
    } catch (err) {
      console.error("Failed to move scripts:", err);
    }
    setMoveDialog(null);
  }, [moveDialog, loadFolders]);

  // ── Tags dialog confirm ──────────────────────────────────
  const handleTagsSave = useCallback(async (script, tags) => {
    try {
      await updateScriptMeta(script.name, { tags });
      await loadFolders();
      await loadScripts();
    } catch (err) {
      console.error("Failed to update tags:", err);
    }
    setTagsDialog(null);
  }, [loadFolders, loadScripts]);

  // ── Description dialog confirm ───────────────────────────
  const handleDescSave = useCallback(async (script, description) => {
    try {
      await updateScriptMeta(script.name, { description });
      await loadFolders();
      await loadScripts();
    } catch (err) {
      console.error("Failed to update description:", err);
    }
    setDescDialog(null);
  }, [loadFolders, loadScripts]);

  const handleCreateScript = useCallback(async (name, folder) => {
    try {
      await createScript(name, folder);
      await loadFolders();
      setSelectedScript(name);
      handleEditScript(name);
    } catch (err) {
      console.error("Failed to create script:", err);
    }
    setCreateScriptDialog(null);
  }, [loadFolders, handleEditScript]);

  // ── Drag & drop ──────────────────────────────────────────
  const handleDragStart = useCallback((script) => {
    setDraggingScript(script);
  }, []);

  const handleFolderDrop = useCallback(async (folderName) => {
    if (!draggingScript) return;
    try {
      await moveScriptToFolder(
        draggingScript.name,
        folderName === "_unsorted" ? null : folderName
      );
      await loadFolders();
    } catch (err) {
      console.error("Failed to move script:", err);
    }
    setDraggingScript(null);
  }, [draggingScript, loadFolders]);

  return (
    <SettingsProvider>
      <div className="app">
        <ToastContainer />
        <TitleBar isMac={isMac} />
        <div className="app-body">
          <Sidebar
            activePage={activePage}
            onPageChange={handlePageChange}
            theme={theme}
            onThemeChange={handleThemeChange}
          />

          {/* Scripts page: ScriptList | LogPanel */}
          <div className="app-page" style={{ display: activePage === "scripts" ? "contents" : "none" }}>
            <ScriptList
              folders={folders}
              tags={allTags}
              selectedFolder={selectedFolder}
              statuses={statuses}
              selectedScript={selectedScript}
              onSelect={setSelectedScript}
              onRefresh={loadFolders}
              onEdit={handleEditScript}
              onTagClick={(tag) => {/* ScriptList handles tag filter internally */}}
              onScriptAction={handleScriptAction}
              onDragStart={handleDragStart}
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

          {/* Files page: FolderTree | FilesPanel */}
          {mountedPages.files && (
            <div className="app-page" style={{ display: activePage === "files" ? "contents" : "none" }}>
              <FolderTree
                folders={folders}
                selectedFolder={selectedFolder}
                onSelectFolder={setSelectedFolder}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                collapsed={folderTreeCollapsed}
                onToggleCollapse={() => setFolderTreeCollapsed((v) => !v)}
                draggingScript={null}
                onFolderDrop={null}
                onCreateScript={() => setCreateScriptDialog(folders)}
              />
              <FilesPanel
                folders={folders}
                selectedFolder={selectedFolder}
                onEdit={handleEditScript}
                onRefresh={loadFolders}
              />
            </div>
          )}

          {/* Editor page */}
          {mountedPages.editor && (
            <div className="app-page" style={{ display: activePage === "editor" ? "contents" : "none" }}>
              <EditorPage
                scripts={allScripts}
                logs={logs}
                statuses={statuses}
                openScriptRef={editorOpenScriptRef}
              />
            </div>
          )}

          {/* Market page */}
          {mountedPages.market && (
            <div className="app-page" style={{ display: activePage === "market" ? "flex" : "none", flex: 1, overflow: "hidden" }}>
              <MarketPage />
            </div>
          )}

          {/* Settings page */}
          {mountedPages.settings && (
            <div className="app-page" style={{ display: activePage === "settings" ? "contents" : "none" }}>
              <SettingsPanel theme={theme} onThemeChange={handleThemeChange} />
            </div>
          )}
        </div>

        <StatusBar
          connected={connected}
          scripts={allScripts}
          statuses={statuses}
          onNavigate={handlePageChange}
          syncStatus={syncStatus}
          syncMessage={syncMessage}
        />

        {/* Move-to-folder dialog */}
        {moveDialog && (
          <MoveToDialog
            folders={folders}
            scriptCount={moveDialog.scripts.length}
            onConfirm={handleMoveConfirm}
            onCancel={() => setMoveDialog(null)}
          />
        )}

        {/* Edit tags dialog */}
        {tagsDialog && (
          <EditTagsDialog
            script={tagsDialog.script}
            allTags={allTags}
            onSave={(tags) => handleTagsSave(tagsDialog.script, tags)}
            onCancel={() => setTagsDialog(null)}
          />
        )}

        {/* Edit description (inline via tagsDialog reuse) */}
        {descDialog && (
          <EditTagsDialog
            script={descDialog.script}
            mode="description"
            onSave={(desc) => handleDescSave(descDialog.script, desc)}
            onCancel={() => setDescDialog(null)}
          />
        )}

        {/* Create script dialog */}
        {createScriptDialog && (
          <CreateScriptDialog
            folders={createScriptDialog}
            onConfirm={handleCreateScript}
            onCancel={() => setCreateScriptDialog(null)}
          />
        )}
      </div>
    </SettingsProvider>
  );
}
