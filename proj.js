/* =========================================================
   Taskboard - Student Task Manager (proj.js)
   Concepts used: variables, arrays, objects, functions,
   DOM manipulation, events, validation, localStorage + JSON,
   array methods (filter, find, findIndex, forEach, splice, sort)
   ========================================================= */

/* ---------- 1. Data layer (saves to the browser) ---------- */
let currentUser = null;      // logged-in username
let currentAvatar = "🎓";
let log = [];                // completion history: {id, title, category, day, at}

// Load tasks from Local Storage (JSON string -> JavaScript array)
function loadTasks() {
    try {
        return currentUser ? JSON.parse(localStorage.getItem("taskboard.tasks." + currentUser)) || [] : [];
    } catch (error) {
        return [];
    }
}

// Save tasks to Local Storage (JavaScript array -> JSON string)
function saveTasks() {
    if (currentUser) localStorage.setItem("taskboard.tasks." + currentUser, JSON.stringify(tasks));
}

function loadLog() {
    try {
        return currentUser ? JSON.parse(localStorage.getItem("taskboard.log." + currentUser)) || [] : [];
    } catch (error) {
        return [];
    }
}

function saveLog() {
    if (currentUser) localStorage.setItem("taskboard.log." + currentUser, JSON.stringify(log));
}

function dayKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/* ---------- 2. App state ---------- */
let tasks = loadTasks();
let currentFilter = "all";   // all | active | done
let editingId = null;        // id of the task being edited, or null
let toastTimer = null;
let lastAddedId = null;      // used for the slide-in animation

const priorityRank = { high: 0, medium: 1, low: 2 };
const priorityLabel = { high: "High", medium: "Medium", low: "Low" };
const priorityEmoji = { high: "🔥", medium: "⚡", low: "🌱" };

const categories = ["Study", "Work", "Personal", "Health"];
const categoryEmoji = { Study: "📚", Work: "💼", Personal: "🌸", Health: "💪" };

// Motivational messages (an array of strings)
const quotes = [
    "Small steps every day add up to big results.",
    "Start with the easiest task and build momentum.",
    "Done is better than perfect. Tick one off now.",
    "Future you will thank you for finishing this today.",
    "Focus on progress, not perfection.",
    "One task at a time. You have got this.",
    "A little revision today saves a lot of stress later.",
    "Break big tasks into small ones, then finish them."
];

/* Profile (name + theme) is saved in Local Storage as JSON */
const PROFILE_KEY = "taskboard.profile";

function loadProfile() {
    try {
        const saved = JSON.parse(localStorage.getItem(PROFILE_KEY));
        return { name: (saved && saved.name) || "", theme: (saved && saved.theme) || "light" };
    } catch (error) {
        return { name: "", theme: "light" };
    }
}

function saveProfile() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

let profile = loadProfile();

/* ---------- 3. Grab HTML elements ---------- */
const form = document.getElementById("taskForm");
const titleInput = document.getElementById("title");
const categoryInput = document.getElementById("category");
const priorityInput = document.getElementById("priority");
const dueInput = document.getElementById("due");
const titleError = document.getElementById("titleError");
const dueError = document.getElementById("dueError");
const submitBtn = document.getElementById("submitBtn");
const cancelBtn = document.getElementById("cancelBtn");
const formTitle = document.getElementById("formTitle");
const searchInput = document.getElementById("search");
const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");
const clearDoneBtn = document.getElementById("clearDone");
const studentNameInput = document.getElementById("studentName");
const avatar = document.getElementById("avatar");
const themeBtn = document.getElementById("themeBtn");
const quoteText = document.getElementById("quoteText");
const quoteBtn = document.getElementById("quoteBtn");
const statsList = document.getElementById("statsList");

/* ---------- 4. Date helpers ---------- */
function todayString() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}

// Number of days from today until the given YYYY-MM-DD date
function daysUntil(dateString) {
    const [y, m, d] = dateString.split("-").map(Number);
    const due = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((due - today) / 86400000);
}

function dueLabel(task) {
    const n = daysUntil(task.due);
    if (n < 0) {
        const days = Math.abs(n);
        return `Overdue by ${days} day${days === 1 ? "" : "s"}`;
    }
    if (n === 0) return "Due today";
    if (n === 1) return "Due tomorrow";
    const [y, m, d] = task.due.split("-").map(Number);
    const text = new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `Due ${text}`;
}

/* ---------- 5. Toast message ---------- */
function showToast(message, undoCallback) {
    const toast = document.getElementById("toast");
    const toastText = document.getElementById("toastText");
    const oldAction = document.getElementById("toastAction");

    // Replace the button to remove any old click handler
    const action = oldAction.cloneNode(true);
    oldAction.replaceWith(action);

    toastText.textContent = message;

    if (undoCallback) {
        action.hidden = false;
        action.addEventListener("click", function () {
            undoCallback();
            toast.hidden = true;
        });
    } else {
        action.hidden = true;
    }

    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toast.hidden = true;
    }, 4000);
}

