# Nonstop dohľad nad servermi (lokálne, bez cloudu)

Server zapnete v appke: **Servery → upraviť server → „Sledovať nonstop“**.

## Ako to funguje

| Vrstva | Čo robí | Kedy beží |
| --- | --- | --- |
| Pravidlá (existujúce) | prahy CPU/RAM/disk, spadnuté služby, offline, DB, Redis | pri každom reporte agenta + každú minútu |
| Odchýlky od normálu | porovná server s jeho vlastným posledným dňom (medián + MAD). Zachytí skok CPU, RAM, loadu, siete, ktorý nie je pre tento server bežný. Predpovedá aj plnenie disku („zaplní sa o 2 dni“) | pri každom reporte + každých 15 s vo `watch:run` |
| Lokálny model | krátke vysvetlenie incidentu (čo sa asi deje, čo skontrolovať). **Nerozhoduje** o alerte, len ho dopĺňa | po otvorení alertu, vo vlastnej fronte `llm` |

Všetko beží u vás. Model komunikuje len s vašou Ollamou.

Vysvetlenie sa zobrazí na stránke servera v „Recent problems“. Notifikácia o alerte príde hneď, bez čakania na model.

## 1. Model (Ollama, bez GPU)

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Ollama sa nainštaluje ako služba `ollama` na `127.0.0.1:11434`. Pre CPU-only server (EPYC) odporúčam obmedziť súbežnosť, aby model nezabral stroj:

```bash
sudo systemctl edit ollama
```

```ini
[Service]
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_KEEP_ALIVE=30m"
# nech model nezoberie celý stroj (napr. 8 jadier z viacerých):
CPUQuota=800%
Nice=10
```

```bash
sudo systemctl restart ollama
```

Výber modelu (kvantizácia Q4, orientačne):

| Model | RAM | Rýchlosť na EPYC |
| --- | --- | --- |
| `qwen3:4b` | ~3 GB | rýchly, na stručné vysvetlenia stačí |
| `qwen3:8b` (predvolený) | ~6 GB | dobrý pomer kvalita/rýchlosť |
| `qwen3:30b-a3b` | ~19 GB | najlepšia kvalita, na CPU stále použiteľný (MoE, aktívne ~3B) |

Stiahnutie a skúška z appky:

```bash
php artisan watch:model --pull
php artisan watch:model --ask="Čo je load average?"
```

## 2. Nastavenie `.env`

```dotenv
WATCH_LLM_ENABLED=true
WATCH_LLM_URL=http://127.0.0.1:11434
WATCH_LLM_MODEL=qwen3:8b
WATCH_LLM_LANGUAGE=Slovak
```

Ak je Ollama na inom stroji, dajte jeho adresu do `WATCH_LLM_URL` (a nevystavujte port 11434 do internetu).

## 3. Watcher a fronta pre model (systemd)

`/etc/systemd/system/rackatlas-watch.service`:

```ini
[Unit]
Description=RackAtlas watcher (nonstop dohľad)
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/rackatlas
ExecStart=/usr/bin/php artisan watch:run
Restart=always
RestartSec=3
Nice=5

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/rackatlas-llm-queue.service` (jeden worker, aby sa vysvetlenia radili za sebou):

```ini
[Unit]
Description=RackAtlas queue worker pre lokálny model
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/rackatlas
ExecStart=/usr/bin/php artisan queue:work --queue=llm --sleep=3 --tries=1 --timeout=300 --max-time=3600
Restart=always
RestartSec=3
Nice=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rackatlas-watch rackatlas-llm-queue
```

Existujúci worker (`queue:work` bez `--queue`) spracúva len frontu `default`, takže na `llm` nesiaha. Po nasadení novej verzie reštartujte oba procesy: `sudo systemctl restart rackatlas-watch rackatlas-llm-queue`.

Watcher sa po zaplnení pamäte (`WATCH_MEMORY_LIMIT_MB`, predvolene 256) sám ukončí a systemd ho spustí čistý. Ak by spadol úplne, každú minútu stále beží `servers:evaluate-alerts` (scheduler), ktorý tiež vyhodnocuje sledované servery.

## 4. Kontrola, že to žije

```bash
php artisan watch:run --once        # jedno kolo, vypíše počet sledovaných serverov
systemctl status rackatlas-watch
journalctl -u rackatlas-watch -f
php artisan tinker --execute 'echo Cache::get("watch:heartbeat");'   # čas posledného kola
```

## Ladenie citlivosti (`.env`)

| Premenná | Predvolené | Význam |
| --- | --- | --- |
| `WATCH_Z_LIMIT` | 5 | čím vyššie, tým menej odchýlok |
| `WATCH_BASELINE_HOURS` | 24 | z koľkých hodín sa učí „normál“ |
| `WATCH_BASELINE_MIN_SAMPLES` | 120 | server sa najprv ~2 hodiny učí, potom sa začne posudzovať |
| `WATCH_DISK_DAYS` | 3 | upozorniť, ak sa disk zaplní do toľkých dní |
| `WATCH_INTERVAL` | 15 | sekundy medzi kolami watchera |

Odchýlka sa hlási len ak ju potvrdia 3 vzorky po sebe a zmena je aj v absolútnom čísle výrazná (napr. CPU aspoň o 20 bodov), takže bežné kolísanie alerty nespúšťa.
