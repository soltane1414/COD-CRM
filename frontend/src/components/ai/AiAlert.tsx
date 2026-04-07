import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";

const VARIANTS = {
  error: {
    icon: AlertCircle,
    bg: "bg-destructive/10 border-destructive/20",
    text: "text-destructive",
  },
  success: {
    icon: CheckCircle,
    bg: "bg-success/10 border-success/20",
    text: "text-success",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-warning/10 border-warning/20",
    text: "text-warning",
  },
  info: {
    icon: Info,
    bg: "bg-primary/10 border-primary/20",
    text: "text-primary",
  },
};

interface AiAlertProps {
  variant: keyof typeof VARIANTS;
  children: React.ReactNode;
  className?: string;
}

export function AiAlert({ variant, children, className }: AiAlertProps) {
  const config = VARIANTS[variant];
  const Icon = config.icon;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        config.bg,
        className
      )}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", config.text)} />
      <div className={cn("text-sm", config.text)}>{children}</div>
    </div>
  );
}