/* ---------- 6. Render the page ---------- */
function getVisibleTasks() {
    const text = searchInput.value.trim().toLowerCase();

    return tasks
        .filter(function (task) {
            if (currentFilter === "pending") return !task.done;
            if (currentFilter === "completed") return task.done;
            return true;
        })
        .filter(function (task) {
            return task.title.toLowerCase().includes(text) ||
                   task.category.toLowerCase().includes(text);
        })
        .sort(function (a, b) {
            // Pending first, then earliest due date, then priority, then oldest
            return (a.done - b.done) ||
                   (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99") ||
                   (priorityRank[a.priority] - priorityRank[b.priority]) ||
                   (a.createdAt - b.createdAt);
        });
}

function createTaskItem(task) {
    const li = document.createElement("li");
    li.className = "task" + (task.done ? " is-done" : "") + (task.id === editingId ? " is-editing" : "") + (task.id === lastAddedId ? " is-new" : "");
    li.dataset.id = task.id;
    li.dataset.priority = task.priority;

    // Checkbox
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task__check";
    check.checked = task.done;
    check.setAttribute("aria-label", "Mark \"" + task.title + "\" as done");

    // Title + chips
    const body = document.createElement("div");

    const title = document.createElement("p");
    title.className = "task__title";
    title.textContent = task.title;   // textContent keeps user input safe

    const meta = document.createElement("div");
    meta.className = "task__meta";

    const catChip = document.createElement("span");
    catChip.className = "chip";
    catChip.dataset.cat = task.category;
    catChip.textContent = categoryEmoji[task.category] + " " + task.category;

    const prioChip = document.createElement("span");
    prioChip.className = "chip";
    prioChip.dataset.prio = task.priority;
    prioChip.textContent = priorityEmoji[task.priority] + " " + priorityLabel[task.priority];

    meta.append(catChip, prioChip);

    if (task.due) {
        const due = document.createElement("span");
        due.className = "due" + (!task.done && daysUntil(task.due) < 0 ? " overdue" : "");
        due.textContent = dueLabel(task);
        meta.append(due);
    }

    body.append(title, meta);

    // Edit + Delete buttons
    const actions = document.createElement("div");
    actions.className = "task__actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.dataset.action = "edit";
    editBtn.textContent = "✏️ Edit";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn";
    deleteBtn.dataset.action = "delete";
    deleteBtn.textContent = "🗑️ Delete";

    if (!task.done) {
        const focusBtn = document.createElement("button");
        focusBtn.className = "icon-btn";
        focusBtn.dataset.action = "focus";
        focusBtn.textContent = timer && timer.taskId === task.id ? "⏱ Focusing" : "▶ Focus";
        actions.append(focusBtn);
    }
    actions.append(editBtn, deleteBtn);

    li.append(check, body, actions);
    return li;
}

function updateStats() {
    const total = tasks.length;
    const done = tasks.filter(function (t) { return t.done; }).length;
    const remaining = total - done;
    const overdue = tasks.filter(function (t) {
        return !t.done && t.due && daysUntil(t.due) < 0;
    }).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    document.getElementById("doneCount").textContent = done;
    document.getElementById("totalCount").textContent = total;
    document.getElementById("barFill").style.width = percent + "%";
    document.getElementById("percentText").textContent = percent + "%";

    document.getElementById("countAll").textContent = total;
    document.getElementById("countPending").textContent = remaining;
    document.getElementById("countCompleted").textContent = done;

    clearDoneBtn.disabled = done === 0;

    // Greeting and summary
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const name = studentNameInput.value.trim();
    document.getElementById("greeting").textContent = name ? `${greeting}, ${name}` : greeting;

    let summary;
    if (total === 0) {
        summary = "Add your first task to get started.";
    } else if (remaining === 0) {
        summary = "Everything is done. Nice work.";
    } else {
        summary = `${remaining} task${remaining === 1 ? "" : "s"} left`;
        if (overdue > 0) summary += `, ${overdue} overdue`;
        summary += ".";
    }
    document.getElementById("summary").textContent = summary;

    updateCategoryStats();
}

function render() {
    const visible = getVisibleTasks();

    taskList.innerHTML = "";
    visible.forEach(function (task) {
        taskList.appendChild(createTaskItem(task));
    });
    lastAddedId = null;

    // Empty states
    if (visible.length === 0) {
        const title = document.getElementById("emptyTitle");
        const text = document.getElementById("emptyText");
        const emoji = document.getElementById("emptyEmoji");

        if (tasks.length === 0) {
            emoji.textContent = "📭";
            title.textContent = "No tasks yet";
            text.textContent = "Add a task above to start your list.";
        } else if (searchInput.value.trim()) {
            emoji.textContent = "🔍";
            title.textContent = "No matching tasks";
            text.textContent = "Try a different search word.";
        } else if (currentFilter === "completed") {
            emoji.textContent = "🎯";
            title.textContent = "Nothing completed yet";
            text.textContent = "Tick a task to see it here.";
        } else {
            emoji.textContent = "🎉";
            title.textContent = "All caught up";
            text.textContent = "You have no active tasks.";
        }
        emptyState.hidden = false;
    } else {
        emptyState.hidden = true;
    }

    // Highlight the active filter tab
    document.querySelectorAll(".tab").forEach(function (tab) {
        tab.setAttribute("aria-pressed", tab.dataset.filter === currentFilter ? "true" : "false");
    });

    updateStats();
    updateStreak();
    renderHistory();
    renderSummary();
    paintTimer();
}

/* ---------- 7. Form: validate, add, edit ---------- */
function clearErrors() {
    titleError.textContent = "";
    dueError.textContent = "";
    titleInput.classList.remove("invalid");
    dueInput.classList.remove("invalid");
}

function resetForm() {
    form.reset();
    priorityInput.value = "medium";
    editingId = null;
    formTitle.textContent = "Add a task";
    submitBtn.textContent = "Add task";
    cancelBtn.hidden = true;
    clearErrors();
}

function validateForm(originalDue) {
    let valid = true;
    const title = titleInput.value.trim();
    const due = dueInput.value;

    clearErrors();

    if (!title) {
        titleError.textContent = "Enter a task title.";
        valid = false;
    } else if (title.length < 3) {
        titleError.textContent = "Use at least 3 characters.";
        valid = false;
    } else if (title.length > 80) {
        titleError.textContent = "Keep the title under 80 characters.";
        valid = false;
    }
    if (!valid) titleInput.classList.add("invalid");

    // Past dates are only blocked when the date is new or changed
    if (due && due < todayString() && due !== originalDue) {
        dueError.textContent = "Choose today or a future date.";
        dueInput.classList.add("invalid");
        valid = false;
    }

    return valid;
}

form.addEventListener("submit", function (event) {
    event.preventDefault();

    const editingTask = tasks.find(function (t) { return t.id === editingId; });
    const originalDue = editingTask ? editingTask.due : null;

    if (!validateForm(originalDue)) return;

    const title = titleInput.value.trim();

    if (editingTask) {
        editingTask.title = title;
        editingTask.category = categoryInput.value;
        editingTask.priority = priorityInput.value;
        editingTask.due = dueInput.value;
        saveTasks();
        resetForm();
        render();
        showToast("Task updated");
    } else {
        const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        tasks.push({
            id: newId,
            title: title,
            category: categoryInput.value,
            priority: priorityInput.value,
            due: dueInput.value,
            done: false,
            createdAt: Date.now()
        });
        lastAddedId = newId;
        saveTasks();

        // Make sure the new task is visible
        currentFilter = "all";
        searchInput.value = "";

        resetForm();
        render();
        showToast("Task added");
        titleInput.focus();
    }
});

// Remove the error as soon as the user fixes the field
titleInput.addEventListener("input", function () {
    if (titleInput.value.trim().length >= 3) {
        titleError.textContent = "";
        titleInput.classList.remove("invalid");
    }
});

dueInput.addEventListener("input", function () {
    dueError.textContent = "";
    dueInput.classList.remove("invalid");
});

cancelBtn.addEventListener("click", function () {
    resetForm();
    render();
});

/* ---------- 8. Task list events (tick, edit, delete) ---------- */
taskList.addEventListener("change", function (event) {
    if (!event.target.classList.contains("task__check")) return;

    const id = event.target.closest(".task").dataset.id;
    const task = tasks.find(function (t) { return t.id === id; });
    if (!task) return;

    task.done = event.target.checked;
    if (task.done) {
        log.push({ id: task.id, title: task.title, category: task.category, day: dayKey(new Date()), at: Date.now() });
    } else {
        log = log.filter(function (e) { return e.id !== task.id; });   // un-ticking removes it
    }
    saveLog();
    saveTasks();
    if (task.done && timer && timer.taskId === id) stopTimer();
    render();

    if (task.done && tasks.every(function (t) { return t.done; })) {
        showToast("🎉 All tasks completed. Great job!");
    }
});

taskList.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.closest(".task").dataset.id;
    const index = tasks.findIndex(function (t) { return t.id === id; });
    if (index === -1) return;

    if (button.dataset.action === "focus") {
        startTimer(tasks[index]);
        return;
    }

    if (button.dataset.action === "edit") {
        const task = tasks[index];
        editingId = id;
        titleInput.value = task.title;
        categoryInput.value = task.category;
        priorityInput.value = task.priority;
        dueInput.value = task.due;
        clearErrors();

        formTitle.textContent = "Edit task";
        submitBtn.textContent = "Save changes";
        cancelBtn.hidden = false;

        render();
        form.scrollIntoView({ behavior: "smooth", block: "center" });
        titleInput.focus();
    }

    if (button.dataset.action === "delete") {
        if (timer && timer.taskId === id) stopTimer();
        const removed = tasks.splice(index, 1)[0];   // splice removes the task
        if (editingId === id) resetForm();
        saveTasks();
        render();

        showToast("Task deleted", function () {
            tasks.splice(index, 0, removed);          // Undo puts it back
            saveTasks();
            render();
        });
    }
});

