import { useState } from 'react';
import { Pill } from '../Pill';
import { Modal } from '../Modal';
import { ResourceAllocationModal } from '../ResourceAllocationModal';
import { useToast } from '../../context/ToastContext';

export const IncidentsPage = ({ state, onAddIncident, onUpdateIncident, onOpenDetails }) => {
  const [filter, setFilter] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const { showToast } = useToast();

  const list = state.incidents.filter(i =>
    (filter === 'All' || i.status === filter) &&
    (i.title + i.id + i.location + i.type).toLowerCase().includes(searchText.toLowerCase())
  );

  const handleCreateIncident = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const n = 205 + state.incidents.length;
    onAddIncident({
      id: `RQ-${n}`,
      title: f.get("title"),
      type: f.get("type"),
      severity: f.get("severity"),
      status: "Monitoring",
      location: f.get("location"),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      units: [],
      description: f.get("description"),
      lat: 30 + Math.random() * 35,
      lon: 25 + Math.random() * 50
    });
    setShowModal(false);
    showToast("Incident created in demo workspace.");
  };

  return (
    <>
      <section className="card">
        <div className="toolbar">
          <input
            className="field"
            id="incidentSearch"
            placeholder="Search incidents..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <select
            className="select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {['All', 'Monitoring', 'Dispatched', 'Responding', 'On scene', 'Resolved'].map(x => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>＋ Create incident</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID / Incident</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Location</th>
                <th>Units</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map(i => (
                <tr key={i.id}>
                  <td><b>{i.id}</b><br />{i.title}</td>
                  <td>{i.type}</td>
                  <td><Pill>{i.severity}</Pill></td>
                  <td><Pill>{i.status}</Pill></td>
                  <td>{i.location}</td>
                  <td>{i.units.join(", ") || "—"}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', flexDirection: 'column' }}>
                      <button
                        className="table-action"
                        onClick={() => onOpenDetails(i.id)}
                        style={{ fontSize: '10px', padding: '4px 6px' }}
                      >
                        Details
                      </button>
                      {i.status === 'Responding' || i.status === 'On scene' ? (
                        <button
                          className="table-action"
                          onClick={() => {
                            setSelectedIncident(i);
                            setShowResourceModal(true);
                          }}
                          style={{ fontSize: '10px', padding: '4px 6px', background: '#15574a' }}
                        >
                          Resources
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!list.length && (
                <tr>
                  <td colSpan="7" className="empty">No matching incidents.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create incident">
        <form onSubmit={handleCreateIncident}>
          <div className="form-grid">
            <div className="form-field full">
              <label>Incident title</label>
              <input name="title" required placeholder="e.g. Road collision at East 7th" />
            </div>
            <div className="form-field">
              <label>Incident type</label>
              <select name="type">
                <option>Traffic collision</option>
                <option>Fire / Smoke</option>
                <option>Medical</option>
                <option>Flood</option>
                <option>Road hazard</option>
                <option>Other</option>
              </select>
            </div>
            <div className="form-field">
              <label>Severity</label>
              <select name="severity">
                <option>Critical</option>
                <option>High</option>
                <option selected>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div className="form-field full">
              <label>Location</label>
              <input name="location" required placeholder="Street, area, district" />
            </div>
            <div className="form-field full">
              <label>Description</label>
              <textarea name="description" placeholder="What has been reported?"></textarea>
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create demo incident</button>
          </div>
        </form>
      </Modal>

      {selectedIncident && (
        <ResourceAllocationModal
          isOpen={showResourceModal}
          onClose={() => {
            setShowResourceModal(false);
            setSelectedIncident(null);
          }}
          incidentId={selectedIncident.id}
          resources={state.resources || []}
          onAllocateSuccess={() => {
            // Trigger a refresh of incidents if needed
          }}
        />
      )}
    </>
  );
};
