import { RegistryDefaultConstants } from "../../../../PluginSupport/RegistryDefault.constants.js";
import { RegisterDelegateToRegistry } from "../../../Decorators/Registration.decorator.js";
import { AbstractGenericJobStep } from "../../AbstractGenericJobStep.js";
import { JobStepDescriptor } from "../../IJobConfiguration.js";
import { StepResult } from "../../IJobStep.js";

type InsertObjectConfiguration = { objectToInsert: object; };

export class InsertObjectJobStep extends AbstractGenericJobStep<InsertObjectConfiguration, object, object> {
    protected async runTyped(_: (object | null)[]): Promise<StepResult<object>> {
        return {
            status: "success",
            result: this.stepConfiguration.objectToInsert,
            isCritical: this.isCritical,
            resultTTLSteps: this.resultTTL,
        };
    }

    @RegisterDelegateToRegistry(
        "JobStep",
        RegistryDefaultConstants.jobSteps.INSERT_OBJECT,
    )
    public create(stepDescriptor: JobStepDescriptor, ...args: any[]): object {
        return new InsertObjectJobStep(
            stepDescriptor.stepTimeoutMs,
            <InsertObjectConfiguration>stepDescriptor.configContent,
            stepDescriptor.isCritical,
            stepDescriptor.resultTTL,
        )
    }
}
