#!/usr/bin/env node

const fs       = require("fs");
const path     = require("path");

const ac       = require("ansi-colors");
const diff     = require("diff");      // TODO: major version upgrade
const md5      = require("md5");
const minicle  = require("minicle");
const table    = require("table");     // TODO: major version upgrade

var exp = {
    version:   "1.0.0",
    formats:   [ "console", "ansi", "txt", "html", "csv", "json" ],
    prefix:    "@EXPERIOR:",

    options: {
        switches: {
            infile:         { short: "i", maxArgs: Infinity },
            outfile:        { short: "o", maxArgs: Infinity },
            regression:     { short: "r", maxArgs: Infinity },
            "full-regress": { short: "R", maxArgs: 0 },
            jstest:         { short: "j", maxArgs: 1 },
            css:            { short: "c", maxArgs: 1 },
            long:           { short: "l", maxArgs: 0 },
            width:          { short: "w", maxArgs: 1 },
            msgprefix:      { short: "m", maxArgs: 1 },
            failures:       { short: "f", maxArgs: 0 },
            verbose:        { short: "v", maxArgs: 0 },
            quiet:          { short: "q", maxArgs: 0 },
            debug:          { short: "d", maxArgs: 0 },
            help:           { short: "h", maxArgs: 0 },
        },
    },

    css:          false,
    debug:        false,
    descWidth:    0,
    failOnly:     false,
    fullRegress:  false,
    infiles:      [ ],
    jsTest:       false,
    longFormat:   false,
    outfiles:     [ ],
    quietMode:    false,
    regression:   false,
    verbosity:    0,

    tests:        { },   // results of each test, indexed by name
    testSequence: [ ],   // sorted list of test names
    testCount:    0,     // count of tests
    fieldWidths:  null,  // width of report fields for console/ansi
    summary:      { },   // to be filled with totals, stats, etc.
    diffs:        { },   // output diffs for full-regress mode
}
exp.header = "Experior v" + exp.version + " -- Minimalist Unit/Regression Test Tool";

/*

TODO:

* improve colors in summary table

* Test & refamiliarize
* cleanup
* Now that the requirements are fully understood, refactor the mass of ugly hacks in the report output routines.
* Add diff output to non-HTML output.
* Output feature switch(es): unit test table, totals, category totals



*/


main();


//==============================================================================
// Main loop.
//==============================================================================

