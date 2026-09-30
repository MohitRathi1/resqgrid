export const ActivityPage = ({ state }) => {
  return (
    <section className="card">
      <div className="section-head">
        <h2>Recent activity</h2>
        <span className="pill green">{state.activity.length} entries</span>
      </div>
      {state.activity.map((a, i) => (
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
  );
};
