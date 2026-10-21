# Display helpers for the Colab notebook: the three results, styled like the web app.
import base64
import html
import io
import math
from datetime import date

import matplotlib.pyplot as plt
from IPython.display import HTML, display

RED, RED_DARK, BLUE, BLUE_DARK = '#d64541', '#8e1b1b', '#2e6fba', '#123f7a'
MEAN_COLOR, DESIGN_COLOR = '#2e7d32', '#111827'

BASE_CSS = """
<style>
.pgx{font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f2937;max-width:980px}
.pgx h2{font-size:20px;margin:28px 0 10px;padding-bottom:6px;border-bottom:3px solid var(--c)}
.pgx table.data{border-collapse:collapse;font-size:13px;margin:6px 0 12px}
.pgx table.data th{background:var(--c);color:#fff;padding:6px 9px;font-weight:600;text-align:center}
.pgx table.data td{border:1px solid #e5e7eb;padding:5px 9px;text-align:center;font-variant-numeric:tabular-nums}
.pgx table.data tr:nth-child(even) td{background:#f9fafb}
.pgx table.data tr.hl td{background:var(--hl);font-weight:700}
.pgx table.data tr.off td{background:#f3f4f6;color:#9ca3af;font-style:italic}
.pgx table.data tr.off td.why{text-align:left}
.pgx .summary{display:flex;gap:12px;flex-wrap:wrap;margin:6px 0 4px}
.pgx .summary div{border:1px solid #e5e7eb;border-left:4px solid var(--c);border-radius:6px;padding:8px 14px;background:#fff}
.pgx .summary b{display:block;font-size:18px}
.pgx .muted{color:#6b7280;font-size:12px}
.pgx table.heat{border-collapse:separate;border-spacing:2px;font-size:11px;margin-top:6px}
.pgx table.heat td{width:44px;height:22px;text-align:center;border-radius:3px;font-variant-numeric:tabular-nums}
.pgx table.heat th{font-weight:600;color:#6b7280;padding:0 6px;text-align:left}
.pgx table.heat tr.all td{color:#374151}
.pgx .error{border:1px solid #fca5a5;background:#fef2f2;color:#991b1b;padding:14px 18px;border-radius:8px;font-size:15px}
.pgx .card{border-radius:12px;padding:18px 22px;background:linear-gradient(135deg,#0f766e,#1d4ed8);color:#fff;margin:10px 0 16px}
.pgx .card .big{font-size:28px;font-weight:800;letter-spacing:.5px}
.pgx .card .sub{opacity:.92;margin-top:6px;font-size:14px}
.pgx .head{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px;
  border-bottom:1px solid #e5e7eb;padding-bottom:8px}
.pgx .head .t{font-size:22px;font-weight:800}
table.spec{border-collapse:collapse;width:100%;max-width:760px;font-size:13px;font-family:Arial,Helvetica,sans-serif}
table.spec td{border:1px solid #c9ced6;padding:7px 9px}
table.spec td.c{text-align:center}
.spec-title{font-family:'Times New Roman',serif;font-weight:700;font-size:17px;margin:14px 0 8px}
.spec-note{font-family:'Times New Roman',serif;font-size:14px;max-width:760px;text-align:justify;margin-top:10px}
</style>
"""


def show_html(body):
    display(HTML(BASE_CSS + body))


def show_error(message):
    show_html(f'<div class="pgx"><div class="error">⚠️ {html.escape(message)}</div></div>')


def _fmt_date(iso):
    d = date.fromisoformat(iso)
    return d.strftime('%d %b %Y').lstrip('0')


def _f(v, n=1):
    return f'{v:.{n}f}'.replace('-', '−')


def _png(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=160, bbox_inches='tight')
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


