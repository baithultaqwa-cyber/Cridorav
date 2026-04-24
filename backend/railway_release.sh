#!/usr/bin/env sh
# Run as Railway "Custom Release Command" so the DB schema matches deployed code.
set -e
cd "$(dirname "$0")"
python manage.py migrate --noinput
