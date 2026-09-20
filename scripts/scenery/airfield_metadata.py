"""Allowlisted public OSM tags used by airfield rendering."""
def airfield_metadata(tags):
    if not tags.get('aeroway') and tags.get('building') not in ('hangar', 'bunker'):
        return {}
    mapping = {'aeroway': 'aeroway', 'surface': 'surface', 'lit': 'lit',
               'building': 'buildingType', 'roof:shape': 'roofShape'}
    return {target: tags[source] for source, target in mapping.items() if source in tags}