def bar_chart(years, values, highlight_year, mean_value, design_value, color, color_dark, ylabel, title, decimals):
    fig, ax = plt.subplots(figsize=(10, 4.3))
    colors = [color_dark if y == highlight_year else color for y in years]
    bars = ax.bar([str(y) for y in years], values, color=colors, edgecolor='white', linewidth=0.8, zorder=3)
    if design_value is None:
        ax.axhline(mean_value, color=DESIGN_COLOR, linestyle='-', linewidth=2, zorder=4,
                   label=f'Design (mean): {mean_value:.2f} °C')
        lines = [mean_value]
    else:
        ax.axhline(mean_value, color=MEAN_COLOR, linestyle='--', linewidth=1.8, zorder=4,
                   label=f'Mean: {mean_value:.{decimals}f} °C')
        ax.axhline(design_value, color=DESIGN_COLOR, linestyle='-', linewidth=2, zorder=4,
                   label=f'Design (98%): {design_value:.{decimals}f} °C')
        lines = [mean_value, design_value]
    lo = min(values + lines)
    hi = max(values + lines)
    pad = max(0.8, (hi - lo) * 0.25)
    ax.set_ylim(lo - pad, hi + pad)
    for b, v in zip(bars, values):
        ax.text(b.get_x() + b.get_width() / 2, v + (hi - lo + 2 * pad) * 0.01, f'{v:.{decimals}f}',
                ha='center', va='bottom', fontsize=8, zorder=5)
    ax.set_ylabel(ylabel)
    ax.set_xlabel('Year')
    ax.set_title(title, fontsize=12, fontweight='bold')
    ax.grid(axis='y', alpha=0.3, zorder=0)
    ax.spines[['top', 'right']].set_visible(False)
    ax.legend(loc='upper left', bbox_to_anchor=(1.0, 1.0), frameon=False)
    plt.setp(ax.get_xticklabels(), rotation=45)
    return _png(fig)


def show_header(project_name, station_name, latitude, grade):
    station = f' · Station: {html.escape(station_name)}' if station_name else ''
    show_html(f"""<div class="pgx"><div class="head">
      <div><div class="t">Superpave PG Binder Selector</div>
      <div class="muted">Project: {html.escape(project_name)}{station} · Latitude: {latitude:g}° ·
      Reliability: {grade['reliabilityPercent']}%</div></div>
      <div class="muted">Prepared by Abenezer Tilahun</div></div></div>""")


def _why_not_used(e, high):
    if e['reason'] == 'no-usable-period':
        return 'Not used: no 7 recorded days in a row' if high else 'Not used: no usable day'
    if e['realFraction'] == 0:
        return 'Not used: no data this year'
    pct = math.floor(e['realFraction'] * 1000) / 10
    return f'Not used: only {pct:g}% of days recorded (at least {MIN_REAL_FRACTION * 100:g}% needed)'


def _with_left_out_rows(used_rows, excluded, colspan, high):
    """All years in order: used rows as given, left-out years greyed with the reason."""
    rows = dict(used_rows)
    for e in excluded:
        rows[e['year']] = (f"<tr class='off'><td>{e['year']}</td>"
                           f"<td class='why' colspan='{colspan}'>{_why_not_used(e, high)}</td></tr>")
    return ''.join(rows[y] for y in sorted(rows))


def _left_out_note(excluded):
    if not excluded:
        return ''
    return (f' Grey rows: {len(excluded)} year{"s" if len(excluded) > 1 else ""} left out because less than {MIN_REAL_FRACTION * 100:g}% '
            f'of the days were recorded; they are not used in the graph or the design.')


def show_seven_day(climate, grade):
    years = climate['high']['years']
    hottest = grade['high']['hottestYear']
    used = [(y['year'],
             f"<tr class='{'hl' if y['year'] == hottest else ''}'><td>{y['year']}</td><td>{_fmt_date(y['startDate'])}</td>"
             f"<td>{_fmt_date(y['endDate'])}</td>" + ''.join(f'<td>{_f(d)}</td>' for d in y['days'])
             + f"<td><b>{_f(y['average'], 2)}</b></td></tr>") for y in years]
    rows = _with_left_out_rows(used, climate['high'].get('excluded', []), 10, True)
    head = ''.join(f'<th>Day {i}</th>' for i in range(1, 8))
    chart = bar_chart([y['year'] for y in years], [y['average'] for y in years], hottest, grade['high']['mean'],
                      grade['high']['designAirTemp'], RED, RED_DARK, '7-day average (°C)',
                      'Annual 7-day consecutive maximum air temperature', 2)
    h = grade['high']
    show_html(f"""<div class="pgx" style="--c:{RED};--hl:#fde2e1">
      <h2>1 · Annual 7-Day Consecutive Maximum Temperature</h2>
      <table class="data"><tr><th>Year</th><th>Start date</th><th>End date</th>{head}<th>7-day average (°C)</th></tr>
      {rows}</table>
      <div class="muted">The hottest year ({hottest}) is highlighted. Years used: {h['yearsUsed']}.{_left_out_note(climate['high'].get('excluded', []))}</div>
      <img style="max-width:100%;margin-top:8px" src="data:image/png;base64,{chart}"/>
      <div class="summary"><div>Mean<b>{_f(h['mean'], 2)} °C</b></div>
      <div>Standard deviation<b>{_f(h['sd'], 2)} °C</b></div>
      <div>Design high air temperature (98%) = mean + 2.054 σ<b>{_f(h['designAirTemp'], 2)} °C</b></div></div></div>""")
    return chart


