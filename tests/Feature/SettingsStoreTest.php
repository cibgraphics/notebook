<?php

namespace Cibgraphics\Notebook\Tests\Feature;

use Cibgraphics\Notebook\Services\SettingsStore;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class SettingsStoreTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        File::deleteDirectory(storage_path('statamic-notebook'));
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path('statamic-notebook'));

        parent::tearDown();
    }

    public function test_it_returns_defaults_until_settings_are_saved(): void
    {
        $settings = app(SettingsStore::class)->all();

        $this->assertSame(SettingsStore::DEFAULT_CATEGORIES, $settings['categories']);
        $this->assertSame(['New', 'Thinking', 'Ready', 'Archived'], $settings['statuses']);
        $this->assertSame('#2563eb', $settings['status_colors']['New']);
    }

    public function test_it_normalizes_and_persists_settings(): void
    {
        $store = app(SettingsStore::class);

        $store->update([
            'categories' => [' Ideas ', 'Ideas', '', 'Operations'],
            'statuses' => [
                ['label' => ' Draft ', 'color' => '#ABCDEF'],
                ['label' => 'Published', 'color' => 'not-a-color'],
            ],
        ]);

        $settings = $store->all();

        $this->assertFileExists(storage_path('statamic-notebook/settings.json'));
        $this->assertSame(['Ideas', 'Operations'], $settings['categories']);
        $this->assertSame(['Draft', 'Published'], $settings['statuses']);
        $this->assertSame('#abcdef', $settings['status_colors']['Draft']);
        $this->assertSame(SettingsStore::DEFAULT_STATUS_COLOR, $settings['status_colors']['Published']);
    }
}
