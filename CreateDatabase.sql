BEGIN TRANSACTION
	ISOLATION LEVEL SERIALIZABLE;

DROP SCHEMA IF EXISTS statistics_schema CASCADE;
DROP SCHEMA IF EXISTS job_tracking_schema CASCADE;

-- Statistics calculation related entries --
CREATE SCHEMA IF NOT EXISTS statistics_schema;

SET search_path TO statistics_schema;

CREATE TABLE IF NOT EXISTS question_param_calculation (
	id SERIAL PRIMARY KEY,
	calculation_group VARCHAR(512),

	id_based_on_course INT,
	id_based_on_test INT,
	
	id_question INT NOT NULL,
	
	created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	
	CONSTRAINT fk_qpc_course
		FOREIGN KEY (id_based_on_course)
		REFERENCES public.course(id),

	CONSTRAINT fk_qpc_test
		FOREIGN KEY (id_based_on_test)
		REFERENCES public.test(id),

	CONSTRAINT fk_qpc_question
		FOREIGN KEY (id_question)
		REFERENCES public.question(id)
);

CREATE TABLE IF NOT EXISTS question_param_calculation_academic_year (
	id SERIAL PRIMARY KEY,
	id_question_param_calculation INT NOT NULL,
	id_academic_year INT NOT NULL,
	
	CONSTRAINT uq_calc_acyear UNIQUE(id_question_param_calculation, id_academic_year),

	CONSTRAINT fk_qpcay_qparam_calc
		FOREIGN KEY (id_question_param_calculation)
		REFERENCES question_param_calculation(id),

	CONSTRAINT fk_qpcay_acyear
		FOREIGN KEY (id_academic_year)
		REFERENCES public.academic_year(id)
);

CREATE TABLE IF NOT EXISTS question_param_course_level_calculation (
	id_question_param_calculation INT PRIMARY KEY,
	
	score_mean DOUBLE PRECISION,
	score_std_dev DOUBLE PRECISION,
	score_median DOUBLE PRECISION,
	total_achieved DOUBLE PRECISION,
	total_achievable DOUBLE PRECISION,
	answers_count INT,
	correct INT,
	incorrect INT,
	unanswered INT,
	partial INT,
	
	CONSTRAINT fk_qpclc_qparam_calc
		FOREIGN KEY (id_question_param_calculation)
		REFERENCES question_param_calculation(id)
);

CREATE TABLE IF NOT EXISTS question_param_test_level_calculation (
	id_question_param_calculation INT PRIMARY KEY,
	
	mean DOUBLE PRECISION,
	std_dev DOUBLE PRECISION,
	count INT,
	median DOUBLE PRECISION,
	sum DOUBLE PRECISION,
	part_of_total_sum DOUBLE PRECISION,
	correct INT,
	incorrect INT,
	unanswered INT,
	partial INT,
	
	CONSTRAINT fk_qptlc_qparam_calc
		FOREIGN KEY (id_question_param_calculation)
		REFERENCES question_param_calculation(id)
);


-- Job tracking related entries --
CREATE SCHEMA IF NOT EXISTS job_tracking_schema;

SET search_path TO job_tracking_schema;

CREATE TABLE IF NOT EXISTS job_type (
	id INT PRIMARY KEY,
	abbrevation VARCHAR(10) NOT NULL UNIQUE,
	title VARCHAR(512),
	description VARCHAR(1024),

	request_form JSON
);

CREATE TYPE job_status_type AS ENUM('RUNNING', 'FINISHED', 'FAILED');

CREATE TABLE IF NOT EXISTS job (
	id VARCHAR(512) PRIMARY KEY,
	id_job_type INT NOT NULL,
	name VARCHAR(2048) NOT NULL,
	id_user_started INT,
	job_definition JSON,
	started_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	job_status job_status_type,
	job_status_message TEXT,
	finished_on TIMESTAMP,

	periodical BOOLEAN DEFAULT FALSE,

	rerun_requested BOOLEAN DEFAULT FALSE,

	CONSTRAINT fk_job_app_user
		FOREIGN KEY (id_user_started)
		REFERENCES public.app_user(id),

	CONSTRAINT fk_job_job_type
		FOREIGN KEY (id_job_type)
		REFERENCES job_type(id)
);

CREATE TYPE job_step_status_type
	AS ENUM('NOT_STARTED', 'RUNNING', 'SUCCESS', 'FAILURE', 'SKIP_CHAIN', 'CRITICALLY_ERRORED');

CREATE TABLE IF NOT EXISTS job_step (
	id VARCHAR(512) PRIMARY KEY,
	config JSON,
	started_on TIMESTAMP,
	finished_on TIMESTAMP,

	job_step_status job_step_status_type NOT NULL DEFAULT 'NOT_STARTED',
	job_step_status_message TEXT,

	ordinal INT,
	parent_job VARCHAR(512) NOT NULL,

	CONSTRAINT fk_js_job
		FOREIGN KEY (parent_job)
		REFERENCES job(id)
);

COMMIT;
END;

-- Database prefil with certain job types --
INSERT INTO job_type (id, abbrevation, title, description, request_form)
	VALUES
	(
		1,
		'STATPROC',
		'Edgar exam question statistics processing',
		'A job that calculates exam question statistics. This job is ran when a user wants to generate information on question statistics.',
		NULL
	),
	(
		2,
		'PEERREV',
		'Edgar Peer Assessment Analysis',
		'A job that runs analysis on the Peer Assessment assignments.',
		NULL
	),
	(
		3,
		'EXMRPT',
		'Edgar exam statistics report',
		'A job that generates statistics reports for certain exams selected by the user',
		NULL
	),
	(
		4,
		'OTHR',
		'Other',
		'A job type that declares that the job is of an unspecified type.',
		NULL
	);
