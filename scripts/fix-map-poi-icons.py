from pathlib import Path

path = Path('frontend/src/components/MapView.jsx')
text = path.read_text()
anchor = "id: PLACE_POINT_LABEL_LAYER_ID"
start_search = text.find(anchor)
if start_search < 0:
    raise SystemExit('POI symbol layer not found')

start = text.find("        'icon-size': [", start_search)
end = text.find("        'icon-allow-overlap'", start)
if start < 0 or end < 0:
    raise SystemExit('POI icon-size block not found')

stable = """        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          12.5, 0.62,
          14, 0.72,
          17, 0.88
        ],
"""

path.write_text(text[:start] + stable + text[end:])
print('Restored stable MapLibre POI icon sizing')
