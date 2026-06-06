<?php

namespace Cibgraphics\Notebook\Http\Controllers\CP;

use Cibgraphics\Notebook\Services\SettingsStore;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;

class NotebookSettingsController extends Controller
{
    public function __construct(private SettingsStore $settings)
    {
    }

    public function edit()
    {
        $this->authorizeManage();

        return Inertia::render('notebook::Settings', [
            'settings' => $this->settings->all(),
            'routes' => [
                'index' => cp_route('notebook.index'),
                'settings' => cp_route('notebook.settings.edit'),
            ],
        ]);
    }

    public function update(Request $request)
    {
        $this->authorizeManage();

        $validated = $request->validate([
            'categories' => ['required', 'array', 'min:1'],
            'categories.*' => ['required', 'string', 'max:100'],
            'statuses' => ['required', 'array', 'min:1'],
            'statuses.*.label' => ['required', 'string', 'max:100'],
            'statuses.*.color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);

        $this->settings->update($validated);

        return redirect()->cpRoute('notebook.settings.edit')->with('success', 'Notebook settings saved.');
    }

    protected function authorizeManage(): void
    {
        abort_unless(optional(\Statamic\Facades\User::current())->can('manage notebook'), 403);
    }
}
