export async function fetchQuestion(topics, stackDescription, difficulty = 1, previousQuestions = [], nodeContext = '', topicWeights = {}) {
     const response = await fetch('/api/generate-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
               topics: Array.isArray(topics) ? topics : [topics],
               stack: stackDescription,
               difficulty,
               previousQuestions,
               nodeContext,
               topicWeights, // New parameter for adaptive selection
               timestamp: Date.now() // Prevent caching
          })
     });

     if (!response.ok) throw new Error('Failed to fetch question');
     return await response.json();
}

export async function getRelatedTopics(topic, apiKey, stackDescription, stackExamples, existingTopics) {
     const response = await fetch('/api/related-topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
               topic,
               stackDescription,
               existingTopics
          })
     });

     if (!response.ok) {
          throw new Error('API Error: ' + response.status);
     }

     return await response.json();
}

export async function findSemanticRelations(topic, candidates) {
     const response = await fetch('/api/find-relations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
               topic,
               candidates
          })
     });

     if (!response.ok) {
          throw new Error('API Error: ' + response.status);
     }

     return await response.json();
}
