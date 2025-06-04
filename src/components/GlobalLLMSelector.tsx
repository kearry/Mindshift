"use client";

import LLMSelector from "./LLMSelector";
import { useLLMSettings } from "./LLMSettingsContext";
import { useRef } from "react";

interface GlobalLLMSelectorProps {
  onSelectDone?: () => void;
}

export default function GlobalLLMSelector({
  onSelectDone,
}: GlobalLLMSelectorProps) {
  const { provider, model, setProvider, setModel } = useLLMSettings();
  const firstRender = useRef(true);

  const handleSelect = (p: "openai" | "ollama", m: string) => {
    setProvider(p);
    setModel(m);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
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

