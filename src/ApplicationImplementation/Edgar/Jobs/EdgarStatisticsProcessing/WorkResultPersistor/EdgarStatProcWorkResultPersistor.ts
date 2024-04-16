import { RegisterDelegateToRegistry } from "../../../../../ApplicationModel/Decorators/Registration.decorator.js";
import { DataPersistorConfig } from "../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { AbstractTypedWorkResultPersistor } from "../../../../../ApplicationModel/Jobs/WorkResultPersistors/AbstractTypedWorkResultPersistor.js";
import { DatabaseConnectionRegistry } from "../../../../../PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { DatabaseConnection } from "../../../../Database/DatabaseConnection.js";
import { TransactionContext } from "../../../../Database/TransactionContext.js";
import { TestInstance } from "../../../../Models/Database/TestInstance/TestInstance.model.js";
import { EdgarStatsProcessingConstants } from "../../../EdgarStatsProcessing.constants.js";
import { CourseBasedCalculation, IRCalculationResult, TestBasedCalculation } from "../../../Statistics/IRCalculationResult.js";
import { EdgarStatProcJobConfiguration } from "../Provider/EdgarStatProcJobConfiguration.js";
import { StatProcessingJobBatchCache } from "../StatProcessingJobBatchCache.js";

const requiredStructrue = {
    workingSchema: "statistics_schema"
};

type QuestionCalcultionInfo = {
    jobId: string;
    courseBasedCalc: CourseBasedCalculation & { id: number };
    testBasedCalc: (TestBasedCalculation & { id: number })[];
    relatedTestInstances: TestInstance[];
};

interface IIRTParameterCalculator {
    calculateLevelOfItemKnowledge: (qCalcInfo: QuestionCalcultionInfo) => number,
    calculateItemDifficulty: (qCalcInfo: QuestionCalcultionInfo) => number,
    calculateItemGuessProbability: (qCalcInfo: QuestionCalcultionInfo) => number,
    calculateItemMistakeProbability: (qCalcInfo: QuestionCalcultionInfo) => number,
}

