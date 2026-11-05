/**
 * Vite's development proxy forwards browser cookies and request bodies.
 * Only a local backend is trusted; never proxy real credentials to a LAN
 * host or remote server from the development server.
 */
export function validateDevelopmentProxyTarget(raw: string): string {
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    throw new Error("Proxy de desenvolvimento inválido: use a URL HTTP(S) de loopback.");
  }
  const loopback = target.hostname === "localhost" ||
    target.hostname === "127.0.0.1" || target.hostname === "[::1]";
  if (!loopback || !["http:", "https:"].includes(target.protocol) ||
      target.username !== "" || target.password !== "" ||
      target.pathname !== "/" || target.search !== "" || target.hash !== "") {
    throw new Error("Proxy de desenvolvimento bloqueado: permitido somente HTTP(S) de loopback, sem credenciais, parâmetros ou caminhos.");
  }
  return target.origin;
}
