#!/usr/bin/env node

//==============================================================================
// This is the tutorial test program.
//==============================================================================

var fs = require("fs");
var CrappyArray = require("./CrappyArray.js");

main();

//==============================================================================
// Our trivial main loop opens the output file and then calls the test
// functions, passing the file descriptor to each of them so that they can
// write their test blocks.
//==============================================================================

function main() {
    var fd = fs.openSync("test_output.txt", "w");

    // In a real test program, it might be less trouble to define the test
    // functions as array elements and just loop through the array here.

    CAInit(fd);
    CALength(fd);
    CAStackOps(fd);
    CAMisc(fd);

    fs.closeSync(fd);
}

//==============================================================================
// Utility function to write a test block to a file. You have to open and close
// the file yourself, but this takes care of the rest.
//
//     fd ......... file descriptor from fs.open
//     id ......... id string for test
//     cat ........ test category
//     label ...... short label for test
//     desc ....... longer description for test
//     success .... boolean indicating success or failure of test
//     data ....... test data
//     jsTest ..... (optional) function name or array of function names for
//                  JavaScript tests
//==============================================================================

function writeTest(fd, id, cat, label, desc, success, data, jsTest = null) {
    var header = {
        type:    "begin",
        id:      id,
        cat:     cat,
        label:   label,
        desc:    desc
    };
    if(jsTest !== null)
        header.jsTest = jsTest;

    var footer = {
        type:    "end",
        id:      id,
        success: success
    };

    fs.writeSync(fd,
        "@EXPERIOR: " + JSON.stringify(header) + "\n"
        + data
        + "\n@EXPERIOR: " + JSON.stringify(footer) + "\n\n"
    );

    return;
}


//==============================================================================
// In the interest of DRY, this is a function to dump the contents of our
// control native Arrays alongside our test subject CrappyArrays.
//==============================================================================

function testOutput(control, subject) {
    return "subject.length = " + subject.length     + "\n"
        + "control.length = " + control.length     + "\n"
        + "subject contains " + subject.join(", ") + "\n"
        + "control contains " + control.join(", ") + "\n";
}


//==============================================================================
// Our test functions follow. Each function performs multiple tests.
//==============================================================================

//------------------------------------------------------------------------------
// First, we'll test initializing a CrappyArray in various ways and using the
// element method. We'll use real Arrays for comparison. All of these will be
// successful, but don't get used to it.
//------------------------------------------------------------------------------

function CAInit(fd) {

    // Test initialization with single integer ---------------------------------

    var subject = new CrappyArray(4);
    var control = new Array(4);
    var success = subject.length == control.length;

    // We don't have to produce test output for this, but it is necessary for
    // regression testing, so:

    var output = testOutput(control, subject);

    writeTest(fd, "CAInit01", "CrappyArray", "CrappyArray init with number",
        "Both the native Array and our CrappyArray can be initialized with "
        + "a single number, which creates an array of the same number of "
        + "undefined elements.", success, output);

    // Test initialization with a list of elements -----------------------------

    var subject = new CrappyArray("foo", "bar", "baz", "quux");
    var control = new Array("foo", "bar", "baz", "quux");
    var success = subject.length == control.length;

    for(var i = 0; i < subject.length; i++) {
        if(subject.element(i) !== control[i]) {
            success = false;
            break;
        }
    }

    var output = testOutput(control, subject);

    writeTest(fd, "CAInit02", "CrappyArray", "CrappyArray init with list",
        "Both the native Array and our CrappyArray are initialized with the "
        + "same set of strings, yielding arrays containing those strings.",
        success, output);

    // Try setting the same elements using control[] and subject.element() -----

    var subject = new CrappyArray();
    var control = new Array();
    var success = subject.length == control.length;
    var values  = [ "foo", "bar", "baz", "quux" ];

    for(var i = 0; i < values.length; i++) {
        subject.element(i, values[i]);
        control[i] = values[i];
    }

    for(var i = 0; i < subject.length; i++) {
        if(subject.element(i) !== control[i]) {
            success = false;
            break;
        }
    }

    writeTest(fd, "CAInit03", "CrappyArray", "CrappyArray post-initialization",
        "Create a CrappyArray and set its elements with the element method, "
        + "doing the same with the native Array and the [] operator.",
        success, output);

    //--------------------------------------------------------------------------

    return;
}


//------------------------------------------------------------------------------
// The fun we had with successful tests is about to end. Our flawed length
// method is about to blow chunks.
//------------------------------------------------------------------------------

function CALength(fd) {
    var control = [ "foo", "bar", "baz", "quux" ];
    var subject = new CrappyArray("foo", "bar", "baz", "quux");

    var output = "BEFORE:\n\n" + testOutput(control, subject) + "\n\n";

    control.length = 6;
    subject.length = 6;

    var success = control.length == subject.length;

    output += "AFTER:\n\n" + testOutput(control, subject) + "\n\n";

    writeTest(fd, "CALength", "CrappyArray", "CrappyArray length read-only",
        "The length property of native Arrays is read-only. You can try to set "
        + "it, but it isn't changed. We're testing here to make sure that "
        + "CrappyArray behaves the same way.", success, output);

    return;
}