def show_annual_min(climate, grade):
    years = climate['low']['years']
    coldest = grade['low']['coldestYear']
    used = [(y['year'], f"<tr class='{'hl' if y['year'] == coldest else ''}'><td>{y['year']}</td>"
                        f"<td>{_fmt_date(y['date'])}</td><td><b>{_f(y['value'])}</b></td></tr>") for y in years]
    rows = _with_left_out_rows(used, climate['low'].get('excluded', []), 2, False)
    chart = bar_chart([y['year'] for y in years], [y['value'] for y in years], coldest, grade['low']['mean'],
                      None, BLUE, BLUE_DARK, 'Minimum temperature (°C)',
                      'Annual minimum air temperature', 1)
    lo = grade['low']
    show_html(f"""<div class="pgx" style="--c:{BLUE};--hl:#dbeafe">
      <h2>2 · Annual Minimum Temperature</h2>
      <table class="data"><tr><th>Year</th><th>Date</th><th>Minimum temperature (°C)</th></tr>{rows}</table>
      <div class="muted">The coldest year ({coldest}) is highlighted. Years used: {lo['yearsUsed']}.{_left_out_note(climate['low'].get('excluded', []))}</div>
      <img style="max-width:100%;margin-top:8px" src="data:image/png;base64,{chart}"/>
      <div class="summary"><div>Mean<b>{_f(lo['mean'], 2)} °C</b></div>
      <div>Standard deviation<b>{_f(lo['sd'], 2)} °C</b></div>
      <div>Low air temperature used in design (mean)<b>{_f(lo['designAirTemp'], 2)} °C</b></div></div></div>""")
    return chart


RED_RAMP = ['#fde4e3', '#fbc9c7', '#f7a8a6', '#f08785', '#e86866', '#e34948', '#c63a3a', '#a12e2e', '#7a2222']
BLUE_RAMP = ['#cde2fb', '#9ec5f4', '#86b6ef', '#6da7ec', '#3987e5', '#2a78d6', '#1c5cab', '#184f95', '#0d366b']
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def _heatmap_html(title, cells, ramp, colder_is_darker, marked, not_used):
    means = [c['mean'] for c in cells if c['mean'] is not None]
    lo, hi = min(means), max(means)
    years = sorted({c['year'] for c in cells})
    grid = {(c['year'], c['month']): c for c in cells}
    rows = []
    for y in years:
        tds = []
        for m in range(1, 13):
            c = grid.get((y, m))
            if c is None or c['mean'] is None:
                tds.append('<td style="background:repeating-linear-gradient(135deg,#e5e7eb 0 2px,#fff 2px 7px)"></td>')
                continue
            t = 0.5 if hi == lo else (c['mean'] - lo) / (hi - lo)
            t = 1 - t if colder_is_darker else t
            i = max(0, min(len(ramp) - 1, round(t * (len(ramp) - 1))))
            color = '#fff' if i >= (len(ramp) + 1) // 2 else '#111'
            ring = 'outline:2px solid #111;outline-offset:-2px;' if marked.get(y) == m else ''
            tds.append(f'<td style="background:{ramp[i]};color:{color};{ring}">{_f(c["mean"])}</td>')
        label = f'<i style="color:#9ca3af">{y} ✕</i>' if y in not_used else str(y)
        rows.append(f'<tr><th>{label}</th>{"".join(tds)}</tr>')
    month_means = []
    for m in range(1, 13):
        v = [c['mean'] for c in cells if c['month'] == m and c['mean'] is not None]
        month_means.append(f'<td><b>{_f(sum(v) / len(v)) if v else "—"}</b></td>')
    legend = ramp[::-1] if colder_is_darker else ramp
    return (f"<div style='margin:10px 0 18px'><div style='display:flex;justify-content:space-between;align-items:center'>"
            f"<b>{title}</b><span class='muted'>{_f(lo)} <span style='display:inline-block;width:110px;height:10px;"
            f"border-radius:6px;background:linear-gradient(90deg,{','.join(legend)})'></span> {_f(hi)} °C</span></div>"
            f"<table class='heat'><tr><th></th>{''.join(f'<th>{m}</th>' for m in MONTHS)}</tr>{''.join(rows)}"
            f"<tr class='all'><th>All yrs</th>{''.join(month_means)}</tr></table></div>")


