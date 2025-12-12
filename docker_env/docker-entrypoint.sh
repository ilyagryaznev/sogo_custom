#!/bin/bash
set -e

# Ожидание готовности PostgreSQL
echo "Ожидание PostgreSQL..."
until PGPASSWORD=${SOGO_DB_PASSWORD:-sogo} psql -h "${SOGO_DB_HOST:-postgres}" -U "${SOGO_DB_USER:-sogo}" -d "${SOGO_DB_NAME:-sogo}" -c '\q' 2>/dev/null; do
  >&2 echo "PostgreSQL недоступен - ожидание..."
  sleep 1
done
echo "PostgreSQL готов!"

# Инициализация базы данных SOGo (если нужно)
if [ ! -f /var/lib/sogo/.db_initialized ]; then
  echo "Инициализация базы данных SOGo..."
  # Здесь можно добавить команды инициализации БД
  touch /var/lib/sogo/.db_initialized
fi

# Запуск SOGo сервера в фоне (если команда не указана)
if [ "$1" = "apache2ctl" ] || [ "$1" = "apache2" ]; then
    # Запуск SOGo в фоне
    if [ -x "/usr/local/sbin/sogod" ]; then
        # Создаем директорию для логов если не существует
        mkdir -p /var/log/sogo
        # Обновляем пути к библиотекам для SOGo
        export LD_LIBRARY_PATH="/usr/local/lib:/usr/local/lib/sogo:/usr/local/lib/GNUstep/Frameworks/SOGo.framework/Versions/5/sogo:${LD_LIBRARY_PATH}"
        # Добавляем явные ссылки, чтобы динамический линковщик находил libSOGo
        ln -sf /usr/local/lib/sogo/libSOGo.so.5 /usr/lib/libSOGo.so.5 || true
        ln -sf /usr/local/lib/sogo/libSOGo.so.5 /usr/local/lib/libSOGo.so.5 || true
        # Запуск SOGo сервера с правильными параметрами
        /usr/local/sbin/sogod -WOWorkersCount 3 -WOPort 0.0.0.0:20000 -WOLogFile /var/log/sogo/sogo.log -WONoDetach YES &
        SOGO_PID=$!
        echo "SOGo сервер запущен (PID: $SOGO_PID) на порту 0.0.0.0:20000"
        # Ждем немного, чтобы сервер успел запуститься
        sleep 2
        # Проверяем, что процесс запущен
        if ps -p $SOGO_PID > /dev/null 2>&1; then
            echo "SOGo сервер успешно запущен"
        else
            echo "Ошибка: SOGo сервер не запустился"
        fi
    else
        echo "Предупреждение: sogod не найден в /usr/local/sbin/sogod"
    fi
fi

# Выполнение переданных команд
exec "$@"

