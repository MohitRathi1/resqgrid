import { useState, useCallback } from 'react';
import { DEMO_DATA } from '../data';

const clone = x => JSON.parse(JSON.stringify(x));

export const useResQService = () => {
  const [state, setState] = useState(clone(DEMO_DATA));

  const addIncident = useCallback((incident) => {
    setState(prev => {
      const newState = clone(prev);
      newState.incidents.unshift(incident);
      newState.activity.unshift({
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `${incident.id} created: ${incident.title}.`,
        actor: "Jane Cooper"
      });
      return newState;
    });
  }, []);

  const updateIncident = useCallback((id, patch) => {
    setState(prev => {
      const newState = clone(prev);
      const incident = newState.incidents.find(i => i.id === id);
      if (incident) Object.assign(incident, patch);
      return newState;
    });
  }, []);

  const addDecision = useCallback((d) => {
    setState(prev => {
      const newState = clone(prev);
      newState.decisions.unshift(d);
      newState.activity.unshift({
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `Decision ${d.id} submitted for human review.`,
        actor: "Simulation engine"
      });
      return newState;
    });
  }, []);

  const decide = useCallback((id, approved) => {
    setState(prev => {
      const newState = clone(prev);
      const decision = newState.decisions.find(x => x.id === id);
      if (decision) decision.status = approved ? "Approved" : "Rejected";
      newState.activity.unshift({
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `${id} ${approved ? "approved" : "rejected"} by Jane Cooper.`,
        actor: "Jane Cooper"
      });
      return newState;
    });
  }, []);

  const updateResource = useCallback((id, patch) => {
    setState(prev => {
      const newState = clone(prev);
      const resource = newState.resources.find(x => x.id === id);
      if (resource) Object.assign(resource, patch);
      return newState;
    });
  }, []);

  return {
    state,
    addIncident,
    updateIncident,
    addDecision,
    decide,
    updateResource
  };
};
