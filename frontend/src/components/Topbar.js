import { useToast } from '../context/ToastContext';
import { Modal } from './Modal';
import { useState } from 'react';

export const Topbar = ({ currentPage }) => {
  const { showToast } = useToast();
  const [showNotifications, setShowNotifications] = useState(false);

  const pageLabels = {
    overview: "Overview",
    map: "Live map",
    incidents: "Incidents",
    resources: "Resources",
    simulator: "What-if simulator",
    decisions: "Decision review",
    activity: "Activity log",
    settings: "Settings"
  };

  const handleUserClick = () => {
    showToast("Signed in as demo operator Jane Cooper.");
  };

  return (
    <>
      <header className="topbar">
        <button className="mobile-menu" id="mobileMenu">☰</button>
        <div className="crumb">
          Operations <span>/</span> <b id="crumbPage">{pageLabels[currentPage]}</b>
        </div>
        <div className="top-actions">
          <span className="demo-pill"><i></i> DEMO ENVIRONMENT</span>
          <button className="icon-btn" id="notificationsBtn" aria-label="Notifications" onClick={() => setShowNotifications(true)}>
            ♧<b className="notify-dot"></b>
          </button>
          <button className="user-btn" onClick={handleUserClick}>
            <span className="avatar">JC</span>
            <b>Jane Cooper</b>
            <span>⌄</span>
          </button>
        </div>
      </header>

      <Modal isOpen={showNotifications} onClose={() => setShowNotifications(false)} title="Notifications">
        <div className="incident-row">
          <span className="severity-bar critical"></span>
          <div>
            <b>Decision awaiting review</b>
            <div className="row-sub">Pending proposal(s) in the demo workspace.</div>
          </div>
        </div>
        <div className="incident-row">
          <span className="severity-bar medium"></span>
          <div>
            <b>System status</b>
            <div className="row-sub">Demo mode active. No live emergency services connected.</div>
          </div>
        </div>
      </Modal>
    </>
  );
};
