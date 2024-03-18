import { randomUUID } from "crypto";
import { DatabaseConnection } from "../../../ApplicationImplementation/Database/DatabaseConnection.js";
import { IJobConfiguration } from "../IJobConfiguration.js";
import { IJobProvider } from "./IJobProvider.js";

abstract class DatabaseJobInfoStoringJobProvider<TJobConfiguration extends IJobConfiguration> implements IJobProvider {
    constructor(
        protected readonly dbConn: DatabaseConnection,
    ) {}

    protected abstract provideJobWithId(jobId: string): Promise<TJobConfiguration>;

    public async provideJob(): Promise<IJobConfiguration> {
        const jobId = randomUUID();
        const job = await this.provideJobWithId(jobId);

        await this.dbConn.doQuery(
            `INSERT INTO job_tracking_schema.jobs(id, name, id_user_started, started_on, job_status)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'RUNNING')`,
            [jobId, job.jobName, job.idUserStarted]
        );

        return job;
    }

    public abstract extendJob(jobId: string, extendForMs: number): Promise<"success" | "fail" | "job-inactive">;

    protected abstract doFinishJob(jobId: string): Promise<boolean>;

    public async finishJob(jobId: string): Promise<boolean> {
        const transaction = await this.dbConn.beginTransaction("job_tracking_schema");

        let finishedJob: boolean = false;
        try {
            await transaction.doQuery(
                `UPDATE jobs SET (job_status, job_update_time) = ('FINISHED', CURRENT_TIMESTAMP)
                WHERE id = $1`,
                [jobId]
            );

            finishedJob = await this.doFinishJob(jobId);

            if (finishedJob) {
                await transaction.commit();
            }
        } catch (err) {
            console.log(err);
        } finally {
            if (!transaction.isFinished()) {
                await transaction.rollback();
            }
        }

        return finishedJob;
    }

    protected abstract doFailJob(jobId: string): Promise<boolean>;

    public async failJob(jobId: string): Promise<boolean> {
        const transaction = await this.dbConn.beginTransaction("job_tracking_schema");

        let failedJob: boolean = false;
        try {
            await transaction.doQuery(
                `UPDATE jobs SET (job_status, job_update_time) = ('FAILED', CURRENT_TIMESTAMP)
                WHERE id = $1`,
                [jobId]
            );

            failedJob = await this.doFailJob(jobId);

            if (failedJob) {
                await transaction.commit();
            }
        } catch (err) {
            console.log(err);
        } finally {
            if (!transaction.isFinished()) {
                await transaction.rollback();
            }
        }

        return failedJob;
    }
}

export abstract class AbstractGenericJobProvider<
    TJobConfiguration extends IJobConfiguration
> extends DatabaseJobInfoStoringJobProvider<TJobConfiguration> {
    protected abstract provideJobTyped(presetJobId?: string): Promise<TJobConfiguration>;

    protected override async provideJobWithId(jobId: string): Promise<TJobConfiguration> {
        return await this.provideJobTyped(jobId);
    }

    public abstract extendJob(jobId: string, extendForMs: number): Promise<"success" | "fail" | "job-inactive">;
}
