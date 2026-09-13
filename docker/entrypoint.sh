#!/bin/sh
set -eu
cd /var/www/html
mkdir -p storage/app/private/backups storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
chown -R www-data:www-data storage bootstrap/cache
if [ "$1" = "php-fpm" ]; then
    php artisan migrate --force
    php artisan config:cache
    php artisan view:cache
fi
exec "$@"