/* ---------- 9. Search, filter tabs, clear completed ---------- */
searchInput.addEventListener("input", render);

document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
        currentFilter = tab.dataset.filter;
        render();
    });
});

clearDoneBtn.addEventListener("click", function () {
    const count = tasks.filter(function (t) { return t.done; }).length;
    if (count === 0) return;

    if (editingId && tasks.some(function (t) { return t.id === editingId && t.done; })) {
        resetForm();
    }

    tasks = tasks.filter(function (t) { return !t.done; });
    saveTasks();
    render();
    showToast(`${count} completed task${count === 1 ? "" : "s"} cleared`);
});

/* ---------- 10. Category statistics (uses a for...of loop) ---------- */
const statRefs = {};

function buildStatRows() {
    for (const category of categories) {
        const row = document.createElement("div");
        row.className = "stat";
        row.dataset.cat = category;

        const top = document.createElement("div");
        top.className = "stat__top";
        const label = document.createElement("span");
        label.textContent = categoryEmoji[category] + " " + category;
        const count = document.createElement("span");
        top.append(label, count);

        const track = document.createElement("div");
        track.className = "stat__track";
        const fill = document.createElement("div");
        fill.className = "stat__fill";
        track.append(fill);

        row.append(top, track);
        statsList.append(row);
        statRefs[category] = { count: count, fill: fill };
    }
}

