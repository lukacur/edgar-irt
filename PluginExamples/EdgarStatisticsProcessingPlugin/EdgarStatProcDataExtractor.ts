import { CourseBasedBatch } from "../../src/ApplicationImplementation/Edgar/Batches/CourseBasedBatch.js";
import { EdgarStatsProcessingConstants } from "../../src/ApplicationImplementation/Edgar/EdgarStatsProcessing.constants.js";
import { EdgarStatProcDataExtractorConfiguration } from "../../src/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/DataExtractor/EdgarStatProcDataExtractorConfiguration.js";
import { EdgarStatProcJobConfiguration } from "../../src/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Provider/EdgarStatProcJobConfiguration.js";
import { StatProcessingJobBatchCache } from "../../src/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/StatProcessingJobBatchCache.js";
import { DatabaseConnection } from "../../src/ApplicationModel/Database/DatabaseConnection.js";
import { AbstractGenericInputDataExtractor } from "../../src/ApplicationModel/Jobs/DataExtractors/AbstractGenericInputDataExtractor.js";
import { IJobConfiguration, InputExtractorConfig } from "../../src/ApplicationModel/Jobs/IJobConfiguration.js";
import { FrameworkLogger } from "../../src/Logger/FrameworkLogger.js";
import { IRegistryPlugin } from "../../src/PluginSupport/IRegistryPlugin.js";
import { DatabaseConnectionRegistry } from "../../src/PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";

export class EdgarStatProcDataExtractor
    extends AbstractGenericInputDataExtractor<EdgarStatProcJobConfiguration, object> {

    protected override async formatJobInputTyped(jobConfiguration: EdgarStatProcJobConfiguration): Promise<object> {
        const serObj = {};

        await jobConfiguration.inputExtractorConfig.configContent.serializeInto(serObj);
        StatProcessingJobBatchCache.instance.cacheJobBatch(
            jobConfiguration.jobId,
            jobConfiguration.inputExtractorConfig.configContent
        );

        return serObj;
    }
}

const impl: IRegistryPlugin = {
    namespace: EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY.split("/")[0],
    name: EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY.split("/")[1],
    registry: "InputDataExtractor",
    creationFunction(...args: any[]): object {
        return new class extends AbstractGenericInputDataExtractor<IJobConfiguration, any> {
            protected async formatJobInputTyped(jobConfiguration: IJobConfiguration): Promise<any> {
                const extractorConfiguration = 
                    jobConfiguration.inputExtractorConfig as
                        InputExtractorConfig<EdgarStatProcDataExtractorConfiguration>;

                if (extractorConfiguration.type !== EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY) {
                    throw new Error(
                        "The factory can't handle the request: provided inputExtractorConfig type property has value" +
                            `${extractorConfiguration.type}, but expected value was` +
                            `${EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY}`
                    );
                }

                const configContent = extractorConfiguration.configContent;
                const serObj = {};

                const dbConn: DatabaseConnection | null = DatabaseConnectionRegistry.instance.getItem(
                    configContent.databaseConnection
                );
                if (dbConn === null) {
                    FrameworkLogger.error(EdgarStatProcDataExtractor, "Unable to fetch database connection");
                    throw new Error("Unable to fetch database connection");
                }

                const batch = new CourseBasedBatch(
                    dbConn,
                    configContent.idCourse,
                    configContent.idStartAcademicYear,
                    configContent.numberOfIncludedPreviousYears,
                );

                await batch.serializeInto(serObj);
                StatProcessingJobBatchCache.instance.cacheJobBatch(jobConfiguration.jobId, batch);

                return serObj;
            }
        };
    }
}

export default impl;
