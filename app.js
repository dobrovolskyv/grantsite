"use strict";

const $ = (selector) => document.querySelector(selector);
const storageKeys = {
  account: "kodlox.account",
  draft: "kodlox.grantDraft",
  applications: "kodlox.applications",
};
let storageAvailable = true;
let toastTimer;

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 4500);
}

function readStorage(key, fallback) {
  let stored;
  try {
    stored = localStorage.getItem(key);
  } catch {
    storageAvailable = false;
    return fallback;
  }
  try {
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    storageAvailable = true;
    return true;
  } catch {
    storageAvailable = false;
    notify(
      "Не удалось сохранить данные в браузере. Проверьте доступ к localStorage.",
    );
    return false;
  }
}

const storedAccount = readStorage(storageKeys.account, null);
let account =
  storedAccount &&
  typeof storedAccount.login === "string" &&
  storedAccount.login.trim()
    ? storedAccount
    : null;
const storedApplications = readStorage(storageKeys.applications, []);
let applications = Array.isArray(storedApplications)
  ? storedApplications.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        item.data &&
        typeof item.data === "object",
    )
  : [];
let pendingSubmission = null;
let processing = false;
let focusBeforeDialog = null;
const grantForm = $("#grant-form");
const dialogs = document.querySelectorAll("dialog");
const scalarFields = [
  "parentName",
  "phone",
  "email",
  "birthDate",
  "studentName",
  "diagnostic",
  "school",
  "city",
];

function openDialog(id) {
  const dialog = document.getElementById(id);
  focusBeforeDialog = document.activeElement;
  dialog.showModal();
  document.body.classList.add("modal-open");
}

function closeDialog(dialog) {
  dialog.close();
}

dialogs.forEach((dialog) => {
  dialog.addEventListener("close", () => {
    if (!document.querySelector("dialog[open]"))
      document.body.classList.remove("modal-open");
    if (dialog.id === "login-dialog") {
      pendingSubmission = null;
      $("#password").value = "";
      $("#password").type = "password";
      $("#toggle-password").setAttribute("aria-pressed", "false");
      $("#toggle-password").setAttribute("aria-label", "Показать пароль");
    }
    if (
      focusBeforeDialog?.isConnected &&
      !document.querySelector("dialog[open]")
    )
      focusBeforeDialog.focus({ preventScroll: true });
  });
  dialog.addEventListener("cancel", (event) => {
    if (dialog.id === "progress-dialog") event.preventDefault();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog || dialog.id === "progress-dialog") return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      closeDialog(dialog);
  });
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () =>
    closeDialog(document.getElementById(button.dataset.close)),
  );
});

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();
}

const guestAvatar = $("#account-avatar").innerHTML;

function latestApplication() {
  return account
    ? applications.find((application) => application.login === account.login)
    : null;
}

function updateAccount() {
  $("#account-label").textContent = account ? account.login : "Войти";
  $("#account-button").setAttribute(
    "aria-label",
    account ? `Личный кабинет: ${account.login}` : "Войти в личный кабинет",
  );
  $("#account-avatar").classList.toggle("logged-in", Boolean(account));
  if (account) {
    $("#account-avatar").textContent = initials(account.login);
    $("#profile-avatar").textContent = initials(account.login);
    $("#profile-title").textContent = account.login;
  } else {
    $("#account-avatar").innerHTML = guestAvatar;
  }
  const last = latestApplication();
  $("#saved-application").hidden = !last;
  if (last)
    $("#saved-application-info").textContent =
      `${last.id} · ${last.data.studentName}`;
}

function showLogin(forSubmission = false) {
  $("#login-description").textContent = forSubmission
    ? "Войдите, чтобы отправить заявку. Все поля уже сохранены."
    : "Войдите, чтобы сохранить свой следующий шаг в IT.";
  openDialog("login-dialog");
}

$("#account-button").addEventListener("click", () => {
  if (account) openDialog("profile-dialog");
  else showLogin();
});

$("#toggle-password").addEventListener("click", () => {
  const visible = $("#password").type === "password";
  $("#password").type = visible ? "text" : "password";
  $("#toggle-password").setAttribute("aria-pressed", String(visible));
  $("#toggle-password").setAttribute(
    "aria-label",
    visible ? "Скрыть пароль" : "Показать пароль",
  );
});

$("#login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const login = $("#login").value.trim();
  if (!login) {
    $("#login").setCustomValidity(
      "Введите логин, состоящий не только из пробелов.",
    );
    $("#login").reportValidity();
    return;
  }
  account = { login, password: $("#password").value };
  writeStorage(storageKeys.account, account);
  const submission = pendingSubmission;
  closeDialog($("#login-dialog"));
  updateAccount();
  if (submission) {
    pendingSubmission = null;
    // Wait for the native dialog's close event before opening the next dialog.
    setTimeout(() => processApplication(submission), 0);
  } else notify(`Вы вошли как ${account.login}`);
});

