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

        if (createForm) {
            createForm.addEventListener('submit', (e) => this.handleCreate(e));
        }

        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleSearch();
            });
        }

        if (updateForm) {
            updateForm.addEventListener('submit', (e) => this.handleUpdate(e));
        }

        const cancelUpdate = document.getElementById('cancelUpdate');
        if (cancelUpdate) {
            cancelUpdate.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideUpdateForm();
            });
        }

        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.fetchCourses();
            });
        }

        const sortFilter = document.getElementById('sortFilter');
        if (sortFilter) sortFilter.addEventListener('change', () => this.fetchCourses());

        const min = document.getElementById('minPriceFilter');
        const max = document.getElementById('maxPriceFilter');
        if (min) min.addEventListener('change', () => this.fetchCourses());
        if (max) max.addEventListener('change', () => this.fetchCourses());

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportCourses();
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }
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
            this.currentCourses = Array.isArray(courses) ? courses : [];

            this.updateStats(this.currentCourses);
            this.renderCoursesTable(this.currentCourses);
        } catch (error) {
            console.error(error);
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

    canModifyCourse(course) {
        if (!this.currentUser) return false;
        if (this.currentUser.role === 'admin') return true;
        const owner = course.ownerId ? String(course.ownerId) : null;
        return owner !== null && String(this.currentUser.id) === owner;
    }

    renderCoursesTable(courses) {
        const tbody = document.getElementById('coursesTableBody');
        if (!tbody) return;

        if (!courses.length) {
            tbody.innerHTML = `<tr><td colspan="8">No courses found</td></tr>`;
            return;
        }

        const isLoggedIn = !!this.currentUser;

        tbody.innerHTML = courses.map((course) => {
            const cid = course.id || course._id || '';
            const cidSafe = String(cid).replace(/'/g, "\\'");
            const price = Number(course.price || 0);
            const date = course.createdAt ? new Date(course.createdAt).toLocaleDateString() : '-';
            const titleSafe = String(course.title || '').replace(/'/g, "\\'");

            let actions = '';
            if (!isLoggedIn) {
                actions = '<span style="font-size:0.8em; color:#999;">Read Only</span>';
            } else if (!this.canModifyCourse(course)) {
                actions = '<span style="font-size:0.8em; color:#999;">No Access</span>';
            } else {
                actions =
                    `<button class="btn-action" onclick="courseManager.loadCourseForEdit('${cidSafe}')"><i class="fas fa-edit"></i></button>` +
                    `<button class="btn-action" onclick="deleteCourse('${cidSafe}', '${titleSafe}')"><i class="fas fa-trash"></i></button>`;
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

        const titleEl = document.getElementById('title');
        const priceEl = document.getElementById('price');
        const instructorEl = document.getElementById('instructor');
        const categoryEl = document.getElementById('category');

        if (!titleEl || !priceEl || !instructorEl || !categoryEl) {
            alert('Form fields are missing in HTML');
            return;
        }

        const title = titleEl.value.trim();
        const instructor = instructorEl.value.trim();
        const category = categoryEl.value.trim();

        if (!title) return alert('Title is required');
        if (!instructor) return alert('Instructor is required');
        if (!category) return alert('Category is required');

        const data = {
            title,
            price: priceEl.value,
            instructor,
            category,
            level: document.getElementById('level')?.value || 'Beginner',
            duration: document.getElementById('duration')?.value.trim() || 'TBD',
            language: document.getElementById('language')?.value.trim() || 'English',
            description: document.getElementById('description')?.value.trim() || ''
        };

        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `Failed to create (HTTP ${response.status})`);

            alert('Created successfully!');
            const form = document.getElementById('createForm');
            if (form) form.reset();
            await this.fetchCourses();
        } catch (error) {
            alert(error.message);
        }
    }

    async handleSearch() {
        const id = document.getElementById('searchCourse')?.value.trim();
        if (id) await this.loadCourseForEdit(id);
    }

    async loadCourseForEdit(id) {
        if (!this.currentUser) {
            alert('Login required');
            return;
        }

        try {
            const response = await fetch(`${this.API_URL}/${encodeURIComponent(id)}`, { credentials: 'include' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Not found');

            const course = payload;
            if (!this.canModifyCourse(course)) {
                alert('No access');
                return;
            }

            const cid = course.id || course._id || id;

            const updateId = document.getElementById('updateId');
            const updateTitle = document.getElementById('updateTitle');
            const updatePrice = document.getElementById('updatePrice');

            if (!updateId || !updateTitle || !updatePrice) {
                alert('Update form fields are missing in HTML');
                return;
            }

            updateId.value = cid;
            updateTitle.value = course.title || '';
            updatePrice.value = course.price ?? '';
            document.getElementById('updateInstructor').value = course.instructor || '';
            document.getElementById('updateCategory').value = course.category || '';
            document.getElementById('updateLevel').value = course.level || 'Beginner';
            document.getElementById('updateDuration').value = course.duration || '';
            document.getElementById('updateLanguage').value = course.language || '';
            document.getElementById('updateDescription').value = course.description || '';

            const form = document.getElementById('updateForm');
            if (form) form.style.display = 'block';

            const search = document.getElementById('searchCourse');
            if (search) search.value = '';
        } catch (error) {
            alert(error.message);
        }
    }

    hideUpdateForm() {
        const form = document.getElementById('updateForm');
        if (form) form.style.display = 'none';
    }

    async handleUpdate(e) {
        e.preventDefault();

        if (!this.currentUser) {
            alert('Login required');
            return;
        }

        const id = document.getElementById('updateId')?.value;
        if (!id) {
            alert('Missing course id');
            return;
        }

        const title = document.getElementById('updateTitle')?.value.trim() || '';
        const instructor = document.getElementById('updateInstructor')?.value.trim() || '';
        const category = document.getElementById('updateCategory')?.value.trim() || '';
        const level = document.getElementById('updateLevel')?.value || 'Beginner';

        if (!title) return alert('Title is required');
        if (!instructor) return alert('Instructor is required');
        if (!category) return alert('Category is required');

        const data = {
            title,
            price: document.getElementById('updatePrice')?.value || 0,
            instructor,
            category,
            level,
            duration: document.getElementById('updateDuration')?.value.trim() || 'TBD',
            language: document.getElementById('updateLanguage')?.value.trim() || 'English',
            description: document.getElementById('updateDescription')?.value.trim() || ''
        };

        try {
            const response = await fetch(`${this.API_URL}/${encodeURIComponent(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `Failed to update (HTTP ${response.status})`);

            alert('Updated successfully!');
            this.hideUpdateForm();
            await this.fetchCourses();
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
        const userInfo = document.getElementById('userInfo');
        const logoutBtn = document.getElementById('logoutBtn');

        try {
            const response = await fetch('/api/me', { credentials: 'include' });

            if (response.ok) {
                this.currentUser = await response.json();
                if (userInfo) userInfo.innerHTML = `<i class="fas fa-user-circle"></i> ${this.currentUser.username} (${this.currentUser.role})`;
                if (logoutBtn) logoutBtn.style.display = '';
            } else {
                this.currentUser = null;
                if (userInfo) userInfo.innerHTML = `<a href="/login.html">Login</a>`;
                if (logoutBtn) logoutBtn.style.display = 'none';
                this.hideUpdateForm();
            }
        } catch (e) {
            this.currentUser = null;
            if (userInfo) userInfo.innerHTML = `<a href="/login.html">Login</a>`;
            if (logoutBtn) logoutBtn.style.display = 'none';
            this.hideUpdateForm();
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
        const payload = await res.json().catch(() => ({}));
        if (res.ok) {
            window.courseManager.fetchCourses();
        } else {
            alert(payload.error || `Failed (HTTP ${res.status})`);
        }
    } catch (e) {
        alert(e.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.courseManager = new CourseManager();
});
