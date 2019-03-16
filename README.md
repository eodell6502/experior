# Experior 0.0.1
**A minimal but powerful and language-agnostic unit and regression test tool.**

> "Experior" is a Latin verb meaning "to put to the test". It is the root of the English words "experiment", "experience", and "expert".

## Overview

Experior is command-line tool, not a library or framework. It takes specially 
marked-up test output from your test program which may have performed its own 
tests and included the results, and it generates reports in various formats from 
that. It can also apply tests written in JavaScript to the test output. Both 
types of tests can be used at the same time.

It can also emit a JSON file containing test identifiers and the MD5 hashes 
derived from the test output. This can be re-used on subsequent runs to detect 
regressions.

Experior doesn't care how you are creating and running your tests, what language 
they are in, or what their output looks like. All it cares is that the test 
output is wrapped in a simple, standardized format. You _can_ write tests in 
JavaScript for Experior to apply to the test output, but this is entirely 
optional.

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

Experior has two mutually-exclusive operating modes, testing and generation of 
test data. The latter is activated with the `--prng` switch.

### Testing Switches

When performing tests, there are two mandatory switches, `--infile` and 
`--outfile`.

__-i, --infile__: Specifies one or more input files containing test data. As with the
other switches that take multiple arguments, you can place arguments after a single instance
of a switch or use the switch multiple times, e.g.

```bash
$ experior -i foo.dat bar.dat         # is equivalent to...
$ experior -i foo.dat -i bar.dat
```

__-o, --outfile__: Specifies one or more output files whose format is determined 
by their file extensions. The supported extensions are `.txt`, `.html`, `.csv`, 
and `.json`. Additionally, you can use the special names `console` and `ansi` to 
send output to the screen. The `console` report is plain text, while the `ansi`
report uses snazzy colors.

__-r, --regression__: Specifies a JSON file generated by a previous known-good 
run to compare with the current run to detect regressions.

__-j, --jstest__: Specifies the name of a JavaScript module containing tests to
run against the test data. See the _JavaScript Tests_ section below for details.

__-c, --css__: HTML reports have their own inline styles, but if you want to 
replace it with your own, use `-c` to provide a URL for an external stylesheet.

__-l, --long__: Activates the long report format which includes detailed test 
descriptions.

__-w, --width__: For `.txt`, `console`, and `ansi` formats, sets the width of 
the description column. The default is 40 characters.

__-m, --msgprefix__: Sets an alternate message prefix for test metadata. See
the _Test File Format_ section for details.

__-f, --failures__: If used, only failed tests will appear in the reports.

__-v, --verbose__: Increases the verbosity of informational output at the 
console. May be used up to four times.

__-q, --quiet__: Turns on quiet mode, suppressing all unnecessary console 
output.

__-d, --debug__: Turns on debugging output.

__-d, --help__: Displays the usage summary above.

### Test Data Generation Switches

Experior includes the ability to generate numeric test data.

__-p, --prng__: Takes two arguments, a _type_ and the number of items to 
generate. The type may be `8`, `16`, `24`, `32`, or `64` for integers, or 
`float` for floating point numbers.

__-s, --seed__: Provides an optional seed for the random number generator. This 
can be either a number or a string.

## Test File Format

Test files consist of test output beginning and ending with specially-marked messages
to Experior. These messages begin with a standard prefix at the beginning of the line. The
default prefix is `@EXPERIOR:`, but you can choose your own with the `--msgprefix` command
line switch. The prefix is followed by a JSON string containing the test parameters.

The message at the beginning of each test looks like this:

```
@EXPERIOR: {"type":"begin","id":"TestOne","cat":"testdata","label":"A 100% successful test","desc":"This is to test total success.","jsTest":"hasNoAlpha"}
```

And yes, it does have to be on one line, but let's look at a more human-readable
version of the JSON data:

```javascript
{ 
    type: 'begin',
    id: 'TestOne',
    cat: 'testdata',
    label: 'A 100% successful test',
    desc: 'This is to test total success.',
    jsTest: 'hasNoAlpha' 
}
```

