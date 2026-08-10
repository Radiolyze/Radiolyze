import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CategoryCount } from "@/services/trainingClient";

interface CategoryFilterProps {
  categories: CategoryCount[];
  selected: string[];
  onToggle: (category: string) => void;
  onReset: () => void;
}

export function CategoryFilter({ categories, selected, onToggle, onReset }: CategoryFilterProps) {
  const { t } = useTranslation("training");

  return (
    <div className="space-y-3">
      <Label>{t("settings.categories")}</Label>
      <div className="flex flex-wrap gap-2">
        {categories.map(({ category, count }) => (
          <Badge
            key={category}
            variant={selected.includes(category) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => onToggle(category)}
          >
            {category} ({count})
          </Badge>
        ))}
      </div>
      {selected.length > 0 && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          {t("settings.resetFilter")}
        </Button>
      )}
    </div>
  );
}
