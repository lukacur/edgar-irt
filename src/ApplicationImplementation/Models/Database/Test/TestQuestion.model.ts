import { Question } from "../Question/Question.model.js";
import { Test } from "./Test.model.js";

export class TestQuestion {
    public id: number = null!;

    public ordinal: number = null!;

    public id_test: number = null!;
    public id_test_navigation: Test = null!;

    public id_question: number = null!;
    public id_question_navigation: Question = null!;
}
