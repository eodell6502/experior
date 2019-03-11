var experior = {

    ac:        require("ansi-colors"),
    isaac:     require("isaac"),
    minicle:   require("minicle"),
    process:   require("process"),

    version:   "0.0.1",

    optionMap: {
        debug:      { short: "d", cnt: 0    },
        help:       { short: "h", cnt: 0    },
        infile:     { short: "i", vals: [ ] },  // accumulates values
        outfiles:   { short: "o", vals: [ ] },
        prng:       { short: "p", vals: [ ] },
        quietMode:  { short: "q", cnt: 0    },
        seed:       { short: "s", vals: [ ] },
        verbose:    { short: "v", cnt: 0    },     // accumulates appearance counts
    },
    debug:     false,
    infiles:   [ ],
    outfiles:  [ ],
    quietMode: false,
    verbosity: 0,
}



main();


function main() {

    // Process CLI options -----------------------------------------------------

    experior.minicle(experior.optionMap);

    // Begin ceremonial output -------------------------------------------------

    if(experior.optionMap.quietMode.cnt == 0)
        outputHeader(experior.version);
    if(experior.optionMap.help.cnt)
        usage(); // exits

    // Have we been asked for PRNGs instead of a test run? ---------------------

    if(experior.optionMap.prng.vals.length == 2) {
        if(experior.optionMap.seed.vals.length) {
            var seed = experior.optionMap.seed.vals.join("");
        } else {
            var seed = new Date().getTime();
        }
        prng(experior.optionMap.prng.vals[0], experior.optionMap.prng.vals[1], seed);
        experior.process.exit(0);
    } else if(experior.optionMap.prng.vals.length > 1) {
        error("fatal", "PRNG requires both a type and a number.", "EXPERIOR");
        experior.process.exit(1);
    }


}


//==============================================================================
// Outputs num pseudo-random numbers of the specified type, where type can be
// 8, 16, 24, 32, or 64 for integers, or "float" for floats.
//==============================================================================

function prng(type, num, seed) {

    experior.isaac.seed(seed);

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
                console.log(Math.floor(experior.isaac.random() * base));
            break;

        case "float":
            for(var i = 0; i < num; i++)
                console.log(experior.isaac.random());
            break;

        default:
            error("fatal", "Legal values for PRNG type are 8, 16, 24, 32, 64, or \"float\".", "EXPERIOR");

    }

}

//==============================================================================
// Outputs usage instructions.
//==============================================================================

function usage() {

    console.log(experior.ac.white.bold("  Usage: experior [options]\n\n")
        + experior.ac.yellow.bold("    -i") + experior.ac.yellow(", ") + experior.ac.yellow.bold("--infile     ") + experior.ac.blue.bold("<filename(s)>  ") + experior.ac.cyan.bold("Path to input file(s).\n")
        + experior.ac.yellow.bold("    -o") + experior.ac.yellow(", ") + experior.ac.yellow.bold("--outfile    ") + experior.ac.blue.bold("<filename(s)>  ") + experior.ac.cyan.bold("Output file names.\n")
        + experior.ac.yellow.bold("    -p") + experior.ac.yellow(", ") + experior.ac.yellow.bold("--prng       ") + experior.ac.blue.bold("<type> <num>   ") + experior.ac.cyan.bold("Generate num random numbers of type.\n")
        + experior.ac.yellow.bold("    -s") + experior.ac.yellow(", ") + experior.ac.yellow.bold("--seed       ") + experior.ac.blue.bold("<num|string>   ") + experior.ac.cyan.bold("Explicit PRNG seed.\n")
        + experior.ac.yellow.bold("    -v") + experior.ac.yellow(", ") + experior.ac.yellow.bold("--verbose    ") + experior.ac.blue.bold("               ") + experior.ac.cyan.bold("Increase verbosity (starts at 1, up to 4).\n")
        + experior.ac.yellow.bold("    -q") + experior.ac.yellow(", ") + experior.ac.yellow.bold("--quietMode  ") + experior.ac.blue.bold("               ") + experior.ac.cyan.bold("Suppress console output.\n")
        + experior.ac.yellow.bold("    -d") + experior.ac.yellow(", ") + experior.ac.yellow.bold("--debug      ") + experior.ac.blue.bold("               ") + experior.ac.cyan.bold("Display debugging info.\n")
        + experior.ac.yellow.bold("    -h") + experior.ac.yellow(", ") + experior.ac.yellow.bold("--help       ") + experior.ac.blue.bold("               ") + experior.ac.cyan.bold("Display this text.\n\n"));

}

//==============================================================================
// Outputs the runtime header to console. This will become progressively more
// ostentatious and ridiculous as time goes by.
//==============================================================================

function outputHeader(version) {

    console.log(
        "\n" + experior.ac.blue("===========================================================================") + "\n"
        + experior.ac.yellow.bold("         Experior v" + version + " -- Minimalist Unit/Regression Test Tool") + "\n"
        + experior.ac.blue("===========================================================================") + "\n"
    );

}


//==============================================================================
// Prints an error message to console if permitted by the current verbosity
// level, and if the error is fatal, terminates the process.
//==============================================================================

function error(level, message, location = "EXPERIOR") {

    if(!experior.quietMode) {
        switch(level) {
            case "fatal":
                console.log(experior.ac.bgRed.yellowBright("[" + location + "]") + experior.ac.redBright(" FATAL ERROR: ") + experior.ac.yellowBright(message));
                break;
            case "warn":
                if(experior.verbosity >= 1)
                    console.log(experior.ac.bgYellow.whiteBright("[" + location + "]") + experior.ac.yellowBright(" WARNING: ") + message);
                break;
            case "info":
                if(experior.verbosity >= 2)
                    console.log(experior.ac.bgGreen.whiteBright("[" + location + "]") + experior.ac.greenBright(" INFO: ") + message);
                break;
            case "debug":
                if(experior.verbosity >= 3 || experior.debug)
                    console.log("[" + location + "] DEBUG: " + message);
                break;
        }
    }

    if(level == "fatal" && experior.debug < 2)
        this.process.exit(1);
}

