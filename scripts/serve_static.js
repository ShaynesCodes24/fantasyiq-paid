const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "dist");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"],
]);

function redirect(response, location) {
  response.writeHead(302, { Location: location });
  response.end();
}

function resolveStaticFile(pathname) {
  let filePath = decodeURIComponent(pathname);
  if (filePath.endsWith("/")) {
    filePath += "index.html";
  }

  const resolved = path.normalize(path.join(root, filePath));
  if (!resolved.startsWith(root)) {
    return null;
  }

  return resolved;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  const pathname = url.pathname;

  if (
    pathname === "/" &&
    (url.searchParams.has("login") ||
      url.searchParams.has("customer") ||
      url.searchParams.has("dashboard") ||
      url.searchParams.has("loadout") ||
      url.searchParams.get("auth") === "login")
  ) {
    redirect(response, `/FantasyIQ/${url.search}`);
    return;
  }

  if (pathname === "/login" || pathname === "/sign-in" || pathname === "/dashboard") {
    redirect(response, "/FantasyIQ/?login=1");
    return;
  }

  if (pathname.toLowerCase() === "/fantasyiq") {
    redirect(response, "/FantasyIQ/");
    return;
  }

  if (pathname.toLowerCase().startsWith("/fantasyiq/") && !pathname.startsWith("/FantasyIQ/")) {
    redirect(response, `/FantasyIQ/${pathname.slice("/fantasyiq/".length)}${url.search}`);
    return;
  }

  const filePath = resolveStaticFile(pathname);
  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Length": stat.size,
      "Content-Type": contentTypes.get(path.extname(filePath)) || "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, host, () => {
  console.log(`Static preview running at http://${host}:${port}`);
});
