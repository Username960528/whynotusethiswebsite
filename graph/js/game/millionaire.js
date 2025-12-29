import { fetchQuestion } from '../ai/gemini.js';
import { getStackInfo } from '../ui/sidebar.js';
import { QuizStats } from './QuizStats.js';
import { addNodesFromQuiz } from '../main.js';

export class MillionaireGame {
     constructor() {
          this.currentLevel = 0;
          this.moneyLadder = [
               500, 1000, 2000, 3000, 5000,
               7500, 10000, 15000, 25000, 50000,
               100000, 250000, 500000, 1000000
          ];
          this.safeHavens = [4, 9]; // Guaranteed sums at level 5 (5000) and 10 (50000)
          this.selectedTopicsData = [];
          this.previousQuestions = [];
          this.isGameActive = false;

          // Lifelines state
          this.lifelines = {
               fiftyFifty: true,
               comlink: true,
               survey: true
          };

          this.currentQuestionData = null; // Store current question data for lifelines

          // Gamification State
          this.timerInterval = null;
          this.timeLeft = 30;
          this.usedSecondChance = false;

          // Audio Context
          this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

          // Sound Settings (load from localStorage)
          this.soundEnabled = localStorage.getItem('millionaire_sound') !== 'false';
     }

     start(topicsData) {
          // topicsData can be array of strings (legacy) or array of objects {topic, description}
          this.selectedTopicsData = Array.isArray(topicsData) ? topicsData : [topicsData];

          // Normalize to objects if strings
          this.selectedTopicsData = this.selectedTopicsData.map(item =>
               typeof item === 'string' ? { topic: item, description: '' } : item
          );

          this.previousQuestions = [];
          this.currentLevel = 0;
          this.isGameActive = true;
          this.usedSecondChance = false; // Reset Second Chance

          // Reset lifelines
          this.lifelines = {
               fiftyFifty: true,
               comlink: true,
               survey: true
          };

          this.showGameUI();
          this.renderLifelines();
          this.initSoundToggle();
          this.loadNextQuestion();
     }

     async loadNextQuestion() {
          this.stopTimer(); // Stop previous timer
          this.updateUIState('loading');
          this.clearLifelineResults();
          document.getElementById('explanation-area').style.display = 'none';
          document.getElementById('second-chance-badge').style.display = 'none';

          try {
               const { description: stackDescription } = getStackInfo();
               // Difficulty 1-15 based on level (0-14) + 1
               const difficulty = this.currentLevel + 1;
               console.log(`📊 Loading question for level ${this.currentLevel + 1}, difficulty: ${difficulty}`);

               const topics = this.selectedTopicsData.map(d => d.topic);
               const nodeContext = this.selectedTopicsData.map(d => `${d.topic}: ${d.description}`).join('\n');

               // Adaptive Selection: Get weak topics for targeted practice
               const topicWeights = QuizStats.getTopicWeights();
               this.isAdaptiveMode = Object.keys(topicWeights).length > 0;

               if (this.isAdaptiveMode) {
                    console.log(`🎯 Adaptive mode active: targeting weak topics`, topicWeights);
               }

               const data = await fetchQuestion(topics, stackDescription, difficulty, this.previousQuestions, nodeContext, topicWeights);
               console.log(`✅ Received question: "${data.question.substring(0, 50)}..."`);

               // Add to history to prevent repetition
               this.previousQuestions.push(data.question);
               this.currentQuestionData = data;

               this.displayQuestion(data);
               this.updateUIState('playing');
               this.updateDifficultyMeter(difficulty);

               // Start Timer
               const duration = difficulty <= 5 ? 30 : 60;
               this.startTimer(duration);

          } catch (error) {
               console.error(error);
               alert('Error loading question: ' + error.message);
               this.endGame();
          }
     }

