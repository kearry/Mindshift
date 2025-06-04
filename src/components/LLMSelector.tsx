"use client";

import { useState, useEffect } from "react";
import { listOllamaModels } from "@/lib/ollamaService";

interface LLMSelectorProps {
  onModelSelect: (provider: "openai" | "ollama", model: string) => void;
  defaultProvider?: "openai" | "ollama";
  defaultModel?: string;
}

export default function LLMSelector({
  onModelSelect,
  defaultProvider = "openai",
  defaultModel = "gpt-4o-mini",
}: LLMSelectorProps) {
  const [provider, setProvider] = useState<"openai" | "ollama">(
    defaultProvider,
  );
  const [model, setModel] = useState<string>(defaultModel);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // OpenAI model options - these could be fetched from API as well
  const openaiModels = ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];

  // Fetch Ollama models on initial load
  useEffect(() => {
    const fetchOllamaModels = async () => {
      if (provider === "ollama") {
        setLoadingModels(true);
        setError(null);
        try {
          const models = await listOllamaModels();
          setOllamaModels(models);
          // Select first model if available and none is currently selected
          if (models.length > 0 && (!model || !models.includes(model))) {
            setModel(models[0]);
          }
        } catch (err) {
          setError("Failed to connect to Ollama. Is it running locally?");
          console.error("Ollama connection error:", err);
        } finally {
          setLoadingModels(false);
        }
      }
    };

    fetchOllamaModels();
  }, [provider]);

  // Trigger the callback when provider or model changes
  useEffect(() => {
    onModelSelect(provider, model);
  }, [provider, model, onModelSelect]);

  // Handle provider change
  const handleProviderChange = (newProvider: "openai" | "ollama") => {
    setProvider(newProvider);
    // Set default model for the selected provider
    if (newProvider === "openai") {
      setModel(openaiModels[0]);
    } else if (ollamaModels.length > 0) {
      setModel(ollamaModels[0]);
    } else {
      setModel("");
    }
  };

  return (
    <div className="mb-4 p-3 border rounded bg-white dark:bg-gray-800">
      <div className="text-sm font-medium mb-2"> Select LLM Provider </div>

      <div className="flex space-x-2 mb-3">
        <button
          className={`px-3 py-1 rounded text-sm ${
            provider === "openai"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          }`}
          onClick={() => handleProviderChange("openai")}
        >
          OpenAI
        </button>
        <button
          className={`px-3 py-1 rounded text-sm ${
            provider === "ollama"
              ? "bg-green-500 text-white"
              : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          }`}
          onClick={() => handleProviderChange("ollama")}
        >
          Ollama(Local)
        </button>
      </div>

      <div className="text-sm font-medium mb-1"> Model </div>
      {provider === "openai" ? (
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          {openaiModels.map((model) => (
            <option key={model} value={model}>
              {" "}
              {model}{" "}
            </option>
          ))}
        </select>
      ) : (
        <>
          {loadingModels ? (
            <div className="text-sm text-gray-500">
              {" "}
              Loading Ollama models...
            </div>
          ) : error ? (
            <div className="text-sm text-red-500"> {error} </div>
          ) : ollamaModels.length > 0 ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {ollamaModels.map((model) => (
                <option key={model} value={model}>
                  {" "}
                  {model}{" "}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-gray-500">
              {" "}
              No Ollama models found.Please pull a model.
            </div>
          )}
          <div className="mt-1 text-xs text-gray-500">
            Requires Ollama running locally -{" "}
            <a
              href="https://ollama.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {" "}
              https://ollama.ai
            </a>
          </div>
        </>
      )}
    </div>
  );
}
