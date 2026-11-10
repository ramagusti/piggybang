FROM php:8.4-cli-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends git unzip libpq-dev libzip-dev libicu-dev tesseract-ocr tesseract-ocr-ind \
    && docker-php-ext-install pdo_pgsql intl zip bcmath pcntl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist
COPY . .
RUN composer dump-autoload --optimize && php artisan storage:link || true
EXPOSE 8000
# Same image runs web / worker / scheduler (override CMD in compose / Coolify).
CMD ["sh", "-c", "php artisan migrate --force && php artisan config:cache && php artisan route:cache && php artisan serve --host=0.0.0.0 --port=8000"]
