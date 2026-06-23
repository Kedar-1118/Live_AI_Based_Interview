"""End-to-end test for the Week 1 interview loop."""
import httpx
import json

BASE = "http://localhost:8000"

def test_full_loop():
    client = httpx.Client(base_url=BASE)

    # 1. Register
    print("=== REGISTER ===")
    r = client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "testpass123",
        "name": "Test User"
    })
    print(f"Status: {r.status_code}")
    data = r.json()
    print(f"User: {data.get('user', {}).get('name')}")
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print()

    # 2. Create Session
    print("=== CREATE SESSION ===")
    r = client.post("/sessions/create", json={
        "topic": "Machine Learning",
        "difficulty": "medium",
        "duration_minutes": 30,
        "total_questions": 5
    }, headers=headers)
    print(f"Status: {r.status_code}")
    session = r.json()
    session_id = session["id"]
    first_q = session["exchanges"][0]["question"]
    print(f"Session ID: {session_id}")
    print(f"First Question: {first_q}")
    print()

    # 3. Submit Answer
    print("=== SUBMIT ANSWER 1 ===")
    r = client.post("/answers/submit", json={
        "session_id": session_id,
        "answer_text": "Supervised learning uses labeled data to train models, where each input has a corresponding target output. The model learns a mapping from inputs to outputs. Examples include linear regression for predicting house prices and classification tasks like spam detection. Unsupervised learning works with unlabeled data and finds hidden patterns or structures. Common examples include k-means clustering for customer segmentation and PCA for dimensionality reduction."
    }, headers=headers)
    print(f"Status: {r.status_code}")
    result = r.json()
    eval_data = result["evaluation"]
    print(f"Score: {eval_data['technical_accuracy']}/10")
    print(f"Definition: {eval_data['definition_present']}")
    print(f"Mechanism: {eval_data['mechanism_explained']}")
    print(f"Example: {eval_data['example_given']}")
    print(f"Next Question: {result.get('next_question', 'N/A')[:80]}...")
    print(f"Session Complete: {result['session_complete']}")
    print()

    # 4. Submit a short/weak answer
    print("=== SUBMIT ANSWER 2 (WEAK) ===")
    r = client.post("/answers/submit", json={
        "session_id": session_id,
        "answer_text": "It's about tradeoffs in ML models."
    }, headers=headers)
    print(f"Status: {r.status_code}")
    result = r.json()
    eval_data = result["evaluation"]
    print(f"Score: {eval_data['technical_accuracy']}/10")
    print(f"Next Question: {result.get('next_question', 'N/A')[:80]}...")
    print()

    # 5. Dashboard
    print("=== DASHBOARD ===")
    r = client.get("/users/me/dashboard", headers=headers)
    print(f"Status: {r.status_code}")
    dash = r.json()
    print(f"Total Sessions: {dash['total_sessions']}")
    print(f"Avg Score: {dash['avg_score']}")
    print(f"Questions Answered: {dash['total_questions_answered']}")
    print()

    print("=== ALL TESTS PASSED ===")


if __name__ == "__main__":
    test_full_loop()
