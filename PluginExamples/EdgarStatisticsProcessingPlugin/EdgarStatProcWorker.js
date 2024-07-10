var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { EdgarStatsProcessingConstants } from "../../dist/ApplicationImplementation/Edgar/EdgarStatsProcessing.constants.js";
import { FrameworkConfigurationProvider } from "../../dist/ApplicationModel/FrameworkConfiguration/FrameworkConfigurationProvider.js";
import { getStepResultDBEnumValue } from "../../dist/ApplicationModel/Jobs/IJobStep.js";
import { AbstractJobWorker } from "../../dist/ApplicationModel/Jobs/Workers/AbstractJobWorker.js";
import { FrameworkLogger } from "../../dist/Logger/FrameworkLogger.js";
import { DatabaseConnectionRegistry } from "../../dist/PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
export class EdgarStatProcWorker extends AbstractJobWorker {
    constructor(dbConn) {
        super();
        this.dbConn = dbConn;
        this.calcResultCache = null;
        this.wasResultCritical = false;
    }
    initStepsToDB(jobConfig) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.dbConn.beginTransaction(FrameworkConfigurationProvider.instance.getJobSchemaName());
            try {
                yield transaction.waitForReady();
                let ord = 1;
                for (const step of this.jobSteps) {
                    yield transaction.doQuery(`INSERT INTO job_step (id, job_step_status, name, ordinal, parent_job)
                        VALUES ($1, 'NOT_STARTED', $2, $3, $4);`, [
                        /* $1 */ step.stepRunId,
                        /* $2 */ (_b = (_a = step.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "Classless job step",
                        /* $3 */ ord,
                        /* $4 */ jobConfig.jobId,
                    ]);
                    ord++;
                }
                yield transaction.commit();
            }
            catch (err) {
                console.log(err);
            }
            finally {
                if (!transaction.isFinished()) {
                    yield transaction.rollback();
                }
            }
        });
    }
    calculate(jobStep, preparedScriptInput, cacheResult) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const calcResult = yield jobStep.runTyped(preparedScriptInput);
                if (cacheResult) {
                    this.calcResultCache = calcResult.result;
                    if (this.calcResultCache !== null) {
                        this.calcResultCache.ttl = jobStep.resultTTL;
                    }
                }
                return calcResult;
            }
            catch (err) {
                console.log(err);
                return null;
            }
        });
    }
    calculateIfCacheEmpty(jobStep, preparedScriptInput, forceRecalculate = false) {
        return __awaiter(this, void 0, void 0, function* () {
            this.wasResultCritical = jobStep.isCritical;
            if (this.calcResultCache === null || forceRecalculate) {
                return yield this.calculate(jobStep, preparedScriptInput, true);
            }
            else {
                return {
                    status: "success",
                    result: this.calcResultCache,
                    isCritical: this.wasResultCritical,
                    resultTTLSteps: jobStep.resultTTL,
                };
            }
        });
    }
    startStepDB(jobStep) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.dbConn.beginTransaction(FrameworkConfigurationProvider.instance.getJobSchemaName());
            try {
                yield transaction.waitForReady();
                yield transaction.doQuery(`UPDATE job_step SET (started_on, job_step_status) = (CURRENT_TIMESTAMP, 'RUNNING')
                    WHERE id = $1;`, [
                    /* $1 */ jobStep.stepRunId,
                ]);
                yield transaction.commit();
            }
            catch (err) {
                console.log(err);
            }
            finally {
                if (!transaction.isFinished()) {
                    yield transaction.rollback();
                }
            }
        });
    }
    executeStep(jobStep, stepInput) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.calculateIfCacheEmpty(jobStep, stepInput, true);
        });
    }
    saveJobStepResultToDB(jobStep, stepResult) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.dbConn.beginTransaction(FrameworkConfigurationProvider.instance.getJobSchemaName());
            try {
                yield transaction.waitForReady();
                let statMsg = null;
                if (stepResult === null) {
                    statMsg = "[EdgarStatProcWorker.ts] Critical failure (step result was null)";
                }
                else if (stepResult.status === "success") {
                    statMsg = "Success";
                }
                else {
                    statMsg =
                        `[EdgarStatProcWorker.ts] Job step failed with status ${stepResult.status} ` +
                            `(step implementation: ${jobStep.constructor.name})` +
                            `
                    Time: ${new Date().toISOString()}
                    Reason: ${stepResult.reason}
                    `;
                }
                yield transaction.doQuery(`UPDATE job_step
                    SET (finished_on, job_step_status, job_step_status_message) = (CURRENT_TIMESTAMP, $1, $2)
                    WHERE id = $3;`, [
                    /* $1 */ getStepResultDBEnumValue(stepResult),
                    /* $2 */ statMsg,
                    /* $3 */ jobStep.stepRunId,
                ]);
                yield transaction.commit();
            }
            catch (err) {
                console.log(err);
            }
            finally {
                if (!transaction.isFinished()) {
                    yield transaction.rollback();
                }
            }
        });
    }
    getExecutionResultTyped() {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    /*@RegisterDelegateToRegistry(
        "JobWorker",
        EdgarStatsProcessingConstants.JOB_WORKER_REGISTRY_ENTRY
    )*/
    create(config, ...ctorArgs) {
        const dbConn = DatabaseConnectionRegistry.instance.getItem(config.databaseConnection);
        if (dbConn === null) {
            FrameworkLogger.error(EdgarStatProcWorker, "Unable to fetch database connection");
            throw new Error("Unable to fetch database connection");
        }
        return new EdgarStatProcWorker(dbConn);
    }
}
const impl = {
    namespace: EdgarStatsProcessingConstants.JOB_WORKER_REGISTRY_ENTRY.split("/")[0],
    name: EdgarStatsProcessingConstants.JOB_WORKER_REGISTRY_ENTRY.split("/")[1],
    registry: "JobWorker",
    creationFunction(config, ...ctorArgs) {
        const dbConn = DatabaseConnectionRegistry.instance.getItem(config.databaseConnection);
        if (dbConn === null) {
            FrameworkLogger.error(EdgarStatProcWorker, "Unable to fetch database connection");
            throw new Error("Unable to fetch database connection");
        }
        return new EdgarStatProcWorker(dbConn);
    }
};
export default impl;
