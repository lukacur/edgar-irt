import { CourseStatisticsCalculationQueue } from "../../AdaptiveGradingDaemon/Queue/StatisticsCalculationQueues/CourseStatisticsCalculationQueue.js";
import { AbstractBatch } from "../../ApplicationModel/Batch/AbstractBatch.js";
import { AbstractIRTDriver } from "../../ApplicationModel/Driver/AbstractIRTDriver.js";
import { DatabaseConnection } from "../Database/DatabaseConnection.js";
import { TransactionContext } from "../Database/TransactionContext.js";
import { CourseBasedBatch } from "./Batches/CourseBasedBatch.js";
import { TestBasedBatch } from "./Batches/TestBasedBatch.js";
import { QuestionItem } from "./Items/QuestionItem.js";
import { CourseBasedCalculation, IRCalculationResult, TestBasedCalculation } from "./Statistics/IRCalculationResult.js";

const requiredStructrue = {
    workingSchema: "statistics_schema"
}

// TODO: AbstractIRTDriver can be non-parameterised?
export class EdgarIRTDriver
    extends AbstractIRTDriver<QuestionItem | CourseBasedBatch | TestBasedBatch, IRCalculationResult> {
    constructor(
        private readonly dbConn: DatabaseConnection,
        private readonly calculationQueue: CourseStatisticsCalculationQueue,
    ) {
        super();
    }

    public async createBatch(): Promise<AbstractBatch<QuestionItem | CourseBasedBatch | TestBasedBatch>> {
        const queueEntry = await this.calculationQueue.dequeue();

        return new CourseBasedBatch(
            this.dbConn,
            queueEntry.idCourse,
            queueEntry.idStartAcademicYear,
            queueEntry.numberOfIncludedPreviousYears,
        );
    }

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
            `INSERT INTO question_param_calculation(id_based_on_course, id_question, id_test)
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
            `INSERT INTO question_param_course_level_calculation(
                id_question_param_calculation,
                mean,
                std_dev,
                count,
                median,
                sum,
                part_of_total_sum
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                /* $1 */ idQparamCalc,
                /* $2 */ testBasedInfo.mean,
                /* $3 */ testBasedInfo.stdDev,
                /* $4 */ testBasedInfo.median,
                /* $5 */ testBasedInfo.sum,
                /* $6 */ testBasedInfo.partOfTotalSum,
            ]
        ))?.count ?? null;

        return (count !== null && count !== 0);
    }

    public async failPost(batch: CourseBasedBatch): Promise<void> {
        let retryAmount = 3;
        let success = false;

        while (retryAmount > 0 && !success) {
            success = await this.calculationQueue.enqueue(
                {
                    forceCalculation: true,
                    idCourse: batch.id,
                    idStartAcademicYear: batch.idStartAcademicYear,
                    numberOfIncludedPreviousYears: batch.numberOfIncludedPreviousYears,
                }
            );

            --retryAmount;
        }
    }
    
    public async postResult(batchProcessingResult: IRCalculationResult): Promise<boolean> {
        if (!this.databaseStructureValid()) {
            return false;
        }

        const transaction = await this.dbConn.beginTransaction();

        try {
            const courseId = batchProcessingResult.courseId;
            const academicYearIds = batchProcessingResult.academicYearIds;

            for (const courseBasedInfo of batchProcessingResult.courseBased) {
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

            for (const testBasedInfo of batchProcessingResult.testBased) {
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