function updateCategoryStats() {
    for (const category of categories) {
        const inCategory = tasks.filter(function (t) { return t.category === category; });
        const done = inCategory.filter(function (t) { return t.done; }).length;
        const percent = inCategory.length === 0 ? 0 : Math.round((done / inCategory.length) * 100);

        statRefs[category].count.textContent = `${done}/${inCategory.length} done`;
        statRefs[category].fill.style.width = percent + "%";
    }
}

/* ---------- 11. Profile, dark mode and motivational quote ---------- */
function updateAvatar() {
    const name = studentNameInput.value.trim();
    avatar.textContent = currentUser ? currentAvatar : "🎓";
}

function applyTheme() {
    document.documentElement.dataset.theme = profile.theme;
    themeBtn.textContent = profile.theme === "dark" ? "☀️" : "🌙";
    themeBtn.setAttribute("aria-label", profile.theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

themeBtn.addEventListener("click", function () {
    profile.theme = profile.theme === "dark" ? "light" : "dark";
    saveProfile();
    applyTheme();
});

studentNameInput.addEventListener("input", function () {
    profile.name = studentNameInput.value.trim();
    saveProfile();
    updateAvatar();
    updateStats();
});

let quoteIndex = new Date().getDate() % quotes.length;   // a different quote each day

function showQuote() {
    quoteText.textContent = quotes[quoteIndex];
}

// Local fallback if the API cannot be reached
function showNextLocalQuote() {
    quoteIndex = (quoteIndex + 1) % quotes.length;
    showQuote();
}

// API example 1: fetch a random quote (Promise with .then / .catch)
quoteBtn.addEventListener("click", function () {
    quoteBtn.disabled = true;
    quoteBtn.textContent = "Loading...";

    fetch("https://dummyjson.com/quotes/random")
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Request failed: " + response.status);
            }
            return response.json();                 // JSON -> JavaScript object
        })
        .then(function (data) {
            quoteText.textContent = `"${data.quote}" - ${data.author}`;
        })
        .catch(function () {
            showNextLocalQuote();                   // no internet: use our own quotes
        })
        .finally(function () {
            quoteBtn.disabled = false;
            quoteBtn.textContent = "New quote";
        });
});

