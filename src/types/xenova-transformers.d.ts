// src/types/xenova-transformers.d.ts

/**
 * Type declarations for @xenova/transformers
 * This overrides the broken definitions in the package
 */
declare module '@xenova/transformers' {
    /**
     * Result of a feature extraction pipeline
     */
    export interface FeatureExtractionOutput {
        data: Float32Array;
        dims: number[];
        [key: string]: unknown;
    }

    /**
     * Generic pipeline return type
     */
    export type PipelineOutput = FeatureExtractionOutput | Record<string, unknown>;

    /**
     * Generic pipeline function type
     */
    export type PipelineFunction = (text: string, options?: Record<string, unknown>) => Promise<PipelineOutput>;

    /**
     * Creates a new pipeline for the specified task.
     * @param task - The task to be performed (e.g., 'feature-extraction')
     * @param model - The model to use for the task (e.g., 'Xenova/all-MiniLM-L6-v2')
     * @param options - Additional options for the pipeline
     * @returns A pipeline function that can be called with input data
     */
    export function pipeline(
        task: string,
        model: string,
        options?: {
            quantized?: boolean;
            progress_callback?: (progress: unknown) => void;
            [key: string]: unknown;
        }
    ): Promise<PipelineFunction>;
}