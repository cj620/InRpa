import backend.scripts_data as scripts_data


def test_get_script_meta_contains_io_schema_defaults(tmp_path, monkeypatch):
    monkeypatch.setattr(scripts_data, "DATA_PATH", str(tmp_path / "scripts_data.json"))
    meta = scripts_data.get_script_meta("example_script")
    assert "inputs_schema" in meta
    assert "outputs_schema" in meta
    assert meta["inputs_schema"]["type"] == "object"
    assert meta["outputs_schema"]["type"] == "object"