export class EdgarStatProcWorkResultPersistor
    extends AbstractTypedWorkResultPersistor<IRCalculationResult, EdgarStatProcJobConfiguration> {

    constructor(
        private readonly dbConn: DatabaseConnection,
        private readonly defaultIRTOffsetParam: number = 1.0,
    ) { super(); }

    private async databaseStructureValid(): Promise<boolean> {
        const schemaPresent = await this.dbConn.doQuery<boolean>(
            "SELECT EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = $1)",
            [requiredStructrue.workingSchema]
        );

        if (schemaPresent === null) {
            return false;
        }

        return schemaPresent.rows[0];
    }

    private async createParamCalculationEntry(
        transactionCtx: TransactionContext,
        calculationGroup: string,
        courseId: number,
        idQuestion: number,
        idTest?: number,
    ): Promise<number | null> {
        const qResult = (await transactionCtx.doQuery<{ id: number }>(
            `INSERT INTO question_param_calculation(
                calculation_group,
                id_based_on_course,
                id_question,
                id_based_on_test
            ) VALUES ($1, $2, $3, $4) RETURNING id`,
            [calculationGroup, courseId, idQuestion, (idTest === undefined) ? null : idTest]
        ));

        return (qResult === null || qResult.count === 0) ? null : qResult.rows[0].id;
    }

    private async bindAcademicYears(
        transactionCtx: TransactionContext,
        idQparamCalc: number,
        academicYearIds: number[],
    ): Promise<boolean> {
        for (const idAcademicYear of academicYearIds) {
            const count = (await transactionCtx.doQuery<{ id: number }>(
                `INSERT INTO question_param_calculation_academic_year(
                    id_question_param_calculation, id_academic_year
                ) VALUES ($1, $2) RETURNING id`,
                [idQparamCalc, idAcademicYear]
            ))?.count ?? null;

            if (count === null || count === 0) {
                return false;
            }
        }

        return true;
    }

    private async insertCourseBasedStatistics(
        transactionCtx: TransactionContext,
        idQparamCalc: number,
        courseBasedInfo: CourseBasedCalculation,
    ): Promise<boolean> {
        const count = (await transactionCtx.doQuery<{ id: number }>(
            `INSERT INTO question_param_course_level_calculation(
                id_question_param_calculation,
                score_mean,
                score_std_dev,
                score_median,
                total_achieved,
                total_achievable,
                answers_count,
                correct,
                incorrect,
                unanswered,
                partial
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                /* $1 */ idQparamCalc,
                /* $2 */ courseBasedInfo.scoreMean,
                /* $3 */ courseBasedInfo.scoreStdDev,
                /* $4 */ courseBasedInfo.scoreMedian,
                /* $5 */ courseBasedInfo.totalAchieved,
                /* $6 */ courseBasedInfo.totalAchievable,
                /* $7 */ courseBasedInfo.answersCount,
                /* $8 */ courseBasedInfo.correct,
                /* $9 */ courseBasedInfo.incorrect,
                /* $10 */ courseBasedInfo.unanswered,
                /* $11 */ courseBasedInfo.partial,
            ]
        ))?.count ?? null;

        return (count !== null && count !== 0);
    }

    private async insertTestBasedStatistics(
        transactionCtx: TransactionContext,
        idQparamCalc: number,
        testBasedInfo: TestBasedCalculation,
    ): Promise<boolean> {
        const count = (await transactionCtx.doQuery<{ id: number }>(
            `INSERT INTO question_param_test_level_calculation(
                id_question_param_calculation,
                mean,
                std_dev,
                count,
                median,
                sum,
                part_of_total_sum,
                correct,
                incorrect,
                unanswered,
                partial
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                /*  $1 */ idQparamCalc,
                /*  $2 */ testBasedInfo.mean,
                /*  $3 */ testBasedInfo.stdDev,
                /*  $4 */ testBasedInfo.count,
                /*  $5 */ testBasedInfo.median,
                /*  $6 */ testBasedInfo.sum,
                /*  $7 */ testBasedInfo.partOfTotalSum,
                /*  $8 */ testBasedInfo.correct,
                /*  $9 */ testBasedInfo.incorrect,
                /* $10 */ testBasedInfo.unanswered,
                /* $11 */ testBasedInfo.partial,
            ]
        ))?.count ?? null;

        return (count !== null && count !== 0);
    }

    private static readonly IRTCalculationConfiguration: IIRTParameterCalculator = {
        calculateLevelOfItemKnowledge: (qCalcInfo: QuestionCalcultionInfo) => {
            const courseBased = qCalcInfo.courseBasedCalc;
            const testBased = qCalcInfo.testBasedCalc;

            return (courseBased.incorrect / courseBased.correct) *
                (testBased.reduce((acc, e) => acc + e.partOfTotalSum, 0) / (testBased.length + 1)) * 10;
        },

        calculateItemDifficulty: (qCalcInfo: QuestionCalcultionInfo) => {
            const courseBased = qCalcInfo.courseBasedCalc;
            const testBased = qCalcInfo.testBasedCalc;

            return (courseBased.totalAchieved / courseBased.totalAchievable) *
                (courseBased.incorrect / courseBased.correct) *
                (testBased.reduce((acc, e) => acc + e.median, 0) / (testBased.length + 1));
        },

        calculateItemGuessProbability: (qCalcInfo: QuestionCalcultionInfo) => {
            const courseBased = qCalcInfo.courseBasedCalc;
            const testBased = qCalcInfo.testBasedCalc;

            return courseBased.correct / courseBased.answersCount;
        },

        calculateItemMistakeProbability: (qCalcInfo: QuestionCalcultionInfo) => {
            const courseBased = qCalcInfo.courseBasedCalc;
            const testBased = qCalcInfo.testBasedCalc;

            return courseBased.incorrect / courseBased.answersCount;
        }
    };

    private async createIRTParams(
        transactionCtx: TransactionContext,
        questionToCalculationsMap: Map<number, QuestionCalcultionInfo>
    ): Promise<boolean> {
        for (const entry of questionToCalculationsMap.entries()) {
            const count = (await transactionCtx.doQuery<{ id: number }>(
                `INSERT INTO question_irt_parameters (
                    id_course_based_info,
                    id_test_based_info,

                    id_question,

                    default_item_offset_parameter,
                    level_of_item_knowledge,
                    item_difficulty,
                    item_guess_probability,
                    item_mistake_probability
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    /* $1 */ entry[1].courseBasedCalc.id,
                    /* $2 */ JSON.stringify(entry[1].testBasedCalc.map(e => e.id)).replace("[", "{").replace("]", "}"),
                    /* $3 */ entry[0],

                    /* $4 */ this.defaultIRTOffsetParam ?? null,

                    /* $5 */
                    EdgarStatProcWorkResultPersistor.IRTCalculationConfiguration
                        .calculateLevelOfItemKnowledge(entry[1]),

                    /* $6 */
                    EdgarStatProcWorkResultPersistor.IRTCalculationConfiguration
                        .calculateItemDifficulty(entry[1]),

                    /* $7 */
                    EdgarStatProcWorkResultPersistor.IRTCalculationConfiguration
                        .calculateItemGuessProbability(entry[1]),

                    /* $8 */
                    EdgarStatProcWorkResultPersistor.IRTCalculationConfiguration
                        .calculateItemMistakeProbability(entry[1]),
                ]
            ))?.count ?? null;
            
            if (count === null || count === 0) {
                return false;
            }
        }

        return true;
    }
    
    protected async persistResultTyped(
        jobResult: IRCalculationResult,
        jobConfig: EdgarStatProcJobConfiguration
    ): Promise<boolean> {
        if (!this.databaseStructureValid()) {
            return false;
        }

        const transaction = await this.dbConn.beginTransaction(requiredStructrue.workingSchema);
        const jobId = jobConfig.jobId;

        try {
            const courseId = jobResult.courseId;
            const academicYearIds = jobResult.academicYearIds;

            const questionToCalculationsMap: Map<number, QuestionCalcultionInfo> = new Map();

            for (const courseBasedInfo of jobResult.courseBased) {
                const idQparamCalc = await this.createParamCalculationEntry(
                    transaction,
                    jobConfig.jobId,
                    courseId,
                    courseBasedInfo.idQuestion
                );

                if (idQparamCalc === null) {
                    await transaction.rollback();
                    return false;
                }
                
                if (!(await this.bindAcademicYears(transaction, idQparamCalc, academicYearIds))) {
                    await transaction.rollback();
                    return false;
                }

                if (!(await this.insertCourseBasedStatistics(transaction, idQparamCalc, courseBasedInfo))) {
                    await transaction.rollback();
                    return false;
                }

                questionToCalculationsMap.set(
                    courseBasedInfo.idQuestion,
                    {
                        jobId,
                        courseBasedCalc: {
                            ...courseBasedInfo,
                            id: idQparamCalc
                        },
                        testBasedCalc: [],
                        relatedTestInstances: await StatProcessingJobBatchCache.instance.getCachedJobBatch(jobId)
                            ?.getTestInstancesWithQuestion(courseBasedInfo.idQuestion) ?? [],
                    }
                );
            }

            for (const testBasedInfo of jobResult.testBased) {
                const idTest = testBasedInfo.idTest;

                for (const qInfo of testBasedInfo.testData) {
                    const idQparamCalc = await this.createParamCalculationEntry(
                        transaction,
                        jobConfig.jobId,
                        courseId,
                        qInfo.idQuestion,
                        idTest,
                    );

                    if (idQparamCalc === null) {
                        await transaction.rollback();
                        return false;
                    }

                    if (!(await this.bindAcademicYears(transaction, idQparamCalc, academicYearIds))) {
                        await transaction.rollback();
                        return false;
                    }

                    if (!(await this.insertTestBasedStatistics(transaction, idQparamCalc, qInfo))) {
                        await transaction.rollback();
                        return false;
                    }

                    if (questionToCalculationsMap.has(qInfo.idQuestion)) {
                        questionToCalculationsMap.get(qInfo.idQuestion)!.testBasedCalc.push(
                            {
                                ...qInfo,
                                id: idQparamCalc,
                            }
                        );
                    }
                }
            }

            if (!(await this.createIRTParams(transaction, questionToCalculationsMap))) {
                await transaction.rollback();
                return false;
            }

            return true;
        } catch (err) {
            console.log(err);
            await transaction.rollback();
        } finally {
            if (!transaction.isFinished()) {
                await transaction.commit();
            }
        }

        return false;
    }

    @RegisterDelegateToRegistry(
        "Persistor",
        EdgarStatsProcessingConstants.DATA_PERSISTOR_REGISTRY_ENTRY,
    )
    public createGeneric(
        persistorConfig: DataPersistorConfig<{ databaseConnection?: string, defaultIRTOffsetParam?: number }>,
        ...args: any[]
    ): object {
        const configEntry = persistorConfig.configContent;

        if (configEntry.databaseConnection === undefined) {
            throw new Error("Database connection is required but was not provided in the configuration");
        }

        return new EdgarStatProcWorkResultPersistor(
            DatabaseConnectionRegistry.instance.getItem(configEntry.databaseConnection),
            configEntry.defaultIRTOffsetParam,
        );
    }
}