The `type` attribute can have one of two values, `'begin'` or `'end'`; at the 
beginning of a test block, it will obviously be `'begin'`. The `id` attribute 
supplies a unique identifier for the test. You can group tests by supplying a 
category name in the `cat` attribute. (Report results are sorted by category and 
then identifier.) The `label` attribute is a short, human readable title for the 
test which appears on all reports. The `desc` attribute can be used for a more 
detailed description which only appears on the long version of reports. Finally, 
the optional `jsTest` attribute is either a string naming a JavaScript test 
function or an array of test function names.

Everything after the `begin` message is test output until the closing `end` 
message, which looks like this:

```
@EXPERIOR: {"type":"end","id":"TestOne","success":true }
```

Aside from `type`, which is `end` this time, and `id`, which is a repeat of the 
test identifier, the only other attribute is `success`, which contains a boolean 
indicating whether the test succeeded or not.

And that's it. If you can get your test program to crank that out, you're ready 
to go.

## Output Formats

### .txt/console

![console output](https://github.com/Waidthaler/experior/blob/master/misc/console.png)

### ANSI console

MS-DOS survivors, represent!

![ansi console output](https://github.com/Waidthaler/experior/blob/master/misc/ansi.png)

### HTML

If you don't care for my dubious web design skills, Experior will let you substitute
your own CSS stylesheet with the `--css` switch.

![html output](https://github.com/Waidthaler/experior/blob/master/misc/html.png)

### CSV

The only thing less interesting than CSV files is anything one could think to say
about them.

```
Test,JTST,Reg.,Category,"Test ID",Label,"Test Description"
ok,ok,ok,testdata,TestFour,"A 100% successful test","This is to test total success."
FAIL,ok,ok,testdata,TestOne,"Some even numbers","This is a bunch of even numbers."
ok,FAIL,ok,testdata,TestThree,"Some negative numbers","This is a bunch of negative numbers."
ok,ok,FAIL,testdata,TestTwo,"Some odd numbers","This is a bunch of odd numbers."

SUMMARY:
"Total Tests:",4,100.0%
Succeeded:,3,75.0%
Failed:,1,25.0%
Regressions:,1,25.0%
"JS Failed:",1,25.0%
```

### JSON

JSON output is produced as a single line. We've dumped it here by passing it through
Node's `console.log` to make it more readable.

```javascript
{ TestOne:
   { id: 'TestOne',
     cat: 'testdata',
     label: 'Some even numbers',
     desc: 'This is a bunch of even numbers.',
     success: false,
     hash: '7dd9d0507fa51a36dd01ccca9b767a44',
     size: 27,
     jsSuccess: true,
     regression: false },
  TestTwo:
   { id: 'TestTwo',
     cat: 'testdata',
     label: 'Some odd numbers',
     desc:
      'This is a bunch of odd numbers.',
     success: true,
     hash: '3a3643bc0e3783a8478f5f0febfd5fde',
     size: 29,
     jsSuccess: true,
     regression: true },
  TestThree:
   { id: 'TestThree',
     cat: 'testdata',
     label: 'Some negative numbers',
     desc: 'This is a bunch of negative numbers.',
     success: true,
     hash: '8aac0526c764d1d27d4ea51c74e5e783',
     size: 120,
     jsSuccess: false,
     regression: false },
  TestFour:
   { id: 'TestFour',
     cat: 'testdata',
     label: 'A 100% successful test',
     desc: 'This is to test total success.',
     success: true,
     hash: '9f62cbf5dad6e929a72071a409aec202',
     size: 30,
     jsSuccess: true } }
```

## Regression Tests

Regression tests are fundamentally simple. Your tests produce enough output to 
thoroughly exercise the code under test, and when you have a successful test, 
you use Experior to output a summary as a JSON file and save it for future use.

The JSON test summary contains an MD5 hash of the test output, so when you 
re-run your tests to produce a new input file, you can use the `-r` or 
`--regression` switch to reload your old test summary. Experior will then 
compare the old MD5 hashes to the new ones and flag tests with regressions in 
the reports.

## JavaScript Tests

Experior expects you to write your own tests however you want. You could be 
writing a C++ program to exercise a library written in C. You could be using a 
scripting language with one of those 
`stupid(frameworks).with(pseudoEnglish).chained(syntax)`. Like the honey badger, 
Experior don't care. You do your tests, write the output to a file, and you can 
write a bunch of tests in high-level JavaScript to sift through output from an 
assembly language program as easily as output from another JavaScript program.

To do this, you write your tests as functions that reside as keys in an object 
exported by a Node.js module. Once referenced on the commandline with the 
`--jstest` switch, Experior will require your module and apply the tests where 
directed by the optional `jsTest` attribute in the beginning-of-test header,
which contains either a single function name or an array of function names.

The functions all take the same arguments:

```javascript
function(cat, testId, data)
```

...where `cat` is the category name from the `cat` attribute in the header, 
`testId` is from the `id` attribute, and `data` contains all of the lines from 
the actual test data packed together as a string with embedded newlines. The 
function does whatever it's going to do and then returns `true` on success or 
`false` on failure.

The module file might look like this:

```javascript
var tests = {
	foo: function(cat, testId, data) { /* mumble mumble */ },
	bar: function(cat, testId, data) { /* mumble mumble */ },
	baz: function(cat, testId, data) { /* mumble mumble */ },
}

module.exports = tests;
```

Given the above, you can fire off a single test in the header like this:

```javascript
...,"jsTest":"foo" }
```

Or you can fire off several by supplying an array:

```javascript
...,"jsTest":["foo","bar","baz"] }
```

Failed JavaScript tests are reported separately from both regressions and
the test results stored in the `success` element in the header.

## Tutorial and Examples

If you clone the [source repository](https://github.com/Waidthaler/experior), 
you'll find the tutorial files we'll be discussing in the `/examples` 
subdirectory. We'll start with a test program, cleverly named `test_program.js`, 
and the equally obscure jstests.js, which contains our JavaScript tests. There 
is also our test subject, a deliberately buggy partial reimplementation of the 
native Array type, which you'll find in `CrappyArray.js`. From these 
inauspicious beginnings, we will generate several other files, including test 
data, reports, and regression tests.

It will help if you go ahead and install Experior.

```bash
$ npm install experior --global
```

First, let's take a look at CrappyArray.js:

```javascript
//==============================================================================
// To have something to test, we're going to use this buggy, incomplete,
// and awkward wrapper around a native JavaScript array, the CrappyArray.
//==============================================================================

class CrappyArray {

    constructor(...vals) {
        if(vals.length == 1 && typeof vals[0] == "number") {
            this._contents = new Array(vals[0]);
        } else {
            this._contents = vals;
        }
        this._length = this._contents.length;
    }

    //--------------------------------------------------------------------------
    // This is our crude replacement for the [] operator.
    //--------------------------------------------------------------------------

    element(offset, val) {
        if(val == undefined) {
            return this._contents[offset];
        } else {
            this._contents[offset] = val;
            return val;
        }
    }

    //--------------------------------------------------------------------------
    // Length reimplementation. The getter works fine, but the setter
    // erroneously changes this._length without adjusting this._contents.
    //--------------------------------------------------------------------------

    get length() {
        return this._contents.length;
    }

    set length(val) {        // BUG: We fail to set this._contents.length
        this._length = val;
    }

    //--------------------------------------------------------------------------
    // Reimplementations of push, pop, shift, and unshift. The shift and
    // unshift methods are swapped, i.e., shift unshifts and unshift shifts.
    //--------------------------------------------------------------------------

    push(val) {
        this._contents.push(val);
        this._length++
    }

    pop() {
        this._length++;               // BUG: should be this._length--
        return this._contents.pop();
    }

    shift(val) {                     // BUG: should be unshift
        this._length++;
        this._contents.unshift(val);
    }

    unshift() {                      // BUG: should be shift
        this._length--;
        return this._contents.shift();
    }

    //--------------------------------------------------------------------------
    // A couple of additional methods: reverse and join. The join clone works
    // fine unless no separator is supplied, and reverse screws up if
    // this._length is inaccurate due to calls to our buggy pop method.
    //--------------------------------------------------------------------------

    reverse() {
        var tmp;
        for(var i = 0; i < this._length / 2; i++) {
            tmp = this._contents[i];
            this._contents[i] = this._contents[this._length - 1 - i];
            this._contents[this._length - 1 - i] = tmp;
        }
    }

    join(separator = null) {
        return this._contents.join(separator);
    }
}

module.exports = CrappyArray;
```

... TODO ...

## Status

Experior is currently in beta as of 3/13/2019. In a week or so, when I'm done 
testing it to my satisfaction, it will be bumped up to 1.0.0 and published to 
the NPMjs repository.
