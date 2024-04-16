import { RegisterFactoryToRegistry } from "../../../../../ApplicationModel/Decorators/Registration.decorator.js";
import { AbstractGenericInputDataExtractor } from "../../../../../ApplicationModel/Jobs/DataExtractors/AbstractGenericInputDataExtractor.js";
import { IJobConfiguration, InputExtractorConfig } from "../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { GenericFactory } from "../../../../../PluginSupport/GenericFactory.js";
import { DatabaseConnectionRegistry } from "../../../../../PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { CourseBasedBatch } from "../../../Batches/CourseBasedBatch.js";
import { EdgarStatsProcessingConstants } from "../../../EdgarStatsProcessing.constants.js";
import { EdgarStatProcJobConfiguration } from "../Provider/EdgarStatProcJobConfiguration.js";
import { StatProcessingJobBatchCache } from "../StatProcessingJobBatchCache.js";
import { EdgarStatProcDataExtractorConfiguration } from "./EdgarStatProcDataExtractorConfiguration.js";

@RegisterFactoryToRegistry(
    "InputDataExtractor",
    EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY,
)
export class EdgarStatProcDataExtractor
    extends AbstractGenericInputDataExtractor<EdgarStatProcJobConfiguration, object>
    implements GenericFactory {

    protected override async formatJobInputTyped(jobConfiguration: EdgarStatProcJobConfiguration): Promise<object> {
        const serObj = {};

        await jobConfiguration.inputExtractorConfig.configContent.serializeInto(serObj);
        StatProcessingJobBatchCache.instance.cacheJobBatch(
            jobConfiguration.jobId,
            jobConfiguration.inputExtractorConfig.configContent
        );

        return serObj;
    }

    public create(...args: any[]): object {
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

                const batch = new CourseBasedBatch(
                    DatabaseConnectionRegistry.instance.getItem(configContent.databaseConnection),
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
