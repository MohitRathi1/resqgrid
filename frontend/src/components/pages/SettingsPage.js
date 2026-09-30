import { useState } from 'react';
import { Pill } from '../Pill';
import { useToast } from '../../context/ToastContext';

export const SettingsPage = ({ onReset }) => {
  const [approvalToggle, setApprovalToggle] = useState(true);
  const { showToast } = useToast();

  const handleReset = () => {
    if (window.confirm("Reset all local demo changes to the initial sample data?")) {
      window.location.reload();
    }
  };

  return (
    <section className="card">
      <h2 style={{ fontSize: '15px' }}>Workspace preferences</h2>

      <div className="settings-row">
        <div>
          <b>Demo environment</b>
          <p>Keep all changes local to this browser session.</p>
        </div>
        <Pill>Enabled</Pill>
      </div>

      <div className="settings-row">
        <div>
          <b>Confirmation before decision approval</b>
          <p>Human review remains required for simulated plan changes.</p>
        </div>
        <button
          className={`toggle ${approvalToggle ? 'on' : ''}`}
          onClick={() => {
            setApprovalToggle(!approvalToggle);
            showToast("Preference updated for this demo.");
          }}
        />
      </div>

      <div className="settings-row">
        <div>
          <b>Live service connection</b>
          <p>No real emergency systems or dispatch services are connected.</p>
        </div>
        <Pill>Disconnected</Pill>
      </div>

      <div className="settings-row">
        <div>
          <b>Reset demo data</b>
          <p>Restore the initial sample incidents, units, and decisions.</p>
        </div>
        <button className="btn btn-danger btn-small" onClick={handleReset}>Reset data</button>
      </div>
    </section>
  );
};
