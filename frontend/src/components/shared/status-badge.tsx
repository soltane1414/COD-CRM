import { Badge } from "@/components/ui/badge";
import { ORDER_STATUSES } from "@/lib/constants/statuses";
import type { OrderStatus } from "@/types/order";

interface StatusBadgeProps {
  status: OrderStatus;
  locale?: "en" | "fr" | "ar";
}

const variantMap: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "muted" | "outline"> = {
  new: "default",
  confirmed: "success",
  processing: "warning",
  shipped: "default",
  delivered: "success",
  returned: "destructive",
  cancelled: "destructive",
  no_answer: "muted",
  postponed: "warning",
};

export function StatusBadge({ status, locale = "en" }: StatusBadgeProps) {
  const config = ORDER_STATUSES[status];
  const label = config?.label[locale] || status;
  const variant = variantMap[status] || "secondary";

  return (
    <Badge variant={variant}>
      {label}
    </Badge>
  );
}
