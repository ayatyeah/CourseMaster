class AdminManager {
    constructor() {
        this.users = [];
        this.startTime = Date.now();
        this.deleteTarget = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadMe().then(() => this.loadUsers());
        this.updateUptime();
        setInterval(() => this.updateUptime(), 60000);
    }

    bindEvents() {
        document.getElementById('addUserForm').addEventListener('submit', (e) => this.handleAddUser(e));
        document.getElementById('refreshUsers').addEventListener('click', (e) => { e.preventDefault(); this.loadUsers(); });

        document.getElementById('logoutAdmin').addEventListener('click', async (e) => {
            e.preventDefault();
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/login.html';
        });

        document.querySelectorAll('[data-close]').forEach(b => {
            b.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModal(b.getAttribute('data-close'));
            });
        });

        document.getElementById('saveUserBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.saveUser();
        });

        document.getElementById('confirmDeleteBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.confirmDelete();
        });
    }

    async loadMe() {
        const r = await fetch('/api/me', { credentials: 'include' });
        if (!r.ok) {
            window.location.href = '/login.html';
            return;
        }
        const me = await r.json();
        document.getElementById('userInfo').innerHTML = `<i class="fas fa-user-circle"></i> ${me.username} (${me.role.toUpperCase()})`;
        if (me.role !== 'admin') window.location.href = '/';
    }

    async loadUsers() {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = `<tr><td colspan="3" class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading users...</p></td></tr>`;

        const r = await fetch('/api/admin/users', { credentials: 'include' });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
            tbody.innerHTML = `<tr><td colspan="3">Failed to load users</td></tr>`;
            return;
        }

        this.users = Array.isArray(data.items) ? data.items : [];
        this.renderUsers();
        this.updateStats();
    }

    renderUsers() {
        const tbody = document.getElementById('usersTableBody');
        if (!this.users.length) {
            tbody.innerHTML = `<tr><td colspan="3" class="empty-state"><i class="fas fa-users"></i><p>No users found</p></td></tr>`;
            return;
        }

        tbody.innerHTML = this.users.map(u => {
            const badgeBg = u.role === 'admin' ? 'var(--gradient-primary)' : 'var(--gradient-success)';
            return `
                <tr>
                    <td class="course-title"><strong>${this.escape(u.username)}</strong></td>
                    <td>
                        <span class="badge" style="background:${badgeBg}">${u.role.toUpperCase()}</span>
                    </td>
                    <td class="course-actions">
                        <button class="btn-action edit-btn" title="Edit" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);" onclick="adminManager.openEdit('${u.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action delete-btn" title="Delete" style="background: rgba(239, 68, 68, 0.1); color: var(--danger);" onclick="adminManager.openDelete('${u.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateStats() {
        document.getElementById('totalUsers').textContent = this.users.length;
        document.getElementById('adminUsers').textContent = this.users.filter(u => u.role === 'admin').length;
    }

    updateUptime() {
        const uptime = Date.now() - this.startTime;
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        document.getElementById('serverUptime').textContent = `${days}d ${hours}h`;
    }

    async handleAddUser(e) {
        e.preventDefault();
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value;
        const role = document.getElementById('newRole').value;

        const r = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password, role })
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
            alert(data.error || 'Failed');
            return;
        }

        document.getElementById('newUserId').value = data.user.id;
        document.getElementById('addUserForm').reset();
        await this.loadUsers();
    }

    openEdit(id) {
        const u = this.users.find(x => x.id === id);
        if (!u) return;

        document.getElementById('editUserId').value = u.id;
        document.getElementById('editUsername').value = u.username;
        document.getElementById('editRole').value = u.role;
        document.getElementById('editPassword').value = '';
        this.openModal('editUserModal');
    }

    async saveUser() {
        const id = document.getElementById('editUserId').value;
        const username = document.getElementById('editUsername').value.trim();
        const role = document.getElementById('editRole').value;
        const password = document.getElementById('editPassword').value;

        const body = { username, role };
        if (password && password.length) body.password = password;

        const r = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
            alert(data.error || 'Failed');
            return;
        }

        this.closeModal('editUserModal');
        await this.loadUsers();
    }

    openDelete(id) {
        const u = this.users.find(x => x.id === id);
        if (!u) return;

        this.deleteTarget = u;
        document.getElementById('deleteUserName').textContent = u.username;
        this.openModal('confirmDeleteUserModal');
    }

    async confirmDelete() {
        if (!this.deleteTarget) return;

        const r = await fetch(`/api/admin/users/${encodeURIComponent(this.deleteTarget.id)}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
            alert(data.error || 'Failed');
            return;
        }

        this.closeModal('confirmDeleteUserModal');
        this.deleteTarget = null;
        await this.loadUsers();
    }

    openModal(id) {
        document.getElementById(id).style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeModal(id) {
        document.getElementById(id).style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    escape(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
}

const adminManager = new AdminManager();
window.adminManager = adminManager;
