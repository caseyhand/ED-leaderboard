#!/usr/bin/env python3
"""
ED Leaderboard verifier: independent double-check of src/data.js against
Wendy's workbook, run AFTER update_leaderboard.py and BEFORE pushing.

Usage:
    python3 verify_leaderboard.py /path/to/spreadsheet.xlsx [--all]

Default: checks only weeks whose tabs are in the workbook AND in data.js
(i.e. everything the workbook can vouch for). --all is the same today, but
also complains about weeks in data.js the workbook no longer has.

Deliberately does NOT import update_leaderboard.py: it re-reads the sheet
with its own (simpler) parser so that a bug shared by both is unlikely.

Checks, per week:
  - every provider row in the tab is in data.js and vice versa
  - hours, pts, pt/hr (to 0.01) and ESI 1-5 match the sheet exactly;
    half hours must survive (26.5 in sheet -> 26.5 in data.js)
  - pts / hours recomputes the sheet's pt/hr within 0.011
  - ESI 1-5 sum to pts (warning only; Wendy's counts are sometimes off)
  - week total hours and total pts match the sheet
  - the week's label / dateRange agree with the tab name
Then, across the board:
  - PACE census inputs: total pts / total hours per week recomputed from
    data.js, season average, and the census factor for the newest week
  - no duplicate week ids; weeks sorted newest-first; DATA_VERSION present
  - DEFAULT_NAMES has a name for every letter that appears anywhere

Exit code 0 = everything matches (warnings allowed), 1 = at least one
mismatch, 2 = couldn't run. Output is meant to be pasted into an email.
"""

import datetime
import os
import re
import sys

REPO = os.path.dirname(os.path.abspath(__file__))
DATA_JS = os.path.join(REPO, "src", "data.js")
APP_JSX = os.path.join(REPO, "src", "App.jsx")

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


# ----------------------------------------------------------------- data.js
def parse_data_js(src):
    """Return (weeks, names). weeks: list of dicts in file order."""
    m = re.search(r"export const DEFAULT_NAMES = \{(.*?)\};", src, re.S)
    names = dict(re.findall(r'"([A-Z])":\s*"([^"]*)"', m.group(1))) if m else {}

    weeks = []
    for blk in re.finditer(
            r'\{\s*id: "([^"]+)",\s*label: "([^"]+)",\s*dateRange: "([^"]+)",'
            r'\s*hoursWorked: \{([^}]*)\},\s*physicians: \[(.*?)\]\s*\}', src, re.S):
        wid, label, drange, hrs, phys = blk.groups()
        hours = {k: float(v) for k, v in re.findall(r"([A-Z]): ([\d.]+)", hrs)}
        docs = {}
        for p in re.finditer(
                r'letter: "([A-Z])", pts: (\d+), pthr: (null|[\d.]+), '
                r'esi1: (\d+), esi2: (\d+), esi3: (\d+), esi4: (\d+), esi5: (\d+)', phys):
            L, pts, pthr, *esi = p.groups()
            docs[L] = {"pts": int(pts),
                       "pthr": None if pthr == "null" else float(pthr),
                       "esi": [int(x) for x in esi]}
        weeks.append({"id": wid, "label": label, "dateRange": drange,
                      "hours": hours, "docs": docs})
    return weeks, names


# ---------------------------------------------------------------- workbook
def norm(v):
    return re.sub(r"\s+", "", str(v)).lower() if v is not None else ""


HDR = {
    "letter": {"letter"},
    "name": {"providername", "provider", "name", "physician"},
    "hours": {"hoursworked", "hours", "hrs"},
    "pts": {"#pts", "pts", "#ptsw/oapp", "patients", "#patients"},
    "pthr": {"pt/hr", "pthr", "pts/hr"},
    "esi1": {"esi1"}, "esi2": {"esi2"}, "esi3": {"esi3"},
    "esi4": {"esi4"}, "esi5": {"esi5"},
}


