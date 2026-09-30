import { useState } from 'react';
import { Pill } from '../Pill';
import { useToast } from '../../context/ToastContext';

export const MapPage = ({ state, onOpenDetails }) => {
  const [mapFilters, setMapFilters] = useState({ incidents: true, resources: true });
  const [mapZoom, setMapZoom] = useState(1);
  const [selectedMapItem, setSelectedMapItem] = useState(null);
  const [searchText, setSearchText] = useState('');
  const { showToast } = useToast();

  const units = state.resources.map((r, j) => ({
    ...r,
    lat: 12 + (j * 19) % 72,
    lon: 10 + (j * 27) % 78
  }));

  const active = state.incidents.filter(i => i.status !== "Resolved");
  const selected = selectedMapItem
    ? active.find(i => i.id === selectedMapItem) || units.find(u => u.id === selectedMapItem)
    : null;

  const toggleFilter = (key) => {
    setMapFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReset = () => {
    setMapZoom(1);
    setSelectedMapItem(null);
    showToast('Map view reset.');
  };

  const handleZoom = (direction) => {
    const newZoom = direction === 'in'
      ? Math.min(1.35, mapZoom + 0.1)
      : Math.max(0.8, mapZoom - 0.1);
    setMapZoom(newZoom);
    showToast(`Illustrative map zoomed ${direction === 'in' ? 'in' : 'out'}.`);
  };

  return (
    <>
      <div className="map-toolbar">
        <div className="map-search">
          <span>⌕</span>
          <input
            id="mapSearch"
            placeholder="Search incident, unit or location…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div className="map-tools">
          <button
            className={`map-tool ${mapFilters.incidents ? 'active' : ''}`}
            onClick={() => toggleFilter('incidents')}
          >
            ◉ Incidents
          </button>
          <button
            className={`map-tool ${mapFilters.resources ? 'active' : ''}`}
            onClick={() => toggleFilter('resources')}
          >
            ✚ Units
          </button>
          <button className="map-tool" onClick={handleReset}>◎ Reset view</button>
        </div>
      </div>

      <div className="map-workspace">
        <section className="map-canvas-card">
          <div className="map-statusbar">
            <span><i className="live-pulse"></i> DEMO LIVE VIEW</span>
            <span>Central District <b>·</b> Illustrative coordinates</span>
          </div>

          <div className="map-stage" id="mapStage" style={{ '--map-zoom': mapZoom }}>
            <div className="map-gridlines"></div>
            <div className="map-park park-a"><span>RIVERSIDE PARK</span></div>
            <div className="map-park park-b"><span>CLOVER LAKES</span></div>
            <div className="map-waterway"></div>
            <div className="map-road road-a"></div>
            <div className="map-road road-b"></div>
            <div className="map-road road-c"></div>
            <div className="map-road road-d"></div>
            <div className="map-road road-e"></div>
            <span className="district-label dl-a">NORTH QUARTER</span>
            <span className="district-label dl-b">CENTRAL</span>
            <span className="district-label dl-c">INDUSTRIAL ESTATE</span>
            <span className="district-label dl-d">EAST DISTRICT</span>

            {mapFilters.incidents && active.map(i => (
              <button
                key={i.id}
                className={`map-pin-v4 ${i.severity.toLowerCase()} ${selectedMapItem === i.id ? 'selected' : ''}`}
                style={{ left: `${i.lon}%`, top: `${i.lat}%` }}
                onClick={() => setSelectedMapItem(i.id)}
                title={`${i.id} · ${i.title}`}
              >
                <span>{i.severity === 'Critical' ? '!' : '◉'}</span>
              </button>
            ))}

            {mapFilters.resources && units.map(u => (
              <button
                key={u.id}
                className={`unit-pin ${u.status === 'Available' ? 'free' : u.status === 'Unavailable' ? 'offline' : 'busy'} ${selectedMapItem === u.id ? 'selected' : ''}`}
                style={{ left: `${u.lon}%`, top: `${u.lat}%` }}
                onClick={() => setSelectedMapItem(u.id)}
                title={`${u.id} · ${u.status}`}
              >
                {u.type === 'Ambulance' ? '✚' : u.type === 'Fire truck' ? '♨' : '⬟'}
              </button>
            ))}

            <div className="map-zoom">
              <button onClick={() => handleZoom('in')}>＋</button>
              <button onClick={() => handleZoom('out')}>−</button>
            </div>

            <div className="map-scale">━━━ <span>Illustrative map · not for navigation</span></div>
          </div>

          <div className="map-legend-v4">
            <span><i className="legend-critical"></i> Critical</span>
            <span><i className="legend-high"></i> High / Medium</span>
            <span><i className="legend-unit"></i> Response unit</span>
            <span><i className="legend-free"></i> Available</span>
          </div>
        </section>

        <aside className="map-side">
          <div className="map-side-head">
            <div>
              <span className="eyebrow">DISTRICT SNAPSHOT</span>
              <h2>Operational layers</h2>
            </div>
            <Pill>Demo</Pill>
          </div>

          <div className="map-kpis">
            <div>
              <small>Active incidents</small>
              <b>{active.length}</b>
            </div>
            <div>
              <small>Available units</small>
              <b>{state.resources.filter(r => r.status === 'Available').length}</b>
            </div>
          </div>

          <div className="map-list-head">
            <b>Incidents in view</b>
            <span>{active.length} records</span>
          </div>

          <div className="map-incident-list">
            {active.map(i => (
              <button
                key={i.id}
                className={`map-list-item ${selectedMapItem === i.id ? 'chosen' : ''}`}
                onClick={() => setSelectedMapItem(i.id)}
              >
                <span className={`list-severity ${i.severity.toLowerCase()}`}></span>
                <span className="map-list-copy">
                  <b>{i.title}</b>
                  <small>{i.id} · {i.location}</small>
                </span>
                <span className="list-chevron">›</span>
              </button>
            ))}
          </div>

          <div className="map-selection" id="mapSelection">
            {selected ? (
              <>
                <div className="selection-top">
                  <span className="eyebrow">SELECTED {selected.id}</span>
                  <Pill>{selected.severity || selected.status}</Pill>
                </div>
                <h3>{selected.title || selected.name}</h3>
                <p>{selected.location || `${selected.zone} zone · ${selected.type}`}</p>
                <div className="selection-meta">
                  {selected.units ? (
                    <>
                      <span>Assigned units</span>
                      <b>{selected.units.join(', ') || 'Not assigned'}</b>
                    </>
                  ) : (
                    <>
                      <span>Unit status</span>
                      <b>{selected.status}</b>
                    </>
                  )}
                </div>
                <button
                  className="btn btn-primary btn-small"
                  onClick={() => onOpenDetails(selected.id)}
                >
                  {selected.units ? 'Open incident details' : 'Manage unit'} →
                </button>
              </>
            ) : (
              <div className="selection-empty">
                <span>⌖</span>
                <b>Select a map marker</b>
                <p>Choose an incident or response unit to inspect its operational details.</p>
              </div>
            )}
          </div>

          <p className="map-disclaimer">Demo visualization only. No GPS, live dispatch, or emergency service connection.</p>
        </aside>
      </div>
    </>
  );
};
