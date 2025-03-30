// src/types/transformers.d.ts

/**
 * Simple declaration for @xenova/transformers package
 */
declare module '@xenova/transformers' {
    /**
     * Pipeline output types
     */
    export interface PipelineOutput {
        data?: Float32Array | number[];
        [key: string]: unknown;
    }

    /**
     * Pipeline function type
     */
    export type PipelineFunction = (
        text: string,
        options?: Record<string, unknown>
    ) => Promise<PipelineOutput>;

    /**
     * Creates a pipeline for the specified task
     */
    export function pipeline(
        task: string,
        model: string,
        options?: {
            quantized?: boolean;
            [key: string]: unknown;
        }
    ): Promise<PipelineFunction>;
}