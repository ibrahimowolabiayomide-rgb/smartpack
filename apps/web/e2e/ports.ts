/** Ports used by the Playwright web servers. Distinct from the development defaults (3000, 4000). */
export const PORTS = {
  web: 3100,
  api: 4100,
  /** Web server whose API address points at nothing. */
  webApiDown: 3101,
  /** Web server with API_URL unset. */
  webUnconfigured: 3102,
  /** Web server pointed at a real API whose database is unreachable. */
  webDbDown: 3103,
  /** Web server with company branding configured. */
  webBranded: 3104,
  apiDbDown: 4101,
  /** Nothing listens here. */
  closed: 4199,
} as const;

export const baseUrlFor = (port: number) => `http://127.0.0.1:${port}`;
