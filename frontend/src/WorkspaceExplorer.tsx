import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000";

type WorkspaceNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: WorkspaceNode[];
};

type Props = {
  activeFile: string;
  onOpenFile: (path: string, content: string) => void;
  onBeforeOpen: () => Promise<void>;
  onPathRenamed: (oldPath: string, newPath: string) => void;
  onFileDeleted: () => void;
};

async function apiRequest(path: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Workspace request failed (${response.status})`);
  }

  return response.status === 204 ? null : response.json();
}

function flattenFiles(nodes: WorkspaceNode[]): WorkspaceNode[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node] : flattenFiles(node.children || [])
  );
}

function iconForFile(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (["c", "h", "cpp", "cc", "hpp"].includes(extension || "")) {
    return <FileCode2 size={15} className="explorer-file-icon icon-code" />;
  }
  if (["md", "txt", "rst"].includes(extension || "")) {
    return <FileText size={15} className="explorer-file-icon icon-text" />;
  }
  if (["json", "jsonc"].includes(extension || "")) {
    return <FileJson size={15} className="explorer-file-icon icon-json" />;
  }
  return <File size={15} className="explorer-file-icon icon-default" />;
}

export default function WorkspaceExplorer({
  activeFile,
  onOpenFile,
  onBeforeOpen,
  onPathRenamed,
  onFileDeleted,
}: Props) {
  const [tree, setTree] = useState<WorkspaceNode[]>([]);
  const [expanded, setExpanded] = useState<string[]>(["src"]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refreshTree = useCallback(async () => {
    const data = await apiRequest("/workspace/tree");
    const nextTree = (data.children || []) as WorkspaceNode[];
    setTree(nextTree);
    return nextTree;
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await apiRequest("/workspace/tree");
        if (!mounted) return;
        const nextTree = (data.children || []) as WorkspaceNode[];
        setTree(nextTree);
        const firstFile = flattenFiles(nextTree)[0];
        if (firstFile) {
          const file = await apiRequest(`/workspace/file?path=${encodeURIComponent(firstFile.path)}`);
          if (mounted) onOpenFile(firstFile.path, file.content);
        }
        setError("");
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : "Unable to load workspace.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [onOpenFile]);

  const openFile = async (node: WorkspaceNode, skipSave = false) => {
    if (node.type !== "file") return;
    try {
      setError("");
      if (!skipSave) await onBeforeOpen();
      const file = await apiRequest(`/workspace/file?path=${encodeURIComponent(node.path)}`);
      onOpenFile(node.path, file.content);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open file.");
    }
  };

  const createItem = async (kind: "file" | "folder") => {
    const name = window.prompt(kind === "file" ? "New file name:" : "New folder name:");
    if (!name) return;
    const cleanName = name.trim();
    if (!cleanName || cleanName === "." || cleanName === ".." || /[/\\\\]/.test(cleanName)) {
      setError("Enter a valid name without folder separators.");
      return;
    }
    const path = selectedFolder ? `${selectedFolder}/${cleanName}` : cleanName;
    try {
      setBusy(true);
      setError("");
      await apiRequest(kind === "file" ? "/workspace/file" : "/workspace/folder", {
        method: "POST",
        body: JSON.stringify(kind === "file" ? { path, content: "" } : { path }),
      });
      await refreshTree();
      if (kind === "folder") {
        setExpanded((current) => current.includes(path) ? current : [...current, path]);
        setSelectedFolder(path);
      } else {
        await openFile({ name: cleanName, path, type: "file" });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to create ${kind}.`);
    } finally {
      setBusy(false);
    }
  };

  const renameItem = async (node: WorkspaceNode) => {
    const nextName = window.prompt("Rename to:", node.name);
    if (!nextName || nextName.trim() === node.name) return;
    const cleanName = nextName.trim();
    if (!cleanName || cleanName === "." || cleanName === ".." || /[/\\\\]/.test(cleanName)) {
      setError("Enter a valid name without folder separators.");
      return;
    }
    const parent = node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/")) : "";
    const nextPath = parent ? `${parent}/${cleanName}` : cleanName;
    try {
      setBusy(true);
      setError("");
      await onBeforeOpen();
      await apiRequest("/workspace/rename", {
        method: "POST",
        body: JSON.stringify({ old_path: node.path, new_path: nextPath }),
      });
      await refreshTree();
      onPathRenamed(node.path, nextPath);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to rename item.");
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (node: WorkspaceNode) => {
    if (!window.confirm(`Delete "${node.name}"?${node.type === "folder" ? " This also deletes everything inside it." : ""}`)) return;
    try {
      setBusy(true);
      setError("");
      const deletingActiveFile =
        activeFile === node.path || activeFile.startsWith(`${node.path}/`);
      if (deletingActiveFile) {
        // Save the active editor buffer before the filesystem removes its file.
        // If saving fails, the catch below cancels deletion.
        await onBeforeOpen();
      }
      await apiRequest(`/workspace/item?path=${encodeURIComponent(node.path)}`, { method: "DELETE" });
      const nextTree = await refreshTree();
      if (activeFile === node.path || activeFile.startsWith(`${node.path}/`)) {
        const nextFile = flattenFiles(nextTree)[0];
        if (nextFile) await openFile(nextFile, true);
        else onFileDeleted();
      }
      if (selectedFolder === node.path || selectedFolder.startsWith(`${node.path}/`)) {
        setSelectedFolder("");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete item.");
    } finally {
      setBusy(false);
    }
  };

  const toggleFolder = (node: WorkspaceNode) => {
    setSelectedFolder(node.path);
    setExpanded((current) =>
      current.includes(node.path)
        ? current.filter((path) => path !== node.path)
        : [...current, node.path]
    );
  };

  const renderNodes = (nodes: WorkspaceNode[], depth = 0) =>
    nodes.map((node) => {
      const isExpanded = expanded.includes(node.path);
      const isActive = activeFile === node.path;
      return (
        <div className="workspace-node" key={node.path}>
          <div
            className={`workspace-row ${isActive ? "active" : ""} ${node.type === "folder" && selectedFolder === node.path ? "folder-selected" : ""}`}
            style={{ paddingLeft: 10 + depth * 15 }}
          >
            {node.type === "folder" ? (
              <button className="workspace-main-action" onClick={() => toggleFolder(node)} title={node.path}>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {isExpanded ? <FolderOpen size={15} className="explorer-folder-icon" /> : <Folder size={15} className="explorer-folder-icon" />}
                <span>{node.name}</span>
              </button>
            ) : (
              <button className="workspace-main-action" onClick={() => void openFile(node)} title={node.path}>
                {iconForFile(node.name)}
                <span>{node.name}</span>
              </button>
            )}
            <div className="workspace-row-actions">
              <button title="Rename" onClick={() => void renameItem(node)} disabled={busy}><Pencil size={12} /></button>
              <button title="Delete" onClick={() => void deleteItem(node)} disabled={busy}><Trash2 size={12} /></button>
            </div>
          </div>
          {node.type === "folder" && isExpanded && node.children?.length ? (
            <div>{renderNodes(node.children, depth + 1)}</div>
          ) : null}
          {node.type === "folder" && isExpanded && !node.children?.length ? (
            <div className="workspace-empty-folder" style={{ paddingLeft: 32 + depth * 15 }}>Empty folder</div>
          ) : null}
        </div>
      );
    });

  return (
    <section className="workspace-explorer">
      <div className="workspace-explorer-heading">
        <button className="workspace-root-select" onClick={() => setSelectedFolder("")}>
          <ChevronDown size={13} />
          <span>PLBD WORKSPACE</span>
        </button>
        <div className="workspace-toolbar">
          <button title="New File" onClick={() => void createItem("file")} disabled={busy}><Plus size={15} /></button>
          <button title="New Folder" onClick={() => void createItem("folder")} disabled={busy}><FolderPlus size={15} /></button>
          <button title="Refresh Explorer" onClick={() => void refreshTree().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to refresh workspace."))} disabled={busy}><RefreshCw size={14} /></button>
        </div>
      </div>
      <div className="workspace-tree">
        {loading ? <div className="workspace-message">Loading workspace…</div> : null}
        {!loading && tree.length === 0 ? <div className="workspace-message">This workspace is empty. Create a file or folder.</div> : null}
        {!loading ? renderNodes(tree) : null}
      </div>
      {error ? <div className="workspace-error" role="alert">{error}</div> : null}
      <div className="workspace-footer">Files are saved in your local PLBD-Workspace folder.</div>
    </section>
  );
}
