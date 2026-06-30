"""One-off migration: reconcile Member + POD tables against Downloads/Mapping.xlsx.

Mapping (authoritative source = the sheet):
    Member.name <- Emp Name          (trimmed)
    Member.pod  <- POD column        (team; a POD row is created per distinct team)
    Member.sl   <- Portfolio column  (service line / portfolio)

Existing members matched by Emp ID are updated (name/pod/sl), keeping their
current annual target. Members not present in the sheet (e.g. PeopleSoft/EPS)
are left untouched. New people in the sheet are created with target 12.

Run from the backend dir:  ./.venv/Scripts/python.exe migrate_members.py
"""
import json
import sqlite3
import openpyxl

XLSX = r'C:\Users\413608\Downloads\Mapping.xlsx'
DB = 'bluebolt.db'

# Portfolio -> badge colour (POD.color)
PORTFOLIO_COLOR = {
    'M&E': '#3b82f6',
    'Crew Tools': '#22c55e',
    'ACE': '#f59e0b',
    'Flight Ops': '#8b5cf6',
    'FTMS': '#14b8a6',
    'KoreAI': '#ec4899',
    'Middleware': '#f97316',
    'Corp Apps': '#ef4444',
    'ET, Safety & Pulse': '#06b6d4',
}


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb['Sheet1']
    rows = list(ws.iter_rows(values_only=True))[1:]

    con = sqlite3.connect(DB)
    cur = con.cursor()

    existing_members = {str(r[0]).strip(): {'name': r[1], 'target': r[2]}
                        for r in cur.execute('select id, name, target from member')}

    # --- 1. Build the set of teams (POD column) with their portfolio -------
    teams = {}   # team -> portfolio
    for r in rows:
        _sow, _country, eid, _ename, portfolio, pod = r
        if eid is None:
            continue
        team = (pod or '').strip()
        if team:
            teams[team] = (portfolio or '').strip()

    pod_created = pod_existing = 0
    existing_pod_codes = {r[0] for r in cur.execute('select code from pod')}
    for team, portfolio in sorted(teams.items()):
        if team in existing_pod_codes:
            pod_existing += 1
            continue
        color = PORTFOLIO_COLOR.get(portfolio, '#5e6a82')
        cur.execute(
            'insert into pod (code, name, sl, color, framework_id) values (?,?,?,?,?)',
            (team, team, portfolio or 'M&E', color, ''))
        pod_created += 1

    # --- 2. Upsert members --------------------------------------------------
    created = updated = 0
    flags = []
    seen = {}
    live = set(existing_members)   # ids currently present in the member table
    for r in rows:
        _sow, _country, eid, ename, portfolio, pod = r
        if eid is None:
            flags.append(f"skipped row with no Emp ID (name={ename!r})")
            continue
        mid = str(eid).strip()
        name = (ename or '').strip()
        team = (pod or '').strip()
        sl = (portfolio or '').strip() or 'M&E'
        if not name:
            flags.append(f"[{mid}] skipped: no name")
            continue
        if mid in seen:
            flags.append(f"[{mid}] DUPLICATE Emp ID in sheet "
                         f"('{seen[mid]}' then '{name}') - last row wins")
        seen[mid] = name
        if not team:
            flags.append(f"[{mid}] {name}: blank Portfolio/POD in sheet - pod left empty")
        if not mid.isdigit():
            flags.append(f"[{mid}] {name}: non-numeric Emp ID (placeholder/open position)")

        if mid in live:
            # already in DB (or just inserted by an earlier duplicate row) -> update
            cur.execute('update member set name=?, pod=?, sl=? where id=?',
                        (name, team, sl, mid))
            if mid in existing_members:
                updated += 1
        else:
            cur.execute(
                'insert into member (id, name, pod, sl, target, custom_json) '
                'values (?,?,?,?,?,?)',
                (mid, name, team, sl, 12, json.dumps({})))
            live.add(mid)
            created += 1

    con.commit()

    in_sheet = set(seen)
    untouched = [(mid, m['name']) for mid, m in existing_members.items()
                 if mid not in in_sheet]

    print(f"PODs:     created {pod_created}, already existed {pod_existing}")
    print(f"Members:  created {created}, updated {updated}")
    print(f"\nExisting members NOT in sheet (left untouched): {len(untouched)}")
    for mid, nm in sorted(untouched):
        print(f"   [{mid}] {nm}")
    print(f"\nFlags ({len(flags)}):")
    for f in flags:
        print(f"   - {f}")
    con.close()


if __name__ == '__main__':
    main()
