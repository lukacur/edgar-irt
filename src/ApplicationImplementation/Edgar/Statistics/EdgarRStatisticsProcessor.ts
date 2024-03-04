import { execFile } from "child_process";
import { AbstractItemParticipant } from "../../../ApplicationModel/Participant/AbstractItemParticipant.js";
import { AbstractStatisticsProcessor } from "../../../ApplicationModel/StatisticsProcessor/AbstractStatisticsProcessor.js";
import { IDistributionFunction } from "../../../Functions/IDistributionFunction.js";
import { IItem } from "../../../IRT/Item/IItem.js";
import { DelayablePromise } from "../../../Util/DelayablePromise.js";
import { readFile, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";

type RCalculationResult = {
    maxScore: number,
    scoreAverage: number,
    scoreStdDev: number,
    scoreNtiles: number[] | null,
    scoreQuartiles: [number, number, number, number],
    scoreMedian: number,
    nBestParticipants: AbstractItemParticipant[],
    nWorstParticipants: AbstractItemParticipant[],
    gaussianDistrib: IDistributionFunction,
};

type CalculationParams = {
    nBestParts: number | null,
    nWorstParts: number | null,
    scoreNtiles: number | null,
};

type AvailableCalculationMethods = "irt";

export class EdgarRStatisticsProcessor<
    TItem extends (IItem & { serializeInto: (obj: any) => Promise<void> })
>
extends AbstractStatisticsProcessor {
    private calcResultCache: RCalculationResult | null = null;

    constructor(
        private readonly calculationScriptAbsPath: string,
        private readonly inputJSONInfoAbsPath: string,
        private readonly calculationMethod: AvailableCalculationMethods,

        item: TItem | null,

        private readonly executionTimeoutMs: number,

        private readonly outputFile: string | null,
    ) {
        super(item);
    }

    private async calculate(
        cacheResult: boolean,
        params: CalculationParams | null = null,
    ): Promise<RCalculationResult | null> {
        const delProm = new DelayablePromise<RCalculationResult>();
        const childProcArgs: string[] = [];
        
        if (params !== null) {
            for (const paramKey in params) {
                const keyValue = params[(<keyof CalculationParams>paramKey)];
                if (keyValue !== null) {
                    childProcArgs.push(`--${paramKey}`);
                    childProcArgs.push(keyValue.toString());
                }
            }
        }

        let childProcJSONInput = this.inputJSONInfoAbsPath;
        let childProcJSONOutput = this.outputFile;
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

        const serObj = {
            calculationMethod: this.calculationMethod
        };
        await (<TItem>this.item).serializeInto(serObj);

        await writeFile(
            childProcJSONInput,
            JSON.stringify(serObj),
            { encoding: "utf-8" }
        );

        const childProc = execFile(
            "rscript",
            [
                "--vanilla",
                `"${this.calculationScriptAbsPath}"`,
                "--inFile", `"${childProcJSONInput}"`,
                ...((this.outputFile === null) ? [] : ["--outFile", `"${childProcJSONOutput}"`]),
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
            this.executionTimeoutMs
        );

        try {
            const calcResult = await delProm.getWrappedPromise();
            clearTimeout(execTimeout);
    
            if (cacheResult) {
                this.calcResultCache = calcResult;
            }
    
            return calcResult;
        } catch (err) {
            clearTimeout(execTimeout);
            console.log(err);
            return null;
        } finally {
            await unlink(childProcJSONInput);
            if (childProcJSONOutput !== null && existsSync(childProcJSONOutput)) {
                await unlink(childProcJSONOutput);
            }
        }
    }

    private async calculateIfCacheEmpty(
        forceRecalculate: boolean = false,
        params?: CalculationParams,
    ): Promise<void> {
        if (this.calcResultCache === null || forceRecalculate) {
            await this.calculate(true, params);
        }
    }

    public async getMaxScore(): Promise<number> {
        await this.calculateIfCacheEmpty();

        const res = this.calcResultCache?.maxScore;
        if (res === undefined || res === null) {
            throw new Error("Unable to calculate requested info using specified R script");
        }

        return res;
    }
    
    public async getScoreAverage(): Promise<number> {
        await this.calculateIfCacheEmpty();

        const res = this.calcResultCache?.scoreAverage;
        if (res === undefined || res === null) {
            throw new Error("Unable to calculate requested info using specified R script");
        }

        return res;
    }

    public async getScoreStdDev(): Promise<number> {
        await this.calculateIfCacheEmpty();

        const res = this.calcResultCache?.scoreStdDev;
        if (res === undefined || res === null) {
            throw new Error("Unable to calculate requested info using specified R script");
        }

        return res;
    }

    public async getScoreNtiles(ntile: number): Promise<number[] | null> {
        await this.calculateIfCacheEmpty(
            true,
            {
                scoreNtiles: ntile,
                nBestParts: null,
                nWorstParts: null,
            }
        );

        const res = this.calcResultCache?.scoreNtiles;
        if (res === undefined || res === null) {
            throw new Error("Unable to calculate requested info using specified R script");
        }

        return res;
    }

    public async getScoreQuartiles(): Promise<[number, number, number, number]> {
        await this.calculateIfCacheEmpty();

        const res = this.calcResultCache?.scoreQuartiles;
        if (res === undefined || res === null) {
            throw new Error("Unable to calculate requested info using specified R script");
        }

        return res;
    }

    public async getScoreMedian(): Promise<number> {
        await this.calculateIfCacheEmpty();

        const res = this.calcResultCache?.scoreMedian;
        if (res === undefined || res === null) {
            throw new Error("Unable to calculate requested info using specified R script");
        }

        return res;
    }

    public async getNBestParticipants(n: number): Promise<AbstractItemParticipant[]> {
        await this.calculateIfCacheEmpty(
            true,
            {
                scoreNtiles: null,
                nBestParts: n,
                nWorstParts: null,
            }
        );

        const res = this.calcResultCache?.nBestParticipants;
        if (res === undefined || res === null) {
            throw new Error("Unable to calculate requested info using specified R script");
        }

        return res;
    }

    public async getNWorstParticipants(n: number): Promise<AbstractItemParticipant[]> {
        await this.calculateIfCacheEmpty(
            true,
            {
                scoreNtiles: null,
                nBestParts: null,
                nWorstParts: n,
            }
        );

        const res = this.calcResultCache?.nWorstParticipants;
        if (res === undefined || res === null) {
            throw new Error("Unable to calculate requested info using specified R script");
        }

        return res;
    }

    public async getGaussianDistrib(): Promise<IDistributionFunction> {
        await this.calculateIfCacheEmpty();

        const res = this.calcResultCache?.gaussianDistrib;
        if (res === undefined || res === null) {
            throw new Error("Unable to calculate requested info using specified R script");
        }

        return res;
    }

    public createNew(item: TItem): AbstractStatisticsProcessor {
        return new EdgarRStatisticsProcessor(
            this.calculationScriptAbsPath,
            this.inputJSONInfoAbsPath,
            this.calculationMethod,

            item,

            this.executionTimeoutMs,

            this.outputFile,
        );
    }
}
