
# PLBD
## Programming Logic Blind Spot Detector

PLBD is an AI-assisted programming education platform designed to identify programming errors, detect potential logical mistakes, and help learners understand the underlying programming concepts they may have misunderstood.

Instead of simply reporting errors, PLBD connects detected issues with explanations, learning recommendations, and targeted practice exercises.

---

## 1. Project Overview

Traditional compilers identify syntax errors and certain programming issues, but they do not necessarily explain the conceptual misunderstanding behind a learner's mistake.

PLBD aims to bridge this gap by combining compiler diagnostics with rule-based logic analysis and a personalized learning recommendation system.

The platform analyzes C source code and provides:

- Compiler error and warning detection.
- Rule-based logical mistake detection.
- Identification of potential programming misconceptions.
- Concept-specific learning explanations.
- Recommended exercises based on detected misconceptions.
- Progress tracking for completed exercises.
- Analysis history.

---

## 2. Key Features

### Code Analysis
- C programming code editor powered by Monaco Editor.
- Automatic code analysis.
- Clang-based compiler diagnostics.
- Rule-based detection of selected logical mistakes.
- Inline diagnostic markers and problem locations.

### Logic Analysis
The current analyzer supports selected rules, including:

- Array indexing and boundary mistakes.
- Potentially non-terminating loops caused by missing loop-variable updates.
- Assignment operators used in conditional expressions.

### Personalized Learning
- Maps detected logic findings to predefined misconception categories.
- Provides explanations of the underlying concepts.
- Recommends relevant learning material.
- Generates targeted practice exercises.

### Learning Progress
- Exercise completion tracking.
- Progress indicators.
- Persistent analysis history.
- Restoration of previously saved analysis results.

### Development Interface
- VS Code-inspired interface.
- Monaco code editor.
- Problems and output panels.
- Integrated learning assistant.
- Dark-themed workspace.

---

## 3. System Architecture

PLBD follows a frontend-backend architecture.

```text
                 USER
                   |
                   v
          REACT FRONTEND
          +----------------+
          | Monaco Editor  |
          | Problems Panel |
          | Learning UI    |
          | History        |
          +----------------+
                   |
             HTTP / REST API
                   |
                   v
           FASTAPI BACKEND
          +----------------+
          |   main.py      |
          +----------------+
                   |
          +--------+---------+
          |                  |
          v                  v
    CLANG ANALYSIS      LOGIC ANALYZER
          |                  |
          v                  v
    Diagnostics        Logic Findings
          |                  |
          +--------+---------+
                   |
                   v
          MISCONCEPTION ENGINE
                   |
                   v
          RECOMMENDATION ENGINE
                   |
                   v
           JSON RESPONSE
                   |
                   v
          REACT FRONTEND
                   |
                   v
       EXPLANATIONS AND EXERCISES
```

---

## 4. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React |
| Programming Language | TypeScript |
| Build Tool | Vite |
| Code Editor | Monaco Editor |
| Backend | Python |
| Backend Framework | FastAPI |
| Compiler Diagnostics | Clang |
| API Communication | REST API |
| Data Storage | SQLite (backend project dependency) and Browser LocalStorage |

**Note:** The current frontend stores exercise completion and analysis history in browser LocalStorage. The current analysis workflow does not use SQLite for user progress storage.

---

## 5. Project Structure

```text
PLBD/
|
|-- backend/
|   |-- main.py
|   |-- logic_analyzer.py
|   |-- misconception_engine.py
|   |-- recommendation_engine.py
|   |-- test_logic.py
|
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- assets/
|   |   |-- App.tsx
|   |   |-- App.css
|   |   |-- index.css
|   |   |-- main.tsx
|   |
|   |-- package.json
|
|-- docs/
|
|-- README.md
```

---

## 6. Installation and Setup

### Prerequisites

Install the following:

- Python 3
- Node.js and npm
- Clang compiler
- Visual Studio Code (recommended)

### Step 1: Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd PLBD
```

### Step 2: Install backend dependencies

```bash
python3 -m pip install fastapi uvicorn
```

### Step 3: Install Clang

On macOS:

```bash
brew install llvm
```

Ensure that Clang is accessible through your system PATH.

Verify:

```bash
clang --version
```

### Step 4: Start the backend

From the project root directory:

```bash
python3 -m uvicorn main:app --app-dir backend --reload --port 8000
```

The backend will be available at:

```text
http://127.0.0.1:8000
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

### Step 5: Install frontend dependencies

Open another terminal:

```bash
cd frontend
npm install
```

### Step 6: Start the frontend

```bash
npm run dev
```

Open the local development URL displayed by Vite, normally:

```text
http://localhost:5173
```

---

## 7. Working Principle

PLBD processes source code through the following stages:

1. **Code Input:** The learner writes or edits C code in the Monaco editor.

2. **Compiler Analysis:** The backend invokes Clang to identify compiler errors and warnings.

3. **Logic Analysis:** The rule-based analyzer examines selected code patterns for potential logical mistakes.

4. **Misconception Classification:** Detected findings are mapped to predefined programming misconception categories.

5. **Recommendation Generation:** The recommendation engine selects relevant lessons and practice exercises.

6. **Result Presentation:** The frontend displays diagnostics, explanations, learning recommendations, and exercises.

7. **Progress Tracking:** Exercise completion and analysis history are saved locally in the browser.

---

## 8. Current Analysis Rules

| Rule ID | Category | Description |
|---|---|---|
| PLBD-ARR-001 | Array Indexing | Detects selected array boundary mistakes |
| PLBD-LOOP-001 | Loop Control | Identifies potential loop termination problems |
| PLBD-LOGIC-003 | Operators | Detects assignment used in conditional expressions |

The logic analyzer uses rule-based code inspection and regular-expression techniques. It is not a complete C language parser, so its findings are limited to supported code patterns.

---

## 9. Limitations

- The current logic analyzer supports a limited set of predefined programming rules.
- Complex C syntax and advanced control structures may not be analyzed accurately.
- Rule-based analysis may produce false positives or miss certain mistakes.
- The current system focuses on C programming.
- The backend performs static analysis and does not execute submitted C programs.
- Learning recommendations are generated from a predefined exercise library.
- Learning progress is stored locally in the browser rather than in individual user accounts.

---

## 10. Future Enhancements

- Expand support for additional programming languages.
- Introduce more advanced logical mistake detection.
- Improve code understanding through AST-based analysis.
- Integrate an AI-based misconception explanation system.
- Introduce user authentication and cloud-based progress storage.
- Provide adaptive exercise difficulty.
- Add detailed learner performance analytics.
- Support additional programming concepts and data structures.

---

## 11. Conclusion

PLBD aims to improve programming education by going beyond conventional compiler diagnostics.

By connecting programming mistakes with their underlying conceptual misunderstandings, the platform provides learners with explanations and targeted exercises to strengthen their programming knowledge.

The project demonstrates how compiler technology, static code analysis, and personalized learning recommendations can be integrated into a unified programming education platform.

---

**Project:** Programming Logic Blind Spot Detector (PLBD)  
**Domain:** Artificial Intelligence and Machine Learning / Programming Education  
**Primary Language Analyzed:** C
