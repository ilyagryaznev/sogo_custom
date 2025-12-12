# Dockerfile для сборки и запуска SOGo
FROM debian:bookworm-slim

# Добавление репозитория SOGo (если нужны готовые пакеты)
# RUN echo "deb https://packages.sogo.nu/release/5/debian/ bookworm bookworm" > /etc/apt/sources.list.d/sogo.list

# Добавление репозитория SOGo для готовых пакетов SOPE (опционально)
# RUN echo "deb https://packages.sogo.nu/release/5/debian/ bookworm bookworm" > /etc/apt/sources.list.d/sogo.list

# Установка базовых зависимостей
RUN apt-get update && apt-get install -y \
    build-essential \
    wget \
    git \
    curl \
    gnustep-make \
    gobjc \
    libgnustep-base-dev \
    libmemcached-dev \
    libxml2-dev \
    libssl-dev \
    libcurl4-openssl-dev \
    libwbxml2-dev \
    liblasso3-dev \
    libytnef0-dev \
    libzip-dev \
    libsodium-dev \
    memcached \
    apache2 \
    apache2-dev \
    postgresql-client \
    nodejs \
    npm \
    binutils \
    file \
    && rm -rf /var/lib/apt/lists/*

# Настройка рабочей директории
WORKDIR /opt

# Копирование исходного кода из контекста
COPY sogo_custom /opt/sogo
COPY sope /opt/sope

# Настройка окружения GNUstep
ENV GNUSTEP_MAKEFILES=/usr/share/GNUstep/Makefiles
ENV PATH="/usr/bin:/usr/local/bin:$PATH"

# Сборка SOPE (последовательная сборка для избежания проблем с линковкой)
WORKDIR /opt/sope
RUN if [ -f "configure" ]; then \
        . $GNUSTEP_MAKEFILES/GNUstep.sh && \
        rm -rf obj .gsmake config.make config-NGStreams.log config-gstepmake.log && \
        ./configure --enable-debug && \
        make clean || true && \
        make && \
        make install; \
    else \
        echo "SOPE не найден, пропускаем сборку"; \
    fi

# Сборка SOGo (без параллельной сборки для избежания проблем)
WORKDIR /opt/sogo
RUN if [ -f "configure" ]; then \
        . $GNUSTEP_MAKEFILES/GNUstep.sh && \
        rm -rf obj .gsmake config.make && \
        ./configure --enable-debug && \
        make clean || true && \
        make && \
        make install; \
    else \
        echo "SOGo не найден, пропускаем сборку"; \
    fi

# Сборка веб-клиента
WORKDIR /opt/sogo/UI/WebServerResources
RUN if [ -f "package.json" ]; then \
        npm install && \
        npx grunt build; \
    else \
        echo "Веб-клиент не найден, пропускаем сборку"; \
    fi

# Создание директорий для конфигурации
RUN mkdir -p /etc/sogo /var/lib/sogo /var/log/sogo

# Копирование конфигурационных файлов
COPY sogo.conf /etc/sogo/sogo.conf
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Настройка Apache
RUN a2enmod rewrite proxy proxy_http headers
COPY sogo-apache.conf /etc/apache2/sites-available/sogo.conf
RUN a2ensite sogo && a2dissite 000-default

# Открытие портов
EXPOSE 80 443

# Точка входа
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2ctl", "-D", "FOREGROUND"]