def show_heatmaps(climate):
    hot = {y['year']: int(y['startDate'][5:7]) for y in climate['high']['years']}
    cold = {y['year']: int(y['date'][5:7]) for y in climate['low']['years']}
    show_html(f"""<div class="pgx" style="--c:#374151"><h2>3 · Monthly Temperature Heatmaps</h2>
      <div class="muted">Mean of the recorded daily values for each month of each year (filled gaps are not shown).</div>
      {_heatmap_html('Daily maximum temperature (Tmax), monthly mean', climate['monthly']['tmax'], RED_RAMP, False, hot,
                     set(climate['high']['excludedYears']))}
      {_heatmap_html('Daily minimum temperature (Tmin), monthly mean', climate['monthly']['tmin'], BLUE_RAMP, True, cold,
                     set(climate['low']['excludedYears']))}
      <div class="muted">Outlined: month of the year's hottest 7-day window (Tmax) or coldest night (Tmin).
      Hatched: fewer than half of the month's days recorded. ✕: year not used in the design.</div></div>""")


BINDER_COLORS = {1: '#c6e3b3', 2: '#fff34d', 3: '#d39fd6'}


def _lab_requirements(spec):
    L = spec['limits']
    sel = spec['columns'][spec['selectedIndex']]
    return {
        'flash': [f"Flash point ≥ {L['flashPointMinC']} °C"],
        'rv': [f"Viscosity ≤ {L['viscosityMaxPaS']} Pa·s at {L['viscosityTestTempC']} °C"],
        'dsr': [f"Original binder: G*/sin δ ≥ {L['originalDsrMinKPa']:.2f} kPa at {spec['originalDsrTempC']} °C",
                f"RTFO residue: G*/sin δ ≥ {L['rtfoDsrMinKPa']:.2f} kPa at {spec['rtfoDsrTempC']} °C",
                f"PAV residue: G*·sin δ ≤ {L['pavDsrMaxKPa']} kPa at {_f(sel['pavDsrTempC'], 0)} °C"],
        'rtfo': [f"Mass change ≤ {L['rtfoMassChangeMaxPct']:.2f}%", '163 °C, 85 minutes'],
        'pav': [f"{spec['pavAgingTempLabel']} °C, {L['pavPressureMPa']:.2f} MPa, {L['pavAgingHours']} hours"],
        'bbr': [f"S ≤ {L['bbrStiffnessMaxMPa']} MPa and m ≥ {L['bbrMValueMin']:.3f} at {_f(sel['bbrTempC'], 0)} °C"],
        'dtt': [f"Failure strain ≥ {L['dttFailureStrainMinPct']:.2f}% at {_f(sel['dttTempC'], 0)} °C"],
    }


