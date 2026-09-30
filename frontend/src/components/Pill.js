import { getPillClass } from '../utils';

export const Pill = ({ children, variant = 'default' }) => {
  const className = `pill ${getPillClass(children)}`.trim();
  return <span className={className}>{children}</span>;
};
