<?php

namespace Cibgraphics\Notebook\Services;

use Illuminate\Support\Facades\File;

class SettingsStore
{
    public const DEFAULT_CATEGORIES = [
        'Article',
        'Marketing',
        'Website',
        'General',
    ];

    public const DEFAULT_STATUSES = [
        ['label' => 'New', 'color' => '#2563eb'],
        ['label' => 'Thinking', 'color' => '#d97706'],
        ['label' => 'Ready', 'color' => '#16a34a'],
        ['label' => 'Archived', 'color' => '#6b7280'],
    ];

    public const DEFAULT_STATUS_COLOR = '#6b7280';

    public const LEGACY_STATUS_COLORS = [
        'default' => '#6b7280',
        'blue' => '#2563eb',
        'green' => '#16a34a',
        'red' => '#dc2626',
        'yellow' => '#ca8a04',
        'amber' => '#d97706',
        'purple' => '#9333ea',
        'pink' => '#db2777',
        'indigo' => '#4f46e5',
        'gray' => '#6b7280',
    ];

    public function all(): array
    {
        $settings = $this->read();
        $statusOptions = $this->normalizeStatuses($settings['statuses'] ?? self::DEFAULT_STATUSES);
        $statuses = collect($statusOptions)->pluck('label')->all();

        return [
            'categories' => $this->normalizeList($settings['categories'] ?? self::DEFAULT_CATEGORIES, self::DEFAULT_CATEGORIES),
            'statuses' => $statuses,
            'status_options' => $statusOptions,
            'status_colors' => $this->statusColors($statuses, $statusOptions),
        ];
    }

    public function categories(): array
    {
        return $this->all()['categories'];
    }

    public function statuses(): array
    {
        return $this->all()['statuses'];
    }

    public function update(array $settings): array
    {
        $settings = [
            'categories' => $this->normalizeList($settings['categories'] ?? [], self::DEFAULT_CATEGORIES),
            'statuses' => $this->normalizeStatuses($settings['statuses'] ?? []),
        ];

        File::ensureDirectoryExists(dirname($this->path()));
        File::put($this->path(), json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL);

        return $settings;
    }

    protected function read(): array
    {
        if (! File::exists($this->path())) {
            return [];
        }

        $settings = json_decode(File::get($this->path()), true);

        return is_array($settings) ? $settings : [];
    }

    protected function normalizeList(array $items, array $fallback): array
    {
        $items = collect($items)
            ->filter(fn ($item) => is_string($item))
            ->map(fn (string $item) => trim($item))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return $items ?: $fallback;
    }

    protected function normalizeStatuses(array $statuses): array
    {
        $statuses = collect($statuses)
            ->map(function ($status) {
                if (is_string($status)) {
                    return [
                        'label' => trim($status),
                        'color' => $this->defaultColorFor($status),
                    ];
                }

                if (! is_array($status)) {
                    return null;
                }

                $label = trim((string) ($status['label'] ?? $status['name'] ?? ''));
                $color = $this->normalizeColor((string) ($status['color'] ?? self::DEFAULT_STATUS_COLOR));

                return [
                    'label' => $label,
                    'color' => $color,
                ];
            })
            ->filter(fn ($status) => is_array($status) && $status['label'] !== '')
            ->unique('label')
            ->values()
            ->all();

        return $statuses ?: self::DEFAULT_STATUSES;
    }

    protected function statusColors(array $labels, array $statuses): array
    {
        $colors = collect($this->normalizeStatuses($statuses))
            ->mapWithKeys(fn (array $status) => [$status['label'] => $status['color']])
            ->all();

        return collect($labels)
            ->mapWithKeys(fn (string $label) => [$label => $colors[$label] ?? self::DEFAULT_STATUS_COLOR])
            ->all();
    }

    protected function defaultColorFor(string $status): string
    {
        return collect(self::DEFAULT_STATUSES)->firstWhere('label', trim($status))['color'] ?? self::DEFAULT_STATUS_COLOR;
    }

    protected function normalizeColor(string $color): string
    {
        $color = trim($color);

        if (isset(self::LEGACY_STATUS_COLORS[$color])) {
            return self::LEGACY_STATUS_COLORS[$color];
        }

        if (preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            return strtolower($color);
        }

        return self::DEFAULT_STATUS_COLOR;
    }

    protected function path(): string
    {
        return storage_path('statamic-notebook/settings.json');
    }
}
