"""Script runner — manages subprocess execution of Python scripts."""

import asyncio
import inspect
import subprocess
import sys
import threading
from typing import Callable, Optional


class ScriptRunner:
    """Manages running Python scripts as subprocesses.

    Uses subprocess.Popen instead of asyncio.create_subprocess_exec
    for Windows compatibility (SelectorEventLoop doesn't support async subprocesses).
    """

    def __init__(self):
        self._statuses: dict[str, str] = {}
        self._processes: dict[str, subprocess.Popen] = {}

    def get_status(self, script_path: str) -> str:
        """Get current status of a script: idle, running, completed, failed."""
        return self._statuses.get(script_path, "idle")

    async def run(self, script_path: str, on_log: Callable[[str], None] = None):
        """Run a Python script as subprocess, streaming output via on_log callback."""
        if self._statuses.get(script_path) == "running":
            raise RuntimeError(f"Script is already running: {script_path}")

        self._statuses[script_path] = "running"
        loop = asyncio.get_event_loop()

        try:
            process = subprocess.Popen(
                [sys.executable, "-u", script_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=0,
            )
            self._processes[script_path] = process

            queue: asyncio.Queue = asyncio.Queue()

            def read_lines():
                for raw_line in process.stdout:
                    text = raw_line.decode("utf-8", errors="replace").rstrip()
                    asyncio.run_coroutine_threadsafe(queue.put(text), loop)
                process.wait()
                asyncio.run_coroutine_threadsafe(queue.put(None), loop)  # sentinel

            threading.Thread(target=read_lines, daemon=True).start()

            while True:
                line = await queue.get()
                if line is None:
                    break
                if on_log:
                    if inspect.iscoroutinefunction(on_log):
                        await on_log(line)
                    else:
                        on_log(line)

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
