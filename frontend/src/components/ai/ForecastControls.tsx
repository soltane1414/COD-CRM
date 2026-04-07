"use client";

import { AiCard } from "@/components/ai/AiCard";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/i18n-provider";

interface ForecastControlsProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  periods: number;
  onPeriodsChange: (p: number) => void;
  onFetch: () => void;
  isLoading: boolean;
}

export function ForecastControls({
  categories,
  selectedCategory,
  onCategoryChange,
  periods,
  onPeriodsChange,
  onFetch,
  isLoading,
}: ForecastControlsProps) {
  const { t } = useI18n();

  return (
    <AiCard title={t("ai.forecast_params")}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">{t("ai.forecast_category")}</label>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="all">{t("ai.forecast_all_categories")}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {t("ai.forecast_period", { days: String(periods) })}
          </label>
          <input
            type="range"
            min={7}
            max={90}
            value={periods}
            onChange={(e) => onPeriodsChange(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>7</span>
            <span>90</span>
          </div>
        </div>

        <Button onClick={onFetch} isLoading={isLoading} className="w-full">
          {t("ai.forecast_generate")}
        </Button>
      </div>
    </AiCard>
  );
}
