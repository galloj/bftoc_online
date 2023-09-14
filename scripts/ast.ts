class MemoryLocation {
    constructor(public index: number, public relative: boolean) {}

    toString(): string {
        let output = "";
        if(this.relative) {
            output += "ptr";
            if(this.index > 0) {
                output += " + " + this.index;
            } else if(this.index < 0) {
                output += " - " + (-this.index);
            }
        } else {
            output += this.index;
        }
        return output;
    }

    equals(other: MemoryLocation): boolean {
        return this.index === other.index && this.relative === other.relative;
    }
}

class Value {
    constructor(public value: number, public location: MemoryLocation|undefined = undefined) {}

    toString(): string {
        let output = "";
        if(this.location != undefined) {
            output += "mem["+this.location.toString()+"]";
            if(this.value != 0) {
                if(this.value < 0) {
                    output += " - ";
                } else {
                    output += " + ";
                }
                output += Math.abs(this.value);
            }
        } else {
            output += this.value;
        }
        return output;
    }
}

class ASTNode {}
class ListASTNode extends ASTNode {
    constructor(public children: ASTNode[]) {
        super();
    }
}
class OutputNode extends ASTNode {
    constructor(public value: Value = new Value(0, new MemoryLocation(0, true))) {
        super();
    }
}
class InputNode extends ASTNode {
    constructor(public location: MemoryLocation = new MemoryLocation(0, true)) {
        super();
    }
}
class ValueChangeNode extends ASTNode {
    constructor(public memoryLocation: MemoryLocation, public value: Value) {
        super();
    }
}
class PointerChangeNode extends ASTNode {
    constructor(public value: MemoryLocation) {
        super();
    }
}
class LoopNode extends ASTNode {
    constructor(public child: ASTNode) {
        super();
    }
}
class CommentNode extends ASTNode {
    constructor(public comment: string) {
        super();
    }
}

class MachineConfiguration {
    constructor(public cellMaxValue: number, public defaultMemoryValue: number|undefined, public indent: string) {}
}


class CodeGenerationSettings {
    constructor(public machineConfiguration: MachineConfiguration, public indent: string, public isInsideList: boolean) {}
}

function generateListCode(ast: ListASTNode, settings: CodeGenerationSettings): string {
    let generatedOutput = "";
    if(!settings.isInsideList) {
        generatedOutput += "{\n";
    }
    let newIndent = settings.indent + (settings.isInsideList ? "" : settings.machineConfiguration.indent);
    let nestedSettings = new CodeGenerationSettings(settings.machineConfiguration, newIndent, true);
    for(let child of ast.children) {
        generatedOutput += generateNodeCode(child, nestedSettings);
    }
    if(!settings.isInsideList) {
        generatedOutput += settings.indent + "}\n";
    }
    return generatedOutput;
}