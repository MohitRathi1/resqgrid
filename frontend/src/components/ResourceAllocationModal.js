import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Pill } from './Pill';
import { useToast } from '../context/ToastContext';
import { useResourceAllocation } from '../hooks/useResourceAllocation';

export const ResourceAllocationModal = ({ isOpen, onClose, incidentId, resources, onAllocateSuccess }) => {
  const [selectedResources, setSelectedResources] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const { showToast } = useToast();
  const { allocateResources, deallocateResource, getAllocations, loading } = useResourceAllocation();

  useEffect(() => {
    if (isOpen && incidentId) {
      loadAllocations();
    }
  }, [isOpen, incidentId]);

  const loadAllocations = async () => {
    try {
      const data = await getAllocations(incidentId);
      setAllocations(data || []);
    } catch (err) {
      console.error('Error loading allocations:', err);
    }
  };

  const handleAddResource = () => {
    setSelectedResources([...selectedResources, { resource_id: '', quantity: 1 }]);
  };

  const handleRemoveResource = (index) => {
    setSelectedResources(selectedResources.filter((_, i) => i !== index));
  };

  const handleResourceChange = (index, field, value) => {
    const updated = [...selectedResources];
    updated[index][field] = value;
    setSelectedResources(updated);
  };

  const handleAllocate = async () => {
    if (selectedResources.length === 0) {
      showToast('Please select resources to allocate');
      return;
    }

    if (selectedResources.some(r => !r.resource_id || r.quantity < 1)) {
      showToast('Please fill in all resource fields');
      return;
    }

    try {
      await allocateResources(incidentId, selectedResources);
      showToast('Resources allocated successfully');
      setSelectedResources([]);
      await loadAllocations();
      if (onAllocateSuccess) onAllocateSuccess();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleDeallocate = async (resourceId) => {
    try {
      await deallocateResource(incidentId, resourceId);
      showToast('Resource deallocated successfully');
      await loadAllocations();
      if (onAllocateSuccess) onAllocateSuccess();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const getResourceName = (resourceId) => {
    const resource = resources.find(r => r.id === resourceId);
    return resource?.name || resourceId;
  };

  const getAvailableCount = (resourceId) => {
    const resource = resources.find(r => r.id === resourceId);
    return resource?.count || 0;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resource Allocation">
      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        {/* Currently Allocated Resources */}
        {allocations.length > 0 && (
          <>
            <h3 style={{ fontSize: '14px', marginTop: 0 }}>Currently Allocated</h3>
            <div style={{ marginBottom: '20px', borderBottom: '1px solid #2a3e55', paddingBottom: '15px' }}>
              {allocations.map((alloc) => (
                <div key={alloc.resource_id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: '1px solid #1a3044'
                }}>
                  <div>
                    <b>{alloc.resource_name}</b>
                    <div style={{ fontSize: '11px', color: '#8298b3' }}>
                      Quantity: {alloc.quantity}
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => handleDeallocate(alloc.resource_id)}
                    disabled={loading}
                  >
                    Release
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Add New Allocations */}
        <h3 style={{ fontSize: '14px', margin: '15px 0 10px' }}>Add Resources</h3>

        {selectedResources.map((sel, index) => (
          <div key={index} style={{
            padding: '12px',
            background: '#0e1b2d',
            borderRadius: '8px',
            marginBottom: '10px',
            border: '1px solid #2a3e55'
          }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: '#a4b7ce' }}>Resource</label>
                <select
                  value={sel.resource_id}
                  onChange={(e) => handleResourceChange(index, 'resource_id', e.target.value)}
                  className="field"
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="">Select resource...</option>
                  {resources
                    .filter(r => getAvailableCount(r.id) > 0)
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({getAvailableCount(r.id)} available)
                      </option>
                    ))}
                </select>
              </div>
              <div style={{ width: '100px' }}>
                <label style={{ fontSize: '11px', color: '#a4b7ce' }}>Qty</label>
                <input
                  type="number"
                  min="1"
                  value={sel.quantity}
                  onChange={(e) => handleResourceChange(index, 'quantity', parseInt(e.target.value) || 1)}
                  className="field"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
              <button
                className="btn btn-danger btn-small"
                onClick={() => handleRemoveResource(index)}
                style={{ alignSelf: 'flex-end' }}
              >
                Remove
              </button>
            </div>
            {sel.resource_id && (
              <div style={{ fontSize: '11px', color: '#8298b3' }}>
                Available: {getAvailableCount(sel.resource_id)}
              </div>
            )}
          </div>
        ))}

        <button
          className="btn btn-light"
          onClick={handleAddResource}
          style={{ width: '100%', marginBottom: '15px' }}
        >
          + Add Resource
        </button>

        <div className="modal-foot">
          <button className="btn btn-light" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleAllocate}
            disabled={loading || selectedResources.length === 0}
          >
            {loading ? 'Allocating...' : 'Allocate Resources'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
