// frontend/src/api.js
// Shim: re-exports from cloudApi and localApi.
// Management functions → cloudApi, execution/drafts/AI/settings → localApi.

export {
  fetchScripts,
  fetchFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  moveScriptToFolder,
  updateScriptMeta,
  setCloudUrl,
  getCloudUrl,
} from "./cloudApi";

export {
  syncScripts,
  runScript,
  stopScript,
  fetchScriptContent,
  fetchDraft,
  saveDraft,
  deleteDraft,
  publishDraft,
  runDraft,
  stopDraft,
  openExternal,
  fetchSettings,
  updateSettings,
  testAIConnection,
  streamAIChat,
  createScript,
} from "./localApi";
