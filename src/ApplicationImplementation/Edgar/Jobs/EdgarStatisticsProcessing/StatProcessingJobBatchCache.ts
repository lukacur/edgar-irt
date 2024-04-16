import { CourseBasedBatch } from "../../Batches/CourseBasedBatch.js";

export class StatProcessingJobBatchCache {
    public static readonly instance = new StatProcessingJobBatchCache();

    private constructor() {}

    private readonly jobBatchMap: Map<string, CourseBasedBatch> = new Map();

    public cacheJobBatch(jobId: string, batch: CourseBasedBatch): void {
        this.jobBatchMap.set(jobId, batch);
    }

    public getCachedJobBatch(jobId: string): CourseBasedBatch | null {
        if (!this.jobBatchMap.has(jobId)) {
            return null;
        }

        return this.jobBatchMap.get(jobId)!;
    }

    public decacheJobBatch(jobId: string): void {
        this.jobBatchMap.delete(jobId);
    }
}
