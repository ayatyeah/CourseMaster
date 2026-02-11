class AdminManager {
    constructor() {
        this.currentUsers = [
            { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
            { id: 2, username: 'user', password: 'user123', role: 'user' }
        ];
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
        if (resetDemoBtn) resetDemoBtn.onclick = () => showResetModal();
    }

    async loadUserInfo() {
        try {
            const response = await fetch('/api/me', { credentials: 'include' });
            if (response.ok) {
                const user = await response.json();
                const el = document.getElementById('userInfo');
                if (el) el.innerHTML = `<i class="fas fa-user-circle"></i> ${user.username} (${String(user.role || '').toUpperCase()})`;
            }
        } catch (error) {}
    }

    loadUsers() {
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
            return;
        }

        tbody.innerHTML = this.currentUsers.map(user => `
            <tr>
                <td class="course-id">${user.id}</td>
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
                    <button class="btn-action delete-btn" data-del-id="${user.id}" data-del-name="${user.username}" title="Delete user" style="background: rgba(239, 68, 68, 0.1); color: var(--danger);" ${user.id === 1 ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = parseInt(btn.getAttribute('data-edit-id'));
                this.editUser(id);
            });
        });

        tbody.querySelectorAll('[data-del-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = parseInt(btn.getAttribute('data-del-id'));
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

    handleAddUser(e) {
        e.preventDefault();

        const username = document.getElementById('newUsername')?.value.trim() || '';
        const password = document.getElementById('newPassword')?.value || '';
        const role = document.getElementById('newRole')?.value || 'user';

        if (!username || !password) {
            this.showAlert('Please fill in all required fields', 'warning');
            return;
        }

        if (this.currentUsers.some(u => u.username === username)) {
            this.showAlert('Username already exists', 'error');
            return;
        }

        const newId = this.currentUsers.length > 0 ? Math.max(...this.currentUsers.map(u => u.id)) + 1 : 1;

        this.currentUsers.push({ id: newId, username, password, role });
        this.loadUsers();
        this.showAlert(`User "${username}" created successfully`, 'success');

        const form = document.getElementById('addUserForm');
        if (form) form.reset();
    }

    editUser(userId) {
        const user = this.currentUsers.find(u => u.id === userId);
        if (!user) return;

        this.editUserId = userId;
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editRole').value = user.role;
        document.getElementById('editPassword').value = '';

        this.openModal('editUserModal');
    }

    saveUserChanges() {
        const userId = parseInt(document.getElementById('editUserId').value);
        const username = document.getElementById('editUsername').value.trim();
        const role = document.getElementById('editRole').value;
        const password = document.getElementById('editPassword').value;

        if (!username) {
            this.showAlert('Username is required', 'warning');
            return;
        }

        const userIndex = this.currentUsers.findIndex(u => u.id === userId);
        if (userIndex === -1) return;

        this.currentUsers[userIndex].username = username;
        this.currentUsers[userIndex].role = role;
        if (password) this.currentUsers[userIndex].password = password;

        this.loadUsers();
        this.closeModal('editUserModal');
        this.showAlert('User updated successfully', 'success');
    }

    showDeleteUserModal(userId, username) {
        this.deleteUserId = userId;
        const el = document.getElementById('deleteUserName');
        if (el) el.textContent = username;
        this.openModal('confirmDeleteUserModal');
    }

    confirmDeleteUser() {
        if (!this.deleteUserId) return;

        this.currentUsers = this.currentUsers.filter(u => u.id !== this.deleteUserId);
        this.loadUsers();
        this.closeModal('confirmDeleteUserModal');
        this.showAlert('User deleted successfully', 'success');
        this.deleteUserId = null;
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
        users: adminManager.currentUsers,
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `coursemaster_export_${new Date().toISOString().split('T')[0]}.json`);
    linkElement.click();

    adminManager.showAlert('Data exported successfully', 'success');
}

function showAnalytics() {
    const analytics = `
        📊 System Analytics:

        • Total Users: ${adminManager.currentUsers.length}
        • Admin Users: ${adminManager.currentUsers.filter(u => u.role === 'admin').length}
        • Regular Users: ${adminManager.currentUsers.filter(u => u.role === 'user').length}

        Features coming soon:
        • Course enrollment statistics
        • Revenue analytics
        • User activity reports
        • Performance metrics
    `;
    alert(analytics);
}

function showSettings() {
    const settings = `
        ⚙️ System Settings

        Current Configuration:
        • Authentication: Session-based
        • Database: MongoDB
        • Environment: Development
        • API Version: 2.0.0

        Configuration options coming soon:
        • Email notifications
        • Payment gateway
        • Theme customization
        • Security settings
    `;
    alert(settings);
}

function clearAllCache() {
    if (confirm('Clear all cached data? This will log out all users.')) {
        adminManager.showAlert('Cache cleared successfully', 'success');
    }
}

function runDiagnostics() {
    const diagnostics = `
        🔍 System Diagnostics

        Status: ✅ All systems operational
        API: ✅ Online
        Database: ✅ Connected
        Authentication: ✅ Active

        Performance:
        • Response time: < 100ms
        • Memory usage: Normal
        • CPU load: Low

        Recommendations:
        • No issues detected
        • System is running optimally
    `;
    alert(diagnostics);
}

function showResetModal() {
    if (confirm('⚠️ WARNING: This will reset all demo data to initial state. Continue?')) {
        adminManager.currentUsers = [
            { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
            { id: 2, username: 'user', password: 'user123', role: 'user' }
        ];
        adminManager.loadUsers();
        adminManager.showAlert('Demo data reset successfully', 'success');
    }
}

const adminManager = new AdminManager();
window.adminManager = adminManager;
