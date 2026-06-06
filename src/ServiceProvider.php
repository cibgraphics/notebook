<?php

namespace Cibgraphics\Notebook;

use Statamic\Facades\CP\Nav;
use Statamic\Facades\File;
use Statamic\Facades\Permission;
use Statamic\Providers\AddonServiceProvider;

class ServiceProvider extends AddonServiceProvider
{
    protected $vite = [
        'input' => [
            'resources/js/cp.js',
            'resources/css/cp.css',
        ],
        'publicDirectory' => 'resources/dist',
        'hotFile' => __DIR__.'/../resources/dist/hot',
    ];

    protected $config = false;

    public function bootAddon(): void
    {
        Permission::extend(function () {
            Permission::group('notebook', 'Notebook', function () {
                Permission::register('view notebook')
                    ->label('View Notebook')
                    ->description('View notes in the Notebook Control Panel addon.')
                    ->children([
                        Permission::make('manage notebook')
                            ->label('Manage Notebook')
                            ->description('Create, edit, delete, and configure Notebook notes.'),
                    ]);
            });
        });

        Nav::extend(function ($nav) {
            $nav->tools('Notebook')
                ->route('notebook.index')
                ->icon(File::get(__DIR__.'/../resources/svg/nav-icon.svg'))
                ->can('view notebook');
        });
    }
}
