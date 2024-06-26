import { AbstractJobWorker } from "../../../../../ApplicationModel/Jobs/Workers/AbstractJobWorker.js";
import { IRCalculationResult } from "../../../Statistics/IRCalculationResult.js";
import { EdgarStatProcJobStep } from "../Steps/StatisticsProcessing/EdgarStatProcJobStep.js";
import { getStepResultDBEnumValue, IJobStep, StepResult } from "../../../../../ApplicationModel/Jobs/IJobStep.js";
import { EdgarStatsProcessingConstants } from "../../../EdgarStatsProcessing.constants.js";
import { GenericFactory } from "../../../../../PluginSupport/GenericFactory.js";
import { DatabaseConnection } from "../../../../Database/DatabaseConnection.js";
import { RegisterDelegateToRegistry } from "../../../../../ApplicationModel/Decorators/Registration.decorator.js";
import { IJobConfiguration, JobWorkerConfig } from "../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { DatabaseConnectionRegistry } from "../../../../../PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { FrameworkConfigurationProvider } from "../../../../../ApplicationModel/FrameworkConfiguration/FrameworkConfigurationProvider.js";
import { FrameworkLogger } from "../../../../../Logger/FrameworkLogger.js";

type CalculationParams = {
    nBestParts: number | null,
    nWorstParts: number | null,
    scoreNtiles: number | null,
};

export class EdgarStatProcWorker extends AbstractJobWorker<
    object,
    IRCalculationResult
> implements GenericFactory {
    private calcResultCache: IRCalculationResult & { ttl?: number } | null = null;
    private wasResultCritical: boolean = false;

    constructor(
        private readonly dbConn: DatabaseConnection,
    ) { super(); }

    protected override async initStepsToDB(jobConfig: IJobConfiguration): Promise<void> {
        const transaction = await this.dbConn.beginTransaction(
            FrameworkConfigurationProvider.instance.getJobSchemaName()
        );

        try {
            await transaction.waitForReady();
    
            let ord = 1;
            for (const step of this.jobSteps) {
                await transaction.doQuery(
                    `INSERT INTO job_step (id, job_step_status, name, ordinal, parent_job)
                        VALUES ($1, 'NOT_STARTED', $2, $3, $4);`,
                    [
                        /* $1 */ step.stepRunId,
                        /* $2 */ step.constructor?.name ?? "Classless job step",
                        /* $3 */ ord,
                        /* $4 */jobConfig.jobId,
                    ]
                );
    
                ord++;
            }

            await transaction.commit();
        } catch (err) {
            console.log(err);
        } finally {
            if (!transaction.isFinished()) {
                await transaction.rollback();
            }
        }
    }

    private async calculate(
        jobStep: EdgarStatProcJobStep,
        preparedScriptInput: (object | null)[],

        cacheResult: boolean,
    ): Promise<StepResult<IRCalculationResult> | null> {
        try {
            const calcResult = await jobStep.runTyped(preparedScriptInput);

            if (cacheResult) {
                this.calcResultCache = calcResult.result
                if (this.calcResultCache !== null) {
                    this.calcResultCache.ttl = jobStep.resultTTL;
                }
            }

            return calcResult;
        } catch (err) {
            console.log(err);
            return null;
        }
    }

    private async calculateIfCacheEmpty(
        jobStep: EdgarStatProcJobStep,
        preparedScriptInput: (object | null)[],

        forceRecalculate: boolean = false,
    ): Promise<StepResult<IRCalculationResult> | null> {
        this.wasResultCritical = jobStep.isCritical;

        if (this.calcResultCache === null || forceRecalculate) {
            return await this.calculate(
                jobStep,
                preparedScriptInput,
                
                true,
            );
        } else {
            return {
                status: "success",
                result: this.calcResultCache,
                isCritical: this.wasResultCritical,
                resultTTLSteps: jobStep.resultTTL,
            };
        }
    }

    protected override async startStepDB(jobStep: IJobStep): Promise<void> {
        const transaction = await this.dbConn.beginTransaction(
            FrameworkConfigurationProvider.instance.getJobSchemaName()
        );

        try {
            await transaction.waitForReady();

            await transaction.doQuery(
                `UPDATE job_step SET (started_on, job_step_status) = (CURRENT_TIMESTAMP, 'RUNNING')
                    WHERE id = $1;`,
                [
                    /* $1 */ jobStep.stepRunId,
                ]
            );

            await transaction.commit();
        } catch (err) {
            console.log(err);
        } finally {
            if (!transaction.isFinished()) {
                await transaction.rollback();
            }
        }
    }

    protected override async executeStep(
        jobStep: EdgarStatProcJobStep,
        stepInput: (object | null)[]
    ): Promise<StepResult<IRCalculationResult> | null> {
        return await this.calculateIfCacheEmpty(
            jobStep,
            stepInput,
            true,
        );
    }

    protected override async saveJobStepResultToDB(
        jobStep: IJobStep,
        stepResult: StepResult<IRCalculationResult> | null
    ): Promise<void> {
        const transaction = await this.dbConn.beginTransaction(
            FrameworkConfigurationProvider.instance.getJobSchemaName()
        );

        try {
            await transaction.waitForReady();

            let statMsg: string | null = null;
            if (stepResult === null) {
                statMsg = "[EdgarStatProcWorker.ts] Critical failure (step result was null)";
            } else if (stepResult.status === "success") {
                statMsg = "Success";
            } else {
                statMsg =
                `[EdgarStatProcWorker.ts] Job step failed with status ${stepResult.status} ` +
                    `(step implementation: ${jobStep.constructor.name})` +
                    `
                    Time: ${new Date().toISOString()}
                    Reason: ${stepResult.reason}
                    `;
            }

            await transaction.doQuery(
                `UPDATE job_step
                    SET (finished_on, job_step_status, job_step_status_message) = (CURRENT_TIMESTAMP, $1, $2)
                    WHERE id = $3;`,
                [
                    /* $1 */ getStepResultDBEnumValue(stepResult),
                    /* $2 */ statMsg,
                    /* $3 */ jobStep.stepRunId,
                ]
            );

            await transaction.commit();
        } catch (err) {
            console.log(err);
        } finally {
            if (!transaction.isFinished()) {
                await transaction.rollback();
            }
        }
    }

    protected override async getExecutionResultTyped(): Promise<StepResult<IRCalculationResult> | null> {
        return this.calcResultCache === null ?
        {
            status: "failure",
            reason: "No result",
            result: null,
            isCritical: this.wasResultCritical,
        } :
        {
            status: "success",
            result: this.calcResultCache,
            isCritical: this.wasResultCritical,
            resultTTLSteps: this.calcResultCache.ttl,
        };
    }

    @RegisterDelegateToRegistry(
        "JobWorker",
        EdgarStatsProcessingConstants.JOB_WORKER_REGISTRY_ENTRY
    )
    public create(config: JobWorkerConfig, ...ctorArgs: any[]): object {
        const dbConn: DatabaseConnection | null = DatabaseConnectionRegistry.instance.getItem(
            config.databaseConnection
        );
        if (dbConn === null) {
            FrameworkLogger.error(EdgarStatProcWorker, "Unable to fetch database connection");
            throw new Error("Unable to fetch database connection");
        }

        return new EdgarStatProcWorker(dbConn);
    }
}
