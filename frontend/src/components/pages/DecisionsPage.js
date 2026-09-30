import { Pill } from '../Pill';
import { useToast } from '../../context/ToastContext';

export const DecisionsPage = ({ state, onDecide }) => {
  const { showToast } = useToast();

  const handleDecision = (id, approved) => {
    if (approved && !window.confirm("Approve this demo proposal? This records a review only.")) return;
    onDecide(id, approved);
    showToast(`Proposal ${approved ? "approved" : "rejected"} in demo review.`);
  };

  return (
    <>
      {state.decisions.map(d => (
        <article key={d.id} className="card decision-card" style={{ marginBottom: '12px' }}>
          <div className="section-head">
            <span className="eyebrow">{d.id} · {d.scenario}</span>
            <Pill>{d.status}</Pill>
          </div>
          <h3>{d.title}</h3>
          <p className="muted">{d.reason}</p>
          <ul className="change-list">
            {d.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          {d.status === "Pending review" ? (
            <div className="decision-actions">
              <button className="btn btn-primary" onClick={() => handleDecision(d.id, true)}>
                ✓ Approve proposal
              </button>
              <button className="btn btn-danger" onClick={() => handleDecision(d.id, false)}>
                ✕ Reject
              </button>
            </div>
          ) : (
            <p className="metric-note">Reviewed by Jane Cooper · No live dispatch action performed.</p>
          )}
        </article>
      ))}
      {!state.decisions.length && (
        <div className="card empty">No decisions yet. Run a what-if simulation to create a proposal.</div>
      )}
    </>
  );
};
