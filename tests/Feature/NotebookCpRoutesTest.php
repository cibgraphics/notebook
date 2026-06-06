<?php

namespace Cibgraphics\Notebook\Tests\Feature;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Statamic\Facades\User;
use Statamic\Http\Middleware\CP\Authorize;
use Tests\TestCase;

class NotebookCpRoutesTest extends TestCase
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

    public function test_guest_users_are_redirected_from_the_notebook_cp(): void
    {
        $this->get(cp_route('notebook.index'))->assertRedirect();
    }

    public function test_super_users_can_open_the_notebook_cp(): void
    {
        $user = User::make()
            ->id('super-user')
            ->email('super@example.com')
            ->password('password')
            ->makeSuper();

        $this->actingAs($user)
            ->get(cp_route('notebook.index'))
            ->assertOk();
    }

    public function test_users_without_manage_permission_cannot_create_notes(): void
    {
        $user = User::make()
            ->id('viewer-user')
            ->email('viewer@example.com')
            ->password('password');

        $this->withoutMiddleware(Authorize::class)
            ->actingAs($user)
            ->post(cp_route('notebook.store'), [
                'title' => 'Unauthorized note',
                'notes' => '',
                'collection' => 'pages',
                'category' => 'General',
                'status' => 'New',
            ])
            ->assertForbidden();
    }
}
