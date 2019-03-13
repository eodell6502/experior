var File = require("./lib/file.js");

var exp = {

    ac:        require("ansi-colors"),
    fs:        require("fs"),
    isaac:     require("isaac"),
    md5:       require('md5'),
    minicle:   require("minicle"),
    process:   require("process"),
    readline:  require("readline"),
    table:     require("table"),

    version:   "0.0.1",
    formats:   [ "console", "ansi", "txt", "html", "csv", "json" ],
    prefix:    "@EXPERIOR:",

    optionMap: {
        css:        { short: "c", vals: [ ] },
        debug:      { short: "d", cnt: 0    },
        failures:   { short: "f", cnt: 0    },
        help:       { short: "h", cnt: 0    },
        infile:     { short: "i", vals: [ ] },
        jstest:     { short: "j", vals: [ ] },
        long:       { short: "l", cnt: 0    },
        msgprefix:  { short: "m", vals: [ ] },
        outfile:    { short: "o", vals: [ ] },
        prng:       { short: "p", vals: [ ] },
        quiet:      { short: "q", cnt: 0    },
        regression: { short: "r", vals: [ ] },
        seed:       { short: "s", vals: [ ] },
        verbose:    { short: "v", cnt: 0    },
        width:      { short: "w", vals: [ ] },
    },
    debug:        false,
    infiles:      [ ],
    outfiles:     [ ],
    quietMode:    false,
    verbosity:    0,
    regression:   false,
    failOnly:     false,
    descWidth:    0,
    longFormat:   false,
    jsTest:       false,

    tests:        { },   // results of each test, indexed by name
    testSequence: [ ],   // sorted list of test names
    testCount:    0,     // count of tests
    fieldWidths:  null,  // width of report fields for console/ansi
    summary:      { },   // to be filled with totals, stats, etc.
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

    if(exp.optionMap.failures.cnt)
        exp.failOnly = true;

    if(exp.optionMap.width.vals.length) {
        exp.descWidth = parseInt(exp.optionMap.width.vals[0]);
        if(isNaN(exp.descWidth) || exp.descWidth < 1)
            error("fatal", "The width parameter must be greater than zero.", "main");
    }

    if(exp.optionMap.long.cnt)
        exp.longFormat = true;

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

    if(exp.optionMap.regression.vals.length) {
        exp.regression = new File(exp.optionMap.regression.vals[0], "r");
        if(!exp.regression.open)
            error("fatal", "Unable to open regression file " + exp.optionMap.regression.vals[0] + ".", "main");
    }

    if(!exp.optionMap.outfile.vals.length)
        error("fatal", "At least one output file must be specified.", "main");
    exp.outfiles = exp.optionMap.outfile.vals;

    error("debug", "exp.outfiles = ", "main");
    if(exp.debug)
        console.log(exp.outfiles);

    if(exp.optionMap.msgprefix.vals.length)
        exp.prefix = exp.optionMap.msgprefix.vals[0];

    prepOutfiles();
    analyzeTestData();
    if(exp.regression)
        findRegressions();
    sortTests();
    createSummary();
    produceTestReports();
}


//==============================================================================
// Creates totals and stats.
//==============================================================================

function createSummary() {
    var result = {
        tests:      0,
        failed:     0,
        failPct:    0,
        succeeded:  0,
        successPct: 0,
        regressed:  0,
        regressPct: 0,
    };

    for(var k in exp.tests) {
        test = exp.tests[k];
        result.tests++;
        if(test.success)
            result.succeeded++;
        else
            result.failed++;
        if(test.regression !== undefined && test.regression)
            result.regressed++;
    }

    if(result.tests) { // avoid division by zero
        result.failPct    = ((result.failed    / result.tests) * 100).toFixed(1);
        result.successPct = ((result.succeeded / result.tests) * 100).toFixed(1);
        result.regressPct = ((result.regressed / result.tests) * 100).toFixed(1);
    }

    exp.summary = result;

    error("debug", "exp.summary = ", "createSummary");
    if(exp.debug)
        console.log(exp.summary);
}


//==============================================================================
// Loads the regression file and flags regressions in exp.tests and flags
// the regressions. Must be run after analyzeTestData.
//==============================================================================

