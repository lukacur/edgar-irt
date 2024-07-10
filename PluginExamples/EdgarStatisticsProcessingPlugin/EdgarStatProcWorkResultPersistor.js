var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { EdgarStatsProcessingConstants } from "../../dist/ApplicationImplementation/Edgar/EdgarStatsProcessing.constants.js";
import { AbstractTypedWorkResultPersistor } from "../../dist/ApplicationModel/Jobs/WorkResultPersistors/AbstractTypedWorkResultPersistor.js";
import { FrameworkLogger } from "../../dist/Logger/FrameworkLogger.js";
import { DatabaseConnectionRegistry } from "../../dist/PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
const requiredStructrue = {
    workingSchema: "statistics_schema"
};
export class EdgarStatProcWorkResultPersistor extends AbstractTypedWorkResultPersistor {
    constructor(dbConn) {
        super();
        this.dbConn = dbConn;
    }
    databaseStructureValid() {
        return __awaiter(this, void 0, void 0, function* () {
            const schemaPresent = yield this.dbConn.doQuery("SELECT EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = $1)", [requiredStructrue.workingSchema]);
            if (schemaPresent === null) {
                return false;
            }
            return schemaPresent.rows[0];
        });
    }
    createParamCalculationEntry(transactionCtx, calculationGroup, courseId, idQuestion, idTest) {
        return __awaiter(this, void 0, void 0, function* () {
            const qResult = (yield transactionCtx.doQuery(`INSERT INTO question_param_calculation(
                calculation_group,
                id_based_on_course,
                id_question,
                id_based_on_test
            ) VALUES ($1, $2, $3, $4) RETURNING id`, [calculationGroup, courseId, idQuestion, (idTest === undefined) ? null : idTest]));
            return (qResult === null || qResult.count === 0) ? null : qResult.rows[0].id;
        });
    }
    bindAcademicYears(transactionCtx, idQparamCalc, academicYearIds) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            for (const idAcademicYear of academicYearIds) {
                const count = (_b = (_a = (yield transactionCtx.doQuery(`INSERT INTO question_param_calculation_academic_year(
                    id_question_param_calculation, id_academic_year
                ) VALUES ($1, $2) RETURNING id`, [idQparamCalc, idAcademicYear]))) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : null;
                if (count === null || count === 0) {
                    return false;
                }
            }
            return true;
        });
    }
    insertCourseBasedStatistics(transactionCtx, idQparamCalc, courseBasedInfo) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const count = (_b = (_a = (yield transactionCtx.doQuery(`INSERT INTO question_param_course_level_calculation(
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
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
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
            ]))) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : null;
            return (count !== null && count !== 0);
        });
    }
    insertTestBasedStatistics(transactionCtx, idQparamCalc, testBasedInfo) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const count = (_b = (_a = (yield transactionCtx.doQuery(`INSERT INTO question_param_test_level_calculation(
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
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
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
            ]))) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : null;
            return (count !== null && count !== 0);
        });
    }
    createIRTParams(transactionCtx, idCourseLevelCalculation, questionIrtParams) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (questionIrtParams === undefined) {
                return true;
            }
            return (yield transactionCtx.doQuery(`UPDATE question_param_course_level_calculation
                SET (
                    default_item_offset_parameter,
                    level_of_item_knowledge,
                    item_difficulty,
                    item_guess_probability,
                    item_mistake_probability,
                    question_irt_classification
                ) = ($1, $2, $3, $4, $5, $6)
            WHERE id_question_param_calculation = $7`, [
                /* $1 */ questionIrtParams.defaultItemOffsetParam,
                /* $2 */ questionIrtParams.params.levelOfItemKnowledge,
                /* $3 */ questionIrtParams.params.itemDifficulty,
                /* $4 */ questionIrtParams.params.itemGuessProbability,
                /* $5 */ questionIrtParams.params.itemMistakeProbability,
                /* $6 */ (_a = questionIrtParams.questionClassification) !== null && _a !== void 0 ? _a : null,
                /* $7 */ idCourseLevelCalculation,
            ])) !== null;
        });
    }
    persistResultTyped(jobResult, jobConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.databaseStructureValid()) {
                return false;
            }
            const transaction = yield this.dbConn.beginTransaction(requiredStructrue.workingSchema);
            try {
                const courseId = jobResult.courseId;
                const academicYearIds = jobResult.academicYearIds;
                for (const courseBasedInfo of jobResult.courseBased) {
                    const idQparamCalc = yield this.createParamCalculationEntry(transaction, jobConfig.jobId, courseId, courseBasedInfo.idQuestion);
                    if (idQparamCalc === null) {
                        yield transaction.rollback();
                        return false;
                    }
                    if (!(yield this.bindAcademicYears(transaction, idQparamCalc, academicYearIds))) {
                        yield transaction.rollback();
                        return false;
                    }
                    if (!(yield this.insertCourseBasedStatistics(transaction, idQparamCalc, courseBasedInfo))) {
                        yield transaction.rollback();
                        return false;
                    }
                    const questionIrtParams = jobResult.calculatedIrtParams.find(p => p.idQuestion === courseBasedInfo.idQuestion);
                    if (!(yield this.createIRTParams(transaction, idQparamCalc, questionIrtParams))) {
                        yield transaction.rollback();
                        return false;
                    }
                }
                for (const testBasedInfo of jobResult.testBased) {
                    const idTest = testBasedInfo.idTest;
                    for (const qInfo of testBasedInfo.testData) {
                        const idQparamCalc = yield this.createParamCalculationEntry(transaction, jobConfig.jobId, courseId, qInfo.idQuestion, idTest);
                        if (idQparamCalc === null) {
                            yield transaction.rollback();
                            return false;
                        }
                        if (!(yield this.bindAcademicYears(transaction, idQparamCalc, academicYearIds))) {
                            yield transaction.rollback();
                            return false;
                        }
                        if (!(yield this.insertTestBasedStatistics(transaction, idQparamCalc, qInfo))) {
                            yield transaction.rollback();
                            return false;
                        }
                    }
                }
                return true;
            }
            catch (err) {
                console.log(err);
                yield transaction.rollback();
            }
            finally {
                if (!transaction.isFinished()) {
                    yield transaction.commit();
                }
            }
            return false;
        });
    }
}
const impl = {
    namespace: EdgarStatsProcessingConstants.DATA_PERSISTOR_REGISTRY_ENTRY.split("/")[0],
    name: EdgarStatsProcessingConstants.DATA_PERSISTOR_REGISTRY_ENTRY.split("/")[1],
    registry: "Persistor",
    creationFunction(persistorConfig, ...args) {
        const configEntry = persistorConfig.configContent;
        if (configEntry.databaseConnection === undefined) {
            throw new Error("Database connection is required but was not provided in the configuration");
        }
        const dbConn = DatabaseConnectionRegistry.instance.getItem(configEntry.databaseConnection);
        if (dbConn === null) {
            FrameworkLogger.error(EdgarStatProcWorkResultPersistor, "Unable to fetch database connection");
            throw new Error("Unable to fetch database connection");
        }
        return new EdgarStatProcWorkResultPersistor(dbConn);
    }
};
export default impl;
