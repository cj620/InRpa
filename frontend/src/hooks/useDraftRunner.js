import { useState, useCallback, useEffect, useRef } from "react";
import { runDraft as apiRunDraft, stopDraft as apiStopDraft } from "../api";

export function useDraftRunner(scriptName, wsLogs, wsStatuses) {
    const [status, setStatus] = useState("idle");
    const [logs, setLogs] = useState([]);
    const prevScriptRef = useRef(scriptName);

    // Reset when script changes
    useEffect(() => {
        if (scriptName !== prevScriptRef.current) {
            setStatus("idle");
            setLogs([]);
            prevScriptRef.current = scriptName;
        }
    }, [scriptName]);

    // Listen for draft-specific WebSocket messages
    useEffect(() => {
        if (!scriptName) return;
        const draftLogs = wsLogs[`draft:${scriptName}`];
        if (draftLogs) setLogs(draftLogs);
        const draftStatus = wsStatuses[`draft:${scriptName}`];
        if (draftStatus) setStatus(draftStatus);
    }, [scriptName, wsLogs, wsStatuses]);

    const runTest = useCallback(async () => {
        if (!scriptName) return;
        setLogs([]);
        setStatus("running");
        try {
            await apiRunDraft(scriptName);
        } catch (err) {
            console.error("Failed to run draft:", err);
            setStatus("failed");
        }
    }, [scriptName]);

    const stopTest = useCallback(async () => {
        if (!scriptName) return;
        try {
            await apiStopDraft(scriptName);
        } catch (err) {
            console.error("Failed to stop draft:", err);
        }
    }, [scriptName]);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    return { status, logs, runTest, stopTest, clearLogs };
}
