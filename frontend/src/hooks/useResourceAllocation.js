import { useState, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export const useResourceAllocation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const allocateResources = useCallback(async (incidentId, resources) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/incidents/${incidentId}/allocate-resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resources })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to allocate resources');
      }

      return await response.json();
    } finally {
      setLoading(false);
    }
  }, []);

  const deallocateResource = useCallback(async (incidentId, resourceId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/incidents/${incidentId}/deallocate-resources/${resourceId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deallocate resource');
      }

      return await response.json();
    } finally {
      setLoading(false);
    }
  }, []);

  const getAllocations = useCallback(async (incidentId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/incidents/${incidentId}/allocations`);

      if (!response.ok) {
        throw new Error('Failed to fetch allocations');
      }

      return await response.json();
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    allocateResources,
    deallocateResource,
    getAllocations
  };
};
