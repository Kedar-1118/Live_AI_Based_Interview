import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

export interface EvaluationResult {
  technical_accuracy: number;
  definition_present: boolean;
  mechanism_explained: boolean;
  example_given: boolean;
  edge_cases_mentioned: boolean;
  missing_concepts: string[];
  incorrect_statements: string[];
  follow_up_angle: string;
  answer_summary: string;
}

const EVALUATOR_SYSTEM_PROMPT = `You are a technical interview evaluator. Assess the following answer strictly and honestly.

Question: {question}
Topic: {topic}
Candidate's Answer: {transcript}

Return ONLY valid JSON. No preamble. No markdown. No explanation.

{{
  "technical_accuracy": <1-10>,
  "definition_present": <true|false>,
  "mechanism_explained": <true|false>,
  "example_given": <true|false>,
  "edge_cases_mentioned": <true|false>,
  "missing_concepts": ["concept1", "concept2"],
  "incorrect_statements": ["statement1"],
  "follow_up_angle": "<what specific aspect to probe next>",
  "answer_summary": "<one sentence summary of what was said>"
}}`;

export async function evaluateAnswer(
  question: string,
  transcript: string,
  topic: string,
  maxRetries: number = 2
): Promise<EvaluationResult> {
  const isMock = !config.ANTHROPIC_API_KEY || config.ANTHROPIC_API_KEY === 'your-anthropic-api-key-here';

  if (isMock) {
    console.log('No Anthropic API key configured — using mock evaluator');
    return mockEvaluate(question, transcript, topic);
  }

  try {
    const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    const prompt = EVALUATOR_SYSTEM_PROMPT
      .replace('{question}', question)
      .replace('{topic}', topic)
      .replace('{transcript}', transcript);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        });

        let raw = '';
        if (response.content && response.content[0] && response.content[0].type === 'text') {
          raw = response.content[0].text.trim();
        } else {
          throw new Error('Invalid response content type from Anthropic');
        }

        // Clean markdown code blocks if wrapped
        if (raw.startsWith('```')) {
          const parts = raw.split('```');
          raw = parts[1];
          if (raw.startsWith('json')) {
            raw = raw.substring(4);
          }
          raw = raw.trim();
        }

        const evaluationData: EvaluationResult = JSON.parse(raw);
        return evaluationData;
      } catch (err) {
        console.warn(`Evaluator parse attempt ${attempt + 1} failed:`, err);
        if (attempt === maxRetries) {
          console.error('All evaluator retries exhausted — using mock');
          return mockEvaluate(question, transcript, topic);
        }
      }
    }
  } catch (err) {
    console.error('Evaluator agent error:', err);
    return mockEvaluate(question, transcript, topic);
  }

  return mockEvaluate(question, transcript, topic);
}

function mockEvaluate(question: string, transcript: string, topic: string): EvaluationResult {
  const words = transcript.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  let accuracy = 2;
  if (wordCount > 100) {
    accuracy = 7;
  } else if (wordCount > 50) {
    accuracy = 5;
  } else if (wordCount > 20) {
    accuracy = 4;
  }

  const transcriptLower = transcript.toLowerCase();

  return {
    technical_accuracy: accuracy,
    definition_present: wordCount > 30,
    mechanism_explained: wordCount > 60,
    example_given: transcriptLower.includes('example') || transcriptLower.includes('for instance'),
    edge_cases_mentioned: transcriptLower.includes('edge') || transcriptLower.includes('corner'),
    missing_concepts: ['Could elaborate more on core mechanisms'],
    incorrect_statements: [],
    follow_up_angle: 'Probe deeper into the underlying mechanism and real-world applications',
    answer_summary: `Candidate provided a ${wordCount > 50 ? 'detailed' : 'brief'} answer about ${topic}.`,
  };
}
