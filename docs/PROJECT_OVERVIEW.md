cat > docs/PROJECT_OVERVIEW.md <<'EOF'
# PLBD – Project Overview

## 1. Project Title

Programming Logic Blind Spot Detector (PLBD)

## 2. Introduction

Programming Logic Blind Spot Detector (PLBD) is an intelligent programming assistance application designed to identify selected logical mistakes and programming misconceptions in C programs.

Traditional compiler diagnostics primarily focus on syntax and compilation errors. However, some logical mistakes may remain undetected even when a program is syntactically valid.

PLBD aims to address this gap by combining compiler diagnostics with rule-based logical analysis and personalized learning recommendations.

## 3. Problem Statement

Beginner programmers often struggle to identify logical mistakes in their programs.

Common challenges include:

- Incorrect array indexing.
- Array boundary violations.
- Incorrect loop variable updates.
- Potentially non-terminating loops.
- Confusion between assignment and comparison operators.
- Difficulty understanding why a particular programming mistake occurs.

Conventional compiler messages may not always explain the underlying misconception.

Therefore, a system that identifies selected logical mistakes and provides relevant learning guidance can support programming education.

## 4. Project Objectives

1. Analyze C source code for compiler diagnostics.
2. Identify selected logical programming mistakes.
3. Associate detected findings with predefined misconceptions.
4. Generate relevant explanations and learning recommendations.
5. Provide practice exercises to reinforce programming concepts.
6. Present analysis results through an interactive code editor.

## 5. Proposed System

PLBD provides a web-based programming environment where users can enter or modify C code.

The system analyzes the submitted code using two complementary approaches:

- Compiler-based diagnostics using Clang.
- Rule-based logical analysis using Python.

Detected findings are processed by the misconception engine and recommendation engine.

The frontend displays the resulting diagnostics, explanations, and practice exercises.

## 6. System Architecture

The application consists of the following major components:

### Frontend

- React
- TypeScript
- Vite
- Monaco Editor

Responsibilities:
- Provide the code editing environment.
- Display compiler diagnostics and logical findings.
- Present explanations and recommendations.
- Maintain analysis history and exercise progress using browser LocalStorage.

### Backend

- Python
- FastAPI

Responsibilities:
- Receive source code from the frontend.
- Coordinate compiler diagnostics and logical analysis.
- Process findings through the learning engines.
- Return structured analysis results.

### Compiler Diagnostics

Clang is used to identify supported compiler errors and warnings.

### Logic Analyzer

The Python logic analyzer uses predefined rules and pattern-based inspection to identify selected logical mistakes.

### Misconception Engine

This component maps recognized findings to predefined programming misconceptions and explanations.

### Recommendation Engine

This component generates relevant lessons and practice exercises based on recognized misconception categories.

## 7. Main Detection Categories

The current implementation focuses on three categories:

| Rule ID | Category | Detection Focus |
|---|---|---|
| PLBD-ARR-001 | Array Indexing and Boundaries | Potential array boundary violations |
| PLBD-LOOP-001 | Loop Control and Termination | Missing loop-variable updates in supported patterns |
| PLBD-LOGIC-003 | Assignment and Comparison | Assignment used in conditional expressions |

## 8. Application Workflow

1. The user enters C source code into the editor.
2. The frontend sends the code to the FastAPI backend.
3. Clang generates compiler diagnostics.
4. The logic analyzer checks supported logical patterns.
5. The misconception engine classifies recognized findings.
6. The recommendation engine generates relevant learning material.
7. The backend returns the analysis results.
8. The frontend displays findings, explanations, and exercises.

## 9. Key Features

- Interactive code editor.
- Compiler diagnostic display.
- Rule-based logical mistake detection.
- Misconception identification.
- Personalized learning recommendations based on detected categories.
- Practice exercises with hints and answers.
- Analysis history.
- Exercise completion tracking.
- Backend connection status.

## 10. Technologies Used

| Technology | Purpose |
|---|---|
| React | Frontend development |
| TypeScript | Frontend programming language |
| Vite | Frontend development and build tool |
| Monaco Editor | Code editing interface |
| Python | Backend logic |
| FastAPI | Backend API framework |
| Clang | Compiler diagnostics |
| LocalStorage | Browser-side persistence |

## 11. Scope and Limitations

PLBD is an educational prototype focused on selected logical programming mistakes in C.

Its logic analyzer uses predefined patterns and heuristic rules rather than a complete C language parser.

Consequently:

- It does not detect every possible logical mistake.
- Complex code structures may not be analyzed accurately.
- Some findings may require manual verification.
- The system performs static analysis and does not execute submitted programs.

## 12. Future Enhancements

Possible future improvements include:

- Support for additional programming languages.
- Expanded logical mistake detection.
- More advanced semantic code analysis.
- Adaptive learning recommendations.
- Detailed learner performance analytics.
- Expanded exercise libraries.

## 13. Conclusion

Programming Logic Blind Spot Detector combines compiler diagnostics, rule-based logical analysis, misconception classification, and learning recommendations in a unified programming environment.

The project aims to help beginner programmers understand selected logical mistakes and strengthen their programming fundamentals through targeted explanations and practice.
EOF