
import re


def mask_comments_and_strings(code: str) -> str:
    """Mask comments and literals while preserving positions and newlines."""
    pattern = re.compile(
        r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|'
        r"'(?:\\.|[^'\\])*'"
    )

    def replace(match):
        return "".join("\n" if c == "\n" else " " for c in match.group())

    return pattern.sub(replace, code)


def get_loop_body(code: str, opening_brace: int) -> str:
    """Extract a block while accounting for nested braces."""
    depth = 1
    position = opening_brace + 1

    while position < len(code) and depth:
        if code[position] == "{":
            depth += 1
        elif code[position] == "}":
            depth -= 1
        position += 1

    return code[opening_brace + 1:position - 1]


def variable_is_updated(variable: str, code: str) -> bool:
    """Detect common updates to a variable."""
    name = re.escape(variable)

    pattern = (
        rf"(?:\b{name}\s*(?:\+\+|--|\+=|-=)"
        rf"|\b(?:\+\+|--)\s*{name}\b"
        rf"|\b{name}\s*=(?!=))"
    )

    return re.search(pattern, code) is not None


def extract_loops(code: str):
    """Extract for/while loop headers and their bodies."""
    masked = mask_comments_and_strings(code)
    pattern = re.compile(r"\b(for|while)\s*\(")

    for match in pattern.finditer(masked):
        keyword = match.group(1)
        opening = masked.find("(", match.start())
        depth = 1
        position = opening + 1

        while position < len(masked) and depth:
            if masked[position] == "(":
                depth += 1
            elif masked[position] == ")":
                depth -= 1
            position += 1

        if depth:
            continue

        header = masked[opening + 1:position - 1]

        if keyword == "for":
            parts = []
            start = 0
            nested = 0

            for i, char in enumerate(header):
                if char == "(":
                    nested += 1
                elif char == ")":
                    nested -= 1
                elif char == ";" and nested == 0:
                    parts.append(header[start:i])
                    start = i + 1

            if len(parts) != 2:
                continue

            parts.append(header[start:])
            initialization, condition, update = parts
        else:
            initialization = ""
            condition = header
            update = ""

        brace = position
        while brace < len(masked) and masked[brace].isspace():
            brace += 1

        if brace >= len(masked) or masked[brace] != "{":
            continue

        body = get_loop_body(masked, brace)

        yield {
            "keyword": keyword,
            "initialization": initialization,
            "condition": condition,
            "update": update,
            "body": body,
            "start": match.start()
        }


def analyze_array_bounds(code: str) -> list[dict]:
    """Detect simple constant-size array indexing errors."""
    findings = []
    masked = mask_comments_and_strings(code)

    array_pattern = re.compile(
        r"\b(?:char|short|int|long|float|double)\s+"
        r"(\w+)\s*\[\s*(\d+)\s*\]"
    )

    arrays = {
        m.group(1): int(m.group(2))
        for m in array_pattern.finditer(masked)
    }

    for loop in extract_loops(masked):
        if loop["keyword"] != "for":
            continue

        init = re.search(
            r"\b([A-Za-z_]\w*)\s*=\s*0\b",
            loop["initialization"]
        )

        if not init:
            continue

        variable = init.group(1)
        name = re.escape(variable)

        condition = re.search(
            rf"\b{name}\s*(<=|<)\s*(\d+)\b",
            loop["condition"]
        )

        if not condition:
            continue

        update_pattern = (
            rf"(?:\b{name}\s*\+\+|\+\+\s*{name}\b|"
            rf"\b{name}\s*\+=\s*1)"
        )

        if not re.search(update_pattern, loop["update"]):
            continue

        operator = condition.group(1)
        boundary = int(condition.group(2))
        highest_index = boundary if operator == "<=" else boundary - 1

        for array_name, size in arrays.items():
            access = re.search(
                rf"\b{re.escape(array_name)}\s*"
                rf"\[\s*{name}\s*\]",
                loop["body"]
            )

            if not access or highest_index < size:
                continue

            line = masked.count("\n", 0, loop["start"]) + 1

            findings.append({
                "rule_id": "PLBD-ARR-001",
                "severity": "warning",
                "line": line,
                "column": 1,
                "title": "Possible array out-of-bounds access",
                "message": (
                    f"Loop may access {array_name}[{highest_index}], "
                    f"but valid indices are 0 to {size - 1}."
                ),
                "explanation": (
                    f"Array '{array_name}' contains {size} elements. "
                    f"Its valid indices are 0 to {size - 1}, "
                    f"but this loop may reach index {highest_index}."
                ),
                "suggestion": (
                    f"Check whether {variable} < {size} "
                    "is the correct loop condition."
                ),
                "confidence": "high"
            })

    return findings


