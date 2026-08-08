"""Headless tests for the state-persistence module (no tkinter involved)."""

import json

import pytest

from forge_calculator import settings


@pytest.fixture
def config(tmp_path, monkeypatch):
    monkeypatch.setenv("FORGE_CALCULATOR_CONFIG", str(tmp_path))
    return tmp_path


def test_missing_state_loads_empty(config):
    assert settings.load_state() == {}


def test_save_load_roundtrip(config):
    state = {
        "calculator": {"weapon": "Demonic Spear", "quality": "100"},
        "tab": 2,
        "filters": {"Ores": {"name": "aet"}},
    }
    settings.save_state(state)
    assert settings.load_state() == state


def test_corrupt_state_loads_empty(config):
    (config / "state.json").write_text("{not valid json", encoding="utf-8")
    assert settings.load_state() == {}


def test_non_dict_state_loads_empty(config):
    (config / "state.json").write_text("[1, 2, 3]", encoding="utf-8")
    assert settings.load_state() == {}


def test_save_creates_missing_dir(tmp_path, monkeypatch):
    sub = tmp_path / "nested" / "dir"
    monkeypatch.setenv("FORGE_CALCULATOR_CONFIG", str(sub))
    settings.save_state({"a": 1})
    assert json.loads((sub / "state.json").read_text(encoding="utf-8")) == {"a": 1}


def test_config_dir_override(config):
    assert settings.config_dir() == config
    assert settings.state_path() == config / "state.json"
