import { useState } from 'react';
import { Modal } from './Modal';
import { Pill } from './Pill';
import { useToast } from '../context/ToastContext';

export const IncidentDetailsModal = ({ incident, isOpen, onClose, onUpdate }) => {
  const [status, setStatus] = useState(incident?.status || '');
  const { showToast } = useToast();

  const handleSave = () => {
    if (incident) {
      onUpdate(incident.id, { status });
      onClose();
      showToast("Incident status updated.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={incident?.title}>
      {incident && (
        <>
          <p className="muted">{incident.id} · {incident.location}</p>
          <p>
            <Pill>{incident.severity}</Pill> &nbsp;
            <Pill>{incident.status}</Pill>
          </p>
          <p><b>Type:</b> {incident.type}</p>
          <p><b>Reported:</b> {incident.time}</p>
          <p>{incident.description}</p>
          <p><b>Assigned units:</b> {incident.units.join(", ") || "None"}</p>

          <div className="form-field">
            <label>Update status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {["Monitoring", "Dispatched", "Responding", "On scene", "Resolved"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="modal-foot">
            <button className="btn btn-light" onClick={onClose}>Close</button>
            <button className="btn btn-primary" onClick={handleSave}>Save status</button>
          </div>
        </>
      )}
    </Modal>
  );
};
