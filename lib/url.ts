export function appBaseUrl(req?: Request): string {
  const configured = process.env.BASE_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      return url.origin;
    } catch {
      throw new Error("BASE_URL must be a valid absolute URL.");
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("BASE_URL is required in production.");
  }

  if (req) {
    const host = req.headers.get("host");
    if (host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
      return `http://${host}`;
    }
  }

  return "http://localhost:3000";
}
