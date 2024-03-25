import { AbstractGenericJobStep } from "../../../../../../ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { StepResult } from "../../../../../../ApplicationModel/Jobs/IJobStep.js";
import { DelayablePromise } from "../../../../../../Util/DelayablePromise.js";
import { DatabaseConnection } from "../../../../../Database/DatabaseConnection.js";
import { CheckIfCalculationNeededStepConfiguration } from "./CheckIfCalculationNeededStepConfiguration.js";

export class CheckIfCalculationNeededStep
    extends AbstractGenericJobStep<CheckIfCalculationNeededStepConfiguration, object, object> {
    constructor(
        stepTimeoutMs: number,
        stepConfiguration: CheckIfCalculationNeededStepConfiguration,

        private readonly dbConn: DatabaseConnection,
    ) {
        super(stepTimeoutMs, stepConfiguration);
    }

    private createSQLIntervalFromConfig(): string {
        return `${this.stepConfiguration.calculationsValidFor.days ?? 0} days ` +
                `${this.stepConfiguration.calculationsValidFor.hours ?? 0} hours ` +
                `${this.stepConfiguration.calculationsValidFor.minutes ?? 0} minutes ` +
                `${this.stepConfiguration.calculationsValidFor.seconds ?? 0} seconds`;
    }

    protected async runTyped(stepInput: object | null): Promise<StepResult<object>> {
        if (stepInput === null) {
            return {
                status: "failure",
                reason: `Input to this step can't be null ${CheckIfCalculationNeededStep.name}`,
                result: null,
                canRetry: false,
            }
        }

        if (
            !("id" in stepInput && "idStartAcademicYear" in stepInput && "numberOfIncludedPreviousYears" in stepInput)
        ) {
            return {
                status: "cancelChain",
                reason: "Input is in an invalid format",
                result: null,
            };
        }

        const validStepInput =
            stepInput as { id: number, idStartAcademicYear: number, numberOfIncludedPreviousYears: number };
        
        const { id, idStartAcademicYear, numberOfIncludedPreviousYears } = validStepInput;
        console.log({ id, idStartAcademicYear, numberOfIncludedPreviousYears });
        

        const result = await this.dbConn.doQuery<{ existance: boolean }>(
            `SELECT EXISTS (
                SELECT
                FROM statistics_schema.question_param_calculation
                    JOIN statistics_schema.question_param_calculation_academic_year
                        ON statistics_schema.question_param_calculation.id =
                            statistics_schema.question_param_calculation_academic_year.id_question_param_calculation
                WHERE id_based_on_course = $1 AND
                        id_academic_year BETWEEN (CAST($2 AS INT) - CAST($3 AS INT)) AND $2 AND
                        created_on >= (CURRENT_TIMESTAMP - CAST('${this.createSQLIntervalFromConfig()}' AS INTERVAL))

            ) AS existance`,
            [
                /* $1 */ validStepInput.id,
                /* $2 */ validStepInput.idStartAcademicYear.toString(),
                /* $3 */ validStepInput.numberOfIncludedPreviousYears.toString(),
                /* $4 */ 
            ]
        );
        
        if (result !== null && result.count !== 0 && result.rows[0].existance) {
            return {
                status: "cancelChain",
                reason: `Calculation already exists and is not older than ${this.createSQLIntervalFromConfig()}`,
                result: null,
            };
        }
        
        return {
            status: "success",
            result: stepInput,
        };
    }
}
