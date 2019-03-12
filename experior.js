var File = require("./lib/file.js");

var exp = {

    ac:        require("ansi-colors"),
    fs:        require("fs"),
    isaac:     require("isaac"),
    md5:       require('md5'),
    minicle:   require("minicle"),
    process:   require("process"),
    readline:  require("readline"),

    version:   "0.0.1",
    formats:   [ "console", "ansi", "txt", "html", "csv" ],
    prefix:    "@EXPERIOR:",

    optionMap: {
        css:        { short: "c", vals: [ ] },
        debug:      { short: "d", cnt: 0    },
        help:       { short: "h", cnt: 0    },
        infile:     { short: "i", vals: [ ] },
        jstest:     { short: "j", vals: [ ] },
        msgprefix:  { short: "m", vals: [ ] },
        outfile:    { short: "o", vals: [ ] },
        prng:       { short: "p", vals: [ ] },
        quiet:      { short: "q", cnt: 0    },
        seed:       { short: "s", vals: [ ] },
        verbose:    { short: "v", cnt: 0    },
    },
    debug:     false,
    infiles:   [ ],
    outfiles:  [ ],
    quietMode: false,
    verbosity: 0,

    tests:        { },   // results of each test, indexed by name
    testSequence: [ ],   // sorted list of test names
    testCount:    0,     // count of tests
    fieldWidths:  null,  // width of report fields for console/ansi
}



main();


//==============================================================================
// Main loop.
//==============================================================================

function main() {

    // Process CLI options -----------------------------------------------------

    exp.minicle(exp.optionMap);

    // Begin ceremonial output -------------------------------------------------

    if(exp.optionMap.quiet.cnt)
        exp.quietMode = true;

    if(!exp.quietMode)
        outputHeader(exp.version);

    if(exp.optionMap.help.cnt)
        usage(); // exits


    // Set other config values -------------------------------------------------

    if(exp.optionMap.debug.cnt) {
        exp.debug     = true;
        exp.verbosity = 4;
    } else {
        exp.verbosity = exp.optionMap.verbose.cnt;
    }

    if(exp.optionMap.quiet.cnt)
        exp.quietMode = true;

    // Have we been asked for PRNGs instead of a test run? ---------------------

    if(exp.optionMap.prng.vals.length == 2) {
        if(exp.optionMap.seed.vals.length) {
            var seed = exp.optionMap.seed.vals.join("");
        } else {
            var seed = new Date().getTime();
        }
        prng(exp.optionMap.prng.vals[0], exp.optionMap.prng.vals[1], seed);
        exp.process.exit(0);
    } else if(exp.optionMap.prng.vals.length > 1) {
        error("fatal", "PRNG requires both a type and a number.", "main");
        exp.process.exit(1);
    }

    // If we get here, it's test time! -----------------------------------------

    if(!exp.optionMap.infile.vals.length)
        error("fatal", "At least one input file must be specified.", "main");
    exp.infiles = exp.optionMap.infile.vals;

    if(!exp.optionMap.outfile.vals.length)
        error("fatal", "At least one output file must be specified.", "main");
    exp.outfiles = exp.optionMap.outfile.vals;

    error("debug", "exp.outfiles = ", "main");
    if(exp.debug)
        console.log(exp.outfiles);

    if(exp.optionMap.msgprefix.vals.length)
        exp.prefix = exp.optionMap.msgprefix.vals[0];

    exp.verbosity = exp.optionMap.verbose.cnt;

    prepOutfiles();
    analyzeTestData();
    sortTests();
    produceTestReports();
}


//==============================================================================
// Reads the infile(s), looking for the message prefix and acting accordingly.
// Content before the first test instruction is ignored.
//==============================================================================

