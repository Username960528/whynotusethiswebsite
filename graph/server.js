require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const DB = require('./js/data/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Rate limiting map (IP -> timestamp)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute

// Simple rate limiter middleware
const rateLimiter = (req, res, next) => {
     const ip = req.ip;
     const now = Date.now();

     if (!rateLimitMap.has(ip)) {
          rateLimitMap.set(ip, []);
     }

     const requests = rateLimitMap.get(ip).filter(time => now - time < RATE_LIMIT_WINDOW);
     requests.push(now);
     rateLimitMap.set(ip, requests);

     if (requests.length > RATE_LIMIT_MAX_REQUESTS) {
          return res.status(429).json({ error: 'Too many requests, please try again later.' });
     }

     next();
};

// Middleware
app.use(cors({
     origin: process.env.NODE_ENV === 'production' ? false : '*', // Disable CORS in production (same-origin only)
     methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));
app.use(rateLimiter); // Apply rate limiting globally

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.gemini_api_key);

// --- AUTH API ---
app.post('/api/login', (req, res) => {
     const { username } = req.body;
     if (!username) return res.status(400).json({ error: 'Username is required' });

     // In a real app, we would verify password here.
     // For this simple version, we just "log them in".
     res.json({ username, token: username });
});

// --- GRAPH API (SQLite) ---

// Create new graph
app.post('/api/graphs', async (req, res) => {
     try {
          const { name, username } = req.body;
          if (!name) return res.status(400).json({ error: 'Name is required' });
          const id = await DB.createGraph(name, username || 'anonymous');
          res.json({ id, message: 'Graph created' });
     } catch (error) {
          console.error('Error creating graph:', error);
          res.status(500).json({ error: 'Failed to create graph' });
     }
});

// Get graph by ID
app.get('/api/graphs/:id', async (req, res) => {
     try {
          const graph = await DB.getGraph(req.params.id);
          if (!graph) {
               return res.status(404).json({ error: 'Graph not found' });
          }
          res.json(graph);
     } catch (error) {
          console.error('Error loading graph:', error);
          res.status(500).json({ error: 'Failed to load graph' });
     }
});

// Update graph
app.put('/api/graphs/:id', async (req, res) => {
     try {
          const { nodes, edges, name } = req.body;
          if (!nodes || !edges) return res.status(400).json({ error: 'Nodes and edges are required' });
          await DB.updateGraph(req.params.id, nodes, edges, name);
          res.json({ message: 'Graph updated' });
     } catch (error) {
          console.error('Error updating graph:', error);
          res.status(500).json({ error: 'Failed to update graph' });
     }
});

// Get recent graphs
app.get('/api/graphs/recent', async (req, res) => {
     try {
          const { username } = req.query;
          const graphs = await DB.getRecentGraphs(10, username);
          res.json(graphs);
     } catch (error) {
          console.error('Error fetching recent graphs:', error);
          res.status(500).json({ error: 'Failed to fetch recent graphs' });
     }
});

// API endpoint to generate subconcepts
app.post('/api/expand-concept', async (req, res) => {
     try {
          const { concept, stack } = req.body;

          if (!concept) {
               return res.status(400).json({ error: 'Concept is required' });
          }

          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

          const stackContext = stack ? `Context: The user is learning QA Automation with this stack: ${stack}.` : '';

          const prompt = `You are a QA Automation knowledge expert. ${stackContext}
Given the concept "${concept}", provide exactly 3-4 related sub-concepts or topics that a QA engineer should learn.

Return ONLY a JSON array of strings, nothing else. Example format:
["Subconcept 1", "Subconcept 2", "Subconcept 3"]

Focus on practical, actionable topics related to QA automation, testing, and software quality within the specified stack (if any).`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();

          // Parse the JSON response
          const subconcepts = JSON.parse(text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, ''));

          res.json({ subconcepts });
     } catch (error) {
          console.error('Error expanding concept:', error);
          console.error('Full error:', JSON.stringify(error, null, 2));
          res.status(500).json({ error: 'Failed to generate subconcepts', details: error.message });
     }
});

