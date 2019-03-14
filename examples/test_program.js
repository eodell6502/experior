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

    coreFunctionality(fd);

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
        + "@EXPERIOR: " + JSON.stringify(header) + "\n\n"
    );

    return;
}


//==============================================================================
// Our test functions follow. Each function performs multiple tests.
//==============================================================================

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------

function coreFunctionality(fd) {

}



