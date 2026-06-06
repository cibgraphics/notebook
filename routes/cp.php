<?php

use Cibgraphics\Notebook\Http\Controllers\CP\NotebookController;
use Cibgraphics\Notebook\Http\Controllers\CP\NotebookSettingsController;
use Illuminate\Support\Facades\Route;

Route::prefix('notebook')->name('notebook.')->group(function () {
    Route::get('/', [NotebookController::class, 'index'])->name('index');
    Route::post('/', [NotebookController::class, 'store'])->name('store');
    Route::get('collections/{collection}/notes', [NotebookController::class, 'collectionNotes'])->name('collections.notes');
    Route::get('collections/{collection}', [NotebookController::class, 'collection'])->name('collections.show');
    Route::post('collections/{collection}', [NotebookController::class, 'store'])->name('collections.store');
    Route::get('settings', [NotebookSettingsController::class, 'edit'])->name('settings.edit');
    Route::patch('settings', [NotebookSettingsController::class, 'update'])->name('settings.update');
    Route::patch('{id}', [NotebookController::class, 'update'])->name('update');
    Route::delete('{id}', [NotebookController::class, 'destroy'])->name('destroy');
});
