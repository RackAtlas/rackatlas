/**
 * Web terminal bridge: WebSocket on one side (the browser), a shell on the other.
 *
 * The browser sends a one-time ticket issued by the Laravel app. This process swaps it for the way
 * to reach the server over the app's private API, so credentials never reach the browser. There are
 * two ways to reach a server:
 *
 *  - ssh:   this process logs in over SSH (the app returns the login details).
 *  - agent: the terminal service on the server keeps a WebSocket open to /agent, so no port has to
 *           be open on the server. The shell runs there, this process only relays the bytes.
 *
 * Frames from the browser: {"t":"i","d":"<keystrokes>"} (ssh only) and {"t":"r","c":cols,"r":rows}.
 * Via the agent the terminal is end-to-end encrypted: the browser sends {"t":"k","pub":"<key>"} and
 * then binary frames of ciphertext. This process cannot read them, it only relays them.
 * Frames to the browser: binary shell output (ciphertext via the agent), and
 * {"t":"status"|"error"|"key",...} control messages.
 *
 * Only for ssh servers (the bridge holds the SSH connection, so it can do more than relay a shell):
 *  - Persistent shells: when the ticket carries a session key and tmux exists on the server, the shell is
 *    `tmux new-session -A -s ra-<key>`, so a reconnect finds the same shell. {"t":"end"} ends it for good.
 *    {"t":"cap","rid":1} answers with the whole scrollback as {"t":"cap","rid":1,"text":".."}.
 *  - Files over SFTP, all JSON with a request id `rid`: {"t":"ls","rid","path"} -> {"t":"ls","rid","path","entries"};
 *    {"t":"get","rid","path"} -> {"t":"file","rid","name","size","data"(base64)} ... {"t":"file","rid","last":true};
 *    {"t":"put","rid","path"(dir),"name","size","overwrite"} -> {"t":"put","rid","state":"ready"}, then
 *    {"t":"chunk","rid","data"} (each answered with {"t":"ack","rid"}) and {"t":"done","rid"} -> {"t":"put","rid","state":"done"};
 *    {"t":"cancel","rid"}. Failures are {"t":"fs-error","rid","code","message"}.
 *
 * Files via the agent are end-to-end encrypted like the shell, on a second channel: the browser sends the text frame
 * {"t":"f"} and right after it one binary frame with the ciphertext of one JSON file frame (the same frames as above,
 * plus {"t":"more","rid"} that lets the next chunk of a download out). The answers come back the same way. This process
 * does not read them: toward the service it adds the session id with the top bit set (id | 0x80000000).
 *
 * Frames to the terminal service (many shells share one connection, a session id tells them apart):
 *   text:   {"t":"open","id":1,"cols":80,"rows":24} {"t":"key","id":1,"pub":".."}
 *           {"t":"r","id":1,"c":..,"r":..} {"t":"close","id":1}
 *   binary: 4 bytes session id (big endian) + encrypted keystrokes
 * Frames from the terminal service:
 *   text:   {"t":"ready"|"exit","id":1} {"t":"error","id":1,"message":"..."}
 *           {"t":"ready","id":1,"files":true} when the service can move files
 *           {"t":"file","id":1,"direction":"upload|download","path":"..","bytes":N} after a transfer (for the activity log)
 *           {"t":"key","id":1,"pub":"..","ident":"..","sig":".."}
 *   binary: 4 bytes session id + encrypted shell output
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
const maxPerAgent = Number(process.env.TERMINAL_MAX_PER_SERVER || 5);
const maxFileBytes = Number(process.env.TERMINAL_MAX_FILE_MB || 100) * 1024 * 1024;
const maxTransfers = 3;
const chunkBytes = 96 * 1024;
const FILE_FRAMES = new Set(['ls', 'get', 'put', 'chunk', 'done', 'cancel', 'cap', 'end']);
const fileFlag = 0x80000000;
const sessionKeyPattern = /^[A-Za-z0-9]{16,32}$/;
const allowedOrigin = process.env.TERMINAL_ALLOWED_ORIGIN || (appUrl ? new URL(appUrl).origin : '');

if (!appUrl || !secret) {
    console.error('TERMINAL_SECRET and APP_URL (or TERMINAL_APP_URL) have to be set.');
    process.exit(1);
}

let sessions = 0;

/** Terminal services that are connected right now: server id -> { ws, shells: Map(id -> handlers), next }. */
const agents = new Map();

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
const agentWss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