//------------------------------------------------------------------------------
// We'll have more length problems with pop, as well as the shift/unshift mixup,
// when we test push/pop/unshift/shift. We're going to exercise these guys using
// some pre-generated test data to make sure we're thorough and also to make
// sure regression testing has a lot of test data to monitor. In a real test,
// especially when performing fuzz testing, a LOT more test data is recommended.
//------------------------------------------------------------------------------

function CAStackOps(fd) {

    var operation = [ "push", "push", "unshift", "push", "shift", "unshift",
        "pop", "push", "push", "push", "pop", "push", "push", "push", "push",
        "unshift", "pop", "pop", "push", "pop", "pop", "pop", "shift", "shift",
        "pop", "pop", "pop", "pop", "unshift", "push", "push", "unshift",
        "push", "unshift", "push", "pop", "unshift", "shift", "shift", "shift",
        "push", "unshift", "pop", "push", "unshift", "unshift", "unshift",
        "pop", "shift", "pop" ];
    var count     = [ 4, 3, 1, 4, 2, 4, 3, 1, 1, 2, 3, 1, 2, 1, 3, 2, 4, 2, 4,
        3, 4, 4, 2, 1, 2, 3, 4, 1, 4, 2, 3, 2, 1, 4, 1, 2, 4, 1, 2, 2, 2, 4, 2,
        3, 1, 3, 1, 3, 2, 2 ];
    var items     = [ "foo", "bar", "baz", "quux", "corge", "grault", "garply",
        "waldo", "fred", "plugh", "xyzzy", "thud" ];

    // We'll loop through operation and count, performing the operation count
    // times using items as our source for things to add to our arrays. And yes,
    // just with these little 50-element arrays, we could hammer the test
    // objects much harder, but this is a tutorial.

    // That said, even our relatively short run will be good at detecting bugs
    // and the output makes it easier to track where things go wrong.

    var currentItem = 0;
    var control     = new Array();
    var subject     = new CrappyArray();
    var output      = [ testOutput(control, subject) ];
    var success     = true;
    var cr, sr;

    for(var i = 0; i < operation.length; i++) {

        try {
            for(var j = 0; j < count[i]; j++) {

                var item = (i+j) % items.length;

                switch(operation[i]) {
                    case "push":
                        cr = control.push(items[item]);
                        sr = subject.push(items[item]);
                        break;
                    case "pop":
                        cr = control.pop();
                        sr = subject.pop();
                        break;
                    case "shift":
                        cr = control.push();
                        sr = subject.push();
                        break;
                    case "unshift":
                        cr = control.unshift(items[item]);
                        sr = subject.unshift(items[item]);
                        break;
                }
                output.push("cr/sr = " + cr + "/" + sr);
            }
        } catch(e) {
            output.push("Iteration " + i + " threw an error.");
            output.push(e);
            success = false;
        }

        if(subject.length != control.length || subject.join(",") != control.join(","))
            success = false;

        output.push(testOutput(control, subject));

    }

    writeTest(fd, "CAStackOps", "CrappyArray", "Testing push/pop/unshift/shift",
        "We're looping through a randomized set of stack operations " + operation.length
        + " times, looking for divergence between the subject and the control.",
        success, output.join("\n\n"));
}


//------------------------------------------------------------------------------
// For our last tests, we'll skip doing any internal tests and let Experior run
// JavaScript tests on the output data. To make it easier, the test output will
// consist of JSON objects.
//------------------------------------------------------------------------------

function CAMisc(fd) {

    // First, we'll reuse our existing pop bug to make reverse break -----------

    var result = { control: { }, subject: { } };

    var control = new Array("foo", "bar", "baz", "quux");
    var subject = new CrappyArray("foo", "bar", "baz", "quux");

    result.control.pre = control.join(",");
    result.subject.pre = control.join(",");

    control.pop();
    subject.pop();

    control.reverse();
    subject.reverse();

    result.control.post = control.join(",");
    result.subject.post = subject.join(",");

    // Note that we're marking this as a success because we're not performing
    // any internal tests.

    writeTest(fd, "CAMisc1", "CrappyJSTest", "Pop/reverse bug check",
        "CrappyArray.pop has a bug in the handling of its length property, "
        + "which in turn causes the reverse method to fail.", true,
        JSON.stringify(result), "popReverseTest");

    // Our last test triggers the default separator bug in join ----------------

    var result = { };

    var control = new Array("foo", "bar", "baz", "quux");
    var subject = new CrappyArray("foo", "bar", "baz", "quux");

    result.control = control.join();
    result.subject = subject.join();

    writeTest(fd, "CAMisc2", "CrappyJSTest", "Default join separator",
        "Here we compare the behavior of Array.join and CrappyArray.join when "
        + "no separator is specified.", true, JSON.stringify(result),
        "joinDefaultTest");

    // ....aaaaand we're done!

    return;
}

