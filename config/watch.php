<?php

return [

    /*
    | Continuous watching: servers with "watch_enabled" are compared with their own normal behaviour as
    | soon as data arrives, and `php artisan watch:run` keeps judging them around the clock.
    */

    // Seconds between two rounds of the watcher process (`php artisan watch:run`).
    'interval' => (int) env('WATCH_INTERVAL', 15),

    // The watcher exits after this many MB of memory so its supervisor (systemd) restarts it clean.
    'memory_limit_mb' => (int) env('WATCH_MEMORY_LIMIT_MB', 256),

    'baseline' => [
        // The normal behaviour is learned from this many hours before the newest samples.
        'hours' => (int) env('WATCH_BASELINE_HOURS', 24),
        // Fewer samples than this and there is no baseline yet (one sample a minute).
        'min_samples' => (int) env('WATCH_BASELINE_MIN_SAMPLES', 120),
        // The newest samples that must all be unusual before an anomaly is raised.
        'confirm_samples' => 3,
        // An anomaly that was closed does not open again for this many minutes.
        'cooldown_minutes' => (int) env('WATCH_COOLDOWN_MINUTES', 30),
        // Robust z-score (distance from the median in MAD units) that counts as unusual.
        'z_limit' => (float) env('WATCH_Z_LIMIT', 5),
        // Disk forecast: warn when a disk is predicted to be full within this many days.
        'disk_days' => (int) env('WATCH_DISK_DAYS', 3),
    ],

    // A local language model that explains an anomaly in a few sentences. It never decides anything.
    'llm' => [
        'enabled' => (bool) env('WATCH_LLM_ENABLED', false),
        'url' => env('WATCH_LLM_URL', 'http://127.0.0.1:11434'),
        'model' => env('WATCH_LLM_MODEL', 'qwen3:8b'),
        'timeout' => (int) env('WATCH_LLM_TIMEOUT', 240),
        'keep_alive' => env('WATCH_LLM_KEEP_ALIVE', '30m'),
        // Also look at every new error and critical log entry of a watched server.
        'logs' => (bool) env('WATCH_LLM_LOGS', true),
        'language' => env('WATCH_LLM_LANGUAGE', 'Slovak'),
        'queue' => env('WATCH_LLM_QUEUE', 'llm'),
    ],

];
