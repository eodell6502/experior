# Experior 0.0.1
**A minimal but powerful and language-agnostic unit and regression test tool.**

> "Experior" is a Latin verb meaning "to put to the test". It is the root of the English words "experiment", "experience", and "expert".

## Overview

Experior is a Node-based command-line tool, not a library or framework. It takes 
specially marked-up test output from your test program which may have performed 
its own tests and included the results, and it generates reports in various 
formats from that. It can also apply tests written in JavaScript to the test 
output. Both types of tests can be used at the same time.

It can also emit a JSON file containing test IDs and the MD5 hashes derived from 
the test output. This can be re-used on subsequent runs to detect regressions.

Full details are below, including a tutorial with examples.

## Installation

If you're not interested in poking around with the source, the easiest thing to do
is to just use `npm` to install the Node.js module:

```bash
$ npm install experior --global
```

__Note:__ Experior is currently in beta as of 3/13/2019 and has not yet been 
published to the NPMjs repository.

## Command-Line Usage

```
===========================================================================
         Experior v0.0.1 -- Minimalist Unit/Regression Test Tool
===========================================================================

  Usage: experior [options]

    -i, --infile     <filename(s)>  Path to input file(s).
    -o, --outfile    <filename(s)>  Output file names.
    -r, --regression <filename>     Regression test input file.
    -j, --jstest     <filename>     JavaScript test module.
    -c, --css        <filename>     CSS file to use with HTML output.
    -l, --long                      Use long report format.
    -w, --width      <number>       Set width for text descriptions.
    -m, --msgprefix  <string>       Experior message prefix.
    -f, --failures                  Only show failures in reports.
    -p, --prng       <type> <num>   Generate num random numbers of type.
    -s, --seed       <num|string>   Explicit PRNG seed.
    -v, --verbose                   Increase verbosity (starts at 1, up to 4).
    -q, --quiet                     Suppress console output.
    -d, --debug                     Display debugging info.
    -h, --help                      Display this text.
```

## Test File Format

...

## Output Formats

...

## Regression Tests

...

## JavaScript Tests

...

## Tutorial and Examples

...

## Status

Experior is currently in beta as of 3/13/2019. In a week or so, when I'm done 
testing it to my satisfaction, it will 