function analyzeTestData() {
    var prefixLength = exp.prefix.length;
    var currentTest  = null;
    var ignoredLines = 0;

    // Iterate through the input files -----------------------------------------

    for(var f = 0; f < exp.infiles.length; f++) {

        var fp = new File(exp.infiles[f], "r");
        if(!fp.open)
            error("fatal", "Unable to open input file " + exp.infiles[f] + " for reading.", "analyzeTestData");
        var lines = fp.read();
        fp.close();
        lines = lines.split(/\n/);

        // Iterate through lines in file ---------------------------------------

        var testData   = [ ];
        var lineNumber = -1;

        while(lines.length) {

            var line = lines.shift();
            lineNumber++;

            if(line.length >= prefixLength && line.substr(0, prefixLength) == exp.prefix) {

                try { var msg = JSON.parse(line.substr(prefixLength).trim()); } catch(e) {
                    error("fatal", "Malformed JSON message in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");
                }
                if(msg.type === undefined)
                    error("fatal", "JSON message missing type element in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");

                if(msg.type == "begin") {

                    if(currentTest !== null)
                        error("fatal", "JSON begin message in middle of test in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");

                    if(msg.id === undefined)
                        error("fatal", "JSON begin message with missing id in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");

                    currentTest = msg.id.toString().trim();

                    if(msg.cat !== undefined)
                        msg.cat = msg.cat.toString().trim();
                    else
                        msg.cat = null;

                    if(msg.label === undefined)
                        error("fatal", "JSON begin message with missing label in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");
                    msg.label = msg.label.toString().trim();
                    if(msg.desc === undefined)
                        error("fatal", "JSON begin message with missing desc in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");

                    // TODO: msg.jstest validate

                    currentTest = { id: msg.id, cat: msg.cat, label: msg.label, desc: msg.desc };
                    testData = [ ];

                } else if(msg.type == "end") {

                    if(msg.id === undefined)
                        error("fatal", "JSON end message with missing id in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");
                    msg.id = msg.id.toString().trim();
                    if(msg.id != currentTest.id)
                        error("fatal", "JSON end message with id not matching start message in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");
                    if(msg.success === undefined)
                        error("fatal", "JSON end message with missing success in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");

                    currentTest.success = msg.success;
                    var testBlob        = testData.join("\n");
                    currentTest.hash    = exp.md5(testBlob);
                    currentTest.size    = testBlob.length;

                    // TODO: apply jstests
                    //    blah blah blah msg.jsResults

                    exp.tests[currentTest.id] = currentTest;

                    exp.testCount++;
                    currentTest = null;
                }


            } else { // test data and interstitial lines

                if(currentTest != null) {
                    testData.push(line);
                }

            }

        }

    }

    error("debug", "exp.tests = ", "analyzeTestData");
    if(exp.debug)
        console.log(exp.tests);
}


//==============================================================================
// Validates exp.outfiles, replacing it with an object indexed by filename in
// which the values follow the form { fd: ?, type: ? }
//==============================================================================

function prepOutfiles() {
    var result = { };
    var seen = { console: false, ansi: false };

    for(var i = 0; i < exp.outfiles.length; i++)
        if(seen[exp.outfiles[i]] !== undefined)
            seen[exp.outfiles[i]] = true;

    if(seen.console && seen.ansi)
        error("fatal", "console and ansi output cannot be used simultaneously.", "prepOutfiles");

    for(var i = 0; i < exp.outfiles.length; i++) {

        var fname = exp.outfiles[i];
        var parts = fname.split(".");
        var ext = parts.pop().toLowerCase();

        if(!inArray(ext, exp.formats))
            error("fatal", "Invalid output file type: " + ext, "prepOutfiles");

        if(ext == "console" || ext == "ansi") {
            result[fname] = { fd: null, type: ext };
        } else {
            var fd = exp.fs.openSync(fname, "w");
            if(fd)
                result[fname] = { fd: fd, type: ext };
            else
                error("fatal", "Unable to open output file \"" + fname + "\"", "prepOutfiles");
        }
    }

    exp.outfiles = result;

    error("debug", "exp.outfiles = ", "prepOutFiles");
    if(exp.debug)
        console.log(exp.outfiles);

}

