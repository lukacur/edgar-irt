import { AbstractGenericJobInputFormatter } from "../../../../../ApplicationModel/Jobs/InputFormatters/AbstractGenericJobInputFormatter.js";
import { EdgarStatProcJobConfiguration } from "../Provider/EdgarStatProcJobConfiguration.js";

export class EdgarStatProcInputFormatter
    extends AbstractGenericJobInputFormatter<EdgarStatProcJobConfiguration, object> {

    protected async formatJobInputTyped(jobConfiguration: EdgarStatProcJobConfiguration): Promise<object> {
        const serObj = {};

        await jobConfiguration.courseBasedBatch.serializeInto(serObj);

        return serObj;
    }
}
