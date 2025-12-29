/**
 * Self-Destructing Content Modal Logic
 * Handles creation of temporary content with auto-delete, burn-after-read, and IP restriction
 */

function setupContentModal() {
     const API_BASE = '/api';

     // Elements
     const modal = document.getElementById('content-modal');
     const openBtn = document.getElementById('create-content-card');
     const closeBtn = document.getElementById('close-modal-btn');
     const timerBtns = document.querySelectorAll('.timer-btn');
     const autoDeleteToggle = document.getElementById('auto-delete-toggle');
     const timerOptions = document.getElementById('timer-options');
     const fileInputSection = document.getElementById('file-input-section');
     const fileToggle = document.getElementById('file-toggle');
     const fileToggleIcon = document.getElementById('file-toggle-icon');
     const contentInput = document.getElementById('content-input');
     const fileInput = document.getElementById('file-input');
     const dropZone = document.getElementById('drop-zone');
     const dropZoneContent = document.getElementById('drop-zone-content');
     const dropZoneFile = document.getElementById('drop-zone-file');
     const selectedFileName = document.getElementById('selected-file-name');
     const removeFileBtn = document.getElementById('remove-file-btn');
     const createBtn = document.getElementById('create-content-btn');
     const resultUrl = document.getElementById('result-url');
     const copyUrlBtn = document.getElementById('copy-url-btn');
     const copyFeedback = document.getElementById('copy-feedback');
     const createAnotherBtn = document.getElementById('create-another-btn');
     const retryBtn = document.getElementById('retry-btn');
     const errorMessage = document.getElementById('error-message');
     const burnAfterReadToggle = document.getElementById('burn-after-read-toggle');
     const ipRestrictionToggle = document.getElementById('ip-restriction-toggle');

     // State
     let currentTimer = 1;
     let autoDelete = true;
     let burnAfterRead = false;
     let ipRestriction = false;
     let selectedFile = null;
     let fileUploadVisible = false;

     // Helper: detect if content is a URL
     function isURL(text) {
          const urlPattern = /^(https?:\/\/|www\.)[^\s]+$/i;
          return urlPattern.test(text.trim());
     }

     // Modal open/close
     openBtn.addEventListener('click', () => {
          modal.classList.add('active');
          document.body.style.overflow = 'hidden';
     });

     function closeModal() {
          modal.classList.remove('active');
          document.body.style.overflow = '';
          resetForm();
     }

     closeBtn.addEventListener('click', closeModal);
     modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal();
     });

     document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && modal.classList.contains('active')) {
               closeModal();
          }
     });

     // File upload toggle
     fileToggle.addEventListener('click', () => {
          fileUploadVisible = !fileUploadVisible;
          fileInputSection.classList.toggle('hidden', !fileUploadVisible);
          fileToggleIcon.style.transform = fileUploadVisible ? 'rotate(180deg)' : '';
     });

     // Timer buttons
     timerBtns.forEach(btn => {
          btn.addEventListener('click', () => {
               timerBtns.forEach(b => b.classList.remove('active'));
               btn.classList.add('active');
               currentTimer = parseInt(btn.dataset.minutes);
          });
     });

     // Auto-delete toggle
     autoDeleteToggle.addEventListener('click', () => {
          autoDelete = !autoDelete;
          autoDeleteToggle.classList.toggle('active', autoDelete);
          timerOptions.style.display = autoDelete ? 'grid' : 'none';
     });

     // Burn after read toggle
     burnAfterReadToggle.addEventListener('click', () => {
          burnAfterRead = !burnAfterRead;
          burnAfterReadToggle.classList.toggle('active', burnAfterRead);
     });

     // IP restriction toggle
     ipRestrictionToggle.addEventListener('click', () => {
          ipRestriction = !ipRestriction;
          ipRestrictionToggle.classList.toggle('active', ipRestriction);
     });

     // File drag & drop
     dropZone.addEventListener('click', () => fileInput.click());

     dropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropZone.classList.add('drag-over');
     });

     dropZone.addEventListener('dragleave', () => {
          dropZone.classList.remove('drag-over');
     });

     dropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropZone.classList.remove('drag-over');
          const files = e.dataTransfer.files;
          if (files.length > 0) {
               handleFile(files[0]);
          }
     });

     fileInput.addEventListener('change', () => {
          if (fileInput.files.length > 0) {
               handleFile(fileInput.files[0]);
          }
     });

     function handleFile(file) {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          if (!allowedTypes.includes(file.type)) {
               alert('Разрешены только изображения: PNG, JPG, GIF, WEBP');
               return;
          }
          if (file.size > 10 * 1024 * 1024) {
               alert('Файл слишком большой. Максимум 10MB.');
               return;
          }

          selectedFile = file;
          selectedFileName.textContent = file.name;
          dropZoneContent.classList.add('hidden');
          dropZoneFile.classList.remove('hidden');
          dropZone.classList.add('has-file');
     }

     removeFileBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          clearFile();
     });

     function clearFile() {
          selectedFile = null;
          fileInput.value = '';
          dropZoneContent.classList.remove('hidden');
          dropZoneFile.classList.add('hidden');
          dropZone.classList.remove('has-file');
     }

     // Form states
     function showState(state) {
          ['form', 'success', 'loading', 'error'].forEach(s => {
               document.getElementById(`modal-${s}-state`).classList.toggle('hidden', s !== state);
          });
     }

     function resetForm() {
          showState('form');
          contentInput.value = '';
          clearFile();
          fileUploadVisible = false;
          fileInputSection.classList.add('hidden');
          fileToggleIcon.style.transform = '';
     }

     // Create content
     createBtn.addEventListener('click', async () => {
          const content = contentInput.value.trim();

          // Validate: need either text or file
          if (!content && !selectedFile) {
               alert('Пожалуйста, введите текст или загрузите файл');
               return;
          }

          showState('loading');

          try {
               // Auto-detect content type
               let contentType = 'text';
               if (selectedFile && !content) {
                    contentType = 'file';
               } else if (isURL(content)) {
                    contentType = 'link';
               }

               const formData = new FormData();
               formData.append('type', contentType);
               formData.append('content', content);
               formData.append('autoDelete', autoDelete);
               formData.append('deleteAfterMinutes', currentTimer);
               formData.append('burnAfterRead', burnAfterRead);
               formData.append('ipRestriction', ipRestriction);

               if (selectedFile) {
                    formData.append('file', selectedFile);
               }

               const response = await fetch(`${API_BASE}/content`, {
                    method: 'POST',
                    body: formData
               });

               const data = await response.json();

               if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Ошибка создания контента');
               }

               const fullUrl = `${window.location.origin}/view/${data.uuid}`;
               resultUrl.value = fullUrl;
               showState('success');

          } catch (error) {
               console.error('Error creating content:', error);
               errorMessage.textContent = error.message;
               showState('error');
          }
     });

     // Copy URL
     copyUrlBtn.addEventListener('click', async () => {
          try {
               await navigator.clipboard.writeText(resultUrl.value);
               copyFeedback.classList.remove('hidden');
               setTimeout(() => {
                    copyFeedback.classList.add('hidden');
               }, 2000);
          } catch (err) {
               // Fallback for older browsers
               resultUrl.select();
               document.execCommand('copy');
               copyFeedback.classList.remove('hidden');
          }
     });

     // Create another
     createAnotherBtn.addEventListener('click', () => {
          resetForm();
     });

     // Retry on error
     retryBtn.addEventListener('click', () => {
          showState('form');
     });
}
