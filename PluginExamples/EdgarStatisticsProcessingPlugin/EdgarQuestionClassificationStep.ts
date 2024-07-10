import { EdgarStatsProcessingConstants } from "../../src/ApplicationImplementation/Edgar/EdgarStatsProcessing.constants.js";
import { EdgarQuestionClassificationStepConfiguration } from "../../src/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Steps/QuestionClassiffication/EdgarQuestionClassificationStepConfiguration.js";
import { QuestionClassificationUtil } from "../../src/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Util/QuestionClassificationUtil.js";
import { QuestionClassification, IExtendedRCalculationResult, QuestionIrtParamInfo } from "../../src/ApplicationImplementation/Edgar/Statistics/IRCalculationResult.js";
import { AbstractGenericJobStep } from "../../src/ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { JobStepDescriptor } from "../../src/ApplicationModel/Jobs/IJobConfiguration.js";
import { StepResult } from "../../src/ApplicationModel/Jobs/IJobStep.js";
import { IRegistryPlugin } from "../../src/PluginSupport/IRegistryPlugin.js";

type ClassificationBounds = {
    [classification in QuestionClassification]: {
        itKnow: [number, number];
        itDiff: [number, number];
        guessProb: [number, number];
        mistProb: [number, number];
    }
};

type BoundType = "inclusive" | "exclusive";

type IrtDistanceTable = {
    levelOfItemKnowledge: Map<QuestionClassification, Map<number, number>>;
    itemDifficulty: Map<QuestionClassification, Map<number, number>>;
    guessProbability: Map<QuestionClassification, Map<number, number>>;
    mistakeProbability: Map<QuestionClassification, Map<number, number>>;
};

type ClassificationByDistance = {
    idQuestion: number,
    distance: number,
    classification: QuestionClassification,
    reclassify: boolean
};

type ClassificationByOrder = {
    idQuestion: number;
    classification: QuestionClassification;
};

