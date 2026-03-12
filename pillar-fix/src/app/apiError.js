export function getApiErrorMessage(err, fallback = 'Request failed') {
  const data = err?.response?.data;
  const detail = data?.detail ?? data?.message ?? data?.error;

  if (typeof detail === 'string' && detail.trim()) return detail;

  // FastAPI/Pydantic often returns a list of { loc, msg, type, ... }
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (!d) return null;
        if (typeof d === 'string') return d;
        if (typeof d === 'object') {
          const loc = Array.isArray(d.loc) ? d.loc.join('.') : d.loc;
          const msg = typeof d.msg === 'string' ? d.msg : null;
          if (loc && msg) return `${loc}: ${msg}`;
          if (msg) return msg;
          try { return JSON.stringify(d); } catch { return null; }
        }
        return String(d);
      })
      .filter(Boolean);

    return parts.length ? parts.join('; ') : fallback;
  }

  // Sometimes it's a single Pydantic error object: { loc, msg, type, ... }
  if (detail && typeof detail === 'object') {
    const loc = Array.isArray(detail.loc) ? detail.loc.join('.') : detail.loc;
    const msg =
      (typeof detail.msg === 'string' && detail.msg) ||
      (typeof detail.message === 'string' && detail.message) ||
      null;
    if (msg) return loc ? `${loc}: ${msg}` : msg;
    try { return JSON.stringify(detail); } catch { /* ignore */ }
  }

  return (typeof err?.message === 'string' && err.message) ? err.message : fallback;
}

