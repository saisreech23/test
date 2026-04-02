"use client";

import { useState, useRef } from "react";

interface Props {
  onUpload: (file: File) => void;
  uploading: boolean;
}

export default function FileUpload({ onUpload, uploading }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["log", "txt", "csv"].includes(ext || "")) {
      alert("Please upload a .log, .txt, or .csv file");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-primary-500 bg-primary-500/10"
            : "border-gray-700 hover:border-gray-600"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".log,.txt,.csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
        />
        <div className="text-gray-400">
          {selectedFile ? (
            <>
              <p className="text-white font-medium">{selectedFile.name}</p>
              <p className="text-sm mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </>
          ) : (
            <>
              <p className="text-lg mb-1">
                Drop your log file here or click to browse
              </p>
              <p className="text-sm">
                Supports .log, .txt, .csv files (Nginx/Apache access log format)
              </p>
            </>
          )}
        </div>
      </div>

      {selectedFile && (
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="btn-primary mt-4"
        >
          {uploading ? "Uploading & Analyzing..." : "Upload & Analyze"}
        </button>
      )}
    </div>
  );
}
