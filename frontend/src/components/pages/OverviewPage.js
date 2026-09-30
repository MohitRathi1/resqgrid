import { Pill } from '../Pill';

export const OverviewPage = ({ state, onNavigate }) => {
  const activeIncidents = state.incidents.filter(i => i.status !== "Resolved").length;
  const availableUnits = state.resources.filter(r => r.status === "Available").length;
  const pendingDecisions = state.decisions.filter(d => d.status === "Pending review").length;
  const criticalIncidents = state.incidents.filter(i => i.severity === "Critical" && i.status !== "Resolved").length;

  const StatCard = ({ label, value, sub, icon }) => (
    <article className="card">
      <div className="stat-top">
        {label}
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">{sub}</div>
    </article>
  );

  return (
    <div>
      <div className="grid stats">
        <StatCard label="Active incidents" value={activeIncidents} sub="Across the demo district" icon="◉" />
        <StatCard label="Available units" value={availableUnits} sub={`${state.resources.length} tracked response units`} icon="▤" />
        <StatCard label="Pending decisions" value={pendingDecisions} sub="Awaiting human review" icon="☷" />
        <StatCard label="Critical incidents" value={criticalIncidents} sub="Require active coordination" icon="⚑" />
      </div>

      <div className="grid two-col">
        <section className="card">
          <div className="section-head">
            <h2>Active incidents</h2>
            <button className="text-link" onClick={() => onNavigate('incidents')}>View all →</button>
          </div>
          {state.incidents.filter(i => i.status !== "Resolved").slice(0, 4).map(i => (
            <div key={i.id} className="incident-row">
              <span className={`severity-bar ${i.severity.toLowerCase()}`}></span>
              <div>
                <div className="row-title">{i.title} <span className="muted">· {i.id}</span></div>
                <div className="row-sub">{i.location} · {i.time} · {i.type}</div>
              </div>
              <div>
                <Pill>{i.severity}</Pill>
                <div style={{ marginTop: '5px', textAlign: 'right' }}>
                  <Pill>{i.status}</Pill>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="section-head">
            <h2>District response map</h2>
            <button className="text-link" onClick={() => onNavigate('map')}>Open map →</button>
          </div>
          <div className="mini-map">
            <div className="map-water"></div>
            <div className="map-road"></div>
            <span className="map-label" style={{ left: '12%', top: '17%' }}>NORTH DISTRICT</span>
            <span className="map-label" style={{ left: '37%', top: '42%' }}>CENTRAL</span>
            <span className="map-label" style={{ left: '70%', top: '76%' }}>CLOVER LAKES</span>
            {state.incidents.map(i => (
              <button key={i.id} className="map-marker" title={`${i.id} · ${i.title}`} style={{ left: `${i.lon}%`, top: `${i.lat}%` }}>
                {i.severity === "Critical" ? "!" : "•"}
              </button>
            ))}
            {state.resources.filter(r => r.status === "Available").map((r, j) => (
              <button key={r.id} className="map-marker resource" title={`${r.id} · Available`} style={{ left: `${15 + j * 8}%`, top: `${72 - j * 7}%` }}>
                +
              </button>
            ))}
          </div>
          <div className="map-legend">
            <span><i style={{ background: '#d74f4f' }}></i>Incident</span>
            <span><i style={{ background: '#148eaf' }}></i>Response unit</span>
            <span><i style={{ background: '#11a678' }}></i>Available</span>
          </div>
        </section>
      </div>

      <div className="grid two-col" style={{ marginTop: '16px' }}>
        <section className="card">
          <div className="section-head">
            <h2>Resource availability</h2>
            <button className="text-link" onClick={() => onNavigate('resources')}>Manage →</button>
          </div>
          {['Ambulance', 'Fire truck', 'Police'].map(type => {
            const all = state.resources.filter(r => r.type === type);
            const available = all.filter(r => r.status === "Available").length;
            return (
              <div key={type} className="resource-line">
                <label>{type}</label>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${all.length ? available / all.length * 100 : 0}%` }}></div>
                </div>
                <b>{available}/{all.length}</b>
              </div>
            );
          })}
        </section>

        <section className="card">
          <div className="section-head">
            <h2>Latest activity</h2>
            <button className="text-link" onClick={() => onNavigate('activity')}>View log →</button>
          </div>
          {state.activity.slice(0, 3).map((a, i) => (
            <div key={i} className="activity-item">
              <span className="activity-icon">↗</span>
              <div>
                {a.text}
                <div className="row-sub">{a.actor}</div>
              </div>
              <time>{a.time}</time>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};
