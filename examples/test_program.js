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

    CAInit(fd);

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

function writeTest(fd, id, cat, label, desc, success, data, jsTest = null) { console.log(arguments);
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
        + "@EXPERIOR: " + JSON.stringify(footer) + "\n\n"
    );

    return;
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

    var output =
          "subject.length = " + subject.length     + "\n"
        + "control.length = " + control.length     + "\n"
        + "subject contains " + subject.join(", ") + "\n"
        + "control contains " + control.join(", ") + "\n";

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

    var output =
          "subject.length = " + subject.length     + "\n"
        + "control.length = " + control.length     + "\n"
        + "subject contains " + subject.join(", ") + "\n"
        + "control contains " + control.join(", ") + "\n";

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

    var output =
          "subject.length = " + subject.length     + "\n"
        + "control.length = " + control.length     + "\n"
        + "subject contains " + subject.join(", ") + "\n"
        + "control contains " + control.join(", ") + "\n";

    writeTest(fd, "CAInit03", "CrappyArray", "CrappyArray post-initialization",
        "Create a CrappyArray and set its elements with the element method, "
        + "doing the same with the native Array and the [] operator.",
        success, output);

    //--------------------------------------------------------------------------

    return;
}



