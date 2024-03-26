import { AbstractJobWorker } from "../../../../../ApplicationModel/Jobs/Workers/AbstractJobWorker.js";
import { IRCalculationResult } from "../../../Statistics/IRCalculationResult.js";
import { EdgarStatProcJobStep } from "../Steps/StatisticsProcessing/EdgarStatProcJobStep.js";
import { StepResult } from "../../../../../ApplicationModel/Jobs/IJobStep.js";
import { IJobWorker } from "../../../../../ApplicationModel/Jobs/Workers/IJobWorker.js";

type CalculationParams = {
    nBestParts: number | null,
    nWorstParts: number | null,
    scoreNtiles: number | null,
};

export class EdgarStatProcWorker extends AbstractJobWorker<
    object,
    IRCalculationResult
> {
    private calcResultCache: IRCalculationResult | null = null;

    private async calculate(
        jobStep: EdgarStatProcJobStep,
        preparedScriptInput: (object | null)[],

        cacheResult: boolean,
    ): Promise<StepResult<IRCalculationResult> | null> {
        try {
            const calcResult = await jobStep.runTyped(preparedScriptInput);

            if (cacheResult) {
                this.calcResultCache = calcResult.result
            }

            return calcResult;
        } catch (err) {
            console.log(err);
            return null;
        }
    }

    private async calculateIfCacheEmpty(
        jobStep: EdgarStatProcJobStep,
        preparedScriptInput: (object | null)[],

        forceRecalculate: boolean = false,
    ): Promise<StepResult<IRCalculationResult> | null> {
        if (this.calcResultCache === null || forceRecalculate) {
            return await this.calculate(
                jobStep,
                preparedScriptInput,
                
                true,
            );
        } else {
            return {
                status: "success",
                result: this.calcResultCache,
            };
        }
    }

    protected override async executeStep(
        jobStep: EdgarStatProcJobStep,
        stepInput: (object | null)[]
    ): Promise<StepResult<IRCalculationResult> | null> {
        return await this.calculateIfCacheEmpty(
            jobStep,
            stepInput,
            true,
        );
    }

    protected override async getExecutionResultTyped(): Promise<StepResult<IRCalculationResult> | null> {
        return this.calcResultCache === null ?
        {
            status: "failure",
            reason: "No result",
            result: null,
        } :
        {
            status: "success",
            result: this.calcResultCache,
        };
    }
    
    public override clone(): IJobWorker {
        return new EdgarStatProcWorker();
    }
}