function main() {

    //--------------------------------------------------------------------------
    // Process CLI options
    //--------------------------------------------------------------------------

    var options = minicle.parseCliArgs(process.argv.slice(2), exp.options);
    exp.cwd = path.normalize(process.cwd());

    //--------------------------------------------------------------------------
    // Begin ceremonial output
    //--------------------------------------------------------------------------

    if(options.switches.help.cnt) {
        minicle.outputHeader("@0E@" + exp.header + "@07@", "pcdos2", "@09@");
        usage(); // exits
    }

    if(options.switches.quiet.cnt)
        exp.quietMode = true;

    if(!exp.quietMode)
        minicle.outputHeader("@0E@" + exp.header + "@07@", "pcdos2", "@09@");

    //--------------------------------------------------------------------------
    // Set other config values
    //--------------------------------------------------------------------------

    if(options.switches.debug.cnt) {
        exp.debug     = true;
        exp.verbosity = 4;
    } else {
        exp.verbosity = options.switches.verbose.cnt;
    }

    if(options.switches.quiet.cnt)
        exp.quietMode = true;

    if(options.switches.failures.cnt)
        exp.failOnly = true;

    if(options.switches.width.args.length) {
        exp.descWidth = parseInt(options.switches.width.args[0]);
        if(isNaN(exp.descWidth) || exp.descWidth < 1)
            error("fatal", "The width parameter must be greater than zero.", "main");
    }

    if(options.switches.long.cnt)
        exp.longFormat = true;

    if(options.switches.css.args.length)
        exp.css = options.css.args[0];

    if(options.switches.jstest.args.length) {
        try {
            exp.jsTest = require(exp.cwd + "/" + options.switches.jstest.args[0]);
        } catch(e) {
            error("fatal", "Unable to require JS test file " + options.switches.jstest.args[0] + "\n", "main");
        }
    }

    if(options.switches["full-regress"].cnt)
        exp.fullRegress = true;

    //--------------------------------------------------------------------------
    // If we get here, it's test time!
    //--------------------------------------------------------------------------

    if(!options.switches.infile.args.length) {
        usage(false);
        error("fatal", "At least one input file must be specified.", "main");
    }
    exp.infiles = options.switches.infile.args;

    if(options.switches.regression.args.length) {
        try {
            exp.regression = exp.cwd + "/" + options.switches.regression.args[0];
        } catch(e) {
            error("fatal", "Unable to open regression file " + options.switches.regression.args[0] + ".", "main");
        }
    }

    if(!options.switches.outfile.args.length)
        error("fatal", "At least one output file must be specified.", "main");
    exp.outfiles = options.switches.outfile.args;

    error("debug", "exp.outfiles = ", "main");
    if(exp.debug)
        console.log(exp.outfiles);

    if(options.switches.msgprefix.args.length)
        exp.prefix = options.switches.msgprefix.args[0];

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
    var cats = { };
    for(var k in exp.tests)
        cats[exp.tests[k].cat] = true;

    cats = Object.keys(cats);
    cats.sort();
    cats.unshift("@@GLOBAL@@");

    var result = {};
    for(var i = 0; i < cats.length; i++)
        result[cats[i]] = {
            tests:      0,
            failed:     0,
            failPct:    0,
            jsFailed:   0,
            jsFailPct:  0,
            succeeded:  0,
            successPct: 0,
            regressed:  0,
            regressPct: 0,
        };

    for(var k in exp.tests) {
        test = exp.tests[k];
        result[exp.tests[k].cat].tests++;
        result["@@GLOBAL@@"].tests++;
        if(test.success) {
            result[exp.tests[k].cat].succeeded++;
            result["@@GLOBAL@@"].succeeded++;
        } else {
            result[exp.tests[k].cat].failed++;
            result["@@GLOBAL@@"].failed++;
        }
        if(test.regression !== undefined && test.regression) {
            result[exp.tests[k].cat].regressed++;
            result["@@GLOBAL@@"].regressed++;
        }
        if(test.jsSuccess !== undefined && !test.jsSuccess) {
            result[exp.tests[k].cat].jsFailed++;
            result["@@GLOBAL@@"].jsFailed++;
        }
    }

    for(var i = 0; i < cats.length; i++) {
        if(result[cats[i]].tests) { // avoid division by zero
            result[cats[i]].failPct    = ((result[cats[i]].failed    / result[cats[i]].tests) * 100).toFixed(1);
            result[cats[i]].successPct = ((result[cats[i]].succeeded / result[cats[i]].tests) * 100).toFixed(1);
            result[cats[i]].regressPct = ((result[cats[i]].regressed / result[cats[i]].tests) * 100).toFixed(1);
            result[cats[i]].jsFailPct  = ((result[cats[i]].jsFailed  / result[cats[i]].tests) * 100).toFixed(1);
        }
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
    try {
        var old = JSON.parse(fs.readFileSync(exp.regression, { encoding: "utf8"}));
    } catch(e) {
        error("fatal", "Unable to parse JSON in regression file.", "findRegressions");
    }

    for(var test in old) {
        if(exp.tests[test] === undefined) {
            error("warn", "Test " + test + " is present in regression file but not current test file.", "findRegression");
        } else {
            exp.tests[test].regression = old[test].hash == exp.tests[test].hash ? false : true;
            if(exp.fullRegress && exp.tests[test].regression) {
                exp.tests[test].diff = diff.diffTrimmedLines(old[test].testData, exp.tests[test].testData);
            }
        }
    }

    error("debug", "exp.tests = ", "findRegressions");
    if(exp.debug)
        console.log(exp.tests);
}


//==============================================================================
// Reads the infile(s), looking for the message prefix and acting accordingly.
// Content before the first test instruction and after the last is ignored.
//==============================================================================

function analyzeTestData() {
    var prefixLength = exp.prefix.length;
    var currentTest  = null;
    var ignoredLines = 0;

    // Iterate through the input files -----------------------------------------

    for(var f = 0; f < exp.infiles.length; f++) {

        try {
            var lines = fs.readFileSync(exp.cwd + "/" + exp.infiles[f], { encoding: "utf8"}).split(/\n/);
        } catch(e) {
            error("fatal", "Unable to open input file " + exp.infiles[f] + " for reading.", "analyzeTestData");
        }

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

                    msg.id = msg.id.toString().trim();

                    if(msg.cat !== undefined)
                        msg.cat = msg.cat.toString().trim();
                    else
                        msg.cat = null;

                    if(msg.label === undefined)
                        error("fatal", "JSON begin message with missing label in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");
                    msg.label = msg.label.toString().trim();
                    if(msg.desc === undefined)
                        error("fatal", "JSON begin message with missing desc in " + exp.infiles[f] + " at line " + lineNumber, "analyzeTestData");

                    currentTest = { id: msg.id, cat: msg.cat, label: msg.label, desc: msg.desc };
                    testData = [ ];

                    if(exp.jsTest && msg.jsTest !== undefined) {
                        var tref = { }
                        if(!Array.isArray(msg.jsTest))
                            msg.jsTest = [ msg.jsTest ];
                        for(var j = 0; j < msg.jsTest.length; j++) {
                            if(exp.jsTest[msg.jsTest[j]] === undefined) {
                                error("fatal", "JavaScript test \"" + msg.jsTest[j] + "\" in test " + msg.cat + "/" + msg.id + " is undefined.");
                            } else {
                                tref[msg.jsTest[j]] = exp.jsTest[msg.jsTest[j]];
                            }
                        }
                        currentTest.jsTest = tref;
                    }

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
                    if(exp.fullRegress)
                        currentTest.testData = testBlob;
                    currentTest.hash    = md5(testBlob);
                    currentTest.size    = testBlob.length;

                    if(currentTest.jsTest) {
                        for(var funcname in currentTest.jsTest) {
                            currentTest.jsSuccess = currentTest.jsTest[funcname](msg.cat, msg.id, testBlob);
                        }
                        delete currentTest.jsTest;
                    }

                    exp.tests[currentTest.cat + ":" + currentTest.id] = currentTest;

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
            var fd = fs.openSync(fname, "w");
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
        exp.testSequence.push(k);

    exp.testSequence.sort();

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
                fs.closeSync(exp.outfiles[filename].fd);
                break;
            case "csv":
                testReportCSV(exp.outfiles[filename].fd, dataCopy, summaryCopy);
                fs.closeSync(exp.outfiles[filename].fd);
                break;
            case "html":
                testReportHTML(exp.outfiles[filename].fd, dataCopy, summaryCopy);
                fs.closeSync(exp.outfiles[filename].fd);
                break;
            case "json":
                testReportJSON(exp.outfiles[filename].fd);
                fs.closeSync(exp.outfiles[filename].fd);
                break;
        }
    }
}

