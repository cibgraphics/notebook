<?php

namespace Cibgraphics\Notebook\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class NoteStore
{
    public function all(?string $status = null, ?string $category = null, ?string $collection = null): array
    {
        $notes = collect(File::glob($this->directory().'/*.json') ?: [])
            ->map(fn (string $path) => $this->readFile($path))
            ->filter()
            ->when($status, fn ($items) => $items->where('status', $status))
            ->when($category, fn ($items) => $items->where('category', $category))
            ->when($collection, fn ($items) => $items->where('collection', $collection))
            ->sortByDesc('updated_at')
            ->values();

        return $notes->all();
    }

    public function find(string $id): ?array
    {
        $path = $this->path($id);

        if (! File::exists($path)) {
            return null;
        }

        return $this->readFile($path);
    }

    public function create(array $data): array
    {
        $now = Carbon::now()->toIso8601String();

        $note = [
            'id' => (string) Str::uuid(),
            'title' => $data['title'],
            'notes' => $data['notes'] ?? '',
            'collection' => $data['collection'] ?? null,
            'category' => $data['category'],
            'status' => $data['status'],
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $this->write($note);

        return $note;
    }

    public function update(string $id, array $data): ?array
    {
        $note = $this->find($id);

        if (! $note) {
            return null;
        }

        $note = array_merge($note, [
            'title' => $data['title'],
            'notes' => $data['notes'] ?? '',
            'collection' => $data['collection'] ?? null,
            'category' => $data['category'],
            'status' => $data['status'],
            'updated_at' => Carbon::now()->toIso8601String(),
        ]);

        $this->write($note);

        return $note;
    }

    public function delete(string $id): void
    {
        File::delete($this->path($id));
    }

    protected function readFile(string $path): ?array
    {
        $data = json_decode(File::get($path), true);

        if (! is_array($data)) {
            return null;
        }

        $note = array_merge([
            'collection' => null,
            'notes' => '',
        ], $data);

        $note['notes'] = $this->normalizeNotesForRead((string) $note['notes']);

        return $note;
    }

    protected function normalizeNotesForRead(string $notes): string
    {
        if ($notes === '' || preg_match('/<[a-z][\s\S]*>/i', $notes)) {
            return $notes;
        }

        return collect(preg_split('/\R{2,}/', $notes) ?: [])
            ->map(fn (string $paragraph) => trim($paragraph))
            ->filter()
            ->map(fn (string $paragraph) => '<p>'.nl2br(e($paragraph), false).'</p>')
            ->implode('');
    }

    protected function write(array $note): void
    {
        File::ensureDirectoryExists($this->directory());
        File::put($this->path($note['id']), json_encode($note, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL);
    }

    protected function path(string $id): string
    {
        return $this->directory().'/'.$id.'.json';
    }

    protected function directory(): string
    {
        return storage_path('statamic-notebook/notes');
    }
}
