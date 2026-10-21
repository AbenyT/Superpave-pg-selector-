"""Parity check, Python side: reads the same files with colab/pg_selector.py and compares every
number with the TypeScript results. Run after make_and_run_ts.js:
    python colab/parity/compare_python.py
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import pg_selector as pg  # noqa: E402


def python_results(name):
    with open(os.path.join(HERE, 'files', name), 'rb') as f:
        data = f.read()
    try:
        parsed = pg.read_temperature_file(data, name)
    except pg.AnalysisError as e:
        return {'error': e.message}
    runs = []
    for esal, speed, consider in [(115.6, 100, False), (20, 100, True), (0.1, 10, False), (5, 50, False)]:
        lat = parsed['station']['latitude']
        inputs = {'latitude': lat if lat is not None else 9.23, 'designEsalMillions': esal,
                  'designSpeedKmh': speed, 'acceptConsiderBump': consider}
        try:
            climate, grade = pg.analyse(parsed['observations'], inputs)
            runs.append({'climate': climate, 'grade': grade})
        except pg.AnalysisError as e:
            runs.append({'error': e.message})
    return {'parsed': parsed, 'runs': runs}


def compare(a, b, where, problems):
    if len(problems) > 20:
        return
    if isinstance(a, dict) and isinstance(b, dict):
        for k in set(a) | set(b):
            if k not in a or k not in b:
                problems.append(f'{where}.{k}: missing on one side')
                continue
            compare(a[k], b[k], f'{where}.{k}', problems)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            problems.append(f'{where}: length {len(a)} vs {len(b)}')
            return
        for i, (x, y) in enumerate(zip(a, b)):
            compare(x, y, f'{where}[{i}]', problems)
    elif isinstance(a, bool) or isinstance(b, bool):
        if a != b:
            problems.append(f'{where}: {a!r} vs {b!r}')
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)):
        if not math.isclose(a, b, rel_tol=1e-12, abs_tol=1e-9):
            problems.append(f'{where}: {a!r} vs {b!r}')
    elif a != b:
        problems.append(f'{where}: {a!r} vs {b!r}')


ts = json.load(open(os.path.join(HERE, 'ts_results.json'), encoding='utf-8'))
failures = 0
for name, expected in ts.items():
    got = python_results(name)
    problems = []
    compare(expected, got, name, problems)
    if expected.get('error'):
        summary = 'error: ' + expected['error'][:70]
    else:
        g = [r.get('grade', {}).get('finalGrade', {}).get('label', r.get('error', '')[:30]) for r in expected['runs']]
        summary = f"{len(expected['parsed']['observations'])} observations, grades {g}"
    print(('OK   ' if not problems else 'DIFF ') + f'{name:22s} {summary}')
    for p in problems[:10]:
        print('       ', p)
    failures += bool(problems)
print('\nAll files identical.' if failures == 0 else f'\n{failures} file(s) differ.')
sys.exit(1 if failures else 0)