$("#login").addEventListener("input", () => $("#login").setCustomValidity(""));
$("#logout").addEventListener("click", () => {
  try {
    localStorage.removeItem(storageKeys.account);
  } catch {
    notify("Не удалось удалить данные входа из браузера.");
    return;
  }
  account = null;
  $("#profile-title").textContent = "";
  $("#profile-avatar").textContent = "";
  closeDialog($("#profile-dialog"));
  updateAccount();
  notify("Вы вышли из аккаунта");
});

$("#profile-application").addEventListener("click", () => {
  closeDialog($("#profile-dialog"));
  location.hash = "grant";
  const last = latestApplication();
  if (last) setTimeout(() => showResult(last), 0);
});

function setMenuOpen(open) {
  $("#menu-button").setAttribute("aria-expanded", String(open));
  $("#menu-button").setAttribute(
    "aria-label",
    open ? "Закрыть меню" : "Открыть меню",
  );
  $("#mobile-nav").hidden = !open;
}

$("#menu-button").addEventListener("click", () =>
  setMenuOpen($("#menu-button").getAttribute("aria-expanded") !== "true"),
);
$("#mobile-nav").addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenuOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenuOpen(false);
});
$(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  $("#main").focus();
  $("#main").scrollIntoView({ block: "start" });
});

function route() {
  const hash = location.hash.slice(1) || "home";
  const isGrant = hash === "grant";
  $("#home-page").hidden = isGrant;
  $("#grant-page").hidden = !isGrant;
  document.title = isGrant
    ? "Заявка на грант — Кодлокс"
    : "Кодлокс — код твоего будущего";
  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === hash) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  setMenuOpen(false);
  requestAnimationFrame(() => {
    if (hash === "programs" || hash === "about")
      document
        .getElementById(hash)
        .scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  });
}
window.addEventListener("hashchange", route);

function getDraft() {
  const data = Object.fromEntries(
    scalarFields.map((name) => [name, grantForm.elements[name].value.trim()]),
  );
  data.socialCategories = [
    ...grantForm.querySelectorAll('[name="socialCategory"]:checked'),
  ].map((input) => input.value);
  return data;
}

function updateSocialSelect() {
  const categories = [
    ...grantForm.querySelectorAll('[name="socialCategory"]:checked'),
  ].map((input) => input.value);
  $("#social-value").textContent = categories.length
    ? categories.join(", ")
    : "Выберите категорию";
  $("#social-select").classList.toggle("has-value", categories.length > 0);
  $("#social-hint").textContent = "Можно выбрать несколько категорий";
  $("#social-hint").style.color = "";
}

function saveDraft() {
  if (writeStorage(storageKeys.draft, getDraft()))
    $("#draft-status").innerHTML =
      '<span class="tiny-check">✓</span> Черновик сохранён';
  else $("#draft-status").textContent = "Черновик не сохранён";
}

const draft = readStorage(storageKeys.draft, null);
if (draft && typeof draft === "object") {
  scalarFields.forEach((name) => {
    if (typeof draft[name] === "string")
      grantForm.elements[name].value = draft[name];
  });
  if (Array.isArray(draft.socialCategories)) {
    grantForm.querySelectorAll('[name="socialCategory"]').forEach((input) => {
      input.checked = draft.socialCategories.includes(input.value);
    });
  }
  $("#draft-status").innerHTML =
    '<span class="tiny-check">✓</span> Черновик восстановлен';
}

// Use the visitor's local calendar date, without shifting the maximum date by timezone.
const today = new Date();
$("#birth-date").max =
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
updateSocialSelect();

grantForm.addEventListener("input", (event) => {
  event.target.setCustomValidity?.("");
  $("#form-error").hidden = true;
  if (event.target.name === "socialCategory") {
    const noCategory = grantForm.querySelector(
      '[value="Без льготной категории"]',
    );
    if (event.target === noCategory && noCategory.checked) {
      grantForm.querySelectorAll('[name="socialCategory"]').forEach((input) => {
        if (input !== noCategory) input.checked = false;
      });
    } else if (event.target.checked) noCategory.checked = false;
    updateSocialSelect();
  }
  saveDraft();
});
grantForm.addEventListener("change", saveDraft);

document.addEventListener("click", (event) => {
  if (!$("#social-select").contains(event.target))
    $("#social-select").open = false;
});

grantForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (processing) return;
  const data = getDraft();
  for (const name of scalarFields) {
    if (!data[name]) {
      grantForm.elements[name].setCustomValidity("Заполните это поле.");
      grantForm.elements[name].reportValidity();
      return;
    }
  }
  const phoneDigits = data.phone.replace(/\D/g, "");
  if (
    phoneDigits.length < 10 ||
    phoneDigits.length > 15 ||
    !/^\+?[\d\s()\-]+$/.test(data.phone)
  ) {
    $("#phone").setCustomValidity(
      "Введите телефон: от 10 до 15 цифр, например +7 (999) 123-45-67.",
    );
    $("#phone").reportValidity();
    return;
  }
  if (!data.socialCategories.length) {
    $("#social-select").open = true;
    $("#social-select summary").focus();
    $("#social-hint").textContent = "Выберите хотя бы одну категорию";
    $("#social-hint").style.color = "#f1aaa6";
    $("#form-error").textContent =
      "Укажите льготную категорию семьи или выберите «Без льготной категории».";
    $("#form-error").hidden = false;
    return;
  }
  $("#social-select").open = false;
  saveDraft();
  if (!account) {
    pendingSubmission = data;
    showLogin(true);
  } else processApplication(data);
});

const wait = (duration) =>
  new Promise((resolve) => setTimeout(resolve, duration));

async function processApplication(data) {
  if (processing || !account) return;
  processing = true;
  const login = account.login;
  $("#submit-grant").disabled = true;
  const checkpoints = [...$("#checkpoints").children];
  checkpoints.forEach((item) => {
    item.className = "";
    item.querySelector(".checkpoint-state").textContent = "";
  });
  setProgress(0);
  openDialog("progress-dialog");
  for (let index = 0; index < checkpoints.length; index++) {
    const checkpoint = checkpoints[index];
    checkpoint.className = "active";
    checkpoint.querySelector(".checkpoint-state").textContent = "Проверяем";
    $("#progress-live").textContent =
      `Этап ${index + 1} из ${checkpoints.length}: ${checkpoint.children[1].textContent}`;
    await wait([1150, 1600, 1350, 1250, 1500, 1300, 1400][index]);
    checkpoint.className = "done";
    checkpoint.querySelector(".checkpoint-state").textContent = "Готово";
    setProgress(Math.round(((index + 1) / checkpoints.length) * 100));
  }
  await wait(500);
  const application = {
    id: createDecisionNumber(),
    login,
    data,
    createdAt: new Date().toISOString(),
  };
  applications.unshift(application);
  applications = applications.slice(0, 30);
  const saved = writeStorage(storageKeys.applications, applications);
  application.saved = saved;
  closeDialog($("#progress-dialog"));
  processing = false;
  $("#submit-grant").disabled = false;
  updateAccount();
  showResult(application);
}

function setProgress(percent) {
  $("#progress-percent").textContent = `${percent}%`;
  $("#progress-fill").style.width = `${percent}%`;
  $("#progress-bar").setAttribute("aria-valuenow", String(percent));
}

function createDecisionNumber() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return `ГР-${1000 + (random[0] % 9000)}-ФГ/${new Date().getFullYear()}`;
}

function formatBirthDate(value) {
  const parts = String(value).split("-");
  return parts.length === 3
    ? `${parts[2]}.${parts[1]}.${parts[0]}`
    : String(value);
}

function showResult(application) {
  $("#decision-number").textContent = application.id;
  const details = $("#result-details");
  details.replaceChildren();
  const data = application.data;
  const groups = [
    [
      "Законный представитель",
      [
        ["ФИО", data.parentName],
        ["Телефон", data.phone],
        ["Почта", data.email],
      ],
    ],
    [
      "Учащийся",
      [
        ["ФИО", data.studentName],
        ["Дата рождения", formatBirthDate(data.birthDate)],
        ["Школа", data.school],
        ["Населённый пункт", data.city],
      ],
    ],
    [
      "Дополнительные данные",
      [
        [
          "Категория семьи",
          Array.isArray(data.socialCategories)
            ? data.socialCategories.join(", ")
            : "—",
        ],
        ["Диагностика", data.diagnostic],
      ],
    ],
  ];
  groups.forEach(([title, rows]) => {
    const heading = document.createElement("h3");
    heading.className = "result-group-title";
    heading.textContent = title;
    details.append(heading);
    const list = document.createElement("dl");
    rows.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "result-row";
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value ?? "—";
      row.append(term, description);
      list.append(row);
    });
    details.append(list);
  });
  $(".result-note").textContent =
    application.saved === false
      ? "Демонстрационное решение · Не удалось сохранить в браузере"
      : "Демонстрационное решение · Сохранено в вашем браузере";
  openDialog("result-dialog");
}

$("#show-last-result").addEventListener("click", () => {
  const last = latestApplication();
  if (last) showResult(last);
});

window.addEventListener("beforeunload", (event) => {
  if (processing) {
    event.preventDefault();
    event.returnValue = "";
  }
});

updateAccount();
route();
if (!storageAvailable) {
  $("#draft-status").textContent = "localStorage недоступен";
  notify(
    "localStorage недоступен. Для сохранения откройте сайт через локальный сервер.",
  );
}
