def split_sql_statements(sql: str) -> list[str]:
    statements: list[str] = []
    buffer: list[str] = []
    in_single_quote = False
    in_double_quote = False
    in_line_comment = False
    in_block_comment = False
    dollar_quote: str | None = None
    i = 0

    while i < len(sql):
        char = sql[i]
        nxt = sql[i + 1] if i + 1 < len(sql) else ""

        if dollar_quote is not None:
            buffer.append(char)
            if sql.startswith(dollar_quote, i):
                buffer.append(sql[i + 1 : i + len(dollar_quote)])
                i += len(dollar_quote)
                dollar_quote = None
            else:
                i += 1
            continue

        if in_line_comment:
            buffer.append(char)
            if char == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            buffer.append(char)
            if char == "*" and nxt == "/":
                buffer.append(nxt)
                i += 2
                in_block_comment = False
            else:
                i += 1
            continue

        if in_single_quote:
            buffer.append(char)
            if char == "'":
                if nxt == "'":
                    buffer.append(nxt)
                    i += 2
                    continue
                in_single_quote = False
            i += 1
            continue

        if in_double_quote:
            buffer.append(char)
            if char == '"':
                if nxt == '"':
                    buffer.append(nxt)
                    i += 2
                    continue
                in_double_quote = False
            i += 1
            continue

        if char == "$":
            tag = _read_dollar_quote(sql, i)
            if tag:
                dollar_quote = tag
                buffer.append(tag)
                i += len(tag)
                continue

        if char == "-" and nxt == "-":
            in_line_comment = True
            buffer.append(char)
            buffer.append(nxt)
            i += 2
            continue

        if char == "/" and nxt == "*":
            in_block_comment = True
            buffer.append(char)
            buffer.append(nxt)
            i += 2
            continue

        if char == "'":
            in_single_quote = True
            buffer.append(char)
            i += 1
            continue

        if char == '"':
            in_double_quote = True
            buffer.append(char)
            i += 1
            continue

        if char == ";":
            statement = "".join(buffer).strip()
            if statement:
                statements.append(statement)
            buffer = []
            i += 1
            continue

        buffer.append(char)
        i += 1

    tail = "".join(buffer).strip()
    if tail:
        statements.append(tail)
    return statements


def _read_dollar_quote(sql: str, index: int) -> str | None:
    end = index + 1
    while end < len(sql) and (sql[end].isalnum() or sql[end] == "_"):
        end += 1
    if end < len(sql) and sql[end] == "$":
        return sql[index : end + 1]
    return None
