import React from "react";
import "./SettingsPanel.css";

export default function SettingsPanel() {
  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <h3>Settings</h3>
      </div>
      <div className="settings-panel-content">
        <div className="settings-section">
          <h4>General</h4>
          <div className="settings-item">
            <span className="settings-label">Scripts Directory</span>
            <span className="settings-value">./scripts</span>
          </div>
          <div className="settings-item">
            <span className="settings-label">Backend Port</span>
            <span className="settings-value">8000</span>
          </div>
        </div>
        <div className="settings-section">
          <h4>About</h4>
          <div className="settings-item">
            <span className="settings-label">Version</span>
            <span className="settings-value">1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
