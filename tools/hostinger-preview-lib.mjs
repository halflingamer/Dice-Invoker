import path from "node:path";

const PRIVATE_MARKERS = [
  /DATABASE_URL\s*=/i,
  /AUTH_SECRET\s*=/i,
  /AUTH_GITHUB_SECRET\s*=/i,
  /RUN_SEED_SECRET\s*=/i,
  /postgres(?:ql)?:\/\/[^\s"']+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
];

export function createHostingerHtaccess() {
  return `DirectoryIndex index.html
Options -Indexes

<IfModule mod_headers.c>
  Header always set X-Frame-Options "DENY"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "no-referrer"
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; worker-src 'self' blob:"
</IfModule>

<FilesMatch "^\\.">
  Require all denied
</FilesMatch>
`;
}

export function assertSafePreviewFiles(files) {
  for (const file of files) {
    const normalizedPath = file.path.replaceAll("\\", "/").replace(/^\.\//, "");
    if (normalizedPath === "api" || normalizedPath.startsWith("api/")) {
      throw new Error(`Pacote contém rota de servidor: ${normalizedPath}`);
    }

    if (typeof file.content !== "string") continue;
    if (PRIVATE_MARKERS.some((pattern) => pattern.test(file.content))) {
      throw new Error(`Pacote contém possível segredo em: ${normalizedPath}`);
    }
  }
}

export function getNpmInvocation(platform, environment, nodeExecutable) {
  if (platform !== "win32") return { command: "npm", args: [] };
  if (!environment.npm_execpath) {
    throw new Error("npm_execpath não foi informado; execute pelo script npm build:hostinger");
  }
  return { command: nodeExecutable, args: [environment.npm_execpath] };
}

export function getPreviewBuildCleanupPaths(projectRoot) {
  return [path.join(projectRoot, ".next"), path.join(projectRoot, "out")];
}

export function getApiIsolationPaths(projectRoot) {
  return {
    source: path.join(projectRoot, "src", "app", "api"),
    backup: path.join(projectRoot, ".hostinger-api-backup"),
  };
}
