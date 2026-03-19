"""Script runner — manages subprocess execution of Python scripts."""

import asyncio
import inspect
import sys
from typing import Callable, Optional


class ScriptRunner:
    """Manages running Python scripts as subprocesses."""

    def __init__(self):
        self._statuses: dict[str, str] = {}
        self._processes: dict[str, asyncio.subprocess.Process] = {}

    def get_status(self, script_path: str) -> str:
        """Get current status of a script: idle, running, completed, failed."""
        return self._statuses.get(script_path, "idle")

    async def run(self, script_path: str, on_log: Callable[[str], None] = None):
        """Run a Python script as subprocess, streaming output via on_log callback."""
        if self._statuses.get(script_path) == "running":
            raise RuntimeError(f"Script is already running: {script_path}")

        self._statuses[script_path] = "running"

        try:
            process = await asyncio.create_subprocess_exec(
                sys.executable, script_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            self._processes[script_path] = process

            async for line in process.stdout:
                text = line.decode("utf-8", errors="replace").rstrip()
                if on_log:
                    if inspect.iscoroutinefunction(on_log):
                        await on_log(text)
                    else:
                        on_log(text)

            await process.wait()

            if process.returncode == 0:
                self._statuses[script_path] = "completed"
            else:
                self._statuses[script_path] = "failed"

        except asyncio.CancelledError:
            self._statuses[script_path] = "failed"
        finally:
            self._processes.pop(script_path, None)

    def stop(self, script_path: str) -> bool:
        """Stop a running script. Returns True if stopped, False if not running."""
        process = self._processes.get(script_path)
        if process and process.returncode is None:
            process.terminate()
            return True
        return False