     cleanContent(text) {
          if (!text) return '';

          // 1. Aggressively remove language prefixes
          const langPrefixes = ['python', 'java', 'javascript', 'js', 'typescript', 'ruby', 'c#', 'bash', 'shell'];
          const prefixRegex = new RegExp(`^(${langPrefixes.join('|')})[:\\s]+`, 'i');
          text = text.replace(prefixRegex, '');

          // 2. Auto-detect code that isn't formatted
          // Only wrap if it looks like code and NOT like a normal sentence

          // Check if it already has backticks
          if (text.includes('`')) return text;

          const hasCodeChars = /[\=\.\{\}\[\]\(\)]/.test(text);
          const hasSpaces = text.includes(' ');
          const startsWithCapital = /^[A-Z]/.test(text);
          const endsWithPeriod = /\.$/.test(text.trim());

          // Heuristic: It is a "Normal Sentence" if:
          // 1. Starts with Capital
          // 2. Has spaces
          // 3. Ends with Period
          // 4. Does NOT contain obvious code operators like = (assignment), {} (blocks), [] (arrays), => (arrow)
          // Note: We allow (.) and () in sentences, but if it's a short string with just method(), it's code.

          const isSentence = startsWithCapital && hasSpaces && endsWithPeriod && !text.includes('=') && !text.includes('{') && !text.includes('}') && !text.includes('[') && !text.includes(']');

          if (hasCodeChars && !isSentence) {
               // If it has newlines, make it a block
               if (text.includes('\n')) {
                    text = '```\n' + text + '\n```';
               } else {
                    // Single line
                    // Only wrap if it's not just a simple text with a period
                    // If it has spaces, it might be "val = 1", which is code.
                    // If it has no spaces, it might be "method()", which is code.
                    text = '`' + text + '`';
               }
          }

          return text;
     }

     displayQuestion(data) {
          const questionEl = document.getElementById('millionaire-question');
          const answersContainer = document.getElementById('millionaire-answers');

          // Clean and Render Markdown
          let questionText = this.cleanContent(data.question);
          let questionHtml = marked.parse(questionText);

          if (this.isAdaptiveMode) {
               questionHtml += '<div class="weak-topic-indicator" style="margin-top: 10px; font-size: 0.8rem; display: inline-block;">🎯 Adaptive Mode: Targeting Weak Topics</div>';
          }

          questionEl.innerHTML = questionHtml;
          answersContainer.innerHTML = '';

          data.answers.forEach((answer, index) => {
               const btn = document.createElement('button');
               btn.className = 'millionaire-answer-btn';
               btn.id = `answer-btn-${index}`;

               // Clean answer text
               let answerText = this.cleanContent(answer);

               // Use marked.parse to support code blocks
               const answerHtml = marked.parse(answerText);

               // Structure with flexbox
               btn.innerHTML = `
                    <div class="answer-letter">${String.fromCharCode(65 + index)}:</div>
                    <div class="answer-content">${answerHtml}</div>
               `;

               btn.onclick = () => this.handleAnswer(index, data.correctIndex, btn);
               answersContainer.appendChild(btn);
          });

          this.updateLadderUI();

          // Apply syntax highlighting
          if (window.hljs) {
               hljs.highlightAll();
          }
     }

     handleAnswer(selectedIndex, correctIndex, btn) {
          if (!this.isGameActive) return;

          this.stopTimer(); // Stop timer on answer

          const isCorrect = selectedIndex === correctIndex;

          if (isCorrect) {
               btn.classList.add('correct');
               this.playSound('correct');

               // Disable all buttons
               const allBtns = document.querySelectorAll('.millionaire-answer-btn');
               allBtns.forEach(b => b.disabled = true);

               this.showExplanation(true);
          } else {
               // Second Chance Logic
               if (this.currentLevel < 5 && !this.usedSecondChance) {
                    this.usedSecondChance = true;
                    btn.classList.add('wrong');
                    btn.disabled = true; // Disable just this button
                    this.playSound('wrong'); // Or a specific "oops" sound

                    // Show Second Chance UI
                    const badge = document.getElementById('second-chance-badge');
                    badge.style.display = 'block';
                    badge.textContent = "🛡️ Second Chance Used! Try again.";

                    // Resume timer? Or give fixed time? Let's just resume/restart
                    this.startTimer(15); // Give 15s extra
                    return; // EXIT FUNCTION, DO NOT END GAME
               }

               btn.classList.add('wrong');
               // Highlight correct answer
               const correctBtn = document.getElementById(`answer-btn-${correctIndex}`);
               if (correctBtn) correctBtn.classList.add('correct');

               // Disable all buttons
               const allBtns = document.querySelectorAll('.millionaire-answer-btn');
               allBtns.forEach(b => b.disabled = true);

               this.playSound('wrong');
               this.showExplanation(false);
          }
     }

