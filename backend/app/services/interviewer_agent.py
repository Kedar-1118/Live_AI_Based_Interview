import logging
import random
from app.config import get_settings
from app.schemas.schemas import EvaluationResult

logger = logging.getLogger(__name__)
settings = get_settings()

INTERVIEWER_SYSTEM_PROMPT = """You are an experienced technical interviewer conducting a {topic} interview at {difficulty} level.

Your behavior:
1. Ask one question at a time. Never multiple questions.
2. After receiving an answer evaluation, decide:
   - If strong (score >= 8): move to next topic, increase difficulty slightly
   - If medium (score 5-7): ask one follow-up probing the weakest dimension
   - If weak (score < 5): ask a simpler version to check fundamental understanding
3. Reference prior answers naturally. Example: "Earlier you mentioned X — how does that relate to Y?"
4. Never give hints or confirm correctness mid-interview.
5. After 3 consecutive weak answers on a topic, move on — don't torture the candidate.

Current question number: {question_index} of {total_questions}
Session topic: {topic}
Running performance: {performance_summary}

{context_section}

Respond with ONLY the next question. No preamble. No explanation."""


# Fallback question banks for mock mode
MOCK_QUESTIONS = {
    "Machine Learning": [
        "What is the difference between supervised and unsupervised learning? Provide examples of each.",
        "Explain the bias-variance tradeoff. How does it affect model performance?",
        "What is gradient descent and how does it work? What are its variants?",
        "Explain what overfitting is and describe three techniques to prevent it.",
        "What is the difference between L1 and L2 regularization?",
        "Explain how a Random Forest works. What are its advantages over a single decision tree?",
        "What is cross-validation? Why is it important in model evaluation?",
        "Explain the concept of feature engineering. Give examples of common techniques.",
        "What is the curse of dimensionality? How does it affect machine learning models?",
        "Describe how a neural network learns through backpropagation.",
        "What is transfer learning and when would you use it?",
        "Explain precision, recall, and F1-score. When would you prioritize one over another?",
    ],
    "System Design": [
        "How would you design a URL shortening service like bit.ly?",
        "Design a rate limiter. What algorithms would you consider?",
        "How would you design a real-time chat application?",
        "Explain the CAP theorem and its implications for distributed systems.",
        "How would you design a notification system that handles millions of users?",
        "Design a caching strategy for a high-traffic web application.",
        "How would you design a file storage service like Google Drive?",
        "Explain the differences between horizontal and vertical scaling.",
        "How would you design a load balancer?",
        "Design a search autocomplete system. What data structures would you use?",
    ],
    "DSA": [
        "What is the difference between an array and a linked list? When would you choose one over the other?",
        "Explain how a hash table works internally. How are collisions handled?",
        "What is the time complexity of common sorting algorithms? When would you use each?",
        "Explain BFS and DFS. When would you use one over the other?",
        "What is dynamic programming? Walk me through solving a classic DP problem.",
        "Explain the concept of a balanced binary search tree. Why is balancing important?",
        "What is a graph? Describe different ways to represent a graph in memory.",
        "Explain the difference between a stack and a queue. Give real-world examples.",
        "What is the significance of Big O notation? Analyze the complexity of a nested loop.",
        "Explain what a heap is and describe its common applications.",
    ],
    "OS": [
        "What is the difference between a process and a thread?",
        "Explain virtual memory. Why is it important?",
        "What is a deadlock? What are the four conditions required for a deadlock?",
        "Explain the difference between paging and segmentation.",
        "What is a semaphore? How does it differ from a mutex?",
        "Describe the different CPU scheduling algorithms.",
        "What is thrashing? How can it be prevented?",
        "Explain the difference between user mode and kernel mode.",
        "What is a file system? Compare different file system types.",
        "Explain how inter-process communication works.",
    ],
    "Networking": [
        "Explain the OSI model and the role of each layer.",
        "What is the difference between TCP and UDP? When would you use each?",
        "How does DNS resolution work? Walk through the full process.",
        "What happens when you type a URL in the browser and press Enter?",
        "Explain the three-way handshake in TCP.",
        "What is the difference between HTTP and HTTPS?",
        "Explain what a CDN is and how it improves performance.",
        "What are the differences between IPv4 and IPv6?",
        "Explain subnetting. How do you calculate the number of hosts in a subnet?",
        "What is NAT? Why is it used?",
    ],
}


async def generate_first_question(topic: str, difficulty: str) -> str:
    """Generate the first question for a new interview session."""
    if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY == "your-anthropic-api-key-here":
        logger.info("No Anthropic API key — using mock questions")
        return _get_mock_question(topic, 0)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        prompt = f"""You are an experienced technical interviewer starting a {topic} interview at {difficulty} level.

Generate the first question for the interview. It should be an opening question appropriate for the {difficulty} level.

Respond with ONLY the question. No preamble. No explanation."""

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )

        return response.content[0].text.strip()

    except Exception as e:
        logger.error(f"Interviewer agent error: {e} — using mock question")
        return _get_mock_question(topic, 0)


async def generate_next_question(
    topic: str,
    difficulty: str,
    evaluation: EvaluationResult,
    question_index: int,
    total_questions: int,
    performance_summary: str,
    retrieved_context: str = "",
) -> str:
    """
    Generate the next interview question based on the evaluation of the previous answer.
    Implements adaptive follow-up logic from the spec.
    """
    if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY == "your-anthropic-api-key-here":
        logger.info("No Anthropic API key — using mock questions")
        return _get_mock_question(topic, question_index - 1)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        # Build context section
        context_parts = []
        if evaluation.follow_up_angle:
            context_parts.append(
                f"Follow-up angle from evaluator: {evaluation.follow_up_angle}"
            )
        if retrieved_context:
            context_parts.append(
                f"Prior weak answers retrieved from memory:\n{retrieved_context}"
            )

        # Determine mode
        score = evaluation.technical_accuracy
        if score >= 8:
            context_parts.append(
                "The candidate answered strongly. Move to a new, slightly harder topic."
            )
        elif score >= 5:
            context_parts.append(
                f"The candidate's answer was moderate (score: {score}/10). "
                f"Ask a follow-up probing: {evaluation.follow_up_angle}"
            )
        else:
            context_parts.append(
                f"The candidate's answer was weak (score: {score}/10). "
                "Ask a simpler version to check fundamental understanding."
            )

        context_section = "\n".join(context_parts)

        prompt = INTERVIEWER_SYSTEM_PROMPT.format(
            topic=topic,
            difficulty=difficulty,
            question_index=question_index,
            total_questions=total_questions,
            performance_summary=performance_summary,
            context_section=context_section,
        )

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )

        return response.content[0].text.strip()

    except Exception as e:
        logger.error(f"Interviewer agent error: {e} — using mock question")
        return _get_mock_question(topic, question_index - 1)


def _get_mock_question(topic: str, index: int) -> str:
    """Get a mock question from the question bank."""
    questions = MOCK_QUESTIONS.get(topic, MOCK_QUESTIONS["Machine Learning"])
    if index < len(questions):
        return questions[index]
    # If we run out, pick a random one
    return random.choice(questions)
