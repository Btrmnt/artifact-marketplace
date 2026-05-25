import { createRequire } from "module"; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x2) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x2, {
  get: (a, b2) => (typeof require !== "undefined" ? require : a)[b2]
}) : x2)(function(x2) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x2 + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/output.ts
function writeStdout(value) {
  process.stdout.write(`${JSON.stringify(value)}
`);
}
function writeStderrJson(value) {
  process.stderr.write(`${JSON.stringify(value)}
`);
}
function writeStderrRaw(line) {
  process.stderr.write(`${line}
`);
}
var init_output = __esm({
  "src/output.ts"() {
    "use strict";
  }
});

// src/config.ts
import { homedir } from "node:os";
import { resolve } from "node:path";
function envFlag(name) {
  const v = process.env[name];
  return v === "1" || v?.toLowerCase() === "true";
}
function isLoopbackHost(host) {
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
}
function isAllowedHost(host) {
  for (const suffix of ALLOWED_HOST_SUFFIXES) {
    if (host === suffix) return true;
    if (host.endsWith(`.${suffix}`)) return true;
  }
  return false;
}
function validateApiEndpoint(candidate, opts = {}) {
  const trimmed2 = candidate.trim();
  if (!trimmed2) {
    throw new ConfigError("api endpoint is empty");
  }
  let parsed;
  try {
    parsed = new URL(trimmed2);
  } catch {
    throw new ConfigError(`api endpoint ${JSON.stringify(trimmed2)} is not a valid URL`);
  }
  const host = parsed.hostname;
  const isLoopback = isLoopbackHost(host);
  const allowInsecure = opts.allowInsecure || envFlag("BTRMNT_ALLOW_INSECURE");
  const allowUnknownHost = opts.allowUnknownHost || envFlag("BTRMNT_ALLOW_UNKNOWN_HOST");
  if (parsed.protocol !== "https:" && !isLoopback && !allowInsecure) {
    throw new ConfigError(
      `api endpoint ${JSON.stringify(trimmed2)} uses ${parsed.protocol}; only https:// is permitted (set BTRMNT_ALLOW_INSECURE=1 to override for self-hosted/test).`
    );
  }
  if (!isLoopback && !isAllowedHost(host) && !allowUnknownHost) {
    throw new ConfigError(
      `api endpoint host ${JSON.stringify(host)} is not in the allowlist (${ALLOWED_HOST_SUFFIXES.join(", ")}); set BTRMNT_ALLOW_UNKNOWN_HOST=1 to allow it (do this only if you trust the host).`
    );
  }
  return trimmed2;
}
function resolveApiEndpoint(flag) {
  if (flag && flag.trim().length > 0) return flag;
  const envOverride = process.env.BTRMNT_API_ENDPOINT;
  if (envOverride && envOverride.trim().length > 0) return envOverride;
  const pluginOption = process.env.CLAUDE_PLUGIN_OPTION_API_ENDPOINT;
  if (pluginOption && pluginOption.trim().length > 0) return pluginOption;
  return DEFAULT_API_ENDPOINT;
}
function resolveCredentialsPath() {
  const override = process.env.BTRMNT_TEST_CREDS_FILE;
  if (override && override.trim().length > 0) return override;
  const home = process.env.HOME ?? homedir();
  return resolve(home, ".btrmnt", "credentials.json");
}
function credentialsDir(path) {
  return resolve(path, "..");
}
function resolveCwd() {
  const override = process.env.BTRMNT_TEST_CWD;
  if (override && override.trim().length > 0) return override;
  return process.cwd();
}
var DEFAULT_API_ENDPOINT, ALLOWED_HOST_SUFFIXES, ConfigError;
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
    DEFAULT_API_ENDPOINT = "https://api.btrmntlab.com";
    ALLOWED_HOST_SUFFIXES = ["btrmntlab.com"];
    ConfigError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "ConfigError";
      }
    };
  }
});

// src/browser.ts
import { spawn } from "node:child_process";
function resolveOpenBrowserCommand(url, platform) {
  if (platform === "darwin") return { cmd: "open", args: [url] };
  if (platform === "win32") {
    return {
      cmd: "powershell",
      args: ["-NoProfile", "-Command", "Start-Process", url]
    };
  }
  return { cmd: "xdg-open", args: [url] };
}
function openBrowser(url) {
  writeStderrJson({
    status: "awaiting_callback",
    auth_url: url,
    hint: "If your browser did not open automatically, visit this URL to complete sign-in."
  });
  if (process.env.BTRMNT_TEST_DISABLE_BROWSER === "1") {
    writeStderrRaw(`AUTH_URL=${url}`);
    return;
  }
  const { cmd, args } = resolveOpenBrowserCommand(url, process.platform);
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {
    });
    child.unref();
  } catch {
  }
}
var init_browser = __esm({
  "src/browser.ts"() {
    "use strict";
    init_output();
  }
});

// src/credentials.ts
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { randomBytes } from "node:crypto";
function writeCredentials(creds) {
  const path = resolveCredentialsPath();
  mkdirSync(credentialsDir(path), { recursive: true, mode: 448 });
  const tmpPath = `${path}.tmp.${process.pid}.${randomBytes(6).toString("hex")}`;
  try {
    writeFileSync(tmpPath, JSON.stringify(creds), { mode: 384, flag: "wx" });
    chmodSync(tmpPath, 384);
    renameSync(tmpPath, path);
    chmodSync(path, 384);
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
    }
    throw err;
  }
  return path;
}
function readCredentials() {
  const path = resolveCredentialsPath();
  if (!existsSync(path)) {
    throw new CredentialsError(
      `Not logged in. No credentials file at ${path}. Run \`btrmnt login\` first.`
    );
  }
  const mode = statSync(path).mode & 511;
  if (mode !== 384) {
    throw new CredentialsError(
      `Refusing to read credentials at ${path}: file mode is 0${mode.toString(
        8
      )}, expected 0600. Run \`chmod 600 ${path}\`.`
    );
  }
  const raw = readFileSync(path, "utf-8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new CredentialsError(`Corrupt credentials file at ${path}: ${err.message}`);
  }
  if (!parsed.token || !parsed.api_endpoint) {
    throw new CredentialsError(`Credentials file at ${path} is missing token or api_endpoint.`);
  }
  try {
    validateApiEndpoint(parsed.api_endpoint);
  } catch (err) {
    if (err instanceof ConfigError) {
      throw new CredentialsError(
        `Credentials file at ${path} references an api_endpoint we no longer trust: ${err.message}. Run \`btrmnt login\` to re-authenticate against a valid endpoint.`
      );
    }
    throw err;
  }
  return parsed;
}
var CredentialsError;
var init_credentials = __esm({
  "src/credentials.ts"() {
    "use strict";
    init_config();
    CredentialsError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "CredentialsError";
      }
    };
  }
});

// src/commands/login.ts
var login_exports = {};
__export(login_exports, {
  expiresAtFromJwt: () => expiresAtFromJwt,
  login: () => login
});
import { randomBytes as randomBytes2, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
function expiresAtFromJwt(token) {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - b64.length % 4);
    const json = Buffer.from(b64 + pad, "base64").toString("utf-8");
    const claims = JSON.parse(json);
    if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp)) return null;
    return new Date(claims.exp * 1e3).toISOString();
  } catch {
    return null;
  }
}
function safeEqual(a, b2) {
  const ab = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b2, "utf-8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
async function login(opts) {
  const apiEndpoint = resolveApiEndpoint(opts.apiEndpoint);
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1e3;
  const state = randomBytes2(32).toString("base64url");
  let server = null;
  let timer = null;
  try {
    const tokenPromise = new Promise((resolve6, reject) => {
      server = createServer((req, res) => {
        try {
          if (!req.url || !req.url.startsWith("/callback")) {
            res.statusCode = 404;
            res.end();
            return;
          }
          const u = new URL(req.url, "http://127.0.0.1");
          const token2 = u.searchParams.get("token");
          const echoedState = u.searchParams.get("state");
          if (!token2) {
            res.statusCode = 400;
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.end(FAILURE_PAGE);
            reject(new Error("callback missing token query param"));
            return;
          }
          if (!echoedState || !safeEqual(echoedState, state)) {
            res.statusCode = 400;
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.end(FAILURE_PAGE);
            reject(new Error("callback state mismatch \u2014 refusing to store token"));
            return;
          }
          res.statusCode = 200;
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(SUCCESS_PAGE);
          resolve6(token2);
        } catch (err) {
          res.statusCode = 500;
          res.end(FAILURE_PAGE);
          reject(err);
        }
      });
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        const callback = `http://127.0.0.1:${addr.port}/callback`;
        const startUrl = `${apiEndpoint}/auth/start?cb=${encodeURIComponent(callback)}&state=${encodeURIComponent(state)}`;
        openBrowser(startUrl);
      });
      timer = setTimeout(() => {
        reject(new Error("login timed out waiting for callback"));
      }, timeoutMs);
    });
    const token = await tokenPromise;
    const credsPath = writeCredentials({
      api_endpoint: apiEndpoint,
      token,
      expires_at: expiresAtFromJwt(token)
    });
    writeStdout({ ok: true, api_endpoint: apiEndpoint, credentials_path: credsPath });
  } finally {
    if (timer) clearTimeout(timer);
    if (server) await new Promise((r2) => server.close(() => r2()));
  }
}
var SUCCESS_PAGE, FAILURE_PAGE;
var init_login = __esm({
  "src/commands/login.ts"() {
    "use strict";
    init_browser();
    init_config();
    init_credentials();
    init_output();
    SUCCESS_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>btrmnt \u2014 authenticated</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:6rem auto;text-align:center}</style>
</head><body>
<h1>Authenticated</h1>
<p>You can close this tab and return to Claude Code.</p>
<script>try{window.close()}catch(e){}</script>
</body></html>
`;
    FAILURE_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>btrmnt \u2014 error</title></head>
<body><h1>Sign-in failed</h1><p>Return to Claude Code; the plugin will report the error.</p></body></html>
`;
  }
});

// src/api.ts
var USER_AGENT, ApiError, ApiClient;
var init_api = __esm({
  "src/api.ts"() {
    "use strict";
    init_config();
    USER_AGENT = "btrmnt-plugin/0.1.0-security";
    ApiError = class extends Error {
      constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = "ApiError";
      }
    };
    ApiClient = class {
      constructor(endpoint, token) {
        this.token = token;
        this.endpoint = validateApiEndpoint(endpoint);
      }
      endpoint;
      async request(method, path, body) {
        const headers = {
          cookie: `CF_Authorization=${this.token}`,
          "cf-access-jwt-assertion": this.token,
          "user-agent": USER_AGENT,
          accept: "application/json"
        };
        if (body !== void 0) headers["content-type"] = "application/json";
        const init = { method, headers };
        if (body !== void 0) init.body = JSON.stringify(body);
        const resp = await fetch(`${this.endpoint}${path}`, init);
        const text = await resp.text();
        let parsed = void 0;
        if (text.length > 0) {
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text;
          }
        }
        if (resp.status === 401) {
          throw new ApiError(
            "authentication failed (401); run `btrmnt login` to re-authenticate",
            resp.status,
            parsed
          );
        }
        if (resp.status < 200 || resp.status >= 300) {
          throw new ApiError(
            `${method} ${path} -> ${resp.status}`,
            resp.status,
            parsed
          );
        }
        return parsed;
      }
      whoami() {
        return this.request(
          "GET",
          "/v1/users/me"
        );
      }
      listProjects() {
        return this.request("GET", "/v1/projects");
      }
      createProject(req) {
        return this.request("POST", "/v1/projects", req);
      }
      deleteProject(slug) {
        return this.request("DELETE", `/v1/projects/${encodeURIComponent(slug)}`).then(
          () => void 0
        );
      }
      promote(slug) {
        return this.request(
          "POST",
          `/v1/projects/${encodeURIComponent(slug)}/promote`,
          {}
        );
      }
      rollback(slug, sha) {
        return this.request(
          "POST",
          `/v1/projects/${encodeURIComponent(slug)}/rollback`,
          { sha }
        );
      }
      listGrants(slug) {
        return this.request(
          "GET",
          `/v1/projects/${encodeURIComponent(slug)}/grants`
        );
      }
      grant(slug, req) {
        const body = { email: req.email, env: req.env ?? "both" };
        return this.request(
          "POST",
          `/v1/projects/${encodeURIComponent(slug)}/grants`,
          body
        );
      }
      revoke(slug, email, env) {
        const path = `/v1/projects/${encodeURIComponent(slug)}/grants/${encodeURIComponent(email)}?env=${encodeURIComponent(env)}`;
        return this.request("DELETE", path).then(() => void 0);
      }
      invite(req) {
        return this.request(
          "POST",
          "/v1/invites",
          req
        );
      }
    };
  }
});

// src/commands/whoami.ts
var whoami_exports = {};
__export(whoami_exports, {
  whoami: () => whoami
});
async function whoami(opts) {
  const creds = readCredentials();
  const endpoint = opts.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
  const client = new ApiClient(endpoint, creds.token);
  const { user, memberships } = await client.whoami();
  const first2 = memberships[0];
  writeStdout({
    email: user.email,
    role: first2?.role ?? null,
    tenant: first2?.tenant_slug ?? null,
    expires_at: creds.expires_at
  });
}
var init_whoami = __esm({
  "src/commands/whoami.ts"() {
    "use strict";
    init_api();
    init_config();
    init_credentials();
    init_output();
  }
});

// ../../../node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js
var require_ms = __commonJS({
  "../../../node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js"(exports, module) {
    var s = 1e3;
    var m = s * 60;
    var h2 = m * 60;
    var d = h2 * 24;
    var w = d * 7;
    var y2 = d * 365.25;
    module.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y2;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h2;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h2) {
        return Math.round(ms / h2) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h2) {
        return plural(ms, msAbs, h2, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// ../../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/common.js
var require_common = __commonJS({
  "../../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/common.js"(exports, module) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i2 = 0; i2 < namespace.length; i2++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i2);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug2(...args) {
          if (!debug2.enabled) {
            return;
          }
          const self = debug2;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self.diff = ms;
          self.prev = prevTime;
          self.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self, args);
          const logFn = self.log || createDebug.log;
          logFn.apply(self, args);
        }
        debug2.namespace = namespace;
        debug2.useColors = createDebug.useColors();
        debug2.color = createDebug.selectColor(namespace);
        debug2.extend = extend;
        debug2.destroy = createDebug.destroy;
        Object.defineProperty(debug2, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug2);
        }
        return debug2;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug.skips.push(ns.slice(1));
          } else {
            createDebug.names.push(ns);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module.exports = setup;
  }
});

// ../../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "../../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/browser.js"(exports, module) {
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c3 = "color: " + this.color;
      args.splice(1, 0, c3, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c3);
    }
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r2;
      try {
        r2 = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r2 && typeof process !== "undefined" && "env" in process) {
        r2 = process.env.DEBUG;
      }
      return r2;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// ../../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/node.js