def show_binder(grade):
    """Section 5: binder type chart (selected grade marked) and the laboratory tests for the grade."""
    bt = grade['binderType']
    H, L = grade['finalGrade']['high'], grade['finalGrade']['low']
    head = ''.join(f"<th style='padding:4px 8px;color:{'#111' if h == H else '#6b7280'}'>{h}</th>" for h in BINDER_MATRIX_HIGH)
    rows = []
    for i, low in enumerate(BINDER_MATRIX_LOW):
        cells = []
        for h in BINDER_MATRIX_HIGH:
            here = h == H and low == L
            mark = '<div style="font-size:9px;font-weight:700">YOUR GRADE</div>' if here else ''
            ring = 'outline:3px solid #111;outline-offset:-3px;font-weight:700;' if here else ''
            cells.append(f"<td style='background:{BINDER_COLORS[BINDER_MATRIX[h][i]]};{ring}padding:8px 10px;text-align:center;"
                         f"border-radius:5px;color:#1f2937'>{h}{low}{mark}</td>")
        rows.append(f"<tr><th style='padding:4px 8px;color:{'#111' if low == L else '#6b7280'}'>{_f(low, 0)}</th>{''.join(cells)}</tr>")
    legend = ''.join(f"<span style='margin-right:16px'><span style='display:inline-block;width:12px;height:12px;border-radius:3px;"
                     f"background:{BINDER_COLORS[c]};vertical-align:middle;margin-right:5px'></span>{BINDER_TYPES[c][0]}</span>"
                     for c in (1, 2, 3))
    rule = f"{H} + {abs(L)} = {bt['temperatureSum']} {'&gt; 90' if bt['ruleOf90SaysModified'] else '≤ 90'}"
    reqs = _lab_requirements(grade['spec'])
    cards = []
    for t in LAB_EQUIPMENT:
        items = ''.join(f"<li style='background:#f4f4f5;border-radius:4px;padding:2px 6px;margin-top:3px'>{r}</li>"
                        for r in reqs.get(t['id'], []))
        cards.append(f"<div style='border:1px solid #e5e7eb;border-top:4px solid {t['color']};border-radius:10px;overflow:hidden;background:#fff'>"
                     f"<div style='height:120px;display:flex;align-items:center;justify-content:center;padding:6px'>"
                     f"<div style='width:160px;height:120px'>{t['svg']}</div></div><div style='padding:8px 12px 12px'>"
                     f"<b>{t['name']}</b> <span class='muted'>{t['standard']}</span>"
                     f"<div style='color:{t['color']};font-size:12px;font-weight:600'>{t['stage']}</div>"
                     f"<div class='muted' style='font-size:12.5px;margin-top:4px'>{t['purpose']}</div>"
                     f"<ul style='list-style:none;padding:0;margin:6px 0 0;font-size:12.5px;font-weight:600'>{items}</ul></div></div>")
    show_html(f"""<div class="pgx" style="--c:#374151"><h2>5 · Binder Type and Laboratory Tests</h2>
      <div style='display:flex;align-items:center;gap:12px;border:1px solid #e5e7eb;border-radius:10px;padding:10px 14px;
        background:{BINDER_COLORS[bt['code']]}55;margin-bottom:10px'>
        <span style='width:30px;height:30px;border-radius:6px;background:{BINDER_COLORS[bt['code']]};border:1px solid #9ca3af'></span>
        <div><div class='muted'>BINDER TYPE FOR {grade['finalGrade']['label']}</div><b style='font-size:18px'>{bt['name']}</b>
        <div class='muted'>{bt['description']}</div></div>
        <div style='margin-left:auto;text-align:right'><div class='muted'>RULE OF 90</div><b>{rule}</b>
        <div class='muted'>{'likely modified' if bt['ruleOf90SaysModified'] else 'typically unmodified'}</div></div></div>
      <table style='border-collapse:separate;border-spacing:3px'><tr><th class='muted'>Low \ High</th>{head}</tr>{''.join(rows)}</table>
      <div style='margin:8px 0 18px;font-size:13px'>{legend}</div>
      <b>Laboratory tests and equipment for {grade['finalGrade']['label']}</b>
      <div style='display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:8px'>{''.join(cards)}</div>
      </div>""")


ESAL_LABELS = {'lt0.3': '< 0.3', '0.3to3': '0.3 to < 3', '3to10': '3 to < 10', '10to30': '10 to < 30', 'ge30': '≥ 30'}
SPEED_LABELS = {'standing': 'standing', 'slow': 'slow', 'standard': 'standard'}


