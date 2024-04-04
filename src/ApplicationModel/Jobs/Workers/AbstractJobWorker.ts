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

    protected abstract initStepsToDB(jobConfig: IJobConfiguration): Promise<void>;

    public async startExecution(jobConfiguration: IJobConfiguration, initialInput: TJobStepInput | null): Promise<boolean> {
        if (jobConfiguration.getJobSteps === undefined) {
            throw new Error("Job was not properly constructed: job config object is missing getJobSteps method");
        }

        this.jobSteps.splice(0, this.jobSteps.length);
        this.jobSteps.push(...(await jobConfiguration.getJobSteps()));

        await this.initStepsToDB(jobConfiguration);

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
            this.lastStepResult === undefined ||
                (!!this.lastStepResult &&
                    (this.lastStepResult.status === "success" || !this.lastStepResult.isCritical)
                )
        ) && this.currentStepIdx < this.jobSteps.length;
    }

    public getNextStepInfo(): IJobStep | null {
        if (!this.hasNextStep()) {
            return null;
        }

        return this.jobSteps[this.currentStepIdx];
    }

    protected abstract startStepDB(jobStep: IJobStep): Promise<void>;

    public async executeNextStep(): Promise<boolean> {
        const jobStep = this.getNextStepInfo();

        if (jobStep === null) {
            return false;
        }

        await this.startStepDB(jobStep);

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

            for (const idx of (stepResult?.consumedInputIndexes ?? [])) {
                this.currentStepInput.splice(idx, 1);
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

            await this.saveJobStepResultToDB(jobStep, stepResult);

            return true;
        } catch (err) {
            console.log(err);
            this.currentStepIdx = this.jobSteps.length;
        }

        return false;
    }

    protected abstract saveJobStepResultToDB(
        jobStep: IJobStep,
        stepResult: StepResult<TJobOutput> | null
    ): Promise<void>;

    protected abstract getExecutionResultTyped(): Promise<StepResult<TJobOutput> | null>;

    public async getExecutionResult(): Promise<StepResult<object> | null> {
        if (this.hasNextStep() || this.lastStepResult?.status !== "success") {
            return (
                this.lastStepResult !== undefined &&
                this.lastStepResult !== null &&
                this.lastStepResult.status !== "success"
            ) ? this.lastStepResult : null;
        }

        return await this.getExecutionResultTyped();
    }
}
