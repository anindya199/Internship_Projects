// === Confetti (unchanged) ===
const Confetti = () => {
  const count = 200, defaults = { origin: { y: 0.7 } };
  function fire(ratio, opts) {
    confetti(Object.assign({}, defaults, opts, {
      particleCount: Math.floor(count * ratio),
    }));
  }
  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
};

document.addEventListener("DOMContentLoaded", () => {
  // === DOM ELEMENTS (defensive) ===
  const taskInput = document.getElementById("task-input");
  const addTaskBtn = document.getElementById("add-task-btn");
  const taskList = document.getElementById("task-list");
  const emptyImage = document.querySelector(".empty-image");
  const todosContainer = document.querySelector(".todos-container");
  const progressBar = document.getElementById("progress");
  const progressNumbers = document.getElementById("numbers");
  const todosList = document.getElementById("todos-list");
  const addListBtn = document.getElementById("add-list-btn");
  let errorMessage = document.getElementById("error-message");

  // Quick guards - if critical elements missing, warn and stop to avoid silent failure
  if (!taskInput || !addTaskBtn || !taskList) {
    console.error("Critical DOM nodes missing: ensure #task-input, #add-task-btn and #task-list exist.");
    return;
  }

  // Provide a fallback for optional elements so code doesn't crash
  if (!emptyImage) {
    console.warn(".empty-image not found — continuing without it.");
  }
  if (!todosContainer) {
    console.warn(".todos-container not found — continuing without width toggles.");
  }
  if (!progressBar || !progressNumbers) {
    console.warn("#progress or #numbers not found — progress UI won't update.");
  }
  if (!todosList) {
    console.warn("#todos-list not found — list sidebar won't render.");
  }
  if (!addListBtn) {
    console.warn("#add-list-btn not found — can't add lists from UI.");
  }
  if (!errorMessage) {
    // create a minimal errorMessage element so showError won't crash
    errorMessage = document.createElement("div");
    errorMessage.id = "error-message";
    // try to insert after input if possible
    const inputArea = taskInput.closest(".input-area") || taskInput.parentNode;
    inputArea.insertAdjacentElement("afterend", errorMessage);
  }

  // === STATE ===
  const STORAGE_KEY = "todoApp";
  let appData = { selectedList: "Default", lists: { Default: [] } };
  let currentEditIndex = null;
  let currentEditCompleted = false;
  let hasShownConfetti = false;
  let errorTimeout;

  // === STORAGE ===
  function saveAppData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (err) {
      console.error("Failed to save to localStorage:", err);
      showError("Could not save. localStorage unavailable.");
    }
  }

  function loadAppData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      // basic validation
      if (parsed && typeof parsed === "object" && parsed.lists) {
        appData = parsed;
      } else {
        console.warn("localStorage data malformed — resetting appData.");
      }
    } catch (err) {
      console.warn("Error parsing localStorage data, resetting. Error:", err);
      // Back up the bad value for debugging (don't overwrite it)
      try { localStorage.setItem(STORAGE_KEY + "_corrupt_backup", raw); } catch(e){}
      localStorage.removeItem(STORAGE_KEY);
      appData = { selectedList: "Default", lists: { Default: [] } };
    }
  }

  // ensure selected list exists
  function ensureListExists(name) {
    if (!appData.lists[name]) appData.lists[name] = [];
  }

  // === UI HELPERS ===
  function toggleEmptyState() {
    const hasTasks = taskList && taskList.children.length > 0;
    if (emptyImage) emptyImage.style.display = hasTasks ? "none" : "block";
    if (todosContainer) todosContainer.style.width = hasTasks ? "100%" : "50%";
  }

  function showError(msg) {
    clearTimeout(errorTimeout);
    if (!errorMessage) return;
    errorMessage.textContent = msg;
    errorMessage.classList.add("visible");
    taskInput.classList.add("error");
    errorTimeout = setTimeout(() => {
      errorMessage.classList.remove("visible");
      taskInput.classList.remove("error");
    }, 2000);
  }

  function updateEditButtonState(editBtn, isChecked) {
    if (!editBtn) return;
    editBtn.disabled = isChecked;
    editBtn.style.opacity = isChecked ? "0.5" : "1";
    editBtn.style.pointerEvents = isChecked ? "none" : "auto";
  }

  function updateProgress() {
    if (!progressBar || !progressNumbers) return;
    const totalTasks = taskList.querySelectorAll("li").length;
    const completedTasks = taskList.querySelectorAll(".checkbox:checked").length;
    const progress = totalTasks ? (completedTasks / totalTasks) * 100 : 0;
    progressBar.style.width = `${progress}%`;
    progressNumbers.textContent = `${completedTasks} / ${totalTasks}`;

    const allComplete = totalTasks > 0 && completedTasks === totalTasks;
    if (allComplete && !hasShownConfetti) {
      Confetti();
      hasShownConfetti = true;
    }
    if (!allComplete) hasShownConfetti = false;
  }

  // === SIDEBAR ===
  function renderListSidebar() {
    if (!todosList) return;
    todosList.innerHTML = "";
    Object.keys(appData.lists).forEach((listName) => {
      const li = document.createElement("li");
      li.textContent = listName;
      li.className = listName === appData.selectedList ? "active" : "";
      li.addEventListener("click", () => {
        appData.selectedList = listName;
        saveAppData();
        loadTasks();
        renderListSidebar();
      });
      todosList.appendChild(li);
    });
  }

  // === TASK ELEMENT CREATION ===
  function createTaskElement(text, completed) {
    const li = document.createElement("li");
    li.innerHTML = `
      <input type="checkbox" class="checkbox" ${completed ? "checked" : ""}>
      <span></span>
      <div class="task-buttons">
        <button class="edit-btn"><i class="fa-solid fa-pen"></i></button>
        <button class="delete-btn"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    li.querySelector("span").textContent = text;
    const checkbox = li.querySelector(".checkbox");
    const editBtn = li.querySelector(".edit-btn");
    li.classList.toggle("completed", checkbox.checked);
    updateEditButtonState(editBtn, checkbox.checked);
    return li;
  }

  // === TASK MUTATIONS (always save after change) ===
  function addTask(text = "", completed = false, insertAtIndex = null) {
    if (!text) {
      showError("Task cannot be empty!");
      return;
    }
    const currentList = appData.selectedList || "Default";
    ensureListExists(currentList);
    const taskData = { text, completed };

    if (insertAtIndex !== null && Number.isInteger(insertAtIndex)) {
      appData.lists[currentList].splice(insertAtIndex, 0, taskData);
    } else {
      appData.lists[currentList].push(taskData);
    }

    const li = createTaskElement(text, completed);
    if (insertAtIndex !== null && Number.isInteger(insertAtIndex)) {
      taskList.insertBefore(li, taskList.children[insertAtIndex] || null);
    } else {
      taskList.appendChild(li);
    }

    saveAppData();
    toggleEmptyState();
    updateProgress();
    taskInput.value = "";
    currentEditIndex = null;
  }

  function handleCheckboxClick(checkbox) {
    const li = checkbox.closest("li");
    const index = Array.from(taskList.children).indexOf(li);
    const list = appData.selectedList || "Default";
    ensureListExists(list);

    li.classList.toggle("completed", checkbox.checked);
    updateEditButtonState(li.querySelector(".edit-btn"), checkbox.checked);

    if (appData.lists[list] && appData.lists[list][index]) {
      appData.lists[list][index].completed = checkbox.checked;
      saveAppData();
    } else {
      console.warn("Checkbox change: no corresponding task in appData");
    }
    updateProgress();
  }

  function handleEditClick(editBtn) {
    const li = editBtn.closest("li");
    const index = Array.from(taskList.children).indexOf(li);
    const list = appData.selectedList || "Default";
    ensureListExists(list);
    const task = appData.lists[list][index];
    if (task && !task.completed) {
      taskInput.value = task.text;
      currentEditIndex = index;
      // remove from DOM and from data so addTask will re-insert at save
      li.remove();
      appData.lists[list].splice(index, 1);
      saveAppData();
      toggleEmptyState();
      updateProgress();
    }
  }

  function handleDeleteClick(deleteBtn) {
    const li = deleteBtn.closest("li");
    const index = Array.from(taskList.children).indexOf(li);
    const list = appData.selectedList || "Default";
    ensureListExists(list);
    if (confirm("Delete this task?")) {
      li.remove();
      if (appData.lists[list] && appData.lists[list][index]) {
        appData.lists[list].splice(index, 1);
        saveAppData();
      } else {
        console.warn("Delete: no corresponding task in appData");
      }
      toggleEmptyState();
      updateProgress();
    }
  }

  function loadTasks() {
    const listName = appData.selectedList || "Default";
    ensureListExists(listName);
    const tasks = appData.lists[listName];
    taskList.innerHTML = "";
    tasks.forEach(({ text, completed }) => {
      const li = createTaskElement(text, completed);
      taskList.appendChild(li);
    });
    toggleEmptyState();
    updateProgress();
  }

  // === EVENTS ===
  taskList.addEventListener("click", (e) => {
    if (e.target.classList.contains("checkbox")) {
      handleCheckboxClick(e.target);
    } else if (e.target.closest(".edit-btn")) {
      handleEditClick(e.target.closest(".edit-btn"));
    } else if (e.target.closest(".delete-btn")) {
      handleDeleteClick(e.target.closest(".delete-btn"));
    }
  });

  addTaskBtn.addEventListener("click", (e) => {
    e.preventDefault();
    addTask(taskInput.value.trim(), false, currentEditIndex);
  });

  taskInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask(taskInput.value.trim(), false, currentEditIndex);
    }
  });

  if (addListBtn) {
    addListBtn.addEventListener("click", () => {
      const newList = prompt("Enter new list name:");
      if (!newList) return showError("List name required!");
      if (appData.lists[newList]) return showError("List already exists!");
      appData.lists[newList] = [];
      appData.selectedList = newList;
      saveAppData();
      renderListSidebar();
      loadTasks();
    });
  }

  // === INIT ===
  loadAppData();
  renderListSidebar();
  loadTasks();
});