def models_html(grade, latitude):
    """SHRP (high) and LTPP (low) design temperature models: formula, then the project's numbers."""
    lat = abs(latitude)
    lat2 = lat * lat
    z, h, l = grade['z'], grade['high'], grade['low']
    high_sum = h['designAirTemp'] - 0.00618 * lat2 + 0.2289 * lat + 42.2
    root = math.sqrt(4.4 + 0.52 * l['sd'] ** 2)
    f = lambda x, d=2: _f(x, d)  # noqa: E731

    def row(label, body, strong=False):
        weight = 'font-weight:700;' if strong else ''
        return (f"<tr><td style='width:96px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.04em'>"
                f"{label}</td><td style=\"font-family:'Times New Roman',serif;font-size:15px;{weight}\">{body}</td></tr>")

    def card(color, tag, title, sub, rows):
        return (f"<div style='border:1px solid #e5e7eb;border-top:4px solid {color};border-radius:10px;padding:12px 16px;"
                f"background:#f9fafb;margin:10px 0'><div style='display:flex;justify-content:space-between;flex-wrap:wrap'>"
                f"<b><span style='background:{color};color:#fff;border-radius:5px;padding:1px 7px;margin-right:6px'>{tag}</span>"
                f"{title}</b><span class='muted'>{sub}</span></div><table style='margin-top:6px'>{''.join(rows)}</table></div>")

    bump = (f" → traffic → <span style='color:{RED}'>PG {grade['finalGrade']['high']}</span>"
            if grade['finalGrade']['high'] != grade['climateGrade']['high'] else '')
    shrp = card(RED, 'SHRP', 'High-temperature model', 'Pavement temperature at 20 mm depth', [
        row('Formula', 'T<sub>air</sub> = T̄<sub>7-day</sub> + z·σ<sub>7-day</sub>'),
        row('', 'T<sub>20mm</sub> = (T<sub>air</sub> − 0.00618·Lat² + 0.2289·Lat + 42.2) × 0.9545 − 17.78'),
        row('Inputs', f"T̄<sub>7-day</sub> = {f(h['mean'])} °C, σ = {f(h['sd'])} °C, z = {f(z, 3)} (98%), Lat = {f(lat)}° "
                      f"({h['yearsUsed']} years)"),
        row('Air', f"T<sub>air</sub> = {f(h['mean'])} + {f(z, 3)} × {f(h['sd'])} = <b>{f(h['designAirTemp'])} °C</b>"),
        row('Pavement', f"T<sub>20mm</sub> = ({f(h['designAirTemp'])} − {f(0.00618 * lat2, 3)} + {f(0.2289 * lat, 3)} + 42.2)"
                        f" × 0.9545 − 17.78"),
        row('', f"= {f(high_sum, 3)} × 0.9545 − 17.78 = <b>{f(h['pavementTemp'])} °C</b>"),
        row('Grade', f"{f(h['pavementTemp'])} °C → rounded up to <span style='color:{RED}'>PG {grade['climateGrade']['high']}"
                     f"</span>{bump}", True),
    ])
    ltpp = card(BLUE, 'LTPP', 'Low-temperature model', 'Pavement temperature at the surface (H = 0 mm)', [
        row('Formula', 'T<sub>pav</sub> = −1.56 + 0.72·T<sub>air</sub> − 0.004·Lat² + 6.26·log<sub>10</sub>(H + 25) − '
                       'z·√(4.4 + 0.52·σ²)'),
        row('Inputs', f"T<sub>air</sub> = {f(l['meanAirTemp'])} °C (mean of yearly minima), σ = {f(l['sd'])} °C, "
                      f"z = {f(z, 3)}, Lat = {f(lat)}°, H = 0 ({l['yearsUsed']} years)"),
        row('Terms', f"−1.56 + {f(0.72 * l['meanAirTemp'], 3)} − {f(0.004 * lat2, 3)} + {f(6.26 * math.log10(25), 3)} = "
                     f"{f(l['baseTemp'], 3)}"),
        row('Reliability', f"{f(z, 3)} × √(4.4 + 0.52 × {f(l['sd'])}²) = {f(z, 3)} × {f(root, 3)} = "
                           f"{f(l['reliabilityTerm'], 3)}"),
        row('Pavement', f"T<sub>pav</sub> = {f(l['baseTemp'], 3)} − {f(l['reliabilityTerm'], 3)} = "
                        f"<b>{f(l['pavementTemp'])} °C</b>"),
        row('Grade', f"{f(l['pavementTemp'])} °C → rounded down to <span style='color:{BLUE}'>"
                     f"{_f(grade['climateGrade']['low'], 0)}</span>", True),
    ])
    return shrp + ltpp


