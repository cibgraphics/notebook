<?php

namespace Cibgraphics\Notebook\Tests\Feature;

use Cibgraphics\Notebook\Services\NoteStore;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class NoteStoreTest extends TestCase
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