function findRegressions() {
    var old = exp.regression.read();
    try {
        old = JSON.parse(old);
    } catch(e) {
        error("fatal", "Unable to parse JSON in regression file.", "findRegressions");
    }

    for(var test in old) {
        if(exp.tests[test] === undefined) {
            error("warn", "Test " + test + " is present in regression file but not current test file.", "findRegression");
        } else {
            exp.tests[test].regression = old[test].hash == exp.tests[test].hash ? false : true;
        }
    }
    exp.regression.close();

    error("debug", "exp.tests = ", "findRegressions");
    if(exp.debug)
        console.log(exp.tests);
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

    var data   = assembleReportData();
    var summary = assembleSummaryData();

    for(var filename in exp.outfiles) {

        var dataCopy = [ ];
        for(var i = 0; i < data.length; i++)
            dataCopy[i] = data[i].slice(0);
        var summaryCopy = [ ];
        for(var i = 0; i < summary.length; i++)
            summaryCopy[i] = summary[i].slice(0);

        switch(exp.outfiles[filename].type) {
            case "console":
                testReportConsole(dataCopy, summaryCopy);
                break;
            case "ansi":
                testReportAnsi(dataCopy, summaryCopy);
                break;
            case "txt":
                testReportText(exp.outfiles[filename].fd, dataCopy, summaryCopy);
                exp.fs.closeSync(exp.outfiles[filename].fd);
                break;
            case "csv":
                testReportCSV(exp.outfiles[filename].fd, dataCopy, summaryCopy);
                exp.fs.closeSync(exp.outfiles[filename].fd);
                break;
            case "html":
                testReportHTML(exp.outfiles[filename].fd, dataCopy, summaryCopy);
                exp.fs.closeSync(exp.outfiles[filename].fd);
                break;
            case "json":
                testReportJSON(exp.outfiles[filename].fd);
                exp.fs.closeSync(exp.outfiles[filename].fd);
                break;
        }
    }
}

//==============================================================================
// Puts the report summary data into an array of arrays for feeding to the
// report formatters. There is no header row.
//==============================================================================

function assembleSummaryData() {
    var rows = [
        [ "Total Tests:", exp.summary.tests,     "100.0%"                     ],
        [ "Succeeded:",   exp.summary.succeeded, exp.summary.successPct + "%" ],
        [ "Failed:",      exp.summary.failed,    exp.summary.failPct    + "%" ],
    ];

    if(exp.regression)
        rows.push(["Regressions:", exp.summary.regressed, exp.summary.regressPct + "%"]);

    return rows;
}


//==============================================================================
// Walks through exp.tests and assembles the data to go into the various report
// formats in a single common format, which is an array of arrays. The first row
// contains the column headers.
//==============================================================================

function assembleReportData() {
    var rows = [ ];

    var row = ["Test"];
    if(exp.jsTest)
        row.push("JS");
    if(exp.regression)
        row.push("Reg.");
    row.push("Category");
    row.push("Test ID");
    row.push("Label");
    if(exp.longFormat)
        row.push("Test Description");
    rows.push(row);

    for(var i = 0; i < exp.testSequence.length; i++) {

        var test = exp.tests[exp.testSequence[i]];
        if(test.success && (test.regression === undefined || !test.regression) && exp.failOnly)
            continue;

        row = [ ];
        row.push(test.success ? " ok " : "FAIL");
        if(exp.jsTest) {
            if(test.jsSuccess === undefined) {
                row.push("n/a ");
            } else if(test.jsSuccess === true) {
                row.push(" ok ");
            } else {
                row.push("FAIL");
            }
        }
        if(exp.regression) {
            row.push(test.regression ? "FAIL" : " ok ");
        }
        row.push(test.cat);
        row.push(test.id);
        row.push(test.label);
        if(exp.longFormat) {
            row.push(test.desc);
        }

        rows.push(row);
    }

    return rows;
}


//==============================================================================
// These are the handlers for the various test report formats. All of them use
// data output by assembleReportData.
//==============================================================================

