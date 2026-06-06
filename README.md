# Notebook

## Installation

Install the addon with Composer:

```bash
composer require cibgraphics/statamic-notebook
```

Control Panel assets are configured to publish automatically through Statamic's addon install flow.
If the assets are missing or you need to refresh them manually, run:

```bash
php artisan vendor:publish --tag=statamic-notebook --force
php artisan optimize:clear
```

## About

Notebook is a small Statamic 6 Control Panel addon for saving notes in the CP. It adds a global Notebook page and collection-specific note panels so you can keep editorial notes close to the content they belong to.

## Features

- Control Panel nav item named "Notebook"
- Global CP page for listing, filtering, creating, editing, and deleting notes
- Dynamic collection notebook pages for each Statamic collection
- Note panel button on collection list and create/edit entry screens
- Pagination on the notebook list and collection side panel
- Settings page for editing categories, statuses, and status colors
- Default categories: Article, Marketing, Website, General
- Default statuses: New, Thinking, Ready, Archived
- One JSON file per note

## Usage

Open **Tools > Notebook** in the Statamic Control Panel to create, search, filter, edit, and delete notes.

The addon also adds a notebook button to collection list and entry create/edit screens. That panel shows notes scoped to the current collection and links back to the full Notebook page.

Super users can use the addon immediately. For non-super users, grant these permissions from Statamic's role/user screens:

- View Notebook
- Manage Notebook

View-only users can open and read the notebook. Manage users can create, edit, delete, and update settings.

## Storage

Notes are stored as JSON files:

```txt
storage/statamic-notebook/notes
```

Editable addon options are stored at:

```txt
storage/statamic-notebook/settings.json
```

Each note stores:

- `id`
- `title`
- `notes`
- `collection`
- `category`
- `status`
- `created_at`
- `updated_at`

## Development

Build Control Panel assets from the addon directory:

```bash
npm install
npm run build
```

Run the local Statamic test harness from the project root:

```bash
php artisan test
```
