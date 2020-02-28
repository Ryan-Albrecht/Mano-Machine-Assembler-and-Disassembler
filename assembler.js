const OPCODES = {
    "AND": 0x0000,
    "ADD": 0x1000,
    "LDA": 0x2000,
    "STA": 0x3000,
    "BUN": 0x4000,
    "BSA": 0x5000,
    "ISZ": 0x6000,
    "CLA": 0x7800,
    "CLE": 0x7400,
    "CMA": 0x7200,
    "CME": 0x7100,
    "CIR": 0x7080,
    "CIL": 0x7040,
    "INC": 0x7020,
    "SPA": 0x7010,
    "SNA": 0x7008,
    "SZA": 0x7004,
    "SZE": 0x7002,
    "HLT": 0x7001,
    "INP": 0xF800,
    "OUT": 0xF400,
    "SKI": 0xF200,
    "SKO": 0xF100,
    "ION": 0xF080,
    "IOF": 0xF040,
};

// used for disassembler
let reverseOpcodeMap = {};
for (var key in OPCODES) {
    if (OPCODES.hasOwnProperty(key)) {
        reverseOpcodeMap[OPCODES[key]] = key;
    }
}

let symbols = {};


window.onload = function(){

    // read in assembly file to TextArea
    document.getElementById('assemblyFile').addEventListener('change', () => { readToTextArea("assembly") });

    // read in machine file to TextArea
    document.getElementById('machineFile').addEventListener('change', () => { readToTextArea("machine") });

    function readToTextArea(type){
        let reader = new FileReader();

        reader.onload = function (e) {
            let textArea = document.getElementById(type + "Text");
            textArea.value = e.target.result;
        };
        let file = document.getElementById(type + "File").files[0];
        reader.readAsText(file);
    }

}


function assemble(){
    // clear textAreas
    document.getElementById('symbolsText').value = "";
    document.getElementById('machineText').value = "";

    // array of lines
    let lines = document.getElementById('assemblyText').value.split('\n');
    
    firstPass(lines);
    secondPath(lines);
}


class Instruction {
    constructor(line) {
        // remove duplicate whitespace and trim
        line = line.replace(/\s+/g, " ").trim();

        let elements = line.split(" ");

        this.indirect = false;

        let knownLength = 0;

        // starts with label
        if (elements[0].includes(",")) {
            this.label = elements[0].substring(0, 3);
            this.mnemonic = elements[1];

            knownLength = 2;
        }
        // starts with mnemonic
        else {
            this.mnemonic = elements[0];
            knownLength = 1;
        }

        if (elements.length > knownLength) {
            this.operand = elements[knownLength];
        }
        if (elements.length > (knownLength + 1)){
            this.indirect = (elements[knownLength + 1].toUpperCase() === "I")
        }

    }
}


// create symbol file
function firstPass(lines){
    let lineCounter = 0;
    for (line of lines){

        let instruction = new Instruction(line);
        
        if (instruction.mnemonic === "ORG"){
            lineCounter = parseInt(instruction.operand, 16);
            continue;
        }else if(typeof instruction.label !== 'undefined' && instruction.label.length === 3){
            lineCounterHexString = lineCounter.toString(16).toUpperCase();
            document.getElementById('symbolsText').value += `${instruction.label} ${lineCounterHexString}\n`;
            symbols[instruction.label] = lineCounterHexString;
        }
        lineCounter++;
    }
}    


