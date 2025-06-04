"use client";

import LLMSelector from "./LLMSelector";
import { useLLMSettings } from "./LLMSettingsContext";

export default function GlobalLLMSelector() {
  const { provider, model, setProvider, setModel } = useLLMSettings();

  const handleSelect = (p: "openai" | "ollama", m: string) => {
    setProvider(p);
    setModel(m);
  };

  return (
    <LLMSelector
      onModelSelect={handleSelect}
      defaultProvider={provider}
      defaultModel={model}
    />
  );
}

