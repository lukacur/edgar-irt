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
import { EdgarStatProcJobConfiguration } from "../../dist/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Provider/EdgarStatProcJobConfiguration.js";
import { RegistryDefaultConstants } from "../../dist/PluginSupport/RegistryDefault.constants.js";
export class EdgarStatisticsProcessingJobRequestParser {
    static fromStatisticsProcessingRequest(returnType, startJobReq, calculationsValidFor, calculationConfig, jobQueue, jobName, jobTimeoutMs = 200000, stalenessCheckTimeoutPerc = 0.1, statProcessingTimeoutPerc = 0.7) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const statProcReq = startJobReq.request;
            let remainingJobTime = (_a = startJobReq.jobMaxTimeoutMs) !== null && _a !== void 0 ? _a : jobTimeoutMs;
            const ieConfig = {
                databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
                idCourse: statProcReq.idCourse,
                idStartAcademicYear: statProcReq.idStartAcademicYear,
                numberOfIncludedPreviousYears: statProcReq.numberOfIncludedPreviousYears,
            };
            const cicnsConfig = {
                calculationsValidFor,
                forceCalculation: statProcReq.forceCalculation,
                databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
            };
            const dpConfig = {
                databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
            };
            const jobSteps = [];
            if (!statProcReq.forceCalculation) {
                jobSteps.push({
                    type: EdgarStatsProcessingConstants.STALENESS_CHECK_STEP_ENTRY,
                    configContent: cicnsConfig,
                    isCritical: true,
                    stepTimeoutMs: stalenessCheckTimeoutPerc * jobTimeoutMs,
                });
                remainingJobTime -= (stalenessCheckTimeoutPerc * (1 - jobTimeoutMs));
            }
            if (!calculationConfig.useJudge0) {
                const statCalcConfig = {
                    calculationScriptAbsPath: calculationConfig.scriptPath,
                    outputFile: calculationConfig.outputFile,
                    inputJSONInfoAbsPath: calculationConfig.generatedJSONInputPath,
                };
                jobSteps.push({
                    type: EdgarStatsProcessingConstants.STATISTICS_CALCULATION_STEP_ENTRY,
                    configContent: statCalcConfig,
                    isCritical: true,
                    stepTimeoutMs: statProcessingTimeoutPerc * 0.7 * jobTimeoutMs,
                });
            }
            else {
                const statCalcConfig = {
                    judge0ServerAddress: calculationConfig.endpoint,
                    languageId: calculationConfig.langId,
                    stdin: calculationConfig.stdin,
                    statisticsScriptPath: calculationConfig.statisticsScriptPath,
                    judge0Authentication: calculationConfig.authentication,
                    judge0Authorization: calculationConfig.authorization,
                };
                jobSteps.push({
                    type: EdgarStatsProcessingConstants.JUDGE0_STATISTICS_CALCULATION_STEP_ENTRY,
                    configContent: statCalcConfig,
                    isCritical: true,
                    stepTimeoutMs: statProcessingTimeoutPerc * 0.7 * jobTimeoutMs,
                });
            }
            const irtCalcConfig = {
                jobId: null
            };
            jobSteps.push({
                type: EdgarStatsProcessingConstants.CALCULATE_IRT_PARAMETERS_STEP_ENTRY,
                configContent: irtCalcConfig,
                isCritical: true,
                stepTimeoutMs: statProcessingTimeoutPerc * 0.2 * jobTimeoutMs,
            });
            const classificationConfig = {};
            jobSteps.push({
                type: EdgarStatsProcessingConstants.CLASSIFY_QUESTION_STEP_ENTRY,
                configContent: classificationConfig,
                isCritical: true,
                stepTimeoutMs: statProcessingTimeoutPerc * 0.1 * jobTimeoutMs,
            });
            remainingJobTime -= (statProcessingTimeoutPerc * (1 - statProcessingTimeoutPerc));
            const genericJobConfig = {
                jobId: undefined,
                jobName: jobName !== null && jobName !== void 0 ? jobName : `Edgar statistics processing job started @ ${new Date().toISOString()}`,
                jobTypeAbbrevation: "STATPROC",
                periodical: startJobReq.periodical,
                userNote: (_b = startJobReq.userNote) !== null && _b !== void 0 ? _b : null,
                idUserStarted: (_c = startJobReq.idUserRequested) !== null && _c !== void 0 ? _c : null,
                jobTimeoutMs,
                jobQueue,
                blockingConfig: {
                    awaitDataExtraction: true,
                    persistResultInBackground: false,
                    workInBackground: false,
                },
                inputExtractorConfig: {
                    type: EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY,
                    configContent: ieConfig,
                },
                jobWorkerConfig: {
                    type: EdgarStatsProcessingConstants.JOB_WORKER_REGISTRY_ENTRY,
                    databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
                    steps: jobSteps,
                },
                dataPersistorConfig: {
                    type: EdgarStatsProcessingConstants.DATA_PERSISTOR_REGISTRY_ENTRY,
                    persistanceTimeoutMs: remainingJobTime,
                    configContent: dpConfig,
                },
            };
            if (returnType === "strict") {
                return yield EdgarStatProcJobConfiguration.fromGenericJobConfig(genericJobConfig);
            }
            else if (returnType === "generic") {
                return genericJobConfig;
            }
            return undefined;
        });
    }
    fromJobRequest(request) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield EdgarStatisticsProcessingJobRequestParser.fromStatisticsProcessingRequest("generic", request.startJobReq, request.calculationsValidFor, request.calculationConfig, request.jobQueue, request.jobName, request.jobTimeoutMs, request.stalenessCheckTimeoutPerc, request.statProcessingTimeoutPerc);
        });
    }
}
const impl = {
    namespace: EdgarStatsProcessingConstants.JOB_REQUEST_PARSER_ENTRY.split("/")[0],
    name: EdgarStatsProcessingConstants.JOB_REQUEST_PARSER_ENTRY.split("/")[1],
    registry: "JobRequestParser",
    creationFunction(...args) {
        return new EdgarStatisticsProcessingJobRequestParser();
    }
};
export default impl;
