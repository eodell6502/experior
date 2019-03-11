var exp = {

    ac:        require("ansi-colors"),
    fgets:     require('qfgets'),
    fs:        require("fs"),
    isaac:     require("isaac"),
    md5:       require('md5'),
    minicle:   require("minicle"),
    process:   require("process"),

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

    tests:     { },
    testCount: 0,
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

    if(exp.optionMap.msgprefix.vals.length)
        exp.prefix = exp.optionMap.msgprefix.vals[0];

    exp.verbosity = exp.optionMap.verbose.cnt;

    prepOutfiles();
    analyzeTestData();
    //produceReports();
}


//==============================================================================
// Reads the infile(s), looking for the message prefix and acting accordingly.
// Content before the first test instruction is ignored.
//==============================================================================

/*

https://www.npmjs.com/package/qfgets

    // line-at-a-time file reader
    function readfile(filename, callback) {
        var fp = new Fgets(filename);
        var contents = "";
        return readlines();

        function readlines() {
            try {
                for (var i=0; i<20; i++) contents += fp.fgets();
                if (fp.feof()) return callback(null, contents);
                else setImmediate(readlines);
            }
            catch (err) {
                return callback(err);
            }
        }
    }

*/

function analyzeTestData() {
    var prefixLength = exp.prefix.length;
    var currentTest  = null;
    var ignoredLines = 0;

    // Iterate through the input files -----------------------------------------

    for(var f = 0; f < exp.infiles.length; f++) {

        var fp = new exp.fgets(exp.infiles[f]);
        if(fp.fp.fd === null)
            error("fatal", "Unable to open input file " + exp.infiles[f] + " for reading.", "analyzeTestData");

        // Iterate through lines in file ---------------------------------------

        var testData   = [ ];
        var lineNumber = -1;

        while(!fp.feof()) {

            lineNumber++;
            var line = fp.fgets();
            if(line === "")         // wait for buffer to fill
                continue;

            if(line.length >= prefixLength && line.substr(0, prefixLength) == exp.prefix) {

                try { var msg = JSON.parse(line); } catch(e) {
                    error("fatal", "Malformed JSON message in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");
                }
                if(msg.type === undefined)
                    error("fatal", "JSON message missing type element in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");

                if(msg.type == "begin") {

                    if(currentTest === null)
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

                } else if(msg.type == "end") {

                    if(msg.id === undefined)
                        error("fatal", "JSON end message with missing id in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");
                    msg.id = msg.id.toString().trim();
                    if(msg.id != currentTest.id)
                        error("fatal", "JSON end message with id not matching start message in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");
                    if(msg.success === undefined)
                        error("fatal", "JSON end message with missing success in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");

                    currentTest.success = msg.success;

                    // TODO: apply jstests
                    //    blah blah blah msg.jsResults

                    exp.tests[currentTest.id] = currentTest;

                    exp.testCount++;
                    currentTest = null;
                }


            } else {

            }

        }

    }


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

*/




