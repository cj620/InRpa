import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchSettings, updateSettings as apiUpdateSettings } from "../api";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings()
      .then((data) => setSettings(data))
      .catch((err) => console.error("Failed to load settings:", err))
      .finally(() => setLoading(false));
  }, []);

  const updateSettingsAndSync = useCallback(async (partial) => {
    const data = await apiUpdateSettings(partial);
    setSettings(data);
    return data;
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, setSettings, updateSettings: updateSettingsAndSync }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
