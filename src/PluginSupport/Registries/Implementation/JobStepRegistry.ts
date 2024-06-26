import { randomUUID } from "crypto";
import { GenericRegistry } from "../GenericRegistry.js";
import { IJobStep } from "../../../ApplicationModel/Jobs/IJobStep.js";

export class JobStepRegistry extends GenericRegistry {
    //#region SingletonHandling
    public static readonly instance = new JobStepRegistry();
    //#endregion

    private constructor() { super(); }

    public override getItem<TReturnObject extends object = IJobStep>(
        ieType: string,
        ...args: any[]
    ): TReturnObject | null {
        const step = <TReturnObject & { stepRunId: string }>super.getItem(ieType, ...args);
        step.stepRunId = randomUUID();

        return step;
    }
}
