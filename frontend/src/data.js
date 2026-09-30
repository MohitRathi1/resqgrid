export const DEMO_DATA = {
  incidents: [
    { id: "RQ-204", title: "Multi-vehicle collision", type: "Traffic collision", severity: "Critical", status: "Responding", location: "East 7th & Canal Road", time: "14:32", units: ["AMB-02", "POL-04"], description: "Two vehicles involved; one lane blocked. Fire risk not reported.", lat: 35, lon: 58 },
    { id: "RQ-203", title: "Warehouse smoke report", type: "Fire / Smoke", severity: "High", status: "Dispatched", location: "Industrial Estate, Sector 4", time: "14:18", units: ["FIR-01", "POL-02"], description: "Smoke reported near loading bay. Verification in progress.", lat: 61, lon: 34 },
    { id: "RQ-202", title: "Medical assistance", type: "Medical", severity: "Medium", status: "On scene", location: "Clover Lakes Park", time: "13:56", units: ["AMB-01"], description: "Patient requires assessment. Family on scene.", lat: 47, lon: 62 },
    { id: "RQ-201", title: "Road obstruction", type: "Road hazard", severity: "Low", status: "Monitoring", location: "West Brighton Avenue", time: "13:21", units: ["POL-01"], description: "Fallen branch affecting one lane.", lat: 24, lon: 47 }
  ],
  resources: [
    { id: "AMB-01", type: "Ambulance", name: "Ambulance 01", status: "On scene", zone: "Central", incident: "RQ-202" },
    { id: "AMB-02", type: "Ambulance", name: "Ambulance 02", status: "Dispatched", zone: "East", incident: "RQ-204" },
    { id: "AMB-03", type: "Ambulance", name: "Ambulance 03", status: "Available", zone: "North", incident: "—" },
    { id: "AMB-04", type: "Ambulance", name: "Ambulance 04", status: "Available", zone: "West", incident: "—" },
    { id: "FIR-01", type: "Fire truck", name: "Fire Unit 01", status: "Dispatched", zone: "Industrial", incident: "RQ-203" },
    { id: "FIR-02", type: "Fire truck", name: "Fire Unit 02", status: "Available", zone: "South", incident: "—" },
    { id: "POL-01", type: "Police", name: "Police Unit 01", status: "Monitoring", zone: "West", incident: "RQ-201" },
    { id: "POL-02", type: "Police", name: "Police Unit 02", status: "Dispatched", zone: "Industrial", incident: "RQ-203" },
    { id: "POL-04", type: "Police", name: "Police Unit 04", status: "Dispatched", zone: "East", incident: "RQ-204" }
  ],
  activity: [
    { time: "14:32", text: "AMB-02 and POL-04 dispatched to RQ-204.", actor: "Dispatch system" },
    { time: "14:18", text: "Warehouse smoke report RQ-203 created.", actor: "Jane Cooper" },
    { time: "13:56", text: "AMB-01 arrived on scene at RQ-202.", actor: "Field unit" },
    { time: "13:21", text: "Road obstruction RQ-201 set to monitoring.", actor: "Jane Cooper" }
  ],
  decisions: [{ id: "DR-018", title: "Reassign North ambulance to East 7th", reason: "Reduce projected medical response delay for the critical collision.", status: "Pending review", scenario: "Current traffic and unit availability", changes: ["Reserve AMB-03 as backup for East zone", "Keep AMB-02 assigned to RQ-204"] }]
};
