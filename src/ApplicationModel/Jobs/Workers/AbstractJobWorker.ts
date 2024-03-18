import { IJobConfiguration } from "../IJobConfiguration.js";
import { IJobStep } from "../IJobStep.js";
import { IJobWorker } from "./IJobWorker.js";

export abstract class AbstractJobWorker<
    TJobStepInput extends object,
    TJobOutput extends object
> implements IJobWorker {
    private currentStepIdx: number = 0;
    private currentStepInput: object | null = null;

    protected readonly jobSteps: IJobStep[] = [];

    protected abstract executeStep(jobStep: IJobStep, stepInput: object | null): Promise<TJobOutput | null>;

    public async startExecution(jobConfiguration: IJobConfiguration, initialInput: TJobStepInput | null): Promise<boolean> {
        this.jobSteps.splice(0, this.jobSteps.length);
        this.jobSteps.push(...(await jobConfiguration.getJobSteps()));

        this.currentStepIdx = 0;
        this.currentStepInput = initialInput;

        try {
            await this.executeNextStep();
        } catch (err) {
            console.log(err);
            return false;
        }

        return true;
    }

    public hasNextStep(): boolean {
        return this.currentStepIdx < this.jobSteps.length;
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

            this.currentStepInput = await this.executeStep(
                jobStep,
                this.currentStepInput
            );

            return true;
        } catch (err) {
            console.log(err);
            this.currentStepIdx--;
        }

        return false;
    }

    protected abstract getExecutionResultTyped(): Promise<TJobOutput | null>;

    public async getExecutionResult(): Promise<object | null> {
        if (this.hasNextStep()) {
            return null;
        }

        return await this.getExecutionResultTyped();
    }
}
