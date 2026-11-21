EXERCISE_LIBRARY = {
    "ARRAY_CONCEPT": {
        "title": "Master Array Indexing",
        "focus": "Zero-based indexing and array boundaries",
        "lesson": (
            "C arrays use zero-based indexing. An array containing "
            "N elements has valid indices from 0 to N-1."
        ),
        "exercises": [
            {
                "id": "ARR-01",
                "title": "Identify valid indices",
                "difficulty": "Easy",
                "question": "An array contains 8 elements. What are its valid indices?",
                "hint": "The first index is always 0.",
                "answer": "0 to 7"
            },
            {
                "id": "ARR-02",
                "title": "Fix the loop boundary",
                "difficulty": "Easy",
                "question": "Correct this loop for an array containing 10 elements: for (int i = 0; i <= 10; i++)",
                "hint": "The final valid index is 9.",
                "answer": "for (int i = 0; i < 10; i++)"
            },
            {
                "id": "ARR-03",
                "title": "Trace array traversal",
                "difficulty": "Medium",
                "question": "How many times does a loop execute when i starts at 0 and continues while i < 6?",
                "hint": "Trace the values 0, 1, 2, ...",
                "answer": "6 times"
            }
        ]
    },

    "LOOP_CONTROL": {
        "title": "Understand Loop Control",
        "focus": "Loop conditions, updates and termination",
        "lesson": (
            "A loop must have a condition that can eventually become "
            "false. Its control variable usually needs an update."
        ),
        "exercises": [
            {
                "id": "LOOP-01",
                "title": "Find the missing update",
                "difficulty": "Easy",
                "question": "Identify the missing statement: int i = 0; while (i < 5) { printf(\"%d\", i); }",
                "hint": "What must happen to i after each iteration?",
                "answer": "i++"
            },
            {
                "id": "LOOP-02",
                "title": "Trace loop termination",
                "difficulty": "Easy",
                "question": "How many times does a loop execute if i starts at 1, increments by 1 and continues while i <= 5?",
                "hint": "List each value of i.",
                "answer": "5 times"
            },
            {
                "id": "LOOP-03",
                "title": "Understand loop updates",
                "difficulty": "Medium",
                "question": "What is the difference between i++, i-- and i += 2?",
                "hint": "Consider how each statement changes the variable.",
                "answer": "They increase i by 1, decrease i by 1, and increase i by 2 respectively."
            }
        ]
    },

    "OPERATORS": {
        "title": "Assignment vs Comparison",
        "focus": "Understanding = and ==",
        "lesson": (
            "The assignment operator = stores a value in a variable. "
            "The equality operator == compares two values. "
            "Assignment inside conditions can be intentional, so inspect the context."
        ),
        "exercises": [
            {
                "id": "OP-01",
                "title": "Identify the operator",
                "difficulty": "Easy",
                "question": "Which operator checks whether a == 10?",
                "hint": "One operator assigns; the other compares.",
                "answer": "=="
            },
            {
                "id": "OP-02",
                "title": "Correct the condition",
                "difficulty": "Easy",
                "question": "Write a condition that checks whether marks are equal to 50.",
                "hint": "Use the equality operator.",
                "answer": "marks == 50"
            },
            {
                "id": "OP-03",
                "title": "Understand assignment",
                "difficulty": "Medium",
                "question": "What does the statement x = 20 do?",
                "hint": "Does it compare x or change its value?",
                "answer": "It assigns 20 to x."
            }
        ]
    }
}


def build_recommendations(misconceptions: list[dict]) -> list[dict]:
    recommendations = []
    processed_categories = set()

    for misconception in misconceptions:
        category_id = misconception.get("category_id")

        if not category_id or category_id in processed_categories:
            continue

        exercise_data = EXERCISE_LIBRARY.get(category_id)

        if not exercise_data:
            continue

        processed_categories.add(category_id)

        recommendations.append({
            "category_id": category_id,
            "triggered_by": misconception.get("rule_id"),
            "title": exercise_data["title"],
            "focus": exercise_data["focus"],
            "lesson": exercise_data["lesson"],
            "exercises": exercise_data["exercises"]
        })

    return recommendations