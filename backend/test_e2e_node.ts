import axios from 'axios';
import { WebSocket } from 'ws';

const BASE = 'http://localhost:8000';
const WS_BASE = 'ws://localhost:8000';

async function runTests() {
  console.log('Starting E2E verification tests for Node.js backend...');

  const client = axios.create({
    baseURL: BASE,
    validateStatus: () => true // don't throw on non-2xx status codes
  });

  const email = `test_node_${Date.now()}@example.com`;

  // 1. Register
  console.log('\n=== 1. REGISTER ===');
  const regRes = await client.post('/auth/register', {
    email,
    password: 'testpass123',
    name: 'Test Node User'
  });
  console.log(`Status: ${regRes.status}`);
  if (regRes.status !== 201) {
    console.error('Registration failed!', regRes.data);
    process.exit(1);
  }
  const token = regRes.data.access_token;
  console.log(`User registered: ${regRes.data.user.name} (${regRes.data.user.email})`);
  
  const headers = { Authorization: `Bearer ${token}` };

  // 2. Create Session
  console.log('\n=== 2. CREATE SESSION ===');
  const sessRes = await client.post('/sessions/create', {
    topic: 'Machine Learning',
    difficulty: 'medium',
    duration_minutes: 30,
    total_questions: 5
  }, { headers });
  console.log(`Status: ${sessRes.status}`);
  if (sessRes.status !== 201) {
    console.error('Session creation failed!', sessRes.data);
    process.exit(1);
  }
  const session = sessRes.data;
  const sessionId = session.id;
  const firstQ = session.exchanges[0].question;
  console.log(`Session ID: ${sessionId}`);
  console.log(`First Question: ${firstQ}`);

  // 3. Submit Answer 1
  console.log('\n=== 3. SUBMIT ANSWER 1 ===');
  const ans1Res = await client.post('/answers/submit', {
    session_id: sessionId,
    answer_text: 'Supervised learning uses labeled data to train models, where each input has a corresponding target output. The model learns a mapping from inputs to outputs. Examples include linear regression for predicting house prices and classification tasks like spam detection. Unsupervised learning works with unlabeled data and finds hidden patterns or structures. Common examples include k-means clustering for customer segmentation and PCA for dimensionality reduction.'
  }, { headers });
  console.log(`Status: ${ans1Res.status}`);
  if (ans1Res.status !== 200) {
    console.error('Answer 1 submission failed!', ans1Res.data);
    process.exit(1);
  }
  const result1 = ans1Res.data;
  console.log(`Score: ${result1.evaluation.technical_accuracy}/10`);
  console.log(`Definition Present: ${result1.evaluation.definition_present}`);
  console.log(`Mechanism Explained: ${result1.evaluation.mechanism_explained}`);
  console.log(`Example Given: ${result1.evaluation.example_given}`);
  console.log(`Next Question: ${result1.next_question?.substring(0, 80)}...`);
  console.log(`Session Complete: ${result1.session_complete}`);

  // 4. Submit Answer 2 (Weak)
  console.log('\n=== 4. SUBMIT ANSWER 2 (WEAK) ===');
  const ans2Res = await client.post('/answers/submit', {
    session_id: sessionId,
    answer_text: "It's about tradeoffs in ML models."
  }, { headers });
  console.log(`Status: ${ans2Res.status}`);
  if (ans2Res.status !== 200) {
    console.error('Answer 2 submission failed!', ans2Res.data);
    process.exit(1);
  }
  const result2 = ans2Res.data;
  console.log(`Score: ${result2.evaluation.technical_accuracy}/10`);
  console.log(`Next Question: ${result2.next_question?.substring(0, 80)}...`);

  // 5. Dashboard
  console.log('\n=== 5. DASHBOARD ===');
  const dashRes = await client.get('/users/me/dashboard', { headers });
  console.log(`Status: ${dashRes.status}`);
  if (dashRes.status !== 200) {
    console.error('Dashboard load failed!', dashRes.data);
    process.exit(1);
  }
  const dash = dashRes.data;
  console.log(`Total Sessions: ${dash.total_sessions}`);
  console.log(`Avg Score: ${dash.avg_score}`);
  console.log(`Questions Answered: ${dash.total_questions_answered}`);

  // 6. WebSocket Proctored Connection
  console.log('\n=== 6. WEBSOCKET TELEMETRY ===');
  const wsUrl = `${WS_BASE}/ws/${sessionId}?token=${token}`;
  const ws = new WebSocket(wsUrl);

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      console.log('WebSocket connected successfully.');
      
      // Send behavioral signals (face count 2 to trigger a proctoring flag)
      console.log('Sending mock telemetry signal...');
      ws.send(JSON.stringify({
        type: 'behavioral_signal',
        payload: {
          timestamp: Date.now(),
          face_count: 2,
          gaze: { x: 0.1, y: 0.1 },
          head_pose: { yaw: 5, pitch: 5 }
        }
      }));

      // Send heartbeat to trigger a WS response and close properly
      ws.send(JSON.stringify({ type: 'heartbeat' }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('WS Message Received:', msg);
      if (msg.type === 'ack') {
        ws.close();
        resolve();
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket Error:', err);
      reject(err);
    });
  });

  console.log('\n=== ALL TESTS PASSED ===');
}

runTests().catch(err => {
  console.error('Test run error:', err);
  process.exit(1);
});