     showExplanation(isCorrect) {
          const explanationArea = document.getElementById('explanation-area');
          const explanationText = document.getElementById('explanation-text');
          const nextBtn = document.getElementById('next-question-btn');

          const explanation = this.currentQuestionData.explanation || "No explanation provided.";
          explanationText.textContent = explanation;

          // Record answer in statistics
          const topics = this.selectedTopicsData.map(d => d.topic);
          const category = this.selectedTopicsData[0]?.category || 'Unknown';
          QuizStats.recordAnswer(topics, isCorrect, this.currentLevel + 1, category);

          explanationArea.style.display = 'block';

          // Scroll to explanation
          explanationArea.scrollIntoView({ behavior: 'smooth' });

          if (isCorrect) {
               nextBtn.textContent = this.currentLevel + 1 >= this.moneyLadder.length ? "Finish Game 🏆" : "Next Question ➡️";
               nextBtn.onclick = () => {
                    this.currentLevel++;
                    if (this.currentLevel >= this.moneyLadder.length) {
                         this.winGame();
                    } else {
                         this.loadNextQuestion();
                    }
               };
          } else {
               // Wrong answer - add "Add to Graph" button
               const addToGraphContainer = document.createElement('div');
               addToGraphContainer.id = 'add-to-graph-container';
               addToGraphContainer.style.marginBottom = '15px';

               const addToGraphBtn = document.createElement('button');
               addToGraphBtn.className = 'add-to-graph-btn';
               addToGraphBtn.innerHTML = '➕ Add This Topic to Knowledge Graph';
               addToGraphBtn.onclick = () => this.showAddToGraphModal();

               addToGraphContainer.appendChild(addToGraphBtn);

               // Insert before next button
               explanationArea.insertBefore(addToGraphContainer, nextBtn);

               nextBtn.textContent = "Finish Game ❌";
               nextBtn.onclick = () => this.gameOver();
          }
     }

