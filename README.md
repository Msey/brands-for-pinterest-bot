# Локальный бот для ссылок kupim_v_usa

Бот [@brands_for_pinterest_bot](https://t.me/brands_for_pinterest_bot) работает на вашем ПК.
В личке принимает ссылки на посты `t.me/kupim_v_usa` и дописывает их в файл `data/posts.jsonl`.

Нужен [Node.js](https://nodejs.org/) 16 или новее (на этом компьютере он уже есть).

## Установка

В PowerShell:

```powershell
cd telegram-kupim-bot
npm install
copy .env.example .env
```

Откройте `.env` и впишите токен от [@BotFather](https://t.me/BotFather):

```
BOT_TOKEN=ваш_токен
```

Токен нельзя коммитить и нельзя никому пересылать. Если он засветился — в BotFather команда `/revoke`, затем новый токен в `.env`.

По желанию ограничьте, кто может писать боту, в `.env`:

```
BOT_ALLOW_USER_IDS=123456789
```

## Запуск

Двойной щелчок по `start.vbs` или по ярлыку **«Бот kupim_v_usa»** на рабочем столе — бот уходит в трей (рядом с часами).

Ярлык создаётся сам при запуске. Можно создать вручную:

```powershell
cd telegram-kupim-bot
powershell -ExecutionPolicy Bypass -File .\install-desktop-shortcut.ps1
```

- **Повторный запуск ярлыка** — разворачивает уже работающее окно, без второго процесса
- **Двойной щелчок по иконке** — открывает окно с последними 20 записями из JSON
- **Всплывающее окно над треем** (15 секунд, когда пришла новая ссылка) — не Windows-уведомление; клик открывает папку с `data/posts.jsonl`
- **Крестик окна** — сворачивает бота, он продолжает работать
- **Выход** в меню иконки — единственный способ полностью закрыть приложение
- В диспетчере задач ищите **«Бот kupim_v_usa»** (процесс PowerShell) и дочерний **Node.js**

Правый клик по иконке в трее:

- **Открыть окно**
- **Папка с данными** — `data/posts.jsonl`
- **Перезапустить**
- **Выход** — остановить бота

Из PowerShell то же самое:

```powershell
cd telegram-kupim-bot
wscript .\start.vbs
```

Команды:

- `/start` — как пользоваться
- `/list` — последние 10 ваших ссылок
- `/count` — сколько вы уже сохранили

Проверка разбора ссылок и хранилища: `npm test`.

## Папка для Pinterest

Когда в личку бота приходит ссылка на пост, в `pin-templates/{id поста}/` сразу появляются `data.json` и `image.jpg` для расширения
[Pinterest Pin Filler](https://github.com/Msey/chrome-extension-pinterest-pin-filler).

Вручную то же самое:

```powershell
cd telegram-kupim-bot
node export-pin.js https://t.me/kupim_v_usa/47039
node export-pin.js --from-jsonl
```

На сайте `ru.pinterest.com/pin-creation-tool/` откройте боковую панель расширения и выберите папку, например `pin-templates/47039`.

## Где лежат данные

Каждая строка в `data/posts.jsonl` — одна ссылка:

```json
{"url":"https://t.me/kupim_v_usa/123","post_id":123,"saved_at":"...","from_user_id":111,"from_username":"name"}
```

Файл можно открыть блокнотом. ПК выключили — бот молчит, файл остаётся.
