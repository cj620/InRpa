from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]


def test_files_panel_declares_on_refresh_prop():
    source = (ROOT / "frontend/src/components/FilesPanel.jsx").read_text(encoding="utf-8")

    assert "export default function FilesPanel({ folders, selectedFolder, onEdit, onRefresh })" in source


def test_app_passes_refresh_callback_to_files_panel():
    source = (ROOT / "frontend/src/App.jsx").read_text(encoding="utf-8")

    assert "<FilesPanel" in source
    assert "onRefresh={loadFolders}" in source


def test_edit_meta_dialog_tracks_dirty_fields_before_saving():
    source = (ROOT / "frontend/src/components/EditMetaDialog.jsx").read_text(encoding="utf-8")

    assert "const [tagsDirty, setTagsDirty] = useState(false);" in source
    assert "const [descriptionDirty, setDescriptionDirty] = useState(false);" in source
    assert re.search(r"if \(tagsDirty\) payload\.tags =", source)
    assert re.search(r"if \(descriptionDirty\) payload\.description =", source)
