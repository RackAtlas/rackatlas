type Translate = (key: string, replacements?: Record<string, string | number>) => string;

export const SCHEDULE_PRESETS: { label: string; value: string }[] = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Every 15 minutes', value: '*/15 * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every day at 3:00', value: '0 3 * * *' },
    { label: 'Every Monday at 4:00', value: '0 4 * * 1' },
    { label: 'First day of the month', value: '0 5 1 * *' },
    { label: 'After a restart', value: '@reboot' },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (value: string) => value.padStart(2, '0');

/**
 * A short human description of a cron schedule for the common shapes; anything else stays as it is.
 */
export function describeSchedule(schedule: string, t: Translate): string {
    const special: Record<string, string> = {
        '@reboot': t('After every restart'),
        '@hourly': t('Every hour'),
        '@daily': t('Every day at midnight'),
        '@midnight': t('Every day at midnight'),
        '@weekly': t('Every Sunday at midnight'),
        '@monthly': t('On the first day of every month'),
        '@yearly': t('Every year on 1 January'),
        '@annually': t('Every year on 1 January'),
    };

    if (special[schedule]) {
        return special[schedule];
    }

    const parts = schedule.trim().split(/\s+/);

    if (parts.length !== 5) {
        return schedule;
    }

    const [minute, hour, day, month, weekday] = parts;
    const number = /^\d+$/;
    const any = (value: string) => value === '*';

    if (parts.every(any)) {
        return t('Every minute');
    }

    if (/^\*\/\d+$/.test(minute) && any(hour) && any(day) && any(month) && any(weekday)) {
        return t('Every :n minutes', { n: minute.slice(2) });
    }

    if (number.test(minute) && any(hour) && any(day) && any(month) && any(weekday)) {
        return t('Every hour at minute :minute', { minute });
    }

    if (number.test(minute) && /^\*\/\d+$/.test(hour) && any(day) && any(month) && any(weekday)) {
        return t('Every :n hours at minute :minute', { n: hour.slice(2), minute });
    }

    if (number.test(minute) && number.test(hour)) {
        const time = `${hour}:${pad(minute)}`;

        if (any(day) && any(month) && any(weekday)) {
            return t('Every day at :time', { time });
        }

        if (any(day) && any(month) && number.test(weekday)) {
            return t('Every :day at :time', { day: t(DAYS[Number(weekday) % 7]), time });
        }

        if (any(day) && any(month) && weekday === '1-5') {
            return t('Monday to Friday at :time', { time });
        }

        if (number.test(day) && any(month) && any(weekday)) {
            return t('On day :day of every month at :time', { day, time });
        }
    }

    return schedule;
}
