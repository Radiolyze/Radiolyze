import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PacsPushState } from "@/hooks/mesh/useMeshPacsPush";

interface MeshPacsPushControlProps {
  state: PacsPushState;
  /** URL recorded on the job itself, from an earlier push in another session. */
  existingUrl?: string | null;
  onPush: () => void;
}

/**
 * Push-to-PACS button plus the resulting Orthanc URL or error.
 *
 * A push that happened in an earlier session counts as pushed too, so the
 * button reads "send again" whenever either source carries a URL.
 */
export function MeshPacsPushControl({ state, existingUrl, onPush }: MeshPacsPushControlProps) {
  const { t } = useTranslation("viewer");

  const alreadyPushed = state.phase === "pushed" || Boolean(existingUrl);
  const url = state.phase === "pushed" ? state.url : (existingUrl ?? null);

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={alreadyPushed ? "outline" : "default"}
        onClick={onPush}
        disabled={state.phase === "pushing"}
      >
        {state.phase === "pushing" ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : alreadyPushed ? (
          <CheckCircle2 className="mr-1 h-4 w-4" />
        ) : (
          <UploadCloud className="mr-1 h-4 w-4" />
        )}
        {alreadyPushed ? t("mesh.pacs.pushedAgain") : t("mesh.pacs.push")}
      </Button>
      {alreadyPushed && url && (
        <span
          className="max-w-xs truncate rounded bg-card/90 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur"
          title={url}
        >
          {url}
        </span>
      )}
      {state.phase === "failed" && (
        <span className="max-w-xs truncate rounded bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
          {t("mesh.pacs.failed")}: {state.error}
        </span>
      )}
    </div>
  );
}
