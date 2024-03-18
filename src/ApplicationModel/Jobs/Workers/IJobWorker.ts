import { IJobConfiguration } from "../IJobConfiguration.js";
import { IJobStep } from "../IJobStep.js";

export abstract class AbstractJobWorker {
    private currentStepIdx: number = 0;
    private currentStepInput: object | null = null;

    protected readonly jobSteps: IJobStep[] = [];

    protected abstract executeJobStep(): Promise<object | null>;


    public async startExecution(jobConfiguration: IJobConfiguration, initialInput: object | null): Promise<boolean> {
        this.jobSteps.splice(0, this.jobSteps.length);
        this.jobSteps.push(...jobConfiguration.jobSteps);

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

    protected abstract executeStep(jobStep: IJobStep, stepInput: object | null): Promise<object | null>;

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
}
