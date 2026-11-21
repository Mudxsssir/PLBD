
import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./TerminalPanel.css";

type Props = {
  code: string;
  runId: number;
  onRunningChange: (running: boolean) => void;
};

export default function TerminalPanel({
  code,
  runId,
  onRunningChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const codeRef = useRef(code);

  // Always keep the latest editor content available.
  codeRef.current = code;

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
      convertEol: true,
      theme: {
        background: "#111318",
        foreground: "#d4d4d4",
        cursor: "#ffffff",
        selectionBackground: "#264f78",
      },
      scrollback: 3000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    terminalRef.current = terminal;

    let inputBuffer = "";

    const fit = () => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore temporary layout measurement errors.
      }
    };

    requestAnimationFrame(fit);

    const observer = new ResizeObserver(fit);
    observer.observe(containerRef.current);

    const inputSubscription = terminal.onData((data) => {
      const socket = socketRef.current;

      for (const character of data) {
        if (character === "\r" || character === "\n") {
          terminal.write("\r\n");

          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "input",
              data: inputBuffer + "\n",
            }));
          }

          inputBuffer = "";
        } else if (character === "\u007f" || character === "\b") {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            terminal.write("\b \b");
          }
        } else if (character === "\u0003") {
          terminal.write("^C\r\n");
          inputBuffer = "";
        } else if (character >= " " || character === "\t") {
          inputBuffer += character;
          terminal.write(character);
        }
      }
    });

    return () => {
      observer.disconnect();
      inputSubscription.dispose();
      socketRef.current?.close();
      terminal.dispose();
      terminalRef.current = null;
      socketRef.current = null;
    };
  }, []);

  // Start execution only when Run is clicked.
  // Editing code must not restart the terminal session.
  useEffect(() => {
    if (!runId || !terminalRef.current) return;

    const terminal = terminalRef.current;

    socketRef.current?.close();
    terminal.clear();
    terminal.writeln("\x1b[90mPLBD C Terminal\x1b[0m");
    terminal.writeln("\x1b[90mPreparing execution...\x1b[0m");
    terminal.writeln("");

    onRunningChange(true);

    const socket = new WebSocket("ws://127.0.0.1:8000/run/terminal");
    socketRef.current = socket;

    let processFinished = false;

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: "start",
        code: codeRef.current,
      }));

      terminal.focus();
    };

    socket.onmessage = (event) => {
      let message: {
        type?: string;
        data?: string;
        status?: string;
        exit_code?: number | null;
      };

      try {
        message = JSON.parse(event.data);
      } catch {
        terminal.write(String(event.data));
        return;
      }

      if (message.type === "output") {
        terminal.write(message.data || "");
      } else if (message.type === "status") {
        terminal.writeln(`\x1b[90m${message.data || ""}\x1b[0m`);
      } else if (message.type === "error") {
        terminal.writeln(
          `\r\n\x1b[31m${message.data || "Execution error"}\x1b[0m`
        );
        onRunningChange(false);
      } else if (message.type === "finished") {
        processFinished = true;

        const successful = message.status === "success";

        terminal.writeln("");
        terminal.writeln(
          successful
            ? "\x1b[32mProcess finished successfully.\x1b[0m"
            : `\x1b[31mProcess finished: ${message.status || "error"} (exit code ${message.exit_code ?? "—"}).\x1b[0m`
        );

        onRunningChange(false);
      }
    };

    socket.onerror = () => {
      if (processFinished) return;

      terminal.writeln(
        "\r\n\x1b[31mUnable to connect to the PLBD terminal backend.\x1b[0m"
      );

      onRunningChange(false);
    };

    socket.onclose = () => {
      onRunningChange(false);
    };

    return () => {
      socket.close();
    };
  }, [runId, onRunningChange]);

  return (
    <div className="plbd-terminal-shell">
      <div className="plbd-terminal-toolbar">
        <span>TERMINAL</span>
        <span className="plbd-terminal-session">C PROGRAM</span>
      </div>

      <div
        className="plbd-terminal-screen"
        ref={containerRef}
      />
    </div>
  );
}
