import { Link, usePage } from "@inertiajs/react";
import { UserCog } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { leave } from "@/routes/impersonation";

/** A strip on top of every page while an administrator works in the account of a user. */
export function ImpersonationBanner() {
    const { t } = useTranslation();
    const { impersonating } = usePage().props;

    if (!impersonating) {
        return null;
    }

    return (
        <div
            data-test="impersonation-banner"
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-red-100 px-4 py-1.5 text-center text-sm text-red-950 dark:bg-red-950/60 dark:text-red-100"
        >
            <span className="inline-flex items-center gap-1.5 font-medium">
                <UserCog className="size-4" />
                {t("You are signed in as :name", {
                    name: `${impersonating.name} (${impersonating.email})`,
                })}
            </span>
            <Link
                href={leave()}
                method="post"
                as="button"
                className="cursor-pointer font-medium underline"
                data-test="impersonation-leave"
            >
                {t("Back to my account")}
            </Link>
        </div>
    );
}
