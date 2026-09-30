import { useContext } from 'react';
import { ToastContext } from '../context/ToastContext';

export const ToastRegion = () => {
  const context = useContext(ToastContext);

  return (
    <div className="toast-region">
      {context?.toasts?.map(toast => (
        <div key={toast.id} className="toast">
          {toast.msg}
        </div>
      ))}
    </div>
  );
};
