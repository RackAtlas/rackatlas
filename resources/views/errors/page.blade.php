<!DOCTYPE html>
{{--
    The one layout of all error pages (404, 403, 503, ...). It is self-contained on purpose: no Vite, no
    session, no database. During a deploy the build files are being replaced and the app is "down", yet this
    page has to render. It follows the colours of the public home page.

    Sections: code, title, message, tone (ok|warn|bad), actions (optional), refresh (optional, seconds).
--}}
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex">
        <meta name="color-scheme" content="light dark">
        @hasSection('refresh')
            <meta http-equiv="refresh" content="@yield('refresh')">
        @endif
        <title>@yield('title') · RackAtlas</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">

        <script>
            (function () {
                try {
                    var choice = localStorage.getItem('appearance');
                    if (choice === 'dark' || choice === 'light') {
                        document.documentElement.classList.add(choice);
                    }
                } catch (e) {}
            })();
        </script>

        <style>
            :root {
                --bg: #fbfbfa; --card: #ffffff; --soft: #f4f5f3; --ink: #0e1110; --body: #4b5451;
                --muted: #6f7873; --border: #e4e6e3; --accent: #0b7a55; --ok: #2fbf7f; --warn: #e39a12; --bad: #dc4a3d;
            }
            @media (prefers-color-scheme: dark) {
                :root:not(.light) {
                    --bg: #0a0d0c; --card: #111513; --soft: #171c1a; --ink: #f1f4f2; --body: #a7b1ac;
                    --muted: #8a948f; --border: #232a27; --accent: #34d399; --ok: #34d399; --warn: #f0b429; --bad: #f2695d;
                }
            }
            :root.dark {
                --bg: #0a0d0c; --card: #111513; --soft: #171c1a; --ink: #f1f4f2; --body: #a7b1ac;
                --muted: #8a948f; --border: #232a27; --accent: #34d399; --ok: #34d399; --warn: #f0b429; --bad: #f2695d;
            }

            * { box-sizing: border-box; }
            html { background: var(--bg); }
            body {
                margin: 0; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column;
                align-items: center; justify-content: center; gap: 28px; padding: 24px;
                font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 17px; line-height: 1.55; color: var(--ink); background: var(--bg);
                -webkit-font-smoothing: antialiased;
            }
            a { color: inherit; }

            .brand { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; text-decoration: none; }
            .brand svg { width: 30px; height: 30px; }

            .card {
                width: 100%; max-width: 520px; padding: 40px 32px 36px; text-align: center;
                background: var(--card); border: 1px solid var(--border); border-radius: 28px;
                box-shadow: 0 24px 48px -32px rgba(15, 25, 20, 0.35);
            }

            .rack { width: 168px; margin: 0 auto 26px; padding: 10px; display: grid; gap: 7px; background: var(--soft); border: 1px solid var(--border); border-radius: 14px; }
            .unit { height: 22px; display: flex; align-items: center; justify-content: space-between; padding: 0 9px; background: var(--card); border: 1px solid var(--border); border-radius: 6px; }
            .unit i { display: block; width: 46px; height: 4px; border-radius: 2px; background: var(--border); }
            .unit b { display: block; width: 7px; height: 7px; border-radius: 50%; background: var(--ok); }
            .tone-warn .unit.hot b { background: var(--warn); }
            .tone-bad .unit.hot b { background: var(--bad); }
            .tone-warn .unit.hot, .tone-bad .unit.hot { border-color: currentColor; }
            .tone-warn .unit.hot { color: color-mix(in srgb, var(--warn) 55%, var(--border)); }
            .tone-bad .unit.hot { color: color-mix(in srgb, var(--bad) 55%, var(--border)); }

            .eyebrow { margin: 0 0 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }
            h1 { margin: 0 0 12px; font-size: clamp(1.7rem, 5vw, 2.2rem); line-height: 1.1; font-weight: 600; letter-spacing: -0.035em; }
            p.message { margin: 0 auto; max-width: 380px; color: var(--body); }

            .actions { margin-top: 28px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
            .btn {
                display: inline-flex; align-items: center; justify-content: center; padding: 12px 24px; border-radius: 999px;
                font: inherit; font-size: 15px; font-weight: 500; text-decoration: none; cursor: pointer;
                border: 1px solid var(--border); background: var(--card); color: var(--ink); transition: transform .15s;
            }
            .btn:hover { transform: translateY(-1px); }
            .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
            @media (prefers-color-scheme: dark) { :root:not(.light) .btn.primary { color: #04130c; } }
            :root.dark .btn.primary { color: #04130c; }

            .bar { height: 5px; margin: 26px auto 0; max-width: 220px; overflow: hidden; border-radius: 999px; background: var(--border); }
            .bar span { display: block; height: 100%; width: 40%; border-radius: inherit; background: var(--accent); animation: slide 1.6s ease-in-out infinite; }
            @keyframes slide { 0% { transform: translateX(-110%); } 100% { transform: translateX(280%); } }
            @keyframes blink { 50% { opacity: .25; } }
            .tone-warn .unit.hot b, .tone-bad .unit.hot b { animation: blink 1.4s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) { .bar span, .unit b { animation: none !important; } }

            .foot { font-size: 13px; color: var(--muted); }
        </style>
    </head>
    <body>
        <a class="brand" href="/">
            <svg viewBox="0 0 32 32" aria-hidden="true">
                <rect width="32" height="32" rx="8" fill="var(--accent)"/>
                <g fill="#fff">
                    <rect x="6" y="7" width="20" height="4.5" rx="1.25"/>
                    <rect x="6" y="13.75" width="20" height="4.5" rx="1.25" opacity=".8"/>
                    <rect x="6" y="20.5" width="20" height="4.5" rx="1.25" opacity=".6"/>
                </g>
            </svg>
            RackAtlas
        </a>

        <main class="card tone-@yield('tone', 'warn')">
            <div class="rack" aria-hidden="true">
                <div class="unit"><i></i><b></b></div>
                <div class="unit hot"><i></i><b></b></div>
                <div class="unit"><i></i><b></b></div>
            </div>

            <p class="eyebrow">@yield('eyebrow', __('Error').' '.trim($__env->yieldContent('code')))</p>
            <h1>@yield('title')</h1>
            <p class="message">@yield('message')</p>

            @hasSection('refresh')
                <div class="bar" aria-hidden="true"><span></span></div>
            @endif

            <div class="actions">
                @hasSection('actions')
                    @yield('actions')
                @else
                    <a class="btn primary" href="/">{{ __('Back to home') }}</a>
                @endif
            </div>
        </main>

        <p class="foot">@yield('foot', __('Server monitoring'))</p>
    </body>
</html>
