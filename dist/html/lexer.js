export default function* lexer(strings, values) {
    let line = 1;
    let column = 1;
    let spaceBuffer = "";
    let textBuffer = "";
    let bufferStart = 1;
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
                else if (isWhitespace(char)) {
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
                    for (const token of flushBuffer("WHITE_SPACE", spaceBuffer)) {
                        yield token;
                    }
                    spaceBuffer = "";
                    if (!textBuffer.length)
                        bufferStart = column;
                    textBuffer += char;
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
    '"': "QUOTE",
};
