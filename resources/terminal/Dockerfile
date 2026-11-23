# syntax=docker/dockerfile:1
# Web terminal bridge (WebSocket <-> SSH). Self-contained: it needs no files next to it.
# Keep the embedded server in sync with server.mjs. Local build:
#   docker build -t rackatlas-terminal resources/terminal
#   docker run -p 8787:8787 -e APP_URL=https://rackatlas.dev -e TERMINAL_SECRET=... rackatlas-terminal
FROM node:26-alpine

WORKDIR /app

# ssh2 is pure JavaScript here, so no build tools are needed.
RUN npm install --omit=dev --no-audit --no-fund --no-package-lock ssh2@^1.17.0 ws@^8.22.1 \
    && npm cache clean --force

# The hosting builds with an empty context, so the app is embedded here (copy of server.mjs).
COPY <<'EOF_SERVER' /app/server.mjs
/**
 * Web terminal bridge: WebSocket on one side (the browser), an SSH shell on the other.
 *
 * The browser sends a one-time ticket issued by the Laravel app. This process swaps it for the SSH login
 * details of the server over the app's private API, so credentials never reach the browser, and then logs in
 * over SSH itself. A server without SSH login details has no terminal. (The agent only reports metrics.)
 *
 * Frames from the browser: {"t":"i","d":"<keystrokes>"} and {"t":"r","c":cols,"r":rows}.
 * Frames to the browser: binary shell output, and {"t":"status"|"error",...} control messages.
 *
 *  - Persistent shells: when the ticket carries a session key and tmux exists on the server, the shell is
 *    `tmux new-session -A -s ra-<key>`, so a reconnect finds the same shell. {"t":"end"} ends it for good.
 *    {"t":"cap","rid":1} answers with the whole scrollback as {"t":"cap","rid":1,"text":".."}.
 *  - Files over SFTP, all JSON with a request id `rid`: {"t":"ls","rid","path"} -> {"t":"ls","rid","path","entries"};
 *    {"t":"get","rid","path"} -> {"t":"file","rid","name","size","data"(base64)} ... {"t":"file","rid","last":true};
 *    {"t":"put","rid","path"(dir),"name","size","overwrite"} -> {"t":"put","rid","state":"ready"}, then
 *    {"t":"chunk","rid","data"} (each answered with {"t":"ack","rid"}) and {"t":"done","rid"} -> {"t":"put","rid","state":"done"};
 *    {"t":"cancel","rid"}. Failures are {"t":"fs-error","rid","code","message"}.
 *
 * Start with `npm run terminal` (Node 20.6+, reads .env).
 */
import { createServer } from 'node:http';
import { Client } from 'ssh2';
import { WebSocketServer } from 'ws';

