function generatedOutputCode(ast: OutputNode, settings: CodeGenerationSettings): string {
    let generatedOutput = "";
    generatedOutput += settings.indent;
    generatedOutput += "putchar(" + ast.value + ");\n";
    return generatedOutput;
}

function generateInputCode(ast: InputNode, settings: CodeGenerationSettings): string {
    let generatedOutput = "";
    generatedOutput += settings.indent;
    if(ast.location != undefined) {
        generatedOutput += "mem[" + ast.location + "] = getchar();\n";
    } else {
        generatedOutput += "mem[ptr] = getchar();\n";
    }
    return generatedOutput;
}

function generateValueChangeCode(ast: ValueChangeNode, settings: CodeGenerationSettings): string {
    let generatedOutput = "";
    generatedOutput += settings.indent;
    generatedOutput += "mem["+ast.memoryLocation+"]";
    if(ast.value.location?.equals(ast.memoryLocation)) {
        if(ast.value.value == -1) {
            generatedOutput += "--;\n";
        } else if(ast.value.value == 1) {
            generatedOutput += "++;\n";
        } else if(ast.value.value < 0) {
            generatedOutput += " -= " + (-ast.value.value) + ";\n";
        } else {
            generatedOutput += " += " + ast.value.value + ";\n";
        }
    } else {
        generatedOutput += " = " + ast.value + ";\n";
    }
    return generatedOutput;
}

function generatePointerChangeCode(ast: PointerChangeNode, settings: CodeGenerationSettings): string {
    let generatedOutput = "";
    generatedOutput += settings.indent;
    if(ast.value.relative) {
        if(ast.value.index == -1) {
            generatedOutput += "ptr--;\n";
        } else if(ast.value.index == 1) {
            generatedOutput += "ptr++;\n";
        } else if(ast.value.index < 0) {
            generatedOutput += "ptr -= " + (-ast.value.index) + ";\n";
        } else {
            generatedOutput += "ptr += " + ast.value.index + ";\n";
        }
    } else {
        generatedOutput += "ptr = " + ast.value + ";\n";
    }
    return generatedOutput;
}

function generateLoopCode(ast: LoopNode, settings: CodeGenerationSettings): string {
    let generatedOutput = "";
    generatedOutput += settings.indent;
    generatedOutput += "while(mem[ptr]) {\n";
    let nestedSettings = new CodeGenerationSettings(settings.machineConfiguration, settings.indent + settings.machineConfiguration.indent, true);
    generatedOutput += generateNodeCode(ast.child, nestedSettings);
    generatedOutput += settings.indent + "}\n";
    return generatedOutput;
}

function generateCommentCode(ast: CommentNode, settings: CodeGenerationSettings): string {
    let generatedOutput = "";
    generatedOutput += settings.indent;
    if(ast.comment.includes("\n")) {
        let commentLines = ast.comment.split("\n");
        generatedOutput += "/*\n";
        for(let commentLine of commentLines) {
            generatedOutput += settings.indent + " * " + commentLine + "\n";
        }
        generatedOutput += settings.indent + " */\n";
    } else {
        generatedOutput += "// " + ast.comment + "\n";
    }
    return generatedOutput;
}

function generateNodeCode(ast: ASTNode, settings: CodeGenerationSettings) {
    if(ast instanceof ListASTNode) {
        return generateListCode(ast, settings);
    } else if(ast instanceof OutputNode) {
        return generatedOutputCode(ast, settings);
    } else if(ast instanceof InputNode) {
        return generateInputCode(ast, settings);
    } else if(ast instanceof ValueChangeNode) {
        return generateValueChangeCode(ast, settings);
    } else if(ast instanceof PointerChangeNode) {
        return generatePointerChangeCode(ast, settings);
    } else if(ast instanceof LoopNode) {
        return generateLoopCode(ast, settings);
    } else if(ast instanceof CommentNode) {
        return generateCommentCode(ast, settings);
    } else {
        throw new Error("Unknown node type");
    }
}

function generateCode(ast: ASTNode): string {
    let generatedOutput = "";
    generatedOutput += "#include <stdio.h>\n";
    generatedOutput += "int main() {\n";
    let indent = "    ";
    generatedOutput += indent + "unsigned char mem[30000] = {0};\n";
    generatedOutput += indent + "int ptr = 0;\n";
    generatedOutput += generateNodeCode(ast, new CodeGenerationSettings(new MachineConfiguration(255, 0, indent), indent, true));
    generatedOutput += indent + "return 0;\n";
    generatedOutput += "}\n";
    return generatedOutput;
}