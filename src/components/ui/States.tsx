import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "./Button";

export function EmptyState({
  title = "Žádná data",
  description = "Pro tento výběr zatím nemáme žádná data.",
}) {
  return (
    <div className="grid min-h-44 place-items-center p-6 text-center">
      <div>
        <Inbox className="mx-auto mb-3 text-[var(--color-text-muted)]" aria-hidden />
        <strong>{title}</strong>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
      </div>
    </div>
  );
}
export function ErrorState({ retry }: { retry?: () => void }) {
  return (
    <div className="grid min-h-44 place-items-center p-6 text-center">
      <div>
        <AlertCircle className="mx-auto mb-3 text-[var(--color-data-negative)]" aria-hidden />
        <strong>Data se nepodařilo načíst</strong>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Základní přehled zůstává dostupný.
        </p>
        {retry && (
          <Button variant="secondary" className="mt-4" onClick={retry}>
            Zkusit znovu
          </Button>
        )}
      </div>
    </div>
  );
}
