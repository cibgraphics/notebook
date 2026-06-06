<?php

namespace Cibgraphics\Notebook\Http\Controllers\CP;

use Cibgraphics\Notebook\Services\NoteStore;
use Cibgraphics\Notebook\Services\SettingsStore;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Statamic\Facades\Collection as CollectionFacade;
use Statamic\Facades\User;
use Statamic\Fields\Field;

class NotebookController extends Controller
{
    public function __construct(
        private NoteStore $notes,
        private SettingsStore $settings,
    )
    {
    }

    public function index(Request $request)
    {
        $this->authorizeView();

        return $this->renderIndex($request);
    }

    public function collection(Request $request, string $collection)
    {
        $this->authorizeView();
        abort_unless($this->collectionExists($collection), 404);

        return $this->renderIndex($request, $collection);
    }

    public function collectionNotes(Request $request, string $collection)
    {
        $this->authorizeView();
        abort_unless($this->collectionExists($collection), 404);

        $pagination = $this->paginate(
            collect($this->notes->all(collection: $collection))
                ->map(fn (array $note) => array_merge($note, [
                    'collection_title' => $this->collectionTitle($note['collection'] ?? null),
                    'notes_editor' => $this->preProcessNotes($note['notes'] ?? ''),
                    'delete_url' => cp_route('notebook.destroy', $note['id']),
                ]))
                ->values()
                ->all(),
            $request,
            perPage: 5,
        );

        return [
            'collection' => $this->collectionData($collection),
            'notes' => $pagination['items'],
            'pagination' => $pagination['meta'],
            'status_colors' => $this->settings->all()['status_colors'],
            'routes' => [
                'notebook' => cp_route('notebook.collections.show', $collection),
            ],
        ];
    }

    protected function renderIndex(Request $request, ?string $collection = null)
    {
        $categories = $this->settings->categories();
        $statuses = $this->settings->statuses();
        $collections = $this->collections();
        $status = $this->allowedFilter($request->query('status'), $statuses);
        $category = $this->allowedFilter($request->query('category'), $categories);
        $search = trim((string) $request->query('search', ''));
        $currentCollection = $collection ? $this->collectionData($collection) : null;
        $notes = collect($this->notes->all($status, $category, $collection))
            ->map(fn (array $note) => array_merge($note, [
                'collection_title' => $this->collectionTitle($note['collection'] ?? null),
                'notes_editor' => $this->preProcessNotes($note['notes'] ?? ''),
                'update_url' => cp_route('notebook.update', $note['id']),
                'delete_url' => cp_route('notebook.destroy', $note['id']),
            ]))
            ->when($search !== '', fn ($notes) => $notes->filter(
                fn (array $note) => $this->matchesSearch($note, $search)
            ))
            ->values()
            ->all();
        $pagination = $this->paginate($notes, $request, perPage: 10);

        return Inertia::render('notebook::Index', [
            'notes' => $pagination['items'],
            'pagination' => $pagination['meta'],
            'categories' => $categories,
            'statuses' => $statuses,
            'status_colors' => $this->settings->all()['status_colors'],
            'collections' => $collections,
            'current_collection' => $currentCollection,
            'can_manage' => $this->canManage(),
            'filters' => [
                'status' => $status,
                'category' => $category,
                'search' => $search,
            ],
            'routes' => [
                'index' => cp_route('notebook.index'),
                'current' => $collection
                    ? cp_route('notebook.collections.show', $collection)
                    : cp_route('notebook.index'),
                'store' => $collection
                    ? cp_route('notebook.collections.store', $collection)
                    : cp_route('notebook.store'),
                'settings' => cp_route('notebook.settings.edit'),
            ],
        ]);
    }

    public function store(Request $request, ?string $collection = null)
    {
        $this->authorizeManage();

        if ($collection) {
            abort_unless($this->collectionExists($collection), 404);
        }

        $this->notes->create($this->validated($request, collection: $collection));

        return redirect()->back()->with('success', 'Note saved.');
    }

    public function update(Request $request, string $id)
    {
        $this->authorizeManage();

        abort_unless($this->notes->update($id, $this->validated($request, $id)), 404);

        return redirect()->back()->with('success', 'Note updated.');
    }

    public function destroy(string $id)
    {
        $this->authorizeManage();

        $this->notes->delete($id);

        return redirect()->back()->with('success', 'Note deleted.');
    }

