<?php

namespace Cibgraphics\Notebook\Tests\Feature;

use Cibgraphics\Notebook\Services\SettingsStore;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\TestCase;

class SettingsStoreTest extends TestCase
{
    protected string $testStoragePath;

    protected function setUp(): void
    {
        parent::setUp();

        $this->testStoragePath = base_path('storage/framework/testing/statamic-notebook/'.Str::uuid());
        File::ensureDirectoryExists($this->testStoragePath);
        File::ensureDirectoryExists($this->testStoragePath.'/framework/cache');
        File::ensureDirectoryExists($this->testStoragePath.'/framework/sessions');
        File::ensureDirectoryExists($this->testStoragePath.'/framework/views');
        $this->app->useStoragePath($this->testStoragePath);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->testStoragePath);

        parent::tearDown();
    }

    public function test_it_returns_defaults_until_settings_are_saved(): void
    {
        $settings = app(SettingsStore::class)->all();

        $this->assertSame(SettingsStore::DEFAULT_CATEGORIES, $settings['categories']);
        $this->assertSame(['New', 'Thinking', 'Ready', 'Archived'], $settings['statuses']);
        $this->assertSame('#6c97f4', $settings['status_colors']['New']);
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
