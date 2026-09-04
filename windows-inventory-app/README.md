# Inventory Manager (Складов мениджър)

Windows desktop приложение за управление на складови наличности, приемане на
стоки по фактури и месечни/годишни справки. React + TypeScript + Electron +
SQLite (better-sqlite3). Работи изцяло офлайн — всички данни се пазят
локално в SQLite база данни в потребителската `%APPDATA%` директория.

## Технологии

- **Electron** — desktop shell (contextIsolation, sandboxed preload, no nodeIntegration in the renderer)
- **React 18 + TypeScript + Vite** — renderer UI
- **better-sqlite3** — синхронна, транзакционна локална база данни
- **pdfkit** — генериране на реални PDF отчети (Кирилица чрез вграден DejaVu Sans шрифт)
- **electron-builder** — Windows installer (NSIS) + portable `.exe`
- **Vitest** — тестове на бизнес логиката (наличности, фактури, backup/restore, PDF)

## Разработка

```bash
npm install
npm run dev          # Vite dev server + Electron, hot reload
npm test             # Vitest business-logic suite
npm run typecheck    # tsc за main + renderer
```

## Production build

```bash
npm run build        # renderer (vite) + main (tsc) + preload (esbuild bundle)
npm run pack         # unpacked app в release/win-unpacked (без installer)
npm run dist:win     # пълен Windows installer + portable exe в release/
```

`dist:win` изисква Windows target инструменти (electron-builder ги
изтегля автоматично) — за cross-build от Linux е нужен `wine` (за NSIS +
задаване на version-info/икона на `.exe`-то). На Windows или macOS host
не е нужен wine.

Изходни файлове в `release/`:
- `InventoryManagerSetup.exe` — стандартен Windows installer (NSIS)
- `InventoryManagerPortable.exe` — portable вариант, не изисква инсталация

## Архитектура

```
src/
  main/            # Electron main process (Node context)
    db/            # SQLite connection + миграции (001_init.sql)
    services/      # Цялата бизнес логика (products, invoices, stock, pdf, backup…)
    ipc/           # ipcMain handlers — единствената врата към renderer-а
    preload.ts     # contextBridge API (бъндлва се отделно с esbuild — виж бележката в файла)
    index.ts       # bootstrap, прозорец, scheduled backups
  renderer/        # React UI (няма достъп до Node/fs — само през window.api)
  shared/          # Типове + IPC имена, споделени между двата процеса
test/              # Vitest — реални SQLite/PDF/backup тестове, без mock-ове
```

### Наличности — бизнес логика (§35 от спецификацията)

Наличността на всеки продукт **никога** не се пази като едно мутируемо
число. Всяко получаване по фактура и всяко изписване създава ред в
`stock_movements` (ledger). Наличността във всеки момент/период се
изчислява чрез сума от тези движения. Това означава, че редакция или
изтриване на стар запис автоматично прекалкулира всички по-късни
периоди коректно — без нужда от ръчна корекция.

### Сигурност (Electron)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Renderer-ът няма никакъв директен достъп до файловата система/базата —
  само през типизирания `window.api`, изложен от `preload.ts`.
- Всеки IPC handler валидира входа си в съответния service (Zod-стил
  ръчна валидация с ясни съобщения на български).
- PDF/backup пътищата се избират от потребителя през нативни Electron
  диалози (`showSaveDialog`/`showOpenDialog`) — рендерерът никога не
  получава суров достъп до произволни пътища.

## Данни и backup

- База данни: `%APPDATA%\Inventory Manager\inventory.db`
- Backups: `%APPDATA%\Inventory Manager\Backups\backup_<вид>_<дата>_<случаен>.db`
- Автоматичен backup на всеки N дни (по подразбиране 3, настройва се в
  „Настройки“), плюс ръчен бутон „Направи backup сега“.
- Възстановяване от backup винаги прави предпазен `pre_restore` backup на
  текущата база, преди да презапише каквото и да било.