// API example 2: import sample tasks from the same API used in class
document.getElementById("importBtn").addEventListener("click", function () {
    const importBtn = document.getElementById("importBtn");
    importBtn.disabled = true;
    importBtn.textContent = "Importing...";

    fetch("https://jsonplaceholder.typicode.com/todos?_limit=5")
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Request failed: " + response.status);
            }
            return response.json();
        })
        .then(function (todos) {
            let added = 0;

            todos.forEach(function (todo) {
                const id = "api-" + todo.id;
                const alreadyThere = tasks.some(function (t) { return t.id === id; });
                if (alreadyThere) return;               // do not import twice

                tasks.push({
                    id: id,
                    title: todo.title.charAt(0).toUpperCase() + todo.title.slice(1),
                    category: "Study",
                    priority: "medium",
                    due: "",
                    done: todo.completed,
                    createdAt: Date.now() + todo.id
                });
                added++;
            });

            saveTasks();
            currentFilter = "all";
            render();
            showToast(added > 0 ? `Imported ${added} task${added === 1 ? "" : "s"}` : "Sample tasks already imported");
        })
        .catch(function () {
            showToast("Could not import tasks. Check your internet connection.");
        })
        .finally(function () {
            importBtn.disabled = false;
            importBtn.textContent = "☁️ Import sample tasks";
        });
});

/* ---------- 12. Streak (Duolingo style) and History ---------- */
function updateStreak() {
    const days = new Set(log.map(function (e) { return e.day; }));
    const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);   // today not done yet: count from yesterday

    let streak = 0;
    while (days.has(dayKey(d))) {
        streak++;
        d.setDate(d.getDate() - 1);
    }

    const doneToday = days.has(dayKey(new Date()));
    document.getElementById("streakNum").textContent = streak;
    document.getElementById("streakMsg").textContent =
        streak === 0 ? "Complete a task today to start a streak." :
        doneToday ? "You are on fire. Come back tomorrow." : "Complete a task today to keep your streak alive.";

    const week = document.getElementById("streakWeek");
    week.innerHTML = "";
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const cell = document.createElement("div");
        cell.className = "day" + (days.has(dayKey(date)) ? " is-done" : "") + (i === 0 ? " is-today" : "");
        cell.innerHTML = '<div class="day__dot"></div><span></span>';
        cell.firstChild.textContent = days.has(dayKey(date)) ? "✓" : "";
        cell.lastChild.textContent = date.toLocaleDateString("en-IN", { weekday: "narrow" });
        week.append(cell);
    }
}

function dayLabel(day) {
    const n = daysUntil(day);
    if (n === 0) return "Today";
    if (n === -1) return "Yesterday";
    const [y, m, dd] = day.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

function renderHistory() {
    const box = document.getElementById("historyList");
    box.innerHTML = "";

    if (log.length === 0) {
        box.innerHTML = '<div class="empty"><p class="empty__emoji">🕘</p><p class="empty__title">No history yet</p><p class="empty__text">Tasks you complete will appear here, grouped by day.</p></div>';
        return;
    }

    const groups = {};
    for (const entry of log) {
        (groups[entry.day] = groups[entry.day] || []).push(entry);
    }

    for (const day of Object.keys(groups).sort().reverse()) {
        const section = document.createElement("div");
        section.className = "hist-day";
        const head = document.createElement("h3");
        const label = document.createElement("strong");
        label.textContent = dayLabel(day);
        const count = document.createElement("span");
        count.textContent = `${groups[day].length} completed`;
        head.append(label, count);
        section.append(head);

        groups[day].sort(function (a, b) { return b.at - a.at; }).forEach(function (entry) {
            const row = document.createElement("div");
            row.className = "hist-item";
            const text = document.createElement("span");
            text.textContent = (categoryEmoji[entry.category] || "✅") + " " + entry.title;
            const time = document.createElement("time");
            time.textContent = new Date(entry.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
            row.append(text, time);
            section.append(row);
        });
        box.append(section);
    }
}

function showView(view) {
    for (const name of ["tasks", "history", "summary"]) {
        const label = name.charAt(0).toUpperCase() + name.slice(1);
        document.getElementById(name + "View").hidden = view !== name;
        document.getElementById("view" + label).setAttribute("aria-pressed", String(view === name));
    }
}
document.getElementById("viewSummary").addEventListener("click", function () { showView("summary"); });
document.getElementById("viewTasks").addEventListener("click", function () { showView("tasks"); });
document.getElementById("viewHistory").addEventListener("click", function () { showView("history"); });

/* ---------- 13. Accounts (login / sign up, stored in this browser) ---------- */
const USERS_KEY = "taskboard.users";
const SESSION_KEY = "taskboard.session";
const avatarChoices = ["🐠", "🐙", "🐢", "🦀", "🐬", "🪸"];
let authMode = "login";
let chosenAvatar = avatarChoices[0];

function loadUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch (error) { return {}; }
}

// Passwords are never stored as plain text: we save a SHA-256 hash
async function hashPassword(username, password) {
    const text = username + ":" + password;
    if (window.crypto && window.crypto.subtle) {
        const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buffer)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    }
    let h = 5381;                                   // fallback for very old browsers
    for (const ch of text) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
    return "d" + h;
}

