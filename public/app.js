class CourseManager {
    constructor() {
        this.API_URL = window.location.origin + '/api/courses';
        this.deleteCourseId = null;
        this.currentCourses = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.fetchCourses();
        this.checkApiStatus();
        this.updateEnvironmentBadge();
    }

    bindEvents() {
        document.getElementById('createForm').onsubmit = (e) => this.handleCreate(e);
        document.getElementById('searchBtn').onclick = () => this.handleSearch();
        document.getElementById('updateForm').onsubmit = (e) => this.handleUpdate(e);
        document.getElementById('cancelUpdate').onclick = () => this.hideUpdateForm();
        document.getElementById('refreshBtn').onclick = () => this.fetchCourses();
        document.getElementById('sortFilter').onchange = () => this.fetchCourses();
        document.getElementById('exportBtn').onclick = () => this.exportCourses();
        document.getElementById('applyFilter').onclick = () => this.applyQuickFilter();
        document.getElementById('searchTitle').oninput = () => this.searchByTitle();
        document.getElementById('confirmDelete').onclick = () => this.confirmDelete();
        document.getElementById('cancelDelete').onclick = () => this.closeModal('deleteModal');
        document.getElementById('closeSuccessModal').onclick = () => this.closeModal('successModal');
        document.querySelector('.modal-close').onclick = () => this.closeModal('deleteModal');
        document.getElementById('logoutBtn').onclick = () => this.handleLogout();
        document.getElementById('apiDocsBtn').onclick = () => this.showApiDocs();

        document.addEventListener('click', (e) => {
            if (e.target.closest('.edit-btn')) {
                const id = e.target.closest('.edit-btn').dataset.id;
                this.loadCourseForEdit(id);
            }
            
            if (e.target.closest('.delete-btn')) {
                const btn = e.target.closest('.delete-btn');
                this.showDeleteModal(btn.dataset.id, btn.dataset.title);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    async fetchCourses() {
        try {
            this.showLoading();
            const sort = document.getElementById('sortFilter').value;
            const minPrice = document.getElementById('minPriceFilter').value;
            const maxPrice = document.getElementById('maxPriceFilter').value;
            
            let url = this.API_URL;
            const params = [];
            
            if (sort) params.push(`sort=${sort}`);
            if (minPrice) params.push(`minPrice=${minPrice}`);
            if (maxPrice) params.push(`maxPrice=${maxPrice}`);
            
            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const courses = await response.json();
            
            this.currentCourses = courses;
            this.updateStats(courses);
            this.renderCoursesTable(courses);
            this.showNotification(`Loaded ${courses.length} courses`, 'success');
            
        } catch (error) {
            console.error('Fetch error:', error);
            this.showNotification(`Error loading courses: ${error.message}`, 'error');
            this.renderErrorState();
        }
    }

    updateStats(courses) {
        document.getElementById('totalCourses').textContent = courses.length;
        
        if (courses.length > 0) {
            const totalPrice = courses.reduce((sum, course) => sum + course.price, 0);
            const avgPrice = totalPrice / courses.length;
            document.getElementById('avgPrice').textContent = `$${avgPrice.toFixed(2)}`;
            document.getElementById('totalValue').textContent = `$${totalPrice.toFixed(2)}`;
            
            const latest = courses.reduce((latest, course) => {
                const date = new Date(course.updatedAt || course.createdAt);
                return date > latest ? date : latest;
            }, new Date(0));
            
            const now = new Date();
            const diff = now - latest;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            
            if (days === 0) {
                document.getElementById('latestUpdate').textContent = 'Today';
            } else if (days === 1) {
                document.getElementById('latestUpdate').textContent = 'Yesterday';
            } else if (days < 7) {
                document.getElementById('latestUpdate').textContent = `${days} days ago`;
            } else {
                document.getElementById('latestUpdate').textContent = latest.toLocaleDateString();
            }
        } else {
            document.getElementById('avgPrice').textContent = '$0';
            document.getElementById('totalValue').textContent = '$0';
            document.getElementById('latestUpdate').textContent = 'Never';
        }
    }

    renderCoursesTable(courses) {
        const tbody = document.getElementById('coursesTableBody');
        
        if (courses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-book"></i>
                        <p>No courses found. Create your first course!</p>
                        <button class="btn btn-primary mt-20" onclick="document.getElementById('title').focus()">
                            <i class="fas fa-plus"></i> Create Course
                        </button>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = courses.map(course => `
            <tr>
                <td class="course-id">${course._id}</td>
                <td class="course-title">
                    <strong>${course.title}</strong>
                </td>
                <td class="course-desc" title="${course.description || 'No description'}">
                    ${course.description || '<em style="color: var(--text-light);">No description</em>'}
                </td>
                <td class="course-price">
                    <span class="price-badge">$${course.price.toFixed(2)}</span>
                </td>
                <td class="course-date">
                    ${new Date(course.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    })}
                    <br>
                    <small style="color: var(--text-light);">
                        ${new Date(course.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </small>
                </td>
                <td class="course-actions">
                    <button class="btn-action edit-btn" data-id="${course._id}" title="Edit course">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete-btn" data-id="${course._id}" data-title="${course.title}" title="Delete course">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-action view-btn" onclick="window.open('/api/courses/${course._id}', '_blank')" title="View API response">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderErrorState() {
        const tbody = document.getElementById('coursesTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                    <p>Failed to load courses. Please check your connection.</p>
                    <button class="btn btn-primary mt-20" onclick="courseManager.fetchCourses()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </td>
            </tr>
        `;
    }

    showLoading() {
        const tbody = document.getElementById('coursesTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading courses...</p>
                </td>
            </tr>
        `;
    }

    async handleCreate(e) {
        e.preventDefault();
        
        const title = document.getElementById('title').value.trim();
        const price = document.getElementById('price').value;
        const description = document.getElementById('description').value.trim();
        
        if (!title || !price) {
            this.showNotification('Please fill in all required fields', 'warning');
            return;
        }
        
        try {
            const createBtn = e.target.querySelector('button[type="submit"]');
            const originalText = createBtn.innerHTML;
            createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            createBtn.disabled = true;
            
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, price, description })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create course');
            }
            
            const newCourse = await response.json();
            
            this.showNotification(`Course "${newCourse.title}" created successfully!`, 'success');
            document.getElementById('createForm').reset();
            this.fetchCourses();
            
            this.showSuccessModal(`Course "${newCourse.title}" has been successfully created with price $${newCourse.price}.`);
            
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
        } finally {
            const createBtn = document.querySelector('#createForm button[type="submit"]');
            createBtn.innerHTML = '<i class="fas fa-save"></i> Create Course';
            createBtn.disabled = false;
        }
    }

    async handleSearch() {
        const id = document.getElementById('searchCourse').value.trim();
        if (!id) {
            this.showNotification('Please enter a course ID', 'warning');
            return;
        }
        
        await this.loadCourseForEdit(id);
    }

    async loadCourseForEdit(id) {
        try {
            const response = await fetch(`${this.API_URL}/${id}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Course not found');
            }
            
            const course = await response.json();
            
            document.getElementById('updateId').value = course._id;
            document.getElementById('updateTitle').value = course.title;
            document.getElementById('updatePrice').value = course.price;
            document.getElementById('updateDescription').value = course.description || '';
            
            document.getElementById('updateForm').style.display = 'block';
            document.getElementById('searchCourse').value = '';
            
            document.getElementById('updateTitle').focus();
            
            this.showNotification(`Course "${course.title}" loaded for editing`, 'info');
            
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    hideUpdateForm() {
        document.getElementById('updateForm').style.display = 'none';
    }

    async handleUpdate(e) {
        e.preventDefault();
        
        const id = document.getElementById('updateId').value;
        const title = document.getElementById('updateTitle').value.trim();
        const price = document.getElementById('updatePrice').value;
        const description = document.getElementById('updateDescription').value.trim();
        
        if (!title || !price) {
            this.showNotification('Please fill in all required fields', 'warning');
            return;
        }
        
        try {
            const updateBtn = e.target.querySelector('button[type="submit"]');
            const originalText = updateBtn.innerHTML;
            updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            updateBtn.disabled = true;
            
            const response = await fetch(`${this.API_URL}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, price, description })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update course');
            }
            
            const updatedCourse = await response.json();
            
            this.showNotification(`Course "${updatedCourse.title}" updated successfully!`, 'success');
            this.hideUpdateForm();
            this.fetchCourses();
            
            this.showSuccessModal(`Course "${updatedCourse.title}" has been successfully updated.`);
            
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
        } finally {
            const updateBtn = document.querySelector('#updateForm button[type="submit"]');
            updateBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Course';
            updateBtn.disabled = false;
        }
    }

    showDeleteModal(id, title) {
        this.deleteCourseId = id;
        
        const preview = document.getElementById('deletePreview');
        preview.innerHTML = `
            <h4 style="margin-bottom: 10px; color: var(--danger);">
                <i class="fas fa-exclamation-circle"></i> ${title}
            </h4>
            <p style="margin: 0; font-family: monospace; font-size: 0.9rem;">
                ID: ${id}
            </p>
        `;
        
        this.openModal('deleteModal');
    }

    async confirmDelete() {
        if (!this.deleteCourseId) return;
        
        try {
            const response = await fetch(`${this.API_URL}/${this.deleteCourseId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete course');
            }
            
            this.showNotification('Course deleted successfully!', 'success');
            this.closeModal('deleteModal');
            this.fetchCourses();
            
            this.deleteCourseId = null;
            
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    applyQuickFilter() {
        const min = document.getElementById('quickMinPrice').value;
        const max = document.getElementById('quickMaxPrice').value;
        
        if (min) document.getElementById('minPriceFilter').value = min;
        if (max) document.getElementById('maxPriceFilter').value = max;
        
        this.fetchCourses();
    }

    searchByTitle() {
        const searchTerm = document.getElementById('searchTitle').value.toLowerCase();
        if (!searchTerm) {
            this.renderCoursesTable(this.currentCourses);
            return;
        }
        
        const filtered = this.currentCourses.filter(course =>
            course.title.toLowerCase().includes(searchTerm) ||
            (course.description && course.description.toLowerCase().includes(searchTerm))
        );
        
        this.renderCoursesTable(filtered);
    }

    exportCourses() {
        const dataStr = JSON.stringify(this.currentCourses, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `courses_export_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        this.showNotification(`Exported ${this.currentCourses.length} courses`, 'success');
    }

    async checkApiStatus() {
        const statusElement = document.getElementById('apiStatus');
        
        try {
            const response = await fetch(this.API_URL);
            if (response.ok) {
                statusElement.className = 'status-badge online';
                statusElement.innerHTML = '● Online';
            } else {
                throw new Error('API not responding');
            }
        } catch (error) {
            statusElement.className = 'status-badge offline';
            statusElement.innerHTML = '● Offline';
        }
    }

    updateEnvironmentBadge() {
        const badge = document.getElementById('envBadge');
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
        
        if (isLocalhost) {
            badge.textContent = 'DEVELOPMENT';
            badge.style.background = 'var(--warning)';
            badge.style.animation = 'none';
        } else {
            badge.textContent = 'PRODUCTION';
            badge.style.background = 'var(--success)';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                               type === 'error' ? 'exclamation-circle' : 
                               type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        notification.querySelector('.notification-close').onclick = () => {
            notification.remove();
        };
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'notificationSlideIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) reverse';
                setTimeout(() => notification.remove(), 500);
            }
        }, 5000);
    }

    showSuccessModal(message) {
        document.getElementById('successMessage').textContent = message;
        this.openModal('successModal');
    }

    openModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            window.location.href = '/';
        }
    }

    showApiDocs() {
        const docs = `
Available API Endpoints:

GET    /api/courses                 - Get all courses
GET    /api/courses/:id             - Get specific course
POST   /api/courses                 - Create new course
PUT    /api/courses/:id             - Update course
DELETE /api/courses/:id             - Delete course

Query Parameters:
?sort=field:asc/desc              - Sort by field
?minPrice=100                     - Minimum price
?maxPrice=500                     - Maximum price
?fields=title,price               - Select specific fields
        `;
        
        alert(docs);
    }
}

const courseManager = new CourseManager();