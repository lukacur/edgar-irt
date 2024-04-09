import { IJobConfiguration } from "../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { IQueueSystemBase } from "../IQueueSystemBase.js";

export type CourseStatisticsProcessingRequest = {
    idCourse: number;
    idStartAcademicYear: number;
    numberOfIncludedPreviousYears: number;

    userRequested: number | null;

    forceCalculation: boolean;
}

export class CourseStatisticsCalculationQueue implements IQueueSystemBase<IJobConfiguration> {
    constructor(
        public readonly queueName: string,
        private readonly usedQueue: IQueueSystemBase<IJobConfiguration>
    ) {}

    public async enqueue(data: IJobConfiguration): Promise<boolean> {
        return await this.usedQueue.enqueue(data);
    }

    public async dequeue(): Promise<IJobConfiguration> {
        return await this.usedQueue.dequeue();
    }

    public async peek(): Promise<IJobConfiguration | null> {
        return await this.usedQueue.peek();
    }


    public async empty(): Promise<boolean> {
        return await this.usedQueue.empty();
    }


    public async close(): Promise<void> {
        await this.usedQueue.close();
    }
}
