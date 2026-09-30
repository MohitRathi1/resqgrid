import { useState } from 'react';

export const Sidebar = ({ currentPage, onPageChange, incidentCount, decisionCount }) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { id: "overview", label: "Overview", icon: "▦" },
    { id: "map", label: "Live map", icon: "⌖" },
    { id: "incidents", label: "Incidents", icon: "◉", badge: incidentCount },
    { id: "resources", label: "Resources", icon: "▤" },
    { id: "simulator", label: "What-if simulator", icon: "⟳", isNew: true },
    { id: "decisions", label: "Decision review", icon: "☷", badge: decisionCount },
    { id: "activity", label: "Activity log", icon: "◷" }
  ];

  const handleNavClick = (pageId) => {
    onPageChange(pageId);
    setIsOpen(false);
  };

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <i></i><i></i><i></i><i></i>
          </span>
          <b>resQ<span>grid</span></b>
        </div>
        <div className="workspace-label">COMMAND WORKSPACE</div>
        <button className="district-select">✦ &nbsp; Central District <span>⌄</span></button>

        <nav id="mainNav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              data-page={item.id}
              onClick={() => handleNavClick(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
              {item.badge ? <em>{item.badge}</em> : null}
              {item.isNew ? <small>NEW</small> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <div><span className="status-dot"></span> Demo systems online</div>
          <p>Local prototype state. No emergency services connected.</p>
          <hr />
          <small>Environment <b>DEMO</b></small>
        </div>

        <button
          className="nav-item settings-link"
          onClick={() => handleNavClick("settings")}
        >
          <span>⚙</span> Settings
        </button>

        <div className="sidebar-foot">resQgrid · Response coordination</div>
      </aside>
    </>
  );
};