// API endpoint to generate related topics (Moved from client-side)
app.post('/api/related-topics', async (req, res) => {
     try {
          const { topic, stackDescription, existingTopics } = req.body;

          if (!topic) return res.status(400).json({ error: 'Topic is required' });

          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

          const prompt = `Ты эксперт по QA Automation со специализацией на стеке: ${stackDescription || 'General QA'}.
    
Контекст: пользователь строит карту знаний для подготовки к собеседованию QA Automation инженера.
Технологический стек: ${stackDescription || 'General QA'}
Уже есть темы в графе: ${(existingTopics || []).join(', ') || 'пока нет'}

Новая тема: "${topic}"

ЗАДАЧА:
1. Найди 5-7 РАЗНООБРАЗНЫХ и ТЕСНО связанных тем для QA Automation.
2. КРИТИЧЕСКИ ВАЖНО: Если новая тема "${topic}" связана с какими-то из УЖЕ СУЩЕСТВУЮЩИХ тем (перечислены выше), ОБЯЗАТЕЛЬНО создай связь с ними!
   - Например, если в графе есть "Selenium", а мы добавляем "Page Object", то должна быть связь между ними.
   - Не дублируй существующие узлы, если они уже есть, просто создай связь.

ВАЖНО - покрывай разные аспекты:
- Для паттернов: Page Object Model, ScreenPlay, Factory, Builder, AAA Pattern
- Для инструментов: ТОЛЬКО те, что относятся к ${stackDescription}
- Для практик: методологии и best practices
- Для концепций: связанные технические темы

НЕ ВКЛЮЧАЙ инструменты из других стеков (например, НЕ советуй Java библиотеки для Python стека)!

Для каждой укажи:
1. topic: название темы (кратко, 1-4 слова). Если тема уже есть в списке существующих, используй ТОЧНО ТАКОЕ ЖЕ название.
2. description: краткое описание (МАКСИМУМ 100 символов!)
3. edgeType: тип связи ("causal" если prerequisite/следствие, "multiway" если альтернатива, "branchial" если та же категория)
4. relation: описание связи (2-4 слова)
5. category: одна из: Core, Tools, Patterns, Testing, Integration

Ответь ТОЛЬКО валидным JSON массивом:
[{"topic":"...", "description":"...", "edgeType":"causal|multiway|branchial", "relation":"...", "category":"..."}]`;

          const result = await model.generateContent({
               contents: [{ parts: [{ text: prompt }] }],
               generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024
               }
          });

          const response = await result.response;
          const text = response.text();

          // Clean up the response and parse JSON
          const cleanText = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
          const relatedTopics = JSON.parse(cleanText);

          res.json(relatedTopics);
     } catch (error) {
          console.error('Error generating related topics:', error);
          res.status(500).json({ error: 'Failed to generate related topics' });
     }
});

// API endpoint to find semantic relations between a new topic and existing candidates
app.post('/api/find-relations', async (req, res) => {
     try {
          const { topic, candidates } = req.body;

          if (!topic || !candidates || !Array.isArray(candidates)) {
               return res.status(400).json({ error: 'Topic and candidates array are required' });
          }

          if (candidates.length === 0) {
               return res.json([]);
          }

          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

          const prompt = `You are a Knowledge Graph expert.
Target Topic: "${topic}"
Candidate Topics: ${JSON.stringify(candidates)}

Identify which of the "Candidate Topics" are semantically related to the "Target Topic".
Ignore weak or generic connections. Focus on direct relationships (parent/child, dependency, alternative, part-of).

Return a JSON array of objects:
[
  {
    "id": "exact string from candidates list",
    "edgeType": "causal|multiway|branchial",
    "relation": "short description of relation (2-4 words)"
  }
]

If no strong relations found, return empty array [].`;

          const result = await model.generateContent({
               contents: [{ parts: [{ text: prompt }] }],
               generationConfig: {
                    temperature: 0.1, // Low temperature for precision
                    maxOutputTokens: 1024
               }
          });

          const response = await result.response;
          const text = response.text();
          const cleanText = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
          const relations = JSON.parse(cleanText);

          res.json(relations);
     } catch (error) {
          console.error('Error finding relations:', error);
          res.status(500).json({ error: 'Failed to find relations' });
     }
});

