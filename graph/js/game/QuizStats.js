/**
 * QuizStats - Quiz performance statistics tracking
 * Tracks correct/incorrect answers by topic and provides analytics
 */

export class QuizStats {
     static STORAGE_KEY = 'quiz_statistics';
     static WEAK_THRESHOLD = 0.6; // 60% accuracy threshold

     /**
      * Get all statistics from localStorage
      */
     static getStats() {
          const data = localStorage.getItem(this.STORAGE_KEY);
          if (!data) {
               return {
                    stats: {},
                    sessionHistory: []
               };
          }
          return JSON.parse(data);
     }

     /**
      * Save statistics to localStorage
      */
     static saveStats(statsData) {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(statsData));
     }

     /**
      * Record a quiz answer
      * @param {Array<string>} topics - Topics covered in the question
      * @param {boolean} isCorrect - Whether answer was correct
      * @param {number} difficulty - Question difficulty level (1-15)
      * @param {string} category - Topic category (optional)
      */
     static recordAnswer(topics, isCorrect, difficulty, category = null) {
          const statsData = this.getStats();
          const timestamp = new Date().toISOString();

          // Update per-topic statistics
          topics.forEach(topic => {
               if (!statsData.stats[topic]) {
                    statsData.stats[topic] = {
                         correct: 0,
                         incorrect: 0,
                         category: category || 'Unknown',
                         lastAttempt: timestamp
                    };
               }

               if (isCorrect) {
                    statsData.stats[topic].correct++;
               } else {
                    statsData.stats[topic].incorrect++;
               }
               statsData.stats[topic].lastAttempt = timestamp;
          });

          // Add to session history
          topics.forEach(topic => {
               statsData.sessionHistory.push({
                    date: timestamp,
                    topic,
                    correct: isCorrect,
                    difficulty,
                    category: category || statsData.stats[topic].category
               });
          });

          // Keep only last 100 history entries
          if (statsData.sessionHistory.length > 100) {
               statsData.sessionHistory = statsData.sessionHistory.slice(-100);
          }

          this.saveStats(statsData);
          console.log(`📊 Recorded ${isCorrect ? 'correct' : 'incorrect'} answer for: ${topics.join(', ')}`);
     }

     /**
      * Get accuracy rate for a specific topic
      * @param {string} topic - Topic name
      * @returns {number} Accuracy (0.0 to 1.0) or null if no data
      */
     static getTopicAccuracy(topic) {
          const statsData = this.getStats();
          const topicStats = statsData.stats[topic];

          if (!topicStats) return null;

          const total = topicStats.correct + topicStats.incorrect;
          if (total === 0) return null;

          return topicStats.correct / total;
     }

     /**
      * Get topics with accuracy below threshold (weak topics)
      * @param {number} threshold - Accuracy threshold (default 0.6 = 60%)
      * @param {number} minAttempts - Minimum attempts to consider (default 2)
      * @returns {Array<{topic: string, accuracy: number, attempts: number}>}
      */
     static getWeakTopics(threshold = this.WEAK_THRESHOLD, minAttempts = 2) {
          const statsData = this.getStats();
          const weakTopics = [];

          for (const [topic, stats] of Object.entries(statsData.stats)) {
               const total = stats.correct + stats.incorrect;

               if (total >= minAttempts) {
                    const accuracy = stats.correct / total;

                    if (accuracy < threshold) {
                         weakTopics.push({
                              topic,
                              accuracy,
                              attempts: total,
                              category: stats.category
                         });
                    }
               }
          }

          // Sort by accuracy (lowest first) then by attempts (most first)
          return weakTopics.sort((a, b) => {
               if (Math.abs(a.accuracy - b.accuracy) < 0.01) {
                    return b.attempts - a.attempts;
               }
               return a.accuracy - b.accuracy;
          });
     }

     /**
      * Get topic weights for adaptive selection
      * Returns object with topics as keys and weights as values (1.0 = normal, >1.0 = prioritize)
      */
     static getTopicWeights() {
          const weakTopics = this.getWeakTopics();
          const weights = {};

          weakTopics.forEach(({ topic, accuracy }) => {
               // Lower accuracy = higher weight
               // 40% accuracy → 1.6x weight, 50% → 1.4x, etc.
               weights[topic] = 1.0 + (this.WEAK_THRESHOLD - accuracy);
          });

          return weights;
     }

     /**
      * Get overall statistics summary
      */
     static getSummary() {
          const statsData = this.getStats();
          let totalCorrect = 0;
          let totalIncorrect = 0;
          const categoryStats = {};

          for (const [topic, stats] of Object.entries(statsData.stats)) {
               totalCorrect += stats.correct;
               totalIncorrect += stats.incorrect;

               const category = stats.category;
               if (!categoryStats[category]) {
                    categoryStats[category] = { correct: 0, incorrect: 0 };
               }
               categoryStats[category].correct += stats.correct;
               categoryStats[category].incorrect += stats.incorrect;
          }

          const total = totalCorrect + totalIncorrect;
          const overallAccuracy = total > 0 ? totalCorrect / total : 0;

          return {
               overallAccuracy,
               totalQuestions: total,
               totalCorrect,
               totalIncorrect,
               topicCount: Object.keys(statsData.stats).length,
               categoryStats,
               weakTopicsCount: this.getWeakTopics().length
          };
     }

     /**
      * Clear all statistics (for testing or reset)
      */
     static clearStats() {
          localStorage.removeItem(this.STORAGE_KEY);
          console.log('📊 Statistics cleared');
     }

     /**
      * Export statistics as JSON for download/backup
      */
     static exportStats() {
          return this.getStats();
     }

     /**
      * Import statistics from JSON
      */
     static importStats(statsData) {
          this.saveStats(statsData);
          console.log('📊 Statistics imported');
     }
}
