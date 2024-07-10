var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { CourseBasedBatch } from "../../dist/ApplicationImplementation/Edgar/Batches/CourseBasedBatch.js";
import { EdgarStatsProcessingConstants } from "../../dist/ApplicationImplementation/Edgar/EdgarStatsProcessing.constants.js";
import { StatProcessingJobBatchCache } from "../../dist/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/StatProcessingJobBatchCache.js";
import { AbstractGenericInputDataExtractor } from "../../dist/ApplicationModel/Jobs/DataExtractors/AbstractGenericInputDataExtractor.js";
import { FrameworkLogger } from "../../dist/Logger/FrameworkLogger.js";
import { DatabaseConnectionRegistry } from "../../dist/PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
export class EdgarStatProcDataExtractor extends AbstractGenericInputDataExtractor {
    formatJobInputTyped(jobConfiguration) {
        return __awaiter(this, void 0, void 0, function* () {
            const serObj = {};
            yield jobConfiguration.inputExtractorConfig.configContent.serializeInto(serObj);
            StatProcessingJobBatchCache.instance.cacheJobBatch(jobConfiguration.jobId, jobConfiguration.inputExtractorConfig.configContent);
            return serObj;
        });
    }
}
const impl = {
    namespace: EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY.split("/")[0],
    name: EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY.split("/")[1],
    registry: "InputDataExtractor",
    creationFunction(...args) {
        return new class extends AbstractGenericInputDataExtractor {
            formatJobInputTyped(jobConfiguration) {
                return __awaiter(this, void 0, void 0, function* () {
                    const extractorConfiguration = jobConfiguration.inputExtractorConfig;
                    if (extractorConfiguration.type !== EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY) {
                        throw new Error("The factory can't handle the request: provided inputExtractorConfig type property has value" +
                            `${extractorConfiguration.type}, but expected value was` +
                            `${EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY}`);
                    }
                    const configContent = extractorConfiguration.configContent;
                    const serObj = {};
                    const dbConn = DatabaseConnectionRegistry.instance.getItem(configContent.databaseConnection);
                    if (dbConn === null) {
                        FrameworkLogger.error(EdgarStatProcDataExtractor, "Unable to fetch database connection");
                        throw new Error("Unable to fetch database connection");
                    }
                    const batch = new CourseBasedBatch(dbConn, configContent.idCourse, configContent.idStartAcademicYear, configContent.numberOfIncludedPreviousYears);
                    yield batch.serializeInto(serObj);
                    StatProcessingJobBatchCache.instance.cacheJobBatch(jobConfiguration.jobId, batch);
                    return serObj;
                });
            }
        };
    }
};
export default impl;
