"use client";

import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiFileUploadProps {
  onFileSelect: (file: File | null) => void;
  accept?: string;
}

export function AiFileUpload({
  onFileSelect,
  accept = ".csv",
}: AiFileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    setFileName(file?.name || null);
    onFileSelect(file);
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files?.[0] || null);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
      />
      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
      {fileName ? (
        <p className="text-sm font-medium text-foreground">{fileName}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Drag & drop a CSV file, or click to browse
        </p>
      )}
    </div>
  );
}