var require_node = __commonJS({
  "../../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/node.js"(exports, module) {
    var tty = __require("tty");
    var util = __require("util");
    exports.init = init;
    exports.log = log;
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = __require("supports-color");
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_2, k2) => {
        return k2.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c3 = this.color;
        const colorCode = "\x1B[3" + (c3 < 8 ? c3 : "8;5;" + c3);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    function getDate() {
      if (exports.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug2) {
      debug2.inspectOpts = {};
      const keys = Object.keys(exports.inspectOpts);
      for (let i2 = 0; i2 < keys.length; i2++) {
        debug2.inspectOpts[keys[i2]] = exports.inspectOpts[keys[i2]];
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// ../../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/index.js
var require_src = __commonJS({
  "../../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/index.js"(exports, module) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module.exports = require_browser();
    } else {
      module.exports = require_node();
    }
  }
});

// ../../../node_modules/.pnpm/@kwsites+file-exists@1.1.1/node_modules/@kwsites/file-exists/dist/src/index.js
var require_src2 = __commonJS({
  "../../../node_modules/.pnpm/@kwsites+file-exists@1.1.1/node_modules/@kwsites/file-exists/dist/src/index.js"(exports) {
    "use strict";
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    var fs_1 = __require("fs");
    var debug_1 = __importDefault(require_src());
    var log = debug_1.default("@kwsites/file-exists");
    function check(path, isFile, isDirectory) {
      log(`checking %s`, path);
      try {
        const stat = fs_1.statSync(path);
        if (stat.isFile() && isFile) {
          log(`[OK] path represents a file`);
          return true;
        }
        if (stat.isDirectory() && isDirectory) {
          log(`[OK] path represents a directory`);
          return true;
        }
        log(`[FAIL] path represents something other than a file or directory`);
        return false;
      } catch (e) {
        if (e.code === "ENOENT") {
          log(`[FAIL] path is not accessible: %o`, e);
          return false;
        }
        log(`[FATAL] %o`, e);
        throw e;
      }
    }
    function exists2(path, type = exports.READABLE) {
      return check(path, (type & exports.FILE) > 0, (type & exports.FOLDER) > 0);
    }
    exports.exists = exists2;
    exports.FILE = 1;
    exports.FOLDER = 2;
    exports.READABLE = exports.FILE + exports.FOLDER;
  }
});

// ../../../node_modules/.pnpm/@kwsites+file-exists@1.1.1/node_modules/@kwsites/file-exists/dist/index.js
var require_dist = __commonJS({
  "../../../node_modules/.pnpm/@kwsites+file-exists@1.1.1/node_modules/@kwsites/file-exists/dist/index.js"(exports) {
    "use strict";
    function __export3(m) {
      for (var p2 in m) if (!exports.hasOwnProperty(p2)) exports[p2] = m[p2];
    }
    Object.defineProperty(exports, "__esModule", { value: true });
    __export3(require_src2());
  }
});

// ../../../node_modules/.pnpm/@simple-git+args-pathspec@1.0.3/node_modules/@simple-git/args-pathspec/dist/index.mjs
function c(...n) {
  const e = new String(n);
  return t.set(e, n), e;
}
function r(n) {
  return n instanceof String && t.has(n);
}
function o(n) {
  return t.get(n) ?? [];
}
var t;
var init_dist = __esm({
  "../../../node_modules/.pnpm/@simple-git+args-pathspec@1.0.3/node_modules/@simple-git/args-pathspec/dist/index.mjs"() {
    t = /* @__PURE__ */ new WeakMap();
  }
});

// ../../../node_modules/.pnpm/@kwsites+promise-deferred@1.1.1/node_modules/@kwsites/promise-deferred/dist/index.js
var require_dist2 = __commonJS({
  "../../../node_modules/.pnpm/@kwsites+promise-deferred@1.1.1/node_modules/@kwsites/promise-deferred/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createDeferred = exports.deferred = void 0;
    function deferred2() {
      let done;
      let fail;
      let status = "pending";
      const promise = new Promise((_done, _fail) => {
        done = _done;
        fail = _fail;
      });
      return {
        promise,
        done(result) {
          if (status === "pending") {
            status = "resolved";
            done(result);
          }
        },
        fail(error) {
          if (status === "pending") {
            status = "rejected";
            fail(error);
          }
        },
        get fulfilled() {
          return status !== "pending";
        },
        get status() {
          return status;
        }
      };
    }
    exports.deferred = deferred2;
    exports.createDeferred = deferred2;
    exports.default = deferred2;
  }
});

// ../../../node_modules/.pnpm/@simple-git+argv-parser@1.1.1/node_modules/@simple-git/argv-parser/dist/index.mjs
function* U(e, t2) {
  const n = t2 === "global";
  for (const o2 of e)
    o2.isGlobal === n && (yield o2);
}
function F(e, t2) {
  for (const { name: o2 } of U(e, "task")) {
    if (k.has(o2))
      return p(true, t2);
    if (S.has(o2))
      return p(false, t2);
  }
  const n = t2.at(0)?.toLowerCase();
  return n === void 0 ? null : P.has(n) ? p(true, t2.slice(1)) : E.has(n) ? p(false, t2.slice(1)) : t2.length === 1 ? p(false, t2) : p(true, t2);
}
function p(e = false, t2 = []) {
  const n = t2.at(0)?.toLowerCase();
  return n === void 0 ? null : {
    isWrite: e,
    isRead: !e,
    key: n,
    value: t2.at(1)
  };
}
function A(e, t2) {
  return t2.isWrite && t2.value !== void 0 ? { key: t2.key, value: t2.value, scope: e } : { key: t2.key, scope: e };
}
function M(e) {
  const t2 = e?.indexOf("=") || -1;
  return !e || t2 < 0 ? null : {
    key: e.slice(0, t2).trim().toLowerCase(),
    value: e.slice(t2 + 1)
  };
}
function N(e) {
  for (const { name: t2 } of U(e, "task"))
    switch (t2) {
      case "--global":
        return "global";
      case "--system":
        return "system";
      case "--worktree":
        return "worktree";
      case "--local":
        return "local";
      case "--file":
      case "-f":
        return "file";
    }
  return "local";
}
function G({ name: e }) {
  if (e === "-c" || e === "--config")
    return "inline";
  if (e === "--config-env")
    return "env";
}
function* O(e) {
  for (const t2 of e) {
    const n = G(t2), o2 = n && M(t2.value);
    o2 && (yield {
      ...o2,
      scope: n
    });
  }
}
function L(e, t2, n) {
  const o2 = {
    read: [],
    write: [...O(t2)]
  };
  return e === "config" && $(
    o2,
    N(t2),
    F(t2, n)
  ), o2;
}
function $(e, t2, n) {
  if (n === null)
    return;
  const o2 = A(t2, n);
  n.isWrite ? e.write.push(o2) : e.read.push(o2);
}
function I(e) {
  const t2 = R[e ?? ""] ?? T;
  return {
    short: new Map([...x.short.entries(), ...t2.short.entries()]),
    long: t2.long
  };
}
function b(e, t2 = D) {
  if (e.startsWith("--")) {
    const n = e.indexOf("=");
    if (n > 2)
      return [{ name: e.slice(0, n), value: e.slice(n + 1), needsNext: false }];
    const o2 = e.slice(2);
    return [{ name: e, needsNext: t2.long.has(o2) }];
  }
  if (e.length === 2) {
    const n = e.charAt(1), o2 = t2.short.get(n);
    return [{ name: e, needsNext: o2 === true }];
  }
  return W(e, t2.short);
}
function W(e, t2) {
  const n = e.slice(1).split(""), o2 = [];
  for (let s = 0; s < n.length; s++) {
    const r2 = n[s], l = t2.get(r2);
    if (l === void 0)
      return [{ name: e, needsNext: false }];
    if (l) {
      const a = n.slice(s + 1).join("");
      if (a && ![...a].every((w) => t2.has(w)))
        return o2.push({ name: `-${r2}`, value: a, needsNext: false }), o2;
    }
    o2.push({ name: `-${r2}`, needsNext: l });
  }
  return o2;
}
function j(e, t2 = []) {
  let n = 0;
  for (; n < e.length; ) {
    const o2 = String(e[n]);
    if (!o2.startsWith("-") || o2.length < 2) break;
    const s = b(o2);
    let r2 = n + 1;
    for (const l of s) {
      const a = {
        name: l.name,
        value: l.value,
        absorbedNext: false,
        isGlobal: true
      };
      l.needsNext && a.value === void 0 && r2 < e.length && (a.value = String(e[r2]), a.absorbedNext = true, r2++), t2.push(a);
    }
    n = r2;
  }
  return { flags: t2, taskIndex: n };
}
function B(e, t2, n = []) {
  const o2 = I(t2), s = [], r2 = [];
  let l = 0;
  for (; l < e.length; ) {
    const a = e[l];
    if (r(a)) {
      r2.push(...o(a)), l++;
      continue;
    }
    const f = String(a);
    if (f === "--") {
      for (let g = l + 1; g < e.length; g++) {
        const u = e[g];
        r(u) ? r2.push(...o(u)) : r2.push(String(u));
      }
      break;
    }
    if (!f.startsWith("-") || f.length < 2) {
      s.push(f), l++;
      continue;
    }
    const w = b(f, o2);
    let d = l + 1;
    for (const g of w) {
      const u = {
        name: g.name,
        value: g.value,
        absorbedNext: false,
        isGlobal: false
      };
      g.needsNext && u.value === void 0 && d < e.length && !r(e[d]) && (u.value = String(e[d]), u.absorbedNext = true, d++), n.push(u);
    }
    l = d;
  }
  return { flags: n, positionals: s, pathspecs: r2 };
}
function* V({
  write: e
}) {
  for (const t2 of e)
    for (const n of q) {
      const o2 = n(t2.key);
      o2 && (yield o2);
    }
}
function c2(e, t2, n = String(e)) {
  const o2 = typeof e == "string" ? new RegExp(`\\s*${e.toLowerCase()}`) : e;
  return function(r2) {
    if (o2.test(r2))
      return {
        category: t2,
        message: `Configuring ${n} is not permitted without enabling ${t2}`
      };
  };
}
function i(e, t2) {
  const n = new RegExp(`\\s*${e.toLowerCase().replace(/\./g, "(..+)?.")}`);
  return c2(n, t2, e);
}
function* K(e, t2) {
  for (const n of t2)
    for (const o2 of H) {
      const s = o2(e, n.name);
      s && (yield s);
    }
}
function h(e, t2, n, o2 = String(t2)) {
  const s = typeof t2 == "string" ? new RegExp(`\\s*${t2.toLowerCase()}`) : t2, r2 = `Use of ${e ? `${e} with option ` : ""}${o2} is not permitted without enabling ${n}`;
  return function(a, f) {
    if ((!e || a === e) && s.test(f))
      return {
        category: n,
        message: r2
      };
  };
}
function C(e, t2, n) {
  return [...K(e, t2), ...V(n)];
}
function Y(...e) {
  const { flags: t2, taskIndex: n } = j(e), o2 = n < e.length ? String(e[n]).toLowerCase() : null, s = o2 !== null ? e.slice(n + 1) : [], { positionals: r2, pathspecs: l } = B(s, o2, t2), a = L(o2, t2, r2);
  return {
    task: o2,
    flags: t2.map(J),
    paths: l,
    config: a,
    vulnerabilities: z(C(o2, t2, a))
  };
}
function z(e) {
  return Object.defineProperty(e, "vulnerabilities", {
    value: e
  });
}
function J({ value: e, name: t2 }) {
  return e !== void 0 ? { name: t2, value: e } : { name: t2 };
}
function* Q(e) {
  const t2 = parseInt(e.git_config_count ?? "0", 10);
  for (let n = 0; n < t2; n++) {
    const o2 = e[`git_config_key_${n}`], s = e[`git_config_value_${n}`];
    o2 !== void 0 && (yield { key: o2.toLowerCase().trim(), value: s, scope: "env" });
  }
}
function* X(e) {
  for (const t2 of Object.keys(e))
    if (_(t2)) {
      const n = y[t2];
      yield {
        category: n,
        message: `Use of "${t2.toUpperCase()}" is not permitted without enabling ${n}`
      };
    }
}
function _(e) {
  return Object.hasOwn(y, e);
}
function Z(e) {
  const t2 = {};
  for (const [n, o2] of Object.entries(e)) {
    const s = n.toLowerCase().trim();
    (_(s) || s.startsWith("git")) && (t2[s] = String(o2));
  }
  return t2;
}
function ee(e) {
  const t2 = Z(e), n = {
    read: [],
    write: [...Q(t2)]
  }, o2 = [
    ...X(t2),
    ...C(null, [], n)
  ];
  return {
    config: n,
    vulnerabilities: o2
  };
}
function ne(e, t2) {
  return [...Y(...e).vulnerabilities, ...ee(t2).vulnerabilities];
}
var k, S, P, E, x, D, R, T, q, H, y;
var init_dist2 = __esm({
  "../../../node_modules/.pnpm/@simple-git+argv-parser@1.1.1/node_modules/@simple-git/argv-parser/dist/index.mjs"() {
    init_dist();
    k = /* @__PURE__ */ new Set([
      "--add",
      "--edit",
      "--remove-section",
      "--rename-section",
      "--replace-all",
      "--unset",
      "--unset-all",
      "-e"
    ]);
    S = /* @__PURE__ */ new Set([
      "--get",
      "--get-all",
      "--get-color",
      "--get-colorbool",
      "--get-regexp",
      "--get-urlmatch",
      "--list",
      "-l"
    ]);
    P = /* @__PURE__ */ new Set([
      "edit",
      "remove-section",
      "rename-section",
      "set",
      "unset"
    ]);
    E = /* @__PURE__ */ new Set(["get", "get-color", "get-colorbool", "list"]);
    x = {
      short: /* @__PURE__ */ new Map([
        ["c", true]
        //  -c <k=v>    set config key for this invocation
      ])
    };
    D = {
      short: new Map([
        ["C", true],
        //  -C <path>   change working directory
        ["P", false],
        // -P          no pager (alias for --no-pager)
        ["h", false],
        // -h          help
        ["p", false],
        // -p          paginate
        ["v", false],
        // -v          version
        ...x.short.entries()
      ]),
      long: /* @__PURE__ */ new Set([
        "attr-source",
        "config-env",
        "exec-path",
        "git-dir",
        "list-cmds",
        "namespace",
        "super-prefix",
        "work-tree"
      ])
    };
    R = {
      clone: {
        short: /* @__PURE__ */ new Map([
          ["b", true],
          // -b <branch>
          ["j", true],
          // -j <n>          parallel jobs
          ["l", false],
          // -l local
          ["n", false],
          // -n no-checkout
          ["o", true],
          // -o <name>       remote name
          ["q", false],
          // -q quiet
          ["s", false],
          // -s shared
          ["u", true]
          // -u <upload-pack>
        ]),
        long: /* @__PURE__ */ new Set(["branch", "config", "jobs", "origin", "upload-pack", "u", "template"])
      },
      commit: {
        short: /* @__PURE__ */ new Map([
          ["C", true],
          // -C <commit>  reuse message
          ["F", true],
          // -F <file>    read message from file
          ["c", true],
          // -c <commit>  reedit message
          ["m", true],
          // -m <msg>
          ["t", true]
          // -t <template>
        ]),
        long: /* @__PURE__ */ new Set(["file", "message", "reedit-message", "reuse-message", "template"])
      },
      config: {
        short: /* @__PURE__ */ new Map([
          ["e", false],
          // -e  open editor
          ["f", true],
          //  -f <file>
          ["l", false]
          // -l  list
        ]),
        long: /* @__PURE__ */ new Set(["blob", "comment", "default", "file", "type", "value"])
      },
      fetch: {
        short: /* @__PURE__ */ new Map(),
        long: /* @__PURE__ */ new Set(["upload-pack"])
      },
      init: {
        short: /* @__PURE__ */ new Map(),
        long: /* @__PURE__ */ new Set(["template"])
      },
      pull: {
        short: /* @__PURE__ */ new Map(),
        long: /* @__PURE__ */ new Set(["upload-pack"])
      },
      push: {
        short: /* @__PURE__ */ new Map(),
        long: /* @__PURE__ */ new Set(["exec", "receive-pack"])
      }
    };
    T = { short: /* @__PURE__ */ new Map(), long: /* @__PURE__ */ new Set() };
    q = [
      c2("alias", "allowUnsafeAlias"),
      c2("core.askPass", "allowUnsafeAskPass"),
      c2("core.editor", "allowUnsafeEditor"),
      c2("core.fsmonitor", "allowUnsafeFsMonitor"),
      c2("core.gitProxy", "allowUnsafeGitProxy"),
      c2("core.hooksPath", "allowUnsafeHooksPath"),
      c2("core.pager", "allowUnsafePager"),
      c2("core.sshCommand", "allowUnsafeSshCommand"),
      i("credential.helper", "allowUnsafeCredentialHelper"),
      i("diff.command", "allowUnsafeDiffExternal"),
      c2("diff.external", "allowUnsafeDiffExternal"),
      i("diff.textconv", "allowUnsafeDiffTextConv"),
      i("filter.clean", "allowUnsafeFilter"),
      i("filter.smudge", "allowUnsafeFilter"),
      i("gpg.program", "allowUnsafeGpgProgram"),
      c2("init.templateDir", "allowUnsafeTemplateDir"),
      i("merge.driver", "allowUnsafeMergeDriver"),
      i("mergetool.path", "allowUnsafeMergeDriver"),
      i("mergetool.cmd", "allowUnsafeMergeDriver"),
      i("protocol.allow", "allowUnsafeProtocolOverride"),
      i("remote.receivepack", "allowUnsafePack"),
      i("remote.uploadpack", "allowUnsafePack"),
      c2("sequence.editor", "allowUnsafeEditor")
    ];
    H = [
      h(
        null,
        /--(upload|receive)-pack/,
        "allowUnsafePack",
        "--upload-pack or --receive-pack"
      ),
      h("clone", /^-\w*u/, "allowUnsafePack"),
      h("clone", "--u", "allowUnsafePack"),
      h("push", "--exec", "allowUnsafePack"),
      h(null, "--template", "allowUnsafeTemplateDir")
    ];
    y = {
      editor: "allowUnsafeEditor",
      git_askpass: "allowUnsafeAskPass",
      git_config_global: "allowUnsafeConfigPaths",
      git_config_system: "allowUnsafeConfigPaths",
      git_config_count: "allowUnsafeConfigEnvCount",
      git_config: "allowUnsafeConfigPaths",
      git_editor: "allowUnsafeEditor",
      git_exec_path: "allowUnsafeConfigPaths",
      git_external_diff: "allowUnsafeDiffExternal",
      git_pager: "allowUnsafePager",
      git_proxy_command: "allowUnsafeGitProxy",
      git_template_dir: "allowUnsafeTemplateDir",
      git_sequence_editor: "allowUnsafeEditor",
      git_ssh: "allowUnsafeSshCommand",
      git_ssh_command: "allowUnsafeSshCommand",
      pager: "allowUnsafePager",
      prefix: "allowUnsafeConfigPaths",
      ssh_askpass: "allowUnsafeAskPass"
    };
  }
});

// ../../../node_modules/.pnpm/simple-git@3.36.0/node_modules/simple-git/dist/esm/index.js
import { spawn as spawn2 } from "child_process";
import { normalize } from "node:path";
import { EventEmitter } from "node:events";
function asFunction(source) {
  if (typeof source !== "function") {
    return NOOP;
  }
  return source;
}
function isUserFunction(source) {
  return typeof source === "function" && source !== NOOP;
}
function splitOn(input, char) {
  const index = input.indexOf(char);
  if (index <= 0) {
    return [input, ""];
  }
  return [input.substr(0, index), input.substr(index + 1)];
}
function first(input, offset = 0) {
  return isArrayLike(input) && input.length > offset ? input[offset] : void 0;
}
function last(input, offset = 0) {
  if (isArrayLike(input) && input.length > offset) {
    return input[input.length - 1 - offset];
  }
}
function isArrayLike(input) {
  return filterHasLength(input);
}
function toLinesWithContent(input = "", trimmed2 = true, separator = "\n") {
  return input.split(separator).reduce((output, line) => {
    const lineContent = trimmed2 ? line.trim() : line;
    if (lineContent) {
      output.push(lineContent);
    }
    return output;
  }, []);
}
function forEachLineWithContent(input, callback) {
  return toLinesWithContent(input, true).map((line) => callback(line));
}
function folderExists(path) {
  return (0, import_file_exists.exists)(path, import_file_exists.FOLDER);
}
function append(target, item) {
  if (Array.isArray(target)) {
    if (!target.includes(item)) {
      target.push(item);
    }
  } else {
    target.add(item);
  }
  return item;
}
function including(target, item) {
  if (Array.isArray(target) && !target.includes(item)) {
    target.push(item);
  }
  return target;
}
function remove(target, item) {
  if (Array.isArray(target)) {
    const index = target.indexOf(item);
    if (index >= 0) {
      target.splice(index, 1);
    }
  } else {
    target.delete(item);
  }
  return item;
}
function asArray(source) {
  return Array.isArray(source) ? source : [source];
}
function asCamelCase(str) {
  return str.replace(/[\s-]+(.)/g, (_all, chr) => {
    return chr.toUpperCase();
  });
}
function asStringArray(source) {
  return asArray(source).map((item) => {
    return item instanceof String ? item : String(item);
  });
}
function asNumber(source, onNaN = 0) {
  if (source == null) {
    return onNaN;
  }
  const num = parseInt(source, 10);
  return Number.isNaN(num) ? onNaN : num;
}
function prefixedArray(input, prefix) {
  const output = [];
  for (let i2 = 0, max = input.length; i2 < max; i2++) {
    output.push(prefix, input[i2]);
  }
  return output;
}
function bufferToString(input) {
  return (Array.isArray(input) ? Buffer.concat(input) : input).toString("utf-8");
}
function pick(source, properties) {
  const out = {};
  properties.forEach((key) => {
    if (source[key] !== void 0) {
      out[key] = source[key];
    }
  });
  return out;
}
function delay(duration = 0) {
  return new Promise((done) => setTimeout(done, duration));
}
function orVoid(input) {
  if (input === false) {
    return void 0;
  }
  return input;
}
function filterType(input, filter, def) {
  if (filter(input)) {
    return input;
  }
  return arguments.length > 2 ? def : void 0;
}
function filterPrimitives(input, omit) {
  const type = r(input) ? "string" : typeof input;
  return /number|string|boolean/.test(type) && (!omit || !omit.includes(type));
}
function filterPlainObject(input) {
  return !!input && objectToString(input) === "[object Object]";
}
function filterFunction(input) {
  return typeof input === "function";
}
function useMatchesDefault() {
  throw new Error(`LineParser:useMatches not implemented`);
}
function createInstanceConfig(...options) {
  const baseDir = process.cwd();
  const config = Object.assign(
    { baseDir, ...defaultOptions },
    ...options.filter((o2) => typeof o2 === "object" && o2)
  );
  config.baseDir = config.baseDir || baseDir;
  config.trimmed = config.trimmed === true;
  return config;
}
function appendTaskOptions(options, commands = []) {
  if (!filterPlainObject(options)) {
    return commands;
  }
  return Object.keys(options).reduce((commands2, key) => {
    const value = options[key];
    if (r(value)) {
      commands2.push(value);
    } else if (filterPrimitives(value, ["boolean"])) {
      commands2.push(key + "=" + value);
    } else if (Array.isArray(value)) {
      for (const v of value) {
        if (!filterPrimitives(v, ["string", "number"])) {
          commands2.push(key + "=" + v);
        }
      }
    } else {
      commands2.push(key);
    }
    return commands2;
  }, commands);
}
function getTrailingOptions(args, initialPrimitive = 0, objectOnly = false) {
  const command = [];
  for (let i2 = 0, max = initialPrimitive < 0 ? args.length : initialPrimitive; i2 < max; i2++) {
    if ("string|number".includes(typeof args[i2])) {
      command.push(String(args[i2]));
    }
  }
  appendTaskOptions(trailingOptionsArgument(args), command);
  if (!objectOnly) {
    command.push(...trailingArrayArgument(args));
  }
  return command;
}
function trailingArrayArgument(args) {
  const hasTrailingCallback = typeof last(args) === "function";
  return asStringArray(filterType(last(args, hasTrailingCallback ? 1 : 0), filterArray, []));
}
function trailingOptionsArgument(args) {
  const hasTrailingCallback = filterFunction(last(args));
  return filterType(last(args, hasTrailingCallback ? 1 : 0), filterPlainObject);
}
function trailingFunctionArgument(args, includeNoop = true) {
  const callback = asFunction(last(args));
  return includeNoop || isUserFunction(callback) ? callback : void 0;
}
function callTaskParser(parser4, streams) {
  return parser4(streams.stdOut, streams.stdErr);
}
function parseStringResponse(result, parsers12, texts, trim = true) {
  asArray(texts).forEach((text) => {
    for (let lines = toLinesWithContent(text, trim), i2 = 0, max = lines.length; i2 < max; i2++) {
      const line = (offset = 0) => {
        if (i2 + offset >= max) {
          return;
        }
        return lines[i2 + offset];
      };
      parsers12.some(({ parse }) => parse(line, result));
    }
  });
  return result;
}
function checkIsRepoTask(action) {
  switch (action) {
    case "bare":
      return checkIsBareRepoTask();
    case "root":
      return checkIsRepoRootTask();
  }
  const commands = ["rev-parse", "--is-inside-work-tree"];
  return {
    commands,
    format: "utf-8",
    onError,
    parser
  };
}
function checkIsRepoRootTask() {
  const commands = ["rev-parse", "--git-dir"];
  return {
    commands,
    format: "utf-8",
    onError,
    parser(path) {
      return /^\.(git)?$/.test(path.trim());
    }
  };
}
function checkIsBareRepoTask() {
  const commands = ["rev-parse", "--is-bare-repository"];
  return {
    commands,
    format: "utf-8",
    onError,
    parser
  };
}
function isNotRepoMessage(error) {
  return /(Not a git repository|Kein Git-Repository)/i.test(String(error));
}
function cleanSummaryParser(dryRun, text) {
  const summary = new CleanResponse(dryRun);
  const regexp = dryRun ? dryRunRemovalRegexp : removalRegexp;
  toLinesWithContent(text).forEach((line) => {
    const removed = line.replace(regexp, "");
    summary.paths.push(removed);
    (isFolderRegexp.test(removed) ? summary.folders : summary.files).push(removed);
  });
  return summary;
}
function adhocExecTask(parser4) {
  return {
    commands: EMPTY_COMMANDS,
    format: "empty",
    parser: parser4
  };
}
function configurationErrorTask(error) {
  return {
    commands: EMPTY_COMMANDS,
    format: "empty",
    parser() {
      throw typeof error === "string" ? new TaskConfigurationError(error) : error;
    }
  };
}
function straightThroughStringTask(commands, trimmed2 = false) {
  return {
    commands,
    format: "utf-8",
    parser(text) {
      return trimmed2 ? String(text).trim() : text;
    }
  };
}
function straightThroughBufferTask(commands) {
  return {
    commands,
    format: "buffer",
    parser(buffer) {
      return buffer;
    }
  };
}
function isBufferTask(task) {
  return task.format === "buffer";
}
function isEmptyTask(task) {
  return task.format === "empty" || !task.commands.length;
}
function cleanWithOptionsTask(mode, customArgs) {
  const { cleanMode, options, valid } = getCleanOptions(mode);
  if (!cleanMode) {
    return configurationErrorTask(CONFIG_ERROR_MODE_REQUIRED);
  }
  if (!valid.options) {
    return configurationErrorTask(CONFIG_ERROR_UNKNOWN_OPTION + JSON.stringify(mode));
  }
  options.push(...customArgs);
  if (options.some(isInteractiveMode)) {
    return configurationErrorTask(CONFIG_ERROR_INTERACTIVE_MODE);
  }
  return cleanTask(cleanMode, options);
}
function cleanTask(mode, customArgs) {
  const commands = ["clean", `-${mode}`, ...customArgs];
  return {
    commands,
    format: "utf-8",
    parser(text) {
      return cleanSummaryParser(mode === "n", text);
    }
  };
}
function isCleanOptionsArray(input) {
  return Array.isArray(input) && input.every((test) => CleanOptionValues.has(test));
}
function getCleanOptions(input) {
  let cleanMode;
  let options = [];
  let valid = { cleanMode: false, options: true };
  input.replace(/[^a-z]i/g, "").split("").forEach((char) => {
    if (isCleanMode(char)) {
      cleanMode = char;
      valid.cleanMode = true;
    } else {
      valid.options = valid.options && isKnownOption(options[options.length] = `-${char}`);
    }
  });
  return {
    cleanMode,
    options,
    valid
  };
}
function isCleanMode(cleanMode) {
  return cleanMode === "f" || cleanMode === "n";
}
function isKnownOption(option) {
  return /^-[a-z]$/i.test(option) && CleanOptionValues.has(option.charAt(1));
}
function isInteractiveMode(option) {
  if (/^-[^\-]/.test(option)) {
    return option.indexOf("i") > 0;
  }
  return option === "--interactive";
}
function configListParser(text) {
  const config = new ConfigList();
  for (const item of configParser(text)) {
    config.addValue(item.file, String(item.key), item.value);
  }
  return config;
}
function configGetParser(text, key) {
  let value = null;
  const values = [];
  const scopes = /* @__PURE__ */ new Map();
  for (const item of configParser(text, key)) {
    if (item.key !== key) {
      continue;
    }
    values.push(value = item.value);
    if (!scopes.has(item.file)) {
      scopes.set(item.file, []);
    }
    scopes.get(item.file).push(value);
  }
  return {
    key,
    paths: Array.from(scopes.keys()),
    scopes,
    value,
    values
  };
}
function configFilePath(filePath) {
  return filePath.replace(/^(file):/, "");
}
function* configParser(text, requestedKey = null) {
  const lines = text.split("\0");
  for (let i2 = 0, max = lines.length - 1; i2 < max; ) {
    const file = configFilePath(lines[i2++]);
    let value = lines[i2++];
    let key = requestedKey;
    if (value.includes("\n")) {
      const line = splitOn(value, "\n");
      key = line[0];
      value = line[1];
    }
    yield { file, key, value };
  }
}
function asConfigScope(scope, fallback) {
  if (typeof scope === "string" && Object.hasOwn(GitConfigScope, scope)) {
    return scope;
  }
  return fallback;
}
function addConfigTask(key, value, append2, scope) {
  const commands = ["config", `--${scope}`];
  if (append2) {
    commands.push("--add");
  }
  commands.push(key, value);
  return {
    commands,
    format: "utf-8",
    parser(text) {
      return text;
    }
  };
}
function getConfigTask(key, scope) {
  const commands = ["config", "--null", "--show-origin", "--get-all", key];
  if (scope) {
    commands.splice(1, 0, `--${scope}`);
  }
  return {
    commands,
    format: "utf-8",
    parser(text) {
      return configGetParser(text, key);
    }
  };
}
function listConfigTask(scope) {
  const commands = ["config", "--list", "--show-origin", "--null"];
  if (scope) {
    commands.push(`--${scope}`);
  }
  return {
    commands,
    format: "utf-8",
    parser(text) {
      return configListParser(text);
    }
  };
}
function config_default() {
  return {
    addConfig(key, value, ...rest) {
      return this._runTask(
        addConfigTask(
          key,
          value,
          rest[0] === true,
          asConfigScope(
            rest[1],
            "local"
            /* local */
          )
        ),
        trailingFunctionArgument(arguments)
      );
    },
    getConfig(key, scope) {
      return this._runTask(
        getConfigTask(key, asConfigScope(scope, void 0)),
        trailingFunctionArgument(arguments)
      );
    },
    listConfig(...rest) {
      return this._runTask(
        listConfigTask(asConfigScope(rest[0], void 0)),
        trailingFunctionArgument(arguments)
      );
    }
  };
}
function isDiffNameStatus(input) {
  return diffNameStatus.has(input);
}
function grepQueryBuilder(...params) {
  return new GrepQuery().param(...params);
}
function parseGrep(grep) {
  const paths = /* @__PURE__ */ new Set();
  const results = {};
  forEachLineWithContent(grep, (input) => {
    const [path, line, preview] = input.split(NULL);
    paths.add(path);
    (results[path] = results[path] || []).push({
      line: asNumber(line),
      path,
      preview
    });
  });
  return {
    paths,
    results
  };
}
function grep_default() {
  return {
    grep(searchTerm) {
      const then = trailingFunctionArgument(arguments);
      const options = getTrailingOptions(arguments);
      for (const option of disallowedOptions) {
        if (options.includes(option)) {
          return this._runTask(
            configurationErrorTask(`git.grep: use of "${option}" is not supported.`),
            then
          );
        }
      }
      if (typeof searchTerm === "string") {
        searchTerm = grepQueryBuilder().param(searchTerm);
      }
      const commands = ["grep", "--null", "-n", "--full-name", ...options, ...searchTerm];
      return this._runTask(
        {
          commands,
          format: "utf-8",
          parser(stdOut) {
            return parseGrep(stdOut);
          }
        },
        then
      );
    }
  };
}
function resetTask(mode, customArgs) {
  const commands = ["reset"];
  if (isValidResetMode(mode)) {
    commands.push(`--${mode}`);
  }
  commands.push(...customArgs);
  return straightThroughStringTask(commands);
}
function getResetMode(mode) {
  if (isValidResetMode(mode)) {
    return mode;
  }
  switch (typeof mode) {
    case "string":
    case "undefined":
      return "soft";
  }
  return;
}
function isValidResetMode(mode) {
  return typeof mode === "string" && validResetModes.includes(mode);
}
function createLog() {
  return (0, import_debug.default)("simple-git");
}
function prefixedLogger(to, prefix, forward) {
  if (!prefix || !String(prefix).replace(/\s*/, "")) {
    return !forward ? to : (message, ...args) => {
      to(message, ...args);
      forward(message, ...args);
    };
  }
  return (message, ...args) => {
    to(`%s ${message}`, prefix, ...args);
    if (forward) {
      forward(message, ...args);
    }
  };
}
function childLoggerName(name, childDebugger, { namespace: parentNamespace }) {
  if (typeof name === "string") {
    return name;
  }
  const childNamespace = childDebugger && childDebugger.namespace || "";
  if (childNamespace.startsWith(parentNamespace)) {
    return childNamespace.substr(parentNamespace.length + 1);
  }
  return childNamespace || parentNamespace;
}
function createLogger(label, verbose, initialStep, infoDebugger = createLog()) {
  const labelPrefix = label && `[${label}]` || "";
  const spawned = [];
  const debugDebugger = typeof verbose === "string" ? infoDebugger.extend(verbose) : verbose;
  const key = childLoggerName(filterType(verbose, filterString), debugDebugger, infoDebugger);
  return step(initialStep);
  function sibling(name, initial) {
    return append(
      spawned,
      createLogger(label, key.replace(/^[^:]+/, name), initial, infoDebugger)
    );
  }
  function step(phase) {
    const stepPrefix = phase && `[${phase}]` || "";
    const debug2 = debugDebugger && prefixedLogger(debugDebugger, stepPrefix) || NOOP;
    const info = prefixedLogger(infoDebugger, `${labelPrefix} ${stepPrefix}`, debug2);
    return Object.assign(debugDebugger ? debug2 : info, {
      label,
      sibling,
      info,
      step
    });
  }
}
function pluginContext(task, commands) {
  return {
    method: first(task.commands) || "",
    commands
  };
}
function onErrorReceived(target, logger) {
  return (err) => {
    logger(`[ERROR] child process exception %o`, err);
    target.push(Buffer.from(String(err.stack), "ascii"));
  };
}
function onDataReceived(target, name, logger, output) {
  return (buffer) => {
    logger(`%s received %L bytes`, name, buffer);
    output(`%B`, buffer);
    target.push(buffer);
  };
}
function taskCallback(task, response, callback = NOOP) {
  const onSuccess = (data) => {
    callback(null, data);
  };
  const onError2 = (err) => {
    if (err?.task === task) {
      callback(
        err instanceof GitResponseError ? addDeprecationNoticeToError(err) : err,
        void 0
      );
    }
  };
  response.then(onSuccess, onError2);
}
function addDeprecationNoticeToError(err) {
  let log = (name) => {
    console.warn(
      `simple-git deprecation notice: accessing GitResponseError.${name} should be GitResponseError.git.${name}, this will no longer be available in version 3`
    );
    log = NOOP;
  };
  return Object.create(err, Object.getOwnPropertyNames(err.git).reduce(descriptorReducer, {}));
  function descriptorReducer(all, name) {
    if (name in err) {
      return all;
    }
    all[name] = {
      enumerable: false,
      configurable: false,
      get() {
        log(name);
        return err.git[name];
      }
    };
    return all;
  }
}
function changeWorkingDirectoryTask(directory, root) {
  return adhocExecTask((instance) => {
    if (!folderExists(directory)) {
      throw new Error(`Git.cwd: cannot change to non-directory "${directory}"`);
    }
    return (root || instance).cwd = directory;
  });
}
function checkoutTask(args) {
  const commands = ["checkout", ...args];
  if (commands[1] === "-b" && commands.includes("-B")) {
    commands[1] = remove(commands, "-B");
  }
  return straightThroughStringTask(commands);
}
function checkout_default() {
  return {
    checkout() {
      return this._runTask(
        checkoutTask(getTrailingOptions(arguments, 1)),
        trailingFunctionArgument(arguments)
      );
    },
    checkoutBranch(branchName, startPoint) {
      return this._runTask(
        checkoutTask(["-b", branchName, startPoint, ...getTrailingOptions(arguments)]),
        trailingFunctionArgument(arguments)
      );
    },
    checkoutLocalBranch(branchName) {
      return this._runTask(
        checkoutTask(["-b", branchName, ...getTrailingOptions(arguments)]),
        trailingFunctionArgument(arguments)
      );
    }
  };
}
function countObjectsResponse() {
  return {
    count: 0,
    garbage: 0,
    inPack: 0,
    packs: 0,
    prunePackable: 0,
    size: 0,
    sizeGarbage: 0,
    sizePack: 0
  };
}
function count_objects_default() {
  return {
    countObjects() {
      return this._runTask({
        commands: ["count-objects", "--verbose"],
        format: "utf-8",
        parser(stdOut) {
          return parseStringResponse(countObjectsResponse(), [parser2], stdOut);
        }
      });
    }
  };
}
function parseCommitResult(stdOut) {
  const result = {
    author: null,
    branch: "",
    commit: "",
    root: false,
    summary: {
      changes: 0,
      insertions: 0,
      deletions: 0
    }
  };
  return parseStringResponse(result, parsers, stdOut);
}
function commitTask(message, files, customArgs) {
  const commands = [
    "-c",
    "core.abbrev=40",
    "commit",
    ...prefixedArray(message, "-m"),
    ...files,
    ...customArgs
  ];
  return {
    commands,
    format: "utf-8",
    parser: parseCommitResult
  };
}
function commit_default() {
  return {
    commit(message, ...rest) {
      const next = trailingFunctionArgument(arguments);
      const task = rejectDeprecatedSignatures(message) || commitTask(
        asArray(message),
        asArray(filterType(rest[0], filterStringOrStringArray, [])),
        [
          ...asStringArray(filterType(rest[1], filterArray, [])),
          ...getTrailingOptions(arguments, 0, true)
        ]
      );
      return this._runTask(task, next);
    }
  };
  function rejectDeprecatedSignatures(message) {
    return !filterStringOrStringArray(message) && configurationErrorTask(
      `git.commit: requires the commit message to be supplied as a string/string[]`
    );
  }
}
function first_commit_default() {
  return {
    firstCommit() {
      return this._runTask(
        straightThroughStringTask(["rev-list", "--max-parents=0", "HEAD"], true),
        trailingFunctionArgument(arguments)
      );
    }
  };
}
function hashObjectTask(filePath, write) {
  const commands = ["hash-object", filePath];
  if (write) {
    commands.push("-w");
  }
  return straightThroughStringTask(commands, true);
}
function parseInit(bare, path, text) {
  const response = String(text).trim();
  let result;
  if (result = initResponseRegex.exec(response)) {
    return new InitSummary(bare, path, false, result[1]);
  }
  if (result = reInitResponseRegex.exec(response)) {
    return new InitSummary(bare, path, true, result[1]);
  }
  let gitDir = "";
  const tokens = response.split(" ");
  while (tokens.length) {
    const token = tokens.shift();
    if (token === "in") {
      gitDir = tokens.join(" ");
      break;
    }
  }
  return new InitSummary(bare, path, /^re/i.test(response), gitDir);
}
function hasBareCommand(command) {
  return command.includes(bareCommand);
}
function initTask(bare = false, path, customArgs) {
  const commands = ["init", ...customArgs];
  if (bare && !hasBareCommand(commands)) {
    commands.splice(1, 0, bareCommand);
  }
  return {
    commands,
    format: "utf-8",
    parser(text) {
      return parseInit(commands.includes("--bare"), path, text);
    }
  };
}
function logFormatFromCommand(customArgs) {
  for (let i2 = 0; i2 < customArgs.length; i2++) {
    const format = logFormatRegex.exec(customArgs[i2]);
    if (format) {
      return `--${format[1]}`;
    }
  }
  return "";
}
function isLogFormat(customArg) {
  return logFormatRegex.test(customArg);
}
function getDiffParser(format = "") {
  const parser4 = diffSummaryParsers[format];
  return (stdOut) => parseStringResponse(new DiffSummary(), parser4, stdOut, false);
}
function lineBuilder(tokens, fields) {
  return fields.reduce(
    (line, field, index) => {
      line[field] = tokens[index] || "";
      return line;
    },
    /* @__PURE__ */ Object.create({ diff: null })
  );
}
function createListLogSummaryParser(splitter = SPLITTER, fields = defaultFieldNames, logFormat = "") {
  const parseDiffResult = getDiffParser(logFormat);
  return function(stdOut) {
    const all = toLinesWithContent(
      stdOut.trim(),
      false,
      START_BOUNDARY
    ).map(function(item) {
      const lineDetail = item.split(COMMIT_BOUNDARY);
      const listLogLine = lineBuilder(lineDetail[0].split(splitter), fields);
      if (lineDetail.length > 1 && !!lineDetail[1].trim()) {
        listLogLine.diff = parseDiffResult(lineDetail[1]);
      }
      return listLogLine;
    });
    return {
      all,
      latest: all.length && all[0] || null,
      total: all.length
    };
  };
}
function diffSummaryTask(customArgs) {
  let logFormat = logFormatFromCommand(customArgs);
  const commands = ["diff"];
  if (logFormat === "") {
    logFormat = "--stat";
    commands.push("--stat=4096");
  }
  commands.push(...customArgs);
  return validateLogFormatConfig(commands) || {
    commands,
    format: "utf-8",
    parser: getDiffParser(logFormat)
  };
}
function validateLogFormatConfig(customArgs) {
  const flags = customArgs.filter(isLogFormat);
  if (flags.length > 1) {
    return configurationErrorTask(
      `Summary flags are mutually exclusive - pick one of ${flags.join(",")}`
    );
  }
  if (flags.length && customArgs.includes("-z")) {
    return configurationErrorTask(
      `Summary flag ${flags} parsing is not compatible with null termination option '-z'`
    );
  }
}
function prettyFormat(format, splitter) {
  const fields = [];
  const formatStr = [];
  Object.keys(format).forEach((field) => {
    fields.push(field);
    formatStr.push(String(format[field]));
  });
  return [fields, formatStr.join(splitter)];
}
function userOptions(input) {
  return Object.keys(input).reduce((out, key) => {
    if (!(key in excludeOptions)) {
      out[key] = input[key];
    }
    return out;
  }, {});
}
function parseLogOptions(opt = {}, customArgs = []) {
  const splitter = filterType(opt.splitter, filterString, SPLITTER);
  const format = filterPlainObject(opt.format) ? opt.format : {
    hash: "%H",
    date: opt.strictDate === false ? "%ai" : "%aI",
    message: "%s",
    refs: "%D",
    body: opt.multiLine ? "%B" : "%b",
    author_name: opt.mailMap !== false ? "%aN" : "%an",
    author_email: opt.mailMap !== false ? "%aE" : "%ae"
  };
  const [fields, formatStr] = prettyFormat(format, splitter);
  const suffix = [];
  const command = [
    `--pretty=format:${START_BOUNDARY}${formatStr}${COMMIT_BOUNDARY}`,
    ...customArgs
  ];
  const maxCount = opt.n || opt["max-count"] || opt.maxCount;
  if (maxCount) {
    command.push(`--max-count=${maxCount}`);
  }
  if (opt.from || opt.to) {
    const rangeOperator = opt.symmetric !== false ? "..." : "..";
    suffix.push(`${opt.from || ""}${rangeOperator}${opt.to || ""}`);
  }
  if (filterString(opt.file)) {
    command.push("--follow", c(opt.file));
  }
  appendTaskOptions(userOptions(opt), command);
  return {
    fields,
    splitter,
    commands: [...command, ...suffix]
  };
}
function logTask(splitter, fields, customArgs) {
  const parser4 = createListLogSummaryParser(splitter, fields, logFormatFromCommand(customArgs));
  return {
    commands: ["log", ...customArgs],
    format: "utf-8",
    parser: parser4
  };
}
function log_default() {
  return {
    log(...rest) {
      const next = trailingFunctionArgument(arguments);
      const options = parseLogOptions(
        trailingOptionsArgument(arguments),
        asStringArray(filterType(arguments[0], filterArray, []))
      );
      const task = rejectDeprecatedSignatures(...rest) || validateLogFormatConfig(options.commands) || createLogTask(options);
      return this._runTask(task, next);
    }
  };
  function createLogTask(options) {
    return logTask(options.splitter, options.fields, options.commands);
  }
  function rejectDeprecatedSignatures(from, to) {
    return filterString(from) && filterString(to) && configurationErrorTask(
      `git.log(string, string) should be replaced with git.log({ from: string, to: string })`
    );
  }
}
function objectEnumerationResult(remoteMessages) {
  return remoteMessages.objects = remoteMessages.objects || {
    compressing: 0,
    counting: 0,
    enumerating: 0,
    packReused: 0,
    reused: { count: 0, delta: 0 },
    total: { count: 0, delta: 0 }
  };
}
function asObjectCount(source) {
  const count = /^\s*(\d+)/.exec(source);
  const delta = /delta (\d+)/i.exec(source);
  return {
    count: asNumber(count && count[1] || "0"),
    delta: asNumber(delta && delta[1] || "0")
  };
}
function parseRemoteMessages(_stdOut, stdErr) {
  return parseStringResponse({ remoteMessages: new RemoteMessageSummary() }, parsers2, stdErr);
}
function parsePullErrorResult(stdOut, stdErr) {
  const pullError = parseStringResponse(new PullFailedSummary(), errorParsers, [stdOut, stdErr]);
  return pullError.message && pullError;
}
function mergeTask(customArgs) {
  if (!customArgs.length) {
    return configurationErrorTask("Git.merge requires at least one option");
  }
  return {
    commands: ["merge", ...customArgs],
    format: "utf-8",
    parser(stdOut, stdErr) {
      const merge = parseMergeResult(stdOut, stdErr);
      if (merge.failed) {
        throw new GitResponseError(merge);
      }
      return merge;
    }
  };
}
function pushResultPushedItem(local, remote, status) {
  const deleted = status.includes("deleted");
  const tag = status.includes("tag") || /^refs\/tags/.test(local);
  const alreadyUpdated = !status.includes("new");
  return {
    deleted,
    tag,
    branch: !tag,
    new: !alreadyUpdated,
    alreadyUpdated,
    local,
    remote
  };
}
function pushTagsTask(ref = {}, customArgs) {
  append(customArgs, "--tags");
  return pushTask(ref, customArgs);
}
function pushTask(ref = {}, customArgs) {
  const commands = ["push", ...customArgs];
  if (ref.branch) {
    commands.splice(1, 0, ref.branch);
  }
  if (ref.remote) {
    commands.splice(1, 0, ref.remote);
  }
  remove(commands, "-v");
  append(commands, "--verbose");
  append(commands, "--porcelain");
  return {
    commands,
    format: "utf-8",
    parser: parsePushResult
  };
}
function show_default() {
  return {
    showBuffer() {
      const commands = ["show", ...getTrailingOptions(arguments, 1)];
      if (!commands.includes("--binary")) {
        commands.splice(1, 0, "--binary");
      }
      return this._runTask(
        straightThroughBufferTask(commands),
        trailingFunctionArgument(arguments)
      );
    },
    show() {
      const commands = ["show", ...getTrailingOptions(arguments, 1)];
      return this._runTask(
        straightThroughStringTask(commands),
        trailingFunctionArgument(arguments)
      );
    }
  };
}
function renamedFile(line) {
  const [to, from] = line.split(NULL);
  return {
    from: from || to,
    to
  };
}
function parser3(indexX, indexY, handler) {
  return [`${indexX}${indexY}`, handler];
}
function conflicts(indexX, ...indexY) {
  return indexY.map((y2) => parser3(indexX, y2, (result, file) => result.conflicted.push(file)));
}
function splitLine(result, lineStr) {
  const trimmed2 = lineStr.trim();
  switch (" ") {
    case trimmed2.charAt(2):
      return data(trimmed2.charAt(0), trimmed2.charAt(1), trimmed2.slice(3));
    case trimmed2.charAt(1):
      return data(" ", trimmed2.charAt(0), trimmed2.slice(2));
    default:
      return;
  }
  function data(index, workingDir, path) {
    const raw = `${index}${workingDir}`;
    const handler = parsers6.get(raw);
    if (handler) {
      handler(result, path);
    }
    if (raw !== "##" && raw !== "!!") {
      result.files.push(new FileStatusSummary(path, index, workingDir));
    }
  }
}
function statusTask(customArgs) {
  const commands = [
    "status",
    "--porcelain",
    "-b",
    "-u",
    "--null",
    ...customArgs.filter((arg) => !ignoredOptions.includes(arg))
  ];
  return {
    format: "utf-8",
    commands,
    parser(text) {
      return parseStatusSummary(text);
    }
  };
}
function versionResponse(major = 0, minor = 0, patch = 0, agent = "", installed = true) {
  return Object.defineProperty(
    {
      major,
      minor,
      patch,
      agent,
      installed
    },
    "toString",
    {
      value() {
        return `${this.major}.${this.minor}.${this.patch}`;
      },
      configurable: false,
      enumerable: false
    }
  );
}
function notInstalledResponse() {
  return versionResponse(0, 0, 0, "", false);
}
function version_default() {
  return {
    version() {
      return this._runTask({
        commands: ["--version"],
        format: "utf-8",
        parser: versionParser,
        onError(result, error, done, fail) {
          if (result.exitCode === -2) {
            return done(Buffer.from(NOT_INSTALLED));
          }
          fail(error);
        }
      });
    }
  };
}
function versionParser(stdOut) {
  if (stdOut === NOT_INSTALLED) {
    return notInstalledResponse();
  }
  return parseStringResponse(versionResponse(0, 0, 0, stdOut), parsers7, stdOut);
}
function createCloneTask(api, task, repoPath, ...args) {
  if (!filterString(repoPath)) {
    return configurationErrorTask(`git.${api}() requires a string 'repoPath'`);
  }
  return task(repoPath, filterType(args[0], filterString), getTrailingOptions(arguments));
}
function clone_default() {
  return {
    clone(repo, ...rest) {
      return this._runTask(
        createCloneTask("clone", cloneTask, filterType(repo, filterString), ...rest),
        trailingFunctionArgument(arguments)
      );
    },
    mirror(repo, ...rest) {
      return this._runTask(
        createCloneTask("mirror", cloneMirrorTask, filterType(repo, filterString), ...rest),
        trailingFunctionArgument(arguments)
      );
    }
  };
}
function applyPatchTask(patches, customArgs) {
  return straightThroughStringTask(["apply", ...customArgs, ...patches]);
}
function branchDeletionSuccess(branch, hash) {
  return {
    branch,
    hash,
    success: true
  };
}
function branchDeletionFailure(branch) {
  return {
    branch,
    hash: null,
    success: false
  };
}
function hasBranchDeletionError(data, processExitCode) {
  return processExitCode === 1 && deleteErrorRegex.test(data);
}
function branchStatus(input) {
  return input ? input.charAt(0) : "";
}
function parseBranchSummary(stdOut, currentOnly = false) {
  return parseStringResponse(
    new BranchSummaryResult(),
    currentOnly ? [currentBranchParser] : parsers9,
    stdOut
  );
}
function containsDeleteBranchCommand(commands) {
  const deleteCommands = ["-d", "-D", "--delete"];
  return commands.some((command) => deleteCommands.includes(command));
}
function branchTask(customArgs) {
  const isDelete = containsDeleteBranchCommand(customArgs);
  const isCurrentOnly = customArgs.includes("--show-current");
  const commands = ["branch", ...customArgs];
  if (commands.length === 1) {
    commands.push("-a");
  }
  if (!commands.includes("-v")) {
    commands.splice(1, 0, "-v");
  }
  return {
    format: "utf-8",
    commands,
    parser(stdOut, stdErr) {
      if (isDelete) {
        return parseBranchDeletions(stdOut, stdErr).all[0];
      }
      return parseBranchSummary(stdOut, isCurrentOnly);
    }
  };
}
function branchLocalTask() {
  return {
    format: "utf-8",
    commands: ["branch", "-v"],
    parser(stdOut) {
      return parseBranchSummary(stdOut);
    }
  };
}
function deleteBranchesTask(branches, forceDelete = false) {
  return {
    format: "utf-8",
    commands: ["branch", "-v", forceDelete ? "-D" : "-d", ...branches],
    parser(stdOut, stdErr) {
      return parseBranchDeletions(stdOut, stdErr);
    },
    onError({ exitCode, stdOut }, error, done, fail) {
      if (!hasBranchDeletionError(String(error), exitCode)) {
        return fail(error);
      }
      done(stdOut);
    }
  };
}
function deleteBranchTask(branch, forceDelete = false) {
  const task = {
    format: "utf-8",
    commands: ["branch", "-v", forceDelete ? "-D" : "-d", branch],
    parser(stdOut, stdErr) {
      return parseBranchDeletions(stdOut, stdErr).branches[branch];
    },
    onError({ exitCode, stdErr, stdOut }, error, _2, fail) {
      if (!hasBranchDeletionError(String(error), exitCode)) {
        return fail(error);
      }
      throw new GitResponseError(
        task.parser(bufferToString(stdOut), bufferToString(stdErr)),
        String(error)
      );
    }
  };
  return task;
}
function toPath(input) {
  const path = input.trim().replace(/^["']|["']$/g, "");
  return path && normalize(path);
}
function checkIgnoreTask(paths) {
  return {
    commands: ["check-ignore", ...paths],
    format: "utf-8",
    parser: parseCheckIgnore
  };
}
function parseFetchResult(stdOut, stdErr) {
  const result = {
    raw: stdOut,
    remote: null,
    branches: [],
    tags: [],
    updated: [],
    deleted: []
  };
  return parseStringResponse(result, parsers10, [stdOut, stdErr]);
}
function disallowedCommand(command) {
  return /^--upload-pack(=|$)/.test(command);
}
function fetchTask(remote, branch, customArgs) {
  const commands = ["fetch", ...customArgs];
  if (remote && branch) {
    commands.push(remote, branch);
  }
  const banned = commands.find(disallowedCommand);
  if (banned) {
    return configurationErrorTask(`git.fetch: potential exploit argument blocked.`);
  }
  return {
    commands,
    format: "utf-8",
    parser: parseFetchResult
  };
}
function parseMoveResult(stdOut) {
  return parseStringResponse({ moves: [] }, parsers11, stdOut);
}
function moveTask(from, to) {
  return {
    commands: ["mv", "-v", ...asArray(from), to],
    format: "utf-8",
    parser: parseMoveResult
  };
}
function pullTask(remote, branch, customArgs) {
  const commands = ["pull", ...customArgs];
  if (remote && branch) {
    commands.splice(1, 0, remote, branch);
  }
  return {
    commands,
    format: "utf-8",
    parser(stdOut, stdErr) {
      return parsePullResult(stdOut, stdErr);
    },
    onError(result, _error, _done, fail) {
      const pullError = parsePullErrorResult(
        bufferToString(result.stdOut),
        bufferToString(result.stdErr)
      );
      if (pullError) {
        return fail(new GitResponseError(pullError));
      }
      fail(_error);
    }
  };
}
function parseGetRemotes(text) {
  const remotes = {};
  forEach(text, ([name]) => remotes[name] = { name });
  return Object.values(remotes);
}
function parseGetRemotesVerbose(text) {
  const remotes = {};
  forEach(text, ([name, url, purpose]) => {
    if (!Object.hasOwn(remotes, name)) {
      remotes[name] = {
        name,
        refs: { fetch: "", push: "" }
      };
    }
    if (purpose && url) {
      remotes[name].refs[purpose.replace(/[^a-z]/g, "")] = url;
    }
  });
  return Object.values(remotes);
}
function forEach(text, handler) {
  forEachLineWithContent(text, (line) => handler(line.split(/\s+/)));
}
function addRemoteTask(remoteName, remoteRepo, customArgs) {
  return straightThroughStringTask(["remote", "add", ...customArgs, remoteName, remoteRepo]);
}
function getRemotesTask(verbose) {
  const commands = ["remote"];
  if (verbose) {
    commands.push("-v");
  }
  return {
    commands,
    format: "utf-8",
    parser: verbose ? parseGetRemotesVerbose : parseGetRemotes
  };
}
function listRemotesTask(customArgs) {
  const commands = [...customArgs];
  if (commands[0] !== "ls-remote") {
    commands.unshift("ls-remote");
  }
  return straightThroughStringTask(commands);
}
function remoteTask(customArgs) {
  const commands = [...customArgs];
  if (commands[0] !== "remote") {
    commands.unshift("remote");
  }
  return straightThroughStringTask(commands);
}
function removeRemoteTask(remoteName) {
  return straightThroughStringTask(["remote", "remove", remoteName]);
}
function stashListTask(opt = {}, customArgs) {
  const options = parseLogOptions(opt);
  const commands = ["stash", "list", ...options.commands, ...customArgs];
  const parser4 = createListLogSummaryParser(
    options.splitter,
    options.fields,
    logFormatFromCommand(commands)
  );
  return validateLogFormatConfig(commands) || {
    commands,
    format: "utf-8",
    parser: parser4
  };
}
function addSubModuleTask(repo, path) {
  return subModuleTask(["add", repo, path]);
}
function initSubModuleTask(customArgs) {
  return subModuleTask(["init", ...customArgs]);
}
function subModuleTask(customArgs) {
  const commands = [...customArgs];
  if (commands[0] !== "submodule") {
    commands.unshift("submodule");
  }
  return straightThroughStringTask(commands);
}
function updateSubModuleTask(customArgs) {
  return subModuleTask(["update", ...customArgs]);
}
function singleSorted(a, b2) {
  const aIsNum = Number.isNaN(a);
  const bIsNum = Number.isNaN(b2);
  if (aIsNum !== bIsNum) {
    return aIsNum ? 1 : -1;
  }
  return aIsNum ? sorted(a, b2) : 0;
}
function sorted(a, b2) {
  return a === b2 ? 0 : a > b2 ? 1 : -1;
}
function trimmed(input) {
  return input.trim();
}
function toNumber(input) {
  if (typeof input === "string") {
    return parseInt(input.replace(/^\D+/g, ""), 10) || 0;
  }
  return 0;
}
function tagListTask(customArgs = []) {
  const hasCustomSort = customArgs.some((option) => /^--sort=/.test(option));
  return {
    format: "utf-8",
    commands: ["tag", "-l", ...customArgs],
    parser(text) {
      return parseTagList(text, hasCustomSort);
    }
  };
}
function addTagTask(name) {
  return {
    format: "utf-8",
    commands: ["tag", name],
    parser() {
      return { name };
    }
  };
}
function addAnnotatedTagTask(name, tagMessage) {
  return {
    format: "utf-8",
    commands: ["tag", "-a", "-m", tagMessage, name],
    parser() {
      return { name };
    }
  };
}
function abortPlugin(signal) {
  if (!signal) {
    return;
  }
  const onSpawnAfter = {
    type: "spawn.after",
    action(_data, context) {
      function kill() {
        context.kill(new GitPluginError(void 0, "abort", "Abort signal received"));
      }
      signal.addEventListener("abort", kill);
      context.spawned.on("close", () => signal.removeEventListener("abort", kill));
    }
  };
  const onSpawnBefore = {
    type: "spawn.before",
    action(_data, context) {
      if (signal.aborted) {
        context.kill(new GitPluginError(void 0, "abort", "Abort already signaled"));
      }
    }
  };
  return [onSpawnBefore, onSpawnAfter];
}
function blockUnsafeOperationsPlugin(options = {}) {
  return {
    type: "spawn.args",
    action(args, { env }) {
      for (const vulnerability of ne(args, env)) {
        if (options[vulnerability.category] !== true) {
          throw new GitPluginError(void 0, "unsafe", vulnerability.message);
        }
      }
      return args;
    }
  };
}
function commandConfigPrefixingPlugin(configuration) {
  const prefix = prefixedArray(configuration, "-c");
  return {
    type: "spawn.args",
    action(data) {
      return [...prefix, ...data];
    }
  };
}
function completionDetectionPlugin({
  onClose = true,
  onExit = 50
} = {}) {
  function createEvents() {
    let exitCode = -1;
    const events = {
      close: (0, import_promise_deferred2.deferred)(),
      closeTimeout: (0, import_promise_deferred2.deferred)(),
      exit: (0, import_promise_deferred2.deferred)(),
      exitTimeout: (0, import_promise_deferred2.deferred)()
    };
    const result = Promise.race([
      onClose === false ? never : events.closeTimeout.promise,
      onExit === false ? never : events.exitTimeout.promise
    ]);
    configureTimeout(onClose, events.close, events.closeTimeout);
    configureTimeout(onExit, events.exit, events.exitTimeout);
    return {
      close(code) {
        exitCode = code;
        events.close.done();
      },
      exit(code) {
        exitCode = code;
        events.exit.done();
      },
      get exitCode() {
        return exitCode;
      },
      result
    };
  }
  function configureTimeout(flag, event, timeout) {
    if (flag === false) {
      return;
    }
    (flag === true ? event.promise : event.promise.then(() => delay(flag))).then(timeout.done);
  }
  return {
    type: "spawn.after",
    async action(_data, { spawned, close }) {
      const events = createEvents();
      let deferClose = true;
      let quickClose = () => void (deferClose = false);
      spawned.stdout?.on("data", quickClose);
      spawned.stderr?.on("data", quickClose);
      spawned.on("error", quickClose);
      spawned.on("close", (code) => events.close(code));
      spawned.on("exit", (code) => events.exit(code));
      try {
        await events.result;
        if (deferClose) {
          await delay(50);
        }
        close(events.exitCode);
      } catch (err) {
        close(events.exitCode, err);
      }
    }
  };
}
function isBadArgument(arg) {
  return !arg || !/^([a-z]:)?([a-z0-9/.\\_~-]+)$/i.test(arg);
}
function toBinaryConfig(input, allowUnsafe) {
  if (input.length < 1 || input.length > 2) {
    throw new GitPluginError(void 0, "binary", WRONG_NUMBER_ERR);
  }
  const isBad = input.some(isBadArgument);
  if (isBad) {
    if (allowUnsafe) {
      console.warn(WRONG_CHARS_ERR);
    } else {
      throw new GitPluginError(void 0, "binary", WRONG_CHARS_ERR);
    }
  }
  const [binary, prefix] = input;
  return {
    binary,
    prefix
  };
}
function customBinaryPlugin(plugins, input = ["git"], allowUnsafe = false) {
  let config = toBinaryConfig(asArray(input), allowUnsafe);
  plugins.on("binary", (input2) => {
    config = toBinaryConfig(asArray(input2), allowUnsafe);
  });
  plugins.append("spawn.binary", () => {
    return config.binary;
  });
  plugins.append("spawn.args", (data) => {
    return config.prefix ? [config.prefix, ...data] : data;
  });
}
function isTaskError(result) {
  return !!(result.exitCode && result.stdErr.length);
}
function getErrorMessage(result) {
  return Buffer.concat([...result.stdOut, ...result.stdErr]);
}
function errorDetectionHandler(overwrite = false, isError = isTaskError, errorMessage = getErrorMessage) {
  return (error, result) => {
    if (!overwrite && error || !isError(result)) {
      return error;
    }
    return errorMessage(result);
  };
}
function errorDetectionPlugin(config) {
  return {
    type: "task.error",
    action(data, context) {
      const error = config(data.error, {
        stdErr: context.stdErr,
        stdOut: context.stdOut,
        exitCode: context.exitCode
      });
      if (Buffer.isBuffer(error)) {
        return { error: new GitError(void 0, error.toString("utf-8")) };
      }
      return {
        error
      };
    }
  };
}
function progressMonitorPlugin(progress) {
  const progressCommand = "--progress";
  const progressMethods = ["checkout", "clone", "fetch", "pull", "push"];
  const onProgress = {
    type: "spawn.after",
    action(_data, context) {
      if (!context.commands.includes(progressCommand)) {
        return;
      }
      context.spawned.stderr?.on("data", (chunk) => {
        const message = /^([\s\S]+?):\s*(\d+)% \((\d+)\/(\d+)\)/.exec(chunk.toString("utf8"));
        if (!message) {
          return;
        }
        progress({
          method: context.method,
          stage: progressEventStage(message[1]),
          progress: asNumber(message[2]),
          processed: asNumber(message[3]),
          total: asNumber(message[4])
        });
      });
    }
  };
  const onArgs = {
    type: "spawn.args",
    action(args, context) {
      if (!progressMethods.includes(context.method)) {
        return args;
      }
      return including(args, progressCommand);
    }
  };
  return [onArgs, onProgress];
}
function progressEventStage(input) {
  return String(input.toLowerCase().split(" ", 1)) || "unknown";
}
function spawnOptionsPlugin(spawnOptions) {
  const options = pick(spawnOptions, ["uid", "gid"]);
  return {
    type: "spawn.options",
    action(data) {
      return { ...options, ...data };
    }
  };
}
function timeoutPlugin({
  block,
  stdErr = true,
  stdOut = true
}) {
  if (block > 0) {
    return {
      type: "spawn.after",
      action(_data, context) {
        let timeout;
        function wait() {
          timeout && clearTimeout(timeout);
          timeout = setTimeout(kill, block);
        }
        function stop() {
          context.spawned.stdout?.off("data", wait);
          context.spawned.stderr?.off("data", wait);
          context.spawned.off("exit", stop);
          context.spawned.off("close", stop);
          timeout && clearTimeout(timeout);
        }
        function kill() {
          stop();
          context.kill(new GitPluginError(void 0, "timeout", `block timeout reached`));
        }
        stdOut && context.spawned.stdout?.on("data", wait);
        stdErr && context.spawned.stderr?.on("data", wait);
        context.spawned.on("exit", stop);
        context.spawned.on("close", stop);
        wait();
      }
    };
  }
}
function suffixPathsPlugin() {
  return {
    type: "spawn.args",
    action(data) {
      const prefix = [];
      let suffix;
      function append2(args) {
        (suffix = suffix || []).push(...args);
      }
      for (let i2 = 0; i2 < data.length; i2++) {
        const param = data[i2];
        if (r(param)) {
          append2(o(param));
          continue;
        }
        if (param === "--") {
          append2(
            data.slice(i2 + 1).flatMap((item) => r(item) && o(item) || item)
          );
          break;
        }
        prefix.push(param);
      }
      return !suffix ? prefix : [...prefix, "--", ...suffix.map(String)];
    }
  };
}
function gitInstanceFactory(baseDir, options) {
  const plugins = new PluginStore();
  const config = createInstanceConfig(
    baseDir && (typeof baseDir === "string" ? { baseDir } : baseDir) || {},
    options
  );
  if (!folderExists(config.baseDir)) {
    throw new GitConstructError(
      config,
      `Cannot use simple-git on a directory that does not exist`
    );
  }
  if (Array.isArray(config.config)) {
    plugins.add(commandConfigPrefixingPlugin(config.config));
  }
  plugins.add(blockUnsafeOperationsPlugin(config.unsafe));
  plugins.add(completionDetectionPlugin(config.completion));
  config.abort && plugins.add(abortPlugin(config.abort));
  config.progress && plugins.add(progressMonitorPlugin(config.progress));
  config.timeout && plugins.add(timeoutPlugin(config.timeout));
  config.spawnOptions && plugins.add(spawnOptionsPlugin(config.spawnOptions));
  plugins.add(suffixPathsPlugin());
  plugins.add(errorDetectionPlugin(errorDetectionHandler(true)));
  config.errors && plugins.add(errorDetectionPlugin(config.errors));
  customBinaryPlugin(plugins, config.binary, config.unsafe?.allowUnsafeCustomBinary);
  return new Git(config, plugins);
}
var import_file_exists, import_debug, import_promise_deferred, import_promise_deferred2, __defProp2, __getOwnPropDesc2, __getOwnPropNames2, __hasOwnProp2, __esm2, __commonJS2, __export2, __copyProps2, __toCommonJS, GitError, init_git_error, GitResponseError, init_git_response_error, TaskConfigurationError, init_task_configuration_error, NULL, NOOP, objectToString, init_util, filterArray, filterNumber, filterString, filterStringOrStringArray, filterHasLength, init_argument_filters, ExitCodes, init_exit_codes, GitOutputStreams, init_git_output_streams, LineParser, RemoteLineParser, init_line_parser, defaultOptions, init_simple_git_options, init_task_options, init_task_parser, utils_exports, init_utils, check_is_repo_exports, CheckRepoActions, onError, parser, init_check_is_repo, CleanResponse, removalRegexp, dryRunRemovalRegexp, isFolderRegexp, init_CleanSummary, task_exports, EMPTY_COMMANDS, init_task, clean_exports, CONFIG_ERROR_INTERACTIVE_MODE, CONFIG_ERROR_MODE_REQUIRED, CONFIG_ERROR_UNKNOWN_OPTION, CleanOptions, CleanOptionValues, init_clean, ConfigList, init_ConfigList, GitConfigScope, init_config2, DiffNameStatus, diffNameStatus, init_diff_name_status, disallowedOptions, Query, _a, GrepQuery, init_grep, reset_exports, ResetMode, validResetModes, init_reset, init_git_logger, TasksPendingQueue, init_tasks_pending_queue, GitExecutorChain, init_git_executor_chain, git_executor_exports, GitExecutor, init_git_executor, init_task_callback, init_change_working_directory, init_checkout, parser2, init_count_objects, parsers, init_parse_commit, init_commit, init_first_commit, init_hash_object, InitSummary, initResponseRegex, reInitResponseRegex, init_InitSummary, bareCommand, init_init, logFormatRegex, init_log_format, DiffSummary, init_DiffSummary, statParser, numStatParser, nameOnlyParser, nameStatusParser, diffSummaryParsers, init_parse_diff_summary, START_BOUNDARY, COMMIT_BOUNDARY, SPLITTER, defaultFieldNames, init_parse_list_log_summary, diff_exports, init_diff, excludeOptions, init_log, MergeSummaryConflict, MergeSummaryDetail, init_MergeSummary, PullSummary, PullFailedSummary, init_PullSummary, remoteMessagesObjectParsers, init_parse_remote_objects, parsers2, RemoteMessageSummary, init_parse_remote_messages, FILE_UPDATE_REGEX, SUMMARY_REGEX, ACTION_REGEX, parsers3, errorParsers, parsePullDetail, parsePullResult, init_parse_pull, parsers4, parseMergeResult, parseMergeDetail, init_parse_merge, init_merge, parsers5, parsePushResult, parsePushDetail, init_parse_push, push_exports, init_push, init_show, fromPathRegex, FileStatusSummary, init_FileStatusSummary, StatusSummary, parsers6, parseStatusSummary, init_StatusSummary, ignoredOptions, init_status, NOT_INSTALLED, parsers7, init_version, cloneTask, cloneMirrorTask, init_clone, simple_git_api_exports, SimpleGitApi, init_simple_git_api, scheduler_exports, createScheduledTask, Scheduler, init_scheduler, apply_patch_exports, init_apply_patch, BranchDeletionBatch, init_BranchDeleteSummary, deleteSuccessRegex, deleteErrorRegex, parsers8, parseBranchDeletions, init_parse_branch_delete, BranchSummaryResult, init_BranchSummary, parsers9, currentBranchParser, init_parse_branch, branch_exports, init_branch, parseCheckIgnore, init_CheckIgnore, check_ignore_exports, init_check_ignore, parsers10, init_parse_fetch, fetch_exports, init_fetch, parsers11, init_parse_move, move_exports, init_move, pull_exports, init_pull, init_GetRemoteSummary, remote_exports, init_remote, stash_list_exports, init_stash_list, sub_module_exports, init_sub_module, TagList, parseTagList, init_TagList, tag_exports, init_tag, require_git, GitConstructError, GitPluginError, never, WRONG_NUMBER_ERR, WRONG_CHARS_ERR, PluginStore, Git, simpleGit;
var init_esm = __esm({
  "../../../node_modules/.pnpm/simple-git@3.36.0/node_modules/simple-git/dist/esm/index.js"() {
    import_file_exists = __toESM(require_dist(), 1);
    init_dist();
    init_dist();
    import_debug = __toESM(require_src(), 1);
    init_dist();
    init_dist();
    import_promise_deferred = __toESM(require_dist2(), 1);
    init_dist();
    init_dist2();
    import_promise_deferred2 = __toESM(require_dist2(), 1);
    init_dist();
    __defProp2 = Object.defineProperty;
    __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
    __getOwnPropNames2 = Object.getOwnPropertyNames;
    __hasOwnProp2 = Object.prototype.hasOwnProperty;
    __esm2 = (fn, res) => function __init() {
      return fn && (res = (0, fn[__getOwnPropNames2(fn)[0]])(fn = 0)), res;
    };
    __commonJS2 = (cb, mod) => function __require2() {
      return mod || (0, cb[__getOwnPropNames2(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    };
    __export2 = (target, all) => {
      for (var name in all)
        __defProp2(target, name, { get: all[name], enumerable: true });
    };
    __copyProps2 = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames2(from))
          if (!__hasOwnProp2.call(to, key) && key !== except)
            __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
      }
      return to;
    };
    __toCommonJS = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
    init_git_error = __esm2({
      "src/lib/errors/git-error.ts"() {
        "use strict";
        GitError = class extends Error {
          constructor(task, message) {
            super(message);
            this.task = task;
            Object.setPrototypeOf(this, new.target.prototype);
          }
        };
      }
    });
    init_git_response_error = __esm2({
      "src/lib/errors/git-response-error.ts"() {
        "use strict";
        init_git_error();
        GitResponseError = class extends GitError {
          constructor(git, message) {
            super(void 0, message || String(git));
            this.git = git;
          }
        };
      }
    });
    init_task_configuration_error = __esm2({
      "src/lib/errors/task-configuration-error.ts"() {
        "use strict";
        init_git_error();
        TaskConfigurationError = class extends GitError {
          constructor(message) {
            super(void 0, message);
          }
        };
      }
    });
    init_util = __esm2({
      "src/lib/utils/util.ts"() {
        "use strict";
        init_argument_filters();
        NULL = "\0";
        NOOP = () => {
        };
        objectToString = Object.prototype.toString.call.bind(Object.prototype.toString);
      }
    });
    init_argument_filters = __esm2({
      "src/lib/utils/argument-filters.ts"() {
        "use strict";
        init_util();
        filterArray = (input) => {
          return Array.isArray(input);
        };
        filterNumber = (input) => {
          return typeof input === "number";
        };
        filterString = (input) => {
          return typeof input === "string" || r(input);
        };
        filterStringOrStringArray = (input) => {
          return filterString(input) || Array.isArray(input) && input.every(filterString);
        };
        filterHasLength = (input) => {
          if (input == null || "number|boolean|function".includes(typeof input)) {
            return false;
          }
          return typeof input.length === "number";
        };
      }
    });
    init_exit_codes = __esm2({
      "src/lib/utils/exit-codes.ts"() {
        "use strict";
        ExitCodes = /* @__PURE__ */ ((ExitCodes2) => {
          ExitCodes2[ExitCodes2["SUCCESS"] = 0] = "SUCCESS";
          ExitCodes2[ExitCodes2["ERROR"] = 1] = "ERROR";
          ExitCodes2[ExitCodes2["NOT_FOUND"] = -2] = "NOT_FOUND";
          ExitCodes2[ExitCodes2["UNCLEAN"] = 128] = "UNCLEAN";
          return ExitCodes2;
        })(ExitCodes || {});
      }
    });
    init_git_output_streams = __esm2({
      "src/lib/utils/git-output-streams.ts"() {
        "use strict";
        GitOutputStreams = class _GitOutputStreams {
          constructor(stdOut, stdErr) {
            this.stdOut = stdOut;
            this.stdErr = stdErr;
          }
          asStrings() {
            return new _GitOutputStreams(this.stdOut.toString("utf8"), this.stdErr.toString("utf8"));
          }
        };
      }
    });
    init_line_parser = __esm2({
      "src/lib/utils/line-parser.ts"() {
        "use strict";
        LineParser = class {
          constructor(regExp, useMatches) {
            this.matches = [];
            this.useMatches = useMatchesDefault;
            this.parse = (line, target) => {
              this.resetMatches();
              if (!this._regExp.every((reg, index) => this.addMatch(reg, index, line(index)))) {
                return false;
              }
              return this.useMatches(target, this.prepareMatches()) !== false;
            };
            this._regExp = Array.isArray(regExp) ? regExp : [regExp];
            if (useMatches) {
              this.useMatches = useMatches;
            }
          }
          resetMatches() {
            this.matches.length = 0;
          }
          prepareMatches() {
            return this.matches;
          }
          addMatch(reg, index, line) {
            const matched = line && reg.exec(line);
            if (matched) {
              this.pushMatch(index, matched);
            }
            return !!matched;
          }
          pushMatch(_index, matched) {
            this.matches.push(...matched.slice(1));
          }
        };
        RemoteLineParser = class extends LineParser {
          addMatch(reg, index, line) {
            return /^remote:\s/.test(String(line)) && super.addMatch(reg, index, line);
          }
          pushMatch(index, matched) {
            if (index > 0 || matched.length > 1) {
              super.pushMatch(index, matched);
            }
          }
        };
      }
    });
    init_simple_git_options = __esm2({
      "src/lib/utils/simple-git-options.ts"() {
        "use strict";
        defaultOptions = {
          binary: "git",
          maxConcurrentProcesses: 5,
          config: [],
          trimmed: false
        };
      }
    });
    init_task_options = __esm2({
      "src/lib/utils/task-options.ts"() {
        "use strict";
        init_argument_filters();
        init_util();
      }
    });
    init_task_parser = __esm2({
      "src/lib/utils/task-parser.ts"() {
        "use strict";
        init_util();
      }
    });
    utils_exports = {};
    __export2(utils_exports, {
      ExitCodes: () => ExitCodes,
      GitOutputStreams: () => GitOutputStreams,
      LineParser: () => LineParser,
      NOOP: () => NOOP,
      NULL: () => NULL,
      RemoteLineParser: () => RemoteLineParser,
      append: () => append,
      appendTaskOptions: () => appendTaskOptions,
      asArray: () => asArray,
      asCamelCase: () => asCamelCase,
      asFunction: () => asFunction,
      asNumber: () => asNumber,
      asStringArray: () => asStringArray,
      bufferToString: () => bufferToString,
      callTaskParser: () => callTaskParser,
      createInstanceConfig: () => createInstanceConfig,
      delay: () => delay,
      filterArray: () => filterArray,
      filterFunction: () => filterFunction,
      filterHasLength: () => filterHasLength,
      filterNumber: () => filterNumber,
      filterPlainObject: () => filterPlainObject,
      filterPrimitives: () => filterPrimitives,
      filterString: () => filterString,
      filterStringOrStringArray: () => filterStringOrStringArray,
      filterType: () => filterType,
      first: () => first,
      folderExists: () => folderExists,
      forEachLineWithContent: () => forEachLineWithContent,
      getTrailingOptions: () => getTrailingOptions,
      including: () => including,
      isUserFunction: () => isUserFunction,
      last: () => last,
      objectToString: () => objectToString,
      orVoid: () => orVoid,
      parseStringResponse: () => parseStringResponse,
      pick: () => pick,
      prefixedArray: () => prefixedArray,
      remove: () => remove,
      splitOn: () => splitOn,
      toLinesWithContent: () => toLinesWithContent,
      trailingFunctionArgument: () => trailingFunctionArgument,
      trailingOptionsArgument: () => trailingOptionsArgument
    });
    init_utils = __esm2({
      "src/lib/utils/index.ts"() {
        "use strict";
        init_argument_filters();
        init_exit_codes();
        init_git_output_streams();
        init_line_parser();
        init_simple_git_options();
        init_task_options();
        init_task_parser();
        init_util();
      }
    });
    check_is_repo_exports = {};
    __export2(check_is_repo_exports, {
      CheckRepoActions: () => CheckRepoActions,
      checkIsBareRepoTask: () => checkIsBareRepoTask,
      checkIsRepoRootTask: () => checkIsRepoRootTask,
      checkIsRepoTask: () => checkIsRepoTask
    });
    init_check_is_repo = __esm2({
      "src/lib/tasks/check-is-repo.ts"() {
        "use strict";
        init_utils();
        CheckRepoActions = /* @__PURE__ */ ((CheckRepoActions2) => {
          CheckRepoActions2["BARE"] = "bare";
          CheckRepoActions2["IN_TREE"] = "tree";
          CheckRepoActions2["IS_REPO_ROOT"] = "root";
          return CheckRepoActions2;
        })(CheckRepoActions || {});
        onError = ({ exitCode }, error, done, fail) => {
          if (exitCode === 128 && isNotRepoMessage(error)) {
            return done(Buffer.from("false"));
          }
          fail(error);
        };
        parser = (text) => {
          return text.trim() === "true";
        };
      }
    });
    init_CleanSummary = __esm2({
      "src/lib/responses/CleanSummary.ts"() {
        "use strict";
        init_utils();
        CleanResponse = class {
          constructor(dryRun) {
            this.dryRun = dryRun;
            this.paths = [];
            this.files = [];
            this.folders = [];
          }
        };
        removalRegexp = /^[a-z]+\s*/i;
        dryRunRemovalRegexp = /^[a-z]+\s+[a-z]+\s*/i;
        isFolderRegexp = /\/$/;
      }
    });
    task_exports = {};
    __export2(task_exports, {
      EMPTY_COMMANDS: () => EMPTY_COMMANDS,
      adhocExecTask: () => adhocExecTask,
      configurationErrorTask: () => configurationErrorTask,
      isBufferTask: () => isBufferTask,
      isEmptyTask: () => isEmptyTask,
      straightThroughBufferTask: () => straightThroughBufferTask,
      straightThroughStringTask: () => straightThroughStringTask
    });
    init_task = __esm2({
      "src/lib/tasks/task.ts"() {
        "use strict";
        init_task_configuration_error();
        EMPTY_COMMANDS = [];
      }
    });
    clean_exports = {};
    __export2(clean_exports, {
      CONFIG_ERROR_INTERACTIVE_MODE: () => CONFIG_ERROR_INTERACTIVE_MODE,
      CONFIG_ERROR_MODE_REQUIRED: () => CONFIG_ERROR_MODE_REQUIRED,
      CONFIG_ERROR_UNKNOWN_OPTION: () => CONFIG_ERROR_UNKNOWN_OPTION,
      CleanOptions: () => CleanOptions,
      cleanTask: () => cleanTask,
      cleanWithOptionsTask: () => cleanWithOptionsTask,
      isCleanOptionsArray: () => isCleanOptionsArray
    });
    init_clean = __esm2({
      "src/lib/tasks/clean.ts"() {
        "use strict";
        init_CleanSummary();
        init_utils();
        init_task();
        CONFIG_ERROR_INTERACTIVE_MODE = "Git clean interactive mode is not supported";
        CONFIG_ERROR_MODE_REQUIRED = 'Git clean mode parameter ("n" or "f") is required';
        CONFIG_ERROR_UNKNOWN_OPTION = "Git clean unknown option found in: ";
        CleanOptions = /* @__PURE__ */ ((CleanOptions2) => {
          CleanOptions2["DRY_RUN"] = "n";
          CleanOptions2["FORCE"] = "f";
          CleanOptions2["IGNORED_INCLUDED"] = "x";
          CleanOptions2["IGNORED_ONLY"] = "X";
          CleanOptions2["EXCLUDING"] = "e";
          CleanOptions2["QUIET"] = "q";
          CleanOptions2["RECURSIVE"] = "d";
          return CleanOptions2;
        })(CleanOptions || {});
        CleanOptionValues = /* @__PURE__ */ new Set([
          "i",
          ...asStringArray(Object.values(CleanOptions))
        ]);
      }
    });
    init_ConfigList = __esm2({
      "src/lib/responses/ConfigList.ts"() {
        "use strict";
        init_utils();
        ConfigList = class {
          constructor() {
            this.files = [];
            this.values = /* @__PURE__ */ Object.create(null);
          }
          get all() {
            if (!this._all) {
              this._all = this.files.reduce((all, file) => {
                return Object.assign(all, this.values[file]);
              }, {});
            }
            return this._all;
          }
          addFile(file) {
            if (!(file in this.values)) {
              const latest = last(this.files);
              this.values[file] = latest ? Object.create(this.values[latest]) : {};
              this.files.push(file);
            }
            return this.values[file];
          }
          addValue(file, key, value) {
            const values = this.addFile(file);
            if (!Object.hasOwn(values, key)) {
              values[key] = value;
            } else if (Array.isArray(values[key])) {
              values[key].push(value);
            } else {
              values[key] = [values[key], value];
            }
            this._all = void 0;
          }
        };
      }
    });
    init_config2 = __esm2({
      "src/lib/tasks/config.ts"() {
        "use strict";
        init_ConfigList();
        init_utils();
        GitConfigScope = /* @__PURE__ */ ((GitConfigScope2) => {
          GitConfigScope2["system"] = "system";
          GitConfigScope2["global"] = "global";
          GitConfigScope2["local"] = "local";
          GitConfigScope2["worktree"] = "worktree";
          return GitConfigScope2;
        })(GitConfigScope || {});
      }
    });
    init_diff_name_status = __esm2({
      "src/lib/tasks/diff-name-status.ts"() {
        "use strict";
        DiffNameStatus = /* @__PURE__ */ ((DiffNameStatus2) => {
          DiffNameStatus2["ADDED"] = "A";
          DiffNameStatus2["COPIED"] = "C";
          DiffNameStatus2["DELETED"] = "D";
          DiffNameStatus2["MODIFIED"] = "M";
          DiffNameStatus2["RENAMED"] = "R";
          DiffNameStatus2["CHANGED"] = "T";
          DiffNameStatus2["UNMERGED"] = "U";
          DiffNameStatus2["UNKNOWN"] = "X";
          DiffNameStatus2["BROKEN"] = "B";
          return DiffNameStatus2;
        })(DiffNameStatus || {});
        diffNameStatus = new Set(Object.values(DiffNameStatus));
      }
    });
    init_grep = __esm2({
      "src/lib/tasks/grep.ts"() {
        "use strict";
        init_utils();
        init_task();
        disallowedOptions = ["-h"];
        Query = Symbol("grepQuery");
        GrepQuery = class {
          constructor() {
            this[_a] = [];
          }
          *[(_a = Query, Symbol.iterator)]() {
            for (const query of this[Query]) {
              yield query;
            }
          }
          and(...and) {
            and.length && this[Query].push("--and", "(", ...prefixedArray(and, "-e"), ")");
            return this;
          }
          param(...param) {
            this[Query].push(...prefixedArray(param, "-e"));
            return this;
          }
        };
      }
    });
    reset_exports = {};
    __export2(reset_exports, {
      ResetMode: () => ResetMode,
      getResetMode: () => getResetMode,
      resetTask: () => resetTask
    });
    init_reset = __esm2({
      "src/lib/tasks/reset.ts"() {
        "use strict";
        init_utils();
        init_task();
        ResetMode = /* @__PURE__ */ ((ResetMode2) => {
          ResetMode2["MIXED"] = "mixed";
          ResetMode2["SOFT"] = "soft";
          ResetMode2["HARD"] = "hard";
          ResetMode2["MERGE"] = "merge";
          ResetMode2["KEEP"] = "keep";
          return ResetMode2;
        })(ResetMode || {});
        validResetModes = asStringArray(Object.values(ResetMode));
      }
    });
    init_git_logger = __esm2({
      "src/lib/git-logger.ts"() {
        "use strict";
        init_utils();
        import_debug.default.formatters.L = (value) => String(filterHasLength(value) ? value.length : "-");
        import_debug.default.formatters.B = (value) => {
          if (Buffer.isBuffer(value)) {
            return value.toString("utf8");
          }
          return objectToString(value);
        };
      }
    });
    init_tasks_pending_queue = __esm2({
      "src/lib/runners/tasks-pending-queue.ts"() {
        "use strict";
        init_git_error();
        init_git_logger();
        TasksPendingQueue = class _TasksPendingQueue {
          constructor(logLabel = "GitExecutor") {
            this.logLabel = logLabel;
            this._queue = /* @__PURE__ */ new Map();
          }
          withProgress(task) {
            return this._queue.get(task);
          }
          createProgress(task) {
            const name = _TasksPendingQueue.getName(task.commands[0]);
            const logger = createLogger(this.logLabel, name);
            return {
              task,
              logger,
              name
            };
          }
          push(task) {
            const progress = this.createProgress(task);
            progress.logger("Adding task to the queue, commands = %o", task.commands);
            this._queue.set(task, progress);
            return progress;
          }
          fatal(err) {
            for (const [task, { logger }] of Array.from(this._queue.entries())) {
              if (task === err.task) {
                logger.info(`Failed %o`, err);
                logger(
                  `Fatal exception, any as-yet un-started tasks run through this executor will not be attempted`
                );
              } else {
                logger.info(
                  `A fatal exception occurred in a previous task, the queue has been purged: %o`,
                  err.message
                );
              }
              this.complete(task);
            }
            if (this._queue.size !== 0) {
              throw new Error(`Queue size should be zero after fatal: ${this._queue.size}`);
            }
          }
          complete(task) {
            const progress = this.withProgress(task);
            if (progress) {
              this._queue.delete(task);
            }
          }
          attempt(task) {
            const progress = this.withProgress(task);
            if (!progress) {
              throw new GitError(void 0, "TasksPendingQueue: attempt called for an unknown task");
            }
            progress.logger("Starting task");
            return progress;
          }
          static getName(name = "empty") {
            return `task:${name}:${++_TasksPendingQueue.counter}`;
          }
          static {
            this.counter = 0;
          }
        };
      }
    });
    init_git_executor_chain = __esm2({
      "src/lib/runners/git-executor-chain.ts"() {
        "use strict";
        init_git_error();
        init_task();
        init_utils();
        init_tasks_pending_queue();
        GitExecutorChain = class {
          constructor(_executor, _scheduler, _plugins) {
            this._executor = _executor;
            this._scheduler = _scheduler;
            this._plugins = _plugins;
            this._chain = Promise.resolve();
            this._queue = new TasksPendingQueue();
          }
          get cwd() {
            return this._cwd || this._executor.cwd;
          }
          set cwd(cwd) {
            this._cwd = cwd;
          }
          get env() {
            return this._executor.env;
          }
          get outputHandler() {
            return this._executor.outputHandler;
          }
          chain() {
            return this;
          }
          push(task) {
            this._queue.push(task);
            return this._chain = this._chain.then(() => this.attemptTask(task));
          }
          async attemptTask(task) {
            const onScheduleComplete = await this._scheduler.next();
            const onQueueComplete = () => this._queue.complete(task);
            try {
              const { logger } = this._queue.attempt(task);
              return await (isEmptyTask(task) ? this.attemptEmptyTask(task, logger) : this.attemptRemoteTask(task, logger));
            } catch (e) {
              throw this.onFatalException(task, e);
            } finally {
              onQueueComplete();
              onScheduleComplete();
            }
          }
          onFatalException(task, e) {
            const gitError = e instanceof GitError ? Object.assign(e, { task }) : new GitError(task, e && String(e));
            this._chain = Promise.resolve();
            this._queue.fatal(gitError);
            return gitError;
          }
          async attemptRemoteTask(task, logger) {
            const binary = this._plugins.exec("spawn.binary", "", pluginContext(task, task.commands));
            const args = this._plugins.exec("spawn.args", [...task.commands], {
              ...pluginContext(task, task.commands),
              env: { ...this.env }
            });
            const raw = await this.gitResponse(
              task,
              binary,
              args,
              this.outputHandler,
              logger.step("SPAWN")
            );
            const outputStreams = await this.handleTaskData(task, args, raw, logger.step("HANDLE"));
            logger(`passing response to task's parser as a %s`, task.format);
            if (isBufferTask(task)) {
              return callTaskParser(task.parser, outputStreams);
            }
            return callTaskParser(task.parser, outputStreams.asStrings());
          }
          async attemptEmptyTask(task, logger) {
            logger(`empty task bypassing child process to call to task's parser`);
            return task.parser(this);
          }
          handleTaskData(task, args, result, logger) {
            const { exitCode, rejection, stdOut, stdErr } = result;
            return new Promise((done, fail) => {
              logger(`Preparing to handle process response exitCode=%d stdOut=`, exitCode);
              const { error } = this._plugins.exec(
                "task.error",
                { error: rejection },
                {
                  ...pluginContext(task, args),
                  ...result
                }
              );
              if (error && task.onError) {
                logger.info(`exitCode=%s handling with custom error handler`);
                return task.onError(
                  result,
                  error,
                  (newStdOut) => {
                    logger.info(`custom error handler treated as success`);
                    logger(`custom error returned a %s`, objectToString(newStdOut));
                    done(
                      new GitOutputStreams(
                        Array.isArray(newStdOut) ? Buffer.concat(newStdOut) : newStdOut,
                        Buffer.concat(stdErr)
                      )
                    );
                  },
                  fail
                );
              }
              if (error) {
                logger.info(
                  `handling as error: exitCode=%s stdErr=%s rejection=%o`,
                  exitCode,
                  stdErr.length,
                  rejection
                );
                return fail(error);
              }
              logger.info(`retrieving task output complete`);
              done(new GitOutputStreams(Buffer.concat(stdOut), Buffer.concat(stdErr)));
            });
          }
          async gitResponse(task, command, args, outputHandler, logger) {
            const outputLogger = logger.sibling("output");
            const spawnOptions = this._plugins.exec(
              "spawn.options",
              {
                cwd: this.cwd,
                env: this.env,
                windowsHide: true
              },
              pluginContext(task, task.commands)
            );
            return new Promise((done) => {
              const stdOut = [];
              const stdErr = [];
              logger.info(`%s %o`, command, args);
              logger("%O", spawnOptions);
              let rejection = this._beforeSpawn(task, args);
              if (rejection) {
                return done({
                  stdOut,
                  stdErr,
                  exitCode: 9901,
                  rejection
                });
              }
              this._plugins.exec("spawn.before", void 0, {
                ...pluginContext(task, args),
                kill(reason) {
                  rejection = reason || rejection;
                }
              });
              const spawned = spawn2(command, args, spawnOptions);
              spawned.stdout.on(
                "data",
                onDataReceived(stdOut, "stdOut", logger, outputLogger.step("stdOut"))
              );
              spawned.stderr.on(
                "data",
                onDataReceived(stdErr, "stdErr", logger, outputLogger.step("stdErr"))
              );
              spawned.on("error", onErrorReceived(stdErr, logger));
              if (outputHandler) {
                logger(`Passing child process stdOut/stdErr to custom outputHandler`);
                outputHandler(command, spawned.stdout, spawned.stderr, [...args]);
              }
              this._plugins.exec("spawn.after", void 0, {
                ...pluginContext(task, args),
                spawned,
                close(exitCode, reason) {
                  done({
                    stdOut,
                    stdErr,
                    exitCode,
                    rejection: rejection || reason
                  });
                },
                kill(reason) {
                  if (spawned.killed) {
                    return;
                  }
                  rejection = reason;
                  spawned.kill("SIGINT");
                }
              });
            });
          }
          _beforeSpawn(task, args) {
            let rejection;
            this._plugins.exec("spawn.before", void 0, {
              ...pluginContext(task, args),
              kill(reason) {
                rejection = reason || rejection;
              }
            });
            return rejection;
          }
        };
      }
    });
    git_executor_exports = {};
    __export2(git_executor_exports, {
      GitExecutor: () => GitExecutor
    });
    init_git_executor = __esm2({
      "src/lib/runners/git-executor.ts"() {
        "use strict";
        init_git_executor_chain();
        GitExecutor = class {
          constructor(cwd, _scheduler, _plugins) {
            this.cwd = cwd;
            this._scheduler = _scheduler;
            this._plugins = _plugins;
            this._chain = new GitExecutorChain(this, this._scheduler, this._plugins);
          }
          chain() {
            return new GitExecutorChain(this, this._scheduler, this._plugins);
          }
          push(task) {
            return this._chain.push(task);
          }
        };
      }
    });
    init_task_callback = __esm2({
      "src/lib/task-callback.ts"() {
        "use strict";
        init_git_response_error();
        init_utils();
      }
    });
    init_change_working_directory = __esm2({
      "src/lib/tasks/change-working-directory.ts"() {
        "use strict";
        init_utils();
        init_task();
      }
    });
    init_checkout = __esm2({
      "src/lib/tasks/checkout.ts"() {
        "use strict";
        init_utils();
        init_task();
      }
    });
    init_count_objects = __esm2({
      "src/lib/tasks/count-objects.ts"() {
        "use strict";
        init_utils();
        parser2 = new LineParser(
          /([a-z-]+): (\d+)$/,
          (result, [key, value]) => {
            const property = asCamelCase(key);
            if (Object.hasOwn(result, property)) {
              result[property] = asNumber(value);
            }
          }
        );
      }
    });
    init_parse_commit = __esm2({
      "src/lib/parsers/parse-commit.ts"() {
        "use strict";
        init_utils();
        parsers = [
          new LineParser(/^\[([^\s]+)( \([^)]+\))? ([^\]]+)/, (result, [branch, root, commit]) => {
            result.branch = branch;
            result.commit = commit;
            result.root = !!root;
          }),
          new LineParser(/\s*Author:\s(.+)/i, (result, [author]) => {
            const parts = author.split("<");
            const email = parts.pop();
            if (!email || !email.includes("@")) {
              return;
            }
            result.author = {
              email: email.substr(0, email.length - 1),
              name: parts.join("<").trim()
            };
          }),
          new LineParser(
            /(\d+)[^,]*(?:,\s*(\d+)[^,]*)(?:,\s*(\d+))/g,
            (result, [changes, insertions, deletions]) => {
              result.summary.changes = parseInt(changes, 10) || 0;
              result.summary.insertions = parseInt(insertions, 10) || 0;
              result.summary.deletions = parseInt(deletions, 10) || 0;
            }
          ),
          new LineParser(
            /^(\d+)[^,]*(?:,\s*(\d+)[^(]+\(([+-]))?/,
            (result, [changes, lines, direction]) => {
              result.summary.changes = parseInt(changes, 10) || 0;
              const count = parseInt(lines, 10) || 0;
              if (direction === "-") {
                result.summary.deletions = count;
              } else if (direction === "+") {
                result.summary.insertions = count;
              }
            }
          )
        ];
      }
    });
    init_commit = __esm2({
      "src/lib/tasks/commit.ts"() {
        "use strict";
        init_parse_commit();
        init_utils();
        init_task();
      }
    });
    init_first_commit = __esm2({
      "src/lib/tasks/first-commit.ts"() {
        "use strict";
        init_utils();
        init_task();
      }
    });
    init_hash_object = __esm2({
      "src/lib/tasks/hash-object.ts"() {
        "use strict";
        init_task();
      }
    });
    init_InitSummary = __esm2({
      "src/lib/responses/InitSummary.ts"() {
        "use strict";
        InitSummary = class {
          constructor(bare, path, existing, gitDir) {
            this.bare = bare;
            this.path = path;
            this.existing = existing;
            this.gitDir = gitDir;
          }
        };
        initResponseRegex = /^Init.+ repository in (.+)$/;
        reInitResponseRegex = /^Rein.+ in (.+)$/;
      }
    });
    init_init = __esm2({
      "src/lib/tasks/init.ts"() {
        "use strict";
        init_InitSummary();
        bareCommand = "--bare";
      }
    });
    init_log_format = __esm2({
      "src/lib/args/log-format.ts"() {
        "use strict";
        logFormatRegex = /^--(stat|numstat|name-only|name-status)(=|$)/;
      }
    });
    init_DiffSummary = __esm2({
      "src/lib/responses/DiffSummary.ts"() {
        "use strict";
        DiffSummary = class {
          constructor() {
            this.changed = 0;
            this.deletions = 0;
            this.insertions = 0;
            this.files = [];
          }
        };
      }
    });
    init_parse_diff_summary = __esm2({
      "src/lib/parsers/parse-diff-summary.ts"() {
        "use strict";
        init_log_format();
        init_DiffSummary();
        init_diff_name_status();
        init_utils();
        statParser = [
          new LineParser(
            /^(.+)\s+\|\s+(\d+)(\s+[+\-]+)?$/,
            (result, [file, changes, alterations = ""]) => {
              result.files.push({
                file: file.trim(),
                changes: asNumber(changes),
                insertions: alterations.replace(/[^+]/g, "").length,
                deletions: alterations.replace(/[^-]/g, "").length,
                binary: false
              });
            }
          ),
          new LineParser(
            /^(.+) \|\s+Bin ([0-9.]+) -> ([0-9.]+) ([a-z]+)/,
            (result, [file, before, after]) => {
              result.files.push({
                file: file.trim(),
                before: asNumber(before),
                after: asNumber(after),
                binary: true
              });
            }
          ),
          new LineParser(
            /(\d+) files? changed\s*((?:, \d+ [^,]+){0,2})/,
            (result, [changed, summary]) => {
              const inserted = /(\d+) i/.exec(summary);
              const deleted = /(\d+) d/.exec(summary);
              result.changed = asNumber(changed);
              result.insertions = asNumber(inserted?.[1]);
              result.deletions = asNumber(deleted?.[1]);
            }
          )
        ];
        numStatParser = [
          new LineParser(
            /(\d+)\t(\d+)\t(.+)$/,
            (result, [changesInsert, changesDelete, file]) => {
              const insertions = asNumber(changesInsert);
              const deletions = asNumber(changesDelete);
              result.changed++;
              result.insertions += insertions;
              result.deletions += deletions;
              result.files.push({
                file,
                changes: insertions + deletions,
                insertions,
                deletions,
                binary: false
              });
            }
          ),
          new LineParser(/-\t-\t(.+)$/, (result, [file]) => {
            result.changed++;
            result.files.push({
              file,
              after: 0,
              before: 0,
              binary: true
            });
          })
        ];
        nameOnlyParser = [
          new LineParser(/(.+)$/, (result, [file]) => {
            result.changed++;
            result.files.push({
              file,
              changes: 0,
              insertions: 0,
              deletions: 0,
              binary: false
            });
          })
        ];
        nameStatusParser = [
          new LineParser(
            /([ACDMRTUXB])([0-9]{0,3})\t(.[^\t]*)(\t(.[^\t]*))?$/,
            (result, [status, similarity, from, _to, to]) => {
              result.changed++;
              result.files.push({
                file: to ?? from,
                changes: 0,
                insertions: 0,
                deletions: 0,
                binary: false,
                status: orVoid(isDiffNameStatus(status) && status),
                from: orVoid(!!to && from !== to && from),
                similarity: asNumber(similarity)
              });
            }
          )
        ];
        diffSummaryParsers = {
          [
            ""
            /* NONE */
          ]: statParser,
          [
            "--stat"
            /* STAT */
          ]: statParser,
          [
            "--numstat"
            /* NUM_STAT */
          ]: numStatParser,
          [
            "--name-status"
            /* NAME_STATUS */
          ]: nameStatusParser,
          [
            "--name-only"
            /* NAME_ONLY */
          ]: nameOnlyParser
        };
      }
    });
    init_parse_list_log_summary = __esm2({
      "src/lib/parsers/parse-list-log-summary.ts"() {
        "use strict";
        init_utils();
        init_parse_diff_summary();
        init_log_format();
        START_BOUNDARY = "\xF2\xF2\xF2\xF2\xF2\xF2 ";
        COMMIT_BOUNDARY = " \xF2\xF2";
        SPLITTER = " \xF2 ";
        defaultFieldNames = ["hash", "date", "message", "refs", "author_name", "author_email"];
      }
    });
    diff_exports = {};
    __export2(diff_exports, {
      diffSummaryTask: () => diffSummaryTask,
      validateLogFormatConfig: () => validateLogFormatConfig
    });
    init_diff = __esm2({
      "src/lib/tasks/diff.ts"() {
        "use strict";
        init_log_format();
        init_parse_diff_summary();
        init_task();
      }
    });
    init_log = __esm2({
      "src/lib/tasks/log.ts"() {
        "use strict";
        init_log_format();
        init_parse_list_log_summary();
        init_utils();
        init_task();
        init_diff();
        excludeOptions = /* @__PURE__ */ ((excludeOptions2) => {
          excludeOptions2[excludeOptions2["--pretty"] = 0] = "--pretty";
          excludeOptions2[excludeOptions2["max-count"] = 1] = "max-count";
          excludeOptions2[excludeOptions2["maxCount"] = 2] = "maxCount";
          excludeOptions2[excludeOptions2["n"] = 3] = "n";
          excludeOptions2[excludeOptions2["file"] = 4] = "file";
          excludeOptions2[excludeOptions2["format"] = 5] = "format";
          excludeOptions2[excludeOptions2["from"] = 6] = "from";
          excludeOptions2[excludeOptions2["to"] = 7] = "to";
          excludeOptions2[excludeOptions2["splitter"] = 8] = "splitter";
          excludeOptions2[excludeOptions2["symmetric"] = 9] = "symmetric";
          excludeOptions2[excludeOptions2["mailMap"] = 10] = "mailMap";
          excludeOptions2[excludeOptions2["multiLine"] = 11] = "multiLine";
          excludeOptions2[excludeOptions2["strictDate"] = 12] = "strictDate";
          return excludeOptions2;
        })(excludeOptions || {});
      }
    });
    init_MergeSummary = __esm2({
      "src/lib/responses/MergeSummary.ts"() {
        "use strict";
        MergeSummaryConflict = class {
          constructor(reason, file = null, meta) {
            this.reason = reason;
            this.file = file;
            this.meta = meta;
          }
          toString() {
            return `${this.file}:${this.reason}`;
          }
        };
        MergeSummaryDetail = class {
          constructor() {
            this.conflicts = [];
            this.merges = [];
            this.result = "success";
          }
          get failed() {
            return this.conflicts.length > 0;
          }
          get reason() {
            return this.result;
          }
          toString() {
            if (this.conflicts.length) {
              return `CONFLICTS: ${this.conflicts.join(", ")}`;
            }
            return "OK";
          }
        };
      }
    });
    init_PullSummary = __esm2({
      "src/lib/responses/PullSummary.ts"() {
        "use strict";
        PullSummary = class {
          constructor() {
            this.remoteMessages = {
              all: []
            };
            this.created = [];
            this.deleted = [];
            this.files = [];
            this.deletions = {};
            this.insertions = {};
            this.summary = {
              changes: 0,
              deletions: 0,
              insertions: 0
            };
          }
        };
        PullFailedSummary = class {
          constructor() {
            this.remote = "";
            this.hash = {
              local: "",
              remote: ""
            };
            this.branch = {
              local: "",
              remote: ""
            };
            this.message = "";
          }
          toString() {
            return this.message;
          }
        };
      }
    });
    init_parse_remote_objects = __esm2({
      "src/lib/parsers/parse-remote-objects.ts"() {
        "use strict";
        init_utils();
        remoteMessagesObjectParsers = [
          new RemoteLineParser(
            /^remote:\s*(enumerating|counting|compressing) objects: (\d+),/i,
            (result, [action, count]) => {
              const key = action.toLowerCase();
              const enumeration = objectEnumerationResult(result.remoteMessages);
              Object.assign(enumeration, { [key]: asNumber(count) });
            }
          ),
          new RemoteLineParser(
            /^remote:\s*(enumerating|counting|compressing) objects: \d+% \(\d+\/(\d+)\),/i,
            (result, [action, count]) => {
              const key = action.toLowerCase();
              const enumeration = objectEnumerationResult(result.remoteMessages);
              Object.assign(enumeration, { [key]: asNumber(count) });
            }
          ),
          new RemoteLineParser(
            /total ([^,]+), reused ([^,]+), pack-reused (\d+)/i,
            (result, [total, reused, packReused]) => {
              const objects = objectEnumerationResult(result.remoteMessages);
              objects.total = asObjectCount(total);
              objects.reused = asObjectCount(reused);
              objects.packReused = asNumber(packReused);
            }
          )
        ];
      }
    });
    init_parse_remote_messages = __esm2({
      "src/lib/parsers/parse-remote-messages.ts"() {
        "use strict";
        init_utils();
        init_parse_remote_objects();
        parsers2 = [
          new RemoteLineParser(/^remote:\s*(.+)$/, (result, [text]) => {
            result.remoteMessages.all.push(text.trim());
            return false;
          }),
          ...remoteMessagesObjectParsers,
          new RemoteLineParser(
            [/create a (?:pull|merge) request/i, /\s(https?:\/\/\S+)$/],
            (result, [pullRequestUrl]) => {
              result.remoteMessages.pullRequestUrl = pullRequestUrl;
            }
          ),
          new RemoteLineParser(
            [/found (\d+) vulnerabilities.+\(([^)]+)\)/i, /\s(https?:\/\/\S+)$/],
            (result, [count, summary, url]) => {
              result.remoteMessages.vulnerabilities = {
                count: asNumber(count),
                summary,
                url
              };
            }
          )
        ];
        RemoteMessageSummary = class {
          constructor() {
            this.all = [];
          }
        };
      }
    });
    init_parse_pull = __esm2({
      "src/lib/parsers/parse-pull.ts"() {
        "use strict";
        init_PullSummary();
        init_utils();
        init_parse_remote_messages();
        FILE_UPDATE_REGEX = /^\s*(.+?)\s+\|\s+\d+\s*(\+*)(-*)/;
        SUMMARY_REGEX = /(\d+)\D+((\d+)\D+\(\+\))?(\D+(\d+)\D+\(-\))?/;
        ACTION_REGEX = /^(create|delete) mode \d+ (.+)/;
        parsers3 = [
          new LineParser(FILE_UPDATE_REGEX, (result, [file, insertions, deletions]) => {
            result.files.push(file);
            if (insertions) {
              result.insertions[file] = insertions.length;
            }
            if (deletions) {
              result.deletions[file] = deletions.length;
            }
          }),
          new LineParser(SUMMARY_REGEX, (result, [changes, , insertions, , deletions]) => {
            if (insertions !== void 0 || deletions !== void 0) {
              result.summary.changes = +changes || 0;
              result.summary.insertions = +insertions || 0;
              result.summary.deletions = +deletions || 0;
              return true;
            }
            return false;
          }),
          new LineParser(ACTION_REGEX, (result, [action, file]) => {
            append(result.files, file);
            append(action === "create" ? result.created : result.deleted, file);
          })
        ];
        errorParsers = [
          new LineParser(/^from\s(.+)$/i, (result, [remote]) => void (result.remote = remote)),
          new LineParser(/^fatal:\s(.+)$/, (result, [message]) => void (result.message = message)),
          new LineParser(
            /([a-z0-9]+)\.\.([a-z0-9]+)\s+(\S+)\s+->\s+(\S+)$/,
            (result, [hashLocal, hashRemote, branchLocal, branchRemote]) => {
              result.branch.local = branchLocal;
              result.hash.local = hashLocal;
              result.branch.remote = branchRemote;
              result.hash.remote = hashRemote;
            }
          )
        ];
        parsePullDetail = (stdOut, stdErr) => {
          return parseStringResponse(new PullSummary(), parsers3, [stdOut, stdErr]);
        };
        parsePullResult = (stdOut, stdErr) => {
          return Object.assign(
            new PullSummary(),
            parsePullDetail(stdOut, stdErr),
            parseRemoteMessages(stdOut, stdErr)
          );
        };
      }
    });
    init_parse_merge = __esm2({
      "src/lib/parsers/parse-merge.ts"() {
        "use strict";
        init_MergeSummary();
        init_utils();
        init_parse_pull();
        parsers4 = [
          new LineParser(/^Auto-merging\s+(.+)$/, (summary, [autoMerge]) => {
            summary.merges.push(autoMerge);
          }),
          new LineParser(/^CONFLICT\s+\((.+)\): Merge conflict in (.+)$/, (summary, [reason, file]) => {
            summary.conflicts.push(new MergeSummaryConflict(reason, file));
          }),
          new LineParser(
            /^CONFLICT\s+\((.+\/delete)\): (.+) deleted in (.+) and/,
            (summary, [reason, file, deleteRef]) => {
              summary.conflicts.push(new MergeSummaryConflict(reason, file, { deleteRef }));
            }
          ),
          new LineParser(/^CONFLICT\s+\((.+)\):/, (summary, [reason]) => {
            summary.conflicts.push(new MergeSummaryConflict(reason, null));
          }),
          new LineParser(/^Automatic merge failed;\s+(.+)$/, (summary, [result]) => {
            summary.result = result;
          })
        ];
        parseMergeResult = (stdOut, stdErr) => {
          return Object.assign(parseMergeDetail(stdOut, stdErr), parsePullResult(stdOut, stdErr));
        };
        parseMergeDetail = (stdOut) => {
          return parseStringResponse(new MergeSummaryDetail(), parsers4, stdOut);
        };
      }
    });
    init_merge = __esm2({
      "src/lib/tasks/merge.ts"() {
        "use strict";
        init_git_response_error();
        init_parse_merge();
        init_task();
      }
    });
    init_parse_push = __esm2({
      "src/lib/parsers/parse-push.ts"() {
        "use strict";
        init_utils();
        init_parse_remote_messages();
        parsers5 = [
          new LineParser(/^Pushing to (.+)$/, (result, [repo]) => {
            result.repo = repo;
          }),
          new LineParser(/^updating local tracking ref '(.+)'/, (result, [local]) => {
            result.ref = {
              ...result.ref || {},
              local
            };
          }),
          new LineParser(/^[=*-]\s+([^:]+):(\S+)\s+\[(.+)]$/, (result, [local, remote, type]) => {
            result.pushed.push(pushResultPushedItem(local, remote, type));
          }),
          new LineParser(
            /^Branch '([^']+)' set up to track remote branch '([^']+)' from '([^']+)'/,
            (result, [local, remote, remoteName]) => {
              result.branch = {
                ...result.branch || {},
                local,
                remote,
                remoteName
              };
            }
          ),
          new LineParser(
            /^([^:]+):(\S+)\s+([a-z0-9]+)\.\.([a-z0-9]+)$/,
            (result, [local, remote, from, to]) => {
              result.update = {
                head: {
                  local,
                  remote
                },
                hash: {
                  from,
                  to
                }
              };
            }
          )
        ];
        parsePushResult = (stdOut, stdErr) => {
          const pushDetail = parsePushDetail(stdOut, stdErr);
          const responseDetail = parseRemoteMessages(stdOut, stdErr);
          return {
            ...pushDetail,
            ...responseDetail
          };
        };
        parsePushDetail = (stdOut, stdErr) => {
          return parseStringResponse({ pushed: [] }, parsers5, [stdOut, stdErr]);
        };
      }
    });
    push_exports = {};
    __export2(push_exports, {
      pushTagsTask: () => pushTagsTask,
      pushTask: () => pushTask
    });
    init_push = __esm2({
      "src/lib/tasks/push.ts"() {
        "use strict";
        init_parse_push();
        init_utils();
      }
    });
    init_show = __esm2({
      "src/lib/tasks/show.ts"() {
        "use strict";
        init_utils();
        init_task();
      }
    });
    init_FileStatusSummary = __esm2({
      "src/lib/responses/FileStatusSummary.ts"() {
        "use strict";
        fromPathRegex = /^(.+)\0(.+)$/;
        FileStatusSummary = class {
          constructor(path, index, working_dir) {
            this.path = path;
            this.index = index;
            this.working_dir = working_dir;
            if (index === "R" || working_dir === "R") {
              const detail = fromPathRegex.exec(path) || [null, path, path];
              this.from = detail[2] || "";
              this.path = detail[1] || "";
            }
          }
        };
      }
    });
    init_StatusSummary = __esm2({
      "src/lib/responses/StatusSummary.ts"() {
        "use strict";
        init_utils();
        init_FileStatusSummary();
        StatusSummary = class {
          constructor() {
            this.not_added = [];
            this.conflicted = [];
            this.created = [];
            this.deleted = [];
            this.ignored = void 0;
            this.modified = [];
            this.renamed = [];
            this.files = [];
            this.staged = [];
            this.ahead = 0;
            this.behind = 0;
            this.current = null;
            this.tracking = null;
            this.detached = false;
            this.isClean = () => {
              return !this.files.length;
            };
          }
        };
        parsers6 = new Map([
          parser3(
            " ",
            "A",
            (result, file) => result.created.push(file)
          ),
          parser3(
            " ",
            "D",
            (result, file) => result.deleted.push(file)
          ),
          parser3(
            " ",
            "M",
            (result, file) => result.modified.push(file)
          ),
          parser3("A", " ", (result, file) => {
            result.created.push(file);
            result.staged.push(file);
          }),
          parser3("A", "M", (result, file) => {
            result.created.push(file);
            result.staged.push(file);
            result.modified.push(file);
          }),
          parser3("D", " ", (result, file) => {
            result.deleted.push(file);
            result.staged.push(file);
          }),
          parser3("M", " ", (result, file) => {
            result.modified.push(file);
            result.staged.push(file);
          }),
          parser3("M", "M", (result, file) => {
            result.modified.push(file);
            result.staged.push(file);
          }),
          parser3("R", " ", (result, file) => {
            result.renamed.push(renamedFile(file));
          }),
          parser3("R", "M", (result, file) => {
            const renamed = renamedFile(file);
            result.renamed.push(renamed);
            result.modified.push(renamed.to);
          }),
          parser3("!", "!", (_result, _file) => {
            (_result.ignored = _result.ignored || []).push(_file);
          }),
          parser3(
            "?",
            "?",
            (result, file) => result.not_added.push(file)
          ),
          ...conflicts(
            "A",
            "A",
            "U"
            /* UNMERGED */
          ),
          ...conflicts(
            "D",
            "D",
            "U"
            /* UNMERGED */
          ),
          ...conflicts(
            "U",
            "A",
            "D",
            "U"
            /* UNMERGED */
          ),
          [
            "##",
            (result, line) => {
              const aheadReg = /ahead (\d+)/;
              const behindReg = /behind (\d+)/;
              const currentReg = /^(.+?(?=(?:\.{3}|\s|$)))/;
              const trackingReg = /\.{3}(\S*)/;
              const onEmptyBranchReg = /\son\s(\S+?)(?=\.{3}|$)/;
              let regexResult = aheadReg.exec(line);
              result.ahead = regexResult && +regexResult[1] || 0;
              regexResult = behindReg.exec(line);
              result.behind = regexResult && +regexResult[1] || 0;
              regexResult = currentReg.exec(line);
              result.current = filterType(regexResult?.[1], filterString, null);
              regexResult = trackingReg.exec(line);
              result.tracking = filterType(regexResult?.[1], filterString, null);
              regexResult = onEmptyBranchReg.exec(line);
              if (regexResult) {
                result.current = filterType(regexResult?.[1], filterString, result.current);
              }
              result.detached = /\(no branch\)/.test(line);
            }
          ]
        ]);
        parseStatusSummary = function(text) {
          const lines = text.split(NULL);
          const status = new StatusSummary();
          for (let i2 = 0, l = lines.length; i2 < l; ) {
            let line = lines[i2++].trim();
            if (!line) {
              continue;
            }
            if (line.charAt(0) === "R") {
              line += NULL + (lines[i2++] || "");
            }
            splitLine(status, line);
          }
          return status;
        };
      }
    });
    init_status = __esm2({
      "src/lib/tasks/status.ts"() {
        "use strict";
        init_StatusSummary();
        ignoredOptions = ["--null", "-z"];
      }
    });
    init_version = __esm2({
      "src/lib/tasks/version.ts"() {
        "use strict";
        init_utils();
        NOT_INSTALLED = "installed=false";
        parsers7 = [
          new LineParser(
            /version (\d+)\.(\d+)\.(\d+)(?:\s*\((.+)\))?/,
            (result, [major, minor, patch, agent = ""]) => {
              Object.assign(
                result,
                versionResponse(asNumber(major), asNumber(minor), asNumber(patch), agent)
              );
            }
          ),
          new LineParser(
            /version (\d+)\.(\d+)\.(\D+)(.+)?$/,
            (result, [major, minor, patch, agent = ""]) => {
              Object.assign(result, versionResponse(asNumber(major), asNumber(minor), patch, agent));
            }
          )
        ];
      }
    });
    init_clone = __esm2({
      "src/lib/tasks/clone.ts"() {
        "use strict";
        init_task();
        init_utils();
        cloneTask = (repo, directory, customArgs) => {
          const commands = ["clone", ...customArgs];
          filterString(repo) && commands.push(c(repo));
          filterString(directory) && commands.push(c(directory));
          return straightThroughStringTask(commands);
        };
        cloneMirrorTask = (repo, directory, customArgs) => {
          append(customArgs, "--mirror");
          return cloneTask(repo, directory, customArgs);
        };
      }
    });
    simple_git_api_exports = {};
    __export2(simple_git_api_exports, {
      SimpleGitApi: () => SimpleGitApi
    });
    init_simple_git_api = __esm2({
      "src/lib/simple-git-api.ts"() {
        "use strict";
        init_task_callback();
        init_change_working_directory();
        init_checkout();
        init_count_objects();
        init_commit();
        init_config2();
        init_first_commit();
        init_grep();
        init_hash_object();
        init_init();
        init_log();
        init_merge();
        init_push();
        init_show();
        init_status();
        init_task();
        init_version();
        init_utils();
        init_clone();
        SimpleGitApi = class {
          constructor(_executor) {
            this._executor = _executor;
          }
          _runTask(task, then) {
            const chain = this._executor.chain();
            const promise = chain.push(task);
            if (then) {
              taskCallback(task, promise, then);
            }
            return Object.create(this, {
              then: { value: promise.then.bind(promise) },
              catch: { value: promise.catch.bind(promise) },
              _executor: { value: chain }
            });
          }
          add(files) {
            return this._runTask(
              straightThroughStringTask(["add", ...asArray(files)]),
              trailingFunctionArgument(arguments)
            );
          }
          cwd(directory) {
            const next = trailingFunctionArgument(arguments);
            if (typeof directory === "string") {
              return this._runTask(changeWorkingDirectoryTask(directory, this._executor), next);
            }
            if (typeof directory?.path === "string") {
              return this._runTask(
                changeWorkingDirectoryTask(
                  directory.path,
                  directory.root && this._executor || void 0
                ),
                next
              );
            }
            return this._runTask(
              configurationErrorTask("Git.cwd: workingDirectory must be supplied as a string"),
              next
            );
          }
          hashObject(path, write) {
            return this._runTask(
              hashObjectTask(path, write === true),
              trailingFunctionArgument(arguments)
            );
          }
          init(bare) {
            return this._runTask(
              initTask(bare === true, this._executor.cwd, getTrailingOptions(arguments)),
              trailingFunctionArgument(arguments)
            );
          }
          merge() {
            return this._runTask(
              mergeTask(getTrailingOptions(arguments)),
              trailingFunctionArgument(arguments)
            );
          }
          mergeFromTo(remote, branch) {
            if (!(filterString(remote) && filterString(branch))) {
              return this._runTask(
                configurationErrorTask(
                  `Git.mergeFromTo requires that the 'remote' and 'branch' arguments are supplied as strings`
                )
              );
            }
            return this._runTask(
              mergeTask([remote, branch, ...getTrailingOptions(arguments)]),
              trailingFunctionArgument(arguments, false)
            );
          }
          outputHandler(handler) {
            this._executor.outputHandler = handler;
            return this;
          }
          push() {
            const task = pushTask(
              {
                remote: filterType(arguments[0], filterString),
                branch: filterType(arguments[1], filterString)
              },
              getTrailingOptions(arguments)
            );
            return this._runTask(task, trailingFunctionArgument(arguments));
          }
          stash() {
            return this._runTask(
              straightThroughStringTask(["stash", ...getTrailingOptions(arguments)]),
              trailingFunctionArgument(arguments)
            );
          }
          status() {
            return this._runTask(
              statusTask(getTrailingOptions(arguments)),
              trailingFunctionArgument(arguments)
            );
          }
        };
        Object.assign(
          SimpleGitApi.prototype,
          checkout_default(),
          clone_default(),
          commit_default(),
          config_default(),
          count_objects_default(),
          first_commit_default(),
          grep_default(),
          log_default(),
          show_default(),
          version_default()
        );
      }
    });
    scheduler_exports = {};
    __export2(scheduler_exports, {
      Scheduler: () => Scheduler
    });
    init_scheduler = __esm2({
      "src/lib/runners/scheduler.ts"() {
        "use strict";
        init_utils();
        init_git_logger();
        createScheduledTask = /* @__PURE__ */ (() => {
          let id = 0;
          return () => {
            id++;
            const { promise, done } = (0, import_promise_deferred.createDeferred)();
            return {
              promise,
              done,
              id
            };
          };
        })();
        Scheduler = class {
          constructor(concurrency = 2) {
            this.concurrency = concurrency;
            this.logger = createLogger("", "scheduler");
            this.pending = [];
            this.running = [];
            this.logger(`Constructed, concurrency=%s`, concurrency);
          }
          schedule() {
            if (!this.pending.length || this.running.length >= this.concurrency) {
              this.logger(
                `Schedule attempt ignored, pending=%s running=%s concurrency=%s`,
                this.pending.length,
                this.running.length,
                this.concurrency
              );
              return;
            }
            const task = append(this.running, this.pending.shift());
            this.logger(`Attempting id=%s`, task.id);
            task.done(() => {
              this.logger(`Completing id=`, task.id);
              remove(this.running, task);
              this.schedule();
            });
          }
          next() {
            const { promise, id } = append(this.pending, createScheduledTask());
            this.logger(`Scheduling id=%s`, id);
            this.schedule();
            return promise;
          }
        };
      }
    });
    apply_patch_exports = {};
    __export2(apply_patch_exports, {
      applyPatchTask: () => applyPatchTask
    });
    init_apply_patch = __esm2({
      "src/lib/tasks/apply-patch.ts"() {
        "use strict";
        init_task();
      }
    });
    init_BranchDeleteSummary = __esm2({
      "src/lib/responses/BranchDeleteSummary.ts"() {
        "use strict";
        BranchDeletionBatch = class {
          constructor() {
            this.all = [];
            this.branches = {};
            this.errors = [];
          }
          get success() {
            return !this.errors.length;
          }
        };
      }
    });
    init_parse_branch_delete = __esm2({
      "src/lib/parsers/parse-branch-delete.ts"() {
        "use strict";
        init_BranchDeleteSummary();
        init_utils();
        deleteSuccessRegex = /(\S+)\s+\(\S+\s([^)]+)\)/;
        deleteErrorRegex = /^error[^']+'([^']+)'/m;
        parsers8 = [
          new LineParser(deleteSuccessRegex, (result, [branch, hash]) => {
            const deletion = branchDeletionSuccess(branch, hash);
            result.all.push(deletion);
            result.branches[branch] = deletion;
          }),
          new LineParser(deleteErrorRegex, (result, [branch]) => {
            const deletion = branchDeletionFailure(branch);
            result.errors.push(deletion);
            result.all.push(deletion);
            result.branches[branch] = deletion;
          })
        ];
        parseBranchDeletions = (stdOut, stdErr) => {
          return parseStringResponse(new BranchDeletionBatch(), parsers8, [stdOut, stdErr]);
        };
      }
    });
    init_BranchSummary = __esm2({
      "src/lib/responses/BranchSummary.ts"() {
        "use strict";
        BranchSummaryResult = class {
          constructor() {
            this.all = [];
            this.branches = {};
            this.current = "";
            this.detached = false;
          }
          push(status, detached, name, commit, label) {
            if (status === "*") {
              this.detached = detached;
              this.current = name;
            }
            this.all.push(name);
            this.branches[name] = {
              current: status === "*",
              linkedWorkTree: status === "+",
              name,
              commit,
              label
            };
          }
        };
      }
    });
    init_parse_branch = __esm2({
      "src/lib/parsers/parse-branch.ts"() {
        "use strict";
        init_BranchSummary();
        init_utils();
        parsers9 = [
          new LineParser(
            /^([*+]\s)?\((?:HEAD )?detached (?:from|at) (\S+)\)\s+([a-z0-9]+)\s(.*)$/,
            (result, [current, name, commit, label]) => {
              result.push(branchStatus(current), true, name, commit, label);
            }
          ),
          new LineParser(
            /^([*+]\s)?(\S+)\s+([a-z0-9]+)\s?(.*)$/s,
            (result, [current, name, commit, label]) => {
              result.push(branchStatus(current), false, name, commit, label);
            }
          )
        ];
        currentBranchParser = new LineParser(/^(\S+)$/s, (result, [name]) => {
          result.push("*", false, name, "", "");
        });
      }
    });
    branch_exports = {};
    __export2(branch_exports, {
      branchLocalTask: () => branchLocalTask,
      branchTask: () => branchTask,
      containsDeleteBranchCommand: () => containsDeleteBranchCommand,
      deleteBranchTask: () => deleteBranchTask,
      deleteBranchesTask: () => deleteBranchesTask
    });
    init_branch = __esm2({
      "src/lib/tasks/branch.ts"() {
        "use strict";
        init_git_response_error();
        init_parse_branch_delete();
        init_parse_branch();
        init_utils();
      }
    });
    init_CheckIgnore = __esm2({
      "src/lib/responses/CheckIgnore.ts"() {
        "use strict";
        parseCheckIgnore = (text) => {
          return text.split(/\n/g).map(toPath).filter(Boolean);
        };
      }
    });
    check_ignore_exports = {};
    __export2(check_ignore_exports, {
      checkIgnoreTask: () => checkIgnoreTask
    });
    init_check_ignore = __esm2({
      "src/lib/tasks/check-ignore.ts"() {
        "use strict";
        init_CheckIgnore();
      }
    });
    init_parse_fetch = __esm2({
      "src/lib/parsers/parse-fetch.ts"() {
        "use strict";
        init_utils();
        parsers10 = [
          new LineParser(/From (.+)$/, (result, [remote]) => {
            result.remote = remote;
          }),
          new LineParser(/\* \[new branch]\s+(\S+)\s*-> (.+)$/, (result, [name, tracking]) => {
            result.branches.push({
              name,
              tracking
            });
          }),
          new LineParser(/\* \[new tag]\s+(\S+)\s*-> (.+)$/, (result, [name, tracking]) => {
            result.tags.push({
              name,
              tracking
            });
          }),
          new LineParser(/- \[deleted]\s+\S+\s*-> (.+)$/, (result, [tracking]) => {
            result.deleted.push({
              tracking
            });
          }),
          new LineParser(
            /\s*([^.]+)\.\.(\S+)\s+(\S+)\s*-> (.+)$/,
            (result, [from, to, name, tracking]) => {
              result.updated.push({
                name,
                tracking,
                to,
                from
              });
            }
          )
        ];
      }
    });
    fetch_exports = {};
    __export2(fetch_exports, {
      fetchTask: () => fetchTask
    });
    init_fetch = __esm2({
      "src/lib/tasks/fetch.ts"() {
        "use strict";
        init_parse_fetch();
        init_task();
      }
    });
    init_parse_move = __esm2({
      "src/lib/parsers/parse-move.ts"() {
        "use strict";
        init_utils();
        parsers11 = [
          new LineParser(/^Renaming (.+) to (.+)$/, (result, [from, to]) => {
            result.moves.push({ from, to });
          })
        ];
      }
    });
    move_exports = {};
    __export2(move_exports, {
      moveTask: () => moveTask
    });
    init_move = __esm2({
      "src/lib/tasks/move.ts"() {
        "use strict";
        init_parse_move();
        init_utils();
      }
    });
    pull_exports = {};
    __export2(pull_exports, {
      pullTask: () => pullTask
    });
    init_pull = __esm2({
      "src/lib/tasks/pull.ts"() {
        "use strict";
        init_git_response_error();
        init_parse_pull();
        init_utils();
      }
    });
    init_GetRemoteSummary = __esm2({
      "src/lib/responses/GetRemoteSummary.ts"() {
        "use strict";
        init_utils();
      }
    });
    remote_exports = {};
    __export2(remote_exports, {
      addRemoteTask: () => addRemoteTask,
      getRemotesTask: () => getRemotesTask,
      listRemotesTask: () => listRemotesTask,
      remoteTask: () => remoteTask,
      removeRemoteTask: () => removeRemoteTask
    });
    init_remote = __esm2({
      "src/lib/tasks/remote.ts"() {
        "use strict";
        init_GetRemoteSummary();
        init_task();
      }
    });
    stash_list_exports = {};
    __export2(stash_list_exports, {
      stashListTask: () => stashListTask
    });
    init_stash_list = __esm2({
      "src/lib/tasks/stash-list.ts"() {
        "use strict";
        init_log_format();
        init_parse_list_log_summary();
        init_diff();
        init_log();
      }
    });
    sub_module_exports = {};
    __export2(sub_module_exports, {
      addSubModuleTask: () => addSubModuleTask,
      initSubModuleTask: () => initSubModuleTask,
      subModuleTask: () => subModuleTask,
      updateSubModuleTask: () => updateSubModuleTask
    });
    init_sub_module = __esm2({
      "src/lib/tasks/sub-module.ts"() {
        "use strict";
        init_task();
      }
    });
    init_TagList = __esm2({
      "src/lib/responses/TagList.ts"() {
        "use strict";
        TagList = class {
          constructor(all, latest) {
            this.all = all;
            this.latest = latest;
          }
        };
        parseTagList = function(data, customSort = false) {
          const tags = data.split("\n").map(trimmed).filter(Boolean);
          if (!customSort) {
            tags.sort(function(tagA, tagB) {
              const partsA = tagA.split(".");
              const partsB = tagB.split(".");
              if (partsA.length === 1 || partsB.length === 1) {
                return singleSorted(toNumber(partsA[0]), toNumber(partsB[0]));
              }
              for (let i2 = 0, l = Math.max(partsA.length, partsB.length); i2 < l; i2++) {
                const diff = sorted(toNumber(partsA[i2]), toNumber(partsB[i2]));
                if (diff) {
                  return diff;
                }
              }
              return 0;
            });
          }
          const latest = customSort ? tags[0] : [...tags].reverse().find((tag) => tag.indexOf(".") >= 0);
          return new TagList(tags, latest);
        };
      }
    });
    tag_exports = {};
    __export2(tag_exports, {
      addAnnotatedTagTask: () => addAnnotatedTagTask,
      addTagTask: () => addTagTask,
      tagListTask: () => tagListTask
    });
    init_tag = __esm2({
      "src/lib/tasks/tag.ts"() {
        "use strict";
        init_TagList();
      }
    });
    require_git = __commonJS2({
      "src/git.js"(exports, module) {
        "use strict";
        var { GitExecutor: GitExecutor2 } = (init_git_executor(), __toCommonJS(git_executor_exports));
        var { SimpleGitApi: SimpleGitApi2 } = (init_simple_git_api(), __toCommonJS(simple_git_api_exports));
        var { Scheduler: Scheduler2 } = (init_scheduler(), __toCommonJS(scheduler_exports));
        var { adhocExecTask: adhocExecTask2, configurationErrorTask: configurationErrorTask2 } = (init_task(), __toCommonJS(task_exports));
        var {
          asArray: asArray2,
          filterArray: filterArray2,
          filterPrimitives: filterPrimitives2,
          filterString: filterString2,
          filterStringOrStringArray: filterStringOrStringArray2,
          filterType: filterType2,
          getTrailingOptions: getTrailingOptions2,
          trailingFunctionArgument: trailingFunctionArgument2,
          trailingOptionsArgument: trailingOptionsArgument2
        } = (init_utils(), __toCommonJS(utils_exports));
        var { applyPatchTask: applyPatchTask2 } = (init_apply_patch(), __toCommonJS(apply_patch_exports));
        var {
          branchTask: branchTask2,
          branchLocalTask: branchLocalTask2,
          deleteBranchesTask: deleteBranchesTask2,
          deleteBranchTask: deleteBranchTask2
        } = (init_branch(), __toCommonJS(branch_exports));
        var { checkIgnoreTask: checkIgnoreTask2 } = (init_check_ignore(), __toCommonJS(check_ignore_exports));
        var { checkIsRepoTask: checkIsRepoTask2 } = (init_check_is_repo(), __toCommonJS(check_is_repo_exports));
        var { cleanWithOptionsTask: cleanWithOptionsTask2, isCleanOptionsArray: isCleanOptionsArray2 } = (init_clean(), __toCommonJS(clean_exports));
        var { diffSummaryTask: diffSummaryTask2 } = (init_diff(), __toCommonJS(diff_exports));
        var { fetchTask: fetchTask2 } = (init_fetch(), __toCommonJS(fetch_exports));
        var { moveTask: moveTask2 } = (init_move(), __toCommonJS(move_exports));
        var { pullTask: pullTask2 } = (init_pull(), __toCommonJS(pull_exports));
        var { pushTagsTask: pushTagsTask2 } = (init_push(), __toCommonJS(push_exports));
        var {
          addRemoteTask: addRemoteTask2,
          getRemotesTask: getRemotesTask2,
          listRemotesTask: listRemotesTask2,
          remoteTask: remoteTask2,
          removeRemoteTask: removeRemoteTask2
        } = (init_remote(), __toCommonJS(remote_exports));
        var { getResetMode: getResetMode2, resetTask: resetTask2 } = (init_reset(), __toCommonJS(reset_exports));
        var { stashListTask: stashListTask2 } = (init_stash_list(), __toCommonJS(stash_list_exports));
        var {
          addSubModuleTask: addSubModuleTask2,
          initSubModuleTask: initSubModuleTask2,
          subModuleTask: subModuleTask2,
          updateSubModuleTask: updateSubModuleTask2
        } = (init_sub_module(), __toCommonJS(sub_module_exports));
        var { addAnnotatedTagTask: addAnnotatedTagTask2, addTagTask: addTagTask2, tagListTask: tagListTask2 } = (init_tag(), __toCommonJS(tag_exports));
        var { straightThroughBufferTask: straightThroughBufferTask2, straightThroughStringTask: straightThroughStringTask2 } = (init_task(), __toCommonJS(task_exports));
        function Git2(options, plugins) {
          this._plugins = plugins;
          this._executor = new GitExecutor2(
            options.baseDir,
            new Scheduler2(options.maxConcurrentProcesses),
            plugins
          );
          this._trimmed = options.trimmed;
        }
        (Git2.prototype = Object.create(SimpleGitApi2.prototype)).constructor = Git2;
        Git2.prototype.customBinary = function(command) {
          this._plugins.reconfigure("binary", command);
          return this;
        };
        Git2.prototype.env = function(name, value) {
          if (arguments.length === 1 && typeof name === "object") {
            this._executor.env = name;
          } else {
            (this._executor.env = this._executor.env || {})[name] = value;
          }
          return this;
        };
        Git2.prototype.stashList = function(options) {
          return this._runTask(
            stashListTask2(
              trailingOptionsArgument2(arguments) || {},
              filterArray2(options) && options || []
            ),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.mv = function(from, to) {
          return this._runTask(moveTask2(from, to), trailingFunctionArgument2(arguments));
        };
        Git2.prototype.checkoutLatestTag = function(then) {
          var git = this;
          return this.pull(function() {
            git.tags(function(err, tags) {
              git.checkout(tags.latest, then);
            });
          });
        };
        Git2.prototype.pull = function(remote, branch, options, then) {
          return this._runTask(
            pullTask2(
              filterType2(remote, filterString2),
              filterType2(branch, filterString2),
              getTrailingOptions2(arguments)
            ),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.fetch = function(remote, branch) {
          return this._runTask(
            fetchTask2(
              filterType2(remote, filterString2),
              filterType2(branch, filterString2),
              getTrailingOptions2(arguments)
            ),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.silent = function(silence) {
          return this._runTask(
            adhocExecTask2(
              () => console.warn(
                "simple-git deprecation notice: git.silent: logging should be configured using the `debug` library / `DEBUG` environment variable, this method will be removed."
              )
            )
          );
        };
        Git2.prototype.tags = function(options, then) {
          return this._runTask(
            tagListTask2(getTrailingOptions2(arguments)),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.rebase = function() {
          return this._runTask(
            straightThroughStringTask2(["rebase", ...getTrailingOptions2(arguments)]),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.reset = function(mode) {
          return this._runTask(
            resetTask2(getResetMode2(mode), getTrailingOptions2(arguments)),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.revert = function(commit) {
          const next = trailingFunctionArgument2(arguments);
          if (typeof commit !== "string") {
            return this._runTask(configurationErrorTask2("Commit must be a string"), next);
          }
          return this._runTask(
            straightThroughStringTask2(["revert", ...getTrailingOptions2(arguments, 0, true), commit]),
            next
          );
        };
        Git2.prototype.addTag = function(name) {
          const task = typeof name === "string" ? addTagTask2(name) : configurationErrorTask2("Git.addTag requires a tag name");
          return this._runTask(task, trailingFunctionArgument2(arguments));
        };
        Git2.prototype.addAnnotatedTag = function(tagName, tagMessage) {
          return this._runTask(
            addAnnotatedTagTask2(tagName, tagMessage),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.deleteLocalBranch = function(branchName, forceDelete, then) {
          return this._runTask(
            deleteBranchTask2(branchName, typeof forceDelete === "boolean" ? forceDelete : false),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.deleteLocalBranches = function(branchNames, forceDelete, then) {
          return this._runTask(
            deleteBranchesTask2(branchNames, typeof forceDelete === "boolean" ? forceDelete : false),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.branch = function(options, then) {
          return this._runTask(
            branchTask2(getTrailingOptions2(arguments)),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.branchLocal = function(then) {
          return this._runTask(branchLocalTask2(), trailingFunctionArgument2(arguments));
        };
        Git2.prototype.raw = function(commands) {
          const createRestCommands = !Array.isArray(commands);
          const command = [].slice.call(createRestCommands ? arguments : commands, 0);
          for (let i2 = 0; i2 < command.length && createRestCommands; i2++) {
            if (!filterPrimitives2(command[i2])) {
              command.splice(i2, command.length - i2);
              break;
            }
          }
          command.push(...getTrailingOptions2(arguments, 0, true));
          var next = trailingFunctionArgument2(arguments);
          if (!command.length) {
            return this._runTask(
              configurationErrorTask2("Raw: must supply one or more command to execute"),
              next
            );
          }
          return this._runTask(straightThroughStringTask2(command, this._trimmed), next);
        };
        Git2.prototype.submoduleAdd = function(repo, path, then) {
          return this._runTask(addSubModuleTask2(repo, path), trailingFunctionArgument2(arguments));
        };
        Git2.prototype.submoduleUpdate = function(args, then) {
          return this._runTask(
            updateSubModuleTask2(getTrailingOptions2(arguments, true)),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.submoduleInit = function(args, then) {
          return this._runTask(
            initSubModuleTask2(getTrailingOptions2(arguments, true)),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.subModule = function(options, then) {
          return this._runTask(
            subModuleTask2(getTrailingOptions2(arguments)),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.listRemote = function() {
          return this._runTask(
            listRemotesTask2(getTrailingOptions2(arguments)),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.addRemote = function(remoteName, remoteRepo, then) {
          return this._runTask(
            addRemoteTask2(remoteName, remoteRepo, getTrailingOptions2(arguments)),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.removeRemote = function(remoteName, then) {
          return this._runTask(removeRemoteTask2(remoteName), trailingFunctionArgument2(arguments));
        };
        Git2.prototype.getRemotes = function(verbose, then) {
          return this._runTask(getRemotesTask2(verbose === true), trailingFunctionArgument2(arguments));
        };
        Git2.prototype.remote = function(options, then) {
          return this._runTask(
            remoteTask2(getTrailingOptions2(arguments)),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.tag = function(options, then) {
          const command = getTrailingOptions2(arguments);
          if (command[0] !== "tag") {
            command.unshift("tag");
          }
          return this._runTask(straightThroughStringTask2(command), trailingFunctionArgument2(arguments));
        };
        Git2.prototype.updateServerInfo = function(then) {
          return this._runTask(
            straightThroughStringTask2(["update-server-info"]),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.pushTags = function(remote, then) {
          const task = pushTagsTask2(
            { remote: filterType2(remote, filterString2) },
            getTrailingOptions2(arguments)
          );
          return this._runTask(task, trailingFunctionArgument2(arguments));
        };
        Git2.prototype.rm = function(files) {
          return this._runTask(
            straightThroughStringTask2(["rm", "-f", ...asArray2(files)]),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.rmKeepLocal = function(files) {
          return this._runTask(
            straightThroughStringTask2(["rm", "--cached", ...asArray2(files)]),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.catFile = function(options, then) {
          return this._catFile("utf-8", arguments);
        };
        Git2.prototype.binaryCatFile = function() {
          return this._catFile("buffer", arguments);
        };
        Git2.prototype._catFile = function(format, args) {
          var handler = trailingFunctionArgument2(args);
          var command = ["cat-file"];
          var options = args[0];
          if (typeof options === "string") {
            return this._runTask(
              configurationErrorTask2("Git.catFile: options must be supplied as an array of strings"),
              handler
            );
          }
          if (Array.isArray(options)) {
            command.push.apply(command, options);
          }
          const task = format === "buffer" ? straightThroughBufferTask2(command) : straightThroughStringTask2(command);
          return this._runTask(task, handler);
        };
        Git2.prototype.diff = function(options, then) {
          const task = filterString2(options) ? configurationErrorTask2(
            "git.diff: supplying options as a single string is no longer supported, switch to an array of strings"
          ) : straightThroughStringTask2(["diff", ...getTrailingOptions2(arguments)]);
          return this._runTask(task, trailingFunctionArgument2(arguments));
        };
        Git2.prototype.diffSummary = function() {
          return this._runTask(
            diffSummaryTask2(getTrailingOptions2(arguments, 1)),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.applyPatch = function(patches) {
          const task = !filterStringOrStringArray2(patches) ? configurationErrorTask2(
            `git.applyPatch requires one or more string patches as the first argument`
          ) : applyPatchTask2(asArray2(patches), getTrailingOptions2([].slice.call(arguments, 1)));
          return this._runTask(task, trailingFunctionArgument2(arguments));
        };
        Git2.prototype.revparse = function() {
          const commands = ["rev-parse", ...getTrailingOptions2(arguments, true)];
          return this._runTask(
            straightThroughStringTask2(commands, true),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.clean = function(mode, options, then) {
          const usingCleanOptionsArray = isCleanOptionsArray2(mode);
          const cleanMode = usingCleanOptionsArray && mode.join("") || filterType2(mode, filterString2) || "";
          const customArgs = getTrailingOptions2([].slice.call(arguments, usingCleanOptionsArray ? 1 : 0));
          return this._runTask(
            cleanWithOptionsTask2(cleanMode, customArgs),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.exec = function(then) {
          const task = {
            commands: [],
            format: "utf-8",
            parser() {
              if (typeof then === "function") {
                then();
              }
            }
          };
          return this._runTask(task);
        };
        Git2.prototype.clearQueue = function() {
          return this._runTask(
            adhocExecTask2(
              () => console.warn(
                "simple-git deprecation notice: clearQueue() is deprecated and will be removed, switch to using the abortPlugin instead."
              )
            )
          );
        };
        Git2.prototype.checkIgnore = function(pathnames, then) {
          return this._runTask(
            checkIgnoreTask2(asArray2(filterType2(pathnames, filterStringOrStringArray2, []))),
            trailingFunctionArgument2(arguments)
          );
        };
        Git2.prototype.checkIsRepo = function(checkType, then) {
          return this._runTask(
            checkIsRepoTask2(filterType2(checkType, filterString2)),
            trailingFunctionArgument2(arguments)
          );
        };
        module.exports = Git2;
      }
    });
    init_git_error();
    GitConstructError = class extends GitError {
      constructor(config, message) {
        super(void 0, message);
        this.config = config;
      }
    };
    init_git_error();
    init_git_error();
    GitPluginError = class extends GitError {
      constructor(task, plugin, message) {
        super(task, message);
        this.task = task;
        this.plugin = plugin;
        Object.setPrototypeOf(this, new.target.prototype);
      }
    };
    init_git_response_error();
    init_task_configuration_error();
    init_check_is_repo();
    init_clean();
    init_config2();
    init_diff_name_status();
    init_grep();
    init_reset();
    init_utils();
    init_utils();
    never = (0, import_promise_deferred2.deferred)().promise;
    init_utils();
    WRONG_NUMBER_ERR = `Invalid value supplied for custom binary, requires a single string or an array containing either one or two strings`;
    WRONG_CHARS_ERR = `Invalid value supplied for custom binary, restricted characters must be removed or supply the unsafe.allowUnsafeCustomBinary option`;
    init_git_error();
    init_utils();
    PluginStore = class {
      constructor() {
        this.plugins = /* @__PURE__ */ new Set();
        this.events = new EventEmitter();
      }
      on(type, listener) {
        this.events.on(type, listener);
      }
      reconfigure(type, data) {
        this.events.emit(type, data);
      }
      append(type, action) {
        const plugin = append(this.plugins, { type, action });
        return () => this.plugins.delete(plugin);
      }
      add(plugin) {
        const plugins = [];
        asArray(plugin).forEach((plugin2) => plugin2 && this.plugins.add(append(plugins, plugin2)));
        return () => {
          plugins.forEach((plugin2) => this.plugins.delete(plugin2));
        };
      }
      exec(type, data, context) {
        let output = data;
        const contextual = Object.freeze(Object.create(context));
        for (const plugin of this.plugins) {
          if (plugin.type === type) {
            output = plugin.action(output, contextual);
          }
        }
        return output;
      }
    };
    init_utils();
    init_utils();
    init_utils();
    Git = require_git();
    init_git_response_error();
    simpleGit = gitInstanceFactory;
  }
});

// src/git-auth.ts
import { spawn as spawn3 } from "node:child_process";
function gitAuthEnv(token) {
  return {
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "http.extraHeader",
    GIT_CONFIG_VALUE_0: `Cookie: CF_Authorization=${token}`,
    GIT_CONFIG_KEY_1: "http.extraHeader",
    GIT_CONFIG_VALUE_1: `Cf-Access-Jwt-Assertion: ${token}`,
    // If the helper-less push ever prompts (e.g. token rejected, server asks
    // for fresh creds), fail fast with a clear error rather than block on a
    // hidden terminal prompt.
    GIT_TERMINAL_PROMPT: "0"
  };
}
function authenticatedPush(opts) {
  return new Promise((resolveDone, reject) => {
    const env = { ...process.env, ...gitAuthEnv(opts.token) };
    const child = spawn3("git", ["push", opts.remote, opts.branch], {
      cwd: opts.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr?.setEncoding("utf-8");
    child.stderr?.on("data", (c3) => {
      stderr += c3;
    });
    child.on("error", (err) => {
      reject(new GitPushError(`failed to spawn git: ${err.message}`, null, null, stderr));
    });
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolveDone();
        return;
      }
      reject(
        new GitPushError(
          `git push ${opts.remote} ${opts.branch} failed${code !== null ? ` (exit ${code})` : ` (signal ${signal})`}${stderr ? `: ${stderr.trim()}` : ""}`,
          code,
          signal,
          stderr
        )
      );
    });
  });
}
var GitPushError;
var init_git_auth = __esm({
  "src/git-auth.ts"() {
    "use strict";
    GitPushError = class extends Error {
      constructor(message, exitCode, signal, stderr) {
        super(message);
        this.exitCode = exitCode;
        this.signal = signal;
        this.stderr = stderr;
        this.name = "GitPushError";
      }
    };
  }
});

// src/secret-guard.ts
import { readFileSync as readFileSync2, statSync as statSync2 } from "node:fs";
import { resolve as resolve2, sep } from "node:path";
function toPosix(p2) {
  return sep === "\\" ? p2.split(sep).join("/") : p2;
}
function matchesFilenameRule(relPath) {
  const posix = toPosix(relPath);
  for (const allow of FILENAME_ALLOWLIST) {
    if (allow.test(posix)) return null;
  }
  for (const { rule, pattern } of FILENAME_RULES) {
    if (pattern.test(posix)) return rule;
  }
  return null;
}
function matchesContentRule(absPath) {
  let size;
  try {
    size = statSync2(absPath).size;
  } catch {
    return null;
  }
  if (size === 0 || size > MAX_CONTENT_BYTES) return null;
  let buf;
  try {
    buf = readFileSync2(absPath);
  } catch {
    return null;
  }
  if (buf.includes(0)) return null;
  const text = buf.toString("utf-8");
  for (const { rule, pattern } of CONTENT_RULES) {
    if (pattern.test(text)) return rule;
  }
  return null;
}
async function candidatePathsFromGit(git) {
  const out = await git.raw([
    "ls-files",
    "--others",
    "--exclude-standard",
    "--cached"
  ]);
  return out.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length > 0);
}
function assertNoSecrets(root, relPaths) {
  const matches = [];
  for (const raw of relPaths) {
    const rel = toPosix(raw);
    if (rel === "" || rel === ".") continue;
    const filenameHit = matchesFilenameRule(rel);
    if (filenameHit) {
      matches.push({ file: rel, rule: filenameHit });
      continue;
    }
    const abs = resolve2(root, rel);
    const contentHit = matchesContentRule(abs);
    if (contentHit) {
      matches.push({ file: rel, rule: contentHit });
    }
  }
  if (matches.length > 0) throw new SecretFoundError(matches);
}
var FILENAME_RULES, FILENAME_ALLOWLIST, CONTENT_RULES, SecretFoundError, MAX_CONTENT_BYTES, DEFAULT_GITIGNORE;
var init_secret_guard = __esm({
  "src/secret-guard.ts"() {
    "use strict";
    FILENAME_RULES = [
      { rule: "env-file", pattern: /(?:^|\/)\.env(?:\.[^/]+)?$/ },
      { rule: "ssh-private-key", pattern: /(?:^|\/)id_rsa(?:\..*)?$/ },
      { rule: "ssh-private-key", pattern: /(?:^|\/)id_ed25519(?:\..*)?$/ },
      { rule: "pem-key", pattern: /\.pem$/ },
      { rule: "pkcs12", pattern: /\.p12$/ },
      { rule: "pfx", pattern: /\.pfx$/ },
      { rule: "btrmnt-credentials", pattern: /(?:^|\/)credentials\.json$/ },
      { rule: "aws-dir", pattern: /(?:^|\/)\.aws\// },
      { rule: "gcp-service-account", pattern: /(?:^|\/)serviceAccountKey[^/]*\.json$/ },
      { rule: "gcloud-config", pattern: /(?:^|\/)\.gcloud\// },
      { rule: "kube-config", pattern: /(?:^|\/)\.kube\/config$/ }
    ];
    FILENAME_ALLOWLIST = [
      /(?:^|\/)\.env\.example$/,
      /(?:^|\/)\.env\.sample$/,
      /(?:^|\/)\.env\.template$/
    ];
    CONTENT_RULES = [
      { rule: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
      { rule: "github-pat", pattern: /\bghp_[A-Za-z0-9]{36}\b/ },
      { rule: "github-oauth", pattern: /\bgho_[A-Za-z0-9]{36}\b/ },
      { rule: "openai-key", pattern: /\bsk-[A-Za-z0-9]{20,}\b/ },
      { rule: "anthropic-key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
      { rule: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]+\b/ },
      {
        rule: "private-key-block",
        pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/
      },
      { rule: "gcp-private-key-json", pattern: /"private_key"\s*:\s*"-----BEGIN/ }
    ];
    SecretFoundError = class extends Error {
      constructor(matches) {
        super(
          `refusing to stage potential secrets:
` + matches.map((m) => `  - ${m.file} (${m.rule})`).join("\n") + `

Review the files above. If a hit is a false positive, re-run with --allow-secrets to override.`
        );
        this.matches = matches;
        this.name = "SecretFoundError";
      }
    };
    MAX_CONTENT_BYTES = 256 * 1024;
    DEFAULT_GITIGNORE = `# Created by btrmnt project new.
# These patterns keep secrets and build artefacts from being pushed to the
# hosted git remote on \`btrmnt publish\`. Tighten or remove anything you
# don't need \u2014 but keep the secret-bearing entries.
node_modules/
dist/
build/
.next/
.cache/
.env
.env.*
!.env.example
!.env.sample
!.env.template
*.pem
*.p12
*.pfx
id_rsa
id_rsa.*
id_ed25519
id_ed25519.*
.aws/
.gcloud/
.kube/config
serviceAccountKey*.json
.DS_Store
*.log
`;
  }
});

// src/commands/project.ts
var project_exports = {};
__export(project_exports, {
  projectDelete: () => projectDelete,
  projectList: () => projectList,
  projectNew: () => projectNew
});
import { existsSync as existsSync2, mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { resolve as resolve3 } from "node:path";
async function projectNew(args) {
  if (!SLUG_RE.test(args.slug)) {
    throw new Error(
      `invalid slug ${JSON.stringify(args.slug)}: must match ${SLUG_RE.source}`
    );
  }
  const creds = readCredentials();
  const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
  const client = new ApiClient(endpoint, creds.token);
  const project = await client.createProject({ slug: args.slug });
  const projectDir = resolve3(args.path ?? resolveCwd());
  mkdirSync2(projectDir, { recursive: true });
  const git = simpleGit(projectDir);
  if (!existsSync2(resolve3(projectDir, ".git"))) {
    await git.init();
  }
  const gitignorePath = resolve3(projectDir, ".gitignore");
  if (!existsSync2(gitignorePath)) {
    writeFileSync2(gitignorePath, DEFAULT_GITIGNORE);
  }
  const candidates = await candidatePathsFromGit(git);
  try {
    assertNoSecrets(projectDir, candidates);
  } catch (err) {
    if (err instanceof SecretFoundError && args.allowSecrets) {
      writeStderrJson({
        warning: "secret-guard bypassed via --allow-secrets",
        matches: err.matches
      });
    } else {
      throw err;
    }
  }
  let identityEmail = "btrmnt@local";
  try {
    const me = await client.whoami();
    if (me?.user?.email) identityEmail = me.user.email;
  } catch {
  }
  try {
    await git.addConfig("user.email", identityEmail);
  } catch {
  }
  try {
    await git.addConfig("user.name", identityEmail);
  } catch {
  }
  if (!project.git_remote_url) {
    throw new Error("api did not return git_remote_url; cannot configure remote");
  }
  const remotes = await git.getRemotes(true);
  const existing = remotes.find((r2) => r2.name === "btrmnt");
  if (existing) {
    await git.remote(["set-url", "btrmnt", project.git_remote_url]);
  } else {
    await git.addRemote("btrmnt", project.git_remote_url);
  }
  await git.add(".");
  const status = await git.status();
  const hasInitialCommit = await git.raw(["rev-parse", "--verify", "HEAD"]).then(() => true).catch(() => false);
  if (status.staged.length > 0 || !hasInitialCommit) {
    if (!hasInitialCommit) {
      try {
        await git.commit("Initial commit", void 0, { "--allow-empty": null });
      } catch {
      }
    } else if (status.staged.length > 0) {
      await git.commit("Initial commit");
    }
  }
  try {
    await git.raw(["branch", "-M", "main"]);
  } catch {
  }
  await authenticatedPush({
    cwd: projectDir,
    remote: "btrmnt",
    branch: "main",
    token: creds.token
  });
  const testEnv = project.environments.find((e) => e.env === "test");
  writeStdout({
    project,
    test_url: testEnv?.url ?? null
  });
}
async function projectList(opts) {
  const creds = readCredentials();
  const endpoint = opts.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
  const client = new ApiClient(endpoint, creds.token);
  const projects = await client.listProjects();
  writeStdout(projects);
}
async function projectDelete(args) {
  if (!args.yes) {
    throw new Error("refusing to delete without --yes confirmation flag");
  }
  const creds = readCredentials();
  const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
  const client = new ApiClient(endpoint, creds.token);
  await client.deleteProject(args.slug);
  writeStdout({ ok: true, deleted: args.slug });
}
var SLUG_RE;
var init_project = __esm({
  "src/commands/project.ts"() {
    "use strict";
    init_esm();
    init_api();
    init_config();
    init_credentials();
    init_git_auth();
    init_output();
    init_output();
    init_secret_guard();
    SLUG_RE = /^[a-z][a-z0-9-]{0,40}[a-z0-9]$/;
  }
});

// src/commands/publish-promote.ts
var publish_promote_exports = {};
__export(publish_promote_exports, {
  promote: () => promote,
  publish: () => publish,
  rollback: () => rollback,
  slugFromRemote: () => slugFromRemote
});
import { existsSync as existsSync3 } from "node:fs";
import { resolve as resolve4 } from "node:path";
async function publish(args) {
  const cwd = resolveCwd();
  if (!existsSync3(resolve4(cwd, ".git"))) {
    throw new Error(`not a git repository: ${cwd}`);
  }
  const git = simpleGit(cwd);
  const remotes = await git.getRemotes(true);
  const btrmnt = remotes.find((r2) => r2.name === "btrmnt");
  if (!btrmnt) {
    throw new Error(
      `no \`btrmnt\` remote configured in ${cwd}. Run \`btrmnt project new\` first.`
    );
  }
  const candidates = await candidatePathsFromGit(git);
  try {
    assertNoSecrets(cwd, candidates);
  } catch (err) {
    if (err instanceof SecretFoundError && args.allowSecrets) {
      writeStderrJson({
        warning: "secret-guard bypassed via --allow-secrets",
        matches: err.matches
      });
    } else {
      throw err;
    }
  }
  await git.add(".");
  const status = await git.status();
  let sha = "";
  let message = args.message;
  if (status.staged.length > 0) {
    if (!message || message.trim().length === 0) {
      message = `publish ${(/* @__PURE__ */ new Date()).toISOString()}`;
    }
    const result = await git.commit(message);
    sha = result.commit;
  } else {
    const log = await git.log(["-1"]);
    sha = log.latest.hash;
    message = log.latest.message;
  }
  const creds = readCredentials();
  await authenticatedPush({ cwd, remote: "btrmnt", branch: "main", token: creds.token });
  let testUrl = null;
  try {
    const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
    const slug = slugFromRemote(btrmnt.refs.push);
    if (slug) {
      const list = await new ApiClient(endpoint, creds.token).listProjects();
      const found = list.find((p2) => p2.slug === slug);
      testUrl = found?.environments.find((e) => e.env === "test")?.url ?? null;
    }
  } catch {
  }
  if (sha && sha.length < 40) {
    try {
      sha = (await git.revparse(["HEAD"])).trim();
    } catch {
    }
  }
  writeStdout({ ok: true, sha, message, test_url: testUrl });
}
async function promote(args) {
  const slug = await resolveSlugFromArgsOrCwd(args.project);
  const creds = readCredentials();
  const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
  const client = new ApiClient(endpoint, creds.token);
  const env = await client.promote(slug);
  writeStdout(env);
}
async function rollback(args) {
  if (!/^[0-9a-f]{40}$/.test(args.to)) {
    throw new Error("--to must be a 40-char hex commit id");
  }
  const slug = await resolveSlugFromArgsOrCwd(args.project);
  const creds = readCredentials();
  const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
  const client = new ApiClient(endpoint, creds.token);
  const env = await client.rollback(slug, args.to);
  writeStdout(env);
}
async function resolveSlugFromArgsOrCwd(explicit) {
  if (explicit) return explicit;
  const cwd = resolveCwd();
  if (!existsSync3(resolve4(cwd, ".git"))) {
    throw new Error(`not a git repository: ${cwd}; pass --project <slug> instead`);
  }
  const git = simpleGit(cwd);
  const remotes = await git.getRemotes(true);
  const btrmnt = remotes.find((r2) => r2.name === "btrmnt");
  if (!btrmnt) {
    throw new Error("no `btrmnt` remote in CWD; pass --project <slug> instead");
  }
  const slug = slugFromRemote(btrmnt.refs.push);
  if (!slug) {
    throw new Error(`could not parse a project slug from ${btrmnt.refs.push}`);
  }
  return slug;
}
function slugFromRemote(url) {
  const m = url.match(/\/([a-z][a-z0-9-]{0,40}[a-z0-9])\.git$/);
  if (m) return m[1];
  const m2 = url.match(/\/([a-z][a-z0-9-]{0,40}[a-z0-9])\/?$/);
  if (m2) return m2[1];
  return null;
}
var init_publish_promote = __esm({
  "src/commands/publish-promote.ts"() {
    "use strict";
    init_esm();
    init_api();
    init_config();
    init_credentials();
    init_git_auth();
    init_output();
    init_secret_guard();
  }
});

// src/commands/grants.ts
var grants_exports = {};
__export(grants_exports, {
  grant: () => grant,
  invite: () => invite,
  listGrants: () => listGrants,
  revoke: () => revoke
});
import { existsSync as existsSync4 } from "node:fs";
import { resolve as resolve5 } from "node:path";
function assertEmail(email) {
  if (!EMAIL_BASIC_RE.test(email)) {
    throw new Error(`invalid email ${JSON.stringify(email)}`);
  }
}
async function resolveSlug(explicit) {
  if (explicit && explicit.trim().length > 0) return explicit;
  const cwd = resolveCwd();
  if (!existsSync4(resolve5(cwd, ".git"))) {
    throw new Error(
      `no slug provided and CWD ${cwd} is not a git repo with a btrmnt remote`
    );
  }
  const git = simpleGit(cwd);
  const remotes = await git.getRemotes(true);
  const btrmnt = remotes.find((r2) => r2.name === "btrmnt");
  if (!btrmnt) {
    throw new Error("no `btrmnt` remote in CWD; provide an explicit slug argument");
  }
  const slug = slugFromRemote(btrmnt.refs.push);
  if (!slug) throw new Error(`could not parse a slug from ${btrmnt.refs.push}`);
  return slug;
}
async function listGrants(args) {
  const slug = await resolveSlug(args.slug);
  const creds = readCredentials();
  const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
  const client = new ApiClient(endpoint, creds.token);
  const grants = await client.listGrants(slug);
  const order = [];
  const byEmail = /* @__PURE__ */ new Map();
  for (const g of grants) {
    if (!byEmail.has(g.email)) {
      byEmail.set(g.email, /* @__PURE__ */ new Set());
      order.push(g.email);
    }
    byEmail.get(g.email).add(g.env);
  }
  const envOrder = (e) => e === "test" ? 0 : 1;
  const viewers = order.map((email) => ({
    email,
    envs: Array.from(byEmail.get(email)).sort((a, b2) => envOrder(a) - envOrder(b2))
  }));
  writeStdout({ slug, viewers });
}
async function grant(args) {
  assertEmail(args.email);
  const slug = await resolveSlug(args.slug);
  const creds = readCredentials();
  const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
  const client = new ApiClient(endpoint, creds.token);
  const grants = await client.grant(slug, { email: args.email, env: args.env });
  writeStdout({ ok: true, slug, grants });
}
async function revoke(args) {
  assertEmail(args.email);
  const slug = await resolveSlug(args.slug);
  const creds = readCredentials();
  const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
  const client = new ApiClient(endpoint, creds.token);
  await client.revoke(slug, args.email, args.env);
  writeStdout({ ok: true, slug, email: args.email, env: args.env });
}
async function invite(args) {
  assertEmail(args.email);
  const creds = readCredentials();
  const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
  const client = new ApiClient(endpoint, creds.token);
  const result = await client.invite({ email: args.email, role: args.role });
  writeStdout({
    ...result,
    message: `Invited ${result.user.email}. Tell them to install the plugin and run /artifacts to sign in.`
  });
}
var EMAIL_BASIC_RE;
var init_grants = __esm({
  "src/commands/grants.ts"() {
    "use strict";
    init_esm();
    init_api();
    init_config();
    init_credentials();
    init_output();
    init_publish_promote();
    EMAIL_BASIC_RE = /^[^\s/?#@]+@[^\s/?#@]+\.[^\s/?#@]+$/;
  }
});

// src/cli.ts
init_output();
init_config();
var COMMANDS = [
  { name: "login", description: "Sign in to the btrmnt artifact platform." },
  { name: "whoami", description: "Print the currently signed-in user + tenant." },
  { name: "project new", description: "Create a new project from a local folder." },
  { name: "project list", description: "List projects in the current tenant." },
  { name: "project delete", description: "Delete a project (and its environments)." },
  { name: "publish", description: "Push the current project's main branch and deploy to test." },
  { name: "promote", description: "Fast-forward a project's prod branch to main and deploy." },
  { name: "rollback", description: "Roll a project's prod branch back to an explicit historical commit." },
  { name: "grant", description: "Grant a user access to a project (test, prod, or both)." },
  { name: "grants", description: "List who has direct viewer access to a project, grouped by email." },
  { name: "revoke", description: "Revoke a user's access to a project." },
  { name: "invite", description: "Invite a new user into the current tenant." },
  { name: "list", description: "List projects (alias of `project list`)." }
];
function topLevelHelp() {
  writeStdout({
    name: "btrmnt",
    description: "btrmnt artifact platform client.",
    commands: COMMANDS
  });
}
function commandHelp(name) {
  const spec = COMMANDS.find((c3) => c3.name === name);
  writeStdout({ command: spec.name, description: spec.description });
}
function matchCommand(argv2) {
  if (argv2.length === 0) return null;
  const twoWord = `${argv2[0]} ${argv2[1] ?? ""}`.trim();
  const two = COMMANDS.find((c3) => c3.name === twoWord);
  if (two) return { name: two.name, rest: argv2.slice(2) };
  const one = COMMANDS.find((c3) => c3.name === argv2[0]);
  if (one) return { name: one.name, rest: argv2.slice(1) };
  return null;
}
function parseFlags(rest, boolFlags = /* @__PURE__ */ new Set()) {
  const positional = [];
  const flags = {};
  for (let i2 = 0; i2 < rest.length; i2++) {
    const arg = rest[i2];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      let key;
      let value;
      if (eq >= 0) {
        key = arg.slice(2, eq);
        value = arg.slice(eq + 1);
      } else {
        key = arg.slice(2);
        if (boolFlags.has(key)) {
          value = true;
        } else {
          const next = rest[i2 + 1];
          if (next === void 0 || next.startsWith("--")) {
            value = true;
          } else {
            value = next;
            i2 += 1;
          }
        }
      }
      flags[key] = value;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}
function asEnvScope(value, fallback) {
  if (typeof value !== "string") return fallback;
  if (value === "test" || value === "prod" || value === "both") return value;
  throw new Error(`invalid --env ${JSON.stringify(value)}: must be test, prod, or both`);
}
function asRole(value, fallback) {
  if (typeof value !== "string") return fallback;
  if (value === "tenant_admin" || value === "tenant_user") return value;
  throw new Error(`invalid --role ${JSON.stringify(value)}: must be tenant_admin or tenant_user`);
}
function optStr(flags, key, asKey) {
  const v = flags[key];
  if (typeof v === "string") return { [asKey]: v };
  return {};
}
async function dispatch(name, rest) {
  switch (name) {
    case "login": {
      const { flags } = parseFlags(rest);
      const { login: login2 } = await Promise.resolve().then(() => (init_login(), login_exports));
      const loginOpts = {};
      if (typeof flags["api-endpoint"] === "string") loginOpts.apiEndpoint = flags["api-endpoint"];
      if (typeof flags["timeout-ms"] === "string")
        loginOpts.timeoutMs = Number.parseInt(flags["timeout-ms"], 10);
      await login2(loginOpts);
      return 0;
    }
    case "whoami": {
      const { flags } = parseFlags(rest);
      try {
        const { whoami: whoami2 } = await Promise.resolve().then(() => (init_whoami(), whoami_exports));
        await whoami2({ ...optStr(flags, "api-endpoint", "apiEndpoint") });
        return 0;
      } catch (err) {
        const endpoint = resolveApiEndpoint(
          typeof flags["api-endpoint"] === "string" ? flags["api-endpoint"] : void 0
        );
        writeStderrJson({
          error: err.message,
          api_endpoint: endpoint
        });
        return 1;
      }
    }
    case "project new": {
      const { positional, flags } = parseFlags(rest, /* @__PURE__ */ new Set(["allow-secrets"]));
      const slug = positional[0];
      if (!slug) throw new Error("project new: missing required <slug> argument");
      const { projectNew: projectNew2 } = await Promise.resolve().then(() => (init_project(), project_exports));
      await projectNew2({
        slug,
        allowSecrets: flags["allow-secrets"] === true,
        ...optStr(flags, "path", "path"),
        ...optStr(flags, "api-endpoint", "apiEndpoint")
      });
      return 0;
    }
    case "project list":
    case "list": {
      const { flags } = parseFlags(rest);
      const { projectList: projectList2 } = await Promise.resolve().then(() => (init_project(), project_exports));
      await projectList2({ ...optStr(flags, "api-endpoint", "apiEndpoint") });
      return 0;
    }
    case "project delete": {
      const { positional, flags } = parseFlags(rest, /* @__PURE__ */ new Set(["yes"]));
      const slug = positional[0];
      if (!slug) throw new Error("project delete: missing required <slug> argument");
      const { projectDelete: projectDelete2 } = await Promise.resolve().then(() => (init_project(), project_exports));
      await projectDelete2({
        slug,
        yes: flags.yes === true,
        ...optStr(flags, "api-endpoint", "apiEndpoint")
      });
      return 0;
    }
    case "publish": {
      const { flags } = parseFlags(rest, /* @__PURE__ */ new Set(["allow-secrets"]));
      const { publish: publish2 } = await Promise.resolve().then(() => (init_publish_promote(), publish_promote_exports));
      await publish2({
        allowSecrets: flags["allow-secrets"] === true,
        ...optStr(flags, "message", "message"),
        ...optStr(flags, "api-endpoint", "apiEndpoint")
      });
      return 0;
    }
    case "promote": {
      const { flags } = parseFlags(rest);
      const { promote: promote2 } = await Promise.resolve().then(() => (init_publish_promote(), publish_promote_exports));
      await promote2({
        ...optStr(flags, "project", "project"),
        ...optStr(flags, "api-endpoint", "apiEndpoint")
      });
      return 0;
    }
    case "rollback": {
      const { positional, flags } = parseFlags(rest);
      const slugArg = positional[0];
      const to = typeof flags.to === "string" ? flags.to : void 0;
      if (!to) throw new Error("rollback: --to <sha> is required");
      const { rollback: rollback2 } = await Promise.resolve().then(() => (init_publish_promote(), publish_promote_exports));
      await rollback2({
        ...slugArg !== void 0 ? { project: slugArg } : optStr(flags, "project", "project"),
        to,
        ...optStr(flags, "api-endpoint", "apiEndpoint")
      });
      return 0;
    }
    case "grant": {
      const { positional, flags } = parseFlags(rest);
      const email = positional[0];
      const slugArg = positional[1];
      if (!email) throw new Error("grant: missing required <email> argument");
      const env = asEnvScope(flags.env, "both");
      const { grant: grant2 } = await Promise.resolve().then(() => (init_grants(), grants_exports));
      await grant2({
        email,
        ...slugArg !== void 0 ? { slug: slugArg } : {},
        env,
        ...optStr(flags, "api-endpoint", "apiEndpoint")
      });
      return 0;
    }
    case "grants": {
      const { positional, flags } = parseFlags(rest);
      const slugArg = positional[0];
      const { listGrants: listGrants2 } = await Promise.resolve().then(() => (init_grants(), grants_exports));
      await listGrants2({
        ...slugArg !== void 0 ? { slug: slugArg } : {},
        ...optStr(flags, "api-endpoint", "apiEndpoint")
      });
      return 0;
    }
    case "revoke": {
      const { positional, flags } = parseFlags(rest);
      const email = positional[0];
      const slugArg = positional[1];
      if (!email) throw new Error("revoke: missing required <email> argument");
      const env = asEnvScope(flags.env, "both");
      const { revoke: revoke2 } = await Promise.resolve().then(() => (init_grants(), grants_exports));
      await revoke2({
        email,
        ...slugArg !== void 0 ? { slug: slugArg } : {},
        env,
        ...optStr(flags, "api-endpoint", "apiEndpoint")
      });
      return 0;
    }
    case "invite": {
      const { positional, flags } = parseFlags(rest);
      const email = positional[0];
      if (!email) throw new Error("invite: missing required <email> argument");
      const role = asRole(flags.role, "tenant_user");
      const { invite: invite2 } = await Promise.resolve().then(() => (init_grants(), grants_exports));
      await invite2({
        email,
        role,
        ...optStr(flags, "api-endpoint", "apiEndpoint")
      });
      return 0;
    }
    default: {
      writeStderrJson({ error: "unknown command", command: name });
      return 1;
    }
  }
}
async function run(argv2) {
  if (argv2.length === 0 || argv2[0] === "--help" || argv2[0] === "-h") {
    topLevelHelp();
    return 0;
  }
  const matched = matchCommand(argv2);
  if (!matched) {
    writeStderrJson({ error: "unknown command", argv: [...argv2] });
    return 1;
  }
  if (matched.rest.includes("--help") || matched.rest.includes("-h")) {
    commandHelp(matched.name);
    return 0;
  }
  try {
    return await dispatch(matched.name, matched.rest);
  } catch (err) {
    writeStderrJson({ error: err.message });
    return 1;
  }
}
var argv = process.argv.slice(2);
run(argv).then((code) => {
  if (code !== 0) process.exit(code);
});
export {
  run
};
