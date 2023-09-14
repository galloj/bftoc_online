class MachineState {
    memory: (number|undefined)[] = [];
    pointer: (number|undefined) = 0;
    isInUndefinedDefaultState: boolean = false;
    constructor(public machineConfiguration: MachineConfiguration) {

    }

    getMemoryAddress(memoryLocation: MemoryLocation): number|undefined {
        if(memoryLocation.relative) {
            if(this.pointer === undefined) {
                return undefined;
            }
            return this.pointer + memoryLocation.index;
        } else {
            return memoryLocation.index;
        }
    }

    getMemoryValue(memoryLocation: MemoryLocation|number): number|undefined {
        let getMemoryAddress: number|undefined;
        if(typeof memoryLocation === "number") {
            getMemoryAddress = memoryLocation;
        } else {
            getMemoryAddress = this.getMemoryAddress(memoryLocation);
        }
        if(getMemoryAddress === undefined) {
            return undefined;
        }
        if(getMemoryAddress in this.memory) {
            return this.memory[getMemoryAddress];
        }
        if(this.isInUndefinedDefaultState) {
            return undefined;
        }
        return this.machineConfiguration.defaultMemoryValue;
    }

    getValue(value: Value): number|undefined {
        if(value.location != undefined) {
            let memValue = this.getMemoryValue(value.location);
            if(memValue === undefined) {
                return undefined;
            }
            return memValue + value.value;
        } else {
            return value.value;
        }
    }

    setToUndefinedState() {
        this.memory = [];
        this.isInUndefinedDefaultState = true;
    }

    setMemoryValue(memoryLocation: MemoryLocation, value: number|undefined): boolean {
        let memoryAddress = this.getMemoryAddress(memoryLocation);
        if(memoryAddress === undefined) {
            return false;
        }
        this.memory[memoryAddress] = value;
        return true;
    }

    clone(): MachineState {
        let clone = new MachineState(this.machineConfiguration);
        clone.memory = this.memory.slice();
        clone.pointer = this.pointer;
        return clone;
    }

    equals(other: MachineState): boolean {
        if(this.pointer !== other.pointer) {
            return false;
        }
        let thisKeys = Reflect.ownKeys(this.memory);
        let otherKeys = Reflect.ownKeys(other.memory);
        if(thisKeys.length != otherKeys.length) {
            return false;
        }
        for(let key of thisKeys) {
            if(!(key in other.memory)) {
                return false;
            }
            if(this.memory[key] !== other.memory[key]) {
                return false;
            }
        }
        return true;
    }

    merge(other: MachineState): boolean {
        let changed = false;
        if(this.pointer !== other.pointer) {
            if(this.pointer !== undefined) {
                changed = true;
            }
            this.pointer = undefined;
        }
        let thisKeys = Reflect.ownKeys(this.memory);
        let otherKeys = Reflect.ownKeys(other.memory);
        for(let key of thisKeys) {
            if(key == "length") {
                continue;
            }
            if(this.getMemoryValue(Number(key)) !== other.getMemoryValue(Number(key))) {
                if(this.getMemoryValue(Number(key)) !== undefined) {
                    changed = true;
                }
                this.memory[key] = undefined;
            }
        }
        for(let key of otherKeys) {
            if(key == "length") {
                continue;
            }
            if(this.getMemoryValue(Number(key)) !== other.getMemoryValue(Number(key))) {
                if(other.getMemoryValue(Number(key)) !== undefined) {
                    changed = true;
                }
                this.memory[key] = undefined;
            }
        }
        return changed;
    }

    areMemoryLocationsSame(memoryLocation1: MemoryLocation, memoryLocation2: MemoryLocation): boolean {
        let address1 = this.getMemoryAddress(memoryLocation1);
        let address2 = this.getMemoryAddress(memoryLocation2);
        if(address1 === undefined || address2 === undefined) {
            return memoryLocation1.equals(memoryLocation2);
        }
        return address1 === address2;
    }
}

function updateState(ast: ASTNode, machineState: MachineState) {
    if(ast instanceof ListASTNode) {
        for(let child of ast.children) {
            updateState(child, machineState);
        }
    } else if(ast instanceof ValueChangeNode) {
        let currentValue = machineState.getMemoryValue(ast.memoryLocation);
        if(currentValue === undefined) {
            return;
        }
        let newValue = machineState.getValue(ast.value);
        if(machineState.setMemoryValue(ast.memoryLocation, newValue)) {
            // unable to set memory value, handle this
        }
    } else if(ast instanceof PointerChangeNode) {
        machineState.pointer = machineState.getMemoryAddress(ast.value);
    } else if(ast instanceof LoopNode) {
        let currentState = machineState.clone();
        updateState(ast.child, currentState);
        while(machineState.merge(currentState)) {
            currentState = machineState.clone();
            updateState(ast.child, currentState);
        }
    } else if(ast instanceof OutputNode) {
        // do nothing
    } else if(ast instanceof InputNode) {
        machineState.setMemoryValue(ast.location, undefined);
    } else if(ast instanceof CommentNode) {
        // do nothing
    } else {
        throw new Error("Unknown node type");
    }
}

