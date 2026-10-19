# Day Threads — Find Your Way Back After Interruptions

**The message is answered. The call is over. What were you doing?**

[简体中文](README.md)

You're halfway through a proposal when a colleague messages you. After replying, you handle another urgent request. When you return, you have to remember what you were doing and what you planned to do next.

Day Threads keeps those tasks in view. Pause when you switch away, resume when you return, and keep the earlier work sessions. Unfinished work can carry over to tomorrow.

It is a local-first task manager with resumable time tracking, daily carry-over, and a separate **Weekly Gantt** chart. No account, build step, or backend is required. The app is an HTML file; your actual data lives in a folder you select.

![Today: active, queued, and completed work with multiple work sessions](docs/images/today.png)

## Leave yourself a cue before switching tasks

Before switching away from a proposal review, double-click the task text and write something like “Review proposal: budget checked; next verify delivery dates,” then pause it.

When you return, that cue tells you what to do next. Resume the same task and its earlier work sessions remain. You write the progress cue yourself; the app saves your task text and work sessions, without capturing document contents or cursor positions.

It is intended for personal use with little setup and data you control. The two views store their own records; tasks are not automatically linked between them.

## Features

- **Daily work threads:** active, queued, and completed areas; drag to change status, pause and resume, and see multiple work sessions. Concurrent timers are enabled by default and can be disabled.
- **Carry work forward:** by default, unfinished past items move to today with their timers paused. Daily and cumulative effort are shown separately; automatic carry-over can be disabled.
- **History and reports:** browse past days in a read-only calendar view and copy a daily report of completed and unfinished items.
- **Weekly Gantt:** separate monthly pages, click or paint occupied weeks, add week-wide notes and project notes, reorder projects, mark them complete, or carry them to next month.
- **Working-day display:** choose regular working weekdays, the first day of the week, and individual date overrides. Chinese public holidays and makeup working weekends for 2025 and 2026 are enabled by default; schedules do not update automatically.
- **Local data file:** Chrome and Edge can connect to the same `看板数据.json` file. The app checks for changes when you return and before saving; detected conflicts ask you to choose a version and download the other as a backup.
- **Themes:** choose system, light, or dark directly in the header or in Settings.

![Weekly Gantt: occupied weeks, project notes, and completed projects](docs/images/gantt.png)

## Try the demo

Download and extract the repository, then open [demo.html](demo.html) in desktop Chrome or Edge. The demo can also be served as a static page.

All demo records are fictional. They demonstrate interrupted work, carried items, lunch-break timing, mixed task states, holidays, makeup working days, and monthly project planning.

The demo clock starts at **October 19, 2026, 14:35** and keeps moving. Refreshing or using the demo reset button restores its initial tasks and settings. The demo does not connect to, read, or write your actual data file. Its storage is separate from the main app. Use it to explore, not to keep real work records.

## Use it with your own data

1. Download and extract the repository into a folder you intend to keep.
2. Open [index.html](index.html) in desktop Chrome or Edge.
3. Click the button to select the board's folder, select the folder containing `index.html`, and allow read/write access.
4. The app creates or reads `看板数据.json` in that folder. Once the saved status appears, you can use the board.

To switch browsers, open the same `index.html` and select the same folder. The browser may ask you to authorize access again. When connecting old browser-only records for the first time, the app offers migration or downloads a backup of the unused records.

The main app requires browser support for local folder access. Unsupported browsers show a notice. The demo does not require folder access.

## Adjust the defaults

Open Settings to adjust the following. Defaults preserve the original workflow.

| Setting | Default and behavior |
|---|---|
| Daily break | Subtract 12:00–13:00; disable it or choose one same-day interval. The start must precede the end; overnight breaks are not supported. |
| Regular working weekdays and week start | Monday–Friday for the Gantt header. Weeks start Monday by default in both the Gantt and history calendar. |
| Chinese holidays and makeup days | Use the built-in 2025 and 2026 calendar; can be disabled. Unknown years use your regular weekdays and show a notice. |
| Date overrides | Set individual dates as working or non-working; overrides holidays and regular weekdays. |
| Carry unfinished items forward | Enabled; carried items remain paused until resumed. |
| Concurrent timers | Enabled; optionally allow only one running item. |
| Enter in the capture field | Start and time an item; optionally add it to the queue instead. |
| Initial view | Today; optionally open the Weekly Gantt first. |
| Animation preference | Follow the system by default; page animations can be adjusted. |

Dates are resolved in this order: **individual override → built-in holiday/makeup calendar when enabled → regular working weekdays**. These settings affect Gantt headers; they do not stop timers outside office hours, on weekends, or on holidays.

Changing the break affects subsequent timing sessions. Running items are split at the same instant and continue under the new rule; earlier sessions retain their previous rule. Legacy sessions without a saved break rule keep the original 12:00–13:00 break, so changing settings does not rewrite historical effort.

The theme belongs to the current browser. Other settings are saved with the board data and its full backup. Demo settings exist only in the current page and reset on refresh. Read-only history, folder access, and conflict/backup protections remain in place; Settings does not expose every internal parameter.

## Data and limitations

### Backups and imports

- **Full backup:** wait until the app shows that the data is saved, then copy `看板数据.json` to your own backup location. It contains both views and the board settings.
- **Export button:** exports all daily-thread history only. It **does not include the Gantt data**.
- **Import:** a full board backup replaces both views; a daily-thread backup replaces daily threads; a legacy Gantt backup replaces the Gantt data. Keep a copy of your current file first. Imports replace records rather than merge them.
- **Conflicts:** choose the file's version or overwrite it with the current page's version. The unused version is downloaded as a backup; check that the download completed.

The browser also keeps a cache. Use the data file for long-term storage and migration. Do not commit personal data files, exports, backups, or screenshots containing real work information to a public repository.

### Shared files and timers

A shared file helps you switch browsers and can be used in an existing shared-folder environment. There are no accounts, access controls, real-time merging, or concurrent-write guarantees. People editing the same file at once can still overwrite each other's changes; avoid simultaneous editing.

Timers follow the clock and subtract the daily break saved with each timing session; the default is **12:00–13:00**. They do not stop at office hours, weekends, or public holidays. When concurrent timers are enabled, tasks accumulate independently, so total effort can exceed elapsed time. Use it for personal review, not attendance or an exact measure of focused time.

You can undo completion or restore a completed project. There is no general undo for deletion or painted schedule changes, and day history is not version rollback. Carrying a project to next month copies its name and color, leaving its weekly schedule empty.

## Development and contributions

Using the app requires no build, Python, or Node.js. The interface uses system fonts and has no third-party JavaScript runtime dependencies.

For development, edit this package's `index.html` as the main application source. To change the fictional demo scenario, edit `scripts/build_demo.py`. Do not edit the generated `demo.html`, `demo-data.json`, or `favicon.svg` separately; regeneration overwrites them.

From the repository root, use Python 3.10 or later to regenerate the demo and check that generated files are current:

```sh
python scripts/build_demo.py
python scripts/build_demo.py --check
```

The script reads this package's `index.html` by default; the original author's working directory is not required. With Node.js 18 or later, run the logic regression tests without installing dependencies:

```sh
node tests/settings.test.cjs
```

Also open both pages in a browser to check actual interactions. Logic tests do not replace UI and file-saving checks.

See [CONTRIBUTING.md](CONTRIBUTING.md). Chinese guides include a [demo script](docs/演示脚本.md) and [release copy drafts](docs/发布文案.md).

## License

This project is licensed under the [MIT License](LICENSE). Copyright © 2026 Day Threads contributors.