function setAuthMode(mode) {
    authMode = mode;
    document.getElementById("modeLogin").setAttribute("aria-pressed", String(mode === "login"));
    document.getElementById("modeSignup").setAttribute("aria-pressed", String(mode === "signup"));
    document.getElementById("avatarField").hidden = mode !== "signup";
    document.getElementById("authSubmit").textContent = mode === "signup" ? "Create account" : "Log in";
    document.getElementById("authError").textContent = "";
}

function buildAvatarPicker() {
    const pick = document.getElementById("avatarPick");
    for (const emoji of avatarChoices) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = emoji;
        b.setAttribute("aria-pressed", String(emoji === chosenAvatar));
        b.addEventListener("click", function () {
            chosenAvatar = emoji;
            pick.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        });
        pick.append(b);
    }
}

function startSession(username) {
    currentUser = username;
    currentAvatar = loadUsers()[username].avatar;
    localStorage.setItem(SESSION_KEY, username);
    tasks = loadTasks();
    log = loadLog();
    sessions = loadSessions();
    settings = loadSettings();
    applySettingsToForm();
    restoreTimer();
    studentNameInput.value = username;
    updateAvatar();
    resetForm();
    currentFilter = "all";
    searchInput.value = "";
    showView("tasks");
    document.getElementById("auth").hidden = true;
    render();
}

function logout() {
    stopTimer();
    localStorage.removeItem(SESSION_KEY);
    currentUser = null;
    sessions = [];
    tasks = [];
    log = [];
    studentNameInput.value = "";
    updateAvatar();
    resetForm();
    document.getElementById("authForm").reset();
    setAuthMode("login");
    document.getElementById("auth").hidden = false;
    render();
}

document.getElementById("modeLogin").addEventListener("click", function () { setAuthMode("login"); });
document.getElementById("modeSignup").addEventListener("click", function () { setAuthMode("signup"); });
document.getElementById("logoutBtn").addEventListener("click", logout);

document.getElementById("authForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    const error = document.getElementById("authError");
    const username = document.getElementById("authUser").value.trim().toLowerCase();
    const password = document.getElementById("authPass").value;
    const users = loadUsers();

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        error.textContent = "Username: 3 to 20 letters, numbers or _.";
        return;
    }
    if (password.length < 6) {
        error.textContent = "Password must be at least 6 characters.";
        return;
    }

    const hash = await hashPassword(username, password);

    if (authMode === "signup") {
        if (users[username]) {
            error.textContent = "That username is taken. Try another.";
            return;
        }
        users[username] = { hash: hash, avatar: chosenAvatar, created: Date.now() };
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } else if (!users[username] || users[username].hash !== hash) {
        error.textContent = "Wrong username or password.";
        return;
    }

    error.textContent = "";
    document.getElementById("authForm").reset();
    startSession(username);
    showToast(authMode === "signup" ? `Welcome, ${username}!` : `Welcome back, ${username}`);
});

function initAuth() {
    buildAvatarPicker();
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved && loadUsers()[saved]) {
        startSession(saved);          // stay logged in after refresh
    } else {
        render();
    }
}

/* ---------- 13b. Focus timer (different working techniques) ---------- */
const MIN = 60000;
const techniques = {
    pomodoro: { work: 25, brk: 5 },
    classic:  { work: 50, brk: 10 },
    deep:     { work: 90, brk: 20 },
    marathon: { work: 120, brk: 15 }
};
const defaultSettings = { technique: "pomodoro", work: 25, brk: 5, goal: 4 };

let settings = Object.assign({}, defaultSettings);
let sessions = [];   // focus sessions: {id, title, day, minutes, at}
let timer = null;    // {taskId, title, phase: "work" | "break" | "ready", phaseStart}

function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (error) { return fallback; }
}
function loadSettings() { return Object.assign({}, defaultSettings, readJSON("taskboard.settings." + currentUser, {})); }
function saveSettings() { if (currentUser) localStorage.setItem("taskboard.settings." + currentUser, JSON.stringify(settings)); }
function loadSessions() { return readJSON("taskboard.sessions." + currentUser, []); }
function saveSessions() { if (currentUser) localStorage.setItem("taskboard.sessions." + currentUser, JSON.stringify(sessions)); }
function saveTimer() {
    if (!currentUser) return;
    if (timer) localStorage.setItem("taskboard.timer." + currentUser, JSON.stringify(timer));
    else localStorage.removeItem("taskboard.timer." + currentUser);
}
function restoreTimer() { timer = readJSON("taskboard.timer." + currentUser, null); tick(); }