     async showAddToGraphModal() {
          try {
               console.log('🔍 Extracting concepts from question...');

               // Extract concepts using AI
               const response = await fetch('/api/extract-concepts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                         question: this.currentQuestionData.question,
                         correctAnswer: this.currentQuestionData.answers[this.currentQuestionData.correctIndex],
                         explanation: this.currentQuestionData.explanation
                    })
               });

               if (!response.ok) {
                    throw new Error('Failed to extract concepts');
               }

               const { concepts } = await response.json();
               console.log('✅ Extracted concepts:', concepts);

               // Show modal with concept suggestions
               this.displayAddToGraphModal(concepts);
          } catch (error) {
               console.error('Error extracting concepts:', error);
               alert('Failed to extract concepts. Please try again.');
          }
     }

     displayAddToGraphModal(concepts) {
          // Create modal overlay
          const modalOverlay = document.createElement('div');
          modalOverlay.id = 'add-to-graph-modal-overlay';
          modalOverlay.className = 'll-modal-overlay';

          const modalContent = document.createElement('div');
          modalContent.className = 'll-modal-content';

          const title = document.createElement('h3');
          title.textContent = '➕ Add Topics to Knowledge Graph';
          modalContent.appendChild(title);

          const description = document.createElement('p');
          description.textContent = 'Select concepts to add to your knowledge graph:';
          description.style.color = '#ccc';
          description.style.marginBottom = '20px';
          modalContent.appendChild(description);

          // Concept selection list
          const conceptList = document.createElement('div');
          conceptList.id = 'concept-list';

          concepts.forEach((concept, index) => {
               const conceptCard = document.createElement('div');
               conceptCard.className = 'concept-card';
               conceptCard.innerHTML = `
                    <input type="checkbox" id="concept-${index}" checked>
                    <label for="concept-${index}">
                         <strong>${concept.topic}</strong>
                         <span class="concept-category">${concept.category}</span>
                         <p>${concept.description}</p>
                    </label>
               `;
               conceptList.appendChild(conceptCard);
          });

          modalContent.appendChild(conceptList);

          // Buttons
          const btnContainer = document.createElement('div');
          btnContainer.style.marginTop = '20px';
          btnContainer.style.display = 'flex';
          btnContainer.style.gap = '10px';
          btnContainer.style.justifyContent = 'flex-end';

          const confirmBtn = document.createElement('button');
          confirmBtn.className = 'll-modal-btn ll-modal-btn-primary';
          confirmBtn.textContent = 'Add to Graph';
          confirmBtn.onclick = () => {
               const selectedConcepts = concepts.filter((_, i) => {
                    return document.getElementById(`concept-${i}`).checked;
               });
               this.addConceptsToGraph(selectedConcepts);
               document.body.removeChild(modalOverlay);
          };

          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'll-modal-btn ll-modal-btn-secondary';
          cancelBtn.textContent = 'Cancel';
          cancelBtn.onclick = () => document.body.removeChild(modalOverlay);

          btnContainer.appendChild(cancelBtn);
          btnContainer.appendChild(confirmBtn);
          modalContent.appendChild(btnContainer);

          modalOverlay.appendChild(modalContent);
          document.body.appendChild(modalOverlay);

          // Close on overlay click
          modalOverlay.onclick = (e) => {
               if (e.target === modalOverlay) {
                    document.body.removeChild(modalOverlay);
               }
          };
     }


     async addConceptsToGraph(concepts) {
          if (concepts.length === 0) {
               alert('No concepts selected');
               return;
          }

          console.log('➕ Adding concepts to graph:', concepts);

          try {
               // Add nodes to graph
               const createdNodes = addNodesFromQuiz(concepts);

               if (createdNodes.length > 0) {
                    // Show success feedback
                    const conceptNames = createdNodes.map(n => `• ${n.topic}`).join('\n');
                    alert(`✅ Successfully added ${createdNodes.length} concept(s) to your knowledge graph:\n\n${conceptNames}\n\n🔗 Nodes have been linked to related topics in the graph.`);

                    console.log('✅ Nodes created:', createdNodes);
               } else {
                    alert('⚠️ Some concepts may already exist in your graph.');
               }
          } catch (error) {
               console.error('Error adding concepts to graph:', error);
               alert('❌ Failed to add concepts to graph. Please try again.');
          }
     }

     startTimer(seconds) {
          this.timeLeft = seconds;
          const timerText = document.getElementById('timer-text');
          const timerContainer = document.getElementById('timer-container');

          timerText.textContent = this.timeLeft;
          timerContainer.classList.remove('timer-warning');

          this.timerInterval = setInterval(() => {
               this.timeLeft--;
               timerText.textContent = this.timeLeft;

               // Tick sound every second
               this.playSound('tick');

               if (this.timeLeft <= 10) {
                    timerContainer.classList.add('timer-warning');
               }

               if (this.timeLeft <= 0) {
                    this.stopTimer();
                    this.playSound('timeout');
                    this.gameOver(true); // True for timeout
               }
          }, 1000);
     }

     stopTimer() {
          if (this.timerInterval) {
               clearInterval(this.timerInterval);
               this.timerInterval = null;
          }
     }

     // --- LIFELINES LOGIC ---

     renderLifelines() {
          const btn5050 = document.getElementById('lifeline-5050');
          const btnComlink = document.getElementById('lifeline-comlink');
          const btnSurvey = document.getElementById('lifeline-survey');

          btn5050.disabled = !this.lifelines.fiftyFifty;
          btnComlink.disabled = !this.lifelines.comlink;
          btnSurvey.disabled = !this.lifelines.survey;

          btn5050.onclick = () => this.useFiftyFifty();
          btnComlink.onclick = () => this.useComlink();
          btnSurvey.onclick = () => this.useSurvey();
     }

     useFiftyFifty() {
          if (!this.lifelines.fiftyFifty || !this.currentQuestionData) return;

          this.lifelines.fiftyFifty = false;
          this.renderLifelines();

          const correctIndex = this.currentQuestionData.correctIndex;
          const wrongIndices = [0, 1, 2, 3].filter(i => i !== correctIndex);

          // Shuffle wrong indices and pick 2 to remove
          const shuffled = wrongIndices.sort(() => 0.5 - Math.random());
          const toRemove = shuffled.slice(0, 2);

          toRemove.forEach(index => {
               const btn = document.getElementById(`answer-btn-${index}`);
               if (btn) {
                    btn.classList.add('hidden-answer');
               }
          });
     }

     useComlink() {
          if (!this.lifelines.comlink || !this.currentQuestionData) return;

          this.lifelines.comlink = false;
          this.renderLifelines();

          const correctIndex = this.currentQuestionData.correctIndex;
          const difficulty = this.currentLevel + 1;

          // Probability of friend being right decreases with difficulty
          // Level 1: 95%, Level 15: 40%
          const accuracy = Math.max(0.4, 0.95 - (difficulty * 0.04));
          const isCorrect = Math.random() < accuracy;

          let suggestedIndex;
          if (isCorrect) {
               suggestedIndex = correctIndex;
          } else {
               const wrongIndices = [0, 1, 2, 3].filter(i => i !== correctIndex);
               suggestedIndex = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
          }

          const letter = String.fromCharCode(65 + suggestedIndex);
          const messages = [
               `I'm pretty sure it's ${letter}.`,
               `I think the answer is ${letter}.`,
               `It's definitely ${letter}!`,
               `I'm not 100% sure, but I'd go with ${letter}.`
          ];
          const message = messages[Math.floor(Math.random() * messages.length)];

          const resultArea = document.getElementById('lifeline-result-area');
          resultArea.style.display = 'block';
          resultArea.innerHTML = `<div class="comlink-message">📞 Friend says: "${message}"</div>`;
     }

     useSurvey() {
          if (!this.lifelines.survey || !this.currentQuestionData) return;

          this.lifelines.survey = false;
          this.renderLifelines();

          const correctIndex = this.currentQuestionData.correctIndex;
          const difficulty = this.currentLevel + 1;

          // Audience accuracy
          const accuracy = Math.max(0.3, 0.9 - (difficulty * 0.05));

          let votes = [0, 0, 0, 0];
          let remaining = 100;

          // Assign votes to correct answer
          votes[correctIndex] = Math.floor(remaining * accuracy);
          remaining -= votes[correctIndex];

          // Distribute remaining votes randomly
          for (let i = 0; i < 4; i++) {
               if (i !== correctIndex) {
                    if (i === 3 && correctIndex !== 3) {
                         votes[i] = remaining; // Last one gets the rest
                    } else {
                         const share = Math.floor(Math.random() * remaining);
                         votes[i] = share;
                         remaining -= share;
                    }
               }
          }

          // Render chart
          const resultArea = document.getElementById('lifeline-result-area');
          resultArea.style.display = 'block';

          let chartHtml = '<div class="survey-chart">';
          votes.forEach((percent, index) => {
               const letter = String.fromCharCode(65 + index);
               chartHtml += `
                    <div class="survey-bar-container">
                         <div class="survey-bar" style="height: ${percent}px;"></div>
                         <div class="survey-label">${letter}</div>
                         <div class="survey-percent">${percent}%</div>
                    </div>
               `;
          });
          chartHtml += '</div>';

          resultArea.innerHTML = chartHtml;
     }

     clearLifelineResults() {
          const resultArea = document.getElementById('lifeline-result-area');
          if (resultArea) {
               resultArea.style.display = 'none';
               resultArea.innerHTML = '';
          }
     }

     updateDifficultyMeter(level) {
          const container = document.getElementById('difficulty-bars');
          container.innerHTML = '';

          for (let i = 1; i <= 15; i++) {
               const bar = document.createElement('div');
               bar.className = 'diff-bar';
               if (i <= level) {
                    bar.classList.add('active');
                    if (i > 5) bar.classList.add('medium');
                    if (i > 10) bar.classList.add('hard');
               }
               container.appendChild(bar);
          }
     }

     updateLadderUI() {
          const ladderContainer = document.getElementById('money-ladder');
          ladderContainer.innerHTML = '';

          // Render in reverse order (top to bottom)
          [...this.moneyLadder].reverse().forEach((amount, index) => {
               const realIndex = this.moneyLadder.length - 1 - index;
               const item = document.createElement('div');
               item.className = 'ladder-item';
               if (realIndex === this.currentLevel) item.classList.add('active');
               if (realIndex < this.currentLevel) item.classList.add('completed');
               if (this.safeHavens.includes(realIndex)) item.classList.add('safe-haven');

               item.innerHTML = `<span class="level-num">${realIndex + 1}</span> <span class="amount">$${amount.toLocaleString()}</span>`;
               ladderContainer.appendChild(item);
          });
     }

     updateUIState(state) {
          const container = document.getElementById('millionaire-game-container');
          const loader = document.getElementById('millionaire-loader');
          const content = document.getElementById('millionaire-content');

          if (state === 'loading') {
               loader.style.display = 'flex';
               content.style.opacity = '0.5';
               content.style.pointerEvents = 'none';
          } else {
               loader.style.display = 'none';
               content.style.opacity = '1';
               content.style.pointerEvents = 'all';
          }
     }

     showGameUI() {
          document.getElementById('millionaire-game-container').style.display = 'flex';
     }

     hideGameUI() {
          document.getElementById('millionaire-game-container').style.display = 'none';
          this.isGameActive = false;
     }

     gameOver(isTimeout = false) {
          let prize = 0;
          if (this.currentLevel > 9) prize = 50000;
          else if (this.currentLevel > 4) prize = 5000;

          const msg = isTimeout ? "⏰ Time's Up!" : "Game Over!";
          alert(`${msg} You won $${prize.toLocaleString()}`);
          this.hideGameUI();
     }

     winGame() {
          alert('CONGRATULATIONS! YOU ARE A MILLIONAIRE! $1,000,000');
          this.hideGameUI();
     }

     playSound(type) {
          if (!this.audioCtx || !this.soundEnabled) return;

          const osc = this.audioCtx.createOscillator();
          const gainNode = this.audioCtx.createGain();

          osc.connect(gainNode);
          gainNode.connect(this.audioCtx.destination);

          const now = this.audioCtx.currentTime;

          switch (type) {
               case 'tick':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(800, now);
                    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
                    gainNode.gain.setValueAtTime(0.1, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                    osc.start(now);
                    osc.stop(now + 0.05);
                    break;
               case 'correct':
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(440, now); // A4
                    osc.frequency.setValueAtTime(554, now + 0.1); // C#5
                    osc.frequency.setValueAtTime(659, now + 0.2); // E5
                    gainNode.gain.setValueAtTime(0.1, now);
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
                    osc.start(now);
                    osc.stop(now + 0.5);
                    break;
               case 'wrong':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(150, now);
                    osc.frequency.linearRampToValueAtTime(100, now + 0.3);
                    gainNode.gain.setValueAtTime(0.2, now);
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
                    osc.start(now);
                    osc.stop(now + 0.3);
                    break;
               case 'timeout':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.linearRampToValueAtTime(100, now + 0.5);
                    gainNode.gain.setValueAtTime(0.2, now);
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
                    osc.start(now);
                    osc.stop(now + 0.5);
                    break;
          }
     }

     initSoundToggle() {
          const soundBtn = document.getElementById('sound-toggle-btn');
          const soundIcon = document.getElementById('sound-icon');

          // Update UI based on current state
          if (!this.soundEnabled) {
               soundBtn.classList.add('muted');
               soundIcon.textContent = '🔇';
          } else {
               soundBtn.classList.remove('muted');
               soundIcon.textContent = '🔊';
          }

          // Add click handler
          soundBtn.onclick = () => this.toggleSound();
     }

     toggleSound() {
          this.soundEnabled = !this.soundEnabled;

          // Save to localStorage
          localStorage.setItem('millionaire_sound', this.soundEnabled);

          // Update UI
          const soundBtn = document.getElementById('sound-toggle-btn');
          const soundIcon = document.getElementById('sound-icon');

          if (!this.soundEnabled) {
               soundBtn.classList.add('muted');
               soundIcon.textContent = '🔇';
          } else {
               soundBtn.classList.remove('muted');
               soundIcon.textContent = '🔊';
          }

          console.log(`🔊 Sound ${this.soundEnabled ? 'enabled' : 'disabled'}`);
     }
}

export const millionaireGame = new MillionaireGame();
