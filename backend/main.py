import asyncio
import os
import pty
import re
import shutil
import subprocess
import tempfile
import time

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from logic_analyzer import analyze_code
from misconception_engine import classify_findings
from recommendation_engine import build_recommendations


app = FastAPI(title="PLBD Diagnostic Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

CLANG = shutil.which("clang")
DOCKER = shutil.which("docker")
DOCKER_IMAGE = "plbd-c-runner:1.0"


class CodeRequest(BaseModel):
    code: str = Field(max_length=50000)


class CodeExecutionRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50000)
    input: str = Field(default="", max_length=10000)


@app.get("/")
def home():
    return {
        "message": "PLBD Backend Running",
        "compiler": CLANG,
        "execution_available": DOCKER is not None
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "clang_available": CLANG is not None,
        "docker_available": DOCKER is not None
    }


@app.post("/analyze")
def analyze(request: CodeRequest):

    if not CLANG:
        raise HTTPException(500, "Clang compiler not found")

    start = time.perf_counter()

    try:
        with tempfile.TemporaryDirectory() as directory:
            source = os.path.join(directory, "main.c")

            with open(source, "w", encoding="utf-8") as file:
                file.write(request.code)

            result = subprocess.run(
                [
                    CLANG,
                    "-std=c11",
                    "-Wall",
                    "-Wextra",
                    "-Wpedantic",
                    "-fsyntax-only",
                    "-fno-color-diagnostics",
                    source
                ],
                capture_output=True,
                text=True,
                timeout=5
            )

            output = result.stderr + "\n" + result.stdout
            diagnostics = []

            pattern = re.compile(
                r"^.*?:(\d+):(\d+): "
                r"(fatal error|error|warning|note): (.*)$"
            )

            for line in output.splitlines():
                match = pattern.match(line)

                if match:
                    diagnostics.append({
                        "line": int(match.group(1)),
                        "column": int(match.group(2)),
                        "severity": match.group(3),
                        "message": match.group(4)
                    })

            if output.strip() and not diagnostics:
                diagnostics.append({
                    "line": 1,
                    "column": 1,
                    "severity": "error",
                    "message": "Compiler output could not be parsed."
                })

            logic_findings = analyze_code(request.code)
            misconceptions = classify_findings(logic_findings)
            recommendations = build_recommendations(misconceptions)

            return {
                "success": result.returncode == 0,
                "diagnostics": diagnostics,
                "logic_findings": logic_findings,
                "misconceptions": misconceptions,
                "recommendations": recommendations,
                "compiler": "Clang",
                "duration_ms": round(
                    (time.perf_counter() - start) * 1000, 2
                )
            }

    except subprocess.TimeoutExpired:
        raise HTTPException(408, "Compiler timed out")

    except Exception as error:
        raise HTTPException(500, str(error))


@app.post("/run")
def run_code(request: CodeExecutionRequest):

    if not DOCKER:
        raise HTTPException(
            503,
            "Docker is not installed or is not available."
        )

    image_check = subprocess.run(
        ["docker", "image", "inspect", DOCKER_IMAGE],
        capture_output=True,
        text=True,
        timeout=5
    )

    if image_check.returncode != 0:
        raise HTTPException(
            503,
            "PLBD compiler image is missing. Build it using the project instructions."
        )

    start = time.perf_counter()

    try:
        with tempfile.TemporaryDirectory() as directory:
            os.chmod(directory, 0o755)

            source = os.path.join(directory, "main.c")

            with open(source, "w", encoding="utf-8") as file:
                file.write(request.code)

            os.chmod(source, 0o644)

            command = [
                "docker", "run",
                "--rm",
                "-i",
                "--network=none",
                "--memory=128m",
                "--memory-swap=128m",
                "--cpus=0.5",
                "--pids-limit=32",
                "--read-only",
                "--cap-drop=ALL",
                "--security-opt=no-new-privileges",
                "--user=10001:10001",
                "--mount",
                f"type=bind,source={directory},target=/workspace,readonly",
                "--tmpfs",
                "/tmp:rw,exec,nosuid,nodev,size=32m,uid=10001,gid=10001",
                DOCKER_IMAGE,
                "sh", "-c",
                "gcc -std=c11 -Wall -Wextra -Wpedantic "
                "/workspace/main.c -o /tmp/plbd-program "
                "&& timeout 3s /tmp/plbd-program"
            ]

            result = subprocess.run(
                command,
                input=request.input,
                capture_output=True,
                text=True,
                timeout=12
            )

            elapsed = round(
                (time.perf_counter() - start) * 1000, 2
            )

            if result.returncode == 124:
                status = "timeout"
            elif result.returncode == 0:
                status = "success"
            else:
                status = "error"

            return {
                "success": result.returncode == 0,
                "status": status,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode,
                "duration_ms": elapsed
            }

    except subprocess.TimeoutExpired:
        raise HTTPException(
            408,
            "Execution exceeded the allowed time limit."
        )

    except Exception as error:
        raise HTTPException(
            500,
            f"Execution service error: {str(error)}"
        )


