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
        const job = await this.provideJobWithId(randomUUID());

        const queryResult = await this.dbConn.doQuery<{ id: number }>(
            "SELECT id FROM job_tracking_schema.job_type WHERE abbrevation = $1",
            [job.jobTypeAbbrevation]
        );

        if (queryResult === null || queryResult.count === 0) {
            await this.doFailJob(job.jobId, "no-retry");
            throw new Error(
                `Job type abbrevation is not defined in the database (abbrevation ${job.jobTypeAbbrevation})`
            );
        }

        const jobTypeId = queryResult.rows[0].id;

        await this.dbConn.doQuery(
            `INSERT INTO job_tracking_schema.job (
                id,
                id_job_type,
                name,
                id_user_started,
                job_definition,
                started_on,
                job_status
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'RUNNING')`,
            [
                /* $1 */ job.jobId,
                /* $2 */ jobTypeId,
                /* $3 */ job.jobName,
                /* $4 */ job.idUserStarted,

                /* || */ (job.getRawDescriptor !== undefined && typeof(job.getRawDescriptor) === "function") ?
                /* $5 */    await job.getRawDescriptor() :
                /* || */    null
            ]
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
                `UPDATE job
                    SET (job_status, finished_on, job_status_message) = ('FINISHED', CURRENT_TIMESTAMP, 'Success')
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

    protected abstract doFailJob(
        jobId: string,
        retryMode: "retry" | "no-retry" | { retryAfterMs: number },
        statusMessage?: string,
    ): Promise<boolean>;

    public async failJob(
        jobId: string,
        retryMode: "retry" | "no-retry" | { retryAfterMs: number },
        statusMessage?: string,
    ): Promise<boolean> {
        const transaction = await this.dbConn.beginTransaction("job_tracking_schema");

        let failedJob: boolean = false;
        try {
            await transaction.doQuery(
                // TODO: If job status is failed then maybe add a successor job ID
                // TODO: Add another status 'FAILED_NO_RESTART' that indicates that the job should not be restarted
                `UPDATE job SET (job_status, finished_on, job_status_message) = ('FAILED', CURRENT_TIMESTAMP, $1)
                    WHERE id = $2`,
                [
                    /* $1 */ statusMessage ?? null,
                    /* $2 */ jobId,
                ]
            );

            failedJob = await this.doFailJob(jobId, retryMode, statusMessage);

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
