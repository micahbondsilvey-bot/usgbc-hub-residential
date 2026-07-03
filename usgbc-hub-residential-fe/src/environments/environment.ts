export const environment = {
  production: false,
  /**
   * Relative base URL — the Angular dev server proxies `/api` to the backend
   * (see proxy.conf.json). Using a relative path makes the app work behind the
   * dev-server proxy in both local Docker and GitHub Codespaces (forwarded
   * ports) without CORS or hard-coded hostnames.
   */
  apiBaseUrl: '/api/v1',
  /** When true, persist the access token in sessionStorage (Q4=B). */
  persistToken: true,
  tokenStorageKey: 'gbci.accessToken',
};
