"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AiCard } from "@/components/ai/AiCard";
import type { DataFormatInfo as DataFormatType } from "@/types/ai";

interface DataFormatInfoProps {
  format: DataFormatType;
}

export function DataFormatInfo({ format }: DataFormatInfoProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <AiCard title="Expected Data Format">
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Required Columns</h4>
          <div className="space-y-1">
            {Object.entries(format.required_columns).map(([col, desc]) => (
              <div key={col} className="flex gap-2 text-sm">
                <code className="text-primary font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                  {col}
                </code>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {expanded ? "Hide" : "Show"} optional columns
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Optional Columns</h4>
            <div className="space-y-1">
              {Object.entries(format.optional_columns).map(([col, desc]) => (
                <div key={col} className="flex gap-2 text-sm">
                  <code className="text-primary font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                    {col}
                  </code>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {format.notes.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-foreground mb-1">Notes</h4>
            <ul className="list-disc list-inside space-y-1">
              {format.notes.map((note, i) => (
                <li key={i} className="text-xs text-muted-foreground">{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AiCard>
  );
}
