import { RegisterDelegateToRegistry } from "../../../../../ApplicationModel/Decorators/Registration.decorator.js";
import { DataPersistorConfig } from "../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { AbstractTypedWorkResultPersistor } from "../../../../../ApplicationModel/Jobs/WorkResultPersistors/AbstractTypedWorkResultPersistor.js";
import { FrameworkLogger } from "../../../../../Logger/FrameworkLogger.js";
import { DatabaseConnectionRegistry } from "../../../../../PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { DatabaseConnection } from "../../../../../ApplicationModel/Database/DatabaseConnection.js";
import { TransactionContext } from "../../../../../ApplicationModel/Database/TransactionContext.js";
import { EdgarStatsProcessingConstants } from "../../../EdgarStatsProcessing.constants.js";
import { CourseBasedCalculation, IExtendedRCalculationResult, QuestionIrtParamInfo, TestBasedCalculation } from "../../../Statistics/IRCalculationResult.js";
import { EdgarStatProcJobConfiguration } from "../Provider/EdgarStatProcJobConfiguration.js";

const requiredStructrue = {
    workingSchema: "statistics_schema"
};

export class EdgarStatProcWorkResultPersistor
    extends AbstractTypedWorkResultPersistor<IExtendedRCalculationResult, EdgarStatProcJobConfiguration> {

    constructor(
        private readonly dbConn: DatabaseConnection,
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
                score_perc_mean,
                score_perc_std_dev,
                score_perc_median,
                total_achieved,
                total_achievable,
                answers_count,
                correct_perc,
                incorrect_perc,
                unanswered_perc,
                partial_perc
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                /* $1 */ idQparamCalc,
                /* $2 */ courseBasedInfo.scorePercMean,
                /* $3 */ courseBasedInfo.scorePercStdDev,
                /* $4 */ courseBasedInfo.scorePercMedian,
                /* $5 */ courseBasedInfo.totalAchieved,
                /* $6 */ courseBasedInfo.totalAchievable,
                /* $7 */ courseBasedInfo.answersCount,
                /* $8 */ courseBasedInfo.correctPerc,
                /* $9 */ courseBasedInfo.incorrectPerc,
                /* $10 */ courseBasedInfo.unansweredPerc,
                /* $11 */ courseBasedInfo.partialPerc,
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
                score_perc_mean,
                score_perc_std_dev,
                count,
                score_perc_median,
                score_sum,
                part_of_total_sum,
                correct_perc,
                incorrect_perc,
                unanswered_perc,
                partial_perc
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                /*  $1 */ idQparamCalc,
                /*  $2 */ testBasedInfo.scorePercMean,
                /*  $3 */ testBasedInfo.scorePercStdDev,
                /*  $4 */ testBasedInfo.count,
                /*  $5 */ testBasedInfo.scorePercMedian,
                /*  $6 */ testBasedInfo.scoreSum,
                /*  $7 */ testBasedInfo.partOfTotalSum,
                /*  $8 */ testBasedInfo.correctPerc,
                /*  $9 */ testBasedInfo.incorrectPerc,
                /* $10 */ testBasedInfo.unansweredPerc,
                /* $11 */ testBasedInfo.partialPerc,
            ]
        ))?.count ?? null;

        return (count !== null && count !== 0);
    }

    private async createIRTParams(
        transactionCtx: TransactionContext,
        idCourseLevelCalculation: number,
        questionIrtParams: QuestionIrtParamInfo | undefined
    ): Promise<boolean> {
        if (questionIrtParams === undefined) {
            return true;
        }

        return (await transactionCtx.doQuery(
            `UPDATE question_param_course_level_calculation
                SET (
                    default_item_offset_parameter,
                    level_of_item_knowledge,
                    item_difficulty,
                    item_guess_probability,
                    item_mistake_probability,
                    question_irt_classification
                ) = ($1, $2, $3, $4, $5, $6)
            WHERE id_question_param_calculation = $7`,
            [
                /* $1 */ questionIrtParams.defaultItemOffsetParam,
                /* $2 */ questionIrtParams.params.levelOfItemKnowledge,
                /* $3 */ questionIrtParams.params.itemDifficulty,
                /* $4 */ questionIrtParams.params.itemGuessProbability,
                /* $5 */ questionIrtParams.params.itemMistakeProbability,
                /* $6 */ questionIrtParams.questionClassification ?? null,

                /* $7 */ idCourseLevelCalculation,
            ]
        )) !== null;
    }
    
    protected async persistResultTyped(
        jobResult: IExtendedRCalculationResult,
        jobConfig: EdgarStatProcJobConfiguration
    ): Promise<boolean> {
        if (!this.databaseStructureValid()) {
            return false;
        }

        const transaction = await this.dbConn.beginTransaction(requiredStructrue.workingSchema);

        try {
            const courseId = jobResult.courseId;
            const academicYearIds = jobResult.academicYearIds;

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

                const questionIrtParams =
                    jobResult.calculatedIrtParams.find(p => p.idQuestion === courseBasedInfo.idQuestion);
                if (!(await this.createIRTParams(transaction, idQparamCalc, questionIrtParams))) {
                    await transaction.rollback();
                    return false;
                }
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
                }
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

        const dbConn: DatabaseConnection | null = DatabaseConnectionRegistry.instance.getItem(
            configEntry.databaseConnection
        );
        if (dbConn === null) {
            FrameworkLogger.error(EdgarStatProcWorkResultPersistor, "Unable to fetch database connection");
            throw new Error("Unable to fetch database connection");
        }

        return new EdgarStatProcWorkResultPersistor(dbConn);
    }
}
