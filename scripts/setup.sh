#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env
for key in APP_KEY DB_PASSWORD MYSQL_ROOT_PASSWORD; do
    if ! grep -q "^$key=." .env; then
        value=$(openssl rand -base64 32)
        [ "$key" != APP_KEY ] || value="base64:$value"
        if grep -q "^$key=" .env; then
            sed -i.bak "/^$key=/d" .env
            rm -f .env.bak
        fi
        printf '\n%s=%s\n' "$key" "$value" >> .env
    fi
done
docker compose up -d --build
printf '\nPayroll is ready at http://localhost:8080. Create your administrator account on first visit.\n'
