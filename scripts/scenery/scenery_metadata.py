"""Rendering metadata shared by the OSM importer and cached-map upgrade."""
def surface_metadata(tags, kind):
    if kind not in ('rail', 'water', 'waterway', 'road'):
        return {}
    out = {key: tags[key] for key in ('bridge', 'tunnel', 'covered', 'layer', 'intermittent') if key in tags}
    for source, target in [('railway', 'railwayType'), ('waterway', 'waterwayType'), ('water', 'waterType')]:
        if source in tags:
            out[target] = tags[source]
    if kind == 'rail':
        try: out['gauge'] = float(tags.get('gauge', '1435').split(';')[0]) / 1000
        except ValueError: out['gauge'] = 1.435
    if kind == 'waterway':
        default = {'river': 12, 'stream': 2, 'canal': 4, 'ditch': .7, 'drain': .5}.get(tags.get('waterway'), 1)
        try: width = float(tags.get('width', '').replace(' m', '').split(';')[0])
        except ValueError: width = default
        out['width'] = max(.3, min(100, width))
        out['widthEstimated'] = 'width' not in tags
    return out
