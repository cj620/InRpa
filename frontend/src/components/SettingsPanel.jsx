import React, { useState, useEffect, useRef } from "react";
import { testAIConnection } from "../api";
import { useSettings } from "../contexts/SettingsContext";
import "./SettingsPanel.css";

const PROVIDER_DEFAULTS = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
};

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "custom", label: "自定义" },
];

function deepEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => deepEqual(a[k], b[k]));
}

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="sp-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function RefreshIcon({ spinning }) {
  return (
    <svg
      className={spinning ? "sp-refresh-icon--spinning" : ""}
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function EnvDot({ status }) {
  if (status === "checking") {
    return <span className="sp-env-dot sp-env-dot--checking"><SpinnerIcon /></span>;
  }
  if (status === "ok") {
    return <span className="sp-env-dot sp-env-dot--ok"><CheckIcon /></span>;
  }
  if (status === "error") {
    return <span className="sp-env-dot sp-env-dot--err"><XIcon /></span>;
  }
  return <span className="sp-env-dot sp-env-dot--idle" />;
}

function CustomSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`sp-select ${open ? "sp-select--open" : ""}`} ref={ref}>
      <button
        type="button"
        className="sp-select-trigger"
        onClick={() => setOpen(!open)}
      >
        <span>{selected?.label || value}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="sp-select-dropdown">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`sp-select-option ${opt.value === value ? "sp-select-option--active" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`sp-toggle ${checked ? "sp-toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="sp-toggle-circle" />
    </button>
  );
}