//==============================================================================
// Puts the report summary data into an array of arrays for feeding to the
// report formatters. There is no header row.
//==============================================================================

function assembleSummaryData() {

    var rows = [ ["Category", "Item", "Num", "Pct"] ];

    var cats = { };
    for(var k in exp.tests)
        cats[exp.tests[k].cat] = true;

    cats = Object.keys(cats);
    cats.sort();
    cats.unshift("@@GLOBAL@@");


    for(var i = 0; i < cats.length; i++) {
        var cat     = cats[i];
        var catName = cats[i] == "@@GLOBAL@@" ? "(ALL)" : cats[i];

        rows.push([catName, "Total Tests:", exp.summary[cat].tests,     "100.0%"                     ]);
        rows.push([catName, "Succeeded:",   exp.summary[cat].succeeded, exp.summary[cat].successPct + "%" ]);
        rows.push([catName, "Failed:",      exp.summary[cat].failed,    exp.summary[cat].failPct    + "%" ]);

        if(exp.regression)
            rows.push([catName, "Regressions:", exp.summary[cat].regressed, exp.summary[cat].regressPct + "%"]);

        if(exp.jsTest)
            rows.push([catName, "JS Failed:", exp.summary[cat].jsFailed, exp.summary[cat].jsFailPct + "%"]);
    }

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
        row.push("JTST");
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
        row.push(test.success ? "ok" : "FAIL");
        if(exp.jsTest) {
            if(test.jsSuccess === undefined) {
                row.push("n/a");
            } else if(test.jsSuccess === true) {
                row.push("ok");
            } else {
                row.push("FAIL");
            }
        }
        if(exp.regression) {
            row.push(test.regression ? "FAIL" : "ok");
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
        test:  { alignment: "center", width: 4 },
        js:    { alignment: "center", width: 4 },
        reg:   { alignment: "center", width: 4 },
        cat:   { alignment: "left" },
        id:    { alignment: "left" },
        label: { alignment: "left" },
        desc:  { alignment: "left", wrapWord: true, width: 40 }
    };

    if(exp.descWidth)
        columns.desc.width = exp.descWidth;

    var config = {
        border: table.getBorderCharacters("ramac"),
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

    for(var row = 0; row < data.length; row++) {
        for(var col = 0; col < data[row].length; col++) {
            if(data[row][col] == "ok")
                data[row][col] = " ok ";
        }
    }

    var sconfig = {
        border: table.getBorderCharacters("ramac"),
        columns: {
            0: { alignment: "left"  },
            1: { alignment: "right" },
            2: { alignment: "right" },
            3: { alignment: "right" }
        }
    };

    var result = table.table(data, config) + "\n"
            + "SUMMARY:\n"
            + table.table(summary, sconfig) + "\n\n";

    if(internal)
        return result;
    else
        console.log(result);
}


//------------------------------------------------------------------------------

function testReportAnsi(data, summary) {
    for(var i = 0; i < data[0].length; i++)
        data[0][i] = ac.yellow.bold(data[0][i]);

    var columns = {
        test:  { alignment: "center", width: 4 },
        js:    { alignment: "center", width: 4 },
        reg:   { alignment: "center", width: 4 },
        cat:   { alignment: "left" },
        id:    { alignment: "left" },
        label: { alignment: "left" },
        desc:  { alignment: "left", wrapWord: true, width: 40 }
    };

    if(exp.descWidth)
        columns.desc.width = exp.descWidth;

    var config = {
        border: table.getBorderCharacters("honeywell"),
        columns: { }
    };

    for(var row = 0; row < data.length; row++) {
        if(data[row][0] == "n/a")
            data[row][0] = ac.blue(" -- ");
        else if(data[row][0] == "ok")
            data[row][0] = ac.bgGreen.white.bold(" ok ");
        else if(data[row][0] == "FAIL")
            data[row][0] = ac.bgRed.yellow.bold("FAIL");
    }

    var col = 0;
    config.columns[col++] = columns.test;
    if(exp.jsTest) {
        for(var row = 0; row < data.length; row++) {
            if(data[row][col] == "n/a")
                data[row][col] = ac.blue(" -- ");
            else if(data[row][col] == "ok")
                data[row][col] = ac.bgGreen.white.bold(" ok ") + " ";
            else if(data[row][col] == "FAIL")
                data[row][col] = ac.bgRed.yellow.bold("FAIL") + " ";
        }
        config.columns[col++] = columns.js;
    }
    if(exp.regression) {
        for(var row = 0; row < data.length; row++) {
            if(data[row][col] == "n/a")
                data[row][col] = ac.blue(" -- ");
            else if(data[row][col] == "ok")
                data[row][col] = ac.bgGreen.white.bold(" ok ");
            else if(data[row][col] == "FAIL")
                data[row][col] = ac.bgRed.yellow.bold("FAIL");
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
                data[row][c] = ac.red.bold(data[row][c]) + ac.white("");
            }
        }
    }

    config.columns[col++] = columns.cat;
    config.columns[col++] = columns.id;
    config.columns[col++] = columns.label;
    if(exp.longFormat)
        config.columns[col++] = columns.desc;

    var sconfig = {
        border: table.getBorderCharacters("honeywell"),
        columns: {
            0: { alignment: "left"  },
            1: { alignment: "right" },
            2: { alignment: "right" },
            3: { alignment: "right" },
        }
    };

    var scolor = {
        "Total Tests:": ac.white.bold,
        "Succeeded:":   ac.green.bold,
        "Failed:":      ac.red.bold,
        "JS Failed:":   ac.magenta.bold,
        "Regressions:": ac.yellow.bold
    };

    for(var row = 0; row < summary.length; row++) {
        if(scolor[summary[row][1]] !== undefined)
            var func = scolor[summary[row][1]];
        else
            var func = function(x) { return x; };

        for(var col = 1; col < summary[row].length; col++) {
            summary[row][col] = func(summary[row][col]);
        }
    }

    var result = table.table(data, config) + "\n"
            + ac.white.bold("SUMMARY:\n")
            + table.table(summary, sconfig) + "\n\n";

    console.log(result);
}

