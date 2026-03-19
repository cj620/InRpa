import React from "react";
import "./FilesPanel.css";

export default function FilesPanel({ scripts }) {
  return (
    <div className="files-panel">
      <div className="files-panel-header">
        <h3>Script Files</h3>
      </div>
      <div className="files-panel-content">
        {scripts.length === 0 ? (
          <div className="files-empty">No scripts found in scripts/ directory</div>
        ) : (
          <table className="files-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((s) => (
                <tr key={s.name}>
                  <td className="files-name">{s.name}.py</td>
                  <td className="files-size">{(s.size / 1024).toFixed(1)} KB</td>
                  <td className="files-date">{s.modified_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
