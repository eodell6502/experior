#!/usr/bin/sh

# NOTE: This script assumes that Experior is installed globally. You'll have to
# make adjustments otherwise.

experior -i test_output.txt -r regression_data.json -R -j jstests.js -l -o ansi test_report.txt test_report.csv test_report.html test_report.json
