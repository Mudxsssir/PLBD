
import sys

from logic_analyzer import analyze_code


tests = [
    (
        "Array boundary error",
        """
        int main() {
            int numbers[5];
            for (int i = 0; i <= 5; i++) {
                numbers[i] = i;
            }
            return 0;
        }
        """,
        "PLBD-ARR-001"
    ),
    (
        "Correct array boundary",
        """
        int main() {
            int numbers[5];
            for (int i = 0; i < 5; i++) {
                numbers[i] = i;
            }
            return 0;
        }
        """,
        None
    ),
    (
        "Infinite for-loop",
        """
        int main() {
            for (int i = 0; i < 5;) {
                printf("%d", i);
            }
            return 0;
        }
        """,
        "PLBD-LOOP-001"
    ),
    (
        "Correct for-loop",
        """
        int main() {
            for (int i = 0; i < 5; i++) {
                printf("%d", i);
            }
            return 0;
        }
        """,
        None
    ),
    (
        "Infinite while-loop",
        """
        int main() {
            int i = 0;
            while (i < 5) {
                printf("%d", i);
            }
            return 0;
        }
        """,
        "PLBD-LOOP-001"
    ),
    (
        "Correct while-loop",
        """
        int main() {
            int i = 0;
            while (i < 5) {
                printf("%d", i);
                i++;
            }
            return 0;
        }
        """,
        None
    ),
    (
        "Unbraced while-loop without update",
        """
        int main(void) {
            int i = 0;
            while (i < 5)
                printf("%d", i);
            return 0;
        }
        """,
        "PLBD-LOOP-001"
    ),
    (
        "Unbraced while-loop with update",
        """
        int main(void) {
            int i = 0;
            while (i < 5)
                i++;
            return 0;
        }
        """,
        None
    ),
    (
        "Unbraced for-loop array boundary",
        """
        int main(void) {
            int values[3];
            for (int i = 0; i <= 3; i++)
                values[i] = i;
            return 0;
        }
        """,
        "PLBD-ARR-001"
    ),
    (
        "Assignment instead of comparison",
        """
        int main() {
            int x = 5;
            if (x = 10) {
                printf("Hello");
            }
            return 0;
        }
        """,
        "PLBD-LOGIC-003"
    ),
    (
        "Correct comparison",
        """
        int main() {
            int x = 5;
            if (x == 10) {
                printf("Hello");
            }
            return 0;
        }
        """,
        None
    ),
    (
        "Assignment inside comment",
        """
        int main() {
            int x = 5;
            // if (x = 10)
            if (x == 5) {
                return 0;
            }
        }
        """,
        None
    ),
]


passed_count = 0

for name, code, expected_rule in tests:
    findings = analyze_code(code)

    if expected_rule is None:
        passed = len(findings) == 0
    else:
        passed = any(
            finding["rule_id"] == expected_rule
            for finding in findings
        )

    if passed:
        passed_count += 1

    print(f"{'PASSED' if passed else 'FAILED'}: {name}")

    for finding in findings:
        print(
            f"  {finding['rule_id']}: "
            f"{finding['title']}"
        )

    print()


print(f"RESULT: {passed_count}/{len(tests)} tests passed.")

if passed_count != len(tests):
    sys.exit(1)
