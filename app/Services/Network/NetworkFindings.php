<?php

namespace App\Services\Network;

/**
 * Turns the numbers of one server into the list of things that look wrong. Shared by the page of
 * one server and the overview of all servers, so both always agree. A finding is only raised when
 * the numbers back it up, so an empty list means the network is healthy as far as the agent can tell.
 */
class NetworkFindings
{
    /** Services that should not be open to the whole network. A firewall may still block them. */
    public const SENSITIVE_PORTS = [
        2375 => 'Docker API',
        3306 => 'MySQL',
        5432 => 'PostgreSQL',
        6379 => 'Redis',
        9200 => 'Elasticsearch',
        11211 => 'Memcached',
        27017 => 'MongoDB',
    ];

    /**
     * @param  array<string, array<string, int>>  $totals  Per interface, see NetworkReport::totals().
     * @param  array<int, array{name: string, speed: int|null}>  $links
     * @return array<int, array{key: string, level: string, context: array<string, string|int|float>}>
     */
    public static function evaluate(?float $retransmitPercent, array $totals, array $links, float $conntrackPercent, int $synRecvMax, int $closeWait): array
    {
        $findings = [];

        if ($retransmitPercent !== null && $retransmitPercent >= 1) {
            $findings[] = ['key' => 'retransmits', 'level' => $retransmitPercent >= 3 ? 'critical' : 'warning', 'context' => ['percent' => round($retransmitPercent, 2)]];
        }

        $lost = array_sum(array_column($totals, 'errors')) + array_sum(array_column($totals, 'drops'));
        $packets = array_sum(array_column($totals, 'packets'));

        if ($lost > 0) {
            $findings[] = [
                'key' => 'lost_packets',
                'level' => $packets > 0 && $lost / $packets >= 0.01 ? 'critical' : 'warning',
                'context' => ['count' => $lost],
            ];
        }

        foreach ($links as $link) {
            $total = $totals[$link['name']] ?? null;

            if ($total === null || ($link['speed'] ?? null) === null) {
                continue;
            }

            $used = max($total['rx_peak'], $total['tx_peak']) * 8 / ($link['speed'] * 1_000_000) * 100;

            if ($used >= 80) {
                $findings[] = ['key' => 'link_saturated', 'level' => $used >= 95 ? 'critical' : 'warning', 'context' => ['interface' => $link['name'], 'percent' => round($used)]];
            }
        }

        if ($conntrackPercent >= 80) {
            $findings[] = ['key' => 'conntrack_full', 'level' => $conntrackPercent >= 95 ? 'critical' : 'warning', 'context' => ['percent' => round($conntrackPercent)]];
        }

        if ($synRecvMax >= 200) {
            $findings[] = ['key' => 'syn_backlog', 'level' => 'warning', 'context' => ['count' => $synRecvMax]];
        }

        if ($closeWait >= 100) {
            $findings[] = ['key' => 'close_wait', 'level' => 'warning', 'context' => ['count' => $closeWait]];
        }

        return $findings;
    }

    /**
     * Sensitive services that listen on every address of the server.
     *
     * @param  array<int, array{scope: string, port: int}>  $listen
     * @return array<int, array{port: int, service: string}>
     */
    public static function exposed(array $listen): array
    {
        $exposed = [];

        foreach ($listen as $listener) {
            if ($listener['scope'] === 'any' && isset(self::SENSITIVE_PORTS[$listener['port']])) {
                $exposed[] = ['port' => $listener['port'], 'service' => self::SENSITIVE_PORTS[$listener['port']]];
            }
        }

        return $exposed;
    }
}
