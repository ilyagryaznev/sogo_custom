# SOGo Docker Setup

Инструкции по сборке и запуску SOGo в Docker контейнере.

#####NOTICE################
В текущей версии sogo НЕ ЗАПУСКАЕТСЯ в докере - ошибка обнаружения зависимостей, не находит какую-то библиотеку. 
Файлы из этой папки (docker_env) не являются частью пакета sogo, эту папку нужно вытащить уровнем выше, а в нее положить сам клиент sogo в папку sogo_custom. Ну или переписать пути). 

## Требования

- Docker (версия 20.10+)
- Docker Compose (версия 2.0+)

## Структура проекта

```
.
├── Dockerfile              # Docker образ для SOGo
├── docker-compose.yml      # Конфигурация для запуска всех сервисов
├── docker-entrypoint.sh    # Скрипт инициализации контейнера
├── sogo.conf              # Конфигурация SOGo
├── sogo-apache.conf       # Конфигурация Apache
├── sogo_custom/           # Исходный код SOGo
└── sope/                   # Исходный код SOPE
```

## Быстрый старт

### 1. Сборка образа

```bash
docker-compose build
```

Это может занять 30-60 минут, так как нужно:
- Установить все зависимости
- Собрать SOPE из исходников
- Собрать SOGo из исходников
- Собрать веб-клиент

### 2. Запуск всех сервисов

```bash
docker-compose up -d
```

Это запустит:
- PostgreSQL (порт 5432)
- Memcached (порт 11211)
- SOGo сервер (порт 8080)

### 3. Доступ к SOGo

Откройте браузер и перейдите по адресу:
```
http://localhost:8080/SOGo
```

## Управление контейнерами

### Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Только SOGo
docker-compose logs -f sogo

# Только PostgreSQL
docker-compose logs -f postgres
```

### Остановка сервисов

```bash
docker-compose stop
```

### Остановка и удаление контейнеров

```bash
docker-compose down
```

### Пересборка после изменений

```bash
docker-compose build --no-cache
docker-compose up -d
```

## Конфигурация

### SOGo конфигурация

Основной файл конфигурации: `sogo.conf`

Основные параметры:
- `SOGoProfileURL` - URL базы данных профилей пользователей
- `SOGoIMAPServer` - Адрес IMAP сервера
- `SOGoSMTPServer` - Адрес SMTP сервера
- `SOGoMemcachedHost` - Адрес Memcached сервера

### База данных

По умолчанию используется PostgreSQL с настройками:
- База данных: `sogo`
- Пользователь: `sogo`
- Пароль: `sogo`
- Хост: `postgres` (внутри Docker сети)

### Инициализация базы данных

При первом запуске SOGo автоматически создаст необходимые таблицы в базе данных.

## Разработка

### Пересборка после изменений кода

```bash
# Остановить контейнеры
docker-compose down

# Пересобрать образ
docker-compose build --no-cache sogo

# Запустить снова
docker-compose up -d
```

### Доступ к контейнеру

```bash
docker-compose exec sogo bash
```

### Просмотр файлов SOGo

```bash
docker-compose exec sogo ls -la /usr/lib/GNUstep/SOGo/
```

## Решение проблем

### Проблемы с базой данных

Если PostgreSQL не запускается:
```bash
docker-compose logs postgres
docker-compose restart postgres
```

### Проблемы с компиляцией

Если сборка падает с ошибками:
1. Проверьте логи сборки: `docker-compose build 2>&1 | tee build.log`
2. Убедитесь, что все зависимости установлены
3. Попробуйте собрать без кэша: `docker-compose build --no-cache`

### Проблемы с портами

Если порты заняты, измените их в `docker-compose.yml`:
```yaml
ports:
  - "8081:80"  # Вместо 8080
```

## Дополнительная информация

- [Официальная документация SOGo](https://sogo.nu/documentation.html)
- [SOGo GitHub](https://github.com/Alinto/sogo)
- [SOPE GitHub](https://github.com/Alinto/sope)