//==============================================================================
// Creates a list of test names sorted by category and label.
//==============================================================================

function sortTests() {

    for(var k in exp.tests)
        exp.testSequence.push([exp.tests[k].cat, k]);

    exp.testSequence.sort(function(a, b) {
        if(a[0] == b[0])
            return a[1].localeCompare(b[1]);
        else
            return a[0].localeCompare(b[0]);
    });

    for(var i = 0; i < exp.testSequence.length; i++)
        exp.testSequence[i] = exp.testSequence[i][1];

    error("debug", "exp.testSequence = ", "sortTests");
    if(exp.debug)
        console.log(exp.testSequence);
}




//==============================================================================
// Just steps through exp.outfiles and dispatches the various output format
// handlers.
//==============================================================================

function produceTestReports() {
    for(var filename in exp.outfiles) {
        switch(exp.outfiles[filename].type) {
            case "console":
                testReportConsole();
                break;
            case "ansi":
                testReportAnsi();
                break;
            case "txt":
                testReportText(exp.outfiles[filename].fd);
                break;
            case "csv":
                testReportCSV(exp.outfiles[filename].fd);
                break;
            case "html":
                testReportHTML(exp.outfiles[filename].fd);
                break;
        }
    }
}

//==============================================================================
// Walks through exp.tests and calculates the maximum width of each field.
//==============================================================================

function findFieldWidths() {
    exp.fieldWidths = { };
    for(var testname in exp.tests) {
        for(var fieldname in exp.tests[testname]) {
            if(exp.fieldWidths[fieldname] === undefined)
                exp.fieldWidths[fieldname] = 0;
            var len = exp.tests[testname][fieldname].toString().length;
            if(len > exp.fieldWidths[fieldname])
                exp.fieldWidths[fieldname] = len;
        }
    }

    error("debug", "exp.fieldWidths = ", "findFieldWidths");
    if(exp.debug)
        console.log(exp.fieldWidths);
}


//==============================================================================
// These are the handlers for the various test report formats. All of them use
// data stored in the global exp object and so require no arguments.
//==============================================================================

function testReportConsole() {
    if(exp.fieldWidths === null)
        findFieldWidths();

    var lineWidth = 26 + Math.max(exp.fieldWidths.cat, "CATEGORY".length)
        + Math.max(exp.fieldWidths.label, "TEST ID".length);
        + Math.max(exp.fieldWidths.label, "LABEL".length);

    console.log("+" + "".padEnd(lineWidth - 2, "-") + "+");
    console.log("| TEST | "
        + "CATEGORY".padEnd(exp.fieldWidths.cat) + " | "
        + "TEST ID".padEnd(exp.fieldWidths.id) + " | "
        + "LABEL".padEnd(exp.fieldWidths.label) + " |");
    console.log("+" + "".padEnd(lineWidth - 2, "-") + "+");

    for(var i = 0; i < exp.testSequence.length; i++) {
        var test = exp.tests[exp.testSequence[i]];
        var status = test.success ? " ok " : "FAIL";
        console.log("| " + status + " | "
            + test.cat.padEnd(exp.fieldWidths.cat) + " | "
            + test.id.padEnd(exp.fieldWidths.id) + " | "
            + test.label.padEnd(exp.fieldWidths.label) + " |");
    }

    console.log("+" + "".padEnd(lineWidth - 2, "-") + "+");
}

//------------------------------------------------------------------------------

function testReportAnsi() {
    if(exp.fieldWidths === null)
        findFieldWidths();

    error("debug", "Not implemented yet.", "testReportAnsi");
}

//------------------------------------------------------------------------------

