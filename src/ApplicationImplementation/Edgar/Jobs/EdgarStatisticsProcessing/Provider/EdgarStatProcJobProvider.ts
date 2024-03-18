import { randomUUID } from "crypto";
import { CourseStatisticsCalculationQueue, CourseStatisticsProcessingRequest } from "../../../../../AdaptiveGradingDaemon/Queue/StatisticsCalculationQueues/CourseStatisticsCalculationQueue.js";
import { AbstractGenericJobProvider } from "../../../../../ApplicationModel/Jobs/Providers/AbstractGenericJobProvider.js";
import { DatabaseConnection } from "../../../../Database/DatabaseConnection.js";
import { EdgarStatProcJobConfiguration } from "./EdgarStatProcJobConfiguration.js";
import { CourseBasedBatch } from "../../../Batches/CourseBasedBatch.js";

type JobQueueInfoEntry = {
    timeoutId: NodeJS.Timeout,
    associatedQueueEntry: CourseStatisticsProcessingRequest,
};

export class EdgarStatProcJobProvider extends AbstractGenericJobProvider<EdgarStatProcJobConfiguration> {
    private readonly jobMap: { [jobId: string]: EdgarStatProcJobConfiguration } = {};

    private readonly jobQueueInfo: { [jobId: string]: JobQueueInfoEntry } = {};

    constructor(
        private readonly dbConn: DatabaseConnection,
        private readonly calculationQueue: CourseStatisticsCalculationQueue,
        private readonly expectedJobTimeout: number,
    ) {
        super();
    }

    private jobActive(jobId: string): boolean {
        return Object.keys(this.jobQueueInfo).includes(jobId);
    }

    private async resetJob(jobId: string): Promise<boolean> {
        const queueInfo = this.jobQueueInfo[jobId];
        delete this.jobQueueInfo[jobId];

        try {
            const success = await this.calculationQueue.enqueue(queueInfo.associatedQueueEntry);
            if (!success) {
                queueInfo.timeoutId = setTimeout(() => this.resetJob(jobId), 3000);
                this.jobQueueInfo[jobId] = queueInfo;

                return false;
            }

            return true;
        } catch (err) {
            console.log(err);

            queueInfo.timeoutId = setTimeout(() => this.resetJob(jobId), 3000);
            this.jobQueueInfo[jobId] = queueInfo;
        }

        return false;
    }

    protected async provideJobTyped(): Promise<EdgarStatProcJobConfiguration> {
        const queueEntry = await this.calculationQueue.dequeue();
        const jobId = randomUUID();

        this.jobMap[jobId] = new EdgarStatProcJobConfiguration(
            jobId,
            `Statistics processing job - created @ ${(new Date()).toISOString()}; ` +
                `(For course id ${queueEntry.idCourse} with start academic year id ${queueEntry.idStartAcademicYear})`,
            this.expectedJobTimeout,

            new CourseBasedBatch(
                this.dbConn,
                queueEntry.idCourse,
                queueEntry.idStartAcademicYear,
                queueEntry.numberOfIncludedPreviousYears,
            ),
        );

        this.jobQueueInfo[jobId] = {
            associatedQueueEntry: queueEntry,
            timeoutId: setTimeout(
                () => this.resetJob(jobId),
                this.expectedJobTimeout,
            )
        };

        return this.jobMap[jobId];
    }

    public async extendJob(jobId: string, extendForMs: number): Promise<"success" | "fail" | "job-inactive"> {
        if (!this.jobActive(jobId)) {
            return "job-inactive";
        }

        try {
            clearTimeout(this.jobQueueInfo[jobId].timeoutId);
            this.jobQueueInfo[jobId].timeoutId = setTimeout(() => this.resetJob(jobId), extendForMs);

            return "success";
        } catch(err) {
            console.log(err);
        }

        return "fail";
    }

    public async finishJob(jobId: string): Promise<boolean> {
        if (!this.jobActive(jobId)) {
            return false;
        }

        try {
            clearTimeout(this.jobQueueInfo[jobId].timeoutId);
            delete this.jobQueueInfo[jobId];

            return true;
        } catch(err) {
            console.log(err);
        }

        return false;
    }

    public async failJob(jobId: string): Promise<boolean> {
        return await this.resetJob(jobId);
    }
}