def show_grade(grade, inputs, spec_table_html):
    t = grade['traffic']
    if t['isConsiderCase']:
        bump = ('+1 grade (you chose to add the grade AASHTO M323 says to consider)' if t['gradesAdded']
                else 'no change. AASHTO M323 says to consider +1 grade: tick "add_one_grade_if_considered" in '
                     'Step 1 and run Step 3 again to add it')
    else:
        bump = 'no change' if t['gradesAdded'] == 0 else f"+{t['gradesAdded']} grade{'s' if t['gradesAdded'] > 1 else ''}"
    capped = '<div class="sub">⚠️ Limited to PG 88, the highest grade.</div>' if t['cappedAtMax'] else ''
    out_of_range = ''
    if grade['high']['outOfRange']:
        out_of_range += '<div class="sub">⚠️ The high pavement temperature is above 88 °C.</div>'
    if grade['low']['outOfRange']:
        out_of_range += '<div class="sub">⚠️ The low pavement temperature is below −46 °C.</div>'
    show_html(f"""<div class="pgx" style="--c:#0f766e"><h2>4 · Final PG Grade and Specification</h2>
      <div class="card"><div class="big">Reliability: {grade['reliabilityPercent']}% &nbsp;|&nbsp;
      {grade['climateGrade']['label']} → {grade['finalGrade']['label']}</div>
      <div class="sub">Climate: SHRP T<sub>20 mm</sub> = {_f(grade['high']['pavementTemp'], 2)} °C → PG {grade['climateGrade']['high']},
      &nbsp; LTPP T<sub>pav,low</sub> = {_f(grade['low']['pavementTemp'], 2)} °C → {_f(grade['climateGrade']['low'], 0)}</div>
      <div class="sub">Traffic: {inputs['designEsalMillions']:g} million ESAL ({ESAL_LABELS[t['esalClass']]}),
      {inputs['designSpeedKmh']:g} km/h ({SPEED_LABELS[t['speedClass']]}) → {bump}</div>{capped}{out_of_range}</div>
      {models_html(grade, inputs['latitude'])}
      {spec_table_html}</div>""")


# Section colours and icons as in the reference table.
C = {'blue': '#2b8bd8', 'teal': '#17a589', 'red': '#ff6b6b', 'pink': '#fde4e4', 'lblue': '#dbeafa',
     'orange': '#f39c12', 'purple': '#8e44ad', 'rtfo': '#e74c3c', 'pav': '#e67e22', 'yellow': '#fef3cd',
     'green_l': '#d9f2e3', 'lav': '#dfe6fb', 'dtt': '#27ae60', 'white': '#ffffff'}


