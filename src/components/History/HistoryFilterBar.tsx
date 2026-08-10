import { Filter, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventTypeConfig } from "./eventTypeConfig";

interface HistoryFilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  eventFilter: string;
  onEventFilterChange: (value: string) => void;
  actorFilter: string;
  onActorFilterChange: (value: string) => void;
  actors: string[];
}

export function HistoryFilterBar({
  searchQuery,
  onSearchQueryChange,
  eventFilter,
  onEventFilterChange,
  actorFilter,
  onActorFilterChange,
  actors,
}: HistoryFilterBarProps) {
  const { t } = useTranslation("common");
  const eventTypeConfig = useEventTypeConfig();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="h-4 w-4" />
          {t("actions.filter")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("actions.search")}
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={eventFilter} onValueChange={onEventFilterChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {Object.entries(eventTypeConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actorFilter} onValueChange={onActorFilterChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {actors.map((actor) => (
                <SelectItem key={actor} value={actor}>
                  {actor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
