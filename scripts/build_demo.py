"""Build the public board and a self-contained fictional demonstration.

Only the explicitly named source HTML is read. Real JSON, fonts, backups,
history files and Git metadata are never read or copied by this script.
Run with Python 3.10+; no third-party dependency is required.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path


OUT = Path(__file__).resolve().parents[1]
SOURCE = OUT / "index.html"
TZ = timezone(timedelta(hours=8))
DAY = "2026-10-19"
YESTERDAY = "2026-10-18"
KEYS = {
    "week-gantt-board-v1": "open-project-board-gantt-v1",
    "week-gantt-theme": "open-project-board-theme-v1",
    "day-thread-v1": "open-project-board-thread-v1",
    "board-file-linked-v1": "open-project-board-file-linked-v1",
    'indexedDB.open("kanban-fs", 1)': 'indexedDB.open("open-project-board-fs-v1", 1)',
    'id:"kanban-data"': 'id:"open-project-board-data"',
}


def stamp(day: str, hm: str) -> int:
    return int(datetime.fromisoformat(f"{day}T{hm}:00").replace(tzinfo=TZ).timestamp() * 1000)


def segment(start: str, end: str | None, day: str = DAY) -> dict:
    return {"s": stamp(day, start), "e": stamp(day, end) if end else None}


def item(
    ident: str, text: str, zone: str, order: int, *, at: str = "09:00",
    segs: list[dict] | None = None, running: bool = False,
    done_at: str | None = None, day: str = DAY, **extra,
) -> dict:
    return {
        "id": ident, "text": text, "at": stamp(day, at), "segs": segs or [],
        "running": running, "done": zone == "done",
        "doneAt": stamp(day, done_at) if done_at else None,
        "carried": False, "from": day, "zone": zone, "ord": order, **extra,
    }


def project(ident: str, name: str, color: str, notes: dict[str, str], **extra) -> dict:
    return {"id": ident, "name": name, "color": color,
            "weeks": {key: {"note": note} for key, note in notes.items()}, **extra}


def mock_data() -> dict:
    """All business text below is authored fiction, independent of real data."""
    carried = [segment("15:10", "16:00", YESTERDAY)]
    today_items = [
        item("demo-lamp-review", "萤火｜主图复核：被打断后接着做", "doing", 0,
             at="09:05", segs=[segment("09:05", "09:45"), segment("10:20", "10:55"),
                               segment("14:10", None)], running=True),
        item("demo-box-sample", "海盐｜确认样品数量（并行跟进）", "doing", 1,
             at="14:20", segs=[segment("14:20", None)], running=True),
        item("demo-fan-carry", "微风｜复测样机噪声，等样机到位", "doing", 2,
             at="00:00", segs=carried, carried=True, origAt=stamp(YESTERDAY, "15:10"),
             **{"from": YESTERDAY}),
        item("demo-paper-pause", "纸舟｜包装打样核对，等反馈", "doing", 3,
             at="10:55", segs=[segment("10:55", "11:20")]),
        item("demo-research-back", "拾光｜竞品尺寸整理，先放回待做", "todo", 0,
             at="09:45", segs=[segment("09:45", "10:05")]),
        item("demo-cloud-new", "云朵｜补充说明书警示语", "todo", 1, at="13:50"),
        item("demo-lunch-done", "萤火｜确认灯罩色样（11:40–13:20）", "done", 0,
             at="11:40", segs=[segment("11:40", "13:20")], done_at="13:20"),
        item("demo-window-done", "晴窗｜交付首版产品图", "done", 1,
             at="09:10", segs=[segment("09:10", "09:35")], done_at="13:25"),
        item("demo-no-timer", "云朵｜发送样品签收通知（未计时）", "done", 2,
             at="13:30", done_at="13:35"),
    ]
    yesterday_items = [
        item("demo-yesterday-carry", "微风｜复测样机噪声，等样机到位", "doing", 0,
             at="15:10", segs=carried, day=YESTERDAY, movedTo=DAY),
        item("demo-yesterday-done-1", "海盐｜整理收纳尺寸对照表", "done", 0,
             at="09:20", segs=[segment("09:20", "10:00", YESTERDAY)],
             done_at="10:00", day=YESTERDAY),
        item("demo-yesterday-done-2", "萤火｜记录灯罩配色备选", "done", 1,
             at="14:00", segs=[segment("14:00", "14:35", YESTERDAY)],
             done_at="14:35", day=YESTERDAY),
    ]
    october = [
        project("demo-p-lamp", "萤火｜桌面灯", "#5856D6", {
            "2026-10-12": "样品复核", "2026-10-19": "主图与色样", "2026-10-26": "交付资料"}),
        project("demo-p-box", "海盐｜收纳盒", "#007AFF", {
            "2026-09-28": "尺寸确认", "2026-10-12": "打样", "2026-10-26": "复核到样"}),
        project("demo-p-fan", "微风｜风扇", "#00A99D", {"2026-10-19": "噪声复测"}),
        project("demo-p-paper", "纸舟｜包装改版", "#FF9500", {
            "2026-10-05": "节后补班核版", "2026-10-12": "打样反馈", "2026-10-19": "修订确认"}),
        project("demo-p-research", "拾光｜新品调研", "#AF52DE", {}),
        project("demo-p-cloud", "云朵｜说明书", "#30B0C7", {
            "2026-10-05": "警示语校对", "2026-10-12": "签版"},
            done=True, doneAt=stamp("2026-10-16", "17:30")),
        project("demo-p-window", "晴窗｜图片交付", "#34C759", {
            "2026-10-12": "产品图交付"}, done=True, doneAt=stamp(DAY, "13:25")),
    ]
    return {
        "kind": "project-board-data", "version": 1, "rev": 1,
        "savedAt": "2026-10-19T14:35:00+08:00",
        "gantt": {
            "version": 2, "mondayStart": True, "nameW": 220,
            "settings": {
                "rest": {"enabled": True, "start": "12:00", "end": "13:00"},
                "workdays": [1, 2, 3, 4, 5], "useHolidays": True,
                "dateOverrides": [], "autoCarry": True, "parallel": True,
                "enterAction": "start", "startView": "today", "motion": "auto",
            },
            "view": {"year": 2026, "month": 10},
            "months": {
                "2026-10": {"projects": october, "colorSeq": 7, "weekNotes": {
                    "2026-09-28": "国庆休假 10/1–10/7",
                    "2026-10-05": "10/8 复工 · 10/10 补班",
                    "2026-10-12": "先确认样品，再准备交付",
                    "2026-10-19": "本周：样品 / 包装 / 图片并行",
                    "2026-10-26": "月底交付资料归档"}},
                "2026-11": {"projects": [project(
                    "demo-p-lamp-nov", "萤火｜桌面灯", "#5856D6", {})],
                    "colorSeq": 1, "weekNotes": {"2026-11-02": "同名项目已建，避免重复顺延"}},
            },
        },
        "thread": {"version": 1, "days": {
            YESTERDAY: {"items": yesterday_items}, DAY: {"items": today_items}}},
    }


DEMO_TOOLS = """
  <button class="btn ghost" id="demoYesterday" title="查看演示中的前一天记录">查看昨日</button>
  <button class="btn ghost" id="demoReset" title="恢复演示的初始事项和设置">重置演示</button>
