import { useState, useCallback } from "react";
import { fetchScriptContent, fetchDraft, saveDraft as apiSaveDraft, deleteDraft, publishDraft as apiPublishDraft } from "../api";

export function useEditor() {
    const [selectedScript, setSelectedScript] = useState(null);
    const [originalCode, setOriginalCode] = useState("");
    const [draftCode, setDraftCode] = useState("");
    const [isDirty, setIsDirty] = useState(false);
    const [hasDraft, setHasDraft] = useState(false);
    const [viewMode, setViewMode] = useState("edit"); // "edit" | "diff"
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [loading, setLoading] = useState(false);

    const loadScript = useCallback(async (name) => {
        setLoading(true);
        try {
            const { content: original } = await fetchScriptContent(name);
            setOriginalCode(original);

            const draft = await fetchDraft(name);
            if (draft) {
                setDraftCode(draft.content);
                setHasDraft(true);
            } else {
                setDraftCode(original);
                setHasDraft(false);
            }
            setSelectedScript(name);
            setIsDirty(false);
            setViewMode("edit");
        } catch (err) {
            console.error("Failed to load script:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateCode = useCallback((code) => {
        setDraftCode(code);
        setIsDirty(true);
    }, []);

    const saveDraftAction = useCallback(async () => {
        if (!selectedScript) return;
        setSaving(true);
        try {
            await apiSaveDraft(selectedScript, draftCode);
            setHasDraft(true);
            setIsDirty(false);
        } catch (err) {
            console.error("Failed to save draft:", err);
            throw err;
        } finally {
            setSaving(false);
        }
    }, [selectedScript, draftCode]);

    const publishAction = useCallback(async () => {
        if (!selectedScript) return;
        setPublishing(true);
        try {
            await apiPublishDraft(selectedScript);
            setOriginalCode(draftCode);
            setHasDraft(false);
            setIsDirty(false);
        } catch (err) {
            console.error("Failed to publish:", err);
            throw err;
        } finally {
            setPublishing(false);
        }
    }, [selectedScript, draftCode]);

    const discardDraft = useCallback(async () => {
        if (!selectedScript) return;
        try {
            await deleteDraft(selectedScript);
            setDraftCode(originalCode);
            setHasDraft(false);
            setIsDirty(false);
        } catch (err) {
            console.error("Failed to discard draft:", err);
        }
    }, [selectedScript, originalCode]);

    const toggleDiff = useCallback(() => {
        setViewMode((prev) => (prev === "edit" ? "diff" : "edit"));
    }, []);

    return {
        selectedScript, originalCode, draftCode, isDirty, hasDraft,
        viewMode, saving, publishing, loading,
        loadScript, updateCode, saveDraftAction, publishAction, discardDraft, toggleDiff,
    };
}
