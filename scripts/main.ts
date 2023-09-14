function compile() {
    let inputElement = document.getElementById("input") as HTMLTextAreaElement;
    if (inputElement == null) {
        console.error("Input element not found");
        return;
    }
    let input = inputElement.value;
    let outputElement = document.getElementById("output") as HTMLTextAreaElement;
    if (outputElement == null) {
        console.error("Output element not found");
        return;
    }

    let ast = parseRoot(input);
    while(optimize(ast, new MachineState(new MachineConfiguration(255, 0, "    ")))) {
        console.log("Optimizing...")
    }
    outputElement.value = generateCode(ast);
    return;
}