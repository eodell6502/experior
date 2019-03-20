#!/usr/bin/sh

cd ..
tar --exclude='.*' --exclude='node_modules' -czvf experior.tgz experior
cd experior
