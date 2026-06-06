<script setup>
import { computed, reactive, ref, watch } from "vue";
import { Head, router } from "@inertiajs/vue3";
import { Badge, Button, Field, Header, Input, Panel, PublishContainer, Select, Stack } from "@ui";

const props = defineProps({
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
});

const saving = ref(false);
const editingId = ref(null);
const showingCreateStack = ref(false);
const showingFiltersStack = ref(false);
let searchTimeout = null;

const categoryOptions = props.categories.map((category) => ({ label: category, value: category }));
const statusOptions = props.statuses.map((status) => ({ label: status, value: status }));
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

const activeFilterCount = computed(() =>
  [activeFilters.status, activeFilters.category].filter(Boolean).length,
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

function saveNewNote() {
  if (!props.can_manage) return;

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
}

function startEdit(note) {
  if (!props.can_manage) return;

  editingId.value = note.id;
  editForm.title = note.title;
  editForm.notes = note.notes_editor || [];
  editForm.collection = note.collection || selectedCollection.value;
  editForm.category = note.category;
  editForm.status = note.status;
}

function cancelEdit() {
  editingId.value = null;
}

function closeEditStack(open) {
  if (!open) cancelEdit();
}

function saveEdit(note) {
  if (!props.can_manage) return;

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
}

function deleteNote(note) {
  if (!props.can_manage) return;

  if (!confirm(`Delete "${note.title}"?`)) return;

  router.delete(note.delete_url, { preserveScroll: true });
}

function applyFilters() {
  router.get(props.routes.current, cleanParams({ ...activeFilters, search: searchForm.search }), {
    preserveState: true,
    preserveScroll: true,
  });
}

function applySearch() {
  router.get(props.routes.current, cleanParams({ ...activeFilters, search: searchForm.search }), {
    preserveState: true,
    preserveScroll: true,
  });
}

function clearSearch() {
  searchForm.search = "";
  applySearch();
}

function clearFilters() {
  activeFilters.status = null;
  activeFilters.category = null;
  applyFilters();
}

watch(
  () => searchForm.search,
  () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applySearch, 300);
  },
);

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value));
}

function statusStyle(status) {
  const color = props.status_colors[status] || "#6b7280";

  return {
    backgroundColor: hexToRgba(color, 0.12),
    borderColor: hexToRgba(color, 0.35),
    color,
  };
}