//------------------------------------------------------------------------------

function testReportText(fd, data, summary) {
    var content = testReportConsole(data, summary, true);
    fs.writeSync(fd, content);
}

//------------------------------------------------------------------------------

function testReportCSV(fd, data, summary) {
    fs.writeSync(fd, csvify(data));
    fs.writeSync(fd, "\n\nSUMMARY:\n");
    fs.writeSync(fd, csvify(summary));
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

    fs.writeSync(fd,
        "<!doctype html>\n"
        + "<html><head><meta charset=\"utf-8\">\n"
        + "<title>Experior Test Results</title>\n"
    );
    if(exp.css) {
        fs.writeSync(fd, "<link href=\"" + exp.css + "\" rel=\"stylesheet\" type=\"text/css\" />\n");
    } else {
        fs.writeSync(fd,
            "<style type='text/css'>\n"
            + "body,table { font: 10pt Arial,Helvetica,sans-serif; }\n"
            + "table.sgrid { margin-top: 0.5em; border-collapse: collapse; }\n"
            + "table.sgrid > thead { background-color: #263E4F;  color: white; }\n"
            + "table.sgrid > td { padding-left: 0.5em; padding-right: 0.5em; vertical-align: top; }\n"
            + "table.sgrid td { border: 0.25pt solid black; white-space: nowrap; vertical-align: top; }\n"
            + "table.sgrid th { background-color: #3C607B; border: 0.25pt solid black; }\n"
            + "table.sgrid td { padding-left: 0.25em; padding-right: 0.25em; }\n"
            + "table.sgrid td.success { color: white; background-color: #0A0; text-align: center; }\n"
            + "table.sgrid td.failure { color: yellow; background-color: #A00; text-align: center; font-weight: bold; }\n"
            + "table.sgrid td.category { font-weight: bold; }\n"
            + "table.sgrid td.testId { font-weight: bold; }\n"
            + "table.sgrid td.failed { background-color: #FDD; }\n"
            + "table.sgrid td.num { text-align: right; }\n"
            + "table.sgrid td.desc { white-space: normal; }\n"
            + "div.diff { font: 10pt Consolas,Courier,fixed; white-space: pre; padding-top: 0.5em; padding-bottom: 0.5em; }\n"
            + "div.diff div.unchanged { color: black; }\n"
            + "div.diff div.added     { color: #080; }\n"
            + "div.diff div.removed   { color: #A00; }\n"
            + "</style>\n"
        );
    }
    fs.writeSync(fd,
        "</head>\n"
        + "<body>\n"
        + "<h1>Experior Test Results</h1>\n"
        + "<h2>Test Results</h2>\n"
        + "<table class=\"sgrid\" id=\"testResults\">\n"
        + "<thead>\n"
    );

    var headerRow = data.shift();
    var columnCount = headerRow.length;
    fs.writeSync(fd,
        "<tr><th>" + headerRow.join("</th><th>") + "</th></tr>\n"
        + "</thead>\n"
        + "<tbody>\n"
    );

    for(var i = 0; i < headerRow.length; i++) {
        if(headerRow[i] == "Category")
            var catCol = i;
        else if(headerRow[i] == "Test ID")
            var idCol = i;
    }

    for(var row = 0; row < data.length; row++) {
        var failed = false;
        var testId = data[row][catCol] + ":" + data[row][idCol];

        for(var col = 0; col < data[row].length; col++) {
            var datum = data[row][col].toString().trim();
            var classItem = "";

            if(datum == "FAIL") {
                classItem = " class=\"failure\"";
                failed = true;
            } else if(datum == "ok") {
                classItem = " class=\"success\"";
            } else if(headerRow[col] == "Category") {
                classItem = " class=\"category\"";
            } else if(headerRow[col] == "Test ID") {
                classItem = " class=\"testID\"";
            }

            // You know that point when you're almost finished with a lot of code
            // and the last thing you do makes it painfully clear that you should
            // go back and refactor all of it? This conditional is where that
            // happens for the reports. Hacky McHackhack, sheesh.

            if(failed && headerRow[col] != "Test" && headerRow[col] != "Reg." && headerRow[col] != "JTST") {
                if(classItem.length) {
                    classItem = classItem.substr(0, classItem.length - 1);
                    classItem += " failed\"";
                } else {
                    classItem = " class=\"failed\"";
                }
            }
            if(headerRow[col] == "Test Description") {
                if(classItem.length) {
                    classItem = classItem.substr(0, classItem.length - 1);
                    classItem += " desc\"";
                } else {
                    classItem = " class=\"desc\"";
                }
            }

            datum = "<td" + classItem + ">" + datum + "</td>";
            data[row][col] = datum;
        }
        fs.writeSync(fd,
            "<tr>" + data[row].join("") + "</td></tr>\n"
        );

        // Initial version of diff output -------------------------------------

        if(exp.fullRegress && exp.tests[testId].diff !== undefined) {
            var diffOutput = [ "<tr><td colspan='" + columnCount + "'>\n<div class='diff'>" ];
            var diff = exp.tests[testId].diff;
            for(var d = 0; d < diff.length; d++) {
                if(diff[d].removed) {
                    var dclass = "removed";
                    var pre    = " - ";
                } else if(diff[d].added) {
                    var dclass = "added";
                    var pre    = " + ";
                } else {
                    var dclass = "unchanged";
                    var pre    = "   ";
                }
                diff[d].value = diff[d].value.trimEnd().replace(/\n/g, "\n" + pre);
                diffOutput.push("<div class='" + dclass + "'>" + pre + diff[d].value + "</div>");
            }
            diffOutput.push("</div>\n</td></tr>");
            diffOutput = diffOutput.join("");
            fs.writeSync(fd, diffOutput);
        }


    }

    fs.writeSync(fd,
        "</tbody>\n"
        + "</table>\n"
        + "<h2>Summary</h2>\n"
        + "<table class=\"sgrid\" id=\"testSummary\">\n"
    );

    var rcolors = [ "#EEF", "#FFF" ];
    var cgroup = 0;
    var lastCat = null;

    var headerRow = summary.shift();
    fs.writeSync(fd, "<thead><tr><th>" + headerRow.join("</th><th>") + "</th></tr></thead><tbody>\n");

    for(var row = 0; row < summary.length; row++) {
        if(lastCat != summary[row][0]) {
            cgroup = cgroup ? 0 : 1;
            lastCat = summary[row][0];
        }
        fs.writeSync(fd, "<tr style='background-color: " + rcolors[cgroup] + ";'>"
            + "<td>" + summary[row][0] + "</td>"
            + "<td class='num'>" + summary[row][1] + "</td>"
            + "<td class='num'>" + summary[row][2] + "</td>"
            + "<td class='num'>" + summary[row][3] + "</td>"
            + "</tr>\n"
        );
    }

    fs.writeSync(fd, "</tbody>\n</table>\n</body>\n</html>\n");

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

    fs.writeSync(fd, JSON.stringify(data));
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
//==============================================================================

function usage() {
    console.log(minicle.ansiMarkup(`
    @07@Usage: @0F@experior @0B@[options]

    @0A@-i, --infile        @0B@<filename(s)>  @07@Path to input file(s).
    @0A@-o, --outfile       @0B@<filename(s)>  @07@Output file names.
    @0A@-r, --regression    @0B@<filename>     @07@Regression test input file.
    @0A@-R, --full-regress  @0B@               @07@Create and use full regression data.
    @0A@-j, --jstest        @0B@<filename>     @07@JavaScript test module.
    @0A@-c, --css           @0B@<filename>     @07@CSS file to use with HTML output.
    @0A@-l, --long          @0B@               @07@Use long report format.
    @0A@-w, --width         @0B@<number>       @07@Set width for text descriptions.
    @0A@-m, --msgprefix     @0B@<string>       @07@Experior message prefix.
    @0A@-f, --failures      @0B@               @07@Only show failures in reports.
    @0A@-v, --verbose       @0B@               @07@Increase verbosity (1-4).
    @0A@-q, --quiet         @0B@               @07@Suppress console output.
    @0A@-d, --debug         @0B@               @07@Display debugging info.
    @0A@-h, --help          @0B@               @07@Display this text.`));

    process.exit(0);
}



//==============================================================================
// Prints an error message to console if permitted by the current verbosity
// level, and if the error is fatal, terminates the process.
//==============================================================================

function error(level, message, location = "EXPERIOR") {

    if(!exp.quietMode)
        minicle.errmsg(level, message, location, { verbosity: exp.verbosity });

}