// API endpoint to generate quiz question
app.post('/api/generate-question', async (req, res) => {
     try {
          const { topics, stack, difficulty = 1, previousQuestions = [], nodeContext = '', topicWeights = {} } = req.body;

          if (!topics || topics.length === 0) {
               return res.status(400).json({ error: 'Topics are required' });
          }

          console.log(`🎯 Generating question - Topics: ${topics.join(', ')}, Difficulty: ${difficulty}`);
          if (nodeContext) console.log('📝 Using Node Context for RAG');
          if (Object.keys(topicWeights).length > 0) {
               console.log('🎯 Adaptive mode: prioritizing weak topics', topicWeights);
          }

          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

          const stackContext = stack ? `Tech Stack: ${stack}.` : '';
          const topicsStr = Array.isArray(topics) ? topics.join(', ') : topics;

          const ragContext = nodeContext ? `
          CONTEXT FROM USER'S KNOWLEDGE GRAPH:
          ${nodeContext}
          
          IMPORTANT: The user has explicitly studied the above context. PRIORITIZE generating a question that tests understanding of this specific content if possible.
          ` : '';

          let difficultyContext = '';
          if (difficulty <= 5) {
               difficultyContext = `
               DIFFICULTY: EASY (Level ${difficulty}/15).
               - Focus on DEFINITIONS, BASIC SYNTAX, and IDENTIFICATION.
               - Questions should be "What is...?", "Which keyword is used for...?", "What does this acronym stand for?".
               - Keep it simple. Avoid complex scenarios.
               - Answers should be simple and distinct.
               `;
          } else if (difficulty <= 10) {
               difficultyContext = `
               DIFFICULTY: MEDIUM (Level ${difficulty}/15).
               - Focus on APPLICATION, CODE SNIPPETS, and COMMON SCENARIOS.
               - Questions should be "How do you handle...?", "What is the output of this code?", "Which method is best for...?".
               - Include short code snippets if relevant to the stack.
               - Distractors should be plausible but incorrect.
               - IMPORTANT: For this level, TRY to include a small code snippet using Markdown (e.g. \`\`\`python).
               - ENSURE CODE IS CLEAN, READABLE, AND PROPERLY INDENTED.
               `;
          } else {
               difficultyContext = `
               DIFFICULTY: HARD (Level ${difficulty}/15).
               - Focus on ARCHITECTURE, PERFORMANCE, EDGE CASES, and INTERNALS.
               - Questions should be "Why would this fail?", "How does this work under the hood?", "Optimize this scenario".
               - Require deep understanding of the tool's lifecycle, memory management, or complex patterns.
               - Distractors should be very subtle (e.g., correct in other contexts but wrong here).
               
               IMPORTANT: For this level, YOU MUST include a code snippet in the question.
               
               FORMATTING RULES:
               1. Use Markdown code blocks with triple backticks (e.g., \`\`\`python ... \`\`\`).
               2. DO NOT include the language name inside the code block content (e.g. do NOT write "python var = 1").
               3. Ensure the code is properly indented (use 4 spaces or tabs) and readable.
               4. Add a blank line before and after the code block.
               5. Do not make the code block too wide; wrap long lines if necessary.
               `;
          }

          const previousQuestionsContext = previousQuestions.length > 0
               ? `\nDO NOT generate any of the following questions again:\n${previousQuestions.map(q => `- ${q}`).join('\n')}\n`
               : '';

          // Adaptive Selection Context
          let adaptiveContext = '';
          if (Object.keys(topicWeights).length > 0) {
               const weakTopics = Object.entries(topicWeights)
                    .filter(([_, weight]) => weight > 1.0)
                    .map(([topic, weight]) => `${topic} (needs practice, weight: ${weight.toFixed(2)})`)
                    .join(', ');

               adaptiveContext = `\n🎯 ADAPTIVE LEARNING MODE ACTIVE:
               The user needs extra practice on: ${weakTopics}
               
               INSTRUCTION: When possible, generate questions that focus specifically on these weak topics to help the user improve.
               `;
          }

          const prompt = `You are a QA Automation expert creating a "Who Wants to Be a Millionaire" style quiz question. ${stackContext}
${difficultyContext}
Topics: ${topicsStr}.
${ragContext}
${adaptiveContext}

IMPORTANT: Generate a COMPLETELY NEW and UNIQUE question.
${previousQuestionsContext}
Question #${difficulty} should be significantly harder than Question #${difficulty - 1}.

Generate a multiple-choice question related to the provided topics.
- If multiple topics are provided, try to find a connection between them.
- If they are unrelated, pick one at random but keep it relevant to QA Automation.

Return ONLY a JSON object in this exact format:
{
     "question": "Your question here? (Use Markdown for code snippets)",
     "answers": ["Answer A", "Answer B", "Answer C", "Answer D"],
     "correctIndex": 0,
     "explanation": "A concise explanation (1-2 sentences) of why the correct answer is right and/or why others are wrong. Educational and helpful."
}

The question must be appropriate for the requested difficulty level.
If a tech stack is provided (${stack}), ensure the question and answers are relevant to that stack.
correctIndex should be 0, 1, 2, or 3.

CRITICAL NEGATIVE CONSTRAINT:
When writing code snippets in the "answers" array, DO NOT start the snippet with the language name (e.g. "python", "java").
JUST WRITE THE CODE.
BAD: "python driver.get(url)"
GOOD: "driver.get(url)"`;

          const result = await model.generateContent({
               contents: [{ parts: [{ text: prompt }] }],
               generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 1024
               }
          });

          const response = await result.response;
          const text = response.text();

          // Clean up the response and parse JSON
          const cleanText = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
          const quizData = JSON.parse(cleanText);

          console.log(`✅ Generated question: "${quizData.question.substring(0, 60)}..."`);

          res.json(quizData);
     } catch (error) {
          console.error('Error generating question:', error);
          console.error('Full error:', JSON.stringify(error, null, 2));
          res.status(500).json({ error: 'Failed to generate question', details: error.message });
     }
});

