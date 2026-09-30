export const esc = (s) => {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(s ?? "").replace(/[&<>"']/g, c => map[c]);
};

export const getPillClass = (s) => {
  if (s === "Critical" || s === "Rejected") return "red";
  if (s === "High" || s === "Pending review") return "amber";
  if (s === "Available" || s === "Approved" || s === "Resolved") return "green";
  if (s === "Dispatched") return "blue";
  return "";
};

export const getSeverityClass = (severity) => {
  return severity.toLowerCase();
};