export class EdgarQuestionClassificationStep
    extends AbstractGenericJobStep<EdgarQuestionClassificationStepConfiguration, IExtendedRCalculationResult, IExtendedRCalculationResult> {
    private static inBounds(value: number, bounds: [number, number], boundTypes: [BoundType, BoundType]): boolean {
        if (bounds[0] > bounds[1]) {
            throw new Error("Invalid bound definition");
        }

        const lowerOk = (boundTypes[0] === "inclusive") ? value >= bounds[0] : value > bounds[0];
        const upperOk = (boundTypes[1] === "inclusive") ? value <= bounds[1] : value < bounds[1];

        return lowerOk && upperOk;
    }

    private static readonly DEFAULT_BOUND_CHANGE = 0.04;

    private getClassificationFor(
        irtInfo: QuestionIrtParamInfo,
        numberOfQuestionsToClassify: number,
        previousClassifictions: { [classification in QuestionClassification]: number },
        classificationBounds: ClassificationBounds,
    ): QuestionClassification {
        let itKnowClass: QuestionClassification | null = null;
        let itDiffClass: QuestionClassification | null = null;
        let guessProbClass: QuestionClassification | null = null;
        let mistProbClass: QuestionClassification | null = null;

        const params = irtInfo.params;

        for (const classification of (Object.keys(classificationBounds) as QuestionClassification[])) {
            if (itKnowClass !== null && itDiffClass !== null && guessProbClass !== null && mistProbClass !== null) {
                break;
            }

            const lowestClass = QuestionClassificationUtil.instance.isLowestClass(classification);
            const highestClass = QuestionClassificationUtil.instance.isHighestClass(classification);
            const classBounds = classificationBounds[classification];

            const itKnowInBounds = EdgarQuestionClassificationStep.inBounds(
                params.levelOfItemKnowledge, 
                classBounds.itKnow,
                ["inclusive", highestClass ? "inclusive" : "exclusive"],
            );

            if (
                itKnowClass === null &&
                (itKnowInBounds || highestClass && params.levelOfItemKnowledge > classBounds.itKnow[1])
            ) {
                itKnowClass = classification;
            }

            const itDiffInBounds = EdgarQuestionClassificationStep.inBounds(
                params.itemDifficulty, 
                classBounds.itDiff,
                ["inclusive", highestClass ? "inclusive" : "exclusive"],
            );

            if (
                itDiffClass === null &&
                (itDiffInBounds || highestClass && params.itemDifficulty > classBounds.itDiff[1])
            ) {
                itDiffClass = classification;
            }

            const guessProbInBounds = EdgarQuestionClassificationStep.inBounds(
                params.itemGuessProbability,
                classBounds.guessProb,
                ["inclusive", lowestClass ? "inclusive" : "exclusive"],
            );

            if (
                guessProbClass === null &&
                (guessProbInBounds || lowestClass && params.itemGuessProbability > classBounds.guessProb[1])
            ) {
                guessProbClass = classification;
            }

            const mistProbInBounds = EdgarQuestionClassificationStep.inBounds(
                params.itemMistakeProbability,
                classBounds.mistProb,
                ["inclusive", highestClass ? "inclusive" : "exclusive"],
            );

            if (
                mistProbClass === null &&
                (mistProbInBounds || highestClass && params.itemMistakeProbability > classBounds.mistProb[1])
            ) {
                mistProbClass = classification;
            }
        }

        let lowestCountingClass: QuestionClassification | null = null;
        let lowestCountingCount: number | null = null;
        for (const classKey of (Object.keys(previousClassifictions) as QuestionClassification[])) {
            if (lowestCountingClass === null || lowestCountingCount! > previousClassifictions[classKey]) {
                lowestCountingClass = classKey;
                lowestCountingCount = previousClassifictions[classKey];
            }
        }

        const occurancesArr: QuestionClassification[] = [
            itKnowClass ?? lowestCountingClass!,
            itDiffClass ?? lowestCountingClass!,
            guessProbClass ?? lowestCountingClass!,
            mistProbClass ?? lowestCountingClass!,
        ];

        let avgQuestionDifficulty: QuestionClassification | null = null;

        for (const classification of QuestionClassificationUtil.instance.getAvailableClasses()) {
            let occurs = occurancesArr.reduce((acc, el) => acc + (el === classification ? 1 : 0), 0);
            if (occurs >= 3) {
                avgQuestionDifficulty = classification;
                break;
            }
        }

        avgQuestionDifficulty ??= QuestionClassificationUtil.instance.getAverageDifficulty(occurancesArr);

        const classifiedBoundInfo = classificationBounds[avgQuestionDifficulty];
        if (!QuestionClassificationUtil.instance.isLowestClass(avgQuestionDifficulty)) {
            classifiedBoundInfo.itKnow[0] +=
            (
                ((classifiedBoundInfo.itKnow[1] - classifiedBoundInfo.itKnow[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );

            classifiedBoundInfo.itDiff[0] +=
            (
                ((classifiedBoundInfo.itDiff[1] - classifiedBoundInfo.itDiff[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );

            classifiedBoundInfo.guessProb[1] -=
            (
                ((classifiedBoundInfo.guessProb[1] - classifiedBoundInfo.guessProb[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );

            classifiedBoundInfo.mistProb[0] +=
            (
                ((classifiedBoundInfo.mistProb[1] - classifiedBoundInfo.mistProb[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );
        }

        if (!QuestionClassificationUtil.instance.isHighestClass(avgQuestionDifficulty)) {
            classifiedBoundInfo.itKnow[1] -=
            (
                ((classifiedBoundInfo.itKnow[1] - classifiedBoundInfo.itKnow[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );

            classifiedBoundInfo.itDiff[1] -=
            (
                ((classifiedBoundInfo.itDiff[1] - classifiedBoundInfo.itDiff[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );

            classifiedBoundInfo.guessProb[0] +=
            (
                ((classifiedBoundInfo.guessProb[1] - classifiedBoundInfo.guessProb[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );

            classifiedBoundInfo.mistProb[1] -=
            (
                ((classifiedBoundInfo.mistProb[1] - classifiedBoundInfo.mistProb[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );
        }

        return avgQuestionDifficulty;
    }

    private prepareDistanceTable(
        calculatedQuestionIrtParams: QuestionIrtParamInfo[],
    ): IrtDistanceTable {
        const classWeightCenters: { [ClassName in QuestionClassification]: number } = {
            very_easy: 0.1,
            easy: 0.3,
            normal: 0.5,
            hard: 0.7,
            very_hard: 0.9,
        };

        const levelOfItemKnowledgeMap: Map<QuestionClassification, Map<number, number>> = new Map();
        const itemDifficultyMap: Map<QuestionClassification, Map<number, number>> = new Map();
        const guessProbabilityMap: Map<QuestionClassification, Map<number, number>> = new Map();
        const mistakeProbabilityMap: Map<QuestionClassification, Map<number, number>> = new Map();

        const availableClasses = QuestionClassificationUtil.instance.getAvailableClasses();
        for (const difficultyClass of availableClasses) {
            levelOfItemKnowledgeMap.set(difficultyClass, new Map());
            itemDifficultyMap.set(difficultyClass, new Map());
            guessProbabilityMap.set(difficultyClass, new Map());
            mistakeProbabilityMap.set(difficultyClass, new Map());
        }

        for (const irtParams of calculatedQuestionIrtParams) {
            for (const difficultyClass of availableClasses) {
                const cwCenter = classWeightCenters[difficultyClass];

                const loikDelta = Math.abs(irtParams.params.levelOfItemKnowledge - cwCenter);
                const itemDiffDelta = Math.abs(irtParams.params.itemDifficulty - cwCenter);
                const guessProbDelta = Math.abs(irtParams.params.itemGuessProbability - (1 - cwCenter));
                const mistProbDelta = Math.abs(irtParams.params.itemMistakeProbability - cwCenter);

                const loikDeltaTable = levelOfItemKnowledgeMap.get(difficultyClass)!;
                if (!loikDeltaTable.has(irtParams.idQuestion)) {
                    loikDeltaTable.set(irtParams.idQuestion, loikDelta);
                }

                const itemDiffDeltaTable = itemDifficultyMap.get(difficultyClass)!;
                if (!itemDiffDeltaTable.has(irtParams.idQuestion)) {
                    itemDiffDeltaTable.set(irtParams.idQuestion, itemDiffDelta);
                }

                const guessProbDeltaTable = guessProbabilityMap.get(difficultyClass)!;
                if (!guessProbDeltaTable.has(irtParams.idQuestion)) {
                    guessProbDeltaTable!.set(irtParams.idQuestion, guessProbDelta);
                }

                const mistProbDeltaTable = mistakeProbabilityMap.get(difficultyClass)!;
                if (!mistProbDeltaTable.has(irtParams.idQuestion)) {
                    mistProbDeltaTable!.set(irtParams.idQuestion, mistProbDelta);
                }
            }
        }

        return {
            levelOfItemKnowledge: levelOfItemKnowledgeMap,
            itemDifficulty: itemDifficultyMap,
            guessProbability: guessProbabilityMap,
            mistakeProbability: mistakeProbabilityMap,
        };
    }

    private classifyByDistance(
        calculatedQuestionIrtParams: QuestionIrtParamInfo[]
    ): Map<number, QuestionClassification> {
        const distanceTable = this.prepareDistanceTable(calculatedQuestionIrtParams);

        const questionClassificationMap: Map<number, QuestionClassification[]> = new Map();

        const maps = [
            distanceTable.levelOfItemKnowledge,
            distanceTable.itemDifficulty, 
            distanceTable.guessProbability,
            distanceTable.mistakeProbability
        ];

        for (const map of maps) {
            while ([...map.values()].some(vl => vl.size !== 0)) {
                let maxIterCount = 5;
                const byDistanceClassifications: ClassificationByDistance[] = [];

                do {
                    const dontClassifyOn =
                        byDistanceClassifications.filter(cl => !cl.reclassify).map(cl => cl.classification);

                    for (const classification of [...map.keys()].filter(key => !dontClassifyOn.includes(key))) {
                        const previousClassification: ClassificationByDistance | undefined =
                            byDistanceClassifications.find(el => el.classification === classification);
                        const prevMin: number | null = previousClassification?.distance ?? null;

                        const byDistTab = map.get(classification)!;
                        const minDistanceEntry = [...byDistTab.entries()]
                            .reduce<[number, number] | null>(
                                (acc, el) =>
                                    ((prevMin === null || el[1] > prevMin) && (acc === null || el[1] < acc[1])) ?
                                        el : acc,
                                null
                            );
                        if (minDistanceEntry === null) {
                            if ((previousClassification ?? null) !== null) {
                                const idx = byDistanceClassifications.indexOf(previousClassification!);
                                if (idx !== -1) {
                                    byDistanceClassifications.splice(idx, 1);
                                }
                            }
                            continue;
                        }

                        const reclassifyIdx =
                            byDistanceClassifications.findIndex(el => el.idQuestion === minDistanceEntry[0]);

                        let reclassifySelf = false;
                        if (
                            reclassifyIdx !== -1 &&
                                byDistanceClassifications[reclassifyIdx].distance < minDistanceEntry[1]
                        ) {
                            byDistanceClassifications[reclassifyIdx].reclassify = true;
                        } else if (reclassifyIdx !== -1) {
                            reclassifySelf = true;
                        }

                        if ((previousClassification ?? null) === null) {
                            byDistanceClassifications.push({
                                idQuestion: minDistanceEntry[0],
                                distance: minDistanceEntry[1],
                                classification: classification,
                                reclassify: reclassifySelf,
                            });
                        } else {
                            previousClassification!.idQuestion = minDistanceEntry[0];
                            previousClassification!.distance = minDistanceEntry[1];
                            previousClassification!.classification = classification;
                            previousClassification!.reclassify = reclassifySelf;
                        }
                    }
                    maxIterCount--;
                } while (
                    byDistanceClassifications.some(cl => cl.reclassify) &&
                        ([...map.values()][0]?.size ?? 0) >=
                            QuestionClassificationUtil.instance.getAvailableClasses().length &&
                            maxIterCount > 0
                );

                for (const byDistanceClassification of byDistanceClassifications.filter(el => !el.reclassify)) {
                    for (const subMap of map.values()) {
                        subMap.delete(byDistanceClassification.idQuestion);
                    }

                    if (!questionClassificationMap.has(byDistanceClassification.idQuestion)) {
                        questionClassificationMap.set(byDistanceClassification.idQuestion, []);
                    }
                    questionClassificationMap
                        .get(byDistanceClassification.idQuestion)!
                            .push(byDistanceClassification.classification);
                }
            }
        }

        return new Map(
            [...questionClassificationMap.entries()].map(ent => {
                let avgQuestionDifficulty: QuestionClassification | null = null;
                for (const classification of QuestionClassificationUtil.instance.getAvailableClasses()) {
                    let occurs = ent[1].reduce((acc, el) => acc + (el === classification ? 1 : 0), 0);
                    if (occurs >= 3) {
                        avgQuestionDifficulty = classification;
                        break;
                    }
                }

                avgQuestionDifficulty ??= QuestionClassificationUtil.instance.getAverageDifficulty(ent[1]);
                return [ent[0], avgQuestionDifficulty];
            })
        );
    }

    private classifyByOrder(calculatedQuestionIrtParams: QuestionIrtParamInfo[]): Map<number, QuestionClassification> {
        const levelOfItemKnowledgeSorted = calculatedQuestionIrtParams.sort(
            (p1, p2) => p1.params.levelOfItemKnowledge - p2.params.levelOfItemKnowledge
        );
        const itemDifficultySorted = calculatedQuestionIrtParams.sort(
            (p1, p2) => p1.params.itemDifficulty - p2.params.itemDifficulty
        );
        const guessProbabilitySorted = calculatedQuestionIrtParams.sort(
            (p1, p2) => p1.params.itemGuessProbability - p2.params.itemGuessProbability
        );
        const mistakeProbabilitySorted = calculatedQuestionIrtParams.sort(
            (p1, p2) => p1.params.itemMistakeProbability - p2.params.itemMistakeProbability
        );

        const availableClasses = QuestionClassificationUtil.instance.getAvailableClasses();
        const countOfQuestionsToClassify = calculatedQuestionIrtParams.length;
        const numberOfClassificationsByClass = countOfQuestionsToClassify / availableClasses.length;

        const byClassClassificationCount = Math.floor(numberOfClassificationsByClass);
        const remainder = countOfQuestionsToClassify - (byClassClassificationCount * availableClasses.length);

        const info: { readonly inputArr: QuestionIrtParamInfo[], readonly outputArr: ClassificationByOrder[] }[] = [
            { inputArr: levelOfItemKnowledgeSorted, outputArr: [] },
            { inputArr: itemDifficultySorted, outputArr: [] },
            { inputArr: guessProbabilitySorted, outputArr: [] },
            { inputArr: mistakeProbabilitySorted, outputArr: [] },
        ];

        const questionClassificationMap: Map<number, QuestionClassification[]> = new Map();

        let overflow = remainder;
        for (const infoEl of info) {
            let currentClassIdx = 0;
            let currQuestionIdx = 0;

            while (currQuestionIdx < countOfQuestionsToClassify) {
                let currentClassificationCount = 0;
                while (
                    currQuestionIdx < countOfQuestionsToClassify && currentClassificationCount < byClassClassificationCount
                ) {
                    const entry = infoEl.inputArr[currQuestionIdx];
                    infoEl.outputArr.push({
                        idQuestion: entry.idQuestion,
                        classification: availableClasses[currentClassIdx],
                    });

                    if (!questionClassificationMap.has(entry.idQuestion)) {
                        questionClassificationMap.set(entry.idQuestion, []);
                    }
                    questionClassificationMap.get(entry.idQuestion)!.push(availableClasses[currentClassIdx]);

                    currentClassificationCount++;
                    currQuestionIdx++;
                }
    
                if (overflow > 0 && currQuestionIdx < countOfQuestionsToClassify) {
                    const entry = infoEl.inputArr[currQuestionIdx];
                    infoEl.outputArr.push({
                        idQuestion: entry.idQuestion,
                        classification: availableClasses[currentClassIdx],
                    });
                    currQuestionIdx++;
                    overflow--;
                }
    
                currentClassIdx++;
            }
        }

        const questionClassifications: ClassificationByOrder[] = [];

        for (const entry of questionClassificationMap.entries()) {
            let avgQuestionDifficulty: QuestionClassification | null = null;
            const occurancesArr = entry[1];
    
            for (const classification of QuestionClassificationUtil.instance.getAvailableClasses()) {
                let occurs = occurancesArr.reduce((acc, el) => acc + (el === classification ? 1 : 0), 0);
                if (occurs >= 2) {
                    avgQuestionDifficulty = classification;
                    break;
                }
            }
    
            avgQuestionDifficulty ??= QuestionClassificationUtil.instance.getAverageDifficulty(occurancesArr);

            questionClassifications.push({
                idQuestion: entry[0],
                classification: avgQuestionDifficulty,
            });
        }

        const sorted = questionClassifications.sort(
            (c1, c2) =>
                QuestionClassificationUtil.instance.getDifficultyRank(c1.classification) -
                QuestionClassificationUtil.instance.getDifficultyRank(c2.classification)
        );

        let idx = 0;
        let currClass: QuestionClassification;

        overflow = remainder;
        while (idx < sorted.length) {
            let classificationStreak = 0;
            currClass = sorted[idx].classification;
            while (idx < sorted.length && sorted[idx].classification === currClass) {
                idx++;
                classificationStreak++;
            }

            while (classificationStreak < byClassClassificationCount && idx < sorted.length) {
                sorted[idx].classification = currClass;
                idx++;
                classificationStreak++;
            }

            if (overflow > 0 && idx < sorted.length) {
                sorted[idx].classification = currClass;
                idx++;
                overflow--;
            }
        }

        return new Map(sorted.map(el => [el.idQuestion, el.classification]));
    }

    protected async runTyped(
        stepInput: (IExtendedRCalculationResult | null)[]
    ): Promise<StepResult<IExtendedRCalculationResult>> {
        if ((stepInput[0] ?? null) === null) {
            return {
                status: "failure",
                reason: "This step requires an input, but no input was provided" +
                    ` (${EdgarQuestionClassificationStep.name})`,
                result: null,

                isCritical: this.isCritical,
            };
        }

        const input = stepInput[0]!;
        const classificationObj: { [classification in QuestionClassification]: number } = {
            very_easy: 0,
            easy: 0,
            normal: 0,
            hard: 0,
            very_hard: 0,
        };

        const veArr: [number, number] = [0.0, 0.25];
        const eArr: [number, number] = [veArr[1], 0.45];
        const nArr: [number, number] = [eArr[1], 0.55];
        const hArr: [number, number] = [nArr[1], 0.75];
        const vhArr: [number, number] = [hArr[1], 1.0];

        const classificationBounds: ClassificationBounds = {
            very_easy: { itKnow: [...veArr], itDiff: [...veArr], guessProb: [...vhArr], mistProb: [...veArr], },
            easy: { itKnow: [...eArr], itDiff: [...eArr], guessProb: [...hArr], mistProb: [...eArr], },
            normal: { itKnow: [...nArr], itDiff: [...nArr], guessProb: [...nArr], mistProb: [...nArr], },
            hard: { itKnow: [...hArr], itDiff: [...hArr], guessProb: [...eArr], mistProb: [...hArr], },
            very_hard: { itKnow: [...vhArr], itDiff: [...vhArr], guessProb: [...veArr], mistProb: [...vhArr], },
        };

        let classifyBy: "distance" | "order" | "base" = "order" as "distance" | "order" | "base";

        switch (classifyBy) {
            case "distance": {
                const byDistanceClassifications = this.classifyByDistance(input.calculatedIrtParams);
                for (const irtInfo of input.calculatedIrtParams) {
                    irtInfo.questionClassification = byDistanceClassifications.get(irtInfo.idQuestion)!;
                    if ((classificationObj[irtInfo.questionClassification] ?? null) === null) {
                        classificationObj[irtInfo.questionClassification] = 0;
                    }
        
                    classificationObj[irtInfo.questionClassification]++;
                }

                break;
            }

            case "order": {
                const byOrderClassifications = this.classifyByOrder(input.calculatedIrtParams);
                for (const irtInfo of input.calculatedIrtParams) {
                    irtInfo.questionClassification = byOrderClassifications.get(irtInfo.idQuestion)!;
                    if ((classificationObj[irtInfo.questionClassification] ?? null) === null) {
                        classificationObj[irtInfo.questionClassification] = 0;
                    }
        
                    classificationObj[irtInfo.questionClassification]++;
                }
                break;
            }

            case "base": {
                for (const irtInfo of input.calculatedIrtParams) {
                    irtInfo.questionClassification = this.getClassificationFor(
                        irtInfo,
                        input.calculatedIrtParams.length,
                        classificationObj,
                        classificationBounds,
                    );
        
                    if ((classificationObj[irtInfo.questionClassification] ?? null) === null) {
                        classificationObj[irtInfo.questionClassification] = 0;
                    }
        
                    classificationObj[irtInfo.questionClassification]++;
                }

                break;
            }
        }

        return {
            status: "success",
            result: input,

            isCritical: this.isCritical,
            resultTTLSteps: this.resultTTL,
        };
    }
}

const impl: IRegistryPlugin = {
    namespace: EdgarStatsProcessingConstants.CLASSIFY_QUESTION_STEP_ENTRY.split("/")[0],
    name: EdgarStatsProcessingConstants.CLASSIFY_QUESTION_STEP_ENTRY.split("/")[1],
    registry: "JobStep",
    creationFunction(stepDescriptor: JobStepDescriptor, ...args: any[]): object {
        return new EdgarQuestionClassificationStep(
            stepDescriptor.stepTimeoutMs,
            <EdgarQuestionClassificationStepConfiguration>stepDescriptor.configContent,
            stepDescriptor.isCritical,
            stepDescriptor.resultTTL
        );
    }
}

export default impl;