@app.websocket("/run/terminal")
async def run_terminal(websocket: WebSocket):
    await websocket.accept()

    process = None
    input_task = None
    output_task = None
    wait_task = None

    try:
        start_message = await websocket.receive_json()

        if start_message.get("type") != "start":
            await websocket.send_json({
                "type": "error",
                "data": "Invalid terminal start request."
            })
            return

        code = start_message.get("code", "")

        if not isinstance(code, str) or not code.strip() or len(code) > 50000:
            await websocket.send_json({
                "type": "error",
                "data": "Invalid C source code."
            })
            return

        if not DOCKER:
            await websocket.send_json({
                "type": "error",
                "data": "Docker is unavailable. Start Docker Desktop."
            })
            return

        image_check = await asyncio.to_thread(
            subprocess.run,
            [DOCKER, "image", "inspect", DOCKER_IMAGE],
            capture_output=True,
            text=True,
            timeout=5
        )

        if image_check.returncode != 0:
            await websocket.send_json({
                "type": "error",
                "data": "PLBD compiler image is missing."
            })
            return

        with tempfile.TemporaryDirectory() as directory:
            os.chmod(directory, 0o755)

            source_path = os.path.join(directory, "main.c")
            header_path = os.path.join(directory, "plbd-io.h")

            with open(source_path, "w", encoding="utf-8") as file:
                file.write(code)

            with open(header_path, "w", encoding="utf-8") as file:
                file.write(
                    "#include <stdio.h>\n"
                    "__attribute__((constructor))\n"
                    "static void plbd_terminal_setup(void) {\n"
                    "    setvbuf(stdout, NULL, _IONBF, 0);\n"
                    "    setvbuf(stderr, NULL, _IONBF, 0);\n"
                    "}\n"
                )

            os.chmod(source_path, 0o644)
            os.chmod(header_path, 0o644)

            command = [
                DOCKER, "run", "--rm", "-i",
                "--network=none",
                "--memory=128m", "--memory-swap=128m",
                "--cpus=0.5", "--pids-limit=32",
                "--read-only", "--cap-drop=ALL",
                "--security-opt=no-new-privileges",
                "--user=10001:10001",
                "--mount",
                f"type=bind,source={directory},target=/workspace,readonly",
                "--tmpfs",
                "/tmp:rw,exec,nosuid,nodev,size=32m,uid=10001,gid=10001",
                DOCKER_IMAGE,
                "sh", "-c",
                "gcc -include /workspace/plbd-io.h "
                "-std=c11 -Wall -Wextra -Wpedantic "
                "/workspace/main.c -o /tmp/plbd-program "
                "&& exec timeout 15s /tmp/plbd-program"
            ]

            await websocket.send_json({
                "type": "status",
                "data": "Compiling C program..."
            })

            process = await asyncio.create_subprocess_exec(
                *command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )

            async def stream_output():
                while True:
                    chunk = await process.stdout.read(1024)
                    if not chunk:
                        break

                    await websocket.send_json({
                        "type": "output",
                        "data": chunk.decode("utf-8", errors="replace")
                    })

            async def receive_input():
                try:
                    while True:
                        message = await websocket.receive_json()

                        if message.get("type") == "input":
                            data = message.get("data", "")

                            if isinstance(data, str) and data and process.stdin:
                                process.stdin.write(data.encode("utf-8"))
                                await process.stdin.drain()

                except WebSocketDisconnect:
                    return

            output_task = asyncio.create_task(stream_output())
            input_task = asyncio.create_task(receive_input())
            wait_task = asyncio.create_task(process.wait())

            done, _ = await asyncio.wait(
                [input_task, wait_task],
                timeout=20,
                return_when=asyncio.FIRST_COMPLETED
            )

            disconnected = input_task in done
            timed_out = not done

            if disconnected or timed_out:
                if process.returncode is None:
                    process.kill()
                    await process.wait()

            if not input_task.done():
                input_task.cancel()

            await asyncio.gather(input_task, return_exceptions=True)

            if not disconnected:
                await output_task
            elif not output_task.done():
                output_task.cancel()
                await asyncio.gather(output_task, return_exceptions=True)

            if not disconnected:
                exit_code = process.returncode

                status = (
                    "timeout" if timed_out or exit_code == 124
                    else "success" if exit_code == 0
                    else "error"
                )

                await websocket.send_json({
                    "type": "finished",
                    "status": status,
                    "exit_code": exit_code
                })

    except WebSocketDisconnect:
        pass

    except Exception as error:
        try:
            await websocket.send_json({
                "type": "error",
                "data": f"Terminal execution error: {error}"
            })
        except Exception:
            pass

    finally:
        for task in (input_task, output_task, wait_task):
            if task and not task.done():
                task.cancel()

        if process and process.returncode is None:
            process.kill()
            await process.wait()

        if process and process.stdin and not process.stdin.is_closing():
            process.stdin.close()

