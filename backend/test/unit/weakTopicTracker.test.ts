import { getDb } from '../../src/db';
import { initTestDb, cleanTestDb, createTestUser } from '../test_helpers';
import {
  updateWeakTopics,
  getUserWeakTopics,
} from '../../src/services/weakTopicTracker';
import { EvaluationResult } from '../../src/services/evaluatorAgent';

describe('WeakTopicTracker Unit Tests', () => {
  let user: any;

  beforeEach(async () => {
    await initTestDb();
    user = await createTestUser();
  });

  afterEach(async () => {
    await cleanTestDb();
  });

  test('updateWeakTopics skipped for high score', async () => {
    const evalResult: EvaluationResult = {
      technical_accuracy: 8,
      definition_present: true,
      mechanism_explained: true,
      example_given: true,
      edge_cases_mentioned: false,
      missing_concepts: ['Advanced regularization'],
      incorrect_statements: [],
      follow_up_angle: 'Explain details',
      answer_summary: 'Good answer',
    };

    await updateWeakTopics(user.id, 'Machine Learning', evalResult);

    const weakTopics = await getUserWeakTopics(user.id);
    expect(weakTopics.length).toBe(0);
  });

  test('updateWeakTopics recorded for low score', async () => {
    const evalResult: EvaluationResult = {
      technical_accuracy: 4,
      definition_present: true,
      mechanism_explained: false,
      example_given: false,
      edge_cases_mentioned: false,
      missing_concepts: ['L1 Regularization'],
      incorrect_statements: [],
      follow_up_angle: 'L1 regularizer math',
      answer_summary: 'Incomplete answer',
    };

    await updateWeakTopics(user.id, 'Machine Learning', evalResult);

    const weakTopics = await getUserWeakTopics(user.id);
    expect(weakTopics.length).toBe(1);
    expect(weakTopics[0].topic).toBe('Machine Learning');
    expect(weakTopics[0].subtopic).toBe('L1 Regularization');
    expect(weakTopics[0].avg_score).toBe(4.0);
    expect(weakTopics[0].occurrence).toBe(1);
  });

  test('updateWeakTopics rolling average updates correctly', async () => {
    const eval1: EvaluationResult = {
      technical_accuracy: 4,
      definition_present: true,
      mechanism_explained: false,
      example_given: false,
      edge_cases_mentioned: false,
      missing_concepts: ['Clustering'],
      incorrect_statements: [],
      follow_up_angle: 'Probing clustering',
      answer_summary: 'Weak answer',
    };

    const eval2: EvaluationResult = {
      technical_accuracy: 6,
      definition_present: true,
      mechanism_explained: true,
      example_given: false,
      edge_cases_mentioned: false,
      missing_concepts: ['Clustering'],
      incorrect_statements: [],
      follow_up_angle: 'Probing clustering',
      answer_summary: 'Moderate answer',
    };

    await updateWeakTopics(user.id, 'Machine Learning', eval1);
    await updateWeakTopics(user.id, 'Machine Learning', eval2);

    const weakTopics = await getUserWeakTopics(user.id);
    expect(weakTopics.length).toBe(1);
    expect(weakTopics[0].occurrence).toBe(2);
    // (4.0 + 6.0) / 2 = 5.0
    expect(weakTopics[0].avg_score).toBe(5.0);
  });

  test('extractSubtopic rules check', async () => {
    // Priority 1: missing_concepts
    const evalMissing: EvaluationResult = {
      technical_accuracy: 5,
      definition_present: true,
      mechanism_explained: false,
      example_given: false,
      edge_cases_mentioned: false,
      missing_concepts: ['ConceptA', 'ConceptB'],
      incorrect_statements: [],
      follow_up_angle: 'Explain A',
      answer_summary: 'summary',
    };
    await updateWeakTopics(user.id, 'Machine Learning', evalMissing);
    let topics = await getUserWeakTopics(user.id);
    expect(topics[0].subtopic).toBe('ConceptA');

    // Priority 2: follow_up_angle
    const evalFollowUp: EvaluationResult = {
      technical_accuracy: 5,
      definition_present: true,
      mechanism_explained: false,
      example_given: false,
      edge_cases_mentioned: false,
      missing_concepts: [],
      incorrect_statements: [],
      follow_up_angle: 'Probe deeper into K-Means math',
      answer_summary: 'summary',
    };
    await updateWeakTopics(user.id, 'Machine Design', evalFollowUp);
    topics = await getUserWeakTopics(user.id);
    const topicDesign = topics.find(t => t.topic === 'Machine Design');
    expect(topicDesign.subtopic).toBe('Probe deeper into K-Means math');

    // Priority 3: rubric dimension (definition missing)
    const evalRubric: EvaluationResult = {
      technical_accuracy: 5,
      definition_present: false,
      mechanism_explained: true,
      example_given: true,
      edge_cases_mentioned: true,
      missing_concepts: [],
      incorrect_statements: [],
      follow_up_angle: '',
      answer_summary: 'summary',
    };
    await updateWeakTopics(user.id, 'OS', evalRubric);
    topics = await getUserWeakTopics(user.id);
    const topicOS = topics.find(t => t.topic === 'OS');
    expect(topicOS.subtopic).toBe('Core definitions');

    // Priority 4: fallback
    const evalFallback: EvaluationResult = {
      technical_accuracy: 5,
      definition_present: true,
      mechanism_explained: true,
      example_given: true,
      edge_cases_mentioned: true,
      missing_concepts: [],
      incorrect_statements: [],
      follow_up_angle: '',
      answer_summary: 'summary',
    };
    await updateWeakTopics(user.id, 'DSA', evalFallback);
    topics = await getUserWeakTopics(user.id);
    const topicDSA = topics.find(t => t.topic === 'DSA');
    expect(topicDSA.subtopic).toBe('General understanding');
  });
});
