class CourseManager {
    constructor() {
        this.API_URL = window.location.origin + '/api/courses';
        this.currentCourses = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.fetchCourses();
        this.updateUserInfo();
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

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.onclick = () => this.handleLogout();
    }

    async fetchCourses() {
        const tbody = document.getElementById('coursesTableBody');
        try {
            const sort = document.getElementById('sortFilter')?.value || '';
            const minPrice = document.getElementById('minPriceFilter')?.value || '';
            const maxPrice = document.getElementById('maxPriceFilter')?.value || '';

            let url = this.API_URL;
            const params = [];

            if (sort) params.push(`sort=${sort}`);
            if (minPrice) params.push(`minPrice=${minPrice}`);
            if (maxPrice) params.push(`maxPrice=${maxPrice}`);

            if (params.length) url += `?${params.join('&')}`;

            const response = await fetch(url, { credentials: 'include' });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const courses = await response.json();
            this.currentCourses = courses;

            this.updateStats(courses);
            this.renderCoursesTable(courses);
        } catch (error) {
            console.error('Fetch error:', error);
            if (tbody) tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading courses</p>
                    </td>
                </tr>
            `;
        }
    }

    updateStats(courses) {
        const totalCourses = document.getElementById('totalCourses');
        if (totalCourses) totalCourses.textContent = courses.length;

        const avgPriceEl = document.getElementById('avgPrice');
        const totalValueEl = document.getElementById('totalValue');

        if (!courses.length) {
            if (avgPriceEl) avgPriceEl.textContent = '$0';
            if (totalValueEl) totalValueEl.textContent = '$0';
            return;
        }

        const totalPrice = courses.reduce((sum, course) => sum + (Number(course.price) || 0), 0);
        const avgPrice = totalPrice / courses.length;

        if (avgPriceEl) avgPriceEl.textContent = `$${avgPrice.toFixed(2)}`;
        if (totalValueEl) totalValueEl.textContent = `$${totalPrice.toFixed(2)}`;
    }

    renderCoursesTable(courses) {
        const tbody = document.getElementById('coursesTableBody');
        if (!tbody) return;

        if (!courses.length) {
            tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-book"></i>
                    <p>No courses found</p>
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
                <td class="course-id">${cid}</td>
                <td class="course-title"><strong>${course.title || ''}</strong></td>
                <td class="course-desc">${course.description || ''}</td>
                <td class="course-price">$${price.toFixed(2)}</td>
                <td class="course-date">${new Date(course.createdAt).toLocaleDateString()}</td>
                <td class="course-actions">
                    <button class="btn-action edit-btn" onclick="courseManager.loadCourseForEdit('${cid}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete-btn" onclick="deleteCourse('${cid}', '${course.title || ''}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        }).join('');
    }

    async handleCreate(e) {
        e.preventDefault();

        const title = document.getElementById('title')?.value.trim() || '';
        const priceRaw = document.getElementById('price')?.value || '';
        const description = document.getElementById('description')?.value.trim() || '';

        if (!title || !priceRaw) {
            alert('Please fill in all required fields');
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
                credentials: 'include',
                body: JSON.stringify({ title, price: Number(priceRaw), description })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to create course');
            }

            const newCourse = await response.json();

            alert(`Course "${newCourse.title}" created successfully!`);
            document.getElementById('createForm')?.reset();
            this.fetchCourses();
        } catch (error) {
            alert(`Error: ${error.message}`);
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
            alert('Please enter a course ID');
            return;
        }
        await this.loadCourseForEdit(id);
    }

    async loadCourseForEdit(id) {
        try {
            const response = await fetch(`${this.API_URL}/${id}`, { credentials: 'include' });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Course not found');
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

            alert(`Course "${course.title}" loaded for editing`);
        } catch (error) {
            alert(`Error: ${error.message}`);
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
            alert('Please fill in all required fields');
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
                credentials: 'include',
                body: JSON.stringify({ title, price: Number(priceRaw), description })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to update course');
            }

            const updatedCourse = await response.json();

            alert(`Course "${updatedCourse.title}" updated successfully!`);
            this.hideUpdateForm();
            this.fetchCourses();
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            if (updateBtn) {
                updateBtn.innerHTML = originalText || '<i class="fas fa-sync-alt"></i> Update Course';
                updateBtn.disabled = false;
            }
        }
    }

    exportCourses() {
        const dataStr = JSON.stringify(this.currentCourses, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `courses_export_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        alert(`Exported ${this.currentCourses.length} courses`);
    }

    async updateUserInfo() {
        try {
            const response = await fetch('/api/me', { credentials: 'include' });
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

    async handleLogout() {
        if (!confirm('Are you sure you want to logout?')) return;

        try {
            const response = await fetch('/api/auth/logout', { credentials: 'include' });
            if (response.ok) {
                window.location.href = '/login.html';
                return;
            }
            alert('Logout failed');
        } catch (error) {
            alert(`Logout error: ${error.message}`);
        }
    }
}

async function deleteCourse(id, title) {
    if (!confirm(`Are you sure you want to delete course "${title}"?`)) return;

    try {
        const response = await fetch(`/api/courses/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.status === 403) {
            alert('Permission denied. Only admins can delete courses.');
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete course');
        }

        alert(`Course "${title}" deleted successfully!`);

        if (window.courseManager) {
            window.courseManager.fetchCourses();
        } else {
            location.reload();
        }

    } catch (error) {
        alert('Error: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.courseManager = new CourseManager();
});