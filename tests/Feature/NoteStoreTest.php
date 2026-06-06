<?php

namespace Cibgraphics\Notebook\Tests\Feature;

use Cibgraphics\Notebook\Services\NoteStore;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\TestCase;

class NoteStoreTest extends TestCase
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

    public function test_it_creates_updates_filters_and_deletes_notes(): void
    {
        $store = app(NoteStore::class);

        $note = $store->create([
            'title' => 'Launch copy',
            'notes' => 'First paragraph',
            'collection' => 'pages',
            'category' => 'Marketing',
            'status' => 'New',
        ]);

        $this->assertNotEmpty($note['id']);
        $this->assertFileExists(storage_path("statamic-notebook/notes/{$note['id']}.json"));
        $this->assertSame('Launch copy', $store->find($note['id'])['title']);
        $this->assertSame('<p>First paragraph</p>', $store->find($note['id'])['notes']);

        $updated = $store->update($note['id'], [
            'title' => 'Launch copy updated',
            'notes' => '<p>Already HTML</p>',
            'collection' => 'pages',
            'category' => 'Marketing',
            'status' => 'Ready',
        ]);

        $this->assertSame('Launch copy updated', $updated['title']);
        $this->assertSame('<p>Already HTML</p>', $updated['notes']);
        $this->assertCount(1, $store->all(status: 'Ready', category: 'Marketing', collection: 'pages'));
        $this->assertEmpty($store->all(status: 'Archived'));

        $store->delete($note['id']);

        $this->assertNull($store->find($note['id']));
    }
}
