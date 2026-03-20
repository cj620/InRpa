import React from "react";
import ScriptCard from "./ScriptCard";
import "./ScriptList.css";

export default function ScriptList({
  scripts,
  statuses,
  selectedScript,
  onSelect,
  onRefresh,
  onEdit,
}) {
  const [search, setSearch] = React.useState("");

  const filtered = scripts.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="script-list">
      <div className="script-list-header">
        <input
          className="script-list-search"
          type="text"
          placeholder="Search scripts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="script-list-refresh" onClick={onRefresh} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
      <div className="script-list-items">
        {filtered.length === 0 ? (
          <div className="script-list-empty">No scripts found</div>
        ) : (
          filtered.map((script) => (
            <ScriptCard
              key={script.name}
              script={script}
              status={statuses[script.is_draft ? script.parent_name : script.name]}
              selected={!script.is_draft && selectedScript === script.name}
              onClick={() => {
                if (script.is_draft) {
                  onEdit?.(script.parent_name);
                } else {
                  onSelect(script.name);
                }
              }}
              onEdit={onEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}
