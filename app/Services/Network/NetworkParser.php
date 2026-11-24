<?php

namespace App\Services\Network;

/**
 * Reads the NETDETAIL section of the agent (see netdetail_section in agent/package/usr/bin/rackatlas-agent).
 * Every line is optional and a line that does not look right is skipped, because old and new agents
 * must both be accepted and the section comes from a machine we do not control.
 */
class NetworkParser
{
    private const MAX_INTERFACES = 16;

    private const MAX_PORTS = 100;

    /** The agent reports the time between two runs. Longer than this is not an average of anything useful. */
    private const MAX_INTERVAL_SECONDS = 3600;

    /**
     * Null when the agent sent no network detail (old agent, server monitored over SSH).
     *
     * @return array{sample: array<string, int|float|null>, interfaces: array<int, array<string, int|float|string>>, info: array{links: array<int, array{name: string, state: string, speed: int|null, mtu: int}>, listen: array<int, array{scope: string, port: int}>}}|null
     */
    public function parse(?string $section): ?array
    {
        if ($section === null || trim($section) === '') {
            return null;
        }

        $sample = [
            'tcp_established' => null, 'tcp_syn_recv' => null, 'tcp_time_wait' => null, 'tcp_close_wait' => null, 'tcp_listen' => null,
            'tcp_in_segs' => null, 'tcp_out_segs' => null, 'tcp_retrans_segs' => null, 'tcp_in_errs' => null,
            'tcp_attempt_fails' => null, 'tcp_estab_resets' => null, 'tcp_active_opens' => null, 'tcp_passive_opens' => null,
            'conntrack_count' => null, 'conntrack_max' => null,
        ];
        $interfaces = [];
        $links = [];
        $listen = [];

        foreach (explode("\n", $section) as $line) {
            $parts = preg_split('/\s+/', trim($line));
            $kind = array_shift($parts);

            switch ($kind) {
                case 'link':
                    if (count($parts) === 4 && $this->validName($parts[0]) && count($links) < self::MAX_INTERFACES) {
                        $links[] = [
                            'name' => $parts[0],
                            'state' => preg_match('/^[a-z]{2,16}$/', $parts[1]) === 1 ? $parts[1] : 'unknown',
                            'speed' => ctype_digit($parts[2]) && (int) $parts[2] > 0 ? (int) $parts[2] : null,
                            'mtu' => ctype_digit($parts[3]) ? (int) $parts[3] : 0,
                        ];
                    }
                    break;

                case 'rate':
                    $numbers = array_slice($parts, 1);

                    if (count($parts) === 10 && $this->validName($parts[0]) && $this->allDigits($numbers) && count($interfaces) < self::MAX_INTERFACES) {
                        $seconds = (int) $numbers[0];

                        if ($seconds < 1 || $seconds > self::MAX_INTERVAL_SECONDS) {
                            break;
                        }

                        [, $rxBytes, $txBytes, $rxPackets, $txPackets, $rxErrors, $txErrors, $rxDrops, $txDrops] = array_map('intval', $numbers);

                        $interfaces[] = [
                            'name' => $parts[0],
                            'rx_bps' => intdiv($rxBytes, $seconds),
                            'tx_bps' => intdiv($txBytes, $seconds),
                            'rx_pps' => intdiv($rxPackets, $seconds),
                            'tx_pps' => intdiv($txPackets, $seconds),
                            'errors' => round(($rxErrors + $txErrors) / $seconds, 4),
                            'drops' => round(($rxDrops + $txDrops) / $seconds, 4),
                        ];
                    }
                    break;

                case 'tcp':
                    if (count($parts) === 9 && $this->allDigits($parts) && (int) $parts[0] >= 1 && (int) $parts[0] <= self::MAX_INTERVAL_SECONDS) {
                        $seconds = (int) $parts[0];
                        $perSecond = fn (string $value): float => round((int) $value / $seconds, 4);

                        $sample['tcp_active_opens'] = $perSecond($parts[1]);
                        $sample['tcp_passive_opens'] = $perSecond($parts[2]);
                        $sample['tcp_attempt_fails'] = $perSecond($parts[3]);
                        $sample['tcp_estab_resets'] = $perSecond($parts[4]);
                        $sample['tcp_in_segs'] = $perSecond($parts[5]);
                        $sample['tcp_out_segs'] = $perSecond($parts[6]);
                        $sample['tcp_retrans_segs'] = $perSecond($parts[7]);
                        $sample['tcp_in_errs'] = $perSecond($parts[8]);
                    }
                    break;

                case 'tcpstate':
                    if (count($parts) === 5 && $this->allDigits($parts)) {
                        [$sample['tcp_established'], $sample['tcp_syn_recv'], $sample['tcp_time_wait'], $sample['tcp_close_wait'], $sample['tcp_listen']] = array_map('intval', $parts);
                    }
                    break;

                case 'conntrack':
                    if (count($parts) === 2 && $this->allDigits($parts) && (int) $parts[1] > 0) {
                        $sample['conntrack_count'] = min((int) $parts[0], 4294967295);
                        $sample['conntrack_max'] = min((int) $parts[1], 4294967295);
                    }
                    break;

                case 'listen':
                    if (count($parts) === 3 && $parts[0] === 'tcp' && in_array($parts[1], ['any', 'bound', 'loopback'], true)
                        && ctype_digit($parts[2]) && (int) $parts[2] >= 1 && (int) $parts[2] <= 65535 && count($listen) < self::MAX_PORTS) {
                        $listen[] = ['scope' => $parts[1], 'port' => (int) $parts[2]];
                    }
                    break;
            }
        }

        if ($links === [] && $interfaces === [] && $listen === [] && $sample['tcp_established'] === null) {
            return null;
        }

        return [
            'sample' => $sample,
            'interfaces' => $interfaces,
            'info' => ['links' => $links, 'listen' => $listen],
        ];
    }

    private function validName(string $name): bool
    {
        return preg_match('/^[A-Za-z0-9_.:@-]{1,32}$/', $name) === 1;
    }

    /**
     * @param  array<int, string>  $values
     */
    private function allDigits(array $values): bool
    {
        foreach ($values as $value) {
            if (! ctype_digit($value) || strlen($value) > 18) {
                return false;
            }
        }

        return true;
    }
}
