"""Runs the notebook's code cells on this PC (with a stand-in for Colab's upload button) and saves
what the notebook would show to colab/parity/notebook_preview_<case>.html.
Usage:  python colab/test_notebook_locally.py <data file> [case name] [key=value ...]
e.g.    python colab/test_notebook_locally.py parser/test/fixtures/private/TT_Meisso.csv meisso
"""
import json
import os
import sys
import types

os.environ.setdefault('MPLBACKEND', 'Agg')
HERE = os.path.dirname(os.path.abspath(__file__))
data_file = sys.argv[1]
case = sys.argv[2] if len(sys.argv) > 2 else 'case'
overrides = dict(a.split('=', 1) for a in sys.argv[3:])

shown = []
ipy_display = types.ModuleType('IPython.display')


class HTML:  # noqa: D101
    def __init__(self, data):
        self.data = data


ipy_display.HTML = HTML
ipy_display.display = lambda obj: shown.append(obj.data)
sys.modules['IPython.display'] = ipy_display

colab = types.ModuleType('google.colab')
colab.files = types.SimpleNamespace(
    upload=lambda: {os.path.basename(data_file): open(data_file, 'rb').read()},
    download=lambda name: shown.append(f'<p>[download {name}]</p>'))
sys.modules['google'] = types.ModuleType('google')
sys.modules['google.colab'] = colab

nb = json.load(open(os.path.join(HERE, 'Superpave_PG_Binder_Selector.ipynb'), encoding='utf-8'))
env = {}
for cell in [c for c in nb['cells'] if c['cell_type'] == 'code'][:4]:
    source = ''.join(cell['source'])
    for key, value in overrides.items():  # change a form field, like typing in the Colab form
        source = '\n'.join(f'{key} = {value} #@param' if line.startswith(f'{key} = ') else line
                           for line in source.splitlines())
    exec(compile(source, 'cell', 'exec'), env)

out = os.path.join(HERE, 'parity', f'notebook_preview_{case}.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write('<meta charset="utf-8"><body style="margin:24px">' + '\n'.join(shown) + '</body>')
print('Saved', out, '|', len(shown), 'outputs')
