#!/bin/sh
set -e
node src/seed.js
exec node src/server.js