http.on('upgrade', (request, socket, head) => {
    const path = new URL(request.url, 'http://localhost').pathname;

    if (path === '/agent') {
        // Not a browser, so there is no origin to check. The token is checked after the upgrade.
        agentWss.handleUpgrade(request, socket, head, (ws) => agentWss.emit('connection', ws, request));

        return;
    }

    if (allowedOrigin !== '' && request.headers.origin !== allowedOrigin) {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        socket.destroy();

        return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
});

const frame = (id, data) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(id);

    return Buffer.concat([head, Buffer.isBuffer(data) ? data : Buffer.from(data)]);
};

agentWss.on('connection', (ws, request) => {
    const header = String(request.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    let entry = null;
    let alive = true;
    let gone = false;

    ws.on('pong', () => {
        alive = true;
    });

    const drop = () => {
        gone = true;

        if (entry === null) {
            return;
        }

        if (agents.get(entry.serverId) === entry) {
            agents.delete(entry.serverId);
        }

        for (const shell of entry.shells.values()) {
            shell.onError('The terminal service on the server disconnected.');
        }

        entry.shells.clear();
    };

    ws.on('close', drop);
    ws.on('error', drop);

    ws.on('message', (raw, isBinary) => {
        if (entry === null) {
            return;
        }

        if (isBinary) {
            if (raw.length > 4) {
                const id = raw.readUInt32BE(0);

                if (id >= fileFlag) {
                    entry.shells.get(id - fileFlag)?.onFile?.(raw.subarray(4));
                } else {
                    entry.shells.get(id)?.onData(raw.subarray(4));
                }
            }

            return;
        }

        let message;

        try {
            message = JSON.parse(raw.toString());
        } catch {
            return;
        }

        const shell = entry.shells.get(message.id);

        if (message.t === 'ready') {
            shell?.onReady(message);
        } else if (message.t === 'file') {
            shell?.onAudit?.(message);
        } else if (message.t === 'key') {
            shell?.onKey?.(message);
        } else if (message.t === 'exit') {
            shell?.onExit();
        } else if (message.t === 'error') {
            shell?.onError(String(message.message || 'The shell could not be opened.'));
        }
    });

    (async () => {
        const auth = await api('agent-auth', { token }).catch(() => null);

        if (gone) {
            return;
        }

        if (auth === null || !auth.ok) {
            ws.close(1008, 'unauthorized');

            return;
        }

        const serverId = auth.data.server_id;

        // A service that reconnects replaces its previous, probably dead, connection.
        agents.get(serverId)?.ws.close(1000, 'replaced');

        entry = { serverId, ws, shells: new Map(), next: 1 };
        agents.set(serverId, entry);
        ws.send(JSON.stringify({ t: 'hello' }));
    })();

    ws.heartbeat = () => {
        if (!alive) {
            ws.terminate();

            return;
        }

        alive = false;
        ws.ping();
    };
});

setInterval(() => agentWss.clients.forEach((ws) => ws.heartbeat?.()), 30_000).unref();

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
    let fileNext = false;
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
                via: granted.mode,
                seconds: Math.round((Date.now() - granted.since) / 1000),
            }).catch(() => {});
        }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);

    ws.on('message', (raw, isBinary) => {
        if (isBinary) {
            // Ciphertext for the shell on the server (or, after {"t":"f"}, for its file channel).
            // Only shells that are end-to-end encrypted take it.
            const forFiles = fileNext;

            fileNext = false;

            if (shell?.secure) {
                touch();

                if (forFiles) {
                    shell.file?.(raw);
                } else {
                    shell.write(raw);
                }
            }

            return;
        }

        let message;

        try {
            message = JSON.parse(raw.toString());
        } catch {
            return;
        }

        if (message.t === 'f') {
            fileNext = shell?.secure === true && typeof shell.file === 'function';
        } else if (message.t === 'k') {
            if (shell?.secure && typeof message.pub === 'string' && message.pub.length <= 200) {
                shell.key(message.pub);
            }
        } else if (message.t === 'r') {
            const cols = Math.min(Math.max(Number(message.c) || 80, 10), 500);
            const rows = Math.min(Math.max(Number(message.r) || 24, 2), 200);

            size = { cols, rows };
            shell?.resize(cols, rows);

            if (!sized) {
                sized = true;
                sizeWaiter?.();
            }
        } else if (message.t === 'i' && shell && !shell.secure && typeof message.d === 'string') {
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

    /** The shell runs on the server, behind the terminal service that is connected to /agent. */
    const openViaAgent = (login) => {
        const entry = agents.get(login.server_id);

        if (!entry || entry.ws.readyState !== entry.ws.OPEN) {
            return fail('The terminal service on this server is not connected. Check that rackatlas-terminal is running there.');
        }

        if (entry.shells.size >= maxPerAgent) {
            return fail('Too many terminals are open on this server.');
        }

        const id = entry.next++;
        const startTimeout = setTimeout(() => fail('The server did not open the shell in time.'), 15_000);

        entry.shells.set(id, {
            onData: output,
            onReady: (message) => {
                clearTimeout(startTimeout);
                control({ t: 'status', state: 'ready', files: message?.files === true });
            },
            // Ciphertext of the file channel: told apart from keystrokes by the text frame {"t":"f"} before it.
            onFile: (data) => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ t: 'f' }));
                    ws.send(data, { binary: true });
                }
            },
            onAudit: (message) => {
                const direction = message.direction === 'upload' ? 'upload' : 'download';

                audit(direction, String(message.path || '').slice(0, 1000), Math.max(0, Number(message.bytes) || 0));
            },
            onKey: (message) => {
                const text = (value) => (typeof value === 'string' && value.length <= 400 ? value : '');

                control({ t: 'key', pub: text(message.pub), ident: text(message.ident), sig: text(message.sig) });
            },
            onExit: () => ws.close(),
            onError: (message) => {
                clearTimeout(startTimeout);
                fail(message);
            },
        });

        shell = {
            secure: true,
            key: (pub) => entry.ws.readyState === entry.ws.OPEN && entry.ws.send(JSON.stringify({ t: 'key', id, pub })),
            write: (data) => entry.ws.readyState === entry.ws.OPEN && entry.ws.send(frame(id, data), { binary: true }),
            file: (data) => entry.ws.readyState === entry.ws.OPEN && entry.ws.send(frame(id + fileFlag, data), { binary: true }),
            resize: (cols, rows) => entry.ws.readyState === entry.ws.OPEN && entry.ws.send(JSON.stringify({ t: 'r', id, c: cols, r: rows })),
            end: () => {
                clearTimeout(startTimeout);

                if (entry.shells.delete(id) && entry.ws.readyState === entry.ws.OPEN) {
                    entry.ws.send(JSON.stringify({ t: 'close', id }));
                }
            },
        };

        entry.ws.send(JSON.stringify({ t: 'open', id, cols: size.cols, rows: size.rows }));
    };

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

        granted = { server_id: login.server_id, user_id: login.user_id, mode: login.mode === 'agent' ? 'agent' : 'ssh', since: Date.now() };
        touch();

        if (login.mode === 'agent') {
            openViaAgent(login);
        } else {
            openViaSsh(login);
        }
    })();
});

http.listen(port, host, () => {
    console.log(`Terminal bridge listening on ${host}:${port}`);
});
