const officialPaths = new Set(["/official", "/landing", "/website"]);
const appPaths = new Set(["/app"]);
const officialHosts = new Set(["skbaby.top", "www.skbaby.top"]);

export interface SiteRouteInput {
  pathname: string;
  hostname: string;
  buildTarget?: string;
}

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

export function shouldRenderOfficialSite({ pathname, hostname, buildTarget = "" }: SiteRouteInput): boolean {
  if (buildTarget === "mobile") return false;

  const normalizedPath = normalizePath(pathname);
  if (appPaths.has(normalizedPath)) return false;
  if (officialPaths.has(normalizedPath)) return true;

  return normalizedPath === "/" && officialHosts.has(hostname.toLowerCase());
}
