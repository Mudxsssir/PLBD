# PLBD – Testing and Validation

## 1. Introduction

This document describes the testing strategy for the Programming Logic Blind Spot Detector (PLBD).

The purpose of testing is to verify compiler diagnostics, logical mistake detection, misconception classification, and learning recommendations.

## 2. Testing Objectives

- Verify backend API availability.
- Validate compiler diagnostics.
- Verify supported logic detection rules.
- Validate misconception classification.
- Verify recommendation generation.
- Check frontend-backend communication.
- Verify analysis history and exercise progress persistence.

## 3. Functional Test Cases

| Test ID | Component | Test Scenario | Expected Result |
|---|---|---|---|
| TC-01 | Backend | Access health endpoint | Backend health status is returned |
| TC-02 | Compiler | Submit valid C code | No compiler errors are reported |
| TC-03 | Compiler | Submit invalid C code | Compiler diagnostic is displayed |
| TC-04 | Array Analysis | Submit a supported array boundary pattern | Array boundary finding is generated |
| TC-05 | Loop Analysis | Submit a supported loop pattern | Loop-related finding is generated |
| TC-06 | Operator Analysis | Use assignment in a supported conditional | Assignment-in-condition finding is generated |
| TC-07 | Misconception Engine | Submit a recognized finding | Corresponding misconception is identified |
| TC-08 | Recommendation Engine | Submit a recognized category | Relevant learning recommendations are generated |
| TC-09 | Frontend | Modify source code | Automatic analysis is initiated |
| TC-10 | History | Restore saved analysis | Saved analysis is restored where available |
| TC-11 | Practice | Complete an exercise | Completion status is saved |
| TC-12 | Backend Connection | Stop the backend | Frontend indicates backend is offline |

## 4. Integration Testing

The following interactions should be validated:

1. React frontend communicates with FastAPI.
2. FastAPI invokes Clang for compiler diagnostics.
3. Logic analyzer identifies supported patterns.
4. Misconception engine classifies findings.
5. Recommendation engine generates learning material.
6. Analysis results are returned to the frontend.
7. Frontend displays findings and recommendations.

## 5. Negative Testing

The application should also be evaluated with:

- Empty source code.
- Invalid C syntax.
- Code without supported logic mistakes.
- Comments surrounding suspicious patterns.
- Complex or unsupported code structures.
- Backend unavailable during analysis.

The application should handle these situations without crashing and display appropriate results or errors.

## 6. Test Results

Record actual results after executing the test cases.

| Test ID | Actual Result | Status |
|---|---|---|
| TC-01 | To be recorded | Pending |
| TC-02 | To be recorded | Pending |
| TC-03 | To be recorded | Pending |
| TC-04 | To be recorded | Pending |
| TC-05 | To be recorded | Pending |
| TC-06 | To be recorded | Pending |
| TC-07 | To be recorded | Pending |
| TC-08 | To be recorded | Pending |
| TC-09 | To be recorded | Pending |
| TC-10 | To be recorded | Pending |
| TC-11 | To be recorded | Pending |
| TC-12 | To be recorded | Pending |

## 7. Known Testing Limitations

- Logic analysis uses predefined rules and supported code patterns.
- Complex C constructs may not be detected accurately.
- Some findings may require manual verification.
- The system performs static analysis and does not execute submitted programs.
- Frontend persistence depends on browser LocalStorage.

## 8. Conclusion

The testing strategy covers individual components, frontend-backend integration, and negative scenarios. Actual test results will be recorded after comprehensive validation.


## 9. Additional Integration Validation

The following checks were also completed successfully:

- FastAPI health endpoint returned a healthy status.
- Clang availability was confirmed.
- POST /analyze returned HTTP 200 with the expected analysis response.
- Frontend successfully connected to the backend.
- Live analysis updated when source code changed.
- Detected problems appeared at the expected source lines.
- Learning recommendations and exercises appeared for detected misconceptions.
- Exercise completion progress persisted after browser refresh.
- Corrected code removed the corresponding logic findings.
- Frontend TypeScript compilation and Vite production build succeeded.

Note: The production build reports a large JavaScript chunk warning due to Monaco Editor. This is a performance optimization opportunity, not a build failure.