def fnum(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None  # '#DIV/0!' and blanks


def tab_dates(name):
    """'11.1-11.7.26' -> (date(2026,11,1), date(2026,11,7)); tolerant like the updater."""
    a, b = name.split("-", 1)
    ta = [int(t) for t in re.findall(r"\d+", a)]
    tb = [int(t) for t in re.findall(r"\d+", b)]
    year = 2026
    for t in (tb, ta):
        if len(t) >= 3 and 12 < t[2] < 100:
            year = 2000 + t[2]
            break
    start = datetime.date(year, ta[0], ta[1]) if len(ta) >= 2 else None
    end = datetime.date(year, tb[0], tb[1]) if len(tb) >= 2 else None
    if start and end and end < start:
        end = datetime.date(year + 1, tb[0], tb[1])
    if start and not end:
        end = start + datetime.timedelta(days=6)
    if end and not start:
        start = end - datetime.timedelta(days=6)
    return start, end


def iso_week_id(start):
    monday = start + datetime.timedelta(days=1) if start.weekday() == 6 else start
    y, w, _ = monday.isocalendar()
    return f"{y}-W{w}"


def read_workbook(path, letter_by_name):
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True)
    sheets = {}
    for tab in wb.sheetnames:
        if tab.strip().lower().startswith("cumulative"):
            continue
        rows = [[c.value for c in r] for r in wb[tab].iter_rows()]
        hdr_i = cols = None
        for i, row in enumerate(rows):
            vals = [norm(v) for v in row]
            found = {k: next((j for j, v in enumerate(vals) if v in al), None)
                     for k, al in HDR.items()}
            if found["letter"] is not None or found["name"] is not None:
                hdr_i, cols = i, found
                break
        if hdr_i is None:
            warn(f"tab '{tab}': no header row found, skipped")
            continue
        if any(cols[k] is None for k in ("hours", "pts", "pthr", "esi1", "esi5")):
            warn(f"tab '{tab}': missing data columns, skipped")
            continue
        try:
            start, end = tab_dates(tab)
        except Exception as e:  # noqa
            warn(f"tab '{tab}': unparseable name ({e}), skipped")
            continue

        docs = {}
        for row in rows[hdr_i + 1:]:
            L = None
            if cols["letter"] is not None:
                v = row[cols["letter"]]
                if isinstance(v, str) and len(v.strip()) == 1 and v.strip().isalpha():
                    L = v.strip().upper()
            if L is None and cols["name"] is not None:
                v = row[cols["name"]]
                if isinstance(v, str) and v.strip() and v.strip()[0].isalpha():
                    L = letter_by_name.get(re.sub(r"[^a-z]", "", v.lower()))
                    if L is None:
                        err(f"tab '{tab}': provider '{v.strip()}' not in DEFAULT_NAMES")
                        continue
            if L is None:
                continue
            docs[L] = {
                "hours": fnum(row[cols["hours"]]) or 0.0,
                "pts": int(fnum(row[cols["pts"]]) or 0),
                "pthr": fnum(row[cols["pthr"]]),
                "esi": [int(fnum(row[cols[f"esi{k}"]]) or 0) for k in range(1, 6)],
            }
        if docs:
            sheets[iso_week_id(start)] = {"tab": tab, "start": start, "end": end, "docs": docs}
    return sheets


