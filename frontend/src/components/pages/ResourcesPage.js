import { useState } from 'react';
import { Pill } from '../Pill';
import { Modal } from '../Modal';
import { useToast } from '../../context/ToastContext';

export const ResourcesPage = ({ state, onUpdateResource }) => {
  const [selectedResource, setSelectedResource] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const { showToast } = useToast();

  const handleUpdateStatus = (e) => {
    e.preventDefault();
    if (selectedResource) {
      const newStatus = e.target.resourceStatus.value;
      onUpdateResource(selectedResource.id, {
        status: newStatus,
        incident: newStatus === "Available" ? "—" : selectedResource.incident
      });
      setShowModal(false);
      showToast(`${selectedResource.id} status updated.`);
    }
  };

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>Response units</h2>
          <span className="metric-note">Demo fleet · {state.resources.length} units</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Category</th>
                <th>Zone</th>
                <th>Status</th>
                <th>Assigned incident</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {state.resources.map(r => (
                <tr key={r.id}>
                  <td><b>{r.id}</b><br />{r.name}</td>
                  <td>{r.type}</td>
                  <td>{r.zone}</td>
                  <td><Pill>{r.status}</Pill></td>
                  <td>{r.incident}</td>
                  <td>
                    <button
                      className="table-action"
                      onClick={() => {
                        setSelectedResource(r);
                        setShowModal(true);
                      }}
                    >
                      Change status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid two-col" style={{ marginTop: '16px' }}>
        <section className="card">
          <h2 style={{ fontSize: '15px' }}>Fleet summary</h2>
          {['Ambulance', 'Fire truck', 'Police'].map(t => {
            const all = state.resources.filter(r => r.type === t);
            const available = all.filter(r => r.status === "Available").length;
            return (
              <div key={t} className="resource-line">
                <label>{t}</label>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${available / all.length * 100}%` }}></div>
                </div>
                <b>{available} free</b>
              </div>
            );
          })}
        </section>

        <section className="card">
          <h2 style={{ fontSize: '15px' }}>Operational note</h2>
          <p className="muted">
            Statuses in this prototype are local demo values. A connected dispatch backend should enforce authorization,
            audit changes, and validate real unit availability.
          </p>
        </section>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={`Update ${selectedResource?.id}`}>
        {selectedResource && (
          <form onSubmit={handleUpdateStatus}>
            <p className="muted">{selectedResource.name} · {selectedResource.type} · {selectedResource.zone} zone</p>
            <div className="form-field">
              <label>Unit status</label>
              <select name="resourceStatus" defaultValue={selectedResource.status}>
                {['Available', 'Dispatched', 'On scene', 'Unavailable', 'Monitoring'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save status</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
};
