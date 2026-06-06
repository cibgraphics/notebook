const { computed, createApp, h, onBeforeUnmount, reactive, ref, resolveComponent, watch } = window.Vue;
const { Head, router } = window.__STATAMIC__.inertia;
const { SortableList } = window.__STATAMIC__.core;
const { Badge, Button, Field, Header, Input, Panel, PublishContainer, Select, Stack, Textarea } =
  window.__STATAMIC__.ui;

const optionObjects = (items) => items.map((item) => ({ label: item, value: item }));

function panel(children, props = {}) {
  return h(Panel, props, () => children);
}

function field(label, input, extra = {}) {
  return h(Field, { label, ...extra }, () => input);
}

function actions(children) {
  return h("div", { class: "flex flex-wrap items-center gap-2" }, children);
}

function cleanFilters(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
}

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value));
}

function splitLines(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

const collectionPath =
  /^\/cp\/collections\/([^/]+)(?:\/entries(?:\/(?:create\/[^/]+|[^/]+(?:\/.*)?))?)?\/?$/;

function installCollectionPanel() {
  const panel = mountCollectionPanel();
  const observer = new MutationObserver(() => injectCollectionTrigger(panel));

  observer.observe(document.body, { childList: true, subtree: true });
  injectCollectionTrigger(panel);

  onCpNavigation(() => injectCollectionTrigger(panel));
}

function mountCollectionPanel() {
  const target = document.createElement("div");
  target.id = "notebook-collection-panel";
  document.body.appendChild(target);

  const api = { open: null };

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
        if (!window.confirm(`Delete "${note.title}"?`)) {
          return;
        }

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
                              h(Badge, { text: note.category, color: "default" }),
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

function injectCollectionTrigger(panel) {
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
  } catch (error) {
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

const Index = {
  props: {
    notes: { type: Array, required: true },
    categories: { type: Array, required: true },
    statuses: { type: Array, required: true },
    status_colors: { type: Object, required: true },
    collections: { type: Array, required: true },
    current_collection: { type: Object, default: null },
    can_manage: { type: Boolean, default: false },
    pagination: { type: Object, required: true },
    filters: { type: Object, required: true },
    routes: { type: Object, required: true },
  },

  setup(props) {
    const saving = ref(false);
    const editingId = ref(null);
    const showingCreateStack = ref(false);
    const showingFiltersStack = ref(false);
    const BardFieldtype = resolveComponent("bard-fieldtype");
    let searchTimeout = null;

    const categoryOptions = optionObjects(props.categories);
    const statusOptions = optionObjects(props.statuses);
    const collectionOptions = props.collections.map((collection) => ({
      label: collection.title,
      value: collection.handle,
    }));
    const selectedCollection = computed(
      () => props.current_collection?.handle || props.collections[0]?.handle || null,
    );
    const pageTitle = computed(() =>
      props.current_collection ? `${props.current_collection.title} Notebook` : "Notebook",
    );

    const form = reactive({
      title: "",
      notes: [],
      collection: selectedCollection.value,
      category: props.categories[0],
      status: props.statuses[0],
    });

    const editForm = reactive({
      title: "",
      notes: [],
      collection: selectedCollection.value,
      category: props.categories[0],
      status: props.statuses[0],
    });

    const activeFilters = reactive({
      status: props.filters.status,
      category: props.filters.category,
    });

    const searchForm = reactive({
      search: props.filters.search,
    });

    const activeFilterCount = computed(
      () => [activeFilters.status, activeFilters.category].filter(Boolean).length,
    );

    const bardConfig = {
      type: "bard",
      display: "Notes",
      buttons: ["bold", "italic", "unorderedlist", "orderedlist", "removeformat", "anchor"],
      toolbar_mode: "fixed",
      sets: [],
      save_html: true,
      fullscreen: false,
      smart_typography: true,
      enable_input_rules: true,
      enable_paste_rules: true,
      link_noopener: true,
      link_noreferrer: true,
      target_blank: true,
      remove_empty_nodes: "trim",
    };

    const bardMeta = {
      collapsed: [],
      existing: {},
      new: {},
      defaults: {},
    };

    const saveNewNote = () => {
      if (!props.can_manage) {
        return;
      }

      saving.value = true;

      router.post(
        props.routes.store,
        { ...form },
        {
          preserveScroll: true,
          onSuccess: () => {
            form.title = "";
            form.notes = [];
            form.collection = selectedCollection.value;
            form.category = props.categories[0];
            form.status = props.statuses[0];
            showingCreateStack.value = false;
          },
          onFinish: () => (saving.value = false),
        },
      );
    };

    const startEdit = (note) => {
      if (!props.can_manage) {
        return;
      }

      editingId.value = note.id;
      editForm.title = note.title;
      editForm.notes = note.notes_editor || [];
      editForm.collection = note.collection || selectedCollection.value;
      editForm.category = note.category;
      editForm.status = note.status;
    };

    const cancelEdit = () => {
      editingId.value = null;
    };

    const closeEditStack = (open) => {
      if (!open) {
        cancelEdit();
      }
    };

    const saveEdit = (note) => {
      if (!props.can_manage) {
        return;
      }

      saving.value = true;

      router.patch(
        note.update_url,
        { ...editForm },
        {
          preserveScroll: true,
          onSuccess: cancelEdit,
          onFinish: () => (saving.value = false),
        },
      );
    };

    const deleteNote = (note) => {
      if (!props.can_manage) {
        return;
      }

      if (!window.confirm(`Delete "${note.title}"?`)) {
        return;
      }

      router.delete(note.delete_url, { preserveScroll: true });
    };

    const applyFilters = () => {
      router.get(props.routes.current, cleanParams({ ...activeFilters, search: searchForm.search }), {
        preserveState: true,
        preserveScroll: true,
      });
    };

    const applySearch = () => {
      router.get(props.routes.current, cleanParams({ ...activeFilters, search: searchForm.search }), {
        preserveState: true,
        preserveScroll: true,
      });
    };

    const clearSearch = () => {
      searchForm.search = "";
      applySearch();
    };

    const clearFilters = () => {
      activeFilters.status = null;
      activeFilters.category = null;
      applyFilters();
    };

    watch(
      () => searchForm.search,
      () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applySearch, 300);
      },
    );

    const renderBardField = (target, name) =>
      h(
        PublishContainer,
        {
          name,
          blueprint: { token: null },
          modelValue: { notes: target.notes },
          meta: { notes: bardMeta },
          trackDirtyState: false,
        },
        () =>
          h(BardFieldtype, {
            handle: "notes",
            value: target.notes,
            config: bardConfig,
            meta: bardMeta,
            "onUpdate:value": (value) => (target.notes = value),
          }),
      );

    const renderForm = (target, submit, buttonText, cancel = null, note = null) =>
      h(
        "form",
        {
          class: "space-y-5",
          onSubmit: (event) => {
            event.preventDefault();
            submit();
          },
        },
        [
          field(
            "Title",
            h(Input, {
              modelValue: target.title,
              required: true,
              focus: buttonText === "Save note",
              "onUpdate:modelValue": (value) => (target.title = value),
            }),
          ),
          field("Notes", renderBardField(target, note ? `notebook-edit-note-${note.id}` : "notebook-new-note")),
          !props.current_collection && collectionOptions.length
            ? field(
                "Collection",
                h(Select, {
                  modelValue: target.collection,
                  options: collectionOptions,
                  clearable: false,
                  "onUpdate:modelValue": (value) => (target.collection = value),
                }),
              )
            : null,
          field(
            "Category",
            h(Select, {
              modelValue: target.category,
              options: categoryOptions,
              clearable: false,
              "onUpdate:modelValue": (value) => (target.category = value),
            }),
          ),
          field(
            "Status",
            h(Select, {
              modelValue: target.status,
              options: statusOptions,
              clearable: false,
              "onUpdate:modelValue": (value) => (target.status = value),
            }),
          ),
          actions([
            h(Button, {
              text: buttonText,
              variant: "primary",
              type: "submit",
              loading: saving.value,
              disabled: saving.value,
            }),
            cancel ? h(Button, { text: "Cancel", onClick: cancel }) : null,
          ]),
        ],
      );

    const renderListingControls = () => [
      h("div", { class: "mb-4 flex flex-wrap items-center gap-3" }, [
        h("div", { class: "flex-1 max-w-sm" }, [
          h(Input, {
            modelValue: searchForm.search,
            icon: "magnifying-glass",
            variant: "light",
            clearable: true,
            placeholder: "Search...",
            "onUpdate:modelValue": (value) => (searchForm.search = value),
            onKeyup: (event) => {
              if (event.key === "Escape") {
                clearSearch();
              }
            },
          }),
        ]),
        h(
          Button,
          {
            icon: "sliders-horizontal",
            class: "relative",
            onClick: () => (showingFiltersStack.value = true),
          },
          () => [
            "Filters",
            activeFilterCount.value
              ? h(Badge, {
                  text: activeFilterCount.value,
                  size: "sm",
                  pill: true,
                  class: "absolute -top-1.25 -right-2.75",
                })
              : null,
          ],
        ),
      ]),
      h(
        Stack,
        {
          size: "half",
          title: "Filters",
          icon: "sliders-horizontal",
          open: showingFiltersStack.value,
          "onUpdate:open": (value) => (showingFiltersStack.value = value),
        },
        () => [
          h("div", { class: "space-y-4" }, [
            panel(
              h("div", { class: "p-4 space-y-4" }, [
                field(
                  "Status",
                  h(Select, {
                    modelValue: activeFilters.status,
                    options: statusOptions,
                    placeholder: "All statuses",
                    clearable: true,
                    "onUpdate:modelValue": (value) => (activeFilters.status = value),
                  }),
                ),
                field(
                  "Category",
                  h(Select, {
                    modelValue: activeFilters.category,
                    options: categoryOptions,
                    placeholder: "All categories",
                    clearable: true,
                    "onUpdate:modelValue": (value) => (activeFilters.category = value),
                  }),
                ),
              ]),
            ),
            actions([
              h(Button, {
                text: "Apply Filters",
                variant: "primary",
                onClick: () => {
                  applyFilters();
                  showingFiltersStack.value = false;
                },
              }),
              h(Button, { text: "Clear Filters", variant: "ghost", onClick: clearFilters }),
            ]),
          ]),
        ],
      ),
    ];

    const renderMeta = (note) =>
      h("div", { class: "flex flex-wrap items-center gap-2" }, [
        !props.current_collection && note.collection_title
          ? h(Badge, { text: note.collection_title, color: "default" })
          : null,
        h(Badge, { text: note.category, color: "default" }),
        h(
          "span",
          {
            class: "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
            style: statusStyle(props.status_colors[note.status]),
          },
          note.status,
        ),
        h(
          "span",
          { class: "text-xs text-gray-600 dark:text-gray-400" },
          `Updated ${note.updated_at}`,
        ),
      ]);

    const renderNote = (note) => {
      return panel(
        [
          props.can_manage
            ? h(
                Stack,
                {
                  size: "narrow",
                  title: "Edit note",
                  open: editingId.value === note.id,
                  "onUpdate:open": closeEditStack,
                },
                () => renderForm(editForm, () => saveEdit(note), "Update note", cancelEdit, note),
              )
            : null,
          h("div", { class: "px-4.5 py-4 space-y-3" }, [
            h("div", { class: "flex flex-wrap items-start justify-between gap-3" }, [
              h("div", { class: "min-w-0" }, [
                h(
                  "h2",
                  { class: "text-lg font-medium text-gray-900 dark:text-gray-100 mb-1" },
                  note.title,
                ),
                note.notes
                  ? h(
                      "div",
                      {
                        class: "notebook-rich-content text-sm text-gray-700 dark:text-gray-300",
                        innerHTML: note.notes,
                      },
                    )
                  : h("p", { class: "text-sm text-gray-500 dark:text-gray-400" }, "No notes yet."),
              ]),
              props.can_manage
                ? actions([
                    h(Button, {
                      text: "Edit",
                      size: "sm",
                      icon: "edit",
                      onClick: () => startEdit(note),
                    }),
                    h(Button, {
                      text: "Delete",
                      size: "sm",
                      icon: "trash",
                      variant: "danger",
                      onClick: () => deleteNote(note),
                    }),
                  ])
                : null,
            ]),
            renderMeta(note),
          ]),
        ],
        { class: "mb-4" },
      );
    };

    const renderCollections = () => {
      if (!props.collections.length) {
        return null;
      }

      return panel(
        h("div", { class: "flex flex-wrap items-center gap-2" }, [
          h(Button, {
            text: "All notes",
            href: props.routes.index,
            variant: props.current_collection ? "default" : "pressed",
          }),
          ...props.collections.map((collection) =>
            h(Button, {
              key: collection.handle,
              text: collection.title,
              href: collection.url,
              variant:
                props.current_collection?.handle === collection.handle ? "pressed" : "default",
            }),
          ),
        ]),
        { class: "mb-4" },
      );
    };

    const renderPagination = () => {
      if (props.pagination.last_page <= 1) {
        return null;
      }

      return panel(
        h("div", { class: "px-4.5 py-3 flex flex-wrap items-center justify-between gap-3" }, [
          h(
            "p",
            { class: "text-sm text-gray-600 dark:text-gray-400" },
            `Showing ${props.pagination.from}-${props.pagination.to} of ${props.pagination.total}`,
          ),
          h("div", { class: "flex flex-wrap items-center gap-2" }, [
            h(Button, {
              text: "Previous",
              icon: "chevron-left",
              href: props.pagination.prev_url,
              disabled: !props.pagination.prev_url,
            }),
            h(
              "span",
              { class: "text-sm text-gray-600 dark:text-gray-400" },
              `Page ${props.pagination.current_page} of ${props.pagination.last_page}`,
            ),
            h(Button, {
              text: "Next",
              icon: "chevron-right",
              href: props.pagination.next_url,
              disabled: !props.pagination.next_url,
            }),
          ]),
        ]),
        { class: "mb-0" },
      );
    };

    const renderNotes = () => {
      if (!props.notes.length) {
        return [
          panel(
            h(
              "div",
              { class: "px-4.5 py-12 text-center text-sm text-gray-600 dark:text-gray-400" },
              "No notes saved yet.",
            ),
            { class: "mb-0" },
          ),
        ];
      }

      return [...props.notes.map(renderNote), renderPagination()].filter(Boolean);
    };

    return () =>
      h("div", { class: "max-w-page mx-auto" }, [
        h(Head, { title: pageTitle.value }),
        h(Header, { title: pageTitle.value }, () =>
          props.can_manage
            ? [
                h(Button, {
                  text: "Settings",
                  icon: "cog",
                  href: props.routes.settings,
                }),
                h(Button, {
                  text: "New note",
                  icon: "plus",
                  variant: "primary",
                  onClick: () => (showingCreateStack.value = true),
                }),
              ]
            : [],
        ),
        props.can_manage
          ? h(
              Stack,
              {
                size: "narrow",
                title: "New note",
                open: showingCreateStack.value,
                "onUpdate:open": (value) => (showingCreateStack.value = value),
              },
              () =>
                renderForm(
                  form,
                  saveNewNote,
                  "Save note",
                  () => (showingCreateStack.value = false),
                ),
            )
          : null,
        h("section", [renderCollections(), ...renderListingControls(), ...renderNotes()]),
      ]);
  },
};

const Settings = {
  props: {
    settings: { type: Object, required: true },
    routes: { type: Object, required: true },
  },

  setup(props) {
    const saving = ref(false);
    const UiIcon = resolveComponent("ui-icon");
    let statusId = 0;

    const form = reactive({
      categories: props.settings.categories.join("\n"),
      statuses: props.settings.status_options.map((status) => ({
        id: statusId++,
        label: status.label,
        color: status.color,
      })),
    });

    const payload = computed(() => ({
      categories: splitLines(form.categories),
      statuses: form.statuses
        .map((status) => ({
          label: status.label.trim(),
          color: status.color,
        }))
        .filter((status) => status.label),
    }));

    const dirtyKey = "notebook-settings";
    const serializedPayload = computed(() => JSON.stringify(payload.value));
    const savedPayload = ref(serializedPayload.value);
    const hasUnsavedChanges = computed(() => serializedPayload.value !== savedPayload.value);

    watch(hasUnsavedChanges, (dirty) => {
      Statamic.$dirty.state(dirtyKey, dirty);
    });

    onBeforeUnmount(() => {
      Statamic.$dirty.remove(dirtyKey);
    });

    const saveSettings = () => {
      saving.value = true;
      Statamic.$dirty.remove(dirtyKey);

      router.patch(props.routes.settings, payload.value, {
        preserveScroll: true,
        onSuccess: () => {
          savedPayload.value = serializedPayload.value;
          Statamic.$dirty.remove(dirtyKey);
        },
        onFinish: () => {
          saving.value = false;
          Statamic.$dirty.state(dirtyKey, hasUnsavedChanges.value);
        },
      });
    };

    const addStatus = () => {
      form.statuses.push({
        id: statusId++,
        label: "",
        color: "#6b7280",
      });
    };

    const removeStatus = (status) => {
      if (form.statuses.length === 1) {
        return;
      }

      form.statuses = form.statuses.filter((item) => item.id !== status.id);
    };

    const renderStatusRow = (status) =>
      h(
        "div",
        {
          key: status.id,
          class:
            "notebook-status-sortable-item flex flex-wrap items-end gap-3 rounded border border-transparent p-2 -mx-2 transition",
        },
        [
          h(UiIcon, {
            name: "handles",
            class:
              "notebook-status-sortable-handle mb-2 size-4 cursor-grab text-gray-300 active:cursor-grabbing dark:text-gray-600",
            "aria-label": "Drag status",
          }),
        field(
          "Name",
          h(Input, {
            modelValue: status.label,
            required: true,
            "onUpdate:modelValue": (value) => (status.label = value),
          }),
          { class: "mb-0 flex-1 min-w-[14rem]" },
        ),
        field(
          "Color",
          h("div", { class: "flex items-center gap-2" }, [
            h("input", {
              value: status.color,
              type: "color",
              class:
                "h-9 w-12 cursor-pointer rounded border border-gray-300 bg-transparent p-1 dark:border-gray-700",
              onInput: (event) => (status.color = event.target.value),
            }),
            h(Input, {
              modelValue: status.color,
              class: "w-28 font-mono",
              required: true,
              pattern: "^#[0-9a-fA-F]{6}$",
              "onUpdate:modelValue": (value) => (status.color = value),
            }),
          ]),
          { class: "mb-0" },
        ),
        h(Button, {
          text: "Remove",
          icon: "trash",
          variant: "danger",
          type: "button",
          disabled: form.statuses.length === 1,
          onClick: () => removeStatus(status),
        }),
        ],
      );

    return () =>
      h("div", { class: "max-w-page mx-auto" }, [
        h(Head, { title: "Notebook Settings" }),
        h(Header, { title: "Notebook Settings" }, () =>
          [
            h(Button, {
              text: "Back to notes",
              icon: "arrow-left",
              href: props.routes.index,
            }),
            h(Button, {
              text: "Save Settings",
              variant: "primary",
              loading: saving.value,
              disabled: saving.value,
              onClick: saveSettings,
            }),
          ],
        ),
        panel(
          h(
            "form",
            {
              class: "space-y-5",
              onSubmit: (event) => {
                event.preventDefault();
                saveSettings();
              },
            },
            [
              field(
                "Categories",
                h(Textarea, {
                  modelValue: form.categories,
                  rows: 7,
                  resize: "vertical",
                  required: true,
                  "onUpdate:modelValue": (value) => (form.categories = value),
                }),
              ),
              field(
                "Statuses",
                [
                  h(
                    SortableList,
                    {
                      modelValue: form.statuses,
                      itemClass: "notebook-status-sortable-item",
                      handleClass: "notebook-status-sortable-handle",
                      vertical: true,
                      "onUpdate:model-value": (value) => (form.statuses = value),
                    },
                    () => h("div", { class: "space-y-3" }, form.statuses.map(renderStatusRow)),
                  ),
                  h(Button, {
                    text: "Add status",
                    icon: "plus",
                    type: "button",
                    class: "mt-3",
                    onClick: addStatus,
                  }),
                ],
              ),
            ],
          ),
        ),
      ]);
  },
};

Statamic.booting(() => {
  if (window.__notebookCpInstalled) {
    return;
  }

  window.__notebookCpInstalled = true;

  Statamic.$inertia.register("notebook::Index", Index);
  Statamic.$inertia.register("notebook::Settings", Settings);
  installCollectionPanel();
});
