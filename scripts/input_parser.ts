class Tokenizer {
    index: number;
    currentToken: string = "";
    prev_row: number = 0;
    row: number = 0;
    prev_column: number = 0;
    column: number = 0;

    constructor(public input: string) {
        this.index = 0;
    }

    private getNextChar() {
        if(this.index >= this.input.length) {
            return "";
        }
        this.column += 1;
        let nextChar = this.input.charAt(this.index++);
        if(nextChar == "\n") {
            this.row += 1;
            this.column = 0;
        }
        return nextChar;
    }

    next(): string {
        this.prev_row = this.row;
        this.prev_column = this.column;
        if(this.index >= this.input.length) {
            this.currentToken = "";
            return "";
        }
        let retString = "";
        while (this.index < this.input.length && !"+-><,.[]".includes(this.input.charAt(this.index))) {
            retString += this.getNextChar();
        }
        if(retString.length > 0) {
            retString = retString.trim();
            if (retString == "") {
                return this.next();
            }
            this.currentToken = retString;
            return retString;
        }
        retString = this.getNextChar();
        this.currentToken = retString;
        return retString;
    }

    peek(): string {
        if (this.currentToken == "") {
            this.next();
        }
        return this.currentToken;
    }
}

class ParserException {
    constructor(public message: string, public row: number, public column: number) {}
}

function parse(input: Tokenizer): ListASTNode {
    let root = new ListASTNode([]);
    let token = input.next();
    while(token != "") {
        if(token == "+") {
            root.children.push(new ValueChangeNode(new MemoryLocation(0, true), new Value(1, new MemoryLocation(0, true))));
        } else if(token == "-") {
            root.children.push(new ValueChangeNode(new MemoryLocation(0, true), new Value(-1, new MemoryLocation(0, true))));
        } else if(token == ">") {
            root.children.push(new PointerChangeNode(new MemoryLocation(1, true)));
        } else if(token == "<") {
            root.children.push(new PointerChangeNode(new MemoryLocation(-1, true)));
        } else if(token == ".") {
            root.children.push(new OutputNode());
        } else if(token == ",") {
            root.children.push(new InputNode());
        } else if(token == "[") {
            let loop = new LoopNode(new Value(0, new MemoryLocation(0, true)), parse(input));
            root.children.push(loop);
            if (input.peek() != "]") {
                throw new ParserException("Expected ]", input.prev_row, input.prev_column);
            }
        } else if(token == "]") {
            return root;
        } else {
            root.children.push(new CommentNode(token));
        }
        token = input.next();
    }
    return root;
}

function parseRoot(input: string): ASTNode {
    let tokenizer = new Tokenizer(input);
    let ast = parse(tokenizer);
    if(tokenizer.peek() != "") {
        console.log(tokenizer.peek());
        throw new ParserException("Expected EOF", tokenizer.prev_row, tokenizer.prev_column);
    }
    return ast;
}