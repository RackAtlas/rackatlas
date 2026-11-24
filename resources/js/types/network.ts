import type { MetricsRange } from './metrics';

export type NetworkPoint = {
    t: number;
    samples: number;
    established_avg: number | null;
    established_max: number | null;
    time_wait_avg: number | null;
    time_wait_max: number | null;
    close_wait_max: number | null;
    syn_recv_max: number | null;
    retrans_pct: number | null;
    retrans_pct_max: number | null;
    attempt_fails: number | null;
    estab_resets: number | null;
    active_opens: number | null;
    passive_opens: number | null;
    conntrack_pct: number | null;
};

export type NetworkInterfacePoint = {
    t: number;
    rx_avg: number | null;
    rx_max: number | null;
    tx_avg: number | null;
    tx_max: number | null;
    rx_pps: number | null;
    tx_pps: number | null;
    errors: number | null;
    drops: number | null;
};

export type NetworkTotals = {
    rx_bytes: number;
    tx_bytes: number;
    rx_peak: number;
    tx_peak: number;
    packets: number;
    errors: number;
    drops: number;
};

export type NetworkLink = {
    name: string;
    state: string;
    speed: number | null;
    mtu: number;
};

export type NetworkListener = {
    scope: 'any' | 'bound' | 'loopback';
    port: number;
};

export type NetworkFinding = {
    key:
        | 'retransmits'
        | 'lost_packets'
        | 'link_saturated'
        | 'conntrack_full'
        | 'syn_backlog'
        | 'close_wait';
    level: 'warning' | 'critical';
    context: Record<string, string | number>;
};

export type NetworkCurrent = {
    collected_at: string;
    tcp_established: number | null;
    tcp_syn_recv: number | null;
    tcp_time_wait: number | null;
    tcp_close_wait: number | null;
    tcp_listen: number | null;
    retrans_pct: number | null;
    conntrack_count: number | null;
    conntrack_max: number | null;
    interfaces: {
        name: string;
        rx_bps: number;
        tx_bps: number;
        rx_pps: number;
        tx_pps: number;
        errors: number;
        drops: number;
    }[];
};

export type NetworkReport = {
    range: MetricsRange;
    bucket_seconds: number;
    points: NetworkPoint[];
    interfaces: Record<string, NetworkInterfacePoint[]>;
    totals: Record<string, NetworkTotals>;
    current: NetworkCurrent | null;
    links: NetworkLink[];
    listen: NetworkListener[];
    findings: NetworkFinding[];
    has_data: boolean;
    generated_at: string;
};

export type NetworkServer = {
    id: number;
    name: string;
    status: string;
    agent_version: string | null;
    last_seen_at: string | null;
};
