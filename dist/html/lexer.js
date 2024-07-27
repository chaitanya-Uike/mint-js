export default function* lexer(strings, values) {
    let line = 1;
    let column = 1;
    let quoteBuffer = "";
    let spaceBuffer = "";
    let textBuffer = "";
    let bufferStart = 1;
    let quoteStarted = false;
    // TODO need to refactor this
    function* flushBuffer(type, buffer) {
        if (buffer.length) {
            yield {
                type,
                value: buffer,
                position: { line, column: bufferStart },
            };
            return "";
        }
        return buffer;
    }
    for (let idx = 0; idx < strings.length + values.length; idx++) {
        const piece = (idx % 2 === 1 ? values : strings)[Math.floor(idx / 2)];
        if (typeof piece === "string") {
            for (const char of piece) {
                if (isSpecialChar(char)) {
                    for (const token of flushBuffer("WHITE_SPACE", spaceBuffer)) {
                        yield token;
                    }
                    spaceBuffer = "";
                    for (const token of flushBuffer("TEXT", textBuffer)) {
                        yield token;
                    }
                    textBuffer = "";
                    yield {
                        type: SpecialTokens[char],
                        value: char,
                        position: { line, column },
                    };
                }
                else if (char === '"') {
                    if (quoteStarted) {
                        quoteBuffer += char;
                        for (const token of flushBuffer("QUOTED_STRING", quoteBuffer)) {
                            yield token;
                        }
                        quoteBuffer = "";
                        quoteStarted = false;
                    }
                    else {
                        for (const token of flushBuffer("TEXT", textBuffer)) {
                            yield token;
                        }
                        textBuffer = "";
                        quoteBuffer = char;
                        bufferStart = column;
                        quoteStarted = true;
                    }
                }
                else if (isWhitespace(char)) {
                    if (!quoteStarted) {
                        if (!spaceBuffer.length) {
                            for (const token of flushBuffer("TEXT", textBuffer)) {
                                yield token;
                            }
                            textBuffer = "";
                            bufferStart = column;
                        }
                        spaceBuffer += char;
                        if (char === "\n") {
                            line++;
                            column = 0;
                        }
                    }
                    else {
                        quoteBuffer += char;
                    }
                }
                else {
                    if (quoteStarted) {
                        quoteBuffer += char;
                    }
                    else {
                        for (const token of flushBuffer("WHITE_SPACE", spaceBuffer)) {
                            yield token;
                        }
                        spaceBuffer = "";
                        if (!textBuffer.length)
                            bufferStart = column;
                        textBuffer += char;
                    }
                }
                column++;
            }
        }
        else {
            for (const token of flushBuffer("WHITE_SPACE", spaceBuffer)) {
                yield token;
            }
            spaceBuffer = "";
            for (const token of flushBuffer("TEXT", textBuffer)) {
                yield token;
            }
            textBuffer = "";
            yield { type: "INTERPOLATION", value: piece, position: { line, column } };
            column++;
        }
    }
    if (quoteStarted) {
        throw new Error(`QUOTED_STRING at line: ${line} col: ${bufferStart} not closed`);
    }
    for (const token of flushBuffer("WHITE_SPACE", spaceBuffer)) {
        yield token;
    }
    for (const token of flushBuffer("TEXT", textBuffer)) {
        yield token;
    }
}
function isSpecialChar(char) {
    return char in SpecialTokens;
}
function isWhitespace(char) {
    return [" ", "\n", "\t", "\r"].includes(char);
}
const SpecialTokens = {
    "<": "LESS_THAN",
    ">": "GREATER_THAN",
    "/": "FORWARD_SLASH",
    "=": "EQUALS",
};
