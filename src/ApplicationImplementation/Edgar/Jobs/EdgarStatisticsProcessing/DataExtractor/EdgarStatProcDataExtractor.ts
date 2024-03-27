import { AbstractGenericInputDataExtractor } from "../../../../../ApplicationModel/Jobs/DataExtractors/AbstractGenericInputDataExtractor.js";
import { CourseBasedBatch } from "../../../Batches/CourseBasedBatch.js";
import { EdgarStatProcJobConfiguration } from "../Provider/EdgarStatProcJobConfiguration.js";

export class EdgarStatProcDataExtractor
    extends AbstractGenericInputDataExtractor<EdgarStatProcJobConfiguration, object> {

    protected override async formatJobInputTyped(jobConfiguration: EdgarStatProcJobConfiguration): Promise<object> {
        const serObj = {};

        await jobConfiguration.inputExtractorConfig.configContent.serializeInto(serObj);

        return serObj;
    }
}
