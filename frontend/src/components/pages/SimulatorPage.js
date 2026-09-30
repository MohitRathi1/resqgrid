import { useState } from 'react';
import { Pill } from '../Pill';
import { useToast } from '../../context/ToastContext';

export const SimulatorPage = ({ state, onSubmitDecision }) => {
  const [factoryFire, setFactoryFire] = useState(true);
  const [ambulanceDown, setAmbulanceDown] = useState(true);
  const [roadBlock, setRoadBlock] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const { showToast } = useToast();

  const runSimulation = () => {
    const before = [
      { label: "Critical collision", value: "AMB-02 + POL-04" },
      { label: "Warehouse smoke", value: "FIR-01 + POL-02" },
      { label: "Available ambulances", value: "AMB-03, AMB-04" },
      { label: "New factory fire", value: "Not reported" }
    ];

    const after = [
      { label: "Critical collision", value: "AMB-02 + POL-04" },
      { label: "Warehouse smoke", value: "FIR-01 + POL-02" },
      { label: "Available ambulances", value: ambulanceDown ? "AMB-04" : "AMB-03, AMB-04" },
      { label: "New factory fire", value: factoryFire ? "FIR-02 + POL-01; medical backup AMB-04" : "Not added" }
    ];

    const reasons = [];
    if (factoryFire) reasons.push("A new critical factory-fire incident is added to the scenario.");
    if (ambulanceDown) reasons.push("AMB-03 is removed from the available pool.");
    if (factoryFire && ambulanceDown) reasons.push("AMB-04 is shown as the remaining ambulance reserve.");
    if (roadBlock) reasons.push("East bridge closure adds a travel-time constraint.");
    if (!factoryFire && !ambulanceDown && !roadBlock) reasons.push("No disruptions selected; current allocations remain unchanged.");

    setSimResult({ before, after, reasons, factoryFire, ambulanceDown, roadBlock });
    showToast("Scenario recomputed. Review the proposal before submitting.");
  };

  return (
    <div className="grid sim-layout">
      <section className="card">
        <div className="section-head">
          <h2>Scenario builder</h2>
          <Pill>Sandbox</Pill>
        </div>
        <p className="muted">Select disruptions to test how the response plan changes. Nothing is dispatched from this prototype.</p>

        <label className="scenario">
          <input type="checkbox" checked={factoryFire} onChange={(e) => setFactoryFire(e.target.checked)} />
          <span>
            <b>🔥 New critical factory fire</b>
            <span>Industrial Estate, Sector 4 · Multiple calls reported</span>
          </span>
        </label>
        <label className="scenario">
          <input type="checkbox" checked={ambulanceDown} onChange={(e) => setAmbulanceDown(e.target.checked)} />
          <span>
            <b>🚑 AMB-03 unavailable</b>
            <span>Mechanical issue · Remove from available pool</span>
          </span>
        </label>
        <label className="scenario">
          <input type="checkbox" checked={roadBlock} onChange={(e) => setRoadBlock(e.target.checked)} />
          <span>
            <b>🚧 East bridge blocked</b>
            <span>Increase travel-time estimate for East zone</span>
          </span>
        </label>

        <button className="btn btn-primary" onClick={runSimulation} style={{ width: '100%', marginTop: '8px' }}>
          ⟳ Recompute response plan
        </button>
        <p className="metric-note" style={{ marginTop: '12px' }}>Demo decision logic uses fixed scenario rules.</p>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Response plan comparison</h2>
          <Pill>{simResult ? 'amber' : 'blue'}>
            {simResult ? "Simulation ready" : "Awaiting simulation"}
          </Pill>
        </div>

        {simResult ? (
          <>
            <div className="comparison">
              <div className="compare-panel">
                <h3>BEFORE · Current plan</h3>
                {simResult.before.map((x, i) => (
                  <div key={i} className="allocation">
                    <span>{x.label}</span>
                    <strong>{x.value}</strong>
                  </div>
                ))}
              </div>
              <div className="compare-panel">
                <h3>AFTER · Proposed plan</h3>
                {simResult.after.map((x, i) => (
                  <div key={i} className="allocation">
                    <span>{x.label}</span>
                    <strong>{x.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <h3 style={{ fontSize: '13px', margin: '18px 0 6px' }}>Why the plan changed</h3>
            <ul className="change-list">
              {simResult.reasons.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>

            <div className="decision-actions">
              <button className="btn btn-primary" onClick={() => onSubmitDecision(simResult)}>
                Submit for human approval
              </button>
              <button className="btn btn-light" onClick={() => setSimResult(null)}>Reset</button>
            </div>
          </>
        ) : (
          <div className="empty">
            <div style={{ fontSize: '30px' }}>⟳</div>
            <b>Run a scenario to see the impact</b>
            <p>You'll get a side-by-side plan and a written explanation before requesting approval.</p>
          </div>
        )}
      </section>
    </div>
  );
};
