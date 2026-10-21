# Superpave PG Binder Selector: Python version of engine/ and parser/ (same rules, same messages).
# Prepared by Abenezer Tilahun. Engine version 1.3.0. Reliability is fixed at 98 %.
#
# Keep this file identical in behaviour to the TypeScript packages; colab/parity_check.py compares them.

import csv
import io
import math
import re
import unicodedata
from datetime import date, datetime, timedelta

ENGINE_VERSION = '1.3.0'  # 1.1.0: >= 75% days per year; 1.2.0: heatmap means, low T_air = mean; 1.3.0: binder type

# ───────────────────────────── errors ─────────────────────────────


class AnalysisError(Exception):
    """A problem with the data or inputs; str(error) is one plain sentence for the user."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def file_error(message):
    return AnalysisError('BAD_FILE', message)


# ───────────────────────────── dates ─────────────────────────────

_EPOCH = date(1970, 1, 1).toordinal()


def is_leap_year(y):
    return (y % 4 == 0 and y % 100 != 0) or y % 400 == 0


def days_in_month(y, m):
    return [31, 29 if is_leap_year(y) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]


def days_in_year(y):
    return 366 if is_leap_year(y) else 365


def _is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def is_valid_date(y, m, d):
    return (_is_int(y) and _is_int(m) and _is_int(d) and 1800 <= y <= 2200 and 1 <= m <= 12
            and 1 <= d <= days_in_month(y, m))


def to_day_number(y, m, d):
    return date(y, m, d).toordinal() - _EPOCH


def from_day_number(n):
    d = date.fromordinal(n + _EPOCH)
    return {'year': d.year, 'month': d.month, 'day': d.day}


def format_iso_date(n):
    return date.fromordinal(n + _EPOCH).isoformat()


# ───────────────────────────── config ─────────────────────────────

HIGH_GRADES = [46, 52, 58, 64, 70, 76, 82, 88]
LOW_GRADES = [-10, -16, -22, -28, -34, -40, -46]
SPEC_TABLE_LOW_GRADES = [-10, -16, -22, -28, -34, -40]
M320_LOW_GRADES = {
    46: [-34, -40, -46],
    52: [-10, -16, -22, -28, -34, -40, -46],
    58: [-16, -22, -28, -34, -40],
    64: [-10, -16, -22, -28, -34, -40],
    70: [-10, -16, -22, -28, -34, -40],
    76: [-10, -16, -22, -28, -34],
    82: [-10, -16, -22, -28, -34],
    88: [],
}
SPEC_LIMITS = {
    'flashPointMinC': 230, 'viscosityMaxPaS': 3, 'viscosityTestTempC': 135, 'originalDsrMinKPa': 1.0,
    'rtfoMassChangeMaxPct': 1.0, 'rtfoDsrMinKPa': 2.2, 'pavAgingHours': 20, 'pavPressureMPa': 2.1,
    'pavDsrMaxKPa': 5000, 'bbrStiffnessMaxMPa': 300, 'bbrMValueMin': 0.3, 'dttFailureStrainMinPct': 1.0,
}


def pav_aging_temperature_label(high):
    if high <= 52:
        return '90'
    if high <= 64:
        return '100'
    return '100 (110)'


def grade_label(high, low):
    return f'PG {high}{low}'


# AASHTO M323 Table 1: grade steps to add, or 'consider' (+1 only if accepted).
SPEED_CLASS_LIMITS = {'standingBelowKmh': 20, 'slowUpToKmh': 70}
SPEED_CLASS_LABELS = {'standing': 'Standing (< 20 km/h)', 'slow': 'Slow (20–70 km/h)', 'standard': 'Standard (> 70 km/h)'}
ESAL_CLASSES = [('lt0.3', '< 0.3', 0), ('0.3to3', '0.3 to < 3', 0.3), ('3to10', '3 to < 10', 3),
                ('10to30', '10 to < 30', 10), ('ge30', '≥ 30', 30)]
GRADE_BUMP_TABLE = {
    'lt0.3': {'standing': 'consider', 'slow': 0, 'standard': 0},
    '0.3to3': {'standing': 2, 'slow': 1, 'standard': 0},
    '3to10': {'standing': 2, 'slow': 1, 'standard': 0},
    '10to30': {'standing': 2, 'slow': 1, 'standard': 'consider'},
    'ge30': {'standing': 2, 'slow': 1, 'standard': 1},
}
GRADE_STEP_C = 6

# ───────────────────────────── cleaning and gap filling ─────────────────────────────

ELEMENTS = ('tmax', 'tmin')
TEMP_LIMITS = (-50, 60)
SHORT_GAP_MAX_DAYS = 3


def _finite(v):
    return v is not None and not isinstance(v, bool) and isinstance(v, (int, float)) and math.isfinite(v)


def clean_observations(observations):
    quality = {
        'rowsRead': len(observations), 'invalidDates': 0,
        'duplicates': {'tmax': 0, 'tmin': 0}, 'outOfRange': {'tmax': 0, 'tmin': 0}, 'tmaxBelowTmin': 0,
        'realDays': {'tmax': 0, 'tmin': 0}, 'interpolatedDays': {'tmax': 0, 'tmin': 0},
        'monthlyMeanDays': {'tmax': 0, 'tmin': 0},
    }
    by_day = {'tmax': {}, 'tmin': {}}
    for obs in observations:
        y, m, d = obs.get('year'), obs.get('month'), obs.get('day')
        if not is_valid_date(y, m, d):
            quality['invalidDates'] += 1
            continue
        dn = to_day_number(y, m, d)
        for el in ELEMENTS:
            if el not in obs:
                continue
            raw = obs[el]
            mp = by_day[el]
            if dn in mp:
                quality['duplicates'][el] += 1
                if mp[dn] is not None:
                    continue
            value = float(raw) if _finite(raw) else None
            if value is not None and (value < TEMP_LIMITS[0] or value > TEMP_LIMITS[1]):
                quality['outOfRange'][el] += 1
                value = None
            mp[dn] = value
    for dn, tmax in list(by_day['tmax'].items()):
        tmin = by_day['tmin'].get(dn)
        if tmax is not None and tmin is not None and tmax < tmin:
            by_day['tmax'][dn] = None
            by_day['tmin'][dn] = None
            quality['tmaxBelowTmin'] += 1
    series = {el: _build_series(el, by_day[el]) for el in ELEMENTS}
    for el in ELEMENTS:
        for kind in series[el]['kinds']:
            if kind == 'real':
                quality['realDays'][el] += 1
            elif kind == 'interpolated':
                quality['interpolatedDays'][el] += 1
            elif kind == 'monthlyMean':
                quality['monthlyMeanDays'][el] += 1
    return series, quality


def _build_series(element, mp):
    days = [d for d, v in mp.items() if v is not None]
    if not days:
        return {'element': element, 'startDay': 0, 'values': [], 'kinds': []}
    start, end = min(days), max(days)
    n = end - start + 1
    values = [None] * n
    kinds = ['missing'] * n
    for d, v in mp.items():
        if v is None:
            continue
        values[d - start] = v
        kinds[d - start] = 'real'
    _fill_gaps(start, values, kinds)
    return {'element': element, 'startDay': start, 'values': values, 'kinds': kinds}


def _monthly_means(start, values, kinds):
    s = [0.0] * 13
    c = [0] * 13
    for i, v in enumerate(values):
        if kinds[i] != 'real' or v is None:
            continue
        m = from_day_number(start + i)['month']
        s[m] += v
        c[m] += 1
    return [s[m] / c[m] if c[m] > 0 else None for m in range(13)]


def _fill_gaps(start, values, kinds):
    means = _monthly_means(start, values, kinds)
    i = 0
    n = len(values)
    while i < n:
        if kinds[i] != 'missing':
            i += 1
            continue
        j = i
        while j + 1 < n and kinds[j + 1] == 'missing':
            j += 1
        gap = j - i + 1
        if gap <= SHORT_GAP_MAX_DAYS:
            before, after = values[i - 1], values[j + 1]
            for k in range(i, j + 1):
                values[k] = before + ((after - before) * (k - i + 1)) / (gap + 1)
                kinds[k] = 'interpolated'
        else:
            for k in range(i, j + 1):
                mean = means[from_day_number(start + k)['month']]
                if mean is None:
                    continue
                values[k] = mean
                kinds[k] = 'monthlyMean'
        i = j + 1


def year_coverage(series):
    if not series['values']:
        return []
    real = {}
    for i, kind in enumerate(series['kinds']):
        if kind != 'real':
            continue
        y = from_day_number(series['startDay'] + i)['year']
        real[y] = real.get(y, 0) + 1
    first = from_day_number(series['startDay'])['year']
    last = from_day_number(series['startDay'] + len(series['values']) - 1)['year']
    return [{'year': y, 'realDays': real.get(y, 0), 'daysInYear': days_in_year(y),
             'realFraction': real.get(y, 0) / days_in_year(y)} for y in range(first, last + 1)]


# ───────────────────────────── yearly extremes ─────────────────────────────

WINDOW_DAYS = 7


def _usable_value(series, dn):
    i = dn - series['startDay']
    if i < 0 or i >= len(series['values']) or series['kinds'][i] not in ('real', 'interpolated'):
        return None
    return series['values'][i]


def seven_day_max_for_year(series, year):
    first, last = to_day_number(year, 1, 1), to_day_number(year, 12, 31)
    best = None
    start = first
    while start + WINDOW_DAYS - 1 <= last:
        days = []
        for d in range(start, start + WINDOW_DAYS):
            v = _usable_value(series, d)
            if v is None:
                break
            days.append(v)
        if len(days) == WINDOW_DAYS:
            total = 0.0
            for v in days:
                total += v
            average = total / WINDOW_DAYS
            if best is None or average > best['average']:
                best = {'year': year, 'startDate': format_iso_date(start),
                        'endDate': format_iso_date(start + WINDOW_DAYS - 1), 'days': days, 'average': average}
        start += 1
    return best


MIN_MONTH_FRACTION = 0.5


def monthly_means(series):
    """Monthly mean for every month of every year the series touches (heatmaps)."""
    if not series['values']:
        return []
    first = from_day_number(series['startDay'])['year']
    last = from_day_number(series['startDay'] + len(series['values']) - 1)['year']
    cells = []
    for year in range(first, last + 1):
        for month in range(1, 13):
            dim = days_in_month(year, month)
            start = to_day_number(year, month, 1)
            total, days = 0.0, 0
            for d in range(start, start + dim):
                v = _usable_value(series, d)
                if v is None:
                    continue
                total += v
                days += 1
            cells.append({'year': year, 'month': month,
                          'mean': total / days if days >= MIN_MONTH_FRACTION * dim else None,
                          'days': days, 'daysInMonth': dim})
    return cells


def annual_min_for_year(series, year):
    best = None
    for d in range(to_day_number(year, 1, 1), to_day_number(year, 12, 31) + 1):
        v = _usable_value(series, d)
        if v is None:
            continue
        if best is None or v < best['value']:
            best = {'year': year, 'date': format_iso_date(d), 'value': v}
    return best


# ───────────────────────────── statistics and design ─────────────────────────────

RELIABILITY_PERCENT = 98
Z_98 = 2.0537489106318225
LOW_TEMP_DEPTH_MM = 0


def mean(values):
    total = 0.0
    for v in values:
        total += v
    return total / len(values)


def sample_standard_deviation(values):
    m = mean(values)
    squares = 0.0
    for v in values:
        squares += (v - m) ** 2
    return math.sqrt(squares / (len(values) - 1))


def high_temperature_design(mean7, sd7, latitude):
    lat = abs(latitude)
    air = mean7 + Z_98 * sd7
    return {'designAirTemp': air,
            'pavementTemp20mm': (air - 0.00618 * lat ** 2 + 0.2289 * lat + 42.2) * 0.9545 - 17.78}


def low_temperature_design(mean_min, sd_min, latitude):
    lat = abs(latitude)
    base = -1.56 + 0.72 * mean_min - 0.004 * lat ** 2 + 6.26 * math.log10(LOW_TEMP_DEPTH_MM + 25)
    term = Z_98 * math.sqrt(4.4 + 0.52 * sd_min ** 2)
    return {'meanAirTemp': mean_min, 'designAirTemp': mean_min, 'baseTemp': base,
            'reliabilityTerm': term, 'pavementTemp': base - term}


def _clean_t(t):
    return math.floor(t * 1e6 + 0.5) / 1e6  # same as JavaScript Math.round(t * 1e6) / 1e6


def round_high_grade(t):
    t = _clean_t(t)
    for g in HIGH_GRADES:
        if g >= t:
            return {'grade': g, 'outOfRange': False}
    return {'grade': HIGH_GRADES[-1], 'outOfRange': True}


def round_low_grade(t):
    t = _clean_t(t)
    for g in LOW_GRADES:
        if g <= t:
            return {'grade': g, 'outOfRange': False}
    return {'grade': LOW_GRADES[-1], 'outOfRange': True}


def speed_class(kmh):
    if kmh < SPEED_CLASS_LIMITS['standingBelowKmh']:
        return 'standing'
    if kmh <= SPEED_CLASS_LIMITS['slowUpToKmh']:
        return 'slow'
    return 'standard'


def esal_class(esal):
    found = ESAL_CLASSES[0][0]
    for cid, _label, frm in ESAL_CLASSES:
        if esal >= frm:
            found = cid
    return found


def adjust_for_traffic(climate_high, esal, speed, accept_consider=False):
    sc, ec = speed_class(speed), esal_class(esal)
    cell = GRADE_BUMP_TABLE[ec][sc]
    consider = cell == 'consider'
    added = (1 if accept_consider else 0) if consider else cell
    wanted = climate_high + added * GRADE_STEP_C
    return {'speedClass': sc, 'esalClass': ec, 'cell': cell, 'isConsiderCase': consider, 'gradesAdded': added,
            'highGradeBefore': climate_high, 'highGradeAfter': min(wanted, HIGH_GRADES[-1]),
            'cappedAtMax': wanted > HIGH_GRADES[-1]}


def specification_table(high, low):
    listed = M320_LOW_GRADES.get(high, [])
    lows = list(SPEC_TABLE_LOW_GRADES)
    if low not in lows:
        lows.append(low)
    columns = [{'lowGrade': lg, 'pavDsrTempC': (high + lg) / 2 + 4, 'bbrTempC': lg + 10, 'dttTempC': lg + 10,
                'selected': lg == low, 'inM320': lg in listed} for lg in lows]
    label = grade_label(high, low)
    return {'title': f'Specification for Bitumen with Performance Grade {label}', 'label': label,
            'highGrade': high, 'lowGrade': low, 'columns': columns,
            'selectedIndex': next(i for i, c in enumerate(columns) if c['selected']),
            'originalDsrTempC': high, 'rtfoDsrTempC': high, 'pavAgingTempLabel': pav_aging_temperature_label(high),
            'inM320': low in listed, 'limits': SPEC_LIMITS}


# Binder type for crude oil blends (user's chart, PG 46-76; PG 82/88 from the notebook). 1 = crude oil,
# 2 = high-quality crude oil, 3 = modifier required. Rows: low grade -10 ... -40.
BINDER_TYPES = {
    1: ('Crude oil', 'Standard unmodified (neat) binder from ordinary crude oil'),
    2: ('High-quality crude oil', 'Unmodified binder from selected, high-quality crude sources'),
    3: ('Modifier required', 'Polymer-modified binder (e.g. SBS) is needed'),
}
BINDER_MATRIX_HIGH = [46, 52, 58, 64, 70, 76, 82, 88]
BINDER_MATRIX_LOW = [-10, -16, -22, -28, -34, -40]
BINDER_MATRIX = {46: [1, 1, 1, 1, 1, 2], 52: [1, 1, 1, 1, 2, 3], 58: [1, 1, 1, 2, 2, 3], 64: [1, 1, 1, 2, 3, 3],
                 70: [1, 1, 2, 3, 3, 3], 76: [1, 2, 3, 3, 3, 3], 82: [2, 3, 3, 3, 3, 3], 88: [3, 3, 3, 3, 3, 3]}
RULE_OF_90 = 90


def binder_type(high, low):
    row = BINDER_MATRIX.get(high)
    if row is not None and low in BINDER_MATRIX_LOW:
        code, from_chart = row[BINDER_MATRIX_LOW.index(low)], True
    else:
        from_chart = False
        code = 3 if high >= 82 or low <= -34 else 2 if high >= 70 or low <= -28 else 1
    total = high + abs(low)
    return {'code': code, 'name': BINDER_TYPES[code][0], 'description': BINDER_TYPES[code][1], 'fromChart': from_chart,
            'temperatureSum': total, 'ruleOf90SaysModified': total > RULE_OF_90}


SPEC_TABLE_NOTE = ('The highlighted column (orange background) indicates the test temperatures corresponding to the '
                   'project selected PG grade. All values must meet the specified criteria for the binder to be '
                   'certified for this performance grade according to AASHTO M320/M332 standards.')
DTT_FOOTNOTE = ('Under AASHTO M320, the direct tension test is needed only when the BBR creep stiffness S is '
                'between 300 and 600 MPa (with m ≥ 0.300).')

INPUT_LIMITS = {'latitude': (-90, 90), 'designEsalMillions': (0, 1000), 'designSpeedKmh': (0, 200)}


def validate_design_inputs(inputs):
    problems = []
    for field, name, unit in (('latitude', 'Latitude', '°'), ('designEsalMillions', 'Design ESAL', ' million'),
                              ('designSpeedKmh', 'Design speed', ' km/h')):
        v = inputs.get(field)
        lo, hi = INPUT_LIMITS[field]
        if not _finite(v) or v < lo or v > hi:
            problems.append(f'{name} must be a number from {lo} to {hi}{unit}.')
    return problems


MIN_REAL_FRACTION = 0.75
MIN_YEARS = 5


def _collect_years(series, pick):
    """Used years, plus every left-out year with its share of recorded days (shown greyed out)."""
    years, excluded_years, excluded = [], [], []
    for c in year_coverage(series):
        enough = c['realFraction'] >= MIN_REAL_FRACTION
        result = pick(series, c['year']) if enough else None
        if result is not None:
            years.append(result)
            continue
        excluded_years.append(c['year'])
        excluded.append({'year': c['year'], 'realFraction': c['realFraction'],
                         'reason': 'no-usable-period' if enough else 'too-few-days'})
    return {'years': years, 'excludedYears': excluded_years, 'excluded': excluded}


def _too_few(found, name):
    what = 'No year has' if found == 0 else 'Only 1 year has' if found == 1 else f'Only {found} years have'
    return (f'{what} enough {name} data. At least {MIN_YEARS} years with '
            f'{round(MIN_REAL_FRACTION * 100)}% of days recorded are needed.')


def analyse_climate(observations):
    series, quality = clean_observations(observations)
    if not series['tmax']['values'] and not series['tmin']['values']:
        raise AnalysisError('NO_DATA', 'The file has no temperature values. Check the columns and try again.')
    high = _collect_years(series['tmax'], seven_day_max_for_year)
    low = _collect_years(series['tmin'], annual_min_for_year)
    if len(high['years']) < MIN_YEARS:
        raise AnalysisError('TOO_FEW_YEARS_HIGH', _too_few(len(high['years']), 'maximum temperature (Tmax)'))
    if len(low['years']) < MIN_YEARS:
        raise AnalysisError('TOO_FEW_YEARS_LOW', _too_few(len(low['years']), 'minimum temperature (Tmin)'))
    monthly = {'tmax': monthly_means(series['tmax']), 'tmin': monthly_means(series['tmin'])}
    return {'engineVersion': ENGINE_VERSION, 'high': high, 'low': low, 'monthly': monthly, 'quality': quality}


def compute_grade(climate, inputs):
    problems = validate_design_inputs(inputs)
    if problems:
        raise AnalysisError('INVALID_INPUT', problems[0])
    hv = [y['average'] for y in climate['high']['years']]
    h_mean, h_sd = mean(hv), sample_standard_deviation(hv)
    high = high_temperature_design(h_mean, h_sd, inputs['latitude'])
    hg = round_high_grade(high['pavementTemp20mm'])
    hottest = climate['high']['years'][0]
    for y in climate['high']['years']:
        if y['average'] > hottest['average']:
            hottest = y
    lv = [y['value'] for y in climate['low']['years']]
    l_mean, l_sd = mean(lv), sample_standard_deviation(lv)
    low = low_temperature_design(l_mean, l_sd, inputs['latitude'])
    lg = round_low_grade(low['pavementTemp'])
    coldest = climate['low']['years'][0]
    for y in climate['low']['years']:
        if y['value'] < coldest['value']:
            coldest = y
    traffic = adjust_for_traffic(hg['grade'], inputs['designEsalMillions'], inputs['designSpeedKmh'],
                                 bool(inputs.get('acceptConsiderBump', False)))
    return {
        'engineVersion': ENGINE_VERSION, 'reliabilityPercent': RELIABILITY_PERCENT, 'z': Z_98,
        'high': {'yearsUsed': len(hv), 'mean': h_mean, 'sd': h_sd, 'designAirTemp': high['designAirTemp'],
                 'pavementTemp': high['pavementTemp20mm'], 'grade': hg['grade'], 'outOfRange': hg['outOfRange'],
                 'hottestYear': hottest['year']},
        'low': {'yearsUsed': len(lv), 'mean': l_mean, 'sd': l_sd, 'meanAirTemp': low['meanAirTemp'],
                'designAirTemp': low['designAirTemp'], 'baseTemp': low['baseTemp'],
                'reliabilityTerm': low['reliabilityTerm'], 'pavementTemp': low['pavementTemp'],
                'grade': lg['grade'], 'outOfRange': lg['outOfRange'], 'coldestYear': coldest['year']},
        'climateGrade': {'high': hg['grade'], 'low': lg['grade'], 'label': grade_label(hg['grade'], lg['grade'])},
        'traffic': traffic,
        'finalGrade': {'high': traffic['highGradeAfter'], 'low': lg['grade'],
                       'label': grade_label(traffic['highGradeAfter'], lg['grade'])},
        'binderType': binder_type(traffic['highGradeAfter'], lg['grade']),
        'spec': specification_table(traffic['highGradeAfter'], lg['grade']),
    }


def analyse(observations, inputs):
    climate = analyse_climate(observations)
    return climate, compute_grade(climate, inputs)


# ═════════════════════════════ file reading (parser) ═════════════════════════════


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def is_blank(cell):
    if cell is None:
        return True
    if isinstance(cell, float) and math.isnan(cell):
        return True
    return isinstance(cell, str) and cell.strip() == ''


def _js_number_text(v):
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def cell_text(cell):
    if isinstance(cell, str):
        return cell.strip()
    if isinstance(cell, bool):
        return 'true' if cell else 'false'
    if _num(cell) and math.isfinite(cell):
        return _js_number_text(cell)
    return ''


_PARENS = re.compile(r'\(.*?\)|\[.*?\]')
_UNITS = re.compile(r'°\s*[cf]\b|\bdeg(?:rees?)?\s*[cf]\b|\bcelsius\b|\bfahrenheit\b', re.ASCII)
_COMBINING = re.compile('[̀-ͯ]')


def text_key(text):
    s = unicodedata.normalize('NFKD', text.lower())
    s = _COMBINING.sub('', s)
    s = _PARENS.sub(' ', s)
    s = _UNITS.sub(' ', s)
    return re.sub(r'[^a-z0-9]', '', s)


_FAHRENHEIT = re.compile(r'°\s*f\b|\(\s*f\s*\)|\[\s*f\s*\]|\bdeg(?:rees?)?\s*f\b|fahrenheit', re.I | re.ASCII)


def mentions_fahrenheit(text):
    return bool(_FAHRENHEIT.search(text))


_NUMBER = re.compile(r'^([+-]?(?:[0-9]+(?:[.,][0-9]*)?|[.,][0-9]+))\s*(?:°\s*[cf]?|[*#a-z]{0,2})$', re.I)


def to_number(cell):
    if _num(cell):
        return float(cell) if math.isfinite(cell) else None
    if not isinstance(cell, str):
        return None
    s = cell.strip().replace('−', '-').replace('–', '-')
    m = _NUMBER.match(s)
    if not m:
        return None
    n = float(m.group(1).replace(',', '.'))
    return n if math.isfinite(n) else None


def to_integer(cell):
    n = to_number(cell)
    return int(n) if n is not None and float(n).is_integer() else None


ROLE_NAMES = {
    'station': ['name', 'station', 'stationname', 'stn', 'stnname', 'site', 'sitename', 'stationid', 'location'],
    'latitude': ['lat', 'latitude', 'lati', 'latdeg', 'geogr2'],
    'longitude': ['lon', 'long', 'longitude', 'lng', 'longdeg', 'geogr1'],
    'elevation': ['elevation', 'elev', 'alt', 'altitude', 'height', 'elevationm'],
    'element': ['element', 'elem', 'elementcode', 'elementname', 'variable', 'var', 'parameter', 'param',
                'measurement', 'type'],
    'year': ['year', 'yr', 'yyyy', 'years', 'yy'],
    'month': ['month', 'mon', 'mm', 'mo', 'months', 'mth'],
    'day': ['day', 'dd', 'dy', 'dayofmonth'],
    'date': ['date', 'dates', 'datetime', 'obsdate', 'observationdate', 'timestamp', 'dateyyyymmdd', 'ddmmyyyy',
             'yyyymmdd', 'dailydate'],
    'value': ['value', 'values', 'val', 'temperature', 'temp', 'reading', 'obs', 'observation', 'data', 'amount'],
}
ELEMENT_NAMES = {
    'tmax': ['tmax', 'tmpmax', 'tempmax', 'maxtemp', 'maxtemperature', 'maximumtemperature', 'maximumtemp', 'maxtmp',
             'tx', 'max', 'maximum', 'tmaximum', 'airtempmax', 'temperaturemax', 'high', 'hightemp', 'dailymax',
             'dailymaximum', 'maxairtemperature', 'maximumairtemperature', 'tmx'],
    'tmin': ['tmin', 'tmpmin', 'tempmin', 'mintemp', 'mintemperature', 'minimumtemperature', 'minimumtemp', 'mintmp',
             'tn', 'min', 'minimum', 'tminimum', 'airtempmin', 'temperaturemin', 'low', 'lowtemp', 'dailymin',
             'dailyminimum', 'minairtemperature', 'minimumairtemperature', 'tmn'],
}
MONTH_NAMES = [['jan', 'january'], ['feb', 'february'], ['mar', 'march'], ['apr', 'april'], ['may'],
               ['jun', 'june'], ['jul', 'july'], ['aug', 'august'], ['sep', 'sept', 'september'],
               ['oct', 'october'], ['nov', 'november'], ['dec', 'december']]


def month_from_name(text):
    key = text_key(text)
    for i, names in enumerate(MONTH_NAMES):
        if key in names:
            return i + 1
    return None


def element_from_text(text):
    key = text_key(text)
    if not key:
        return None
    if key in ELEMENT_NAMES['tmax']:
        return 'tmax'
    if key in ELEMENT_NAMES['tmin']:
        return 'tmin'
    if 'minute' in key:
        return None
    temp_word = 'temp' in key or 'tmp' in key or key.startswith('t')
    is_max, is_min = 'max' in key, 'min' in key
    if temp_word and is_max and not is_min:
        return 'tmax'
    if temp_word and is_min and not is_max:
        return 'tmin'
    return None


def element_from_name(text):
    whole = element_from_text(text)
    if whole:
        return whole
    for word in re.split(r'[^A-Za-z0-9]+', text):
        e = element_from_text(word)
        if e:
            return e
    return None


_DAY_HEADER = re.compile(r'^(?:day|d)?0?([1-9]|[12][0-9]|3[01])(?:st|nd|rd|th)?$')


def classify_header(cell):
    if _num(cell):
        if math.isfinite(cell) and float(cell).is_integer() and 1 <= cell <= 31:
            return {'dayOfMonth': int(cell), 'fahrenheit': False}
        return {'fahrenheit': False}
    text = cell_text(cell)
    fahrenheit = mentions_fahrenheit(text)
    key = text_key(text)
    if not key:
        return {'fahrenheit': fahrenheit}
    for role, names in ROLE_NAMES.items():
        if key in names:
            return {'role': role, 'fahrenheit': fahrenheit}
    m = _DAY_HEADER.match(key)
    if m:
        return {'dayOfMonth': int(m.group(1)), 'fahrenheit': fahrenheit}
    month = month_from_name(text)
    if month is not None:
        return {'monthOfYear': month, 'fahrenheit': fahrenheit}
    el = element_from_text(text)
    if el:
        return {'role': el, 'fahrenheit': fahrenheit}
    return {'fahrenheit': fahrenheit}


# ── dates in cells ──

def excel_serial_to_date(serial, date1904=False):
    s = math.floor(serial)
    if date1904:
        s += 1462
    if s < 1 or s > 2958465:
        return None
    if s == 60:
        return {'year': 1900, 'month': 2, 'day': 29}
    return from_day_number(s - 25569 if s > 60 else s - 25568)


_TIME_SUFFIX = re.compile(r'(?:[T\s]+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2}(?:\.[0-9]+)?)?\s*(?:am|pm)?)$', re.I)
_ISO = re.compile(r'^([0-9]{4})[-/.]([0-9]{1,2})[-/.]([0-9]{1,2})$')
_COMPACT = re.compile(r'^([0-9]{4})([0-9]{2})([0-9]{2})$')
_NUMERIC_DMY = re.compile(r'^([0-9]{1,2})[-/.]([0-9]{1,2})[-/.]([0-9]{2}|[0-9]{4})$')


def _full_year_text(t):
    y = int(t)
    if len(t) == 4:
        return y
    return 2000 + y if y < 50 else 1900 + y


def _from_compact_number(n):
    if not float(n).is_integer() or n < 18000101 or n > 22001231:
        return None
    n = int(n)
    return {'year': n // 10000, 'month': (n // 100) % 100, 'day': n % 100}


def detect_date_order(cells):
    day_first = month_first = False
    for cell in cells:
        if not isinstance(cell, str):
            continue
        m = _NUMERIC_DMY.match(_TIME_SUFFIX.sub('', cell.strip()))
        if not m:
            continue
        if int(m.group(1)) > 12:
            day_first = True
        if int(m.group(2)) > 12:
            month_first = True
    return 'mdy' if month_first and not day_first else 'dmy'


def parse_date_cell(cell, order='dmy', date1904=False):
    if isinstance(cell, (datetime, date)):
        return {'year': cell.year, 'month': cell.month, 'day': cell.day}
    if _num(cell):
        if not math.isfinite(cell):
            return None
        return _from_compact_number(cell) or excel_serial_to_date(cell, date1904)
    if not isinstance(cell, str):
        return None
    s = _TIME_SUFFIX.sub('', cell.strip()).strip()
    m = _ISO.match(s)
    if m:
        return {'year': int(m.group(1)), 'month': int(m.group(2)), 'day': int(m.group(3))}
    m = _COMPACT.match(s)
    if m:
        return {'year': int(m.group(1)), 'month': int(m.group(2)), 'day': int(m.group(3))}
    m = _NUMERIC_DMY.match(s)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), _full_year_text(m.group(3))
        return {'year': y, 'month': a, 'day': b} if order == 'mdy' else {'year': y, 'month': b, 'day': a}
    return _parse_word_date(s)


def _parse_word_date(s):
    tokens = [t for t in re.split(r'[\s,\-/.]+', s) if t]
    if len(tokens) != 3:
        return None
    month = year = day = None
    for t in tokens:
        name = month_from_name(t) if re.fullmatch(r'[a-z]+', t, re.I) else None
        if name is not None and month is None:
            month = name
        elif re.fullmatch(r'[0-9]{4}', t) and year is None:
            year = int(t)
        elif re.fullmatch(r'[0-9]{1,2}', t) and day is None:
            day = int(t)
        else:
            return None
    return {'year': year, 'month': month, 'day': day} if None not in (month, year, day) else None


def parse_year_month_cell(cell, date1904=False):
    if isinstance(cell, str):
        s = cell.strip()
        m = re.match(r'^([0-9]{4})[-/.]([0-9]{1,2})$', s)
        if m:
            return {'year': int(m.group(1)), 'month': int(m.group(2))}
        m = re.match(r'^([0-9]{1,2})[-/.]([0-9]{4})$', s)
        if m:
            return {'year': int(m.group(2)), 'month': int(m.group(1))}
        tokens = [t for t in re.split(r'[\s,\-/.]+', s) if t]
        if len(tokens) == 2:
            a, b = tokens
            month = month_from_name(b if re.match(r'^[0-9]', a) else a)
            year = int(a) if re.fullmatch(r'[0-9]{4}', a) else int(b) if re.fullmatch(r'[0-9]{4}', b) else None
            if month is not None and year is not None:
                return {'year': year, 'month': month}
    d = parse_date_cell(cell, 'dmy', date1904)
    return {'year': d['year'], 'month': d['month']} if d else None


def looks_like_date(cell):
    if isinstance(cell, (datetime, date)):
        return True
    if _num(cell):
        return math.isfinite(cell) and _from_compact_number(cell) is not None
    if not isinstance(cell, str):
        return False
    s = _TIME_SUFFIX.sub('', cell.strip()).strip()
    return bool(_ISO.match(s) or _COMPACT.match(s) or _NUMERIC_DMY.match(s)) or _parse_word_date(s) is not None


# ── layouts ──

def _at(row, idx):
    if row is None or idx is None or idx < 0 or idx >= len(row):
        return None
    return row[idx]


def _map_columns(row):
    m = {'roles': {}, 'days': {}, 'months': {}, 'fahrenheit': set()}
    for col, cell in enumerate(row):
        info = classify_header(cell)
        if info.get('fahrenheit'):
            m['fahrenheit'].add(col)
        role = info.get('role')
        if role and role not in m['roles']:
            m['roles'][role] = col
        d = info.get('dayOfMonth')
        if d and d not in m['days']:
            m['days'][d] = col
        mo = info.get('monthOfYear')
        if mo and mo not in m['months']:
            m['months'][mo] = col
    return m


def _has_date(m):
    r = m['roles']
    return 'date' in r or ('year' in r and 'month' in r and 'day' in r)


def _layout_of(m):
    r = m['roles']
    if len(m['days']) >= 28 and (('year' in r and 'month' in r) or 'date' in r or 'month' in r):
        return 'wide-days'
    if len(m['months']) == 12 and 'year' in r and 'day' in r:
        return 'wide-months'
    if _has_date(m) and ('tmax' in r or 'tmin' in r):
        return 'long'
    if _has_date(m) and 'element' in r and 'value' in r:
        return 'long-element'
    return None


def _score(m):
    return len(m['roles']) + len(m['days']) + len(m['months'])


def _find_blocks(rows):
    found = []
    for i, row in enumerate(rows[:200_000]):
        if not row or all(is_blank(c) for c in row):
            continue
        m = _map_columns(row)
        layout = _layout_of(m)
        if layout:
            found.append({'row': i, 'map': m, 'layout': layout})
    if not found:
        return []
    best = found[0]
    for f in found[1:]:
        if _score(f['map']) > _score(best['map']):
            best = f
    same = [f for f in found if f['layout'] == best['layout']]
    return [{'headerRow': f['row'], 'endRow': same[i + 1]['row'] if i + 1 < len(same) else len(rows),
             'map': f['map'], 'layout': f['layout']} for i, f in enumerate(same)]


def _title_text_above(rows, header_row, stop_row):
    parts = []
    for i in range(header_row - 1, max(stop_row, header_row - 5) - 1, -1):
        for cell in rows[i] or []:
            if isinstance(cell, str) and cell.strip():
                parts.append(cell.strip())
    return ' '.join(parts)


def _element_from_title(text):
    for part in re.split(r'\s{2,}|[|;]', text):
        e = element_from_text(part)
        if e:
            return e
    return element_from_text(text)


def _valid_coordinate(n, mx):
    return n if n is not None and abs(n) <= mx else None


def _metadata_above(rows, header_row, station):
    for i in range(header_row):
        row = rows[i] or []
        for c, cell in enumerate(row):
            text = cell_text(cell)
            if not text:
                continue
            label, value = text, _at(row, c + 1)
            colon = text.find(':')
            if colon > 0:
                label = text[:colon]
                rest = text[colon + 1:].strip()
                if rest:
                    value = rest
            role = classify_header(label).get('role')
            if role == 'station' and station['name'] is None and cell_text(value):
                station['name'] = cell_text(value)
            if role == 'latitude' and station['latitude'] is None:
                station['latitude'] = _valid_coordinate(to_number(value), 90)
            if role == 'longitude' and station['longitude'] is None:
                station['longitude'] = _valid_coordinate(to_number(value), 180)
            if role == 'elevation' and station['elevation'] is None:
                station['elevation'] = to_number(value)


def _full_year(n):
    if n is None:
        return None
    if 0 <= n < 100:
        return 2000 + n if n < 50 else 1900 + n
    return n


def _read_station_columns(row, m, out):
    r = m['roles']
    if 'station' in r:
        name = cell_text(_at(row, r['station']))
        if name:
            out['stationNames'].setdefault(name, None)
    st = out['station']
    if 'latitude' in r and st['latitude'] is None:
        st['latitude'] = _valid_coordinate(to_number(_at(row, r['latitude'])), 90)
    if 'longitude' in r and st['longitude'] is None:
        st['longitude'] = _valid_coordinate(to_number(_at(row, r['longitude'])), 180)
    if 'elevation' in r and st['elevation'] is None:
        st['elevation'] = to_number(_at(row, r['elevation']))


def _row_element(row, m, fallback, out):
    if 'element' not in m['roles']:
        return fallback
    text = cell_text(_at(row, m['roles']['element']))
    el = element_from_text(text)
    if not el and text:
        out['unknownElements'].setdefault(text, None)
    return el


def _row_date(row, m, order, date1904):
    r = m['roles']
    if 'date' in r:
        d = parse_date_cell(_at(row, r['date']), order, date1904)
        if d:
            return d
    if 'year' in r and 'month' in r and 'day' in r:
        y = _full_year(to_integer(_at(row, r['year'])))
        mo = to_integer(_at(row, r['month']))
        d = to_integer(_at(row, r['day']))
        if None not in (y, mo, d):
            return {'year': y, 'month': mo, 'day': d}
    return None


def _extract_block(rows, block, context, date1904, out):
    m, r, layout = block['map'], block['map']['roles'], block['layout']
    data_rows = rows[block['headerRow'] + 1:block['endRow']]
    order = detect_date_order([_at(row, r['date']) for row in data_rows]) if 'date' in r else 'dmy'
    if 'date' in r and layout != 'wide-days':
        out['dateOrder'] = order

    def convert(v, col):
        if v is None or not (col in m['fahrenheit'] or context['fahrenheit']):
            return v
        out['fahrenheit'] = True
        return ((v - 32) * 5) / 9

    for row in data_rows:
        if not row or all(is_blank(c) for c in row):
            continue
        used = False
        if layout == 'wide-days':
            year = _full_year(to_integer(_at(row, r['year']))) if 'year' in r else None
            month = to_integer(_at(row, r['month'])) if 'month' in r else None
            if year is None or month is None:
                ym_col = r['date'] if 'date' in r else r.get('month')
                ym = parse_year_month_cell(_at(row, ym_col), date1904)
                if ym:
                    year, month = ym['year'], ym['month']
            el = _row_element(row, m, context['element'], out)
            if year is not None and month is not None and 1 <= month <= 12 and el:
                for day, col in m['days'].items():
                    raw = _at(row, col)
                    if is_blank(raw):
                        continue
                    out['observations'].append({'year': year, 'month': month, 'day': day,
                                                el: convert(to_number(raw), col)})
                used = True
        elif layout == 'wide-months':
            year = _full_year(to_integer(_at(row, r['year'])))
            day = to_integer(_at(row, r['day']))
            el = _row_element(row, m, context['element'], out)
            if year is not None and day is not None and 1 <= day <= 31 and el:
                for month, col in m['months'].items():
                    raw = _at(row, col)
                    if is_blank(raw):
                        continue
                    out['observations'].append({'year': year, 'month': month, 'day': day,
                                                el: convert(to_number(raw), col)})
                used = True
        elif layout == 'long':
            d = _row_date(row, m, order, date1904)
            if d:
                obs = dict(d)
                if 'tmax' in r:
                    obs['tmax'] = convert(to_number(_at(row, r['tmax'])), r['tmax'])
                if 'tmin' in r:
                    obs['tmin'] = convert(to_number(_at(row, r['tmin'])), r['tmin'])
                out['observations'].append(obs)
                used = True
        elif layout == 'long-element':
            d = _row_date(row, m, order, date1904)
            el = _row_element(row, m, None, out)
            if d and el:
                obs = dict(d)
                obs[el] = convert(to_number(_at(row, r['value'])), r['value'])
                out['observations'].append(obs)
                used = True
        if used:
            out['rowsUsed'] += 1
            _read_station_columns(row, m, out)
        else:
            out['rowsSkipped'] += 1


def _extract_by_content(sheet, date1904, out):
    rows = sheet['rows']
    width = max((len(r) for r in rows if r), default=0)
    columns = [[_at(r, c) for r in rows] for c in range(width)]

    def non_blank(cells):
        return [c for c in cells if not is_blank(c)]

    date_col = None
    for c, cells in enumerate(columns):
        filled = non_blank(cells)
        if len(filled) >= 10 and sum(1 for x in filled if looks_like_date(x)) >= 0.8 * len(filled):
            date_col = c
            break
    if date_col is None:
        return False
    temps = []
    for c, cells in enumerate(columns):
        if c == date_col:
            continue
        filled = non_blank(cells)
        numbers = [n for n in (to_number(x) for x in filled) if n is not None]
        if len(numbers) < 10 or len(numbers) < 0.8 * len(filled):
            continue
        if sum(1 for n in numbers if -50 <= n <= 60) < 0.9 * len(numbers):
            continue
        if all(float(n).is_integer() for n in numbers) and all(1 <= n <= 31 for n in numbers):
            continue
        total = 0.0
        for n in numbers:
            total += n
        temps.append({'c': c, 'mean': total / len(numbers)})
    if len(temps) != 2:
        raise file_error(
            'The file has dates but the Tmax and Tmin columns could not be found. Name the columns Tmax and Tmin.'
            if len(temps) < 2 else
            'The file has more than two number columns. Name the temperature columns Tmax and Tmin.')
    tmax, tmin = (temps[0], temps[1]) if temps[0]['mean'] >= temps[1]['mean'] else (temps[1], temps[0])
    order = detect_date_order(columns[date_col])
    out['dateOrder'] = order
    for row in rows:
        d = parse_date_cell(_at(row, date_col), order, date1904) if row else None
        if not d:
            if row and not all(is_blank(c) for c in row):
                out['rowsSkipped'] += 1
            continue
        out['observations'].append({**d, 'tmax': to_number(_at(row, tmax['c'])),
                                    'tmin': to_number(_at(row, tmin['c']))})
        out['rowsUsed'] += 1
    return True


def extract_dataset(sheets, file_name='', date1904=False):
    out = {'observations': [], 'stationNames': {}, 'rowsUsed': 0, 'rowsSkipped': 0, 'fahrenheit': False,
           'dateOrder': None, 'unknownElements': {},
           'station': {'name': None, 'latitude': None, 'longitude': None, 'elevation': None}}
    sheets_used, layout, missing_element = [], None, False
    for sheet in sheets:
        rows = sheet['rows']
        blocks = _find_blocks(rows)
        if not blocks:
            continue
        _metadata_above(rows, blocks[0]['headerRow'], out['station'])
        before = len(out['observations'])
        for i, block in enumerate(blocks):
            title = _title_text_above(rows, block['headerRow'], 0 if i == 0 else blocks[i - 1]['headerRow'] + 1)
            needs = block['layout'] in ('wide-days', 'wide-months') and 'element' not in block['map']['roles']
            el = (_element_from_title(title) or element_from_name(sheet['name'])
                  or element_from_name(re.sub(r'\.[^.]+$', '', file_name))) if needs else None
            if needs and not el:
                missing_element = True
            _extract_block(rows, block, {'element': el, 'fahrenheit': mentions_fahrenheit(title)}, date1904, out)
        if len(out['observations']) > before:
            sheets_used.append(sheet['name'])
            layout = layout or blocks[0]['layout']

    if not out['observations'] and not missing_element and not out['unknownElements']:
        for sheet in sheets:
            if _extract_by_content(sheet, date1904, out):
                sheets_used.append(sheet['name'])
                layout = 'auto-columns'
                break

    if not out['observations']:
        if missing_element:
            raise file_error('Could not tell whether the values are maximum or minimum temperatures. Add an element '
                             'column (TMPMAX / TMPMIN) or name the sheet Tmax / Tmin.')
        if out['unknownElements']:
            found = ', '.join(list(out['unknownElements'])[:5])
            raise file_error(f'No TMPMAX or TMPMIN rows were found in the element column (found: {found}).')
        raise file_error('The temperature data could not be found in this file. It needs dates (or Year and Month) '
                         'with Tmax and Tmin values. Download the template to see an example.')
    names = list(out['stationNames'])
    if len(names) > 1:
        raise file_error(f'The file has more than one station ({", ".join(names[:3])}). Upload one station per file.')
    if out['station']['name'] is None and names:
        out['station']['name'] = names[0]

    def has_value(el):
        return any(o.get(el) is not None for o in out['observations'])

    if not has_value('tmax') and not has_value('tmin'):
        raise file_error('The file has no temperature values.')
    if not has_value('tmax'):
        raise file_error('Only minimum temperatures (Tmin) were found. The file also needs maximum temperatures (Tmax).')
    if not has_value('tmin'):
        raise file_error('Only maximum temperatures (Tmax) were found. The file also needs minimum temperatures (Tmin).')
    return {'layout': layout or 'auto-columns', 'station': out['station'], 'observations': out['observations'],
            'details': {'sheetsUsed': sheets_used, 'rowsUsed': out['rowsUsed'], 'rowsSkipped': out['rowsSkipped'],
                        'convertedFromFahrenheit': out['fahrenheit'], 'dateOrder': out['dateOrder']}}


# ── reading the file bytes ──

MAX_FILE_BYTES = 10 * 1024 * 1024
_MAX_ROWS, _MAX_COLS = 200_000, 200


def _decode_text(data):
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        text = data.decode('cp1252', errors='replace')
    return text[1:] if text.startswith('﻿') else text


def _guess_delimiter(text):
    lines = [ln for ln in text.splitlines() if ln.strip()][:20]
    best, best_score = ',', -1.0
    for d in (',', '\t', '|', ';'):
        counts = [len(r) for r in csv.reader(lines, delimiter=d)]
        if not counts:
            continue
        mode = max(set(counts), key=counts.count)
        if mode < 2:
            continue
        score = mode * counts.count(mode) / len(counts)
        if score > best_score:
            best, best_score = d, score
    return best


def _read_csv(data, file_name):
    text = _decode_text(data)
    if '\x00' in text:
        raise file_error('The file could not be read. Upload a CSV or Excel file.')
    rows = [r[:_MAX_COLS] for r in csv.reader(io.StringIO(text), delimiter=_guess_delimiter(text))]
    return [{'name': file_name, 'rows': rows[:_MAX_ROWS]}]


def _clean_excel_value(v):
    if isinstance(v, float) and math.isnan(v):
        return None
    if hasattr(v, 'to_pydatetime'):
        return v.to_pydatetime()
    return v


def _read_workbook(data, file_name):
    if data[:4] == b'PK\x03\x04':
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
            sheets = []
            for ws in wb.worksheets:
                rows = []
                for row in ws.iter_rows(values_only=True, max_row=_MAX_ROWS):
                    rows.append([_clean_excel_value(v) for v in row[:_MAX_COLS]])
                sheets.append({'name': ws.title, 'rows': rows})
            return sheets
        except Exception:
            pass  # maybe an .ods file: try pandas below
    try:
        import pandas as pd
        frames = pd.read_excel(io.BytesIO(data), sheet_name=None, header=None)
    except Exception:
        raise file_error('The file could not be read. Upload a CSV or Excel file.')
    return [{'name': str(name), 'rows': [[_clean_excel_value(v) for v in r[:_MAX_COLS]]
                                         for r in df.itertuples(index=False, name=None)][:_MAX_ROWS]}
            for name, df in frames.items()]


def read_temperature_file(data, file_name):
    if len(data) == 0:
        raise file_error('The file is empty.')
    if len(data) > MAX_FILE_BYTES:
        raise file_error('The file is larger than 10 MB. Upload one station at a time.')
    if data[:4] == b'PK\x03\x04' or data[:4] == b'\xd0\xcf\x11\xe0':
        return extract_dataset(_read_workbook(data, file_name), file_name)
    return extract_dataset(_read_csv(data, file_name), file_name)
