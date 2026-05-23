// Cross-platform browser opener. Pure spawn so we don't pull in a
// dependency. macOS: `open`, Linux: `xdg-open`, Windows: `start`.
//
// In tests we set BTRMNT_TEST_DISABLE_BROWSER=1 — we print AUTH_URL=<url>
// to stderr instead, so the harness can drive the OAuth dance.
import { spawn } from 'node:child_process';
import { writeStderrRaw } from './output.js';
export function openBrowser(url) {
    if (process.env.BTRMNT_TEST_DISABLE_BROWSER === '1') {
        writeStderrRaw(`AUTH_URL=${url}`);
        return;
    }
    const platform = process.platform;
    let cmd;
    let args;
    if (platform === 'darwin') {
        cmd = 'open';
        args = [url];
    }
    else if (platform === 'win32') {
        cmd = 'cmd';
        args = ['/c', 'start', '""', url];
    }
    else {
        cmd = 'xdg-open';
        args = [url];
    }
    // detached + ignore so the CLI doesn't block on the browser process.
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    child.unref();
}
//# sourceMappingURL=browser.js.map