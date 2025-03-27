// src/types/transformers.d.ts

declare module '@xenova/transformers' {
    export function pipeline(
        task: string,
        model: string,
        options?: Record<string, unknown>
    ): Promise<{
        data?: Float32Array | number[];
        [key: string]: unknown;
    }>;
}