function addSession(taskId, title, minutes) {
    if (minutes < 1) return;
    sessions.push({ id: taskId, title: title, day: dayKey(new Date()), minutes: minutes, at: Date.now() });
    saveSessions();
}

function startTimer(task) {
    if (timer) stopTimer();
    timer = { taskId: task.id, title: task.title, phase: "work", phaseStart: Date.now() };
    saveTimer();
    showToast("Focus started: " + task.title);
    render();
}

function stopTimer() {
    if (!timer) return;
    if (timer.phase === "work") {
        addSession(timer.taskId, timer.title, Math.floor((Date.now() - timer.phaseStart) / MIN));
    }
    timer = null;
    saveTimer();
    render();
}

// Runs every second. Uses timestamps, so it stays correct even if the tab sleeps.
function tick() {
    if (timer) {
        const now = Date.now();
        if (timer.phase === "work" && now - timer.phaseStart >= settings.work * MIN) {
            addSession(timer.taskId, timer.title, settings.work);
            timer.phase = "break";
            timer.phaseStart += settings.work * MIN;
            saveTimer();
            render();
        }
        if (timer.phase === "break" && now - timer.phaseStart >= settings.brk * MIN) {
            timer.phase = "ready";
            saveTimer();
        }
    }
    paintTimer();
}

function clockText(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

function todayFocusMinutes() {
    const today = dayKey(new Date());
    let total = sessions.filter(function (s) { return s.day === today; })
                        .reduce(function (sum, s) { return sum + s.minutes; }, 0);
    if (timer && timer.phase === "work") total += Math.floor((Date.now() - timer.phaseStart) / MIN);
    return total;
}

function paintTimer() {
    const now = Date.now();
    const overlay = document.getElementById("breakOverlay");

    if (timer) {
        const limit = (timer.phase === "work" ? settings.work : settings.brk) * MIN;
        const left = limit - (now - timer.phaseStart);
        document.getElementById("timerClock").textContent = timer.phase === "work" ? clockText(left) : "Break";
        document.getElementById("timerTask").textContent = "Working on: " + timer.title;
        document.getElementById("breakClock").textContent = clockText(left);
    } else {
        document.getElementById("timerClock").textContent = "--:--";
        document.getElementById("timerTask").textContent = "Press ▶ Focus on a task to begin.";
    }
    document.getElementById("timerStop").hidden = !timer;

    const onBreak = !!timer && timer.phase !== "work";
    overlay.hidden = !onBreak;
    document.getElementById("breakBtns").hidden = !(timer && timer.phase === "ready");
    if (timer && timer.phase === "ready") {
        document.getElementById("breakTitle").textContent = "Break over";
        document.getElementById("breakMsg").textContent = "Nice rest. Ready for another session?";
    } else {
        document.getElementById("breakTitle").textContent = "Time for a break";
        document.getElementById("breakMsg").textContent = "Stand up, stretch, drink water and rest your eyes. Your next session unlocks when the break ends.";
    }

    // Daily goal and day plan
    const done = todayFocusMinutes();
    const goalMin = settings.goal * 60;
    const pending = tasks.filter(function (t) { return !t.done; }).length;
    const left = Math.max(0, goalMin - done);
    document.getElementById("goalText").textContent = `Today: ${(done / 60).toFixed(1)} of ${settings.goal} h focused`;
    document.getElementById("goalFill").style.width = Math.min(100, Math.round((done / goalMin) * 100)) + "%";

    let plan;
    if (left === 0) plan = "Daily goal reached. Great work! 🎉";
    else if (pending === 0) plan = "No pending tasks. Add one to plan your day.";
    else plan = `${(left / 60).toFixed(1)} h left: about ${Math.ceil(left / settings.work)} sessions of ${settings.work} min, roughly ${Math.round(left / pending)} min per pending task.`;
    document.getElementById("planText").textContent = plan;
}

document.getElementById("timerStop").addEventListener("click", stopTimer);
document.getElementById("breakContinue").addEventListener("click", function () {
    timer.phase = "work";
    timer.phaseStart = Date.now();
    saveTimer();
    paintTimer();
});
document.getElementById("breakFinish").addEventListener("click", function () { timer = null; saveTimer(); render(); });

// Settings: technique presets, custom limits and daily goal
function applySettingsToForm() {
    document.getElementById("technique").value = settings.technique;
    document.getElementById("workMin").value = settings.work;
    document.getElementById("breakMin").value = settings.brk;
    document.getElementById("goalHours").value = settings.goal;
}

function clamp(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : fallback;
}

document.getElementById("technique").addEventListener("change", function () {
    const preset = techniques[this.value];
    settings.technique = this.value;
    if (preset) { settings.work = preset.work; settings.brk = preset.brk; }
    saveSettings(); applySettingsToForm(); render();
});

function onLimitsChange() {
    settings.work = clamp(document.getElementById("workMin").value, 5, 120, settings.work);
    settings.brk = clamp(document.getElementById("breakMin").value, 1, 60, settings.brk);
    settings.goal = clamp(document.getElementById("goalHours").value, 1, 16, settings.goal);
    const match = Object.keys(techniques).find(function (k) {
        return techniques[k].work === settings.work && techniques[k].brk === settings.brk;
    });
    settings.technique = match || "custom";
    saveSettings(); applySettingsToForm(); render();
}
["workMin", "breakMin", "goalHours"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", onLimitsChange);
});

