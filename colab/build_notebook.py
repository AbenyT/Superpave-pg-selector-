"""Builds colab/Superpave_PG_Binder_Selector.ipynb from pg_selector.py and notebook_display.py.
Run:  python colab/build_notebook.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'Superpave_PG_Binder_Selector.ipynb')


def read(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return f.read()


INTRO = """# Superpave PG Binder Selector
**Prepared by Abenezer Tilahun** · AASHTO M320 / M323 · SHRP (high) and LTPP (low) models · Reliability 98 %

Upload daily temperature data. The notebook gives:

1. **Annual 7-day consecutive maximum temperature**: table and graph
2. **Annual minimum temperature**: table and graph
3. **Monthly temperature heatmaps** (Tmax and Tmin)
4. **Final PG grade** and its **specification table**
5. **Binder type** (crude oil / high-quality crude oil / modifier required) and the **laboratory tests**

**How to use it**
1. Click **Runtime → Run all** (or press ▶ on each cell from top to bottom).
2. Fill in the **Step 1** form. Leave *latitude* empty to use the latitude in your file (e.g. the GEOGR2 column).
3. **Step 2** shows a **Choose Files** button: pick your CSV or Excel file.
4. The results appear under **Step 3**. To change ESAL, speed or the other inputs, edit Step 1, run Step 1 again, then run **Step 3** again. No need to upload again.

Files in many layouts are read automatically, for example *Name, element (TMPMAX/TMPMIN), Year, Month, 1…31* or *Date, Tmax, Tmin*.
The data checks and gap filling run in the background and are not shown.
"""

STEP1 = """#@title Step 1 – Project inputs { display-mode: "form" }
project_name = "My project" #@param {type:"string"}
#@markdown Leave empty to use the station name in the file.
station_name = "" #@param {type:"string"}
#@markdown Degrees, north positive. Leave empty to use the latitude in the file.
latitude = "" #@param {type:"string"}
design_esal_millions = 115.6 #@param {type:"number"}
design_speed_kmh = 100 #@param {type:"number"}
#@markdown AASHTO M323 says "consider +1 grade" for 10–30 million ESAL at more than 70 km/h, and for less than 0.3 million ESAL with standing traffic. Tick to add that grade.
add_one_grade_if_considered = False #@param {type:"boolean"}
print('✓ Inputs saved. Next: run Step 2.')
"""

STEP2 = """#@title Step 2 – Choose the daily temperature file (CSV or Excel) { display-mode: "form" }
#@markdown Outside Google Colab, type the full path of the file here instead:
file_path = "" #@param {type:"string"}
if file_path.strip():
    with open(file_path.strip(), 'rb') as _f:
        file_bytes = _f.read()
    file_name = os.path.basename(file_path.strip())
else:
    from google.colab import files as _colab_files
    _uploaded = _colab_files.upload()
    if _uploaded:
        file_name, file_bytes = list(_uploaded.items())[-1]
if 'file_bytes' in globals():
    print(f'✓ {file_name} loaded ({len(file_bytes) / 1024:.0f} KB). Next: run Step 3.')
"""

STEP3 = """#@title Step 3 – Results { display-mode: "form" }
def run_step3():
    global last_charts
    if 'file_bytes' not in globals():
        return show_error('Run Step 2 first and choose your temperature file.')
    if not str(project_name).strip():
        return show_error('Enter a project name.')
    try:
        parsed = read_temperature_file(file_bytes, file_name)
        lat_text = str(latitude).strip()
        if lat_text:
            lat = to_number(lat_text)
            if lat is None:
                raise AnalysisError('INVALID_INPUT', 'Latitude must be a number from -90 to 90°.')
        else:
            lat = parsed['station']['latitude']
            if lat is None:
                raise AnalysisError('INVALID_INPUT', 'Enter the latitude of the station in Step 1.')
        inputs = {'latitude': float(lat), 'designEsalMillions': float(design_esal_millions),
                  'designSpeedKmh': float(design_speed_kmh),
                  'acceptConsiderBump': bool(add_one_grade_if_considered)}
        climate, grade = analyse(parsed['observations'], inputs)
    except AnalysisError as e:
        return show_error(e.message)
    station = str(station_name).strip() or parsed['station']['name'] or ''
    show_header(str(project_name).strip(), station, inputs['latitude'], grade)
    chart_high = show_seven_day(climate, grade)
    chart_low = show_annual_min(climate, grade)
    show_heatmaps(climate)
    show_grade(grade, inputs, spec_table_html(grade['spec']))
    show_binder(grade)
    last_charts = {'7day_maximum.png': chart_high, 'annual_minimum.png': chart_low}