const appUrl = (process.env.TERMINAL_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
const secret = process.env.TERMINAL_SECRET || '';
const host = process.env.TERMINAL_HOST || '127.0.0.1';
const port = Number(process.env.TERMINAL_PORT || 8787);
const idleMs = Number(process.env.TERMINAL_IDLE_MINUTES || 30) * 60_000;
const maxSessions = Number(process.env.TERMINAL_MAX_SESSIONS || 50);
const maxFileBytes = Number(process.env.TERMINAL_MAX_FILE_MB || 100) * 1024 * 1024;
const maxTransfers = 3;
const chunkBytes = 96 * 1024;
const FILE_FRAMES = new Set(['ls', 'get', 'put', 'chunk', 'done', 'cancel', 'cap', 'end']);
const sessionKeyPattern = /^[A-Za-z0-9]{16,32}$/;
const allowedOrigin = process.env.TERMINAL_ALLOWED_ORIGIN || (appUrl ? new URL(appUrl).origin : '');

if (!appUrl || !secret) {
    console.error('TERMINAL_SECRET and APP_URL (or TERMINAL_APP_URL) have to be set.');
    process.exit(1);
}

let sessions = 0;

async function api(path, body) {
    const response = await fetch(`${appUrl}/api/terminal/${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
    });

    return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
}

const http = createServer((request, response) => {
    response.writeHead(request.url === '/up' ? 200 : 404, { 'Content-Type': 'text/plain' });
    response.end(request.url === '/up' ? 'ok' : 'not found');
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

http.on('upgrade', (request, socket, head) => {
    if (allowedOrigin !== '' && request.headers.origin !== allowedOrigin) {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        socket.destroy();

        return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
});

wss.on('connection', (ws, request) => {
    const control = (message) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(message));
    const fail = (message) => {
        control({ t: 'error', message });
        ws.close();
    };

    if (sessions >= maxSessions) {
        return fail('The terminal server is busy. Try again in a moment.');
    }

    sessions++;

    const token = new URL(request.url, 'http://localhost').searchParams.get('token') || '';
    const ip = (request.headers['x-forwarded-for'] || request.socket.remoteAddress || '').split(',')[0].trim();

    /** What the browser talks to: write(keystrokes), resize(cols, rows), end(). Set once a shell is open. */
    let shell = null;
    let ssh = null;
    let size = { cols: 80, rows: 24 };
    let sized = false;
    let sizeWaiter = null;
    let idle = null;
    let closed = false;
    let granted = null;
    let tmuxName = null;
    let ending = null;
    let sftpPromise = null;
    const transfers = new Map();

    const touch = () => {
        clearTimeout(idle);
        idle = setTimeout(() => fail('Session closed after inactivity.'), idleMs);
    };

    const cleanup = () => {
        if (closed) {
            return;
        }

        closed = true;
        sessions--;
        clearTimeout(idle);

        for (const transfer of transfers.values()) {
            transfer.abort();
        }

        // A tab that was closed for good first takes its tmux session down, over the same connection.
        const hangUp = () => {
            shell?.end();
            ssh?.end();
        };

        if (ending !== null) {
            ending.then(hangUp);
        } else {
            hangUp();
        }

        if (granted !== null) {
            api('session-ended', {
                server_id: granted.server_id,
                user_id: granted.user_id,
                seconds: Math.round((Date.now() - granted.since) / 1000),
            }).catch(() => {});
        }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);

    ws.on('message', (raw, isBinary) => {
        if (isBinary) {
            return;
        }

        let message;

        try {
            message = JSON.parse(raw.toString());
        } catch {
            return;
        }

        if (message.t === 'r') {
            const cols = Math.min(Math.max(Number(message.c) || 80, 10), 500);
            const rows = Math.min(Math.max(Number(message.r) || 24, 2), 200);

            size = { cols, rows };
            shell?.resize(cols, rows);

            if (!sized) {
                sized = true;
                sizeWaiter?.();
            }
        } else if (message.t === 'i' && shell && typeof message.d === 'string') {
            touch();
            shell.write(message.d);
        } else if (FILE_FRAMES.has(message.t)) {
            touch();
            files(message).catch((error) => reply({ t: 'fs-error', rid: message.rid, code: 'failed', message: String(error?.message || error) }));
        }
    });

    const reply = (message) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(message));

    /** Runs a command on the server over the existing SSH connection, resolves with its output and exit code. */
    const run = (command, limit = 1024 * 1024) =>
        new Promise((resolve, reject) => {
            if (ssh === null) {
                return reject(new Error('Not available for this server.'));
            }

            ssh.exec(command, (error, stream) => {
                if (error) {
                    return reject(error);
                }

                const out = [];
                let size = 0;

                stream.on('data', (data) => {
                    if (size < limit) {
                        out.push(data);
                        size += data.length;
                    }
                });
                stream.stderr.on('data', () => {});
                stream.on('close', (code) => resolve({ code, text: Buffer.concat(out).toString('utf8') }));
            });
        });

    const sftp = () => {
        if (ssh === null) {
            return Promise.reject(new Error('Files are not available for this server.'));
        }

        sftpPromise ??= new Promise((resolve, reject) => ssh.sftp((error, session) => (error ? reject(error) : resolve(session))));

        return sftpPromise;
    };

    const callback = (fn) => new Promise((resolve, reject) => fn((error, value) => (error ? reject(error) : resolve(value))));

    const audit = (direction, path, bytes) => {
        if (granted !== null) {
            api('file', { server_id: granted.server_id, user_id: granted.user_id, direction, path, bytes }).catch(() => {});
        }
    };

    const joinPath = (dir, name) => `${dir.replace(/\/+$/, '')}/${name}`;

    const files = async (message) => {
        const rid = message.rid;

        if (message.t === 'end') {
            // The tab was closed for good: the persistent shell goes with it.
            if (tmuxName !== null) {
                ending = run(`tmux kill-session -t ${tmuxName}`).catch(() => {});
                await ending;
            }

            return ws.close();
        }

        if (message.t === 'cap') {
            if (tmuxName === null) {
                return reply({ t: 'fs-error', rid, code: 'unsupported', message: 'This session is not kept on the server.' });
            }

            const result = await run(`tmux capture-pane -p -J -S - -t ${tmuxName}`, 10 * 1024 * 1024);

            return reply({ t: 'cap', rid, text: result.text.replace(/\s+$/, '') });
        }

        if (message.t === 'cancel') {
            return transfers.get(rid)?.abort();
        }

        if (message.t === 'chunk' || message.t === 'done') {
            return transfers.get(rid)?.[message.t](message);
        }

        const client = await sftp();

        if (message.t === 'ls') {
            const dir = await callback((done) => client.realpath(typeof message.path === 'string' && message.path !== '' ? message.path : '.', done));
            const list = await callback((done) => client.readdir(dir, done));
            const entries = [];

            for (const item of list.slice(0, 2000)) {
                let attrs = item.attrs;

                if (attrs.isSymbolicLink()) {
                    attrs = await callback((done) => client.stat(joinPath(dir, item.filename), done)).catch(() => attrs);
                }

                entries.push({ name: item.filename, dir: attrs.isDirectory(), size: attrs.size ?? 0, mtime: attrs.mtime ?? 0 });
            }

            return reply({ t: 'ls', rid, path: dir, entries, truncated: list.length > 2000 });
        }

        if (transfers.size >= maxTransfers) {
            return reply({ t: 'fs-error', rid, code: 'busy', message: 'Too many transfers at once.' });
        }

        if (message.t === 'get') {
            const path = String(message.path || '');
            const stat = await callback((done) => client.stat(path, done));

            if (stat.isDirectory()) {
                return reply({ t: 'fs-error', rid, code: 'directory', message: 'A folder cannot be downloaded.' });
            }

            if (stat.size > maxFileBytes) {
                return reply({ t: 'fs-error', rid, code: 'too-large', message: 'The file is too large.' });
            }

            const stream = client.createReadStream(path, { highWaterMark: chunkBytes });
            const name = path.split('/').pop();
            let sent = 0;
            let timer = null;

            transfers.set(rid, {
                abort: () => {
                    clearTimeout(timer);
                    stream.destroy();
                    transfers.delete(rid);
                },
            });

            stream.on('data', (data) => {
                sent += data.length;
                reply({ t: 'file', rid, name, size: stat.size, data: data.toString('base64') });

                if (ws.bufferedAmount > 1024 * 1024) {
                    stream.pause();

                    const wait = () => {
                        if (ws.readyState !== ws.OPEN) {
                            return;
                        }

                        if (ws.bufferedAmount > 256 * 1024) {
                            timer = setTimeout(wait, 40);
                        } else {
                            stream.resume();
                        }
                    };

                    wait();
                }
            });
            stream.on('end', () => {
                transfers.delete(rid);
                reply({ t: 'file', rid, last: true });
                audit('download', path, sent);
            });
            stream.on('error', (error) => {
                transfers.delete(rid);
                reply({ t: 'fs-error', rid, code: 'failed', message: String(error.message || error) });
            });

            return;
        }

        if (message.t === 'put') {
            const name = String(message.name || '');
            const size = Number(message.size) || 0;

            if (name === '' || name === '.' || name === '..' || name.includes('/') || name.includes('\0') || name.length > 255) {
                return reply({ t: 'fs-error', rid, code: 'name', message: 'The file name is not allowed.' });
            }

            if (size > maxFileBytes) {
                return reply({ t: 'fs-error', rid, code: 'too-large', message: 'The file is too large.' });
            }

            const dir = await callback((done) => client.realpath(typeof message.path === 'string' && message.path !== '' ? message.path : '.', done));
            const target = joinPath(dir, name);
            const existing = await callback((done) => client.stat(target, done)).catch(() => null);

            if (existing !== null && !message.overwrite) {
                return reply({ t: 'fs-error', rid, code: 'exists', message: 'A file with this name already exists.' });
            }

            if (existing !== null && existing.isDirectory()) {
                return reply({ t: 'fs-error', rid, code: 'directory', message: 'A folder with this name exists.' });
            }

            const stream = client.createWriteStream(target, { flags: 'w', mode: 0o644 });
            let written = 0;
            let failed = false;

            const fail = (error) => {
                if (!failed) {
                    failed = true;
                    transfers.delete(rid);
                    reply({ t: 'fs-error', rid, code: 'failed', message: String(error.message || error) });
                }
            };

            stream.on('error', fail);
            transfers.set(rid, {
                abort: () => {
                    failed = true;
                    transfers.delete(rid);
                    stream.destroy();
                },
                chunk: (frame) => {
                    const data = Buffer.from(String(frame.data || ''), 'base64');

                    written += data.length;

                    if (written > maxFileBytes) {
                        return fail(new Error('The file is too large.'));
                    }

                    stream.write(data, () => !failed && reply({ t: 'ack', rid }));
                },
                done: () => {
                    stream.end(() => {
                        if (!failed) {
                            transfers.delete(rid);
                            reply({ t: 'put', rid, state: 'done' });
                            audit('upload', target, written);
                        }
                    });
                },
            });

            return reply({ t: 'put', rid, state: 'ready', path: target });
        }
    };

    const output = (data) => ws.readyState === ws.OPEN && ws.send(data, { binary: true });

    const openViaSsh = (login) => {
        ssh = new Client();

        ssh.on('error', (error) => {
            const text = String(error.level === 'client-authentication'
                ? 'Authentication failed.'
                : error.message || 'The connection failed.');

            fail(text.includes('host key') ? text : `Could not connect: ${text}`);
        });
        ssh.on('close', () => ws.close());

        ssh.on('ready', async () => {
            // A shell that survives a lost connection: tmux, when the server has it and the tab asked for it.
            let persistent = false;

            if (typeof login.session === 'string' && sessionKeyPattern.test(login.session)) {
                persistent = (await run('command -v tmux >/dev/null 2>&1 && echo yes').catch(() => ({ text: '' }))).text.trim() === 'yes';
            }

            if (closed) {
                return;
            }

            const options = { term: 'xterm-256color', cols: size.cols, rows: size.rows };
            const onShell = (error, stream) => {
                if (error) {
                    return fail('The shell could not be opened.');
                }

                shell = {
                    write: (data) => stream.write(data),
                    resize: (cols, rows) => stream.setWindow(rows, cols, 0, 0),
                    end: () => {},
                };
                control({ t: 'status', state: 'ready', persistent, files: true });

                stream.on('data', output);
                stream.stderr.on('data', output);
                stream.on('close', () => ws.close());
            };

            if (persistent) {
                tmuxName = `ra-${login.session}`;
                // No alternate screen, so the output stays in the scrollback of the browser (search, export, mouse wheel).
                const create = `tmux -u start-server \\; set -g history-limit 50000 \\; set -ga terminal-overrides ',*:smcup@:rmcup@' \\; new-session -d -s ${tmuxName} \\; set status off`;

                ssh.exec(`tmux -u has-session -t =${tmuxName} 2>/dev/null || ${create}; exec tmux -u attach-session -t ${tmuxName}`, { pty: options }, onShell);
            } else {
                ssh.shell(options, onShell);
            }
        });

        let presented = null;

        try {
            ssh.connect({
                host: login.host,
                port: login.port,
                username: login.username,
                password: login.password ?? undefined,
                privateKey: login.private_key ?? undefined,
                passphrase: login.passphrase || undefined,
                readyTimeout: 15_000,
                keepaliveInterval: 20_000,
                hostHash: 'sha256',
                hostVerifier: (hash) => {
                    presented = `SHA256:${Buffer.from(hash, 'hex').toString('base64').replace(/=+$/, '')}`;

                    if (login.fingerprint && login.fingerprint !== presented) {
                        fail('The host key of the server has changed. If the server was reinstalled, reset the stored host key; otherwise someone may be impersonating it.');

                        return false;
                    }

                    if (!login.fingerprint) {
                        api('host-key', { server_id: login.server_id, fingerprint: presented }).catch(() => {});
                    }

                    return true;
                },
            });
        } catch {
            fail('The SSH key could not be used.');
        }
    };

    (async () => {
        // The first resize frame carries the real window size, so the shell starts with it.
        const waitForSize = new Promise((resolve) => {
            sizeWaiter = resolve;
            setTimeout(resolve, 1500);
        });

        const exchanged = await api('exchange', { token, ip: ip || null }).catch(() => null);

        if (exchanged === null) {
            return fail('The application is not reachable.');
        }

        if (!exchanged.ok) {
            console.warn(`exchange failed: status=${exchanged.status} token=${token.slice(0, 6)}… length=${token.length} ip=${ip}`);

            return fail(exchanged.data.message || 'The ticket is invalid or expired.');
        }

        const login = exchanged.data;

        await waitForSize;

        if (closed) {
            return;
        }

        granted = { server_id: login.server_id, user_id: login.user_id, since: Date.now() };
        touch();

        openViaSsh(login);
    })();
});

http.listen(port, host, () => {
    console.log(`Terminal bridge listening on ${host}:${port}`);
});
EOF_SERVER

# Inside a container the app has to listen on all interfaces to be reachable from outside.
ENV NODE_ENV=production \
    TERMINAL_HOST=0.0.0.0 \
    TERMINAL_PORT=8787

EXPOSE 8787

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.TERMINAL_PORT||8787)+'/up').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
