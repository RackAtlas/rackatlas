<!DOCTYPE html>
@php($native = \App\Support\NativeApp::isRequest())
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark', 'native-app' => $native])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1{{ $native ? ', maximum-scale=1, viewport-fit=cover' : '' }}">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const read = (key, fallback) => {
                    try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
                };
                const appearance = read('appearance', '{{ $appearance ?? "system" }}');
                const dark = appearance === 'dark'
                    || (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                const themes = dark
                    ? { dark: 1, graphite: 1, midnight: 1, forest: 1 }
                    : { light: 1, sand: 1, mist: 1 };
                const theme = read(dark ? 'theme-night' : 'theme-day', dark ? 'dark' : 'light');
                const root = document.documentElement;

                root.classList.toggle('dark', dark);

                if (themes[theme] && theme !== 'light' && theme !== 'dark') {
                    root.dataset.theme = theme;
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: var(--background, oklch(1 0 0));
            }

            html.dark {
                background-color: var(--background, oklch(0.145 0 0));
            }
        </style>

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link rel="manifest" href="/manifest.webmanifest">
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-title" content="{{ config('app.name', 'RackAtlas') }}">
        <meta name="format-detection" content="telephone=no">

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @php($seo = $page['props']['seo'] ?? null)
        @includeWhen($seo !== null, 'partials.seo', ['seo' => $seo])
        <x-inertia::head>
            <title>{{ $seo['title'] ?? config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
        @if ($seo !== null)
            <noscript>
                <p><strong>{{ $seo['heading'] }}</strong></p>
                <p>{{ $seo['description'] }}</p>
                <ul>
                    @foreach ($seo['links'] as $link)
                        <li><a href="{{ $link['url'] }}">{{ $link['label'] }}</a></li>
                    @endforeach
                </ul>
            </noscript>
        @endif
    </body>
</html>