    protected function validated(Request $request, ?string $id = null, ?string $collection = null): array
    {
        $current = $id ? $this->notes->find($id) : null;
        $categories = $this->allowedOptions($this->settings->categories(), $current['category'] ?? null);
        $statuses = $this->allowedOptions($this->settings->statuses(), $current['status'] ?? null);
        $collections = $this->allowedOptions($this->collectionHandles(), $current['collection'] ?? null);
        $collectionRequirement = $collection || empty($collections) ? 'nullable' : 'required';
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'notes' => ['nullable'],
            'collection' => [$collectionRequirement, Rule::in($collections)],
            'category' => ['required', Rule::in($categories)],
            'status' => ['required', Rule::in($statuses)],
        ]);

        if ($collection) {
            $data['collection'] = $collection;
        }

        $data['collection'] ??= null;
        $data['notes'] = $this->processNotes($request->input('notes', []));

        return $data;
    }

    protected function collections(): array
    {
        return CollectionFacade::all()
            ->map(fn ($collection) => [
                'handle' => $collection->handle(),
                'title' => $collection->title(),
                'url' => cp_route('notebook.collections.show', $collection->handle()),
            ])
            ->values()
            ->all();
    }

    protected function collectionData(string $handle): array
    {
        return collect($this->collections())->firstWhere('handle', $handle);
    }

    protected function collectionHandles(): array
    {
        return CollectionFacade::all()->map->handle()->values()->all();
    }

    protected function collectionExists(string $handle): bool
    {
        return CollectionFacade::find($handle) !== null;
    }

    protected function collectionTitle(?string $handle): ?string
    {
        if (! $handle) {
            return null;
        }

        return CollectionFacade::find($handle)?->title() ?? $handle;
    }

    protected function allowedFilter(mixed $value, array $allowed): ?string
    {
        return is_string($value) && in_array($value, $allowed, true) ? $value : null;
    }

    protected function allowedOptions(array $options, mixed $current): array
    {
        if (is_string($current) && $current !== '' && ! in_array($current, $options, true)) {
            $options[] = $current;
        }

        return $options;
    }

    protected function matchesSearch(array $note, string $search): bool
    {
        $haystack = mb_strtolower(trim(($note['title'] ?? '').' '.strip_tags($note['notes'] ?? '')));

        return str_contains($haystack, mb_strtolower($search));
    }

    protected function sanitizeNotes(string $notes): string
    {
        $notes = preg_replace('/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/i', '', $notes) ?? '';
        $notes = strip_tags($notes, '<p><br><strong><b><em><i><u><ul><ol><li><a>');
        $notes = preg_replace('/<((?!a\b|\/a)[a-z][a-z0-9]*)\b[^>]*>/i', '<$1>', $notes) ?? '';

        return preg_replace_callback('/<a\b([^>]*)>/i', function (array $matches) {
            if (! preg_match('/\shref=(["\'])(.*?)\1/i', $matches[1], $hrefMatch)) {
                return '<a>';
            }

            $href = trim(html_entity_decode($hrefMatch[2], ENT_QUOTES | ENT_HTML5));

            if (! preg_match('/^(https?:\/\/|mailto:|\/|#)/i', $href)) {
                return '<a>';
            }

            return '<a href="'.e($href).'" target="_blank" rel="noopener noreferrer">';
        }, $notes) ?? '';
    }

    protected function processNotes(mixed $notes): string
    {
        if (is_array($notes)) {
            return $this->sanitizeNotes((string) $this->bardField($notes)->fieldtype()->process($notes));
        }

        return $this->sanitizeNotes(is_string($notes) ? $notes : '');
    }

    protected function preProcessNotes(string $notes): array
    {
        return $this->bardField($notes)->fieldtype()->preProcess($notes);
    }

    protected function bardField(mixed $value): Field
    {
        return (new Field('notes', $this->bardConfig()))->setValue($value);
    }

    protected function bardConfig(): array
    {
        return [
            'type' => 'bard',
            'display' => 'Notes',
            'buttons' => ['bold', 'italic', 'unorderedlist', 'orderedlist', 'removeformat', 'anchor'],
            'toolbar_mode' => 'fixed',
            'sets' => [],
            'save_html' => true,
            'fullscreen' => false,
            'smart_typography' => true,
            'enable_input_rules' => true,
            'enable_paste_rules' => true,
            'link_noopener' => true,
            'link_noreferrer' => true,
            'target_blank' => true,
            'remove_empty_nodes' => 'trim',
        ];
    }

    protected function paginate(array $items, Request $request, int $perPage): array
    {
        $total = count($items);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $currentPage = min(
            max((int) $request->query('page', 1), 1),
            $lastPage,
        );
        $offset = ($currentPage - 1) * $perPage;

        return [
            'items' => array_slice($items, $offset, $perPage),
            'meta' => [
                'current_page' => $currentPage,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
                'from' => $total ? $offset + 1 : 0,
                'to' => min($offset + $perPage, $total),
                'prev_url' => $currentPage > 1
                    ? $request->fullUrlWithQuery(['page' => $currentPage - 1])
                    : null,
                'next_url' => $currentPage < $lastPage
                    ? $request->fullUrlWithQuery(['page' => $currentPage + 1])
                    : null,
            ],
        ];
    }

    protected function authorizeView(): void
    {
        $user = User::current();

        abort_unless($user?->can('view notebook') || $user?->can('manage notebook'), 403);
    }

    protected function authorizeManage(): void
    {
        abort_unless($this->canManage(), 403);
    }

    protected function canManage(): bool
    {
        return optional(User::current())->can('manage notebook');
    }
}
