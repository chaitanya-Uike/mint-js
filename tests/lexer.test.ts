import Lexer, { TOKEN, DYNAMIC_PLACEHOLDER, Token } from "../src/htm/lexer";

describe("Lexer", () => {
  const createLexer = (strings: string[], ...values: any[]) => {
    return new Lexer(strings as any, values);
  };

  const readAllTokens = (lexer: Lexer) => {
    const tokens: Token[] = [];
    let token: Token;
    while ((token = lexer.nextToken()) && token.type !== TOKEN.EOF) {
      tokens.push(token);
    }
    return [...tokens, token];
  };

  const createToken = (type: TOKEN, value: any, line = 1, column = 1): any => ({
    type,
    value,
    line,
    column,
  });

  describe("Basic HTML Syntax", () => {
    it("should tokenize a simple div tag", () => {
      const lexer = createLexer(['<div prop="value">Hello World!</div>']);
      const tokens = readAllTokens(lexer);
      expect(tokens).toEqual([
        createToken(TOKEN.OPEN_TAG, "<", 1, 1),
        createToken(TOKEN.TEXT, "div", 1, 2),
        createToken(TOKEN.WHITESPACE, " ", 1, 5),
        createToken(TOKEN.TEXT, "prop", 1, 6),
        createToken(TOKEN.ASSIGN, "=", 1, 10),
        createToken(TOKEN.STRING, '"value"', 1, 11),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 18),
        createToken(TOKEN.TEXT, "Hello", 1, 19),
        createToken(TOKEN.WHITESPACE, " ", 1, 24),
        createToken(TOKEN.TEXT, "World!", 1, 25),
        createToken(TOKEN.OPEN_CLOSING_TAG, "</", 1, 31),
        createToken(TOKEN.TEXT, "div", 1, 33),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 36),
        createToken(TOKEN.EOF, "", 1, 37),
      ]);
    });

    it("should tokenize multiple lines with self-closing tags", () => {
      const lexer = createLexer([
        `
      <div class="container">
        <img src="/logo.png"/>
        <p>Hello,
          <br/>
          World!</p>
      </div>`,
      ]);

      const tokens = readAllTokens(lexer);
      expect(tokens).toEqual([
        createToken(TOKEN.WHITESPACE, "\n      ", 2, 1),
        createToken(TOKEN.OPEN_TAG, "<", 2, 8),
        createToken(TOKEN.TEXT, "div", 2, 9),
        createToken(TOKEN.WHITESPACE, " ", 2, 12),
        createToken(TOKEN.TEXT, "class", 2, 13),
        createToken(TOKEN.ASSIGN, "=", 2, 18),
        createToken(TOKEN.STRING, '"container"', 2, 19),
        createToken(TOKEN.CLOSE_TAG, ">", 2, 30),
        createToken(TOKEN.WHITESPACE, "\n        ", 3, 1),
        createToken(TOKEN.OPEN_TAG, "<", 3, 10),
        createToken(TOKEN.TEXT, "img", 3, 11),
        createToken(TOKEN.WHITESPACE, " ", 3, 14),
        createToken(TOKEN.TEXT, "src", 3, 15),
        createToken(TOKEN.ASSIGN, "=", 3, 18),
        createToken(TOKEN.STRING, '"/logo.png"', 3, 19),
        createToken(TOKEN.CLOSING_SELF_TAG, "/>", 3, 30),
        createToken(TOKEN.WHITESPACE, "\n        ", 4, 1),
        createToken(TOKEN.OPEN_TAG, "<", 4, 10),
        createToken(TOKEN.TEXT, "p", 4, 11),
        createToken(TOKEN.CLOSE_TAG, ">", 4, 12),
        createToken(TOKEN.TEXT, "Hello,", 4, 13),
        createToken(TOKEN.WHITESPACE, "\n          ", 5, 1),
        createToken(TOKEN.OPEN_TAG, "<", 5, 12),
        createToken(TOKEN.TEXT, "br", 5, 13),
        createToken(TOKEN.CLOSING_SELF_TAG, "/>", 5, 15),
        createToken(TOKEN.WHITESPACE, "\n          ", 6, 1),
        createToken(TOKEN.TEXT, "World!", 6, 12),
        createToken(TOKEN.OPEN_CLOSING_TAG, "</", 6, 18),
        createToken(TOKEN.TEXT, "p", 6, 20),
        createToken(TOKEN.CLOSE_TAG, ">", 6, 21),
        createToken(TOKEN.WHITESPACE, "\n      ", 7, 1),
        createToken(TOKEN.OPEN_CLOSING_TAG, "</", 7, 8),
        createToken(TOKEN.TEXT, "div", 7, 10),
        createToken(TOKEN.CLOSE_TAG, ">", 7, 13),
        createToken(TOKEN.EOF, "", 7, 14),
      ]);
    });
  });

  describe("Comments", () => {
    it("should tokenize HTML comments", () => {
      const lexer = createLexer(["<div><!-- This is a comment -->Hello</div>"]);
      const tokens = readAllTokens(lexer);
      expect(tokens).toEqual([
        createToken(TOKEN.OPEN_TAG, "<", 1, 1),
        createToken(TOKEN.TEXT, "div", 1, 2),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 5),
        createToken(TOKEN.COMMENT_OPEN, "<!--", 1, 6),
        createToken(TOKEN.WHITESPACE, " ", 1, 10),
        createToken(TOKEN.TEXT, "This", 1, 11),
        createToken(TOKEN.WHITESPACE, " ", 1, 15),
        createToken(TOKEN.TEXT, "is", 1, 16),
        createToken(TOKEN.WHITESPACE, " ", 1, 18),
        createToken(TOKEN.TEXT, "a", 1, 19),
        createToken(TOKEN.WHITESPACE, " ", 1, 20),
        createToken(TOKEN.TEXT, "comment", 1, 21),
        createToken(TOKEN.WHITESPACE, " ", 1, 28),
        createToken(TOKEN.COMMENT_CLOSE, "-->", 1, 29),
        createToken(TOKEN.TEXT, "Hello", 1, 32),
        createToken(TOKEN.OPEN_CLOSING_TAG, "</", 1, 37),
        createToken(TOKEN.TEXT, "div", 1, 39),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 42),
        createToken(TOKEN.EOF, "", 1, 43),
      ]);
    });
  });

  describe("Dynamic Content", () => {
    it("should tokenize dynamic attribute values", () => {
      const value = "test-class";
      const lexer = createLexer(["<div class=", "></div>"], value);
      const tokens = readAllTokens(lexer);
      const dx = DYNAMIC_PLACEHOLDER.length;
      expect(tokens).toEqual([
        createToken(TOKEN.OPEN_TAG, "<", 1, 1),
        createToken(TOKEN.TEXT, "div", 1, 2),
        createToken(TOKEN.WHITESPACE, " ", 1, 5),
        createToken(TOKEN.TEXT, "class", 1, 6),
        createToken(TOKEN.ASSIGN, "=", 1, 11),
        createToken(TOKEN.DYNAMIC, value, 1, 12),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 13 + dx),
        createToken(TOKEN.OPEN_CLOSING_TAG, "</", 1, 14 + dx),
        createToken(TOKEN.TEXT, "div", 1, 16 + dx),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 19 + dx),
        createToken(TOKEN.EOF, "", 1, 20 + dx),
      ]);
    });

    it("should tokenize dynamic attribute names", () => {
      const propName = "data-test";
      const lexer = createLexer(["<div ", '="value"></div>'], propName);
      const tokens = readAllTokens(lexer);
      const dx = DYNAMIC_PLACEHOLDER.length;
      expect(tokens).toEqual([
        createToken(TOKEN.OPEN_TAG, "<", 1, 1),
        createToken(TOKEN.TEXT, "div", 1, 2),
        createToken(TOKEN.WHITESPACE, " ", 1, 5),
        createToken(TOKEN.DYNAMIC, propName, 1, 6),
        createToken(TOKEN.ASSIGN, "=", 1, 7 + dx),
        createToken(TOKEN.STRING, '"value"', 1, 8 + dx),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 15 + dx),
        createToken(TOKEN.OPEN_CLOSING_TAG, "</", 1, 16 + dx),
        createToken(TOKEN.TEXT, "div", 1, 18 + dx),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 21 + dx),
        createToken(TOKEN.EOF, "", 1, 22 + dx),
      ]);
    });

    it("should tokenize dynamic child content", () => {
      const content = "Dynamic content";
      const lexer = createLexer(["<div>", "</div>"], content);
      const tokens = readAllTokens(lexer);
      const dx = DYNAMIC_PLACEHOLDER.length;
      expect(tokens).toEqual([
        createToken(TOKEN.OPEN_TAG, "<", 1, 1),
        createToken(TOKEN.TEXT, "div", 1, 2),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 5),
        createToken(TOKEN.DYNAMIC, content, 1, 6),
        createToken(TOKEN.OPEN_CLOSING_TAG, "</", 1, 7 + dx),
        createToken(TOKEN.TEXT, "div", 1, 9 + dx),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 12 + dx),
        createToken(TOKEN.EOF, "", 1, 13 + dx),
      ]);
    });
  });

  describe("String Variations", () => {
    it("should tokenize single quoted strings", () => {
      const lexer = createLexer(["<div prop='value'></div>"]);
      const tokens = readAllTokens(lexer);
      expect(tokens).toEqual([
        createToken(TOKEN.OPEN_TAG, "<", 1, 1),
        createToken(TOKEN.TEXT, "div", 1, 2),
        createToken(TOKEN.WHITESPACE, " ", 1, 5),
        createToken(TOKEN.TEXT, "prop", 1, 6),
        createToken(TOKEN.ASSIGN, "=", 1, 10),
        createToken(TOKEN.STRING, "'value'", 1, 11),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 18),
        createToken(TOKEN.OPEN_CLOSING_TAG, "</", 1, 19),
        createToken(TOKEN.TEXT, "div", 1, 21),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 24),
        createToken(TOKEN.EOF, "", 1, 25),
      ]);
    });
  });

  describe("Spread Operator", () => {
    it("should tokenize spread attributes", () => {
      const props = { id: "test", class: "example" };
      const lexer = createLexer(["<div ...", "></div>"], props);
      const tokens = readAllTokens(lexer);
      const dx = DYNAMIC_PLACEHOLDER.length;
      expect(tokens).toEqual([
        createToken(TOKEN.OPEN_TAG, "<", 1, 1),
        createToken(TOKEN.TEXT, "div", 1, 2),
        createToken(TOKEN.WHITESPACE, " ", 1, 5),
        createToken(TOKEN.SPREAD, "...", 1, 6),
        createToken(TOKEN.DYNAMIC, props, 1, 9),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 10 + dx),
        createToken(TOKEN.OPEN_CLOSING_TAG, "</", 1, 11 + dx),
        createToken(TOKEN.TEXT, "div", 1, 13 + dx),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 16 + dx),
        createToken(TOKEN.EOF, "", 1, 17 + dx),
      ]);
    });

    it("should tokenize spread with other attributes", () => {
      const props = { id: "test" };
      const lexer = createLexer(['<div class="main" ...', "></div>"], props);
      const tokens = readAllTokens(lexer);
      const dx = DYNAMIC_PLACEHOLDER.length;
      expect(tokens).toEqual([
        createToken(TOKEN.OPEN_TAG, "<", 1, 1),
        createToken(TOKEN.TEXT, "div", 1, 2),
        createToken(TOKEN.WHITESPACE, " ", 1, 5),
        createToken(TOKEN.TEXT, "class", 1, 6),
        createToken(TOKEN.ASSIGN, "=", 1, 11),
        createToken(TOKEN.STRING, '"main"', 1, 12),
        createToken(TOKEN.WHITESPACE, " ", 1, 18),
        createToken(TOKEN.SPREAD, "...", 1, 19),
        createToken(TOKEN.DYNAMIC, props, 1, 22),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 23 + dx),
        createToken(TOKEN.OPEN_CLOSING_TAG, "</", 1, 24 + dx),
        createToken(TOKEN.TEXT, "div", 1, 26 + dx),
        createToken(TOKEN.CLOSE_TAG, ">", 1, 29 + dx),
        createToken(TOKEN.EOF, "", 1, 30 + dx),
      ]);
    });
  });
});
