#!/bin/sh
node src/seed.js || echo "[entrypoint] seed warning — démarrage quand même"
exec node src/server.js
