import { AbstractBatch } from "../../ApplicationModel/Batch/AbstractBatch.js";
import { AbstractIRTDriver } from "../../ApplicationModel/Driver/AbstractIRTDriver.js";
import { AbstractLogisticFunctionParams } from "../../IRT/LogisticFunction/LogisticFunctionTypes.js";
import { CourseBasedBatch } from "./Batches/CourseBasedBatch.js";
import { TestInstanceBasedBatch } from "./Batches/TestInstanceBasedBatch.js";
import { QuestionItem } from "./Items/QuestionItem.js";

// TODO: AbstractIRTDriver can be non-parameterised?
export class EdgarIRTDriver extends AbstractIRTDriver<QuestionItem | CourseBasedBatch | TestInstanceBasedBatch> {
    public createBatch(): Promise<AbstractBatch<QuestionItem | CourseBasedBatch | TestInstanceBasedBatch>> {
        throw new Error("Method not implemented.");
    }
    
    public postResult(batchProcessingResult: Map<QuestionItem, AbstractLogisticFunctionParams>): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
}