setInterval(tick, 1000);

/* ---------- 13c. Monthly summary ---------- */
function monthStats(year, month) {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    const monthTasks = log.filter(function (e) { return e.day.startsWith(prefix); });
    const monthSessions = sessions.filter(function (s) { return s.day.startsWith(prefix); });
    const perDay = {};
    monthSessions.forEach(function (s) { perDay[s.day] = (perDay[s.day] || 0) + s.minutes; });
    const active = new Set(monthTasks.map(function (e) { return e.day; }).concat(Object.keys(perDay)));
    const focus = monthSessions.reduce(function (sum, s) { return sum + s.minutes; }, 0);
    const goalDays = Object.keys(perDay).filter(function (d) { return perDay[d] >= settings.goal * 60; }).length;

    return { tasks: monthTasks.length, focus: focus, active: active.size, goalDays: goalDays,
             efficiency: focus > 0 ? monthTasks.length / (focus / 60) : 0 };
}

function changeText(now, before) {
    if (before === 0) return { text: now > 0 ? "New this month" : "No data yet", cls: "" };
    const pct = Math.round(((now - before) / before) * 100);
    if (pct === 0) return { text: "Same as last month", cls: "" };
    return { text: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs last month`, cls: pct > 0 ? "up" : "down" };
}

function renderSummary() {
    const now = new Date();
    const cur = monthStats(now.getFullYear(), now.getMonth());
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prev = monthStats(prevDate.getFullYear(), prevDate.getMonth());
    const monthName = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const prevName = prevDate.toLocaleDateString("en-IN", { month: "long" });

    document.getElementById("summaryTitle").textContent = "📈 " + monthName;

    const score = Math.sign(cur.tasks - prev.tasks) + Math.sign(cur.focus - prev.focus);
    const verdict = document.getElementById("verdict");
    if (prev.tasks === 0 && prev.focus === 0) {
        verdict.textContent = "This is your first tracked month. Keep going and next month you can compare.";
        verdict.dataset.mood = "";
    } else if (score > 0) {
        verdict.textContent = `Better than ${prevName}. You are improving. 🎉`;
        verdict.dataset.mood = "up";
    } else if (score < 0) {
        verdict.textContent = `Slower than ${prevName}. A small streak this week can fix that. 💪`;
        verdict.dataset.mood = "down";
    } else {
        verdict.textContent = `About the same as ${prevName}. Try raising your daily goal.`;
        verdict.dataset.mood = "";
    }

    const cards = [
        { label: "Tasks completed", value: cur.tasks, c: changeText(cur.tasks, prev.tasks) },
        { label: "Focus time", value: (cur.focus / 60).toFixed(1) + " h", c: changeText(cur.focus, prev.focus) },
        { label: "Active days", value: cur.active, c: changeText(cur.active, prev.active) },
        { label: "Tasks per focus hour", value: cur.efficiency.toFixed(1), c: changeText(cur.efficiency, prev.efficiency) },
        { label: "Daily goal reached", value: cur.goalDays + " days", c: changeText(cur.goalDays, prev.goalDays) }
    ];

    const box = document.getElementById("summaryCards");
    box.innerHTML = "";
    for (const card of cards) {
        const el = document.createElement("div");
        el.className = "card";
        const label = document.createElement("p");
        label.className = "card__label";
        label.textContent = card.label;
        const value = document.createElement("p");
        value.className = "card__value";
        value.textContent = card.value;
        const change = document.createElement("p");
        change.className = "card__change " + card.c.cls;
        change.textContent = card.c.text;
        el.append(label, value, change);
        box.append(el);
    }
}

/* ---------- 14. Start the app ---------- */
document.getElementById("todayDate").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long"
});

applyTheme();
showQuote();
buildStatRows();
initAuth();
