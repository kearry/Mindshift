"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type ProviderType = 'openai' | 'ollama';

interface LLMSettingsContextValue {
  provider: ProviderType;
  model: string;
  setProvider: (p: ProviderType) => void;
  setModel: (m: string) => void;
}

const envDefaultProvider: ProviderType =
  process.env.DEFAULT_LLM_PROVIDER === 'ollama' ? 'ollama' : 'openai';
const envDefaultModel = process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini';

const LLMSettingsContext = createContext<LLMSettingsContextValue>({
  provider: envDefaultProvider,
  model: envDefaultModel,
  setProvider: () => {},
  setModel: () => {},
});

export function LLMSettingsProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<ProviderType>(envDefaultProvider);
  const [model, setModel] = useState<string>(envDefaultModel);

  return (
    <LLMSettingsContext.Provider value={{ provider, model, setProvider, setModel }}>
      {children}
    </LLMSettingsContext.Provider>
  );
}

export function useLLMSettings() {
  return useContext(LLMSettingsContext);
}

