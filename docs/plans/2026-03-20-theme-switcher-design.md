# Theme Switcher Design

## Overview

Add theme switching with three themes: Dark (current default), Light, and Cream (cold milk-gray). Accessible from both the Settings panel and a quick-toggle button in the Sidebar. Theme persists via backend settings.

## Themes

### Color Variables

| Variable | Dark | Light | Cream |
|----------|------|-------|-------|
| `--bg-primary` | `#0F1117` | `#FFFFFF` | `#F8F7F5` |
| `--bg-card` | `#161822` | `#F5F5F7` | `#EEECEA` |
| `--bg-hover` | `#1C1F2E` | `#E8E8EC` | `#E5E3E0` |
| `--bg-terminal` | `#0A0C10` | `#F0F0F2` | `#EDEAE7` |
| `--accent` | `#6C5CE7` | `#6C5CE7` | `#6C5CE7` |
| `--accent-light` | `#A29BFE` | `#5A4BD1` | `#5A4BD1` |
| `--text-primary` | `#E4E6EF` | `#1A1A2E` | `#2C2C2C` |
| `--text-secondary` | `#8F93A2` | `#6B6B80` | `#7A7872` |
| `--border` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.08)` | `rgba(0,0,0,0.06)` |
| `--scrollbar-thumb` | `rgba(255,255,255,0.1)` | `rgba(0,0,0,0.15)` | `rgba(0,0,0,0.1)` |

- Status colors (success/fail/running) remain the same across all themes.
- `--accent-light` darkened for Light/Cream to maintain readability on light backgrounds.

## Implementation Approach

CSS Variables + `data-theme` attribute on `<html>`. Themes defined as `[data-theme="light"]` and `[data-theme="cream"]` selectors overriding `:root` variables. Dark is the default (`:root`).

## Architecture

### Data Flow

```
User clicks toggle → Update React state → Set document.documentElement.dataset.theme
                                         → Call backend API to persist in settings
                                         ↓
                                  CSS [data-theme] selectors auto-apply
                                  + body transition: background/color 0.3s
```

### State Management

Props from `App.jsx` passing `theme` and `onThemeChange` down to Sidebar and SettingsPanel. No Context needed (shallow component tree).

### Transition

Smooth 0.3s CSS transition on `background-color` and `color` properties on `body` and key elements.

## Entry Points

### 1. Sidebar Quick Toggle

- Position: between Settings button and collapse button
- Behavior: cyclic toggle (dark → light → cream → dark)
- Icons change per theme:
  - Dark: moon icon
  - Light: sun icon
  - Cream: coffee cup icon

### 2. Settings Panel

- Added to "General Settings" card as a theme selector (three-option radio or segmented control)

## Persistence

Theme saved to backend settings as `theme` field (values: `"dark"`, `"light"`, `"cream"`, default: `"dark"`). Loaded on app init from settings API.

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/index.css` | Add `[data-theme="light"]` and `[data-theme="cream"]` variable overrides; add transition to body |
| `frontend/src/components/Sidebar.jsx` | Add theme cycle toggle button |
| `frontend/src/components/SettingsPanel.jsx` | Add theme selector in General Settings card |
| `frontend/src/App.jsx` | Init theme from settings, manage theme state, pass props, apply to DOM |
| `backend/app.py` | Add `theme` field to settings schema with default `"dark"` |
