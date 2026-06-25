import { getDb } from '../../src/db';
import { initTestDb, cleanTestDb, createTestUser, createTestSession } from '../test_helpers';
import {
  embedText,
  embedAndStoreExchange,
  retrieveRelevantWeakAnswers,
  formatRetrievedContext,
} from '../../src/services/vectorMemory';
import { v4 as uuidv4 } from 'uuid';

describe('VectorMemory Unit Tests', () => {
  let user: any;
  let session: any;

  beforeEach(async () => {
    await initTestDb();
    user = await createTestUser();
    session = await createTestSession(user.id);
  });

  afterEach(async () => {
    await cleanTestDb();
  });

  test('embedText mock determinism and length', async () => {
    const text = 'Difference between supervised and unsupervised learning';
    const vec = await embedText(text, { id: user.id, openai_api_key: 'mock' });

    expect(vec.length).toBe(1536);
    expect(vec.every(x => typeof x === 'number')).toBe(true);

    const vec2 = await embedText(text, { id: user.id, openai_api_key: 'mock' });
    expect(vec).toEqual(vec2);

    const vecDiff = await embedText('Something completely different', { id: user.id, openai_api_key: 'mock' });
    expect(vec).not.toEqual(vecDiff);
  });

  test('embedAndStoreExchange stores embedded text', async () => {
    const db = getDb();
    const exchangeId = uuidv4();
    const now = new Date().toISOString();

    // Create exchange
    await db.run(
      'INSERT INTO exchanges (id, session_id, question, question_index, created_at) VALUES (?, ?, ?, ?, ?)',
      [exchangeId, session.id, 'What is PCA?', 1, now]
    );

    await embedAndStoreExchange(
      exchangeId,
      'What is PCA?',
      'Principal Component Analysis is a dimensionality reduction technique.',
      { id: user.id, openai_api_key: 'mock' }
    );

    // Retrieve exchange
    const exchange = await db.get('SELECT embedding FROM exchanges WHERE id = ?', [exchangeId]);
    expect(exchange.embedding).not.toBeNull();

    const embeddingList = JSON.parse(exchange.embedding);
    expect(embeddingList.length).toBe(1536);
  });

  test('retrieveRelevantWeakAnswers checks similarity thresholds', async () => {
    const db = getDb();

    // Create two exchanges
    const exId1 = uuidv4();
    const exId2 = uuidv4();
    const now = new Date().toISOString();

    await db.run(
      'INSERT INTO exchanges (id, session_id, question, answer_transcript, question_index, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [exId1, session.id, 'What is overfitting?', 'It is when model is too complex.', 1, now]
    );
    await db.run(
      'INSERT INTO exchanges (id, session_id, question, answer_transcript, question_index, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [exId2, session.id, 'What is linear regression?', 'A linear model to predict value.', 2, now]
    );

    // Add scores
    const scoreId1 = uuidv4();
    const scoreId2 = uuidv4();
    await db.run(
      'INSERT INTO scores (id, exchange_id, technical_accuracy, follow_up_angle) VALUES (?, ?, ?, ?)',
      [scoreId1, exId1, 4, 'Explain regularization']
    );
    await db.run(
      'INSERT INTO scores (id, exchange_id, technical_accuracy, follow_up_angle) VALUES (?, ?, ?, ?)',
      [scoreId2, exId2, 5, 'Explain cost function']
    );

    // Embed them
    const mockUserObj = { id: user.id, openai_api_key: 'mock' };
    await embedAndStoreExchange(exId1, 'What is overfitting?', 'It is when model is too complex.', mockUserObj);
    await embedAndStoreExchange(exId2, 'What is linear regression?', 'A linear model to predict value.', mockUserObj);

    // Retrieve matching the query
    const results = await retrieveRelevantWeakAnswers(
      user.id,
      'Can you explain overfitting?',
      mockUserObj,
      3,
      7,
      0.1 // low threshold for mock
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].question).toBe('What is overfitting?');
    expect(results[0].technical_accuracy).toBe(4);
  });

  test('formatRetrievedContext formats string templates', () => {
    const results = [
      {
        question: 'What is overfitting?',
        answer_transcript: 'Too complex model.',
        technical_accuracy: 4,
        similarity: 0.95,
        topic: 'Machine Learning',
        follow_up_angle: 'Explain regularization',
      },
    ];

    const context = formatRetrievedContext(results);
    expect(context).toContain('Prior weak answers');
    expect(context).toContain('What is overfitting?');
    expect(context).toContain('Score: 4/10');
    expect(context).toContain('Explain regularization');

    expect(formatRetrievedContext([])).toBe('');
  });
});
