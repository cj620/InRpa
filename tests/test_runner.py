# tests/test_runner.py
import asyncio
import os
import pytest
from backend.runner import ScriptRunner


@pytest.fixture
def runner():
    return ScriptRunner()


@pytest.fixture
def ok_script():
    return os.path.join(os.path.dirname(__file__), "fixtures", "mock_script_ok.py")


@pytest.fixture
def fail_script():
    return os.path.join(os.path.dirname(__file__), "fixtures", "mock_script_fail.py")


@pytest.mark.asyncio
async def test_run_script_success(runner, ok_script):
    """Runner should execute script and collect output."""
    logs = []
    await runner.run(ok_script, on_log=lambda line: logs.append(line))

    assert runner.get_status(ok_script) == "completed"
    log_text = "\n".join(logs)
    assert "Starting task..." in log_text
    assert "Task completed successfully." in log_text


@pytest.mark.asyncio
async def test_run_script_failure(runner, fail_script):
    """Runner should detect script failure."""
    logs = []
    await runner.run(fail_script, on_log=lambda line: logs.append(line))

    assert runner.get_status(fail_script) == "failed"


@pytest.mark.asyncio
async def test_get_status_idle(runner, ok_script):
    """Unrun script should have idle status."""
    assert runner.get_status(ok_script) == "idle"


@pytest.mark.asyncio
async def test_stop_running_script(runner, ok_script):
    """Runner should be able to stop a running script."""
    task = asyncio.create_task(runner.run(ok_script, on_log=lambda _: None))
    await asyncio.sleep(0.1)  # let it start

    stopped = runner.stop(ok_script)
    assert stopped is True
    await task


@pytest.mark.asyncio
async def test_prevent_duplicate_run(runner, ok_script):
    """Should not allow running same script twice simultaneously."""
    task = asyncio.create_task(runner.run(ok_script, on_log=lambda _: None))
    await asyncio.sleep(0.05)

    with pytest.raises(RuntimeError, match="already running"):
        await runner.run(ok_script, on_log=lambda _: None)

    await task
