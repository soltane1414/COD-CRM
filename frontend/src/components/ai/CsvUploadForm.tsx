"use client";

import { useState } from "react";
import { AiCard } from "@/components/ai/AiCard";
import { AiAlert } from "@/components/ai/AiAlert";
import { AiFileUpload } from "@/components/ai/AiFileUpload";
import { Button } from "@/components/ui/button";
import { mlApi } from "@/lib/api/ml-client";
import type { RetrainingResult } from "@/types/ai";

interface CsvUploadFormProps {
  onSuccess: (result: RetrainingResult) => void;
}

export function CsvUploadForm({ onSuccess }: CsvUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await mlApi.uploadAndTrain(file);
      onSuccess(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AiCard title="Upload Training Data" subtitle="Upload a CSV file to retrain all models">
      <div className="space-y-4">
        <AiFileUpload onFileSelect={setFile} />

        {error && <AiAlert variant="error">{error}</AiAlert>}

        <Button
          onClick={handleUpload}
          disabled={!file}
          isLoading={loading}
          className="w-full"
        >
          Upload & Retrain
        </Button>
      </div>
    </AiCard>
  );
}