# ------------------------------------------------------------------ checks
def check_week(wid, sheet, week):
    tab = sheet["tab"]
    sd, dd = sheet["docs"], week["docs"]
    only_sheet = sorted(set(sd) - set(dd))
    only_data = sorted(set(dd) - set(sd))
    if only_sheet:
        err(f"{wid}: in sheet but missing from data.js: {', '.join(only_sheet)}")
    if only_data:
        err(f"{wid}: in data.js but not in sheet '{tab}': {', '.join(only_data)}")

    for L in sorted(set(sd) & set(dd)):
        s, d = sd[L], dd[L]
        h_data = week["hours"].get(L)
        if h_data is None:
            err(f"{wid} {L}: no hoursWorked entry")
        elif abs(h_data - s["hours"]) > 0.001:
            err(f"{wid} {L}: hours {h_data:g} in data.js vs {s['hours']:g} in sheet")
        if d["pts"] != s["pts"]:
            err(f"{wid} {L}: pts {d['pts']} vs sheet {s['pts']}")
        if s["pts"] > 0:
            if s["pthr"] is None or d["pthr"] is None:
                err(f"{wid} {L}: pt/hr missing (sheet {s['pthr']}, data {d['pthr']})")
            else:
                if abs(d["pthr"] - round(s["pthr"], 2)) > 0.0051:
                    err(f"{wid} {L}: pt/hr {d['pthr']} vs sheet {s['pthr']:.3f}")
                if s["hours"] > 0:
                    recomputed = s["pts"] / s["hours"]
                    if abs(recomputed - s["pthr"]) > 0.011:
                        warn(f"{wid} {L}: sheet pt/hr {s['pthr']:.3f} but pts/hours = "
                             f"{s['pts']}/{s['hours']:g} = {recomputed:.3f}")
        elif d["pthr"] is not None:
            err(f"{wid} {L}: 0 pts but pthr {d['pthr']} (should be null)")
        if d["esi"] != s["esi"]:
            err(f"{wid} {L}: ESI {d['esi']} vs sheet {s['esi']}")
        if s["pts"] > 0 and sum(s["esi"]) != s["pts"]:
            warn(f"{wid} {L}: ESI counts sum to {sum(s['esi'])} but pts = {s['pts']} (Wendy's sheet)")

    # week totals
    th_s = sum(x["hours"] for x in sd.values())
    th_d = sum(week["hours"].values())
    tp_s = sum(x["pts"] for x in sd.values())
    tp_d = sum(x["pts"] for x in dd.values())
    if abs(th_s - th_d) > 0.001:
        err(f"{wid}: total hours {th_d:g} in data.js vs {th_s:g} in sheet")
    if tp_s != tp_d:
        err(f"{wid}: total pts {tp_d} in data.js vs {tp_s} in sheet")

    # labels
    st, en = sheet["start"], sheet["end"]
    want_label = f"Week of {st.month}/{st.day}–{en.month}/{en.day}"
    if week["label"] != want_label:
        err(f"{wid}: label '{week['label']}' but tab '{tab}' implies '{want_label}'")
    if str(en.year) not in week["dateRange"] or str(en.day) not in week["dateRange"]:
        warn(f"{wid}: dateRange '{week['dateRange']}' doesn't obviously match tab '{tab}'")

    active = sum(1 for x in dd.values() if x["pts"] > 0)
    return th_d, tp_d, active


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check_all = "--all" in sys.argv
    if len(args) != 1:
        print(__doc__)
        sys.exit(2)
    xlsx = os.path.expanduser(args[0])
    if not os.path.exists(xlsx):
        print(f"File not found: {xlsx}")
        sys.exit(2)

    src = open(DATA_JS, encoding="utf-8").read()
    weeks, names = parse_data_js(src)
    if not weeks:
        print("Could not parse any weeks out of data.js")
        sys.exit(2)
    by_id = {w["id"]: w for w in weeks}
    letter_by_name = {re.sub(r"[^a-z]", "", v.lower()): k for k, v in names.items()}

    sheets = read_workbook(xlsx, letter_by_name)

    print(f"data.js: {len(weeks)} weeks, {len(names)} names.  "
          f"Workbook: {len(sheets)} weekly tabs.")
    print()

    # --- per-week ---
    checked = []
    for wid in sorted(sheets):
        if wid not in by_id:
            err(f"{wid} (tab '{sheets[wid]['tab']}') is in the workbook but NOT in data.js")
            continue
        th, tp, active = check_week(wid, sheets[wid], by_id[wid])
        checked.append((wid, th, tp, active))
    if check_all:
        for wid in by_id:
            if wid not in sheets:
                warn(f"{wid} is in data.js but the workbook has no tab for it")

    # --- structure ---
    ids = [w["id"] for w in weeks]
    if len(ids) != len(set(ids)):
        err(f"duplicate week ids in data.js: "
            f"{sorted({i for i in ids if ids.count(i) > 1})}")

    def sort_key(wid):
        y, w = wid.split("-W")
        return int(y), int(w)
    if ids != sorted(ids, key=sort_key, reverse=True):
        err("weeks in data.js are not sorted newest-first")

    for w in weeks:
        for L in set(w["docs"]) | set(w["hours"]):
            if L not in names:
                err(f"{w['id']}: letter {L} has no entry in DEFAULT_NAMES")
        for L in w["docs"]:
            if L not in w["hours"]:
                err(f"{w['id']}: {L} has a physicians row but no hoursWorked entry")

    app = open(APP_JSX, encoding="utf-8").read()
    m = re.search(r"const DATA_VERSION = (\d+)", app)
    if not m:
        err("DATA_VERSION not found in App.jsx")

    # --- PACE census inputs, recomputed from data.js ---
    intens = {}
    for w in weeks:
        th = sum(w["hours"].values())
        tp = sum(x["pts"] for x in w["docs"].values())
        if th > 0:
            intens[w["id"]] = tp / th
    season_avg = sum(intens.values()) / len(intens) if intens else 0

    # --- report ---
    print("Weeks cross-checked against the workbook:")
    for wid, th, tp, active in checked:
        cf = intens[wid] / season_avg if season_avg and wid in intens else float("nan")
        print(f"  {wid}: {active:2d} active, {tp:4d} pts, {th:6.1f} hrs, "
              f"{intens.get(wid, 0):.3f} pt/hr dept, census factor {cf:.3f}")
    print(f"Season avg department intensity: {season_avg:.4f} pt/hr over {len(intens)} weeks")
    if m:
        print(f"DATA_VERSION = {m.group(1)}")
    print()

    if warnings:
        print(f"WARNINGS ({len(warnings)}), informational:")
        for w in warnings:
            print(f"  ~ {w}")
        print()
    if errors:
        print(f"MISMATCHES ({len(errors)}) — do NOT publish:")
        for e in errors:
            print(f"  X {e}")
        sys.exit(1)
    print(f"VERIFIED OK: {len(checked)} week(s) match the workbook exactly.")


if __name__ == "__main__":
    main()
