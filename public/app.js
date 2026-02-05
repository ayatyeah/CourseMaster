class CourseManager {
    constructor() {
        this.API_URL = window.location.origin + '/api/courses';
        this.currentCourses = [];
        this.currentUser = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateUserInfo().then(() => this.fetchCourses());
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

        const min = document.getElementById('minPriceFilter');
        const max = document.getElementById('maxPriceFilter');
        if (min) min.onchange = () => this.fetchCourses();
        if (max) max.onchange = () => this.fetchCourses();

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.onclick = () => this.exportCourses();

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.onclick = (e) => {
            e.preventDefault();
            this.handleLogout();
        };
    }

    async fetchCourses() {
        const tbody = document.getElementById('coursesTableBody');
        try {
            const sort = document.getElementById('sortFilter')?.value || '';
            const minPrice = document.getElementById('minPriceFilter')?.value || '';
            const maxPrice = document.getElementById('maxPriceFilter')?.value || '';

            let url = this.API_URL;
            const params = [];

            if (sort) params.push(`sort=${encodeURIComponent(sort)}`);
            if (minPrice) params.push(`minPrice=${encodeURIComponent(minPrice)}`);
            if (maxPrice) params.push(`maxPrice=${encodeURIComponent(maxPrice)}`);

            if (params.length) url += `?${params.join('&')}`;

            const response = await fetch(url, { credentials: 'include' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const courses = await response.json();
            this.currentCourses = courses;

            this.updateStats(courses);
            this.renderCoursesTable(courses);
        } catch (error) {
            console.error('Fetch error:', error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="8">Error loading courses</td></tr>`;
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
            tbody.innerHTML = `<tr><td colspan="8">No courses found</td></tr>`;
            return;
        }

        const isAdmin = this.currentUser && this.currentUser.role === 'admin';
        const isLoggedIn = !!this.currentUser;

        tbody.innerHTML = courses.map(course => {
            const cid = course.id || course._id || '';
            const price = Number(course.price || 0);
            const date = course.createdAt ? new Date(course.createdAt).toLocaleDateString() : '-';

            let actions = '';
            if (isLoggedIn) {
                actions += `<button class="btn-action" onclick="courseManager.loadCourseForEdit('${String(cid).replace(/'/g, "\\'")}')"><i class="fas fa-edit"></i></button>`;
                if (isAdmin) {
                    const safeTitle = String(course.title || '').replace(/'/g, "\\'");
                    actions += `<button class="btn-action" onclick="deleteCourse('${String(cid).replace(/'/g, "\\'")}', '${safeTitle}')"><i class="fas fa-trash"></i></button>`;
                }
            } else {
                actions = '<span style="font-size:0.8em; color:#999;">Read Only</span>';
            }

            return `
        <tr>
          <td>${cid}</td>
          <td><strong>${course.title || ''}</strong></td>
          <td>${course.instructor || '-'}</td>
          <td>${course.category || '-'}</td>
          <td>${course.level || '-'}</td>
          <td>$${price.toFixed(2)}</td>
          <td>${date}</td>
          <td>${actions}</td>
        </tr>
      `;
        }).join('');
    }

    async handleCreate(e) {
        e.preventDefault();

        const data = {
            title: document.getElementById('title').value.trim(),
            price: document.getElementById('price').value,
            instructor: document.getElementById('instructor').value.trim(),
            category: document.getElementById('category').value.trim(),
            level: document.getElementById('level').value,
            duration: document.getElementById('duration').value.trim(),
            language: document.getElementById('language').value.trim(),
            description: document.getElementById('description').value.trim()
        };

        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to create');
            }

            alert('Created successfully!');
            document.getElementById('createForm').reset();
            this.fetchCourses();
        } catch (error) {
            alert(error.message);
        }
    }

    async handleSearch() {
        const id = document.getElementById('searchCourse')?.value.trim();
        if (id) await this.loadCourseForEdit(id);
    }

    async loadCourseForEdit(id) {
        try {
            const response = await fetch(`${this.API_URL}/${encodeURIComponent(id)}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Not found');

            const course = await response.json();
            const cid = course.id || course._id || id;

            document.getElementById('updateId').value = cid;
            document.getElementById('updateTitle').value = course.title || '';
            document.getElementById('updatePrice').value = course.price ?? '';
            document.getElementById('updateInstructor').value = course.instructor || '';
            document.getElementById('updateCategory').value = course.category || '';
            document.getElementById('updateLevel').value = course.level || 'Beginner';
            document.getElementById('updateDuration').value = course.duration || '';
            document.getElementById('updateLanguage').value = course.language || '';
            document.getElementById('updateDescription').value = course.description || '';

            document.getElementById('updateForm').style.display = 'block';
            const search = document.getElementById('searchCourse');
            if (search) search.value = '';
        } catch (error) {
            alert(error.message);
        }
    }

    hideUpdateForm() {
        document.getElementById('updateForm').style.display = 'none';
    }

    async handleUpdate(e) {
        e.preventDefault();

        const id = document.getElementById('updateId').value;

        const data = {
            title: document.getElementById('updateTitle').value.trim(),
            price: document.getElementById('updatePrice').value,
            instructor: document.getElementById('updateInstructor').value.trim(),
            category: document.getElementById('updateCategory').value.trim(),
            level: document.getElementById('updateLevel').value,
            duration: document.getElementById('updateDuration').value.trim(),
            language: document.getElementById('updateLanguage').value.trim(),
            description: document.getElementById('updateDescription').value.trim()
        };

        try {
            const response = await fetch(`${this.API_URL}/${encodeURIComponent(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to update');
            }

            alert('Updated successfully!');
            this.hideUpdateForm();
            this.fetchCourses();
        } catch (error) {
            alert(error.message);
        }
    }

    exportCourses() {
        const dataStr = JSON.stringify(this.currentCourses, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', 'courses.json');
        linkElement.click();
    }

    async updateUserInfo() {
        try {
            const response = await fetch('/api/me', { credentials: 'include' });
            const userInfo = document.getElementById('userInfo');

            if (response.ok) {
                this.currentUser = await response.json();
                if (userInfo) userInfo.innerHTML = `<i class="fas fa-user-circle"></i> ${this.currentUser.username} (${this.currentUser.role})`;
            } else {
                this.currentUser = null;
                if (userInfo) userInfo.innerHTML = `<a href="/login.html">Login</a>`;
                const logoutBtn = document.getElementById('logoutBtn');
                if (logoutBtn) logoutBtn.style.display = 'none';
            }
        } catch (e) {
            this.currentUser = null;
        }
    }

    async handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login.html';
    }
}

async function deleteCourse(id, title) {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
        const res = await fetch(`/api/courses/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) {
            window.courseManager.fetchCourses();
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.error || 'Failed');
        }
    } catch (e) {
        alert(e.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.courseManager = new CourseManager();
});