function testReportConsole(data, summary, internal = false) {
    var columns = {
        test:  { alignment: "center", minWidth: 4 },
        js:    { alignment: "center", minWidth: 4 },
        reg:   { alignment: "center", minWidth: 4 },
        cat:   { alignment: "left" },
        id:    { alignment: "left" },
        label: { alignment: "left" },
        desc:  { alignment: "left", wrapWord: true }
    };

    if(exp.descWidth)
        columns.desc.width = exp.descWidth;

    var config = {
        border: exp.table.getBorderCharacters("ramac"),
        columns: { }
    };

    var col = 0;
    config.columns[col++] = columns.test;
    if(exp.jsTest)
        config.columns[col++] = columns.js;
    if(exp.regression)
        config.columns[col++] = columns.reg;
    config.columns[col++] = columns.cat;
    config.columns[col++] = columns.id;
    config.columns[col++] = columns.label;
    if(exp.longFormat)
        config.columns[col++] = columns.desc;

    var sconfig = {
        border: exp.table.getBorderCharacters("ramac"),
        columns: {
            0: { alignment: "left"  },
            1: { alignment: "right" },
            2: { alignment: "right" }
        }
    };

    var result = exp.table.table(data, config) + "\n"
            + "SUMMARY:\n"
            + exp.table.table(summary, sconfig) + "\n\n";

    if(internal)
        return result;
    else
        console.log(result);
}


//------------------------------------------------------------------------------

function testReportAnsi(data, summary) {
    for(var i = 0; i < data[0].length; i++)
        data[0][i] = exp.ac.yellow.bold(data[0][i]);

    var columns = {
        test:  { alignment: "center", minWidth: 4 },
        js:    { alignment: "center", minWidth: 4 },
        reg:   { alignment: "center", minWidth: 4 },
        cat:   { alignment: "left" },
        id:    { alignment: "left" },
        label: { alignment: "left" },
        desc:  { alignment: "left", wrapWord: true }
    };

    if(exp.descWidth)
        columns.desc.width = exp.descWidth;

    var config = {
        border: exp.table.getBorderCharacters("honeywell"),
        columns: { }
    };

    for(var row = 0; row < data.length; row++) {
        if(data[row][0] == "n/a ")
            data[row][0] = exp.ac.blue(data[row][0]);
        else if(data[row][0] == " ok ")
            data[row][0] = exp.ac.bgGreen.white.bold(data[row][0]);
        else if(data[row][0] == "FAIL")
            data[row][0] = exp.ac.bgRed.yellow.bold(data[row][0]);
    }

    var col = 0;
    config.columns[col++] = columns.test;
    if(exp.jsTest) {
        for(var row = 0; row < data.length; row++) {
            if(data[row][col] == "n/a ")
                data[row][col] = exp.ac.blue(data[row][col]);
            else if(data[row][col] == " ok ")
                data[row][col] = exp.ac.bgGreen.white.bold(data[row][col]);
            else if(data[row][col] == "FAIL")
                data[row][col] = exp.ac.bgRed.yellow.bold(data[row][col]);
        }
        config.columns[col++] = columns.js;
    }
    if(exp.regression) {
        for(var row = 0; row < data.length; row++) {
            if(data[row][col] == "n/a ")
                data[row][col] = exp.ac.blue(data[row][col]);
            else if(data[row][col] == " ok ")
                data[row][col] = exp.ac.bgGreen.white.bold(data[row][col]);
            else if(data[row][col] == "FAIL")
                data[row][col] = exp.ac.bgRed.yellow.bold(data[row][col]);
        }
        config.columns[col++] = columns.reg;
    }

    var catAndLater = col;

    for(var row = 0; row < data.length; row++) {
        var failed = false;
        for(var c = 0; c < catAndLater; c++) {
            if(data[row][c].match("FAIL")) {
                failed = true;
                break;
            }
        }
        if(failed) {
            for(var c = catAndLater; c < data[row].length - 1; c++) {
                data[row][c] = exp.ac.red.bold(data[row][c]) + exp.ac.white("");
            }
        }
    }

    config.columns[col++] = columns.cat;
    config.columns[col++] = columns.id;
    config.columns[col++] = columns.label;
    if(exp.longFormat)
        config.columns[col++] = columns.desc;

    var sconfig = {
        border: exp.table.getBorderCharacters("honeywell"),
        columns: {
            0: { alignment: "left"  },
            1: { alignment: "right" },
            2: { alignment: "right" }
        }
    };

    var scolor = {
        "Total Tests:": exp.ac.white.bold,
        "Succeeded:":   exp.ac.green.bold,
        "Failed:":      exp.ac.red.bold,
        "Regressions:": exp.ac.yellow.bold
    };

    for(var row = 0; row < summary.length; row++) {
        if(scolor[summary[row][0]] !== undefined)
            var func = scolor[summary[row][0]];
        else
            var func = function(x) { return x; };
        for(var col = 0; col < summary[row].length; col++) {
            summary[row][col] = func(summary[row][col]);
        }
    }

    var result = exp.table.table(data, config) + "\n"
            + exp.ac.white.bold("SUMMARY:\n")
            + exp.table.table(summary, sconfig) + "\n\n";

    console.log(result);
}

