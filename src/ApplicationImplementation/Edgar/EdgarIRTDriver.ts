import { AbstractBatch } from "../../ApplicationModel/Batch/AbstractBatch.js";
import { AbstractIRTDriver } from "../../ApplicationModel/Driver/AbstractIRTDriver.js";
import { AbstractLogisticFunctionParams } from "../../IRT/LogisticFunction/LogisticFunctionTypes.js";
import { EdgarItem } from "./Items/EdgarItem.js";

export class EdgarIRTDriver extends AbstractIRTDriver<EdgarItem> {
    public createBatch(): Promise<AbstractBatch<EdgarItem>> {
        throw new Error("Method not implemented.");
    }
    
    public postResult(batchProcessingResult: Map<EdgarItem, AbstractLogisticFunctionParams>): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    
}
