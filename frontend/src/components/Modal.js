import { useEffect } from 'react';

export const Modal = ({ isOpen, onClose, children, title }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <div className={`modal-backdrop ${isOpen ? 'show' : ''}`} onClick={(e) => e.target.id === 'modalBackdrop' && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" id="modalBackdrop">
        {title && (
          <div className="modal-head">
            <h2>{title}</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        )}
        {children}
      </section>
    </div>
  );
};