function hexToRgba(hex, alpha) {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#6b7280";
  const value = normalized.slice(1);
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
</script>

<template>
  <div class="max-w-page mx-auto">
    <Head :title="pageTitle" />

    <Header :title="pageTitle" v-if="can_manage">
      <Button text="Settings" icon="cog" :href="routes.settings" />
      <Button text="New note" icon="plus" variant="primary" @click="showingCreateStack = true" />
    </Header>

    <Header v-else :title="pageTitle" />

    <Stack
      v-if="can_manage"
      size="narrow"
      title="New note"
      :open="showingCreateStack"
      @update:open="showingCreateStack = $event"
    >
      <form class="space-y-5" @submit.prevent="saveNewNote">
        <Field label="Title">
          <Input v-model="form.title" required focus />
        </Field>

        <Field label="Notes">
          <PublishContainer
            name="notebook-new-note"
            :blueprint="{ token: null }"
            :model-value="{ notes: form.notes }"
            :meta="{ notes: bardMeta }"
            :track-dirty-state="false"
          >
            <component
              :is="'bard-fieldtype'"
              handle="notes"
              :value="form.notes"
              :config="bardConfig"
              :meta="bardMeta"
              @update:value="form.notes = $event"
            />
          </PublishContainer>
        </Field>

        <Field v-if="!current_collection && collections.length" label="Collection">
          <Select v-model="form.collection" :options="collectionOptions" :clearable="false" />
        </Field>

        <Field label="Category">
          <Select v-model="form.category" :options="categoryOptions" :clearable="false" />
        </Field>

        <Field label="Status">
          <Select v-model="form.status" :options="statusOptions" :clearable="false" />
        </Field>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            text="Save note"
            variant="primary"
            type="submit"
            :loading="saving"
            :disabled="saving"
          />
          <Button text="Cancel" @click="showingCreateStack = false" />
        </div>
      </form>
    </Stack>

    <section>
      <Panel v-if="collections.length" class="mb-4">
        <div class="flex flex-wrap items-center gap-2">
          <Button
            text="All notes"
            :href="routes.index"
            :variant="current_collection ? 'default' : 'pressed'"
          />
          <Button
            v-for="collection in collections"
            :key="collection.handle"
            :text="collection.title"
            :href="collection.url"
            :variant="current_collection?.handle === collection.handle ? 'pressed' : 'default'"
          />
        </div>
      </Panel>

      <div class="mb-4 flex flex-wrap items-center gap-3">
        <div class="flex-1 max-w-sm">
          <Input
            v-model="searchForm.search"
            icon="magnifying-glass"
            variant="light"
            clearable
            placeholder="Search..."
            @keyup.esc="clearSearch"
          />
        </div>

        <Button icon="sliders-horizontal" class="relative" @click="showingFiltersStack = true">
          Filters
          <Badge
            v-if="activeFilterCount"
            :text="activeFilterCount"
            size="sm"
            pill
            class="absolute -top-1.25 -right-2.75"
          />
        </Button>
      </div>

      <Stack
        size="half"
        title="Filters"
        icon="sliders-horizontal"
        :open="showingFiltersStack"
        @update:open="showingFiltersStack = $event"
      >
        <div class="space-y-4">
          <Panel>
            <div class="p-4 space-y-4">
              <Field label="Status">
                <Select
                  v-model="activeFilters.status"
                  :options="statusOptions"
                  placeholder="All statuses"
                  clearable
                />
              </Field>

              <Field label="Category">
                <Select
                  v-model="activeFilters.category"
                  :options="categoryOptions"
                  placeholder="All categories"
                  clearable
                />
              </Field>
            </div>
          </Panel>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              text="Apply Filters"
              variant="primary"
              @click="applyFilters(); showingFiltersStack = false"
            />
            <Button text="Clear Filters" variant="ghost" @click="clearFilters" />
          </div>
        </div>
      </Stack>

      <template v-if="notes.length">
        <Panel v-for="note in notes" :key="note.id" class="mb-4">
          <Stack
            v-if="can_manage"
            size="narrow"
            title="Edit note"
            :open="editingId === note.id"
            @update:open="closeEditStack"
          >
            <form class="space-y-5" @submit.prevent="saveEdit(note)">
              <Field label="Title">
                <Input v-model="editForm.title" required />
              </Field>

              <Field label="Notes">
                <PublishContainer
                  :name="`notebook-edit-note-${note.id}`"
                  :blueprint="{ token: null }"
                  :model-value="{ notes: editForm.notes }"
                  :meta="{ notes: bardMeta }"
                  :track-dirty-state="false"
                >
                  <component
                    :is="'bard-fieldtype'"
                    handle="notes"
                    :value="editForm.notes"
                    :config="bardConfig"
                    :meta="bardMeta"
                    @update:value="editForm.notes = $event"
                  />
                </PublishContainer>
              </Field>

              <Field v-if="!current_collection && collections.length" label="Collection">
                <Select
                  v-model="editForm.collection"
                  :options="collectionOptions"
                  :clearable="false"
                />
              </Field>

              <Field label="Category">
                <Select v-model="editForm.category" :options="categoryOptions" :clearable="false" />
              </Field>

              <Field label="Status">
                <Select v-model="editForm.status" :options="statusOptions" :clearable="false" />
              </Field>

              <div class="flex flex-wrap items-center gap-2">
                <Button
                  text="Update note"
                  variant="primary"
                  type="submit"
                  :loading="saving"
                  :disabled="saving"
                />
                <Button text="Cancel" @click="cancelEdit" />
              </div>
            </form>
          </Stack>

          <div class="px-4.5 py-4 space-y-3">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {{ note.title }}
                </h2>
                <div
                  v-if="note.notes"
                  class="notebook-rich-content text-sm text-gray-700 dark:text-gray-300"
                  v-html="note.notes"
                />
                <p v-else class="text-sm text-gray-500 dark:text-gray-400">No notes yet.</p>
              </div>

              <div v-if="can_manage" class="flex flex-wrap items-center gap-2">
                <Button text="Edit" size="sm" icon="edit" @click="startEdit(note)" />
                <Button
                  text="Delete"
                  size="sm"
                  icon="trash"
                  variant="danger"
                  @click="deleteNote(note)"
                />
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <Badge
                v-if="!current_collection && note.collection_title"
                :text="note.collection_title"
              />
              <Badge :text="note.category" />
              <span
                class="inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium"
                :style="statusStyle(note.status)"
              >
                {{ note.status }}
              </span>
              <span class="text-xs text-gray-600 dark:text-gray-400"
                >Updated {{ note.updated_at }}</span
              >
            </div>
          </div>
        </Panel>

        <Panel v-if="pagination.last_page > 1" class="mb-0">
          <div class="px-4.5 py-3 flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Showing {{ pagination.from }}-{{ pagination.to }} of {{ pagination.total }}
            </p>

            <div class="flex flex-wrap items-center gap-2">
              <Button
                text="Previous"
                icon="chevron-left"
                :href="pagination.prev_url"
                :disabled="!pagination.prev_url"
              />
              <span class="text-sm text-gray-600 dark:text-gray-400">
                Page {{ pagination.current_page }} of {{ pagination.last_page }}
              </span>
              <Button
                text="Next"
                icon="chevron-right"
                :href="pagination.next_url"
                :disabled="!pagination.next_url"
              />
            </div>
          </div>
        </Panel>
      </template>

      <Panel v-else class="mb-0">
        <div class="px-4.5 py-12 text-center text-sm text-gray-600 dark:text-gray-400">
          No notes saved yet.
        </div>
      </Panel>
    </section>
  </div>
</template>