"""


def replace_once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise ValueError(f"Source marker changed; expected one match: {old[:70]!r}")
    return text.replace(old, new, 1)


def public_html(source: str) -> str:
    source, count = re.subn(
        r"  /\* ============ 阿里巴巴普惠体.*?  /\* ============ 设计令牌",
        "  /* ============ 设计令牌", source, flags=re.S,
    )
    if count != 1 and ("@font-face" in source or "Alibaba PuHuiTi" in source):
        raise ValueError("Unexpected local-font block; review the source before distributing")
    source = source.replace('"Alibaba PuHuiTi 3.0",', "")
    source = source.replace("X 盘掉线", "存储位置断开").replace("X 盘没连上", "存储位置没连上")
    source = source.replace("X 盘是否连着", "存储位置是否已连接")
    for before, after in KEYS.items():
        if before.startswith(("indexedDB.", "id:")):
            source = source.replace(before, after)
        else:
            source = source.replace(f'"{before}"', f'"{after}"')
    return source


def demo_html(public: str, data: dict) -> str:
    page = public.replace("open-project-board-", "open-project-board-demo-")
    page = replace_once(page, "<title>项目周甘特看板</title>", "<title>项目看板 · 虚构数据演示</title>")
    theme_marker = '  <div class="tabs theme-tabs" role="group" aria-label="主题">'
    page = replace_once(page, theme_marker, DEMO_TOOLS + theme_marker)
    page = page.replace("除主题外，设置会随完整数据备份保存。",
                        "演示中的设置只在本页有效，刷新或重置会复原，不会更改实际看板。")
    page = replace_once(page, '<button class="btn" id="importBtn" title="从备份文件恢复">导入</button>', "")
    page = replace_once(page, '<input type="file" id="importFile" accept="application/json,.json" hidden>', "")
    import_start = page.index('document.getElementById("importBtn").addEventListener')
    import_end = page.index("/* toast */", import_start)
    page = page[:import_start] + page[import_end:]
    page = replace_once(page, 'title="把事项记录存成文件备份">导出</button>',
                        'title="仅导出今日线程的各日记录，不含甘特图">导出事项</button>')
    page = replace_once(page, '<div class="fsgate" id="fsgate">', '<div class="fsgate" id="fsgate" hidden>')
    inline_json = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    bootstrap = r'''
/* Demo clock and storage belong only to this script. No device clock or browser storage is changed. */
var DemoRealDate = window.Date;
var demoAnchor = new DemoRealDate(2026,9,19,14,35,0).getTime();
var demoStarted = performance.now();
var Date = class extends DemoRealDate {
  constructor(...args){ super(...(args.length ? args : [Date.now()])); }
  static now(){ return demoAnchor + Math.floor(performance.now()-demoStarted); }
};
var DEMO_DATA = __DATA__;
/* Keep 14:35 local on machines in any timezone; downloadable JSON uses UTC+08 timestamps. */
var demoShift = demoAnchor - DemoRealDate.parse("2026-10-19T14:35:00+08:00");
(function adjust(value){
  if(!value || typeof value!=="object") return;
  Object.keys(value).forEach(function(key){
    if(["at","origAt","doneAt","s","e"].indexOf(key)>=0 && typeof value[key]==="number") value[key]+=demoShift;
    else adjust(value[key]);
  });
})(DEMO_DATA);
var demoStorage = Object.create(null);
demoStorage["open-project-board-demo-gantt-v1"] = JSON.stringify(DEMO_DATA.gantt);
demoStorage["open-project-board-demo-thread-v1"] = JSON.stringify(DEMO_DATA.thread);
demoStorage["open-project-board-demo-theme-v1"] = "light";
var localStorage = {
  getItem:function(key){return demoStorage[key] || null;},
  setItem:function(key,value){demoStorage[key]=String(value);}
};
'''.replace("__DATA__", inline_json)
    page = replace_once(page, '"use strict";', '(function(){\n"use strict";\n' + bootstrap)
    marker = "/* ==================================================================\n   数据文件：看板所在文件夹里的「看板数据.json」"
    prefix, found, _ = page.partition(marker)
    if not found:
        raise ValueError("File-access boundary was not found")
    # The original file-access implementation and its boot path are excluded entirely.
    return prefix + r'''
/* Demo-only save path: memory only; there is no directory access or persistent cache. */
var fsx = {ready:true, dirty:false};
function persist(){
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  localStorage.setItem(THREAD_KEY, JSON.stringify(tstate));
}
function checkDisk(){return Promise.resolve();}
function refreshView(){switchView(document.getElementById("viewToday").hidden ? "gantt" : "today");}
document.getElementById("fsStat").className="fsstat";
document.getElementById("fsStat").querySelector("span").textContent="演示修改 · 刷新复原";
document.getElementById("fsStat").title="独立虚构数据，不读取或写入本地数据文件";
document.getElementById("demoReset").addEventListener("click",function(){location.reload();});
document.getElementById("demoYesterday").addEventListener("click",function(){
  viewDay="2026-10-18"; switchView("today");
});
render();
carryOver();
applyMotionPreference();
switchView(getSettings().startView);
})();
</script>
</body>
</html>
'''


FAVICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="15" fill="#40385e"/>
<rect x="13" y="15" width="30" height="8" rx="4" fill="#fff"/>
<rect x="24" y="28" width="27" height="8" rx="4" fill="#ffd166"/>
<rect x="13" y="41" width="35" height="8" rx="4" fill="#62e0a1"/>
</svg>
'''


def validate(public: str, demo: str, data: dict) -> None:
    assert "@font-face" not in public and "fonts/" not in public
    assert "X 盘" not in public
    for original in ("week-gantt-board-v1", "week-gantt-theme", "day-thread-v1", "board-file-linked-v1"):
        assert f'"{original}"' not in public
    assert 'indexedDB.open("kanban-fs"' not in public
    for prohibited in ("showDirectoryPicker", "indexedDB", "getFileHandle", "createWritable", "window.localStorage", "FileReader"):
        assert prohibited not in demo, prohibited
    assert "function applyPack" not in demo
    assert "__DATA__" not in demo and "http://" not in demo and "https://" not in demo
    assert 'class="demo-banner"' not in demo
    assert "demoReset" not in public and "demoYesterday" not in public
    settings = data["gantt"]["settings"]
    assert settings["rest"] == {"enabled": True, "start": "12:00", "end": "13:00"}
    assert settings["workdays"] == [1, 2, 3, 4, 5] and settings["dateOverrides"] == []
    assert settings["useHolidays"] and settings["autoCarry"] and settings["parallel"]
    assert (settings["enterAction"], settings["startView"], settings["motion"]) == ("start", "today", "auto")
    current = data["thread"]["days"][DAY]["items"]
    assert len(current) == 9 and sum(i["running"] for i in current) == 2
    assert len(data["gantt"]["months"]["2026-10"]["projects"]) == 7
    noon = next(i for i in current if i["id"] == "demo-lunch-done")["segs"][0]
    assert noon["e"] - noon["s"] - 60 * 60 * 1000 == 40 * 60 * 1000
    assert not next(i for i in current if i["carried"])["running"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify generated files without writing them")
    parser.add_argument("--source", type=Path, default=SOURCE,
                        help="Source HTML (default: this package's index.html); no build is needed to run the app")
    args = parser.parse_args()
    if not args.source.is_file():
        parser.error("Source HTML is absent. Pass --source PATH to rebuild; index.html and demo.html run directly.")
    public = public_html(args.source.read_text(encoding="utf-8-sig"))
    data = mock_data()
    demo = demo_html(public, data)
    validate(public, demo, data)
    outputs = {"index.html": public, "demo.html": demo,
               "demo-data.json": json.dumps(data, ensure_ascii=False, indent=2) + "\n",
               "favicon.svg": FAVICON}
    for filename, content in outputs.items():
        target = OUT / filename
        if args.check:
            if not target.exists() or target.read_text(encoding="utf-8") != content:
                raise SystemExit(f"Generated file needs rebuilding: {filename}")
        else:
            target.write_text(content, encoding="utf-8", newline="\n")
    print(("Verified" if args.check else "Built") + ": " + ", ".join(outputs))
    print("Mock only: 9 today items, 3 history items, 7 October projects, 1 November project.")


if __name__ == "__main__":
    main()
