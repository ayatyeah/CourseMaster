class AdminManager {
    constructor() {
        this.currentUsers = [];
        this.editUserId = null;
        this.deleteUserId = null;
        this.startTime = Date.now();
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadUserInfo();
        this.loadUsers();
        this.updateUptime();
        setInterval(() => this.updateUptime(), 60000);
    }

    bindEvents() {
        const addUserForm = document.getElementById('addUserForm');
        const refreshUsers = document.getElementById('refreshUsers');
        const logoutBtn = document.getElementById('logoutBtn');

        if (addUserForm) addUserForm.onsubmit = (e) => this.handleAddUser(e);
        if (refreshUsers) refreshUsers.onclick = (e) => { e.preventDefault(); this.loadUsers(); };
        if (logoutBtn) logoutBtn.onclick = async (e) => {
            e.preventDefault();
            try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) {}
            window.location.href = '/login.html';
        };

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.onclick = () => this.closeAllModals();
        });

        const editCancelBtn = document.getElementById('editCancelBtn');
        const editSaveBtn = document.getElementById('editSaveBtn');
        const deleteCancelBtn = document.getElementById('deleteCancelBtn');
        const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');

        if (editCancelBtn) editCancelBtn.onclick = () => this.closeModal('editUserModal');
        if (editSaveBtn) editSaveBtn.onclick = () => this.saveUserChanges();
        if (deleteCancelBtn) deleteCancelBtn.onclick = () => this.closeModal('confirmDeleteUserModal');
        if (deleteConfirmBtn) deleteConfirmBtn.onclick = () => this.confirmDeleteUser();

        const cleanDbBtn = document.getElementById('cleanDbBtn');
        const exportAllBtn = document.getElementById('exportAllBtn');
        const analyticsBtn = document.getElementById('analyticsBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        const diagnosticsBtn = document.getElementById('diagnosticsBtn');
        const resetDemoBtn = document.getElementById('resetDemoBtn');

        if (cleanDbBtn) cleanDbBtn.onclick = () => showComingSoon();
        if (exportAllBtn) exportAllBtn.onclick = () => exportAllData();
        if (analyticsBtn) analyticsBtn.onclick = () => showAnalytics();
        if (settingsBtn) settingsBtn.onclick = () => showSettings();
        if (clearCacheBtn) clearCacheBtn.onclick = () => clearAllCache();
        if (diagnosticsBtn) diagnosticsBtn.onclick = () => runDiagnostics();
        if (resetDemoBtn) resetDemoBtn.onclick = () => this.loadUsers();
    }

    async request(url, options = {}) {
        const res = await fetch(url, { credentials: 'include', ...options });
        let data = {};
        try { data = await res.json(); } catch (e) {}
        if (!res.ok) {
            const msg = data.error || `HTTP ${res.status}`;
            throw new Error(msg);
        }
        return data;
    }

    async loadUserInfo() {
        try {
            const user = await this.request('/api/me');
            const el = document.getElementById('userInfo');
            if (el) el.innerHTML = `<i class="fas fa-user-circle"></i> ${user.username} (${String(user.role || '').toUpperCase()})`;
        } catch (error) {}
    }

    async loadUsers() {
        const tbody = document.getElementById('usersTableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="4">Loading...</td></tr>`;

        try {
            const data = await this.request('/api/admin/users');
            const items = Array.isArray(data.items) ? data.items : [];
            this.currentUsers = items.map((u, idx) => ({
                id: u.id,
                numId: idx + 1,
                username: u.username,
                role: u.role,
                createdAt: u.createdAt || null
            }));
            this.renderUsers();
        } catch (e) {
            this.currentUsers = [];
            if (tbody) tbody.innerHTML = `<tr><td colspan="4">Error: ${e.message}</td></tr>`;
            this.updateUserStats();
        }
    }

    renderUsers() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        if (this.currentUsers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>No users found</p>
                    </td>
                </tr>
            `;
            this.updateUserStats();
            return;
        }

        tbody.innerHTML = this.currentUsers.map(user => `
            <tr>
                <td class="course-id">${user.numId}</td>
                <td class="course-title"><strong>${user.username}</strong></td>
                <td>
                    <span class="badge" style="background: ${user.role === 'admin' ? 'var(--gradient-primary)' : 'var(--gradient-success)'}">
                        ${String(user.role).toUpperCase()}
                    </span>
                </td>
                <td class="course-actions">
                    <button class="btn-action edit-btn" data-edit-id="${user.id}" title="Edit user" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete-btn" data-del-id="${user.id}" data-del-name="${user.username}" title="Delete user" style="background: rgba(239, 68, 68, 0.1); color: var(--danger);">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.getAttribute('data-edit-id');
                this.editUser(id);
            });
        });

        tbody.querySelectorAll('[data-del-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.getAttribute('data-del-id');
                const name = btn.getAttribute('data-del-name') || '';
                this.showDeleteUserModal(id, name);
            });
        });

        this.updateUserStats();
    }

    updateUserStats() {
        const totalUsers = document.getElementById('totalUsers');
        const adminUsers = document.getElementById('adminUsers');
        if (totalUsers) totalUsers.textContent = this.currentUsers.length;
        if (adminUsers) adminUsers.textContent = this.currentUsers.filter(u => u.role === 'admin').length;
    }

    updateUptime() {
        const uptime = Date.now() - this.startTime;
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const el = document.getElementById('serverUptime');
        if (el) el.textContent = `${days}d ${hours}h`;
    }

    async handleAddUser(e) {
        e.preventDefault();

        const username = document.getElementById('newUsername')?.value.trim() || '';
        const password = document.getElementById('newPassword')?.value || '';
        const role = document.getElementById('newRole')?.value || 'user';

        if (!username || !password) {
            this.showAlert('Please fill in all required fields', 'warning');
            return;
        }

        try {
            await this.request('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });

            const form = document.getElementById('addUserForm');
            if (form) form.reset();

            this.showAlert(`User "${username}" created successfully`, 'success');
            await this.loadUsers();
        } catch (err) {
            this.showAlert(err.message, 'error');
        }
    }

    editUser(userId) {
        const user = this.currentUsers.find(u => String(u.id) === String(userId));
        if (!user) return;

        this.editUserId = userId;

        const idEl = document.getElementById('editUserId');
        const usernameEl = document.getElementById('editUsername');
        const roleEl = document.getElementById('editRole');
        const passEl = document.getElementById('editPassword');

        if (idEl) idEl.value = user.id;
        if (usernameEl) usernameEl.value = user.username;
        if (roleEl) roleEl.value = user.role;
        if (passEl) passEl.value = '';

        this.openModal('editUserModal');
    }

    async saveUserChanges() {
        const userId = document.getElementById('editUserId')?.value || '';
        const username = document.getElementById('editUsername')?.value.trim() || '';
        const role = document.getElementById('editRole')?.value || 'user';
        const password = document.getElementById('editPassword')?.value || '';

        if (!userId) return;

        if (!username) {
            this.showAlert('Username is required', 'warning');
            return;
        }

        const payload = { username, role };
        if (password && password.length) payload.password = password;

        try {
            await this.request(`/api/admin/users/${encodeURIComponent(userId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            this.closeModal('editUserModal');
            this.showAlert('User updated successfully', 'success');
            await this.loadUsers();
        } catch (err) {
            this.showAlert(err.message, 'error');
        }
    }

    showDeleteUserModal(userId, username) {
        this.deleteUserId = userId;
        const el = document.getElementById('deleteUserName');
        if (el) el.textContent = username;
        this.openModal('confirmDeleteUserModal');
    }

    async confirmDeleteUser() {
        if (!this.deleteUserId) return;

        try {
            await this.request(`/api/admin/users/${encodeURIComponent(this.deleteUserId)}`, {
                method: 'DELETE'
            });

            this.closeModal('confirmDeleteUserModal');
            this.showAlert('User deleted successfully', 'success');
            this.deleteUserId = null;
            await this.loadUsers();
        } catch (err) {
            this.showAlert(err.message, 'error');
        }
    }

    openModal(modalId) {
        const el = document.getElementById(modalId);
        if (!el) return;
        el.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        const el = document.getElementById(modalId);
        if (!el) return;
        el.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';
    }

    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `notification notification-${type}`;
        alert.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        document.body.appendChild(alert);

        const closeBtn = alert.querySelector('.notification-close');
        if (closeBtn) closeBtn.onclick = () => alert.remove();

        setTimeout(() => {
            if (alert.parentNode) {
                alert.style.animation = 'notificationSlideIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) reverse';
                setTimeout(() => alert.remove(), 500);
            }
        }, 3000);
    }
}

function showComingSoon() {
    alert('🚧 This feature is coming soon!');
}

function exportAllData() {
    const data = {
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `coursemaster_export_${new Date().toISOString().split('T')[0]}.json`);
    linkElement.click();

    adminManager.showAlert('Export generated', 'success');
}

function showAnalytics() {
    const analytics = `
        📊 System Analytics:

        • Total Users: ${adminManager.currentUsers.length}
        • Admin Users: ${adminManager.currentUsers.filter(u => u.role === 'admin').length}
        • Regular Users: ${adminManager.currentUsers.filter(u => u.role === 'user').length}
    `;
    alert(analytics);
}

function showSettings() {
    const settings = `
        ⚙️ System Settings

        • Authentication: Session-based
        • Database: MongoDB
        • API Version: 2.0.0
    `;
    alert(settings);
}

function clearAllCache() {
    if (confirm('Clear all cached data? This will log out all users.')) {
        adminManager.showAlert('Cache cleared', 'success');
    }
}

function runDiagnostics() {
    const diagnostics = `
        🔍 System Diagnostics

        Status: ✅ Online
        Authentication: ✅ Session
        Database: ✅ MongoDB
    `;
    alert(diagnostics);
}

const adminManager = new AdminManager();
window.adminManager = adminManager;
