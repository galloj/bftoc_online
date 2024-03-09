class MachineState {
    memory: (number|undefined)[] = [];
    pointer: (number|undefined) = 0;
    isInUndefinedDefaultState: boolean = false;
    constructor(public machineConfiguration: MachineConfiguration) {

    }

    // returns memoryLocationA - memoryLocationB
    getMemoryLocationDistance(memoryLocationA: MemoryLocation, memoryLocationB): number|undefined {
        if(memoryLocationA.relative && memoryLocationB.relative) {
            return memoryLocationA.index - memoryLocationB.index;
        }
        let memoryAddressA = this.getMemoryAddress(memoryLocationA);
        let memoryAddressB = this.getMemoryAddress(memoryLocationB);
        if(memoryAddressA === undefined || memoryAddressB === undefined) {
            return undefined;
        }
        return memoryAddressA - memoryAddressB;
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

    setMemoryToUndefinedState() {
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
            machineState.setMemoryToUndefinedState()
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
        if(!machineState.setMemoryValue(ast.location, undefined)) {
            machineState.setMemoryToUndefinedState()
        }
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
        return ast.condition.location !== undefined && ast.condition.location.relative;
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

// ensures there are no nested loops and that the loop starts and ends on the same position
function getLoopExecutionCount(ast: LoopNode, machineState: MachineState): number|undefined {
    const initialLoopControlValue = machineState.getValue(ast.condition);
    if(initialLoopControlValue === undefined) {
        return undefined;
    }
    const absoluteStartIndex = machineState.getMemoryAddress(new MemoryLocation(0, true));
    if(ast.condition.location === undefined) {
        return undefined;
    }
    const relativeLoopControlIndex = machineState.getMemoryLocationDistance(ast.condition.location, new MemoryLocation(0, true));
    let loopRelativeControlValueChange: number = 0;
    let currentRelativePos: number = 0;
    for(let child of ast.child.children) {
        if(child instanceof ListASTNode) {
            return undefined;
        } else if(child instanceof OutputNode) {
            // do nothing
        } else if(child instanceof InputNode) {
            if(currentRelativePos === relativeLoopControlIndex) {
                return undefined;
            }
        } else if(child instanceof ValueChangeNode) {
            let relativeAddr: number;
            if(child.memoryLocation.relative) {
                relativeAddr = currentRelativePos + child.memoryLocation.index;
            } else {
                if(absoluteStartIndex === undefined) {
                    return undefined;
                }
                relativeAddr = child.memoryLocation.index - absoluteStartIndex;
            }
            if(relativeAddr === relativeLoopControlIndex) {
                if(child.value.location !== undefined) {
                    let relativeValueAddr: number;
                    if(child.value.location.relative) {
                        relativeValueAddr = currentRelativePos + child.value.location.index;
                    } else {
                        if(absoluteStartIndex === undefined) {
                            return undefined;
                        }
                        relativeValueAddr = child.value.location.index - absoluteStartIndex;
                    }
                    if(relativeValueAddr !== relativeAddr) {
                        return undefined;
                    } else {
                        loopRelativeControlValueChange += child.value.value;
                    }
                } else {
                    return undefined;
                }
            }
        } else if(child instanceof PointerChangeNode) {
            if(child.value.relative) {
                currentRelativePos += child.value.index;
            } else {
                if(absoluteStartIndex === undefined) {
                    return undefined;
                }
                currentRelativePos = child.value.index - absoluteStartIndex;
            }
        } else if(child instanceof LoopNode) {
            return undefined;
        } else if(child instanceof CommentNode) {
            // do nothing
        } else {
            throw new Error("Unknown node type");
        }
    }
    if(currentRelativePos !== 0) {
        return undefined;
    }
    // solve (cnt * loopRelativeControlValueChange + initialLoopControlValue) % (machineState.machineConfiguration.cellMaxValue + 1) = 0
    let cnt = 0;
    let i = machineState.machineConfiguration.cellMaxValue + 1;
    let loopControlValueCopy = initialLoopControlValue;
    for(; i > 0 && loopControlValueCopy !== 0; i--) {
        loopControlValueCopy += loopRelativeControlValueChange;
        loopControlValueCopy %= machineState.machineConfiguration.cellMaxValue + 1;
        cnt += 1;
    }
    if(i === 0) {
        return undefined;
    }
    return cnt;
}

function getFlattenedLoop(ast: LoopNode, machineState: MachineState): ListASTNode|undefined {
    const loopExecutionCount = getLoopExecutionCount(ast, machineState);
    if(loopExecutionCount === undefined) {
        return undefined;
    }
    const absoluteStartIndex = machineState.getMemoryAddress(new MemoryLocation(0, true));
    let currentRelativePos = 0;
    const ret = new ListASTNode([]);
    for(let child of ast.child.children) {
        if(child instanceof ListASTNode) {
            return undefined;
        } else if(child instanceof OutputNode) {
            return undefined;
        } else if(child instanceof InputNode) {
            return undefined;
        } else if(child instanceof ValueChangeNode) {
            let dstAddr: number;
            if(child.memoryLocation.relative) {
                dstAddr = currentRelativePos + child.memoryLocation.index;
            } else {
                if(absoluteStartIndex === undefined) {
                    return undefined;
                }
                dstAddr = child.memoryLocation.index - absoluteStartIndex;
            }
            let srcAddr: number;
            if(child.value.location !== undefined) {
                if(child.value.location.relative) {
                    srcAddr = currentRelativePos + child.value.location.index;
                } else {
                    if(absoluteStartIndex === undefined) {
                        return undefined;
                    }
                    srcAddr = child.value.location.index - absoluteStartIndex;
                }
            } else {
                return undefined;
            }
            let newValue: Value;
            if(dstAddr === srcAddr) {
                newValue = new Value(child.value.value * loopExecutionCount, child.value.location);
            } else {
                return undefined;
            }
            const newNode = new ValueChangeNode(child.memoryLocation, newValue);
            ret.children.push(newNode);
        } else if(child instanceof PointerChangeNode) {
            if(child.value.relative) {
                currentRelativePos += child.value.index;
            } else {
                if(absoluteStartIndex === undefined) {
                    return undefined;
                }
                currentRelativePos = child.value.index - absoluteStartIndex;
            }
            ret.children.push(child);
        } else if(child instanceof LoopNode) {
            return undefined;
        } else if(child instanceof CommentNode) {
            ret.children.push(child);
        } else {
            throw new Error("Unknown node type");
        }
    }
    return ret;
}

function optimize(ast: ASTNode, machineState: MachineState, replaceSelfFunc: (ASTNode) => void): boolean {
    let optimized = false;
    if(ast instanceof ListASTNode) {
        let prevChild : (ASTNode|undefined) = undefined;
        let previousPointerChange : (PointerChangeNode|undefined) = undefined;
        for(let i = 0; i < ast.children.length; i++) {
            let child = ast.children[i];
            if(child instanceof ListASTNode) {
                // unwrap list
                ast.children.splice(i, 1, ...child.children);
                i--;
                optimized = true;
                continue;
            }
            optimized ||= optimize(child, machineState, (newNode) => {child = newNode; ast.children[i] = newNode});
            // the node merge needs to be performed after evaluation
            // otherwise some evaluations might be performed twice
            if(child instanceof ValueChangeNode && prevChild instanceof ValueChangeNode) {
                if(machineState.areMemoryLocationsSame(child.memoryLocation, prevChild.memoryLocation)) {
                    if(child.value.location !== undefined && machineState.areMemoryLocationsSame(child.value.location, child.memoryLocation)) {
                        child.value.value += prevChild.value.value;
                    }
                    ast.children.splice(i-1, 1);
                    prevChild = undefined;
                    i--;
                    optimized = true;
                }
            }
            if(prevChild instanceof PointerChangeNode && child instanceof ValueChangeNode) {
                let isAnyRelative = false;
                if(child.value.location?.relative) {
                    child.value.location.index += prevChild.value.index;
                    child.value.location.relative = prevChild.value.relative;
                    isAnyRelative = true;
                }
                if(child.memoryLocation.relative) {
                    child.memoryLocation.index += prevChild.value.index;
                    child.memoryLocation.relative = prevChild.value.relative;
                    isAnyRelative = true;
                }
                if(isAnyRelative) {
                    // swap order of prevChild and child
                    ast.children.splice(i-1, 2, new ListASTNode([child, prevChild]));
                    prevChild = undefined;
                    i--;
                    optimized = true;
                    continue;
                }
            }
            if(child instanceof PointerChangeNode) {
                if(previousPointerChange !== undefined) {
                    let index = ast.children.indexOf(previousPointerChange);
                    if(index == -1) {
                        continue;
                    }
                    if(previousPointerChange.value.relative) {
                        child.value.index += previousPointerChange.value.index;
                    }
                    child.value.relative = child.value.relative && previousPointerChange.value.relative;
                    ast.children.splice(index, 1);
                    prevChild = undefined;
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
        let flattenedLoop = getFlattenedLoop(ast, machineState);
        if(flattenedLoop !== undefined) {
            replaceSelfFunc(flattenedLoop);
            optimize(flattenedLoop, machineState, replaceSelfFunc);
            return true;
        }
        updateState(ast, machineState);
        if(ast.condition.location !== undefined && ast.condition.location.relative && machineState.pointer !== undefined) {
            ast.condition.location.index += machineState.pointer;
            ast.condition.location.relative = false;
            optimized = true;
        }
        optimized = optimize(ast.child, machineState, (newNode) => ast.child = newNode) || optimized;
        if(ast.child.children.length == 1 && ast.child.children[0] instanceof ValueChangeNode) {
            let valueChangeNode = ast.child.children[0] as ValueChangeNode;
            if(valueChangeNode.value.location?.equals(valueChangeNode.memoryLocation) && ast.condition.location?.equals(valueChangeNode.memoryLocation) && [1, -1].includes(valueChangeNode.value.value)) {
                let newAst = new ValueChangeNode(valueChangeNode.memoryLocation, new Value(-ast.condition.value));
                replaceSelfFunc(newAst);
                updateState(newAst, machineState);
                return true;
            }
        }
        updateState(ast, machineState);
    } if(ast instanceof ValueChangeNode) {
        let memoryAddress = machineState.getMemoryAddress(ast.memoryLocation);
        if(memoryAddress !== undefined && ast.memoryLocation.relative) {
            ast.memoryLocation = new MemoryLocation(memoryAddress, false);
            optimized = true;
        }
        if(ast.value.location !== undefined) {
            memoryAddress = machineState.getMemoryAddress(ast.value.location);
            if(memoryAddress !== undefined && ast.value.location.relative) {
                ast.value.location = new MemoryLocation(memoryAddress, false);
                optimized = true;
            }
        }
        if(ast.value.value == 0 && ast.value.location?.equals(ast.memoryLocation)) {
            replaceSelfFunc(new ListASTNode([]));
            return true;
        }
        if(ast.value.location !== undefined) {
            let value = machineState.getValue(ast.value);
            if(value !== undefined) {
                ast.value = new Value(value);
                optimized = true;
            }
        }
        let oldValue = machineState.getMemoryValue(ast.memoryLocation);
        let newValue = machineState.getValue(ast.value);
        if(oldValue !== undefined && oldValue === newValue) {
            replaceSelfFunc(new ListASTNode([]));
            return true;
        }
        updateState(ast, machineState);
    } else if(ast instanceof PointerChangeNode) {
        if(ast.value.relative && ast.value.index == 0) {
            replaceSelfFunc(new ListASTNode([]));
            return true;
        }
        let memoryAddress = machineState.getMemoryAddress(ast.value);
        if(memoryAddress !== undefined && memoryAddress === machineState.pointer) {
            replaceSelfFunc(new ListASTNode([]));
            return true;
        }
        if(memoryAddress !== undefined && ast.value.relative) {
            ast.value = new MemoryLocation(memoryAddress, false);
            optimized = true;
        }
        updateState(ast, machineState);
    } else if(ast instanceof InputNode) {
        if(ast.location.relative) { // check if optimalization makes sense (otherwise the node wouldn't change)
            let memoryAddress = machineState.getMemoryAddress(ast.location);
            if(memoryAddress !== undefined) {
                ast.location = new MemoryLocation(memoryAddress, false);
                optimized = true;
            }
        }
        updateState(ast, machineState);
    } else if(ast instanceof OutputNode) {
        if(ast.value.location !== undefined) { // check if optimalization makes sense (otherwise the node wouldn't change)
            let value = machineState.getValue(ast.value);
            if(value !== undefined) {
                ast.value = new Value(value);
                optimized = true;
            } else if(ast.value.location.relative) {
                let memoryAddress = machineState.getMemoryAddress(ast.value.location);
                if(memoryAddress !== undefined) {
                    ast.value.location = new MemoryLocation(memoryAddress, false);
                    optimized = true;
                }
            }
        }
        updateState(ast, machineState);
    } else {
        updateState(ast, machineState);
    }
    return optimized;
}