// API endpoint to extract key concepts from quiz questions
app.post('/api/extract-concepts', async (req, res) => {
     try {
          const { question, correctAnswer, explanation } = req.body;

          if (!question) {
               return res.status(400).json({ error: 'Question text is required' });
          }

          console.log('🔍 Extracting concepts from question...');

          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

          const prompt = `You are a QA Automation expert. Extract 1-3 key technical concepts or topics from this quiz question that would be valuable to add to a knowledge graph.

Question: "${question}"
Correct Answer: "${correctAnswer || 'N/A'}"
Explanation: "${explanation || 'N/A'}"

For each concept, provide:
1. topic: A concise name (2-5 words max, e.g., "Selenium WebDriver", "Page Object Model")
2. description: Brief explanation (max 100 characters)
3. category: One of: Core, Patterns, Tools, Testing, Integration

Focus on extracting specific, actionable concepts like:
- Design patterns (e.g., "Page Object Model", "Factory Pattern")
- Technical terms (e.g., "StaleElementReferenceException", "Implicit Wait")
- Testing concepts (e.g., "Data-Driven Testing", "BDD")
- Tools/frameworks (e.g., "TestNG", "Cucumber")

Return ONLY a JSON array. Example:
[
  {
    "topic": "StaleElementReferenceException",
    "description": "Error when element reference is no longer valid in DOM",
    "category": "Core"
  }
]`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();

          // Clean and parse JSON
          const cleanText = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
          const concepts = JSON.parse(cleanText);

          console.log(`✅ Extracted ${concepts.length} concept(s):`, concepts.map(c => c.topic).join(', '));

          res.json({ concepts });
     } catch (error) {
          console.error('Error extracting concepts:', error);
          res.status(500).json({ error: 'Failed to extract concepts', details: error.message });
     }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
     res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
     console.log(`🚀 Server running on http://localhost:${PORT}`);
     console.log(`📊 Graph available at http://localhost:${PORT}/index.html`);
});
