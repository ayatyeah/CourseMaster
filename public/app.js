class CourseManager {
    constructor() {
        this.API_URL = window.location.origin + '/api/courses';
        this.deleteCourseId = null;
        this.currentCourses = [];
        this.checkAuthAndInit();
    }

    async checkAuthAndInit() {
        try {
            const response = await fetch('/api/auth/check');
            const data = await response.json();

            if (!data.loggedIn) {
                window.location.href = '/login.html';
                return;
            }

            this.init();
        } catch (error) {
            window.location.href = '/login.html';
        }
    }

    init() {
        this.bindEvents();
        this.fetchCourses();
        this.checkApiStatus();
        this.updateEnvironmentBadge();
        this.updateUserInfo();
    }

    async updateUserInfo() {
        try {
            const response = await fetch('/api/me');
            if (!response.ok) return;

            const user = await response.json();
            const userInfo = document.getElementById('userInfo');
            if (userInfo) {
                userInfo.innerHTML = `<i class="fas fa-user-circle"></i> ${user.username} (${user.role})`;
            }

            if (user.role !== 'admin') {
                const adminBtn = document.getElementById('adminBtn');
                if (adminBtn) adminBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to get user info:', error);
        }
    }

    bindEvents() {
        const createForm = document.getElementById('createForm');
        const updateForm = document.getElementById('updateForm');

        if (createForm) createForm.onsubmit = (e) => this.handleCreate(e);
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) searchBtn.onclick = () => this.handleSearch();

        if (updateForm) updateForm.onsubmit = (e) => this.handleUpdate(e);

        const cancelUpdate = document.getElementById('cancelUpdate');
        if (cancelUpdate) cancelUpdate.onclick = () => this.hideUpdateForm();

        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) refreshBtn.onclick = () => this.fetchCourses();

        const sortFilter = document.getElementById('sortFilter');
        if (sortFilter) sortFilter.onchange = () => this.fetchCourses();

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.onclick = () => this.exportCourses();

        const applyFilter = document.getElementById('applyFilter');
        if (applyFilter) applyFilter.onclick = () => this.applyQuickFilter();

        const searchTitle = document.getElementById('searchTitle');
        if (searchTitle) searchTitle.oninput = () => this.searchByTitle();

        const confirmDelete = document.getElementById('confirmDelete');
        if (confirmDelete) confirmDelete.onclick = () => this.confirmDelete();

        const cancelDelete = document.getElementById('cancelDelete');
        if (cancelDelete) cancelDelete.onclick = () => this.closeModal('deleteModal');

        const closeSuccessModal = document.getElementById('closeSuccessModal');
        if (closeSuccessModal) closeSuccessModal.onclick = () => this.closeModal('successModal');

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.onclick = () => this.closeAllModals();
        });

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.onclick = () => this.handleLogout();

        const apiDocsBtn = document.getElementById('apiDocsBtn');
        if (apiDocsBtn) apiDocsBtn.onclick = () => this.showApiDocs();

        document.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            if (editBtn) {
                const id = editBtn.dataset.id;
                this.loadCourseForEdit(id);
                return;
            }

            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                this.showDeleteModal(deleteBtn.dataset.id, deleteBtn.dataset.title);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
        });
    }

    async fetchCourses() {
        const tbody = document.getElementById('coursesTableBody');
        try {
            this.showLoading();

            const sort = document.getElementById('sortFilter')?.value || '';
            const minPrice = document.getElementById('minPriceFilter')?.value || '';
            const maxPrice = document.getElementById('maxPriceFilter')?.value || '';

            let url = this.API_URL;
            const params = [];

            if (sort) params.push(`sort=${encodeURIComponent(sort)}`);
            if (minPrice) params.push(`minPrice=${encodeURIComponent(minPrice)}`);
            if (maxPrice) params.push(`maxPrice=${encodeURIComponent(maxPrice)}`);

            if (params.length) url += `?${params.join('&')}`;

            const response = await fetch(url);

            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }

            if (!response.ok) {
                this.showNotification(`Error loading courses: HTTP ${response.status}`, 'error');
                this.renderErrorState();
                return;
            }

            const courses = await response.json();
            this.currentCourses = courses;

            this.updateStats(courses);
            this.renderCoursesTable(courses);
            this.showNotification(`Loaded ${courses.length} courses`, 'success');
        } catch (error) {
            console.error('Fetch error:', error);
            this.showNotification(`Error loading courses: ${error.message}`, 'error');
            if (tbody) this.renderErrorState();
        }
    }

    updateStats(courses) {
        const totalCourses = document.getElementById('totalCourses');
        if (totalCourses) totalCourses.textContent = courses.length;

        const avgPriceEl = document.getElementById('avgPrice');
        const totalValueEl = document.getElementById('totalValue');
        const latestUpdateEl = document.getElementById('latestUpdate');

        if (!avgPriceEl || !totalValueEl || !latestUpdateEl) return;

        if (!courses.length) {
            avgPriceEl.textContent = '$0';
            totalValueEl.textContent = '$0';
            latestUpdateEl.textContent = 'Never';
            return;
        }

        const totalPrice = courses.reduce((sum, course) => sum + (Number(course.price) || 0), 0);
        const avgPrice = totalPrice / courses.length;

        avgPriceEl.textContent = `$${avgPrice.toFixed(2)}`;
        totalValueEl.textContent = `$${totalPrice.toFixed(2)}`;

        const latest = courses.reduce((latestDate, course) => {
            const date = new Date(course.updatedAt || course.createdAt);
            return date > latestDate ? date : latestDate;
        }, new Date(0));

        const now = new Date();
        const diff = now - latest;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) latestUpdateEl.textContent = 'Today';
        else if (days === 1) latestUpdateEl.textContent = 'Yesterday';
        else if (days < 7) latestUpdateEl.textContent = `${days} days ago`;
        else latestUpdateEl.textContent = latest.toLocaleDateString();
    }

    renderCoursesTable(courses) {
        const tbody = document.getElementById('coursesTableBody');
        if (!tbody) return;

        if (!courses.length) {
            tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-book"></i>
                    <p>No courses found. Create your first course!</p>
                    <button class="btn btn-primary mt-20" onclick="document.getElementById('title')?.focus()">
                        <i class="fas fa-plus"></i> Create Course
                    </button>
                </td>
            </tr>
        `;
            return;
        }

        tbody.innerHTML = courses.map(course => {
            const cid = course.id || course._id || '';
            const price = Number(course.price || 0);

            return `
            <tr>
                <td class="course-id" title="${cid}">${cid}</td>
                <td class="course-title"><strong>${course.title || ''}</strong></td>
                <td class="course-desc" title="${course.description || 'No description'}">
                    ${course.description || '<em style="color: var(--text-light);">No description</em>'}
                </td>
                <td class="course-price">
                    <span class="price-badge">$${price.toFixed(2)}</span>
                </td>
                <td class="course-date">
                    ${new Date(course.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    <br>
                    <small style="color: var(--text-light);">
                        ${new Date(course.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </small>
                </td>
                <td class="course-actions">
                    <button class="btn-action edit-btn" data-id="${cid}" title="Edit course">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete-btn" data-id="${cid}" data-title="${course.title || ''}" title="Delete course">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-action view-btn" onclick="window.open('/api/courses/${cid}', '_blank')" title="View API response">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                </td>
            </tr>
        `;
        }).join('');
    }

    renderErrorState() {
        const tbody = document.getElementById('coursesTableBody');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                    <p>Failed to load courses. Please check your connection.</p>
                    <button class="btn btn-primary mt-20" onclick="window.courseManager?.fetchCourses()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </td>
            </tr>
        `;
    }

    showLoading() {
        const tbody = document.getElementById('coursesTableBody');
        if (!tbody) return;

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

        const title = document.getElementById('title')?.value.trim() || '';
        const priceRaw = document.getElementById('price')?.value || '';
        const description = document.getElementById('description')?.value.trim() || '';

        if (!title || !priceRaw) {
            this.showNotification('Please fill in all required fields', 'warning');
            return;
        }

        const createBtn = e.target.querySelector('button[type="submit"]');
        const originalText = createBtn ? createBtn.innerHTML : '';

        try {
            if (createBtn) {
                createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
                createBtn.disabled = true;
            }

            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, price: Number(priceRaw), description })
            });

            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }

            if (!response.ok) {
                let msg = 'Failed to create course';
                try {
                    const err = await response.json();
                    msg = err.error || msg;
                } catch {}
                this.showNotification(`Error: ${msg}`, 'error');
                return;
            }

            const newCourse = await response.json();

            this.showNotification(`Course "${newCourse.title}" created successfully!`, 'success');
            document.getElementById('createForm')?.reset();
            this.fetchCourses();
            this.showSuccessModal(`Course "${newCourse.title}" has been successfully created with price $${Number(newCourse.price).toFixed(2)}.`);
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
        } finally {
            if (createBtn) {
                createBtn.innerHTML = originalText || '<i class="fas fa-save"></i> Create Course';
                createBtn.disabled = false;
            }
        }
    }

    async handleSearch() {
        const id = document.getElementById('searchCourse')?.value.trim() || '';
        if (!id) {
            this.showNotification('Please enter a course ID', 'warning');
            return;
        }
        await this.loadCourseForEdit(id);
    }

    async loadCourseForEdit(id) {
        try {
            const response = await fetch(`${this.API_URL}/${id}`);

            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }

            if (!response.ok) {
                let msg = 'Course not found';
                try {
                    const err = await response.json();
                    msg = err.error || msg;
                } catch {}
                this.showNotification(`Error: ${msg}`, 'error');
                return;
            }

            const course = await response.json();

            const cid = course.id || course._id || id;

            document.getElementById('updateId').value = cid;
            document.getElementById('updateTitle').value = course.title || '';
            document.getElementById('updatePrice').value = course.price ?? '';
            document.getElementById('updateDescription').value = course.description || '';

            document.getElementById('updateForm').style.display = 'block';
            document.getElementById('searchCourse').value = '';
            document.getElementById('updateTitle').focus();

            this.showNotification(`Course "${course.title}" loaded for editing`, 'info');


            if (updateId) updateId.value = course.id;
            if (updateTitle) updateTitle.value = course.title;
            if (updatePrice) updatePrice.value = course.price;
            if (updateDescription) updateDescription.value = course.description || '';

            if (updateForm) updateForm.style.display = 'block';
            const searchCourse = document.getElementById('searchCourse');
            if (searchCourse) searchCourse.value = '';

            if (updateTitle) updateTitle.focus();

            this.showNotification(`Course "${course.title}" loaded for editing`, 'info');
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    hideUpdateForm() {
        const updateForm = document.getElementById('updateForm');
        if (updateForm) updateForm.style.display = 'none';
    }

    async handleUpdate(e) {
        e.preventDefault();

        const id = document.getElementById('updateId')?.value || '';
        const title = document.getElementById('updateTitle')?.value.trim() || '';
        const priceRaw = document.getElementById('updatePrice')?.value || '';
        const description = document.getElementById('updateDescription')?.value.trim() || '';

        if (!title || !priceRaw) {
            this.showNotification('Please fill in all required fields', 'warning');
            return;
        }

        const updateBtn = e.target.querySelector('button[type="submit"]');
        const originalText = updateBtn ? updateBtn.innerHTML : '';

        try {
            if (updateBtn) {
                updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                updateBtn.disabled = true;
            }

            const response = await fetch(`${this.API_URL}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, price: Number(priceRaw), description })
            });

            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }

            if (!response.ok) {
                let msg = 'Failed to update course';
                try {
                    const err = await response.json();
                    msg = err.error || msg;
                } catch {}
                this.showNotification(`Error: ${msg}`, 'error');
                return;
            }

            const updatedCourse = await response.json();

            this.showNotification(`Course "${updatedCourse.title}" updated successfully!`, 'success');
            this.hideUpdateForm();
            this.fetchCourses();
            this.showSuccessModal(`Course "${updatedCourse.title}" has been successfully updated.`);
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
        } finally {
            if (updateBtn) {
                updateBtn.innerHTML = originalText || '<i class="fas fa-sync-alt"></i> Update Course';
                updateBtn.disabled = false;
            }
        }
    }

    showDeleteModal(id, title) {
        this.deleteCourseId = id;

        const preview = document.getElementById('deletePreview');
        if (preview) {
            preview.innerHTML = `
                <h4 style="margin-bottom: 10px; color: var(--danger);">
                    <i class="fas fa-exclamation-circle"></i> ${title}
                </h4>
                <p style="margin: 0; font-family: monospace; font-size: 0.9rem;">
                    ID: ${id}
                </p>
            `;
        }

        this.openModal('deleteModal');
    }

    async confirmDelete() {
        if (!this.deleteCourseId) return;

        try {
            const response = await fetch(`${this.API_URL}/${this.deleteCourseId}`, { method: 'DELETE' });

            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }

            if (!response.ok) {
                let msg = 'Failed to delete course';
                try {
                    const err = await response.json();
                    msg = err.error || msg;
                } catch {}
                this.showNotification(`Error: ${msg}`, 'error');
                return;
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
        const min = document.getElementById('quickMinPrice')?.value || '';
        const max = document.getElementById('quickMaxPrice')?.value || '';

        const minEl = document.getElementById('minPriceFilter');
        const maxEl = document.getElementById('maxPriceFilter');

        if (minEl && min) minEl.value = min;
        if (maxEl && max) maxEl.value = max;

        this.fetchCourses();
    }

    searchByTitle() {
        const searchTerm = (document.getElementById('searchTitle')?.value || '').toLowerCase();
        if (!searchTerm) {
            this.renderCoursesTable(this.currentCourses);
            return;
        }

        const filtered = this.currentCourses.filter(course =>
            String(course.title || '').toLowerCase().includes(searchTerm) ||
            String(course.description || '').toLowerCase().includes(searchTerm)
        );

        this.renderCoursesTable(filtered);
    }

    exportCourses() {
        const dataStr = JSON.stringify(this.currentCourses, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `courses_export_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        this.showNotification(`Exported ${this.currentCourses.length} courses`, 'success');
    }

    async checkApiStatus() {
        const statusA = document.getElementById('apiStatus');
        const statusB = document.getElementById('apiStatusFooter');

        const setStatus = (el, ok) => {
            if (!el) return;
            el.className = `status-badge ${ok ? 'online' : 'offline'}`;
            el.innerHTML = ok ? '● Online' : '● Offline';
        };

        try {
            const response = await fetch(this.API_URL);
            setStatus(statusA, response.ok);
            setStatus(statusB, response.ok);
        } catch {
            setStatus(statusA, false);
            setStatus(statusB, false);
        }
    }

    updateEnvironmentBadge() {
        const badge = document.getElementById('envBadge');
        if (!badge) return;

        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

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
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        document.body.appendChild(notification);

        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) closeBtn.onclick = () => notification.remove();

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'notificationSlideIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) reverse';
                setTimeout(() => notification.remove(), 500);
            }
        }, 5000);
    }

    showSuccessModal(message) {
        const msg = document.getElementById('successMessage');
        if (msg) msg.textContent = message;
        this.openModal('successModal');
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';
    }

    async handleLogout() {
        if (!confirm('Are you sure you want to logout?')) return;

        try {
            const response = await fetch('/api/auth/logout');
            if (response.ok) {
                window.location.href = '/login.html';
                return;
            }
            this.showNotification('Logout failed', 'error');
        } catch (error) {
            this.showNotification(`Logout error: ${error.message}`, 'error');
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

document.addEventListener('DOMContentLoaded', () => {
    const hasDashboard = document.getElementById('createForm') || document.getElementById('coursesTableBody');

    if (hasDashboard) {
        window.courseManager = new CourseManager();
    } else {
        window.courseManager = {
            showApiDocs: () => {
                const docs = `
Available API Endpoints:

GET    /api/courses
GET    /api/courses/:id
POST   /api/courses
PUT    /api/courses/:id
DELETE /api/courses/:id
                `;
                alert(docs);
            }
        };
    }
});