run_step3()
"""

DOWNLOAD_CHARTS = """#@title Optional – download the two graphs as PNG { display-mode: "form" }
download_graphs = False #@param {type:"boolean"}
if not download_graphs:
    print('Tick "download_graphs" and run this cell to download the two graphs.')
elif 'last_charts' not in globals():
    print('Run Step 3 first.')
else:
    import base64 as _b64
    from google.colab import files as _colab_files
    for _name, _data in last_charts.items():
        with open(_name, 'wb') as _f:
            _f.write(_b64.b64decode(_data))
        _colab_files.download(_name)
"""

TEMPLATE = """#@title Optional – download an Excel template { display-mode: "form" }
download_template = False #@param {type:"boolean"}
if not download_template:
    print('Tick "download_template" and run this cell to download an Excel template.')
else:
    exec(_TEMPLATE_CODE)
"""

TEMPLATE_CODE = """import openpyxl as _xl
from google.colab import files as _colab_files
_wb = _xl.Workbook()
_ws = _wb.active
_ws.title = 'Data'
_ws.append(['Name', 'Latitude', 'element', 'Year', 'Month'] + list(range(1, 32)))
_ex = [27, 28, 31.2, 29.2, 30.2, 30.2, 28.2, 28, 27.5, 28.4, 28.8, 27.5, 28.8, 27.8, 27.5, 30.5, 29.6, 29.7, 32.6,
       30, 29.2, 32, 31, 31, 29.5, 29, 29.5, 30.5, 33.8, 28.5, 27.5]
_ws.append(['My Station', 9.23, 'TMPMAX', 2024, 1] + _ex)
_ws.append(['My Station', 9.23, 'TMPMIN', 2024, 1] + [round(v - 15.5, 1) for v in _ex])
_help = _wb.create_sheet('Instructions')
for _line in ['Fill the sheet "Data": one row per station, element, year and month.',
              'element: TMPMAX for daily maximum, TMPMIN for daily minimum temperature (°C).',
              'Columns 1 … 31: the value of each day. Leave a cell empty (or write X) when there is no reading.',
              'Other layouts also work, e.g. Date | Tmax | Tmin (one row per day).',
              'Use at least 5 years (10 or more is better). A year is used only if 75% of its days have readings.']:
    _help.append([_line])
_wb.save('PG_temperature_template.xlsx')
_colab_files.download('PG_temperature_template.xlsx')
"""

# Put the template code inside the "else:" branch, indented.
TEMPLATE = TEMPLATE.replace('exec(_TEMPLATE_CODE)',
                            '\n'.join('    ' + line for line in TEMPLATE_CODE.splitlines()).lstrip())


def code_cell(source, form=True):
    cell = {'cell_type': 'code', 'execution_count': None, 'metadata': {}, 'outputs': [],
            'source': source.splitlines(keepends=True)}
    if form:
        cell['metadata']['cellView'] = 'form'
    return cell


def md_cell(source):
    return {'cell_type': 'markdown', 'metadata': {}, 'source': source.splitlines(keepends=True)}


LAB = json.load(open(os.path.join(HERE, '..', 'frontend', 'lib', 'lab-equipment.json'), encoding='utf-8'))['tests']

engine = ('#@title ⚙️ Load the calculation engine (run this first; no need to open it) { display-mode: "form" }\n'
          'import os\n\n' + read('pg_selector.py') + '\n\nLAB_EQUIPMENT = ' + repr(LAB) + '\n\n' + read('notebook_display.py') +
          "\nprint('✓ Engine ' + ENGINE_VERSION + ' loaded. Next: fill in Step 1.')\n")

notebook = {
    'nbformat': 4,
    'nbformat_minor': 0,
    'metadata': {
        'colab': {'provenance': [], 'name': 'Superpave_PG_Binder_Selector.ipynb'},
        'kernelspec': {'name': 'python3', 'display_name': 'Python 3'},
        'language_info': {'name': 'python'},
    },
    'cells': [
        md_cell(INTRO),
        code_cell(engine),
        code_cell(STEP1),
        code_cell(STEP2),
        code_cell(STEP3),
        md_cell('---\n**Optional:** download the graphs or an Excel template.'),
        code_cell(DOWNLOAD_CHARTS),
        code_cell(TEMPLATE),
    ],
}

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(notebook, f, ensure_ascii=False, indent=1)
print('Written', OUT)
