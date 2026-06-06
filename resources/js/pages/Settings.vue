<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { Head, router } from "@inertiajs/vue3";
import { Button, Field, Header, Input, Panel, Textarea } from "@ui";
import { SortableList } from "@statamic/cms/index.js";

const props = defineProps({
  settings: { type: Object, required: true },
  routes: { type: Object, required: true },
});

const saving = ref(false);
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

function saveSettings() {
  if (saving.value) return;

  saving.value = true;
  Statamic.$dirty.state(dirtyKey, false);
  Statamic.$dirty.disableWarning();

  router.patch(props.routes.settings, payload.value, {
    preserveScroll: true,
    onSuccess: () => {
      savedPayload.value = serializedPayload.value;
      Statamic.$dirty.state(dirtyKey, false);
    },
    onFinish: () => {
      saving.value = false;
      Statamic.$dirty.state(dirtyKey, hasUnsavedChanges.value);
    },
  });
}

function splitLines(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function addStatus() {
  form.statuses.push({
    id: statusId++,
    label: "",
    color: "#6b7280",
  });
}

function removeStatus(status) {
  if (form.statuses.length === 1) return;

  form.statuses = form.statuses.filter((item) => item.id !== status.id);
}
</script>

<template>
  <div class="max-w-page mx-auto">
    <Head title="Notebook Settings" />

    <Header title="Notebook Settings">
      <Button text="Back to notes" icon="arrow-left" :href="routes.index" />
      <Button
        text="Save Settings"
        variant="primary"
        :loading="saving"
        :disabled="saving"
        @click="saveSettings"
      />
    </Header>

    <Panel>
      <form class="space-y-5" @submit.prevent="saveSettings">
        <Field label="Categories">
          <Textarea v-model="form.categories" rows="7" resize="vertical" required />
        </Field>

        <Field label="Statuses">
          <SortableList
            :model-value="form.statuses"
            item-class="notebook-status-sortable-item"
            handle-class="notebook-status-sortable-handle"
            vertical
            @update:model-value="form.statuses = $event"
          >
            <div class="space-y-3">
              <div
                v-for="status in form.statuses"
                :key="status.id"
                class="notebook-status-sortable-item flex flex-wrap items-end gap-3 rounded border border-transparent p-2 -mx-2 transition"
              >
                <ui-icon
                  name="handles"
                  class="notebook-status-sortable-handle mb-2 size-4 cursor-grab text-gray-300 active:cursor-grabbing dark:text-gray-600"
                  aria-label="Drag status"
                />

                <Field label="Name" class="mb-0 flex-1 min-w-[14rem]">
                  <Input v-model="status.label" required />
                </Field>

                <Field label="Color" class="mb-0">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="status.color"
                      type="color"
                      class="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-transparent p-1 dark:border-gray-700"
                    />
                    <Input v-model="status.color" class="w-28 font-mono" required pattern="^#[0-9a-fA-F]{6}$" />
                  </div>
                </Field>

                <Button
                  text="Remove"
                  icon="trash"
                  variant="danger"
                  type="button"
                  :disabled="form.statuses.length === 1"
                  @click="removeStatus(status)"
                />
              </div>
            </div>
          </SortableList>

          <Button text="Add status" icon="plus" type="button" class="mt-3" @click="addStatus" />
        </Field>

      </form>
    </Panel>
  </div>
</template>
