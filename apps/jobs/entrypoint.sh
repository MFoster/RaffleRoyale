#!/bin/sh
set -eu

exec node apps/jobs/dist/index.js "$@"