export default function SettingsPanel({ theme, onThemeChange }) {
  const { settings: contextSettings, loading: contextLoading, updateSettings: contextUpdateSettings } = useSettings();
  const [settings, setSettings] = useState(null);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [cloudUrl, setCloudUrl] = useState("http://localhost:8000");
  const [showKey, setShowKey] = useState(false);
  const [testState, setTestState] = useState(null); // null | "loading" | "success" | "error"
  const [testMsg, setTestMsg] = useState("");
  const [toast, setToast] = useState(false);
  const [envStatus, setEnvStatus] = useState({
    python:   { status: "idle" },    // idle | checking | ok | error
    node:     { status: "idle" },
    venv:     { status: "idle" },
    playwright: { status: "idle" },
    cloudBackend: { status: "idle" },
    aiApi:    { status: "idle" },
  });

  const dirty = settings && original && !deepEqual(settings, original);

  useEffect(() => {
    if (contextSettings && !original) {
      setSettings({ ...contextSettings });
      setOriginal({ ...contextSettings });
      setCloudUrl(contextSettings?.cloud_url || "http://localhost:8000");
    }
  }, [contextSettings, original]);

  useEffect(() => {
    if (!window.electronAPI?.checkEnv) return;
    // Set all to checking
    setEnvStatus({
      python: { status: "checking" },
      node: { status: "checking" },
      venv: { status: "checking" },
      playwright: { status: "checking" },
      cloudBackend: { status: "checking" },
      aiApi: { status: "idle" }, // AI API requires manual trigger
    });
    window.electronAPI.checkEnv().then((results) => {
      setEnvStatus({
        python:   { status: results.python?.ok ? "ok" : "error",   version: results.python?.version,   error: results.python?.error },
        node:     { status: results.node?.ok ? "ok" : "error",     version: results.node?.version,     error: results.node?.error },
        venv:     { status: results.venv?.ok ? "ok" : "error",     error: results.venv?.error },
        playwright: { status: results.playwright?.ok ? "ok" : "error", version: results.playwright?.version, chromium: results.playwright?.chromium, error: results.playwright?.error },
        cloudBackend: { status: results.cloudBackend?.ok ? "ok" : "error", statusCode: results.cloudBackend?.status, error: results.cloudBackend?.error },
        aiApi: { status: "idle" },
      });
    }).catch(() => {
      setEnvStatus({
        python:   { status: "error", error: "检查失败" },
        node:     { status: "error", error: "检查失败" },
        venv:     { status: "error", error: "检查失败" },
        playwright: { status: "error", error: "检查失败" },
        cloudBackend: { status: "error", error: "检查失败" },
        aiApi:    { status: "idle" },
      });
    });
  }, []);

  if ((contextLoading && !settings) || !settings) {
    return (
      <div className="settings-panel">
        <div className="sp-loading">加载设置中...</div>
      </div>
    );
  }

  const updateAI = (key, value) => {
    setSettings((s) => ({ ...s, ai: { ...s.ai, [key]: value } }));
  };

  const updateEditor = (key, value) => {
    setSettings((s) => ({ ...s, editor: { ...s.editor, [key]: value } }));
  };

  const handleProviderChange = (provider) => {
    const updates = { provider };
    if (PROVIDER_DEFAULTS[provider]) {
      updates.api_url = PROVIDER_DEFAULTS[provider];
    }
    setSettings((s) => ({ ...s, ai: { ...s.ai, ...updates } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await contextUpdateSettings({ ...settings, cloud_url: cloudUrl });
      setSettings(data);
      setOriginal(data);
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({ ...original });
  };

  const handleTestConnection = async () => {
    setTestState("loading");
    setTestMsg("");
    try {
      // Send current form values directly — no need to save first
      await testAIConnection({
        provider: settings.ai.provider,
        api_url: settings.ai.api_url,
        api_key: settings.ai.api_key,
        model: settings.ai.model,
      });
      setTestState("success");
      setTestMsg("连接成功");
    } catch (err) {
      setTestState("error");
      setTestMsg(err.message || "连接失败");
    }
    setTimeout(() => {
      setTestState(null);
      setTestMsg("");
    }, 4000);
  };

  
  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <h3>设置</h3>
      </div>
      <div className="settings-panel-content">
        {/* Card 0: Cloud Service */}
        <div className="sp-card">
          <div className="sp-card-header">云端服务</div>
          <div className="sp-field">
            <label className="sp-label">云端后端地址</label>
            <input
              className="sp-input sp-input--mono"
              type="text"
              value={cloudUrl}
              onChange={(e) => setCloudUrl(e.target.value)}
              placeholder="http://localhost:8000"
              spellCheck={false}
            />
            <p className="sp-hint">开发环境填 http://localhost:8000，生产填云服务器地址</p>
          </div>
        </div>

        {/* Card 1: AI Model Config */}
        <div className="sp-card">
          <div className="sp-card-header">AI 模型配置</div>
          <div className="sp-field">
            <label className="sp-label">服务商</label>
            <CustomSelect
              value={settings.ai.provider}
              options={PROVIDERS}
              onChange={handleProviderChange}
            />
          </div>
          <div className="sp-field">
            <label className="sp-label">API 地址</label>
            <input
              type="text"
              className="sp-input sp-input--mono"
              value={settings.ai.api_url}
              onChange={(e) => updateAI("api_url", e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="sp-field">
            <label className="sp-label">API Key</label>
            <div className="sp-input-group">
              <input
                type={showKey ? "text" : "password"}
                className="sp-input sp-input--mono sp-input--with-btn"
                value={settings.ai.api_key}
                onChange={(e) => updateAI("api_key", e.target.value)}
                placeholder="sk-..."
              />
              <button
                type="button"
                className="sp-input-eye"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? "隐藏" : "显示"}
              >
                <EyeIcon open={showKey} />
              </button>
            </div>
          </div>
          <div className="sp-field">
            <label className="sp-label">模型</label>
            <input
              type="text"
              className="sp-input"
              value={settings.ai.model}
              onChange={(e) => updateAI("model", e.target.value)}
              placeholder="gpt-4o"
            />
          </div>
          <div className="sp-field sp-field--action">
            <button
              type="button"
              className={`sp-btn-test ${testState === "loading" ? "sp-btn-test--loading" : ""}`}
              onClick={handleTestConnection}
              disabled={testState === "loading"}
            >
              {testState === "loading" && <SpinnerIcon />}
              {testState === null && "测试连接"}
              {testState === "loading" && "测试中..."}
              {testState === "success" && (
                <span className="sp-test-result sp-test-result--success">
                  <CheckIcon /> {testMsg}
                </span>
              )}
              {testState === "error" && (
                <span className="sp-test-result sp-test-result--error">
                  <XIcon /> {testMsg}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: Editor Settings */}
        <div className="sp-card">
          <div className="sp-card-header">编辑器设置</div>
          <div className="sp-field sp-field--row">
            <label className="sp-label">字体大小</label>
            <input
              type="number"
              className="sp-input sp-input--short"
              value={settings.editor.font_size}
              onChange={(e) => updateEditor("font_size", Math.min(24, Math.max(10, parseInt(e.target.value) || 10)))}
              min={10}
              max={24}
              step={1}
            />
          </div>
          <div className="sp-field sp-field--row">
            <label className="sp-label">Tab 宽度</label>
            <input
              type="number"
              className="sp-input sp-input--short"
              value={settings.editor.tab_size}
              onChange={(e) => updateEditor("tab_size", Math.min(8, Math.max(2, parseInt(e.target.value) || 2)))}
              min={2}
              max={8}
              step={2}
            />
          </div>
          <div className="sp-field sp-field--row">
            <label className="sp-label">自动换行</label>
            <ToggleSwitch
              checked={settings.editor.word_wrap}
              onChange={(val) => updateEditor("word_wrap", val)}
            />
          </div>
        </div>

        {/* Card 3: General Settings */}
        <div className="sp-card">
          <div className="sp-card-header">通用设置</div>
          {/* Theme selector */}
          <div className="sp-field sp-field--row">
            <label className="sp-label">主题</label>
            <div className="sp-theme-selector">
              <button
                type="button"
                className={`sp-theme-option ${theme === "dark" ? "sp-theme-option--active" : ""}`}
                onClick={() => onThemeChange("dark")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                暗黑
              </button>
              <button
                type="button"
                className={`sp-theme-option ${theme === "light" ? "sp-theme-option--active" : ""}`}
                onClick={() => onThemeChange("light")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                明亮
              </button>
              <button
                type="button"
                className={`sp-theme-option ${theme === "cream" ? "sp-theme-option--active" : ""}`}
                onClick={() => onThemeChange("cream")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><line x1="6" y1="2" x2="6" y2="4" /><line x1="10" y1="2" x2="10" y2="4" /><line x1="14" y1="2" x2="14" y2="4" />
                </svg>
                奶油
              </button>
            </div>
          </div>
          <div className="sp-field sp-field--row">
            <label className="sp-label">
              <FolderIcon />
              <span>脚本目录</span>
            </label>
            <span className="sp-readonly">{settings.scripts_dir || "./scripts"}</span>
          </div>
          <div className="sp-field sp-field--row">
            <label className="sp-label">后端端口</label>
            <span className="sp-readonly">8000</span>
          </div>
          <div className="sp-field sp-field--row">
            <label className="sp-label">版本</label>
            <span className="sp-readonly">1.0.0</span>
          </div>
        </div>

        {/* Card 4: Runtime Environment */}
        <div className="sp-card">
          <div className="sp-card-header">运行环境</div>
          {[
            { key: "python",       label: "Python",        getValue: (s) => s.python.status === "ok" ? s.python.version : null },
            { key: "node",         label: "Node.js",        getValue: (s) => s.node.status === "ok" ? s.node.version : null },
            { key: "venv",         label: ".venv",          getValue: (s) => s.venv.status === "ok" ? "正常" : null },
            { key: "playwright",   label: "Playwright",     getValue: (s) => s.playwright.status === "ok" ? s.playwright.version : null, extra: (s) => s.playwright.status === "ok" ? s.playwright.chromium : null },
            { key: "cloudBackend", label: "云端后端",        getValue: (s) => s.cloudBackend.status === "ok" ? `HTTP ${s.cloudBackend.statusCode}` : null },
            { key: "aiApi",        label: "AI API",         getValue: (s) => s.aiApi.status === "ok" ? "正常" : null },
          ].map(({ key, label, getValue, extra }) => {
            const s = envStatus[key];
            const value = getValue(envStatus);
            return (
              <div key={key} className="sp-field sp-field--row">
                <span className="sp-label">{label}</span>
                <span className={`sp-readonly ${s.status === "error" ? "sp-readonly--err" : ""}`}>
                  <EnvDot status={s.status} />
                  {s.status === "checking" && "检测中..."}
                  {s.status === "idle" && (value || "—")}
                  {s.status === "ok" && (value || "正常")}
                  {s.status === "error" && (s.error || "错误")}
                  {extra && s.status === "ok" && <span className="sp-readonly-extra"> · {extra(envStatus)}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating action bar */}
      <div className={`sp-action-bar ${dirty ? "sp-action-bar--visible" : ""}`}>
        <button
          type="button"
          className="sp-btn sp-btn--subtle"
          onClick={handleReset}
          disabled={saving}
        >
          重置
        </button>
        <button
          type="button"
          className="sp-btn sp-btn--accent"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      {/* Toast */}
      <div className={`sp-toast ${toast ? "sp-toast--visible" : ""}`}>
        <CheckIcon /> 设置已保存
      </div>
    </div>
  );
}
