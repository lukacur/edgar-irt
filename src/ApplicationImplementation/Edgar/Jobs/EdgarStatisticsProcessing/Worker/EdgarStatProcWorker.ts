import { existsSync } from "fs";
import { AbstractJobWorker } from "../../../../../ApplicationModel/Jobs/Workers/AbstractJobWorker.js";
import { DelayablePromise } from "../../../../../Util/DelayablePromise.js";
import { IRCalculationResult } from "../../../Statistics/IRCalculationResult.js";
import { EdgarStatProcJobStep } from "../Provider/EdgarStatProcJobStep.js";
import { EdgarStatProcStepConfiguration } from "../Provider/EdgarStatProcStepConfiguration.js";
import { readFile, unlink, writeFile } from "fs/promises";
import { execFile } from "child_process";

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
        preparedScriptInput: object,

        cacheResult: boolean,
        params: CalculationParams | null = null,
    ): Promise<IRCalculationResult | null> {
        /*const delProm = new DelayablePromise<IRCalculationResult>();
        const childProcArgs: string[] = [];

        const stepConfig = jobStep.stepConfiguration;
        
        if (params !== null) {
            for (const paramKey in params) {
                const keyValue = params[(<keyof CalculationParams>paramKey)];
                if (keyValue !== null) {
                    childProcArgs.push(`--${paramKey}`);
                    childProcArgs.push(keyValue.toString());
                }
            }
        }

        let childProcJSONInput = stepConfig.inputJSONInfoAbsPath;
        let childProcJSONOutput = stepConfig.outputFile;
        const replaceRegex = /_?\d*\.json/;

        let counter = 0;
        while (existsSync(childProcJSONInput)) {
            ++counter;
            childProcJSONInput = childProcJSONInput.replace(replaceRegex, `_${counter}.json`);
        }

        counter = 0;
        while (childProcJSONOutput !== null && existsSync(childProcJSONOutput)) {
            ++counter;
            childProcJSONOutput = childProcJSONOutput.replace(replaceRegex, `_${counter}.json`);
        }

        await writeFile(
            childProcJSONInput,
            JSON.stringify([preparedScriptInput]),
            { encoding: "utf-8" }
        );

        const childProc = execFile(
            "rscript",
            [
                "--vanilla",
                `"${stepConfig.calculationScriptAbsPath}"`,
                "--inFile", `"${childProcJSONInput}"`,
                ...((stepConfig.outputFile === null) ? [] : ["--outFile", `"${childProcJSONOutput}"`]),
                ...childProcArgs,
            ],
            { shell: true, windowsHide: true },
            async (err, scriptStdout, scriptStderr) => {
                if (err) {
                    await delProm.delayedReject(err);
                    return;
                }

                if (childProcJSONOutput === null) {
                    await delProm.delayedResolve(JSON.parse(scriptStdout));
                } else {
                    if (!existsSync(childProcJSONOutput)) {
                        delProm.delayedReject(new Error("Output file not generated. Perhaps an error occured?"));
                        return;
                    }

                    const outFileJSONContent = await readFile(
                        childProcJSONOutput,
                        { encoding: "utf-8" }
                    );

                    await delProm.delayedResolve(JSON.parse(outFileJSONContent));
                }
            }
        );

        const execTimeout = setTimeout(
            () => {
                childProc.kill("SIGINT");
                delProm.delayedReject("Calculation timed out");
            },
            jobStep.stepTimeoutMs
        );*/

        try {
            /*const calcResult = await delProm.getWrappedPromise();
            clearTimeout(execTimeout);
    
            if (cacheResult) {
                this.calcResultCache = calcResult;
            }
    
            return calcResult;*/

            const calcResult = await jobStep.runTyped(preparedScriptInput);

            if (cacheResult) {
                this.calcResultCache = calcResult
            }

            return calcResult
        } catch (err) {
            // clearTimeout(execTimeout);
            console.log(err);
            return null;
        }/* finally {
            await unlink(childProcJSONInput);
            if (childProcJSONOutput !== null && existsSync(childProcJSONOutput)) {
                await unlink(childProcJSONOutput);
            }
        }*/
    }

    private async calculateIfCacheEmpty(
        jobStep: EdgarStatProcJobStep,
        preparedScriptInput: object,

        forceRecalculate: boolean = false,
        params?: CalculationParams,
    ): Promise<void> {
        if (this.calcResultCache === null || forceRecalculate) {
            await this.calculate(
                jobStep,
                preparedScriptInput,
                
                true,
                params
            );
        }
    }

    protected override async executeStep(
        jobStep: EdgarStatProcJobStep,
        stepInput: object | null
    ): Promise<IRCalculationResult | null> {
        if (stepInput === null) {
            throw new Error("Step input must be specified");
        }

        await this.calculateIfCacheEmpty(
            jobStep,
            stepInput,
        );

        return this.calcResultCache;
    }

    protected override async getExecutionResultTyped(): Promise<IRCalculationResult | null> {
        return this.calcResultCache;
    }
}