// assembling
function secondPath(lines){
    let lineCounter = 0;
    for (const line of lines){

        instruction = new Instruction(line);

        // update operand based on symbol table
        if(instruction.operand in symbols){
            instruction.operand = symbols[instruction.operand];
        }

        if (instruction.mnemonic === "ORG"){
            lineCounter = parseInt(instruction.operand, 16);
            continue;
        }
        else if(instruction.mnemonic === "END"){
            break;
        }
        else if(instruction.mnemonic === "DEC"){
            let operand = parseInt(instruction.operand, 10);

            // do two's complement if necessary
            instruction.value = operand >= 0 ? operand : (1 << 16) + operand;
        }
        else if(instruction.mnemonic === "HEX"){
            let operand = parseInt(instruction.operand, 16);
            instruction.value = operand >= 0 ? operand : (1 << 16) + operand;
        }
        else if(instruction.mnemonic in OPCODES){
            let opcode = OPCODES[instruction.mnemonic];
            
            // memory reference
            if ((opcode & 0x0FFF) == 0x0000){
                instruction.value = opcode + parseInt(instruction.operand, 16) + (instruction.indirect ? 0x8000 : 0);
            }
            // register or I/O
            else {
                instruction.value = opcode;
            }
        }
        else {
            console.log("Assemble: Failed to parse \"" + line + "\"");
        }
        
        if(typeof instruction.value !== 'undefined' ){
            lineCounterHexString = lineCounter.toString(16).toUpperCase().padStart(3, '0');
            instructionHexWithLeadingZeros = instruction.value.toString(16).toUpperCase().padStart(4, '0');
            document.getElementById('machineText').value += `${lineCounterHexString}:   ${instructionHexWithLeadingZeros}\n`;
        }
        
        lineCounter++;
    }
}


function disassemble(){
    // clear textarea
    document.getElementById('assemblyText').value = "";

    let lines = document.getElementById('machineText').value.split('\n');
    let lineCounter = -1;

    for (const line of lines){

        if (!line.includes(":")){
            continue;
        }

        let [address, instruction] = line.split(':');
        address = parseInt(address, 16);
        instruction = parseInt(instruction, 16);

        if (lineCounter != address){
            document.getElementById('assemblyText').value += "     ORG " + address.toString(16).toUpperCase() + "\n";
        }
        
        // register or I/O
        if(((instruction & 0x0FFF) != 0x0000) && (instruction in reverseOpcodeMap)){
            document.getElementById('assemblyText').value += "     " + reverseOpcodeMap[instruction];
        }
        // memory reference direct
        else if(((instruction & 0xF000) in reverseOpcodeMap)){
            document.getElementById('assemblyText').value += "     " + reverseOpcodeMap[instruction & 0xF000] + " " + (instruction & 0x0FFF).toString(16).toUpperCase();
        }
        // memory reference indirect
        else if(((instruction - 0x8000) & 0xF000) in reverseOpcodeMap){
            document.getElementById('assemblyText').value += "     " + reverseOpcodeMap[(instruction - 0x8000 ) & 0xF000] + " " + (instruction & 0x0FFF).toString(16).toUpperCase() + " I";
        }
        // treat as HEX data instruction
        else {
            document.getElementById('assemblyText').value += "     " + "HEX " + instruction.toString(16).toUpperCase();
        }

        // add newline
        document.getElementById('assemblyText').value += "\n";

        lineCounter = address + 1;
    }
}


function saveTextAsFile(textToWrite, fileNameToSaveAs)
{
    var textFileAsBlob = new Blob([textToWrite], {type:'text/plain'}); 
    var downloadLink = document.createElement("a");
    downloadLink.download = fileNameToSaveAs;
    downloadLink.innerHTML = "Download File";
    if (window.webkitURL != null)
    {
        // Chrome allows the link to be clicked
        // without actually adding it to the DOM.
        downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
    }
    else
    {
        // Firefox requires the link to be added to the DOM
        // before it can be clicked.
        downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
        downloadLink.onclick = destroyClickedElement;
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
    }

    downloadLink.click();
}


function download(value, extension){
    let filename = "untitled";

    // try to get filename based on assembly file
    if (document.getElementById('assemblyFile').files.length != 0) {
        filename = document.getElementById('assemblyFile').files[0].name.split('.')[0];
    }
    // try to get filename based on machine file
    else if(document.getElementById('machineFile').files.length != 0){
        filename = document.getElementById('machineFile').files[0].name.split('.')[0];
    }

    saveTextAsFile(value, `${filename}.${extension}`);
}
