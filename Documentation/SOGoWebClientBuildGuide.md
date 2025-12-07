# SOGo Web Client Build Guide

This document describes how to build the SOGo web client interface.

## Overview

The SOGo web client is an AngularJS application with Material Design components. The build process compiles SASS stylesheets, minifies JavaScript files, and prepares all assets for deployment.

## Prerequisites

Before building the web client, ensure you have the following installed:

- Node.js (latest stable version)
- npm (comes with Node.js)
- Git (for submodule initialization)

## Build Process

### 1. Clone the Repository

```bash
git clone https://github.com/Alinto/sogo.git
cd sogo
```

### 2. Initialize Git Submodules

The Angular Material SASS files are included as a git submodule:

```bash
git submodule init
git submodule update
```

### 3. Install Global Dependencies

```bash
npm install -g bower
```

### 4. Install Node.js Dependencies

Navigate to the WebServerResources directory and install npm packages:

```bash
cd UI/WebServerResources
npm install
```

### 5. Build the Web Client

Use Grunt to build the web client:

```bash
npx grunt build
```

This command will:
- Copy vendor JavaScript libraries to the js/vendor directory
- Minify and uglify JavaScript files
- Compile SASS to CSS
- Generate source maps for debugging

## Build Output

After a successful build, the following files will be generated:

- **CSS**: `css/styles.css` (compiled from SASS)
- **JavaScript modules**:
  - `js/Common.js` (common components and utilities)
  - `js/Mailer.js` (mail interface components)
  - `js/Contacts.js` (contacts interface components)
  - `js/Scheduler.js` (calendar interface components)
  - `js/Preferences.js` (preferences interface components)
  - `js/Administration.js` (administration interface components)
  - And corresponding service files for each module

## Development Workflow

For development, you can use the following Grunt tasks:

- `npx grunt dev`: Builds CSS and JavaScript without minification for easier debugging
- `npx grunt watch`: Watches for file changes and automatically rebuilds

## Troubleshooting

### Common Issues

1. **Missing Angular Material SASS files**: Ensure you've initialized and updated git submodules
2. **Permission errors with npm**: You may need to run with sudo or configure npm for local global installs
3. **Bower dependency issues**: Some older dependencies may require bower install

### Build Dependencies

The web client requires the following npm packages (automatically installed):
- AngularJS and related modules
- Angular Material
- Lodash
- QR Code generator
- File saver
- And other supporting libraries listed in package.json

## Deployment

After building, the contents of the WebServerResources directory should be deployed to your web server's appropriate location for SOGo to serve the web interface.