function testReportText(fd) {
    if(exp.fieldWidths === null)
        findFieldWidths();

    var lineWidth = 26 + Math.max(exp.fieldWidths.cat, "CATEGORY".length)
        + Math.max(exp.fieldWidths.label, "TEST ID".length);
        + Math.max(exp.fieldWidths.label, "LABEL".length);

    exp.fs.writeSync(fd, "+" + "".padEnd(lineWidth - 2, "-") + "+\n");
    exp.fs.writeSync(fd, "| TEST | "
        + "CATEGORY".padEnd(exp.fieldWidths.cat) + " | "
        + "TEST ID".padEnd(exp.fieldWidths.id) + " | "
        + "LABEL".padEnd(exp.fieldWidths.label) + " |\n");
    exp.fs.writeSync(fd, "+" + "".padEnd(lineWidth - 2, "-") + "+\n");

    for(var i = 0; i < exp.testSequence.length; i++) {
        var test = exp.tests[exp.testSequence[i]];
        var status = test.success ? " ok " : "FAIL";
        exp.fs.writeSync(fd, "| " + status + " | "
            + test.cat.padEnd(exp.fieldWidths.cat) + " | "
            + test.id.padEnd(exp.fieldWidths.id) + " | "
            + test.label.padEnd(exp.fieldWidths.label) + " |\n");
    }

    exp.fs.writeSync(fd, "+" + "".padEnd(lineWidth - 2, "-") + "+\n");
}

//------------------------------------------------------------------------------

function testReportCSV(fd) {
    error("debug", "Not implemented yet.", "testReportCSV");
}

//------------------------------------------------------------------------------

function testReportHTML(fd) {
    error("debug", "Not implemented yet.", "testReportHTML");
}


//==============================================================================
// Tests whether val is in the supplied array.
//==============================================================================

function inArray(val, ary) {
    for(var i = 0; i < ary.length; i++)
        if(ary[i] == val)
            return true;
    return false;
}


//==============================================================================
// Outputs num pseudo-random numbers of the specified type, where type can be
// 8, 16, 24, 32, or 64 for integers, or "float" for floats.
//==============================================================================

function prng(type, num, seed) {

    exp.isaac.seed(seed);

    num = parseInt(num);
    if(isNaN(num) || num < 1)
        error("fatal", "PRNG num must be an integer greater than zero.", "EXPERIOR");

    switch(type) {

        case "8":
        case "16":
        case "24":
        case "32":
        case "64":
            type = parseInt(type);
            var base = Math.pow(2, type);
            for(var i = 0; i < num; i++)
                console.log(Math.floor(exp.isaac.random() * base));
            break;

        case "float":
            for(var i = 0; i < num; i++)
                console.log(exp.isaac.random());
            break;

        default:
            error("fatal", "Legal values for PRNG type are 8, 16, 24, 32, 64, or \"float\".", "EXPERIOR");

    }

}


//==============================================================================
// Outputs usage instructions.
//==============================================================================