def analyze_infinite_loops(code: str) -> list[dict]:
    """Detect loops whose apparent control variable is not updated."""
    findings = []

    for loop in extract_loops(code):
        variable = None

        if loop["keyword"] == "for":
            init = re.search(
                r"\b([A-Za-z_]\w*)\s*=\s*[^,]+",
                loop["initialization"]
            )

            if not init:
                continue

            variable = init.group(1)

            condition = re.search(
                rf"\b{re.escape(variable)}\s*(?:<|>|<=|>=|!=|==)",
                loop["condition"]
            )

            if not condition:
                continue

            if variable_is_updated(variable, loop["update"]):
                continue

        else:
            condition = re.search(
                r"\b([A-Za-z_]\w*)\s*(?:<|>|<=|>=|!=|==)",
                loop["condition"]
            )

            if not condition:
                continue

            variable = condition.group(1)

        if variable_is_updated(variable, loop["body"]):
            continue

        line = code.count("\n", 0, loop["start"]) + 1

        findings.append({
            "rule_id": "PLBD-LOOP-001",
            "severity": "warning",
            "line": line,
            "column": 1,
            "title": "Possible infinite loop",
            "message": (
                f"Loop variable '{variable}' does not appear "
                "to be updated."
            ),
            "explanation": (
                f"The loop condition depends on '{variable}', "
                "but no common update operation was detected "
                "in its header or body."
            ),
            "suggestion": (
                f"Check whether '{variable}' needs to be "
                "incremented, decremented, or otherwise updated."
            ),
            "confidence": "medium"
        })

    return findings


def analyze_assignment_in_condition(code: str) -> list[dict]:
    """Detect suspicious assignment operators in control conditions."""
    findings = []
    masked = mask_comments_and_strings(code)

    pattern = re.compile(
        r"\b(if|while|for)\s*\("
    )

    assignment = re.compile(r"(?<![=!<>+\-*/%&|^])=(?!=)")

    for match in pattern.finditer(masked):
        opening = masked.find("(", match.start())
        depth = 1
        position = opening + 1

        while position < len(masked) and depth:
            if masked[position] == "(":
                depth += 1
            elif masked[position] == ")":
                depth -= 1
            position += 1

        if depth:
            continue

        header = masked[opening + 1:position - 1]

        if match.group(1) == "for":
            semicolons = [
                i for i, char in enumerate(header) if char == ";"
            ]
            if len(semicolons) != 2:
                continue

            condition = header[semicolons[0] + 1:semicolons[1]]
            condition_start = opening + 1 + semicolons[0] + 1
        else:
            condition = header
            condition_start = opening + 1

        found = assignment.search(condition)

        if not found:
            continue

        absolute = condition_start + found.start()
        line = masked.count("\n", 0, absolute) + 1
        column = absolute - masked.rfind("\n", 0, absolute)

        findings.append({
            "rule_id": "PLBD-LOGIC-003",
            "severity": "warning",
            "line": line,
            "column": column,
            "title": "Possible assignment instead of comparison",
            "message": (
                f"A single assignment operator '=' was found "
                f"inside a {match.group(1)} condition."
            ),
            "explanation": (
                "'=' assigns a value, whereas '==' compares values. "
                "This may be an accidental assignment, although "
                "assignments inside conditions can be intentional."
            ),
            "suggestion": "Check whether you intended to use '==' instead of '='.",
            "confidence": "medium"
        })

    return findings


def analyze_code(code: str) -> list[dict]:
    """Run all registered PLBD logic-analysis rules."""
    rules = [
        analyze_array_bounds,
        analyze_infinite_loops,
        analyze_assignment_in_condition
    ]

    findings = []

    for rule in rules:
        findings.extend(rule(code))

    return findings