//------------------------------------------------------------------------------

function testReportText(fd, data, summary) {

    var content = testReportConsole(data, true);
    exp.fs.writeSync(fd, content);

}

//------------------------------------------------------------------------------

function testReportCSV(fd, data, summary) {
    exp.fs.writeSync(fd, csvify(data));
    exp.fs.writeSync(fd, "\n\nSUMMARY:\n");
    exp.fs.writeSync(fd, csvify(summary));
}

function csvify(data) {
    var quotable = RegExp("[\\s\\\"']");
    var result = [ ];

    for(var row = 0; row < data.length; row++) {
        for(var col = 0; col < data[row].length; col++) {
            var datum = data[row][col].toString().trim();
            datum = datum.replace(/"/g, "\\\"");
            if(quotable.test(datum))
                datum = '"' + datum + '"';
            data[row][col] = datum;
        }
        result.push(data[row].join(","));
    }
    return result.join("\n");
}

//------------------------------------------------------------------------------

function testReportHTML(fd, data, summary) {
/*

<!doctype html>
<html>
  <head>
    <meta charset="utf-8">

*/
    error("debug", "Not implemented yet.", "testReportHTML");
}

//------------------------------------------------------------------------------

function testReportJSON(fd) {
    var data = exp.tests;

    if(exp.failOnly) {
        data = { };
        for(var id in exp.tests) {
            if(exp.tests[id].success && (exp.tests[id].regression === undefined || !exp.tests[id].regression))
                continue;
            data[id] = exp.tests[id];
        }
    }

    exp.fs.writeSync(fd, JSON.stringify(data));
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
        + exp.ac.yellow.bold("    -r") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--regression ") + exp.ac.blue.bold("<filename>     ") + exp.ac.cyan.bold("Regression test input file.\n")
        + exp.ac.yellow.bold("    -j") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--jstest     ") + exp.ac.blue.bold("<filename>     ") + exp.ac.cyan.bold("JavaScript test module.\n")
        + exp.ac.yellow.bold("    -c") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--css        ") + exp.ac.blue.bold("<filename>     ") + exp.ac.cyan.bold("CSS file to use with HTML output.\n")
        + exp.ac.yellow.bold("    -l") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--long       ") + exp.ac.blue.bold("               ") + exp.ac.cyan.bold("Use long report format.\n")
        + exp.ac.yellow.bold("    -w") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--width      ") + exp.ac.blue.bold("<number>       ") + exp.ac.cyan.bold("Set width for text descriptions.\n")
        + exp.ac.yellow.bold("    -m") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--msgprefix  ") + exp.ac.blue.bold("<string>       ") + exp.ac.cyan.bold("Experior message prefix.\n")
        + exp.ac.yellow.bold("    -f") + exp.ac.yellow(", ") + exp.ac.yellow.bold("--failures   ") + exp.ac.blue.bold("               ") + exp.ac.cyan.bold("Only show failures in reports.\n")
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

    - analyze test data
      -- [totals by category] and whole set

    - output HTML

    - docs
    - cleanup

    - git-like command option for minicle
    - minicle-usage using table

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