def spec_table_html(spec):
    cols = spec['columns']
    n = len(cols)
    L = spec['limits']

    def td(text, bg, colspan=1, bold=False, color='#1f2937', center=True, extra=''):
        style = f'background:{bg};color:{color};{"font-weight:700;" if bold else ""}{extra}'
        cls = ' class="c"' if center else ''
        span = f' colspan="{colspan}"' if colspan > 1 else ''
        return f'<td{cls}{span} style="{style}">{text}</td>'

    def section(title, bg):
        return f'<tr>{td(title, bg, n + 1, True, "#fff", center=False)}</tr>'

    def per_column(values, bg):
        return ''.join(td(_f(v, 0), C['orange'] if c['selected'] else bg, bold=c['selected'],
                          color='#fff' if c['selected'] else '#1f2937') for c, v in zip(cols, values))

    def row(left, right_cells, left_bg=C['white']):
        return f'<tr>{td(left, left_bg, center=False)}{right_cells}</tr>'

    hg = spec['highGrade']
    rows = [
        f"<tr>{td('Performance Grades', C['blue'], 2, True, '#fff')}{td('', C['blue'], n - 1)}</tr>",
        f"<tr>{td('Property', C['teal'], 1, True, '#fff', center=False)}{td(f'PG {hg}', C['teal'], n, True, '#fff')}</tr>",
        f"<tr>{td('🌡️ <b>Max. Design Temp. (°C)</b>', C['pink'], center=False, color='#c0392b')}"
        f"{td(str(hg), C['red'], n, True, '#fff')}</tr>",
        row('❄️ <b>Min. Design Temp. (°C)</b>', per_column([c['lowGrade'] for c in cols], C['lblue']), C['lblue']),
        section('🧪 Original Binder', C['purple']),
        row(f"≥{L['flashPointMinC']} °C", td('🔥 Flash Point', C['yellow'], n, center=False)),
        row(f"≤{L['viscosityMaxPaS']} Pa·s @ {L['viscosityTestTempC']} °C",
            td('💧 Rotational Viscosity', C['lblue'], n, center=False)),
        row(f"≥{L['originalDsrMinKPa']:.2f} kPa", td('⚙️ DSR G*/sin δ (Dynamic Shear Rheometer)', C['green_l'], n, center=False)),
        row('', td(str(spec['originalDsrTempC']), C['red'], n, True, '#fff')),
        section(f"🔥 (Rolling Thin Film Oven) RTFO, Mass Change ≤ {L['rtfoMassChangeMaxPct']:.2f}%", C['rtfo']),
        row(f"≥{L['rtfoDsrMinKPa']:.2f} kPa", td('⚙️ DSR G*/sin δ (Dynamic Shear Rheometer)', C['green_l'], n, center=False)),
        row('', td(str(spec['rtfoDsrTempC']), C['red'], n, True, '#fff')),
        section('🏺 (Pressure Aging Vessel) PAV', C['pav']),
        row(f"{L['pavAgingHours']} hours, {L['pavPressureMPa']:.2f} MPa",
            td(spec['pavAgingTempLabel'].replace(' (', '('), C['yellow'], n, True), C['yellow']),
        row(f"≤{L['pavDsrMaxKPa']} kPa", td('⚙️ DSR G*·sin δ (Dynamic Shear Rheometer) intermediate Temp = '
                                             '[(Max. + Min.)/2] + 4', C['lblue'], n, center=False)),
        row('', per_column([c['pavDsrTempC'] for c in cols], C['lblue'])),
        row(f"S ≤ {L['bbrStiffnessMaxMPa']} MPa<br>m ≥ {L['bbrMValueMin']:.3f}",
            td('📊 BBR S (creep stiffness) &amp; m-value (Bending Beam Rheometer)', C['lav'], n, center=False)),
        row('', per_column([c['bbrTempC'] for c in cols], C['lav'])),
        section('📏 DTT (Direct Tension Tester)', C['dtt']),
        row(f"ε<sub>f</sub> ≥ {L['dttFailureStrainMinPct']:.2f}%", per_column([c['dttTempC'] for c in cols], C['white'])),
    ]
    widths = '<col style="width:24%">' + ''.join(f'<col style="width:{76 / n:.2f}%">' for _ in cols)
    notes = ''
    if not spec['inM320']:
        notes += (f"<p class='spec-note'><i>{spec['label']} is not listed in AASHTO M320 Table 1; the test "
                  f"temperatures above follow the same rules.</i></p>")
    return (f"<div class='spec-title'>{html.escape(spec['title'])}</div>"
            f"<table class='spec'><colgroup>{widths}</colgroup>{''.join(rows)}</table>"
            f"<p class='spec-note'><b>Note:</b> <i><b>{html.escape(NOTE)}</b></i></p>"
            f"<p class='spec-note' style='font-size:12px;color:#4b5563'>DTT: {html.escape(DTT_NOTE)}</p>{notes}")


NOTE = ('The highlighted column (Orange background) indicates the test temperatures corresponding to the project '
        'selected PG grade. All values must meet the specified criteria for the binder to be certified for this '
        'performance grade according to AASHTO M320/M332 standards.')
DTT_NOTE = ('under AASHTO M320 the direct tension test is needed only when the BBR creep stiffness S is between 300 '
            'and 600 MPa (with m ≥ 0.300).')
