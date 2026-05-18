"use client";

import { useState, ChangeEvent } from 'react';

type JsonObject = Record<string, any>;

export default function UniversalJsonConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const flatten = (obj: JsonObject, prefix = '', res: JsonObject = {}): JsonObject => {
    for (const key in obj) {
      const name = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        flatten(obj[key], name, res);
      } 
      else if (Array.isArray(obj[key])) {
        res[name] = JSON.stringify(obj[key]);
      } 
      else {
        res[name] = obj[key];
      }
    }
    return res;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const processFile = () => {
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let json = JSON.parse(e.target?.result as string);

        const dataArray = Array.isArray(json) ? json : [json];

        const flattenedData = dataArray.map((item) => flatten(item));

        const allKeys = Array.from(
          new Set(flattenedData.flatMap((obj) => Object.keys(obj)))
        );

        if (allKeys.length === 0) {
          throw new Error("The JSON file appears to be empty or invalid.");
        }

        const csvRows = [
          allKeys.join(','),
          ...flattenedData.map((row: JsonObject) =>
            allKeys
              .map((key) => {
                const val = row[key] ?? '';
                const escaped = String(val).replace(/"/g, '""');
                return `"${escaped}"`;
              })
              .join(',')
          ),
        ].join('\n');

        const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${file.name.replace('.json', '')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setIsProcessing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error parsing JSON file");
        setIsProcessing(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="max-w-xl mx-auto mt-16 p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Universal JSON to CSV</h2>
      <p className="text-gray-500 text-sm mb-8">
        Upload any JSON file. We'll flatten nested data and find all columns automatically.
      </p>

      <div className="flex flex-col gap-6">
        <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-indigo-400 transition-colors text-center">
          <input 
            type="file" 
            accept=".json" 
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="text-gray-600">
            {file ? (
              <span className="font-medium text-indigo-600">{file.name}</span>
            ) : (
              "Click to upload or drag and drop your .json file"
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
            {error}
          </div>
        )}

        <button
          onClick={processFile}
          disabled={!file || isProcessing}
          className={`w-full py-3 rounded-xl font-semibold text-white shadow-md transition-all
            ${!file || isProcessing 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'}`}
        >
          {isProcessing ? "Processing Data..." : "Convert & Download CSV"}
        </button>
      </div>
    </div>
  );
}