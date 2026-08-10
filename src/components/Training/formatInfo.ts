import { Database, FileJson, Sparkles } from "lucide-react";
import type { ExportFormat } from "@/services/trainingClient";

/**
 * Product names stay as they are; only the descriptions are translated, which
 * is why they are looked up per render through `formats.<id>` rather than held
 * here beside the name.
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
