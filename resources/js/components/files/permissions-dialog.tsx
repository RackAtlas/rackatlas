import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';

export type PermissionChange = {
    mode: string | null;
    owner: string | null;
    group: string | null;
    recursive: boolean;
};

const WHO = ['owner', 'group', 'others'] as const;
const BITS = [
    { key: 'r', value: 4 },
    { key: 'w', value: 2 },
    { key: 'x', value: 1 },
] as const;

/** "755" → "rwxr-xr-x". */
export function modeString(mode: string): string {
    return mode
        .slice(-3)
        .split('')
        .map((digit) => {
            const n = Number(digit);

            return `${n & 4 ? 'r' : '-'}${n & 2 ? 'w' : '-'}${n & 1 ? 'x' : '-'}`;
        })
        .join('');
}

export function PermissionsDialog({
    names,
    mode,
    owner,
    group,
    hasDirectory,
    onClose,
    onSubmit,
}: {
    names: string[];
    mode: string;
    owner: string;
    group: string;
    hasDirectory: boolean;
    onClose: () => void;
    onSubmit: (change: PermissionChange) => Promise<boolean>;
}) {
    const { t } = useTranslation();
    const [octal, setOctal] = useState(mode.slice(-3));
    const [ownerValue, setOwner] = useState(owner);
    const [groupValue, setGroup] = useState(group);
    const [recursive, setRecursive] = useState(false);
    const [busy, setBusy] = useState(false);

    const valid = /^[0-7]{3}$/.test(octal);
    const digits = valid ? octal.split('').map(Number) : [0, 0, 0];

    const toggle = (who: number, bit: number) => {
        const next = [...digits];
        next[who] = next[who] ^ bit;
        setOctal(next.join(''));
    };

    const submit = async () => {
        setBusy(true);
        const ok = await onSubmit({
            mode: valid && octal !== mode.slice(-3) ? octal : null,
            owner: ownerValue.trim() !== '' && (ownerValue !== owner || groupValue !== group) ? ownerValue.trim() : null,
            group: groupValue.trim() || null,
            recursive,
        });
        setBusy(false);

        if (ok) {
            onClose();
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('Permissions and owner')}</DialogTitle>
                    <DialogDescription className="font-mono break-all">
                        {names.length === 1 ? names[0] : t(':count items', { count: names.length })}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-muted-foreground">
                                <th />
                                <th className="font-medium">{t('Read')}</th>
                                <th className="font-medium">{t('Write')}</th>
                                <th className="font-medium">{t('Execute')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {WHO.map((who, index) => (
                                <tr key={who}>
                                    <td className="py-1 pr-2">
                                        {{ owner: t('Owner'), group: t('Group'), others: t('Others') }[who]}
                                    </td>
                                    {BITS.map((bit) => (
                                        <td key={bit.key} className="py-1 text-center">
                                            <Checkbox
                                                checked={(digits[index] & bit.value) !== 0}
                                                onCheckedChange={() => toggle(index, bit.value)}
                                                aria-label={`${who} ${bit.key}`}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="flex items-center gap-3">
                        <Label htmlFor="perm-octal" className="w-24">
                            {t('Octal')}
                        </Label>
                        <Input
                            id="perm-octal"
                            value={octal}
                            onChange={(e) => setOctal(e.target.value.replace(/[^0-7]/g, '').slice(0, 3))}
                            className="w-24 font-mono"
                        />
                        <span className="font-mono text-sm text-muted-foreground">{valid && modeString(octal)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="perm-owner">{t('Owner')}</Label>
                            <Input id="perm-owner" value={ownerValue} onChange={(e) => setOwner(e.target.value)} className="font-mono" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="perm-group">{t('Group')}</Label>
                            <Input id="perm-group" value={groupValue} onChange={(e) => setGroup(e.target.value)} className="font-mono" />
                        </div>
                    </div>

                    {hasDirectory && (
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={recursive} onCheckedChange={(v) => setRecursive(v === true)} />
                            {t('Also everything inside the directories')}
                        </label>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button onClick={() => void submit()} disabled={busy || !valid}>
                        {busy && <Spinner className="size-3.5" />}
                        {t('Apply')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