function usage() {

    console.log(exp.ac.white.bold("  Usage: experior [options]\n\n")
        + exp.ac.yellow.bold("    -i") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--infile     ") + exp.ac.blue.bold("<filename(s)>  ") + exp.ac.cyan.bold("Path to input file(s).\n")
        + exp.ac.yellow.bold("    -o") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--outfile    ") + exp.ac.blue.bold("<filename(s)>  ") + exp.ac.cyan.bold("Output file names.\n")
        + exp.ac.yellow.bold("    -j") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--jstest     ") + exp.ac.blue.bold("<filename>     ") + exp.ac.cyan.bold("JavaScript test module.\n")
        + exp.ac.yellow.bold("    -c") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--css        ") + exp.ac.blue.bold("<filename>     ") + exp.ac.cyan.bold("CSS file to use with HTML output.\n")
        + exp.ac.yellow.bold("    -m") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--msgprefix  ") + exp.ac.blue.bold("<string>       ") + exp.ac.cyan.bold("Experior message prefix.\n")
        + exp.ac.yellow.bold("    -p") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--prng       ") + exp.ac.blue.bold("<type> <num>   ") + exp.ac.cyan.bold("Generate num random numbers of type.\n")
        + exp.ac.yellow.bold("    -s") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--seed       ") + exp.ac.blue.bold("<num|string>   ") + exp.ac.cyan.bold("Explicit PRNG seed.\n")
        + exp.ac.yellow.bold("    -v") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--verbose    ") + exp.ac.blue.bold("               ") + exp.ac.cyan.bold("Increase verbosity (starts at 1, up to 4).\n")
        + exp.ac.yellow.bold("    -q") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--quiet      ") + exp.ac.blue.bold("               ") + exp.ac.cyan.bold("Suppress console output.\n")
        + exp.ac.yellow.bold("    -d") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--debug      ") + exp.ac.blue.bold("               ") + exp.ac.cyan.bold("Display debugging info.\n")
        + exp.ac.yellow.bold("    -h") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--help       ") + exp.ac.blue.bold("               ") + exp.ac.cyan.bold("Display this text.\n\n"));

    exp.process.exit(0);
}


//==============================================================================
// Outputs the runtime header to console. This will become progressively more
// ostentatious and ridiculous as time goes by.
//==============================================================================

function outputHeader(version) {

    console.log(
        "\n" + exp.ac.blue("===========================================================================") + "\n"
        + exp.ac.yellow.bold("         Experior v" + version + " -- Minimalist Unit/Regression Test Tool") + "\n"
        + exp.ac.blue("===========================================================================") + "\n"
    );

}


//==============================================================================
// Prints an error message to console if permitted by the current verbosity
// level, and if the error is fatal, terminates the process.
//==============================================================================

function error(level, message, location = "EXPERIOR") {

    if(!exp.quietMode) {
        switch(level) {
            case "fatal":
                console.log(exp.ac.bgRed.yellowBright("[" + location + "]") + exp.ac.redBright(" FATAL ERROR: ") + exp.ac.yellowBright(message));
                break;
            case "warn":
                if(exp.verbosity >= 1)
                    console.log(exp.ac.bgYellow.whiteBright("[" + location + "]") + exp.ac.yellowBright(" WARNING: ") + message);
                break;
            case "info":
                if(exp.verbosity >= 2)
                    console.log(exp.ac.bgGreen.whiteBright("[" + location + "]") + exp.ac.greenBright(" INFO: ") + message);
                break;
            case "debug":
                if(exp.verbosity >= 3 || exp.debug)
                    console.log("[" + location + "] DEBUG: " + message);
                break;
        }
    }

    if(level == "fatal" && exp.debug < 2)
        this.process.exit(1);
}



/*

    - sample test data
    - analyze test data
    - regression test
    - output TXT
    - output CSV
    - output HTML
{
    type: "begin"
    id: "SOMEGUID"
    cat: (optional, top level sort key)
    label: short label for reports
    desc: longer, detailed description
    jstest: single JS test function or an array thereof
}
{
    type: "end",
    id: "TESTGUID",   -- must match current test
    success: boolean
}


@EXPERIOR: {"type":"begin","id":"TestOne","cat":"testdata","label":"Some even numbers","desc":"This is a bunch of even numbers."}

2 4 6 8 10 12 14 16 18 20

@EXPERIOR: {"type":"end","id":"TestOne","success":true }

@EXPERIOR: {"type":"begin","id":"TestTwo","cat":"testdata","label":"Some odd numbers","desc":"This is a bunch of odd numbers."}

1 3 5 7 9 11 13 15 17 19 21

@EXPERIOR: {"type":"end","id":"TestTwo","success":true }
@EXPERIOR: {"type":"begin","id":"TestThree","cat":"testdata","label":"Some negative numbers","desc":"This is a bunch of negative numbers."}

1 2 3 4 5 6 7 8 9 10

@EXPERIOR: {"type":"end","id":"TestThree","success":false }

*/




