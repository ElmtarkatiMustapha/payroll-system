FROM node:22-alpine AS frontend
WORKDIR /build
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY vite.config.js ./
COPY resources ./resources
COPY public ./public
RUN npm run build

FROM php:8.4-fpm-bookworm AS php-base
RUN apt-get update && apt-get install -y --no-install-recommends \
    libicu-dev libzip-dev libsqlite3-dev unzip \
    && docker-php-ext-install -j$(nproc) pdo_mysql pdo_sqlite bcmath intl zip opcache \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html

FROM php-base AS application
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --prefer-dist --no-interaction --no-progress
COPY . .
COPY --from=frontend /build/public/build ./public/build
RUN composer dump-autoload --optimize --no-dev \
    && mkdir -p storage/app/private/backups storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs \
    && chown -R www-data:www-data storage bootstrap/cache
COPY docker/php.ini /usr/local/etc/php/conf.d/payroll.ini
COPY docker/entrypoint.sh /usr/local/bin/payroll-entrypoint
RUN chmod +x /usr/local/bin/payroll-entrypoint
ENTRYPOINT ["payroll-entrypoint"]
CMD ["php-fpm"]

FROM nginx:1.28-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=application /var/www/html/public /var/www/html/public
