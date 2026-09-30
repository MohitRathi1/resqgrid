import { useState, useMemo } from 'react';
import './styles.css';
import { useResQService } from './hooks/useResQService';
import { ToastProvider, useToast } from './context/ToastContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { ToastRegion } from './components/Toast';
import { OverviewPage } from './components/pages/OverviewPage';
import { MapPage } from './components/pages/MapPage';
import { IncidentsPage } from './components/pages/IncidentsPage';
import { ResourcesPage } from './components/pages/ResourcesPage';
import { SimulatorPage } from './components/pages/SimulatorPage';
import { DecisionsPage } from './components/pages/DecisionsPage';
import { ActivityPage } from './components/pages/ActivityPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { IncidentDetailsModal } from './components/IncidentDetailsModal';

function AppContent() {
  const { state, addIncident, updateIncident, addDecision, decide, updateResource } = useResQService();
  const { showToast } = useToast();
  const [currentPage, setCurrentPage] = useState('overview');
  const [selectedIncident, setSelectedIncident] = useState(null);

  const incidentCount = useMemo(() => state.incidents.filter(i => i.status !== "Resolved").length, [state.incidents]);
  const decisionCount = useMemo(() => state.decisions.filter(d => d.status === "Pending review").length, [state.decisions]);

  const getPageTitle = () => {
    const titles = {
      overview: ["Emergency overview", "A clear operational picture of incidents, response capacity, and decisions."],
      map: ["Live response map", "Explore demo incident locations and response unit positions."],
      incidents: ["Incident management", "Review, create, update, and resolve operational incidents."],
      resources: ["Resource coordination", "Track response units and their current availability."],
      simulator: ["What-if simulator", "Test a disruption, compare proposed allocations, and request human approval."],
      decisions: ["Decision review", "Human approval is required before simulated changes are accepted."],
      activity: ["Activity log", "A chronological record of actions in this demo workspace."],
      settings: ["Workspace settings", "Configure prototype preferences and display behavior."]
    };
    return titles[currentPage] || ["", ""];
  };

  const [pageTitle, pageSubtitle] = getPageTitle();

  const handleAddIncident = (incident) => {
    addIncident(incident);
    setCurrentPage('incidents');
    showToast("Incident created in demo workspace.");
  };

  const handleSubmitDecision = (simResult) => {
    const id = `DR-${String(19 + state.decisions.length).padStart(3, "0")}`;
    addDecision({
      id,
      title: "Review simulated resource reallocation",
      reason: "A scenario changed incident demand or resource availability.",
      status: "Pending review",
      scenario: `Factory fire: ${simResult.factoryFire ? "Yes" : "No"} · AMB-03 unavailable: ${simResult.ambulanceDown ? "Yes" : "No"} · East bridge blocked: ${simResult.roadBlock ? "Yes" : "No"}`,
      changes: simResult.reasons
    });
    setCurrentPage('decisions');
    showToast("Proposal sent to Decision Review. No units were dispatched.");
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage state={state} onNavigate={setCurrentPage} />;
      case 'map':
        return <MapPage state={state} onOpenDetails={(id) => setSelectedIncident(id)} />;
      case 'incidents':
        return <IncidentsPage state={state} onAddIncident={handleAddIncident} onUpdateIncident={updateIncident} onOpenDetails={setSelectedIncident} />;
      case 'resources':
        return <ResourcesPage state={state} onUpdateResource={updateResource} />;
      case 'simulator':
        return <SimulatorPage state={state} onSubmitDecision={handleSubmitDecision} />;
      case 'decisions':
        return <DecisionsPage state={state} onDecide={decide} />;
      case 'activity':
        return <ActivityPage state={state} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage state={state} onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} incidentCount={incidentCount} decisionCount={decisionCount} />
      <main className="main">
        <Topbar currentPage={currentPage} onRefresh={() => window.location.reload()} />
        <div className="page-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow">WEDNESDAY, SEPTEMBER 30, 2026　•　 CENTRAL DISTRICT</div>
              <h1 id="pageTitle">{pageTitle}</h1>
              <p id="pageSubtitle">{pageSubtitle}</p>
            </div>
            <div className="heading-actions">
              <button className="btn btn-light" onClick={() => { renderPage(); showToast("Demo view refreshed."); }}>↻ &nbsp; Refresh</button>
              <button className="btn btn-primary" onClick={() => setCurrentPage('incidents')}>＋ New incident</button>
            </div>
          </div>
          <div id="pageContent">
            {renderPage()}
          </div>
          <footer>
            <span>resQgrid · Emergency Response Coordination</span>
            <span><i className="status-dot"></i> Frontend demo · Not connected to live services</span>
          </footer>
        </div>
      </main>
      <IncidentDetailsModal
        incident={selectedIncident ? state.incidents.find(i => i.id === selectedIncident) : null}
        isOpen={!!selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onUpdate={updateIncident}
      />
      <ToastRegion />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
