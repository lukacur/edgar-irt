import { IQueueSystemBase } from "../IQueueSystemBase.js";

export type CourseStatisticsProcessingRequest = {
    idCourse: number;
    idStartAcademicYear: number;
    numberOfIncludedPreviousYears: number;

    forceCalculation: boolean;
}

export class CourseStatisticsCalculationQueue implements IQueueSystemBase<CourseStatisticsProcessingRequest> {
    constructor(
        private readonly usedQueue: IQueueSystemBase<CourseStatisticsProcessingRequest>
    ) {}

    public async enqueue(data: CourseStatisticsProcessingRequest): Promise<boolean> {
        return await this.usedQueue.enqueue(data);
    }

    public async dequeue(): Promise<CourseStatisticsProcessingRequest> {
        return await this.usedQueue.dequeue();
    }

    public async peek(): Promise<CourseStatisticsProcessingRequest | null> {
        return await this.usedQueue.peek();
    }


    public async empty(): Promise<boolean> {
        return await this.usedQueue.empty();
    }


    public async close(): Promise<void> {
        await this.usedQueue.close();
    }
}
