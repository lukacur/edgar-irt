import { TestInstanceQuestion } from "./TestInstanceQuestion.model.js";

export class TestInstanceQuestionManualGrade {
    public id: number = null!;

    public id_test_instance_question: number = null!;
    public id_test_instance_question_navigation: TestInstanceQuestion = null!;

    public score: number | null = null;
}
