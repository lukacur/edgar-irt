import { AbstractTypedWorkResultPersistor } from "../../../../../ApplicationModel/Jobs/WorkResultPersistors/AbstractTypedWorkResultPersistor.js";
import { DatabaseConnection } from "../../../../Database/DatabaseConnection.js";
import { TransactionContext } from "../../../../Database/TransactionContext.js";
import { CourseBasedCalculation, IRCalculationResult, TestBasedCalculation } from "../../../Statistics/IRCalculationResult.js";
import { EdgarStatProcJobConfiguration } from "../Provider/EdgarStatProcJobConfiguration.js";

const requiredStructrue = {
    workingSchema: "statistics_schema"
}

export class EdgarStatProcWorkResultPersistor
    extends AbstractTypedWorkResultPersistor<IRCalculationResult, EdgarStatProcJobConfiguration> {

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
        courseId: number,
        idQuestion: number,
        idTest?: number,
    ): Promise<number | null> {
        const qResult = (await transactionCtx.doQuery<{ id: number }>(
            `INSERT INTO question_param_calculation(id_based_on_course, id_question, id_based_on_test)
                VALUES ($1, $2, $3) RETURNING id`,
            [courseId, idQuestion, (idTest === undefined) ? null : idTest]
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
                part_of_total_sum
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                /* $1 */ idQparamCalc,
                /* $2 */ testBasedInfo.mean,
                /* $3 */ testBasedInfo.stdDev,
                /* $4 */ testBasedInfo.count,
                /* $5 */ testBasedInfo.median,
                /* $6 */ testBasedInfo.sum,
                /* $7 */ testBasedInfo.partOfTotalSum,
            ]
        ))?.count ?? null;

        return (count !== null && count !== 0);
    }
    
    protected async persistResultTyped(
        jobResult: IRCalculationResult,
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
            }

            for (const testBasedInfo of jobResult.testBased) {
                const idTest = testBasedInfo.idTest;

                for (const qInfo of testBasedInfo.testData) {
                    const idQparamCalc = await this.createParamCalculationEntry(
                        transaction,
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
}
