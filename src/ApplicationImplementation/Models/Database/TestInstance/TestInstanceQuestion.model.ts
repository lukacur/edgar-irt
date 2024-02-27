import { Question } from "../Question/Question.model.js";
import { TestInstance } from "./TestInstance.model.js";

export class TestInstanceQuestion {
    public id: number = null!;

    public id_test_instance: number = null!;
    public id_test_instance_navigation: TestInstance = null!;

    public id_question: number = null!;
    public id_question_navigation: Question = null!;

    public is_correct: boolean | null = null;
    public is_incorrect: boolean | null = null;
    public is_unanswered: boolean | null = null;
    public is_partial: boolean | null = null;

    public score: number | null = null;
    public score_perc: number | null = null;
}
