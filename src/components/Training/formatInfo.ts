import { Database, FileJson, Sparkles } from "lucide-react";
import type { ExportFormat } from "@/services/trainingClient";

/**
 * Icon and product name per export format.
 *
 * Product names stay as they are; only the descriptions are translated, and
 * those are looked up per render under `formats.<format>` so a language switch
 * reaches what is already on screen.
 */
export const FORMAT_INFO: Record<ExportFormat, { name: string; icon: typeof FileJson }> = {
  coco: { name: "COCO", icon: FileJson },
  huggingface: { name: "HuggingFace", icon: Database },
  radiolyze: { name: "Radiolyze", icon: Sparkles },
};

export const FORMAT_ENTRIES = Object.entries(FORMAT_INFO) as [
  ExportFormat,
  (typeof FORMAT_INFO)["coco"],
][];
