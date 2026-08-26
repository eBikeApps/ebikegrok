#!/usr/bin/env python3
"""Convert the QA workbook to a standalone RTL HTML file."""

from html import escape
from openpyxl import load_workbook

SRC = "/Users/arielyakobov/Desktop/ebike/docs/eBike-QA-Progress-2026-08.xlsx"
OUT = "/Users/arielyakobov/Desktop/ebike/docs/eBike-QA-Progress-2026-08.html"

STATUS_CLASS = {
    "קיים בקוד — לא נבדק במכשיר": "st-code",
    "עובד (ידוע מהיסטוריה / פרודקשן)": "st-ok",
    "חלקי": "st-part",
    "לא עובד / שבור": "st-broken",
    "בלוקר פרודקשן": "st-block",
    "חסר לחנות": "st-miss",
    "UX חלקי / לא אחיד": "st-ux",
}

wb = load_workbook(SRC, data_only=False)

tabs = []
panels = []
for i, ws in enumerate(wb.worksheets):
    active = " active" if i == 0 else ""
    tabs.append(
        f'<button class="tab{active}" data-tab="s{i}" type="button">{escape(ws.title)}</button>'
    )
    rows_html = []
    max_col = ws.max_column
    max_row = ws.max_row
    for r in range(1, max_row + 1):
        cells = []
        tag = "th" if r <= 2 else "td"
        row_class = " title-row" if r == 1 else (" head-row" if r == 2 else "")
        for c in range(1, max_col + 1):
            cell = ws.cell(r, c)
            val = cell.value
            if val is None:
                text = ""
            elif isinstance(val, str) and val.startswith("="):
                text = "— (נוסחה באקסל)"
            else:
                text = str(val)
            extra = ""
            cls = STATUS_CLASS.get(text, "")
            if cls:
                extra = f' class="{cls}"'
            cells.append(f"<{tag}{extra}>{escape(text).replace(chr(10), '<br>')}</{tag}>")
        rows_html.append(f'<tr class="{row_class}">' + "".join(cells) + "</tr>")
    hidden = "" if i == 0 else " hidden"
    panels.append(
        f'<section class="panel{hidden}" id="s{i}"><div class="table-wrap"><table>{"".join(rows_html)}</table></div></section>'
    )

html = f"""<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>eBike — QA והתקדמות השקה</title>
<style>
  :root {{
    --bg: #0f172a;
    --card: #ffffff;
    --ink: #0f172a;
    --muted: #64748b;
    --line: #e2e8f0;
    --blue: #1d4ed8;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #e8eef7;
    color: var(--ink);
  }}
  header {{
    background: var(--bg);
    color: #fff;
    padding: 20px 24px 12px;
    position: sticky;
    top: 0;
    z-index: 5;
  }}
  header h1 {{ margin: 0 0 6px; font-size: 22px; }}
  header p {{ margin: 0 0 14px; color: #cbd5e1; font-size: 14px; }}
  .tabs {{
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 8px;
  }}
  .tab {{
    border: 0;
    background: #1e293b;
    color: #e2e8f0;
    padding: 8px 12px;
    border-radius: 999px;
    white-space: nowrap;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
  }}
  .tab.active {{ background: #3b82f6; color: #fff; }}
  .panel {{ padding: 16px; }}
  .panel[hidden] {{ display: none; }}
  .table-wrap {{ overflow: auto; background: #fff; border-radius: 12px; box-shadow: 0 8px 24px rgba(15,23,42,.08); }}
  table {{ border-collapse: collapse; min-width: 100%; font-size: 13px; }}
  th, td {{
    border: 1px solid var(--line);
    padding: 8px 10px;
    vertical-align: top;
    text-align: right;
    max-width: 420px;
  }}
  .title-row td, .title-row th {{
    background: #0f172a;
    color: #fff;
    font-size: 16px;
    font-weight: 800;
  }}
  .head-row th, .head-row td {{
    background: #1e3a8a;
    color: #fff;
    font-weight: 700;
    position: sticky;
    top: 0;
  }}
  tr:nth-child(even) td {{ background: #f8fafc; }}
  .st-ok {{ background: #d1fae5 !important; font-weight: 700; }}
  .st-part {{ background: #fef3c7 !important; font-weight: 700; }}
  .st-broken {{ background: #fecaca !important; font-weight: 700; }}
  .st-block {{ background: #fca5a5 !important; font-weight: 700; }}
  .st-miss {{ background: #e9d5ff !important; font-weight: 700; }}
  .st-code {{ background: #e0e7ff !important; font-weight: 700; }}
  .st-ux {{ background: #cffa fe !important; font-weight: 700; }}
</style>
</head>
<body>
<header>
  <h1>eBike — QA והתקדמות השקה</h1>
  <p>אותו תוכן כמו קובץ האקסל. נפתח בדפדפן, בלי Excel. לחץ על הטאבים למעלה.</p>
  <nav class="tabs">{''.join(tabs)}</nav>
</header>
{''.join(panels)}
<script>
  document.querySelectorAll('.tab').forEach((btn) => {{
    btn.addEventListener('click', () => {{
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.hidden = true);
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).hidden = false;
      window.scrollTo({{ top: 0, behavior: 'smooth' }});
    }});
  }});
</script>
</body>
</html>
"""

# fix accidental space in css class
html = html.replace(".st-ux {{ background: #cffa fe", ".st-ux { background: #cffafe")

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print(OUT)
