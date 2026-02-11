document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const usernameEl = document.getElementById("username");
    const passwordEl = document.getElementById("password");

    if (usernameEl) usernameEl.focus();

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = usernameEl.value.trim();
        const password = passwordEl.value;

        const btn = form.querySelector("button");
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ username, password })
            });

            let data = {};
            try { data = await res.json(); } catch (e) {}

            if (!res.ok) {
                throw new Error(data.error || "Login failed");
            }

            window.location.href = "/";
        } catch (err) {
            alert(err.message);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        }
    });
});
