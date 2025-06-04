"use client";

import LLMSelector from "./LLMSelector";
import { useLLMSettings } from "./LLMSettingsContext";

interface GlobalLLMSelectorProps {
  onSelectDone?: () => void;
}

export default function GlobalLLMSelector({
  onSelectDone,
}: GlobalLLMSelectorProps) {
  const { provider, model, setProvider, setModel } = useLLMSettings();

  const handleSelect = (p: "openai" | "ollama", m: string) => {
    setProvider(p);
    setModel(m);
    onSelectDone?.();
  };

  return (
    <LLMSelector
      onModelSelect={handleSelect}
      defaultProvider={provider}
      defaultModel={model}
    />
  );
}

