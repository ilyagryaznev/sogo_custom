#!/bin/bash
# Скрипт для настройки окружения сборки SOGo

# Настройка путей GNUstep
export GNUSTEP_MAKEFILES=/opt/homebrew/Cellar/gnustep-make/2.9.3/Library/GNUstep/Makefiles
export PATH="/opt/homebrew/Cellar/gnustep-make/2.9.3/libexec:$PATH"
export PATH="/opt/homebrew/Cellar/gnustep-base/1.31.1_3/bin:$PATH"

# Загрузка GNUstep окружения
if [ -f "$GNUSTEP_MAKEFILES/GNUstep.sh" ]; then
    source "$GNUSTEP_MAKEFILES/GNUstep.sh"
    echo "✓ GNUstep окружение загружено"
    echo "  GNUSTEP_MAKEFILES: $GNUSTEP_MAKEFILES"
else
    echo "✗ Ошибка: GNUstep.sh не найден в $GNUSTEP_MAKEFILES"
    exit 1
fi

# Проверка наличия gnustep-config
if command -v gnustep-config &> /dev/null; then
    echo "✓ gnustep-config найден"
    gnustep-config --variable=GNUSTEP_MAKEFILES
else
    echo "✗ Ошибка: gnustep-config не найден в PATH"
    exit 1
fi

echo ""
echo "Окружение готово для сборки SOGo"
echo "Используйте: source setup-build-env.sh"

