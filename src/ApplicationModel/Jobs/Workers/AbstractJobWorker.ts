import { IJobConfiguration } from "../IJobConfiguration.js";
import { IJobStep, StepResult } from "../IJobStep.js";
import { IJobWorker } from "./IJobWorker.js";

export abstract class AbstractJobWorker<
    TJobStepInput extends object,
    TJobOutput extends object
> implements IJobWorker {
    private currentStepIdx: number = 0;
    private currentStepInput: (object & { ttl?: number } | null)[] = [null];

    protected readonly jobSteps: IJobStep[] = [];

    private lastStepResult?: StepResult<TJobOutput> | null = undefined;

    protected abstract executeStep(jobStep: IJobStep, stepInput: (object | null)[]): Promise<StepResult<TJobOutput> | null>;

    public async startExecution(jobConfiguration: IJobConfiguration, initialInput: TJobStepInput | null): Promise<boolean> {
        this.jobSteps.splice(0, this.jobSteps.length);
        this.jobSteps.push(...(await jobConfiguration.getJobSteps()));

        this.currentStepIdx = 0;
        this.currentStepInput = [initialInput];

        try {
            await this.executeNextStep();
        } catch (err) {
            console.log(err);
            return false;
        }

        return true;
    }

    public hasNextStep(): boolean {
        return (
            this.lastStepResult === undefined || !!this.lastStepResult && this.lastStepResult.status === "success"
        ) && this.currentStepIdx < this.jobSteps.length;
    }

    public getNextStepInfo(): IJobStep | null {
        if (!this.hasNextStep()) {
            return null;
        }

        return this.jobSteps[this.currentStepIdx];
    }

    public async executeNextStep(): Promise<boolean> {
        const jobStep = this.getNextStepInfo();

        if (jobStep === null) {
            return false;
        }

        try {
            this.currentStepIdx++;

            const stepResult = await this.executeStep(
                jobStep,
                this.currentStepInput
            );

            if (stepResult?.resultTTLSteps !== undefined) {
                if (stepResult.resultTTLSteps !== -1 && stepResult.resultTTLSteps <= 0) {
                    throw new Error("Invalid TTL range. TTL value should be undefined, -1 or greater than 0");
                }
            }

            this.currentStepInput = this.currentStepInput
                .filter(si => si?.ttl !== undefined && (si.ttl === -1 || si.ttl > 0))
                .map(si => {
                    if (si?.ttl !== undefined && si.ttl !== -1) {
                        si.ttl--;
                    }

                    return si;
                });

            this.lastStepResult = stepResult;

            this.currentStepInput.unshift(
                (stepResult === null) ?
                    null :
                    { ...stepResult.result, ttl: stepResult.resultTTLSteps }
            );

            return true;
        } catch (err) {
            console.log(err);
            this.currentStepIdx--;
        }

        return false;
    }

    protected abstract getExecutionResultTyped(): Promise<StepResult<TJobOutput> | null>;

    public async getExecutionResult(): Promise<StepResult<object> | null> {
        if (this.hasNextStep() || this.lastStepResult?.status !== "success") {
            return null;
        }

        return await this.getExecutionResultTyped();
    }

    public abstract clone(): IJobWorker;
}
