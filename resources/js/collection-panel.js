import { createApp, h, ref } from "vue";
import { Badge, Button, Stack } from "@ui";

const collectionPath =
  /^\/cp\/collections\/([^/]+)(?:\/entries(?:\/(?:create\/[^/]+|[^/]+(?:\/.*)?))?)?\/?$/;

export function installCollectionPanel() {
  const panel = mountPanel();
  const observer = new MutationObserver(() => injectTrigger(panel));

  observer.observe(document.body, { childList: true, subtree: true });
  injectTrigger(panel);

  onCpNavigation(() => injectTrigger(panel));
}

function mountPanel() {
  const target = document.createElement("div");
  target.id = "notebook-collection-panel";
  document.body.appendChild(target);

  const api = {
    open: null,
  };

  createApp({
    setup() {
      const open = ref(false);
      const loading = ref(false);
      const collection = ref(null);
      const notes = ref([]);
      const notebookUrl = ref(null);
      const statusColors = ref({});
      const pagination = ref(null);
      const currentHandle = ref(null);
      const deletingId = ref(null);
      const canManage = canManageNotebook();

      api.open = async (handle) => {
        open.value = true;
        await loadNotes(handle, 1);
      };

      const loadNotes = async (handle, page = 1) => {
        loading.value = true;
        currentHandle.value = handle;

        try {
          const url = new URL(
            cp_url(`notebook/collections/${handle}/notes`),
            window.location.origin,
          );

          url.searchParams.set("page", page);

          const data = await requestJson(url.toString());

          collection.value = data.collection;
          notes.value = data.notes;
          statusColors.value = data.status_colors;
          pagination.value = data.pagination;
          notebookUrl.value = data.routes.notebook;
        } finally {
          loading.value = false;
        }
      };

      const deleteNote = async (note) => {
        if (!confirm(`Delete "${note.title}"?`)) return;

        deletingId.value = note.id;

        try {
          await deleteRequest(note.delete_url);
          await loadNotes(
            currentHandle.value,
            notes.value.length === 1 && pagination.value?.current_page > 1
              ? pagination.value.current_page - 1
              : pagination.value?.current_page || 1,
          );
        } finally {
          deletingId.value = null;
        }
      };

      return () =>
        h(
          Stack,
          {
            size: "narrow",
            title: collection.value ? `${collection.value.title} Notes` : "Notebook",
            open: open.value,
            "onUpdate:open": (value) => (open.value = value),
          },
          () => [
            h("div", { class: "space-y-4" }, [
              h("div", { class: "flex flex-wrap items-center gap-2" }, [
                h(Button, {
                  as: "a",
                  text: "Open Notebook",
                  icon: "external-link",
                  href: notebookUrl.value,
                  variant: "primary",
                  disabled: !notebookUrl.value,
                }),
              ]),
              loading.value
                ? h("p", { class: "text-sm text-gray-600 dark:text-gray-400" }, "Loading notes...")
                : notes.value.length
                  ? notes.value.map((note) =>
                      h(
                        "div",
                        {
                          key: note.id,
                          class:
                            "border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0 last:pb-0 space-y-2",
                        },
                        [
                          h(
                            "h3",
                            { class: "font-medium text-gray-900 dark:text-gray-100" },
                            note.title,
                          ),
                          note.notes
                            ? h(
                                "div",
                                {
                                  class:
                                    "notebook-rich-content text-sm text-gray-700 dark:text-gray-300",
                                  innerHTML: note.notes,
                                },
                              )
                            : null,
                          h("div", { class: "flex flex-wrap items-center justify-between gap-2" }, [
                            h("div", { class: "flex flex-wrap items-center gap-2" }, [
                              h(Badge, { text: note.category }),
                              h(
                                "span",
                                {
                                  class:
                                    "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
                                  style: statusStyle(statusColors.value[note.status]),
                                },
                                note.status,
                              ),
                            ]),
                            canManage
                              ? h(Button, {
                                  text: "Delete",
                                  icon: "trash",
                                  size: "sm",
                                  variant: "danger",
                                  loading: deletingId.value === note.id,
                                  disabled: deletingId.value === note.id,
                                  onClick: () => deleteNote(note),
                                })
                              : null,
                          ]),
                        ],
                      ),
                    )
                  : h(
                      "p",
                      { class: "text-sm text-gray-600 dark:text-gray-400" },
                      "No notes saved for this collection yet.",
                    ),
              pagination.value && pagination.value.last_page > 1
                ? h("div", { class: "pt-2 flex flex-wrap items-center justify-between gap-2" }, [
                    h(
                      "p",
                      { class: "text-sm text-gray-600 dark:text-gray-400" },
                      `${pagination.value.from}-${pagination.value.to} of ${pagination.value.total}`,
                    ),
                    h("div", { class: "flex flex-wrap items-center gap-2" }, [
                      h(Button, {
                        text: "Previous",
                        icon: "chevron-left",
                        size: "sm",
                        disabled: !pagination.value.prev_url || loading.value,
                        onClick: () =>
                          loadNotes(currentHandle.value, pagination.value.current_page - 1),
                      }),
                      h(
                        "span",
                        { class: "text-sm text-gray-600 dark:text-gray-400" },
                        `${pagination.value.current_page} / ${pagination.value.last_page}`,
                      ),
                      h(Button, {
                        text: "Next",
                        icon: "chevron-right",
                        size: "sm",
                        disabled: !pagination.value.next_url || loading.value,
                        onClick: () =>
                          loadNotes(currentHandle.value, pagination.value.current_page + 1),
                      }),
                    ]),
                  ])
                : null,
            ]),
          ],
        );
    },
  }).mount(target);

  return api;
}

