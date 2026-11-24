import type { NetworkFinding } from '@/types';

type Translate = (
    key?: string,
    replacements?: Record<string, string | number>,
) => string;

/** Services that should not be open to the whole network. A firewall may still block them. */
export const SENSITIVE_PORTS: Record<number, string> = {
    2375: 'Docker API',
    3306: 'MySQL',
    5432: 'PostgreSQL',
    6379: 'Redis',
    9200: 'Elasticsearch',
    11211: 'Memcached',
    27017: 'MongoDB',
};

/** The sentence that explains a finding of the network report. */
export function findingText(
    finding: NetworkFinding,
    t: Translate,
    locale: string,
): string {
    const c = finding.context;

    switch (finding.key) {
        case 'retransmits':
            return t(
                ':percent % of the sent TCP segments had to be sent again. The connection is lossy or overloaded.',
                { percent: c.percent },
            );
        case 'lost_packets':
            return t(
                ':count packets were dropped or damaged on the network cards in this period.',
                { count: Number(c.count).toLocaleString(locale) },
            );
        case 'link_saturated':
            return t(
                'The interface :interface reached :percent % of its link speed. Traffic may be queued or dropped.',
                { interface: c.interface, percent: c.percent },
            );
        case 'conntrack_full':
            return t(
                'The connection tracking table of the firewall is :percent % full. When it is full, new connections are dropped.',
                { percent: c.percent },
            );
        case 'syn_backlog':
            return t(
                'Up to :count half-open connections (SYN_RECV). A flood of connection attempts or an application that accepts too slowly.',
                { count: c.count },
            );
        case 'close_wait':
            return t(
                ':count connections wait in CLOSE_WAIT. An application does not close its sockets (a leak).',
                { count: c.count },
            );
    }
}
