
from typing import Any


MISCONCEPTION_MAP = {
    "PLBD-ARR-001": {
        "category_id": "ARRAY_CONCEPT",
        "category": "Array Indexing and Boundaries",
        "concept": "Array indexing",
        "misconception": (
            "The learner may believe that an array's size "
            "is also its highest valid index."
        ),
        "learning_explanation": (
            "In C, an array of size N has indices from 0 to N-1. "
            "The size itself is not a valid index."
        ),
        "recommended_action": (
            "Practise identifying valid array indices and "
            "writing loop conditions for array traversal."
        ),
    },
    "PLBD-LOOP-001": {
        "category_id": "LOOP_CONTROL",
        "category": "Loop Control and Termination",
        "concept": "Loop variable updates",
        "misconception": (
            "The learner may overlook the need to update "
            "a loop-control variable."
        ),
        "learning_explanation": (
            "A loop condition must eventually become false "
            "for the loop to terminate. If its control variable "
            "never changes, the loop may continue indefinitely."
        ),
        "recommended_action": (
            "Practise tracing loop variables and identifying "
            "the update required for loop termination."
        ),
    },
    "PLBD-LOGIC-003": {
        "category_id": "OPERATORS",
        "category": "Assignment vs Comparison",
        "concept": "Assignment and equality operators",
        "misconception": (
            "The learner may confuse the assignment operator '=' "
            "with the equality operator '=='."
        ),
        "learning_explanation": (
            "In C, '=' assigns a value, while '==' compares "
            "two values. An assignment inside a condition can "
            "be intentional, so this finding needs review."
        ),
        "recommended_action": (
            "Practise distinguishing assignment expressions "
            "from comparison expressions in conditions."
        ),
    },
}


def classify_findings(findings: list[dict]) -> list[dict]:
    """
    Convert analyzer findings into structured learning insights.
    Unknown rule IDs are safely ignored.
    """

    insights = []

    for finding in findings:
        rule_id = finding.get("rule_id")
        classification = MISCONCEPTION_MAP.get(rule_id)

        if classification is None:
            continue

        insight = {
            "rule_id": rule_id,
            "line": finding.get("line"),
            "severity": finding.get("severity", "warning"),
            "title": finding.get("title", "Learning insight"),
            **classification,
        }

        insights.append(insight)

    return insights