function injectTrigger(panel) {
  const handle = currentCollectionHandle();
  const header = document.querySelector("[data-ui-header]");

  if (
    !canViewNotebook() ||
    !handle ||
    !header ||
    header.querySelector("[data-notebook-trigger]")
  ) {
    return;
  }

  const actions = header.querySelector(":scope > div:last-child");

  if (!actions) {
    return;
  }

  const target = findInsertionTarget(actions);
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.notebookTrigger = "true";
  button.className = "notebook-trigger-btn";
  button.title = "Open Notebook";
  button.setAttribute("aria-label", "Open Notebook");
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 22h4M8.7 15.2a7 7 0 1 1 6.6 0c-.8.5-1.3 1.4-1.3 2.3h-4c0-.9-.5-1.8-1.3-2.3Z"/></svg>';
  button.addEventListener("click", () => panel.open(handle));

  actions.insertBefore(button, target || actions.firstChild);
}

function findInsertionTarget(actions) {
  const children = Array.from(actions.children);
  const toggleGroup = children.find((child) => {
    return child.querySelector('button[aria-label="List view"]');
  });

  if (toggleGroup) {
    return toggleGroup;
  }

  const saveGroup = children.find((child) => {
    return child.textContent.trim().includes("Save");
  });

  if (saveGroup) {
    return saveGroup;
  }

  return (
    children.find((child) => child.textContent.trim().includes("Create Entry")) ||
    children[0] ||
    null
  );
}

function currentCollectionHandle() {
  const match = window.location.pathname.match(collectionPath);

  return match ? decodeURIComponent(match[1]) : null;
}

function statamicPermissions() {
  try {
    const permissions = Statamic.$config.get("permissions");

    if (Array.isArray(permissions)) {
      return permissions;
    }

    if (typeof permissions === "string") {
      return JSON.parse(atob(permissions));
    }
  } catch {
    return [];
  }

  return [];
}

function canViewNotebook() {
  const permissions = statamicPermissions();

  return (
    permissions.includes("super") ||
    permissions.includes("view notebook") ||
    permissions.includes("manage notebook")
  );
}

function canManageNotebook() {
  const permissions = statamicPermissions();

  return permissions.includes("super") || permissions.includes("manage notebook");
}

function statusStyle(color) {
  color = /^#[0-9a-fA-F]{6}$/.test(color || "") ? color : "#6b7280";

  return {
    backgroundColor: hexToRgba(color, 0.12),
    borderColor: hexToRgba(color, 0.35),
    color,
  };
}

function hexToRgba(hex, alpha) {
  const value = hex.slice(1);
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!response.ok) {
    throw new Error(`Notebook request failed with status ${response.status}.`);
  }

  return response.json();
}

async function deleteRequest(url) {
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "X-CSRF-TOKEN": Statamic.$config.get("csrfToken"),
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!response.ok) {
    throw new Error(`Notebook delete failed with status ${response.status}.`);
  }
}

function onCpNavigation(callback) {
  const run = () => setTimeout(callback, 100);
  const wrapHistoryMethod = (method) => {
    const original = window.history[method];

    window.history[method] = function (...args) {
      const result = original.apply(this, args);
      run();

      return result;
    };
  };

  wrapHistoryMethod("pushState");
  wrapHistoryMethod("replaceState");
  window.addEventListener("popstate", run);
  window.addEventListener("inertia:navigate", run);
  document.addEventListener("statamic:navigated", run);
}
