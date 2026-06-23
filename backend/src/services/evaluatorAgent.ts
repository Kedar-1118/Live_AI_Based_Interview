import { generateChatCompletion, checkAndGetApiKey } from './aiProvider';

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
  provider: string,
  model: string,
  user: any,
  maxRetries: number = 2
): Promise<EvaluationResult> {
  const normalizedProvider = provider.toLowerCase();

  if (normalizedProvider === 'mock') {
    return mockEvaluate(question, transcript, topic);
  }

  try {
    const apiKey = await checkAndGetApiKey(user.id, provider, user);
    
    const formattedPrompt = EVALUATOR_SYSTEM_PROMPT
      .replace('{question}', question)
      .replace('{topic}', topic)
      .replace('{transcript}', transcript);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        let raw = await generateChatCompletion(
          provider,
          model,
          {
            userPrompt: formattedPrompt,
            jsonMode: true,
          },
          apiKey
        );

        raw = raw.trim();

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
  } catch (err: any) {
    console.error('Evaluator agent error:', err);
    // If the error was a limit exceeded error, we should bubble it up
    if (err.status === 402) {
      throw err;
    }
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