function doesNodeUsePointer(ast: ASTNode): boolean {
    if(ast instanceof ListASTNode) {
        for(let child of ast.children) {
            if(doesNodeUsePointer(child)) {
                return true;
            }
        }
    } else if(ast instanceof ValueChangeNode) {
        if(ast.memoryLocation.relative) {
            return true;
        }
        if(ast.value.location !== undefined && ast.value.location.relative) {
            return true;
        }
    } else if(ast instanceof PointerChangeNode) {
        if(ast.value.relative) {
            return true;
        }
    } else if(ast instanceof LoopNode) {
        return true;
    } else if(ast instanceof OutputNode) {
        if(ast.value.location !== undefined && ast.value.location.relative) {
            return true;
        }
    } else if(ast instanceof InputNode) {
        if(ast.location.relative) {
            return true;
        }
    } else if(ast instanceof CommentNode) {
        // do nothing
    } else {
        throw new Error("Unknown node type");
    }
    return false;
}

function optimize(ast: ASTNode, machineState: MachineState): boolean {
    let optimized = false;
    if(ast instanceof ListASTNode) {
        let prevChild : (ASTNode|undefined) = undefined;
        let previousPointerChange : (PointerChangeNode|undefined) = undefined;
        for(let i = 0; i < ast.children.length; i++) {
            let child = ast.children[i];
            if(child instanceof ValueChangeNode && prevChild instanceof ValueChangeNode) {
                if(machineState.areMemoryLocationsSame(child.memoryLocation, prevChild.memoryLocation)) {
                    if(child.value.location !== undefined && machineState.areMemoryLocationsSame(child.value.location, child.memoryLocation)) {
                        child.value.value += prevChild.value.value;
                    }
                    ast.children.splice(i-1, 1);
                    i--;
                    optimized = true;
                }
            }
            optimized = optimize(child, machineState) || optimized;
            // the node merge needs to be performed after evaluation
            // otherwise some evaluations might be performed twice
            if(child instanceof PointerChangeNode) {
                if(previousPointerChange !== undefined) {
                    let index = ast.children.indexOf(previousPointerChange);
                    if(index == -1) {
                        throw new Error("Previous pointer change not found");
                    }
                    if(previousPointerChange.value.relative) {
                        child.value.index += previousPointerChange.value.index;
                    }
                    child.value.relative = child.value.relative && previousPointerChange.value.relative;
                    ast.children.splice(index, 1);
                    i--;
                    optimized = true;
                }
                previousPointerChange = child;
            } else if(doesNodeUsePointer(child)) {
                previousPointerChange = undefined;
            }
            prevChild = child;
        }
    } else if(ast instanceof LoopNode) {
        updateState(ast, machineState);
        optimized = optimize(ast.child, machineState) || optimized;
        // TODO
        updateState(ast, machineState);
    } if(ast instanceof ValueChangeNode) {
        let memoryAddress = machineState.getMemoryAddress(ast.memoryLocation);
        if(memoryAddress !== undefined) {
            ast.memoryLocation = new MemoryLocation(memoryAddress, false);
        }
        if(ast.value.location !== undefined) {
            memoryAddress = machineState.getMemoryAddress(ast.value.location);
            if(memoryAddress !== undefined) {
                ast.value.location = new MemoryLocation(memoryAddress, false);
            }
        }
        updateState(ast, machineState);
    } else if(ast instanceof PointerChangeNode) {
        let memoryAddress = machineState.getMemoryAddress(ast.value);
        if(memoryAddress !== undefined) {
            ast.value = new MemoryLocation(memoryAddress, false);
        }
        updateState(ast, machineState);
    } else if(ast instanceof InputNode) {
        if(ast.location.relative) { // check if optimalization makes sense (otherwise the node wouldn't change)
            let memoryAddress = machineState.getMemoryAddress(ast.location);
            if(memoryAddress !== undefined) {
                ast.location = new MemoryLocation(memoryAddress, false);
            }
        }
        updateState(ast, machineState);
    } else if(ast instanceof OutputNode) {
        if(ast.value.location !== undefined) { // check if optimalization makes sense (otherwise the node wouldn't change)
            let value = machineState.getValue(ast.value);
            if(value !== undefined) {
                ast.value = new Value(value);
            } else if(ast.value.location.relative) {
                let memoryAddress = machineState.getMemoryAddress(ast.value.location);
                if(memoryAddress !== undefined) {
                    ast.value.location = new MemoryLocation(memoryAddress, false);
                }
            }
        }
        updateState(ast, machineState);
    } else {
        updateState(ast, machineState);
    }
    return optimized;
}