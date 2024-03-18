import { AbstractGenericJobInputFormatter } from "../../../../../ApplicationModel/Jobs/InputFormatters/AbstractGenericJobInputFormatter.js";
import { CourseBasedBatch } from "../../../Batches/CourseBasedBatch.js";
import { EdgarStatProcJobConfiguration } from "../Provider/EdgarStatProcJobConfiguration.js";

export class EdgarStatProcInputFormatter
    extends AbstractGenericJobInputFormatter<EdgarStatProcJobConfiguration, CourseBasedBatch, object> {

    protected override async formatJobInputTyped(jobConfiguration: EdgarStatProcJobConfiguration): Promise<object> {
        const serObj = {};

        await jobConfiguration.courseBasedBatch.serializeInto(serObj);

        return serObj;
    }

    protected override async formatInputTyped(input: CourseBasedBatch | null): Promise<object | null> {
        if (input === null) {
            return null;
        }

        const serObj = {};

        await input.serializeInto(serObj);

        return serObj;
    }
}
