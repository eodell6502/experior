#!/usr/bin/sh

cd ..
tar --exclude='.*' --exclude='node_modules' --exclude='logs/*' --exclude='package-lock.json' -czvf experior.tgz experior
cd experior
