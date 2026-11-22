# PLBD Engineering Audit

**Audit branch:** `audit/diagnostics`  
**Baseline:** `redesign/vscode-workbench` at `bcdb6c02b7a72b3f1aa766192975a8a9dc0b9645`  
**Status:** In progress

## Audit rules

- Do not treat a successful build as proof of correct application behavior.
- Every reported defect must include evidence, impact, and a reproduction or test.
- Separate confirmed defects from risks that still need reproduction.
- Fix in isolated commits and run the narrow test first, then the full CI suite.
- Do not merge audit work into `main` until the audit changes pass validation.

## Initial confirmed findings

### P1 — Deleting an active dirty file can discard unsaved work

**Location:** `frontend/src/WorkspaceExplorer.tsx`, `deleteItem`.

The delete handler sends the DELETE request before calling any save guard. If the active file has unsaved editor changes, deleting that file (or a parent folder containing it) removes the disk copy. The subsequent file switch cannot recover those unsaved edits.

**Expected:** Before deleting an active file or a folder containing the active file, require a successful save or explicit discard confirmation. If saving fails, cancel deletion.

**Validation needed:** Component-level test for dirty active file, dirty active descendant in deleted folder, clean file deletion, and save failure.

### P1 — Logic analyzer silently ignores loops without brace blocks

**Location:** `backend/logic_analyzer.py`, `extract_loops`.

The extractor continues unless the first non-whitespace character after the loop header is an opening brace. Valid C single-statement loop bodies are therefore skipped by all loop rules.

**Expected:** Analyze both compound statements and valid single statements, while preserving correct source positions and nested control flow.

**Validation needed:** Positive and negative tests for single-statement `for` and `while` loops, including nested statements and comments.

### P1 — Loop termination analysis is heuristic and can misclassify control flow

**Location:** `backend/logic_analyzer.py`, `analyze_infinite_loops` and `variable_is_updated`.

The rule treats any textual update of the condition variable anywhere in the body as evidence that the loop progresses. It does not establish that the update executes on every iteration or moves the condition toward termination. Conversely, updates performed through called functions are not understood.

**Expected:** Findings must be conservative and clearly marked as potential issues. Tests must cover conditional updates, early exits, nested scopes, updates in called functions, and decrement/increment direction.

### P2 — Compiler notes are represented by the frontend as errors

**Location:** `backend/main.py` diagnostic parsing and `frontend/src/App.tsx` marker rendering.

The backend parser accepts Clang's `note` severity. The frontend maps every diagnostic other than `warning` to Monaco Error severity and renders every non-warning diagnostic with an error icon. A compiler note can therefore be presented as an error.

**Expected:** Preserve the compiler's severity taxonomy. Notes should be informational, not errors; only `error` and `fatal error` should increment the error count.

**Validation needed:** API response and UI tests for warning, note, error, and fatal error diagnostics.

### P2 — Analysis results can remain visible while newer code is pending analysis

**Location:** `frontend/src/App.tsx`, automatic analysis effect.

The effect debounces analysis by 600 ms but does not clear or mark the prior result as stale when the editor content changes. The Problems panel and learning summary can temporarily describe a previous source snapshot as if it belongs to the current editor contents.

**Expected:** Results must be associated with the exact analyzed source snapshot. While a newer snapshot is pending, indicate that existing findings are stale or clear them until the new response arrives.

**Validation needed:** Rapid edit, out-of-order response, file switch, and aborted request tests.

## Additional risks requiring verification

- Docker inspection in `/run` occurs outside the endpoint's main exception-handling block; Docker CLI timeout/failure behavior needs API tests.
- Backend exception handlers return raw exception strings in some 500 responses; verify information disclosure and logging behavior.
- Workspace path validation and filesystem operations need traversal, symlink, race, and malformed-path tests.
- Terminal Ctrl-C currently appears to be handled as local terminal echo/input-buffer reset; verify that it does not interrupt the running process.
- The WebSocket process lifecycle needs tests for client disconnect, timeout, compiler failure, input after process exit, and output streaming.
- CORS, request size limits, and resource limits need a dedicated security review.
- Existing logic analysis covers only three regex-based rules; coverage and false-positive/false-negative rates are unknown.

## Existing CI baseline

The baseline commit's GitHub Actions run passed frontend lint/build, backend logic tests, and Docker image build. This is useful baseline evidence, but the current test suite is not comprehensive enough to establish product correctness.

## Audit workstreams

1. Expand and correct logic-analysis tests.
2. Add backend API and workspace filesystem tests.
3. Add frontend component/integration tests for editor, analysis state, and workspace lifecycle.
4. Expand Docker runtime and WebSocket tests.
5. Review security boundaries and error handling.
6. Run full CI and document any remaining manual validation required on the local Mac.
