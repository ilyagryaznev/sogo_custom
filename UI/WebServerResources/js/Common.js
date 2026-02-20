/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function () {
  'use strict';

  angular.module('SOGo.Common', ['ngAnimate', 'ngMessages', 'ngSanitize', 'ngMaterial', 'mdColors'])
    .value('sgSettings', {
      isPopup: document.body.classList.contains('popup'),
      baseURL: function () {
        return ApplicationBaseURL || null;
      },
      resourcesURL: function () {
        return ResourcesURL || null;
      },
      activeUser: function (param) {
        var settings = {
          login: UserLogin || null,
          identification: UserIdentification || null,
          email: UserEmail || null,
          language: UserLanguage || null,
          folderURL: UserFolderURL || null,
          isSuperUser: IsSuperUser || null,
          path: {
            calendar: UserCalendarPath || null,
            contacts: UserContactsPath || null,
            mail: UserMailPath || null,
            preferences: UserPreferencesPath || null,
            administration: (IsSuperUser ? UserAdministrationPath : null),
            help: HelpURL || null,
            logoff: UserLogoffPath || null
          }
        };
        if (param)
          return settings[param];
        else
          return settings;
      },
      minimumSearchLength: function () {
        return angular.isNumber(minimumSearchLength) ? minimumSearchLength : 2;
      }
    })

    .constant('sgColors', {
      selection: [
        '#FFFFFF',
        '#330033',
        '#C0C0C0',
        '#999999',
        '#666666',
        '#333333',
        '#000000',
        '#FFCCCC',
        '#FF6666',
        '#FF0000',
        '#CC0000',
        '#990000',
        '#660000',
        '#330000',
        '#FFCC99',
        '#FF9966',
        '#FF9900',
        '#FF6600',
        '#CC6600',
        '#993300',
        '#663300',
        '#FFFF99',
        '#FFFF66',
        '#FFCC66',
        '#FFCC33',
        '#CC9933',
        '#996633',
        '#663333',
        '#FFFFCC',
        '#FFFF33',
        '#FFFF00',
        '#FFCC00',
        '#999900',
        '#666600',
        '#333300',
        '#CCCCCC',
        '#66FF99',
        '#33FF33',
        '#33CC00',
        '#009900',
        '#006600',
        '#003300',
        '#99FFFF',
        '#33FFFF',
        '#66CCCC',
        '#00CCCC',
        '#339999',
        '#336666',
        '#003333',
        '#CCFFFF',
        '#66FFFF',
        '#33CCFF',
        '#3366FF',
        '#3333FF',
        '#000099',
        '#000066',
        '#CCCCFF',
        '#9999FF',
        '#6666CC',
        '#6633FF',
        '#6600CC',
        '#333399',
        '#330099',
        '#FFCCFF',
        '#FF99FF',
        '#CC66CC',
        '#CC33CC',
        '#993399',
        '#663366',
        '#99FF99'
      ]
    })

    // md break-points values are hard-coded in angular-material/src/core/util/constant.js
    // $mdMedia has a built-in support for those values but can also evaluate others.
    // The following breakpoints match our CSS breakpoints in scss/core/variables.scss
    .constant('sgConstant', {
      'xs': '(max-width: 599px)',
      'gt-xs': '(min-width: 600px)',
      'sm': '(min-width: 600px) and (max-width: 959px)',
      'gt-sm': '(min-width: 960px)',
      'md': '(min-width: 960px) and (max-width: 1023px)',
      'gt-md': '(min-width: 1024px)',
      'lg': '(min-width: 1024px) and (max-width: 1279px)',
      'gt-lg': '(min-width: 1280px)',
      'xl': '(min-width: 1920px)',
      'print': 'print',
      toastPosition: 'bottom right'
    })

    .config(configure)

    .factory('AuthInterceptor', AuthInterceptor)
    .factory('ErrorInterceptor', ErrorInterceptor);

  /**
   * @ngInject
   */
  configure.$inject = ['$animateProvider', '$logProvider', '$compileProvider', '$httpProvider', '$mdThemingProvider', '$mdAriaProvider', '$qProvider'];
  function configure($animateProvider, $logProvider, $compileProvider, $httpProvider, $mdThemingProvider, $mdAriaProvider, $qProvider) {
    // Disabled animation for elements with class ng-animate-disabled
    $animateProvider.classNameFilter(/^(?:(?!ng-animate-disabled).)*$/);

    // Accent palette
    $mdThemingProvider.definePalette('sogo-green', {
      '50': 'eaf5e9',
      '100': 'cbe5c8',
      '200': 'aad6a5',
      '300': '88c781',
      '400': '66b86a',
      '500': '56b04c',
      '600': '4da143',
      '700': '388e3c',
      '800': '367d2e',
      '900': '225e1b',
      // 'A100': 'b9f6ca',
      'A100': 'fafafa', // assigned to md-hue-1, equivalent to grey-50 (default background palette)
      'A200': '69f0ae',
      'A400': '00e676',
      'A700': '00c853',
      'contrastDefaultColor': 'dark',
      // 'contrastDarkColors': ['50', '100', '200', 'A100'],
      'contrastLightColors': ['300', '400', '500', '600', '700', '800', '900']
    });
    // Primary palette
    $mdThemingProvider.definePalette('sogo-blue', {
      '50': 'f0faf9',
      '100': 'e1f5f3',
      '200': 'ceebe8',
      '300': 'bfe0dd',
      '400': 'b2d6d3',
      '500': 'a1ccc8',
      '600': '8ebfbb',
      '700': '7db3b0',
      '800': '639997',
      '900': '4d8080',
      'A100': 'd4f7fa',
      'A200': 'c3f5fa',
      'A400': '53e3f0',
      'A700': '00b0c0',
      'contrastDefaultColor': 'light',
      'contrastDarkColors': ['50', '100', '200'],
      // 'contrastLightColors': ['300', '400', '500', '600', '700', '800', '900', 'A100', 'A200', 'A400', 'A700']
    });
    // Background palette -- extends the grey palette
    var greyMap = $mdThemingProvider.extendPalette('grey', {
      '1000': 'baa870' // used as the background color of the busy periods of the attendees editor
    });
    $mdThemingProvider.definePalette('sogo-grey', greyMap);

    // Default theme definition
    $mdThemingProvider.theme('default')
      .primaryPalette('sogo-blue', {
        'default': '900',
        'hue-1': '400',
        'hue-2': '800',
        'hue-3': 'A700'
      })
      .accentPalette('sogo-green', {
        'default': '500',
        // 'hue-1': '200',
        'hue-1': 'A100', // grey-50
        'hue-2': '300',
        'hue-3': 'A700'
      })
      .backgroundPalette('sogo-grey');

    // Register custom stylesheet for toolbar of center lists
    $mdThemingProvider.registerStyles([
      'md-toolbar.md-hue-1:not(.md-menu-toolbar).md-accent,',
      'md-toolbar.md-hue-1:not(.md-menu-toolbar).md-accent md-input-container[md-no-float] .md-input {',
      '  background-color: \'{{accent-hue-1}}\';',
      '  color: \'{{foreground-1}}\';',
      '}',
      'md-toolbar.md-hue-1:not(.md-menu-toolbar).md-accent md-icon {',
      '  color: \'{{foreground-1}}\';',
      '  fill: \'{{foreground-1}}\';',
      '}',
    ].join(''));

    // Register custom stylesheet for mdAutocomplete
    $mdThemingProvider.registerStyles([
      '.md-autocomplete-suggestions.md-3-line li p {',
      '  color: \'{{foreground-2}}\';',
      '}',
    ].join(''));

    // Register custom stylesheet for sgTimepicker
    $mdThemingProvider.registerStyles([
      '.sg-time-selection-indicator.sg-time-selected,',
      '.sg-time-selection-indicator:hover.sg-time-selected,',
      '.sg-time-selection-indicator.md-focus.sg-time-selected {',
      '  background: \'{{primary-500}}\';',
      '}',
      '.sg-timepicker-open .sg-timepicker-icon {',
      '  color: \'{{primary-900}}\';',
      '}',
      '.sg-timepicker-time,',
      '.sg-timepicker-open .sg-timepicker-input-container {',
      '  background: \'{{background-hue-1}}\';',
      '}',
      '.sg-timepicker-input-mask-opaque {',
      '  box-shadow: 0 0 0 9999px \'{{background-hue-1}}\';',
      '}',
    ].join(''));

    // Register custom stylesheet for Calendar module
    $mdThemingProvider.registerStyles([
      '[ui-view=calendars] .hours {',
      '  color: \'{{primary-700}}\';',
      '}',
      '.attendees .busy {',
      '  background-color: \'{{background-1000}}\';',
      '}',
      '.attendees .event {',
      '  background-color: \'{{primary-300}}\';',
      '}'
    ].join(''));

    // Register custom stylesheet for Mail module
    $mdThemingProvider.registerStyles([
      '.sg-message-thread {',
      '  background-color: \'{{primary-100}}\';',
      '}',
      '.sg-message-thread-first {',
      '  background-color: \'{{primary-200}}\';',
      '}',
    ].join(''));

    if (!window.DebugEnabled) {
      // Disable debugging information
      $logProvider.debugEnabled(false);
      $compileProvider.debugInfoEnabled(false);
      // Disable warnings
      $mdAriaProvider.disableWarnings();
      $qProvider.errorOnUnhandledRejections(false);
      // Disable theme generation but keep definition in config (required by mdColors)
      $mdThemingProvider.generateThemesOnDemand(true);
      // Disable theming completely
      //$mdThemingProvider.disableTheming();
    }

    $httpProvider.interceptors.push('AuthInterceptor');
    $httpProvider.interceptors.push('ErrorInterceptor');
  }

  function renewTicket($window, $q, $timeout, $injector, response) {
    var deferred, iframe;

    deferred = $q.defer();
    iframe = angular.element('<iframe class="ng-hide" src="' + $window.UserFolderURL + 'recover"></iframe>');

    iframe.on('load', function () {
      var $state = $injector.get('$state');
      if (response.config.attempt > 2) {
        // Already attempted 3 times -- reload page
        angular.element($window).off('beforeunload');
        $window.location.href = $window.ApplicationBaseURL + $state.href($state.current);
        deferred.reject();
      }
      else {
        // Once the browser has followed the redirection, send the initial request
        $timeout(function () {
          var $http = $injector.get('$http');
          if (response.config.attempt)
            response.config.attempt++;
          else
            response.config.attempt = 1;
          $http(response.config).then(function (response) {
            deferred.resolve(response);
          }, function (response) {
            deferred.reject(response);
          }).finally(function () {
            $timeout(iframe.remove, 1000);
          });
        }, 2000); // Wait before replaying the request
      }
    });

    document.body.appendChild(iframe[0]);

    return deferred.promise;
  }

  /**
   * @ngInject
   */
  AuthInterceptor.$inject = ['$window', '$q', '$timeout', '$injector'];
  function AuthInterceptor($window, $q, $timeout, $injector) {
    return {
      response: function (response) {
        // When expecting JSON but receiving HTML, assume session has expired and reload page
        var $state;
        if (response && /^application\/json/.test(response.config.headers.Accept) &&
          /^[\n\r\t ]*<!DOCTYPE html/.test(response.data)) {
          if ($window.usesCASAuthentication || $window.usesSAML2Authentication) {
            return renewTicket($window, $q, $timeout, $injector, response);
          }
          else {
            $state = $injector.get('$state');
            angular.element($window).off('beforeunload');
            if ($state.href($state.current)) {
              $window.location.href = $window.ApplicationBaseURL + $state.href($state.current);
            } else {
              $window.location.href = $window.ApplicationBaseURL;
            }
            return $q.reject();
          }
        }
        return response;
      }
    };
  }

  /**
   * @ngInject
   */
  ErrorInterceptor.$inject = ['$rootScope', '$window', '$q', '$timeout', '$injector'];
  function ErrorInterceptor($rootScope, $window, $q, $timeout, $injector) {
    return {
      responseError: function (rejection) {
        var $state;
        if (/^application\/json/.test(rejection.config.headers.Accept)) {
          // Handle SSO ticket renewal
          if (($window.usesCASAuthentication || $window.usesSAML2Authentication)
            && (rejection.status == -1
              || (rejection.status == 500 && document.cookie.indexOf("cas-location") !== -1))) { // Patch for shibboleth 4.2.1 - Ticket #5615
            return renewTicket($window, $q, $timeout, $injector, rejection);
          }
          else if ($window.usesSAML2Authentication && rejection.status == 401 && !$window.recovered) {
            $state = $injector.get('$state');
            angular.element($window).off('beforeunload');
            $window.recovered = true;
            $window.location.href = $window.ApplicationBaseURL + $state.href($state.current);
          }
          else if (!rejection.data || !rejection.data.quiet) {
            // Broadcast the response error
            $rootScope.$broadcast('http:Error', rejection);
          }
        }
        return $q.reject(rejection);
      }
    };
  }

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/*
 * https://github.com/angular/material/issues/1269
 * https://gist.github.com/senthilprabhut/dd2147ebabc89bf223e7
 */

(function() {
  'use strict';

  var _$mdThemingProvider;

  angular
    .module('mdColors', ['ngMaterial'])
    .config(configure)
    .run(runBlock);

  /**
   * @ngInject
   */
  configure.$inject = ['$mdThemingProvider'];
  function configure($mdThemingProvider) {
    _$mdThemingProvider = $mdThemingProvider;
  }
  
  /**
   * @ngInject
   */
  runBlock.$inject = ['$interpolate', '$document', '$log'];
  function runBlock($interpolate, $document, $log) {

    function buildCssSelectors(selectors) {
      var result = selectors.join('');
      return result;
    }

    var fgDefault    = $interpolate(buildCssSelectors(['.md-{{theme}}-theme','.md-fg'])                              + ' { color:{{value}};}'),
        bgDefault    = $interpolate(buildCssSelectors(['.md-{{theme}}-theme','.md-bg'])                              + ' { background-color:{{value}};}'),
        bdrDefault   = $interpolate(buildCssSelectors(['.md-{{theme}}-theme','.md-bdr'])                             + ' { border-color:{{value}};}'),
        fgDefaultHue = $interpolate(buildCssSelectors(['.md-{{theme}}-theme','.md-{{hue}}','.md-fg'])                + ' { color:{{value}};}'),
        bgDefaultHue = $interpolate(buildCssSelectors(['.md-{{theme}}-theme','.md-{{hue}}','.md-bg'])                + ' { background-color:{{value}};}'),
        fgColor      = $interpolate(buildCssSelectors(['.md-{{theme}}-theme','.md-{{palette}}','.md-fg'])            + ' { color:{{value}};}'),
        bgColor      = $interpolate(buildCssSelectors(['.md-{{theme}}-theme','.md-{{palette}}','.md-bg'])            + ' { background-color:{{value}}; color:{{contrast}} !important; }'),
        bdrColor     = $interpolate(buildCssSelectors(['.md-{{theme}}-theme','.md-{{palette}}','.md-bdr'])           + ' { border-color:{{value}};}'),
        fgHue        = $interpolate(buildCssSelectors(['.md-{{theme}}-theme','.md-{{palette}}.md-{{hue}}','.md-fg']) + ' { color:{{value}};}'),
        bgHue        = $interpolate(buildCssSelectors(['.md-{{theme}}-theme','.md-{{palette}}.md-{{hue}}','.md-bg']) + ' { background-color:{{value}};}'),
        customSheet  = getStyleSheet(),
        index = 0;

    // Clear out old rules from stylesheet
    while (customSheet.cssRules.length > 0 ) {
      customSheet.deleteRule(0);
    }
    angular.forEach(_$mdThemingProvider._THEMES, function(theme, themeName){
      // Add default selectors - primary is the default palette
      addRule(fgDefault, bgDefault, themeName, 'primary',
              _$mdThemingProvider._PALETTES[theme.colors.primary.name][theme.colors.primary.hues.default]);
      addRule(fgDefaultHue, bgDefaultHue, themeName, 'primary',
              _$mdThemingProvider._PALETTES[theme.colors.primary.name][theme.colors.primary.hues['hue-2'] ], 'hue-2');
      addRule(fgDefaultHue, bgDefaultHue, themeName, 'primary',
              _$mdThemingProvider._PALETTES[theme.colors.primary.name][theme.colors.primary.hues['hue-3'] ], 'hue-3');
      addRule(fgDefaultHue, bgDefaultHue, themeName, 'primary',
              _$mdThemingProvider._PALETTES[theme.colors.primary.name][theme.colors.primary.hues['hue-1'] ], 'hue-1');
      addBorderRule(bdrDefault, themeName, 'primary',
                    _$mdThemingProvider._PALETTES[theme.colors.primary.name][theme.colors.primary.hues.default]);

      // Add selectors for palettes - accent, background, primary and warn
      angular.forEach(theme.colors, function(color, paletteName){
        addRule(fgColor, bgColor, themeName, paletteName, _$mdThemingProvider._PALETTES[color.name][color.hues.default]);
        addBorderRule(bdrColor, themeName, paletteName, _$mdThemingProvider._PALETTES[color.name][color.hues.default]);
        addRule(fgHue, bgHue, themeName, paletteName, _$mdThemingProvider._PALETTES[color.name][color.hues['hue-2'] ], 'hue-2');
        addRule(fgHue, bgHue, themeName, paletteName, _$mdThemingProvider._PALETTES[color.name][color.hues['hue-3'] ], 'hue-3');
        addRule(fgHue, bgHue, themeName, paletteName, _$mdThemingProvider._PALETTES[color.name][color.hues['hue-1'] ], 'hue-1');
      });

      //$log.debug(_.map(customSheet.cssRules, 'cssText').join("\n"));
    });

    function addRule(fgInterpolate, bgInterpolate, themeName, paletteName, colorArray, hueName){
      // Set up interpolation functions to build css rules.
      if (!colorArray) return;
      var colorValue = 'rgb(' + colorArray.value[0] + ',' + colorArray.value[1] + ',' + colorArray.value[2] + ')',
          colorContrast = 'rgb(' + colorArray.contrast[0] + ',' + colorArray.contrast[1] + ',' + colorArray.contrast[2] + ')',
          context = {
            theme: themeName,
            palette: paletteName,
            value: colorValue,
            contrast: colorContrast,
            hue: hueName
          };

      // Insert foreground color rule
      customSheet.insertRule(fgInterpolate(context), index);
      index += 1;

      // Insert background color rule
      customSheet.insertRule(bgInterpolate(context), index);
      index += 1;
    }

    function addBorderRule(bdrInterpolate, themeName, paletteName, colorArray, hueName){
      // Set up interpolation functions to build css rule for border color.
      if (!colorArray) return;
      var colorValue = 'rgb(' + colorArray.value[0] + ',' + colorArray.value[1] + ',' + colorArray.value[2] + ')';

      customSheet.insertRule(bdrInterpolate({
        theme: themeName,
        palette: paletteName,
        value: colorValue,
        hue: hueName
      }), index);
      index += 1;
    }

    function getStyleSheet() {
      // function to add a dynamic style-sheet to the document
      var style = $document[0].head.querySelector('style[title="Dynamic-Generated-by-mdColors"]');
      if (style === null) {
        style = $document[0].createElement('style');
        style.title = 'Dynamic-Generated-by-mdColors';
        // WebKit hack... (not sure if still needed)
        style.appendChild($document[0].createTextNode(''));
        $document[0].head.appendChild(style);
      }
      return style.sheet;
    }
  }

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/**
 * @type {angular.Module}
 */
 (function () {
  'use strict';

  /**
   * @ngInject
   */
  cssEscape.$inject = ['$window'];
  function cssEscape($window) {
    return $window.CSS.escape;
  }

  angular.module('SOGo.Common')
    .filter('cssEscape', cssEscape);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/**
 * @type {angular.Module}
 */
(function () {
  'use strict';

  /**
   * @ngInject
   */
  decodeUri.$inject = ['$window'];
  function decodeUri($window) {
    return $window.decodeURIComponent;
  }

  angular.module('SOGo.Common')
    .filter('decodeUri', decodeUri);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/**
 * @type {angular.Module}
 */
(function () {
  'use strict';

  /**
   * @ngInject
   */
  encodeUri.$inject = ['$window'];
  function encodeUri($window) {
    return $window.encodeURIComponent;
  }

  angular.module('SOGo.Common')
    .filter('encodeUri', encodeUri);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function () {
  'use strict';

  /**
   * ensureTarget - A filter to set a blank target to all links.
   * @memberof SOGo.Common
   * @ngInject
   * @example:

   <div ng-bind-html="part.content | ensureTarget"><!-- msg --></div>
  */
  ensureTarget.$inject = ['$sce'];
  function ensureTarget($sce) {
    return function(element) {
      var tree = angular.element('<div>' + element + '</div>');
      tree.find('a').attr('target', '_blank');
      return $sce.trustAs('html', tree.html());
    };
  }

  angular.module('SOGo.Common')
    .filter('ensureTarget', ensureTarget);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/**
 * loc - A simple filter to return the localized version of a string.
 * @memberof SOGo.Common
 */
(function () {
  'use strict';

  /**
   * @ngInject
   */
  function loc() {
    return l;
  }

  angular.module('SOGo.Common')
    .filter('loc', loc);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/**
 * range - A simple filter that will return an array of the size of its argument.
 * @memberof SOGo.Common
 */
(function () {
  'use strict';

  function range() {
    return function(n) {
      var res = [];
      for (var i = 0; i < parseInt(n); i++) {
        res.push(i);
      }
      return res;
    };
  }

  angular.module('SOGo.Common')
    .filter('range', range);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/**
 * txt2html - A filter to convert line feeds and carriage returns to html line breaks
 * @memberof SOGo.Common
 */
(function () {
  'use strict';

  /**
   * @ngInject
   */
  txt2html.$inject = ['linkyFilter'];
  function txt2html(linkyFilter) {
    return function(text) {
      // Linky will first sanitize the text; linefeeds are therefore encoded.
      return text ? String(linkyFilter(text, ' _blank', { rel: 'noopener' })).replace(/&#10;/gm, '<br>') : undefined;
    };
  }

  angular.module('SOGo.Common')
    .filter('txt2html', txt2html);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @ngInject
   */
  AclController.$inject = ['$document', '$timeout', '$mdDialog', 'Dialog', 'usersWithACL', 'User', 'folder'];
  function AclController($document, $timeout, $mdDialog, Dialog, usersWithACL, User, folder) {
    var vm = this;

    vm.users = usersWithACL; // ACL users
    vm.folder = folder;
    vm.selectedUser = null;
    vm.selectedUid = null;
    vm.userToAdd = '';
    vm.searchText = '';
    vm.folderClassName = folderClassName;
    vm.templateName = templateName;
    vm.userFilter = userFilter;
    vm.closeModal = closeModal;
    vm.saveModal = saveModal;
    vm.confirmChange = confirmChange;
    vm.removeUser = removeUser;
    vm.addUser = addUser;
    vm.toggleAllRights = toggleAllRights;
    vm.selectUser = selectUser;
    vm.hasNoRight = hasNoRight;
    vm.showRights = showRights;
    vm.confirmation = { showing: false,
                        message: ''};

    function folderClassName() {
      if (angular.isFunction(folder.getClassName))
        return folder.getClassName('bg');
      else
        return false;
    }

    function templateName(user) {
      // Check if user is anonymous and if a specific template must be used
      var isAnonymous = $document[0].getElementById('UIxAnonymousUserRightsEditor') && user.$isAnonymous();
      return 'UIx' + (isAnonymous? 'Anonymous' : '') + 'UserRightsEditor';
    }

    function userFilter($query) {
      return User.$filter($query, folder.$acl.users, { dry: true });
    }

    function closeModal() {
      folder.$acl.$resetUsersRights(); // cancel changes
      $mdDialog.hide();
    }

    function saveModal() {
      folder.$acl.$saveUsersRights().then(function() {
        $mdDialog.hide();
      }, function(data, status) {
        Dialog.alert(l('Warning'), l('An error occured, please try again.'));
      });
    }

    function confirmChange(user) {
      var confirmation = user.$confirmRights(vm.folder);
      if (confirmation) {
        vm.confirmation.showing = true;
        vm.confirmation.message = confirmation;
      }
    }

    function removeUser(user) {
      $timeout(function() {
        folder.$acl.$removeUser(user.uid);
      }, 500); // wait for CSS transition to complete (see card.scss)
    }

    function addUser(data) {
      if (data) {
        folder.$acl.$addUser(data).then(function(user) {
          vm.userToAdd = '';
          vm.searchText = '';
          vm.selectedUid = null;
          if (user)
            selectUser(user);
        });
      }
    }

    function toggleAllRights(user) {
      folder.$acl.$toggleAllRights(user);
    }

    function selectUser(user, $event) {
      if ($event && $event.target.parentNode.classList.contains('md-secondary'))
        return false;
      if (vm.selectedUid == user.uid) {
        vm.selectedUid = null;
      }
      else {
        vm.selectedUid = user.uid;
        vm.selectedUser = user;
        if (!user.inactive)
          vm.selectedUser.$rights();
      }
    }

    function hasNoRight(user) {
      return folder.$acl.$hasNoRight(user);
    }

    function showRights(user) {
      return vm.selectedUid == user.uid && !user.inactive;
    }
  }

  angular
    .module('SOGo.Common')
    .controller('AclController', AclController);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /**
   * @ngInject
   */
  navController.$inject =  ['$rootScope', '$scope', '$timeout', '$interval', '$http', '$window', '$mdSidenav', '$mdToast', '$mdMedia', '$log', 'sgConstant', 'sgSettings', 'Resource', 'Preferences'];
  function navController($rootScope, $scope, $timeout, $interval, $http, $window, $mdSidenav, $mdToast, $mdMedia, $log, sgConstant, sgSettings, Resource, Preferences) {
    var resource = new Resource(sgSettings.baseURL(), sgSettings.activeUser());

    this.$onInit = function() {
      $scope.isPopup = sgSettings.isPopup;
      $scope.activeUser = sgSettings.activeUser();
      $scope.baseURL = sgSettings.baseURL();
      $scope.leftIsClose = !$mdMedia(sgConstant['gt-md']);
      // Don't hide the center list when on a small device
      $scope.centerIsClose = !!$window.centerIsClose && !$scope.leftIsClose;

      // Show current day in top bar
      $scope.currentDay = window.currentDay;
      $timeout(function() {
        // Update date when day ends
        $interval(function() {
          $http.get('../date').then(function(data) {
            $scope.currentDay = data;
          });
        }, 24 * 3600 * 1000);
      }, window.currentDay.secondsBeforeTomorrow * 1000);

      // Track the 600px window width threashold
      $scope.$watch(function() {
        return $mdMedia(sgConstant['gt-xs']);
      }, function(newVal) {
        $scope.isGtExtraSmall = newVal;
      });

      // Track the 1024px window width threashold
      $scope.$watch(function() {
        return $mdMedia(sgConstant['gt-md']);
      }, function(newVal) {
        $scope.isGtMedium = newVal;
        if (newVal) {
          $scope.leftIsClose = false;
        }
      });

      // Listen to HTTP errors broadcasted from HTTP interceptor
      $rootScope.$on('http:Error', onHttpError);

      if (!$scope.isPopup) {
        if (sgSettings.activeUser('path').calendar) {
          // Fetch Calendar alarms
          Preferences.getAlarms();
        }

        if (sgSettings.activeUser('path').mail) {
          // Poll inbox for new messages
          Preferences.pollInbox();
        }
      }
    };

    $scope.toggleLeft = function() {
      if ($scope.isGtMedium) {
        // Left sidenav is toggled while sidenav is locked open; bypass $mdSidenav
        $scope.leftIsClose = !$scope.leftIsClose;
      }
      else {
        $scope.leftIsClose = leftIsClose();
        // Fire a window resize when opening the sidenav on a small device.
        // This is a fix until the following issue is officially resolved:
        // https://github.com/angular/material/issues/7309
        if ($scope.leftIsClose)
          angular.element($window).triggerHandler('resize');
        $mdSidenav('left').toggle()
          .then(function () {
            $log.debug("toggle left is done");
          });
      }
    };
    $scope.toggleRight = function() {
      $mdSidenav('right').toggle()
        .then(function () {
          $log.debug("toggle right is done");
        });
    };
    $scope.toggleCenter = function(options) {
      $scope.centerIsClose = !$scope.centerIsClose;
      if (options && options.save)
        resource.post(null, 'saveListState', { state: $scope.centerIsClose? 'collapse' : 'rise' });
    };
    // $scope.openBottomSheet = function() {
    //   $mdBottomSheet.show({
    //     parent: angular.element(document.getElementById('left-sidenav')),
    //     templateUrl: 'bottomSheetTemplate.html'
    //   });
    // };
    // $scope.toggleDetailView = function() {
    //   var detail = angular.element(document.getElementById('detailView'));
    //   detail.toggleClass('sg-close');
    // };

    function leftIsClose() {
      return !$mdSidenav('left').isOpen();
    }

    function onHttpError(event, response) {
      var message;
      if (response.data && response.data.message && angular.isString(response.data.message))
        message = response.data.message;
      else if (response.status)
        message = response.statusText;

      if (message)
        $mdToast.show({
          template: [
            '<md-toast>',
            '  <div class="md-toast-content">',
            '    <md-icon class="md-warn md-hue-1">error_outline</md-icon>',
            '    <span flex>' + l(message) + '</span>',
            '  </div>',
            '</md-toast>'
          ].join(''),
          hideDelay: 5000,
          position: sgConstant.toastPosition
        });
      else
        $log.debug('untrap error');
    }
  }

  angular.module('SOGo.Common')
    .controller('navController', navController);
})();
(function() {
  'use strict';

  /**
   * @name Acl
   * @constructor
   * @param {String} folderId - the folder ID associated to the ACLs
   */
  function Acl(folderId) {
    this.folderId = folderId;
  }

  /**
   * @memberof Acl
   * @desc The factory we'll use to register with Angular.
   * @return the Acl constructor
   */
  Acl.factory = ['$q', '$timeout', 'sgSettings', 'Resource', 'User', function($q, $timeout, Settings, Resource, User) {
    angular.extend(Acl, {
      $q: $q,
      $timeout: $timeout,
      $$resource: new Resource(Settings.activeUser('folderURL'), Settings.activeUser()),
      $User: User
    });

    return Acl;
  }];

  /**
   * @module SOGo.Common
   * @desc Factory registration of User in Angular module.
   */
  angular.module('SOGo.Common').factory('Acl', Acl.factory);

  /**
   * @function $users
   * @memberof Acl.prototype
   * @param {Object} owner - the owner to use when fetching the ACL as it might not be the Settings.activeUser
   * @desc Fetch the list of users that have specific rights for the current folder.
   * @return a promise of an array of User objects
   */
  Acl.prototype.$users = function(owner) {
    var _this = this,
        deferred = Acl.$q.defer(),
        user;
    if (this.users) {
      deferred.resolve(this.users);
    }
    else {
      var acls;
      if (angular.isDefined(owner))
        acls = Acl.$$resource.userResource(owner).fetch(this.folderId, 'acls');
      else
        acls = Acl.$$resource.fetch(this.folderId, 'acls');

      return acls.then(function(response) {
        _this.users = [];
        //console.debug(JSON.stringify(users, undefined, 2));
        angular.forEach(response.users, function(data) {
          user = new Acl.$User(data);
          user.canSubscribeUser = user.isSubscribed;
          user.wasSubscribed = user.isSubscribed;
          user.$rights = angular.bind(user, user.$acl, _this.folderId, owner);
          _this.users.push(user);
        });
        deferred.resolve(_this.users);
        return _this.users;
      }, function(response) {
        deferred.reject(l(response.statusText));
        throw Error('No access to object');
      });
    }
    return deferred.promise;
  };

  /**
   * @function $addUser
   * @memberof Acl.prototype
   * @param {Object} user - a User object with minimal set of attributes (uid, isGroup, cn, c_email)
   * @param {Object} owner - the owner to use when fetching the ACL as it might not be the Settings.activeUser
   * @see {@link User.$filter}
   */
  Acl.prototype.$addUser = function(user, owner) {
    var _this = this,
        deferred = Acl.$q.defer(),
        param = {uid: user.uid};
    if (!user.uid || _.indexOf(_.map(this.users, 'uid'), user.uid) > -1) {
      // No UID specified or user already in ACLs
      deferred.resolve();
    }
    else {
      var acls;

      if (angular.isDefined(owner))
        acls = Acl.$$resource.userResource(owner).fetch(this.folderId, 'addUserInAcls', param);
      else
        acls = Acl.$$resource.fetch(this.folderId, 'addUserInAcls', param);

      acls.then(function() {
        user.wasSubscribed = false;
        user.userClass = user.isGroup ? 'normal-group' : 'normal-user';
        user.$rights = angular.bind(user, user.$acl, _this.folderId, owner);
        _this.users.push(user);
        deferred.resolve(user);
      }, function(data, status) {
        deferred.reject(l('An error occured, please try again.'));
      });
    }
    return deferred.promise;
  };

  /**
   * @function $removeUser
   * @memberof Acl.prototype
   * @desc Remove a user from the folder's ACL
   * @return a promise of the server call to remove the user from the folder's ACL
   */
  Acl.prototype.$removeUser = function(uid, owner) {
    var _this = this,
        param = {uid: uid},
        acls;

    if (angular.isDefined(owner))
      acls = Acl.$$resource.userResource(owner).fetch(this.folderId, 'removeUserFromAcls', param);
    else
      acls = Acl.$$resource.fetch(this.folderId, 'removeUserFromAcls', param);

    return acls.then(function() {
      var i = _.indexOf(_.map(_this.users, 'uid'), uid);
      if (i >= 0) {
        _this.users[i].$shadowRights = null;
        _this.users.splice(i, 1);
      }
    });
  };

  /**
   * @function $selectAllRights
   * @memberof Acl.prototype
   * @desc Select all rights of an user
   */
  Acl.prototype.$toggleAllRights = function(user) {
    var unselected = !angular.isUndefined(_.find(_.values(user.rights), function (right) {
      return (right !== 1) && (right !== "Modifier");
    }));
    _.forEach(user.rights, function(value, right) {
      if (angular.isNumber(user.rights[right]))
        user.rights[right] = unselected ? 1 : 0;
      else
        user.rights[right] = unselected ? "Modifier" : "None";
    });
  };

  /**
   * @function $hasNoRight
   * @memberof Acl.prototype
   * @desc Check if user has any rights on the resource
   * @return true if user has no right at all
   */
  Acl.prototype.$hasNoRight = function(user) {
    var o = _.find(user.rights, function(value, right) {
      if (angular.isNumber(value))
        return (value === 1);
      else
        return (value !== 'None');
    });
    return _.isUndefined(o);
  };

  /**
   * @function $resetUsersRights
   * @memberof Acl.prototype
   * @desc Restore initial rights of all users.
   */
  Acl.prototype.$resetUsersRights = function() {
    angular.forEach(this.users, function(user) {
      user.$resetRights();
    });
  };

  /**
   * @function $saveUsersRights
   * @memberof Acl.prototype
   * @desc Save user rights that have changed and subscribe users that have been selected.
   * @param {Object} owner - the owner to use when fetching the ACL as it might not be the Settings.activeUser
   * @return a promise that resolved only if the modifications and subscriptions were successful
   */
  Acl.prototype.$saveUsersRights = function(owner) {
    var _this = this,
        deferredSave = Acl.$q.defer(),
        deferredSubscribe = Acl.$q.defer(),
        param = {action: 'saveUserRights'},
        users = [];

    // Save user rights
    angular.forEach(this.users, function(user) {
      if (user.$rightsAreDirty()) {
        users.push(user.$omit());
        // console.debug('save ' + JSON.stringify(user.$omit(), undefined, 2));
      }
    });
    if (users.length) {
      var acls;

      if (angular.isDefined(owner))
        acls = Acl.$$resource.userResource(owner).save(this.folderId, users, param);
      else
        acls = Acl.$$resource.save(this.folderId, users, param);

      acls.then(function() {
          // Save was successful; copy rights to shadow rights
          angular.forEach(_this.users, function(user) {
            if (user.$rightsAreDirty()) {
              user.$shadowRights = angular.copy(user.rights);
            }
          });
          deferredSave.resolve();
        }, deferredSave.reject);
    }
    else {
      deferredSave.resolve();
    }

    // Subscribe users
    users = [];
    angular.forEach(this.users, function(user) {
      if (!user.wasSubscribed && user.isSubscribed) {
        users.push(user.uid);
        // console.debug('subscribe ' + user.uid);
      }
    });
    if (users.length) {
      param = {uids: users.join(',')};
      Acl.$$resource.fetch(this.folderId, 'subscribeUsers', param)
        .then(function() {
          // Subscribe was successful; reset "wasSubscribed" attribute
          angular.forEach(_this.users, function(user) {
            user.wasSubscribed = user.isSubscribed;
          });
          deferredSubscribe.resolve();
        }, deferredSubscribe.reject);
    }
    else {
      deferredSubscribe.resolve();
    }
    return Acl.$q.all([deferredSave.promise, deferredSubscribe.promise]);
  };

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* JavaScript for Authentication */

(function() {
  /* jshint validthis: true */
  'use strict';

  angular.module('SOGo.Authentication', ['ngCookies'])

    .constant('passwordPolicyConfig', {
      PolicyPasswordChangeUnsupported: -3,
      PolicyPasswordSystemUnknown: -2,
      PolicyPasswordUnknown: -1,
      PolicyPasswordExpired: 0,
      PolicyAccountLocked: 1,
      PolicyChangeAfterReset: 2,
      PolicyPasswordModNotAllowed: 3,
      PolicyMustSupplyOldPassword: 4,
      PolicyInsufficientPasswordQuality: 5,
      PolicyPasswordTooShort: 6,
      PolicyPasswordTooYoung: 7,
      PolicyPasswordInHistory: 8,
      PolicyPasswordRecoveryFailed: 9,
      PolicyPasswordRecoveryInvalidToken: 10,
      PolicyNoError: 65535
    })

  .provider('Authentication', Authentication);

  function Authentication() {
    function redirectUrl(username, domain) {
      var userName, address, baseAddress, parts, hostpart, protocol, newAddress;

      userName = username;
      if (domain)
        userName += '@' + domain;
      address = '' + window.location.href;
      baseAddress = ApplicationBaseURL + encodeURIComponent(userName);
      if (baseAddress[0] == '/') {
        parts = address.split('/');
        hostpart = parts[2];
        protocol = parts[0];
        baseAddress = protocol + '//' + hostpart + baseAddress;
      }
      if (address.startsWith(baseAddress) && !address.endsWith('/logoff'))
        newAddress = address;
      else
        newAddress = baseAddress;

      return newAddress;
    }

    this.$get = getService;

    /**
     * @ngInject
     */
    getService.$inject = ['$q', '$http', '$cookies', 'passwordPolicyConfig'];
    function getService($q, $http, $cookies, passwordPolicyConfig) {
      var service;

      service = {
        login: function(data) {
          var d = $q.defer(),
              username = data.username,
              password = data.password,
              verificationCode = data.verificationCode,
              domain = data.domain,
              language,
              rememberLogin = data.rememberLogin ? 1 : 0;

          if (data.loginSuffix && !username.endsWith(data.loginSuffix)) {
            username += loginSuffix;
            domain = false;
          }
          if (data.language && data.language != 'WONoSelectionString') {
            language = data.language;
          }

          $http({
            method: 'POST',
            url: '/SOGo/connect',
            data: {
              userName: username,
              password: password,
              verificationCode: verificationCode,
              domain: domain,
              language: language,
              rememberLogin: rememberLogin
            }
          }).then(function(response) {
            var data = response.data;
            // Make sure browser's cookies are enabled
            if (navigator && !navigator.cookieEnabled) {
              d.reject({error: l('cookiesNotEnabled')});
            }
            else {
              // Check for TOTP
              if (typeof data.totpMissingKey != 'undefined' && response.status == 202) {
                d.resolve({totpmissingkey: 1});
              }
              else if (typeof data.totpDisabled != 'undefined') {
                d.resolve({
                  cn: data.cn,
                  url: redirectUrl(data.username, domain),
                  totpdisabled: 1
                });
              }
              // Check password policy
              else if (typeof data.expire != 'undefined' && typeof data.grace != 'undefined') {
                if (data.expire < 0 && data.grace > 0) {
                  d.reject({
                    cn: data.cn,
                    url: redirectUrl(username, domain),
                    grace: data.grace
                  });
                } else if (data.expire > 0 && data.grace == -1) {
                  d.reject({
                    cn: data.cn,
                    url: redirectUrl(username, domain),
                    expire: data.expire
                  });
                }
                else {
                  d.resolve({
                    cn: data.cn,
                    url: redirectUrl(data.username, domain)
                  });
                }
              }
              else {
                d.resolve({ url: redirectUrl(data.username, domain) });
              }
            }
          }, function(error) {
            var response, perr, data = error.data;
            if (data && data.totpInvalidKey) {
              response = {error: l('You provided an invalid TOTP key.')};
            }
            else if (data && angular.isDefined(data.LDAPPasswordPolicyError)) {
              perr = data.LDAPPasswordPolicyError;
              if (perr == passwordPolicyConfig.PolicyNoError) {
                response = {error: l('Wrong username or password.')};
              }
              else if (perr == passwordPolicyConfig.PolicyAccountLocked) {
                response = {error: l('Your account was locked due to too many failed attempts.')};
              }
              else if (perr == passwordPolicyConfig.PolicyPasswordExpired ||
                       perr == passwordPolicyConfig.PolicyChangeAfterReset) {
                response = {
                  passwordexpired: 1,
                  userPolicies: data.additionalInfos.userPolicies,
                  url: redirectUrl(username, domain)
                };
              }
              else if (perr == passwordPolicyConfig.PolicyChangeAfterReset) {
                response = {
                  passwordexpired: 1,
                  userPolicies: data.additionalInfos.userPolicies,
                  url: redirectUrl(username, domain)
                };
              } else if (perr == passwordPolicyConfig.PolicyInsufficientPasswordQuality) {
                response = {
                  passwordexpired: 2,
                  userPolicies: data.additionalInfos.userPolicies,
                  url: redirectUrl(username, domain)
                };
              }
              else {
                response = {error: l('Login failed due to unhandled error case: ') + perr};
              }
            }
            else {
              response = {error: l('Unhandled error response')};
            }
            d.reject(response);
          });
          return d.promise;
        }, // login: function(data) { ...

        loginName: function(data) {
          var d = $q.defer(),
              username = data.username,
              language;

          if (data.language && data.language != 'WONoSelectionString') {
            language = data.language;
          }

          $http({
            method: 'POST',
            url: '/SOGo/connectName?userName='+username,
            // data: JSON.stringify({userName: username}),
            data: {userName: username},
            // headers: {
            //  //'Content-Type': undefined
            //  //'Content-Type': "application/x-www-form-urlencoded"
            //   'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            // }
          }).then(function(response) {
            var data = response.data;
            // Make sure browser's cookies are enabled
            if (navigator && !navigator.cookieEnabled) {
              d.reject({error: l('cookiesNotEnabled')});
            }
            else {
                if(data.redirect) {
                  //Redirection in case of openID
                  d.resolve({ url: data.redirect });
                }
            }
          }, function(error) {
            var response, perr, data = error.data;

            d.reject(response);
          });
          return d.promise;
        },

        changePassword: function(userName, domain, newPassword, oldPassword, token) {
          var d = $q.defer(),
              xsrfCookie = $cookies.get('XSRF-TOKEN');

          $cookies.remove('XSRF-TOKEN', {path: '/SOGo/'});

          $http({
            method: 'POST',
            url: '/SOGo/so/changePassword',
            headers: {
              'X-XSRF-TOKEN' : xsrfCookie
            },
            data: { userName: userName, newPassword: newPassword, oldPassword: oldPassword, token: token }
          }).then(function (response) {
            if (response && response.data && response.data.username) {
              d.resolve({ url: redirectUrl(response.data.username, domain) });
            } else {
              d.resolve({ url: redirectUrl(userName, domain) });
            }
          }, function(response) {
            var error,
                data = response.data,
                perr = data.LDAPPasswordPolicyError;

            if (!perr) {
              perr = passwordPolicyConfig.PolicyPasswordSystemUnknown;
              error = _("Unhandled error response");
            }
            else if (perr == passwordPolicyConfig.PolicyNoError ||
                     perr == passwordPolicyConfig.PolicyPasswordUnknown) {
              error = l("Password change failed");
            } else if (perr == passwordPolicyConfig.PolicyPasswordModNotAllowed) {
              error = l("Password change failed - Permission denied");
            } else if (perr == passwordPolicyConfig.PolicyInsufficientPasswordQuality) {
              error = l("Password change failed - Insufficient password quality");
            } else if (perr == passwordPolicyConfig.PolicyPasswordTooShort) {
              error = l("Password change failed - Password is too short");
            } else if (perr == passwordPolicyConfig.PolicyPasswordTooYoung) {
              error = l("Password change failed - Password is too young");
            } else if (perr == passwordPolicyConfig.PolicyPasswordInHistory) {
              error = l("Password change failed - Password is in history");
            } else if (perr == passwordPolicyConfig.PolicyPasswordRecoveryInvalidToken) {
              error = l("Invalid token. Could not change password");
            } else {
              error = l("Unhandled policy error: %{0}").formatted(perr);
              perr = passwordPolicyConfig.PolicyPasswordUnknown;
            }

            // Restore the cookie
            $cookies.put('XSRF-TOKEN', xsrfCookie, {path: '/SOGo/'});
            d.reject(error);
          });
          return d.promise;
        },

        passwordRecovery: function (userName, domain) {
          var self = this;

          var d = $q.defer(),
            xsrfCookie = $cookies.get('XSRF-TOKEN');

          $cookies.remove('XSRF-TOKEN', { path: '/SOGo/' });

          $http({
            method: 'POST',
            url: '/SOGo/so/passwordRecovery',
            headers: {
              'X-XSRF-TOKEN': xsrfCookie
            },
            data: { userName: userName, domain: domain }
          }).then(function (response) {
            d.resolve(Object.assign(
              { url: redirectUrl(userName, domain) }, 
              response.data, 
              'SecretQuestion' === response.data.mode ? { secretQuestionLabel: l('passwordRecovery_' + response.data.secretQuestion) } : {},
              'SecondaryEmail' === response.data.mode ? { obfuscatedRecoveryEmail: response.data.obfuscatedSecondaryEmail } : {}
              ));
          }, function () {
            // Restore the cookie
            $cookies.put('XSRF-TOKEN', xsrfCookie, { path: '/SOGo/' });
            d.reject(l("Unhandled policy error: %{0}").formatted(passwordPolicyConfig.PolicyPasswordRecoveryFailed));
          });
          return d.promise;
        },


        passwordRecoveryEmail: function (userName, domain, mode, mailDomain) {
          var self = this;

          var d = $q.defer(),
            xsrfCookie = $cookies.get('XSRF-TOKEN');

          $cookies.remove('XSRF-TOKEN', { path: '/SOGo/' });

          $http({
            method: 'POST',
            url: '/SOGo/so/passwordRecoveryEmail',
            headers: {
              'X-XSRF-TOKEN': xsrfCookie
            },
            data: { userName: userName, domain: domain, mode: mode, mailDomain: mailDomain }
          }).then(function (response) {
            d.resolve(response.data.jwt);
          }, function (response) {
            // Restore the cookie
            $cookies.put('XSRF-TOKEN', xsrfCookie, { path: '/SOGo/' });
            d.reject(l(response.data));
          });
          return d.promise;
        },


        passwordRecoveryCheck: function (userName, domain, mode, question, answer, mailDomain) {
          var self = this;

          var d = $q.defer(),
            xsrfCookie = $cookies.get('XSRF-TOKEN');

          $cookies.remove('XSRF-TOKEN', { path: '/SOGo/' });

          $http({
            method: 'POST',
            url: '/SOGo/so/passwordRecoveryCheck',
            headers: {
              'X-XSRF-TOKEN': xsrfCookie
            },
            data: { userName: userName, domain: domain, mode: mode, question: question, answer: answer, mailDomain: mailDomain }
          }).then(function (response) {
            d.resolve(response.data.jwt);
          }, function (response) {
            // Restore the cookie
            $cookies.put('XSRF-TOKEN', xsrfCookie, { path: '/SOGo/' });
            d.reject(l(response.data));
          });
          return d.promise;
        },

        passwordRecoveryEnabled: function (userName, domain) {
          var self = this;

          var d = $q.defer();
          
          $http({
            method: 'POST',
            url: '/SOGo/so/passwordRecoveryEnabled',
            data: { userName: userName, domain: domain }
          }).then(function (response) {
            d.resolve(response.data.domain);
          }, function () {
            d.reject();
          });
          return d.promise;
        }
      };
      return service;
    }
  }

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @name Dialog
   * @constructor
   */
  function Dialog() {
  }

  /**
   * @name alert
   * @desc Show an alert dialog box with a single "OK" button
   * @param {string} title
   * @param {string} content
   */
  Dialog.alert = function(title, content) {
    var alert = this.$modal.alert()
        .title(title)
        .htmlContent(content)
        .ok(l('OK'))
        .multiple(true);
    this.$modal.show(alert);
  };

  /**
   * @name confirm
   * @desc Show a confirmation dialog box with buttons 'Cancel' and 'OK'
   * @param {string} title
   * @param {string} content
   * @returns a promise that resolves if the user has clicked on the 'OK' button
   */
  Dialog.confirm = function(title, content, options) {
    var confirm = this.$modal.confirm()
        .title(title)
        .htmlContent(content)
        .ok((options && options.ok)? options.ok : l('OK'))
        .cancel((options && options.cancel)? options.cancel : l('Cancel'));
    return this.$modal.show(confirm);
  };

  /**
   * @name prompt
   * @desc Show a primpt dialog box with a input text field and the 'Cancel' and 'OK' buttons
   * @param {string} title
   * @param {string} label
   * @param {object} [options] - use a different input type by setting 'inputType'
   * @returns a promise that resolves with the input field value
   */
  Dialog.prompt = function(title, label, options) {
    var o = options || {},
        id = title.asCSSIdentifier(),
        d = this.$q.defer();

    this.$modal.show({
      parent: angular.element(document.body),
      clickOutsideToClose: true,
      escapeToClose: true,
      template: [
        '<md-dialog flex="50" flex-xs="90">',
        '  <form name="' + id + 'Form" ng-submit="ok()">',
        '    <md-dialog-content class="md-dialog-content" layout="column">',
        '      <h2 class="md-title" ng-bind="title"></h2>',
        '      <md-input-container>',
        '        <label>' + label + '</label>',
        '        <input type="' + (o.inputType || 'text') + '"',
        '               aria-label="' + title + '"',
        '               ng-model="name" md-autofocus="true" required />',
        '      </md-input-container>',
        '    </md-dialog-content>',
        '    <md-dialog-actions>',
        '      <md-button ng-click="cancel()">',
        '        ' + l('Cancel'),
        '      </md-button>',
        '      <md-button type="submit" class="md-primary" ng-disabled="' + id + 'Form.$invalid">',
        '        ' + l('OK'),
        '      </md-button>',
        '    </md-dialog-actions>',
        '  </form>',
        '</md-dialog>'
      ].join(''),
      controller: PromptDialogController
    });

    /**
     * @ngInject
     */
    PromptDialogController.$inject = ['scope', '$mdDialog'];
    function PromptDialogController(scope, $mdDialog) {
      scope.title = title;
      scope.name = "";
      scope.cancel = function() {
        d.reject();
        $mdDialog.hide();
      };
      scope.ok = function() {
        d.resolve(scope.name);
        $mdDialog.hide();
      };
    }

    return d.promise;
  };

  /**
   * @memberof Dialog
   * @desc The factory we'll register as Dialog in the Angular module SOGo.Common
   * @ngInject
   */
  DialogService.$inject = ['$q', '$mdDialog'];
  function DialogService($q, $mdDialog) {
    angular.extend(Dialog, { $q: $q , $modal: $mdDialog });

    return Dialog; // return constructor
  }

  /* Factory registration in Angular module */
  angular
    .module('SOGo.Common')
    .factory('Dialog', DialogService);

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * Gravatar - A service to build the Gravatar URL for an email address
   * @memberof SOGo.Common
   * @param {string} email
   * @param {number} [size] - the size of the image
   * @param {string} alternate avatar to use (none, identicon, monsterid, wavatar, retro)
   * @ngInject
   */
  function Gravatar() {
    return function(email, size, alternate_avatar, options) {
      var x, y, hash, s = size, a = alternate_avatar;
      if (!email) {
        return '';
      }
      x = email.indexOf('<');
      if (x >= 0) {
        y = email.indexOf('>', x);
        if (y > x)
          email = email.substring(x+1,y);
      }
      if (!size) {
        s = 48; // default to 48 pixels
      }
      hash = email.md5();

      if (!a || a == "none") {
        if (options && options.no_404)
          alternate_avatar = "mm"; // mystery man alternative
        else
          alternate_avatar = "404";
      }

      return 'https://www.gravatar.com/avatar/' + hash + '?s=' + s + '&d=' + alternate_avatar;
    };
  }

  angular
    .module('SOGo.Common')
    .factory('Gravatar', Gravatar);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @name Resource
   * @constructor
   * @param {Object} $http - the Angular HTTP service
   * @param {Object} $q - the Angular promise/deferred service
   * @param {String} path - the base path of the external resource
   * @param {Object} options - extra attributes to be associated to the object
   */
  function Resource($http, $q, $window, $cookies, path, activeUser, options) {
    angular.extend(this, {
      _http: $http,
      _q: $q,
      _window: $window,
      _cookies: $cookies,
      _path: path,
      _activeUser: activeUser
    });
    angular.extend(this, options);
    // Trim trailing slash
    this._path = this._path.replace(/\/$/, '');
  }

  /**
   * @memberof Resource
   * @desc The factory we'll use to register with Angular.
   * @return a new Resource object
   */
  Resource.$factory =  ['$http', '$q', '$window', '$cookies', function($http, $q, $window, $cookies) {
    return function(path, activeUser, options) {
      return new Resource($http, $q, $window, $cookies, path, activeUser, options);
    };
  }];

  /**
   * @module SOGo.Common
   * @desc Factory registration of Resource in Angular module.
   */
  angular.module('SOGo.Common').factory('Resource', Resource.$factory);

  Resource.prototype.encodeURL = function(url) {
    var _this = this,
        segments = url;

    if (!angular.isArray(segments)) {
      segments = url.split('/');
    }
    return _.map(segments, function(segment) {
      return _this._window.encodeURIComponent(segment.toString());
    });
  };

  /**
   * @function userResource
   * @memberof Resource.prototype
   * @desc Create a new Resource object associated to a username different than the active user.
   * @param {String} uid - the user UID
   * @return a new Resource object
   */
  Resource.prototype.userResource = function(uid) {
    var path = _.compact(this._activeUser.folderURL.split('/'));

    if (uid)
      path.splice(path.length - 1, 1, escape(uid));

    return new Resource(this._http, this._q, this._window, this._cookies, '/' + path.join('/'), this._activeUser);
  };

  /**
   * @function path
   * @memberof Resource.prototype
   * @desc Create a URL of the resource context with any number of additional segments
   * @return an absolute URL
   */
  Resource.prototype.path = function() {
    var path = [this._path];

    if (arguments.length > 0)
      Array.prototype.push.apply(path, Array.prototype.slice.call(arguments));

    return path.join('/');
  };

  /**
   * @function fetch
   * @memberof Resource.prototype
   * @desc Fetch resource using a specific folder, action and/or parameters.
   * @param {string} folderId - the folder on which the action will be applied (ex: addressbook, calendar)
   * @param {string} action - the action to be used in the URL
   * @param {Object} params - Object parameters injected through the $http service
   * @return a promise
   */
  Resource.prototype.fetch = function(folderId, action, params) {
    var deferred = this._q.defer(),
        path = [this._path];
    if (folderId) path.push(this.encodeURL(folderId));
    if (action)   path.push(action);
    path = _.compact(_.flatten(path)).join('/');

    this._http({
      method: 'GET',
      url: path,
      params: params
    })
      .then(function(response) {
        return deferred.resolve(response.data);
      }, deferred.reject);

    return deferred.promise;
  };

  /**
   * @function quietFetch
   * @memberof Resource.prototype
   * @desc Fetch resource using a specific folder, action and/or parameters, but disable the global
   *       error interceptor.
   * @param {string} folderId - the folder on which the action will be applied (ex: addressbook, calendar)
   * @param {string} action - the action to be used in the URL
   * @param {Object} params - Object parameters injected through the $http service
   * @return a promise
   */
  Resource.prototype.quietFetch = function(folderId, action, params) {
    var deferred = this._q.defer(),
        path = [this._path];
    if (folderId) path.push(this.encodeURL(folderId));
    if (action)   path.push(action);
    path = _.compact(_.flatten(path)).join('/');

    this._http({
      method: 'GET',
      url: path,
      params: params,
      transformResponse: function(data) {
        var jsonData;
        try {
          jsonData = angular.fromJson(data);
        }
        catch (e) {
          jsonData = {};
        }
        return angular.extend({ quiet: true }, jsonData);
      }
    })
      .then(function(response) {
        return deferred.resolve(response.data);
      }, deferred.reject);

    return deferred.promise;
  };

  /**
   * @function newguid
   * @memberof Resource.prototype
   * @desc Fetch a new GUID on the specified folder ID.
   * @return a promise of the new data structure
   */
  Resource.prototype.newguid = function(folderId) {
    var deferred = this._q.defer(),
        path = this._path + '/' + folderId + '/newguid';

    this._http
      .get(path)
      .then(function(response) {
        return deferred.resolve(response.data);
      }, deferred.reject);

    return deferred.promise;
  };

  /**
   * @function create
   * @memberof Resource.prototype
   * @desc Create a new resource using a specific action (post).
   * @param {string} action - the action to be used in the URL
   * @param {string} name - the new resource's name
   * @return a promise
   */
  Resource.prototype.create = function(action, name) {
    var deferred = this._q.defer(),
        path = this._path + '/' + action;

    this._http
      .post(path, { name: name })
      .then(function(response) {
        return deferred.resolve(response.data);
      }, deferred.reject);

    return deferred.promise;
  };

  /**
   * @function post
   * @memberof Resource.prototype
   * @desc Post a resource attributes on the server.
   * @return a promise
   */
  Resource.prototype.post = function(id, action, data) {
    var deferred = this._q.defer(),
        path = [this._path];
    if (id) path.push(this.encodeURL(id));
    if (action) path.push(action);
    path = _.compact(_.flatten(path)).join('/');

    this._http
      .post(path, data)
      .then(function(response) {
        return deferred.resolve(response.data);
      }, deferred.reject);

    return deferred.promise;
  };

  /**
   * @function save
   * @memberof Resource.prototype
   * @desc Save a resource attributes on the server (post /save).
   * @return a promise
   */
  Resource.prototype.save = function(id, newValue, options) {
    var action = (options && options.action)? options.action : 'save';

    return this.post(id, action, newValue);
  };

  /**
   * @function download
   * @memberof Resource.prototype
   * @desc Download a file from the server. Requires FileSaver.js.
   * @see {@link http://blog.davidjs.com/2015/07/download-files-via-post-request-in-angularjs/|Download files via POST request in AngularJs}
   * @see {@link https://github.com/eligrey/FileSaver.js|FileSaver.js}
   * @return a promise
   */
  Resource.prototype.download = function(id, action, data, options) {
    var deferred = this._q.defer(),
        type = (options && options.type)? options.type : 'application/zip',
        path = [this._path];
    if (id) path.push(this.encodeURL(id));
    if (action) path.push(action);
    path = _.compact(_.flatten(path)).join('/');

    if (typeof saveAs == 'undefined') {
      throw new Error('To use Resource.download, FileSaver.js must be loaded.');
    }

    function getFileNameFromHeader(header) {
      var result;

      if (!header) return null;
      result = header.split(";")[1].trim().split("=")[1];

      return result.replace(/"/g, '');
    }

    return this._http({
      method: 'POST',
      url: path,
      data: data,
      headers: {
        accept: type
      },
      responseType: 'arraybuffer',
      cache: false,
      transformResponse: function (data, headers, status) {
        var fileName, result, blob = null;

        if (status < 200 || status > 299) {
          throw new Error('Bad gateway');
        }
        if (data) {
          blob = new Blob([data], { type: type });
        }
        if (options && options.filename) {
          fileName = options.filename;
        }
        else {
          fileName = getFileNameFromHeader(headers('content-disposition'));
        }
        saveAs(blob, fileName);
      }
    });
  };

  Resource.prototype.open = function(id, action) {
    var path = [this._path], xsrfToken;
    xsrfToken = this._cookies.get('XSRF-TOKEN');
    if (id) path.push(id);
    if (action) path.push(action);
    path = _.compact(_.flatten(path)).join('/');
    if (xsrfToken) {
      path += '?X-XSRF-TOKEN=' + xsrfToken;
    }

    this._window.location.href = path;
  };

  /**
   * @function remove
   * @memberof Resource.prototype
   * @desc Delete a resource (get /delete).
   * @return a promise
   */
  Resource.prototype.remove = function(uid) {
    var deferred = this._q.defer(),
        path = _.flatten([this._path, this.encodeURL(uid), 'delete']).join('/');

    this._http
      .get(path)
      .then(function(response) {
        return deferred.resolve(response.data);
      }, deferred.reject);

    return deferred.promise;
  };

})();
(function() {
  'use strict';

  /**
   * @name User
   * @constructor
   * @param {object} [userData] - some default values for the user
   */
  function User(userData) {
    if (userData) {
      this.init(userData);
    }
  }

  /**
   * @memberof User
   * @desc The factory we'll use to register with Angular.
   * @return the User constructor
   */
  User.factory = ['$q', '$log', 'sgSettings', 'Resource', function($q, $log, Settings, Resource) {
    angular.extend(User, {
      $q: $q,
      $log: $log,
      $$resource: new Resource(Settings.activeUser('folderURL'), Settings.activeUser()),
      $query: '',
      $users: []
    });

    return User;
  }];

  /**
   * @module SOGo.Common
   * @desc Factory registration of User in Angular module.
   */
  angular.module('SOGo.Common').factory('User', User.factory);

  /**
   * @memberof User
   * @desc Search for users that match a string.
   * @param {string} search - a string used to performed the search
   * @param {object[]} excludedUsers - a list of User objects that must be excluded from the results
   * @return a promise of an array of matching User objects
   */
  User.$filter = function(search, excludedUsers, options) {
    var _this = this, resource = User.$$resource, param = {search: search};

    if (!options || !options.dry) {
      if (!search) {
        // No query specified
        User.$users.splice(0, User.$users.length);
        return User.$q.when(User.$users);
      }
      if (User.$query == search) {
        // Query hasn't changed
        return User.$q.when(User.$users);
      }
      User.$query = search;
    }
    else if (options && options.uid) {
      resource = User.$$resource.userResource(options.uid);
    }

    return resource.fetch(null, 'usersSearch', param).then(function(response) {
      var results, index, user, users,
          compareUids = function(data) {
            return this.uid == data.uid;
          };

      if (options) {
        if (options.dry)
          users = [];
        else if (options.results)
          users = options.results;
      }
      else
        users = User.$users;

      if (excludedUsers) {
        // Remove excluded users from response
        results = _.filter(response.users, function(user) {
          return !_.find(excludedUsers, _.bind(compareUids, user));
        });
      }
      else {
        results = response.users;
      }

      // Remove users that no longer match the search query
      for (index = users.length - 1; index >= 0; index--) {
        user = users[index];
        if (!_.find(results, _.bind(compareUids, user))) {
          users.splice(index, 1);
        }
      }
      // Add new users matching the search query
      _.forEach(results, function(data, index) {
        if (_.isUndefined(_.find(users, _.bind(compareUids, data)))) {
          var user = new User(data);
          users.splice(index, 0, user);
        }
      });
      User.$log.debug(users);
      return users;
    });
  };

  /**
   * @function init
   * @memberof User.prototype
   * @desc Extend instance with required attributes and new data.
   * @param {object} data - attributes of user
   */
  User.prototype.init = function(data) {
    angular.extend(this, data);
    if (!this.$$shortFormat)
      this.$$shortFormat = this.$shortFormat();
    if (!this.$$image)
      this.$$image = this.image;
    this.$avatarIcon = (this.$isGroup() || this.$isSpecial()) ? 'group' : 'person';
    // NOTE: We can't assign a Gravatar at this stage since we would need the Preferences module
    // which already depend on the User module.

    // An empty attribute to trick md-autocomplete when adding users from the ACLs editor
    this.empty = ' ';
  };

  /**
   * @function $fullname
   * @memberof User.prototype
   * @return a string representing the fullname
   */
  User.prototype.$fullname = function() {
    var fullname = this.cn || this.uid;

    if (this.c_info)
      fullname += ' (' + this.c_info.split("\n").join("; ") + ')';

    return fullname;
  };

  /**
   * @function $shortFormat
   * @memberof User.prototype
   * @return the fullname along with the email address
   */
  User.prototype.$shortFormat = function(options) {
    var fullname = this.$fullname();
    var email = this.c_email;
    var no_email = options && options.email === false;
    if (!no_email && email && fullname != email) {
      fullname += ' <' + email + '>';
    }
    return fullname;
  };

  /**
   * @function $acl
   * @memberof User.prototype
   * @desc Fetch the user rights associated to a specific folder and populate the 'rights' attribute.
   * @param {string} the folder ID
   * @param {Object} owner - the owner to use when fetching the ACL as it might not be the Settings.activeUser
   * @return a promise
   */
  User.prototype.$acl = function(folderId, owner) {
    var _this = this,
        deferred = User.$q.defer(),
        param = {uid: this.uid};
    if (this.$shadowRights) {
      deferred.resolve(this.rights);
    }
    else {
      var rights;

      if (angular.isDefined(owner))
        rights = User.$$resource.userResource(owner).fetch(folderId, 'userRights', param);
      else
        rights = User.$$resource.fetch(folderId, 'userRights', param);

      rights.then(function(data) {
        _this.rights = data;
        // Convert numbers (0|1) to boolean values
        //angular.forEach(_.keys(_this.rights), function(key) {
        //  _this.rights[key] = _this.rights[key] ? true : false;
        //});
        // console.debug('rights ' + _this.uid + ' => ' + JSON.stringify(data, undefined, 2));
        // Keep a copy of the server's version
        _this.$shadowRights = angular.copy(data);
        deferred.resolve(data);
        return data;
      });
    }
    return deferred.promise;
  };

  /**
   * @function $isGroup
   * @memberof User.prototype
   * @return true if the user actually represents a group of users
   */
  User.prototype.$isGroup = function() {
    return this.isGroup || this.userClass && this.userClass == 'normal-group';
  };

  /**
   * @function $isAnonymous
   * @memberof User.prototype
   * @return true if it's the special anonymous user
   */
  User.prototype.$isAnonymous = function() {
    return this.uid == 'anonymous';
  };

  /**
   * @function $isSpecial
   * @memberof User.prototype
   * @desc Only accurate from the ACL editor.
   * @return true if the user is not a regular system user
   */
  User.prototype.$isSpecial = function() {
    return this.userClass && this.userClass == 'public-user';
  };

  /**
   * @function $confirmRights
   * @memberof User.prototype
   * @desc Check if a confirmation is required before giving some rights.
   * @return the confirmation message or false if no confirmation is required
   */
  User.prototype.$confirmRights = function(folder) {
    var confirmation = false;

    if (this.$confirmation) {
      // Don't bother the user more than once
      return false;
    }

    if (_.some(_.values(this.rights))) {
      if (this.uid == 'anonymous') {
        if (folder.constructor.name == 'AddressBook')
          confirmation = l('Potentially anyone on the Internet will be able to access your address book "%{0}", even if they do not have an account on this system. Is this information suitable for the public Internet?', folder.name);
        else if (folder.constructor.name == 'Calendar')
          confirmation = l('Potentially anyone on the Internet will be able to access your calendar "%{0}", even if they do not have an account on this system. Is this information suitable for the public Internet?', folder.name);
      }
      else if (this.uid == 'anyone' || this.uid == '<default>') {
        if (folder.constructor.name == 'AddressBook')
          confirmation = l('Any user with an account on this system will be able to access your address book "%{0}". Are you certain you trust them all?', folder.name);
        else if (folder.constructor.name == 'Calendar')
          confirmation = l('Any user with an account on this system will be able to access your calendar "%{0}". Are you certain you trust them all?', folder.name);
        else if (folder.constructor.name == 'Mailbox')
          confirmation = l('Any user with an account on this system will be able to access your mailbox "%{0}". Are you certain you trust them all?', folder.name);
      }
    }

    this.$confirmation = confirmation;

    return confirmation;
  };

  /**
   * @function $rightsAreDirty
   * @memberof User.prototype
   * @return whether or not the rights have changed from their initial values
   */
  User.prototype.$rightsAreDirty = function() {
    return this.rights && !_.isEqual(this.rights, this.$shadowRights);
  };

  /**
   * @function $resetRights
   * @memberof User.prototype
   * @desc Restore initial rights or disable all rights
   * @param {boolean} [zero] - reset all rights to zero when true
   */
  User.prototype.$resetRights = function(zero) {
    var _this = this;
    if (zero) {
      // Disable all rights
      _.map(_.keys(this.rights), function(key) {
        if (angular.isString(_this.rights[key]))
          _this.rights[key] = 'None';
        else
          _this.rights[key] = 0;
      });
    }
    else if (this.$shadowRights) {
      // Restore initial rights
      this.rights = angular.copy(this.$shadowRights);
    }
  };

  /**
   * @function $folders
   * @memberof User.prototype
   * @desc Retrieve the list of folders of a specific type
   * @param {string} type - either 'contact' or 'calendar'
   * @return a promise of the HTTP query result or the cached result
   */
  User.prototype.$folders = function(type) {
    var _this = this,
        deferred = User.$q.defer(),
        param = {type: type};
    if (this.$$folders) {
      deferred.resolve(this.$$folders);
    }
    else {
      User.$$resource.userResource(this.uid).fetch(null, 'foldersSearch', param).then(function(response) {
        _this.$$folders = response.folders;
        deferred.resolve(response.folders);
      });
    }
    return deferred.promise;
  };

  /**
   * @function $omit
   * @memberof User.prototype
   * @desc Return a sanitized object used to send to the server.
   * @return an object literal copy of the User instance
   */
  User.prototype.$omit = function() {
    var user = {};
    angular.forEach(this, function(value, key) {
      if (key != 'constructor' && key[0] != '$') {
        user[key] = value;
      }
    });
    return user;
  };

  User.prototype.toString = function() {
    return '[User ' + this.c_email + ']';
  };

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';
  
  /**
   * sgFocus - A service to set the focus on the element associated to a specific string
   * @memberof SOGo.Common
   * @param {string} name - the string identifier of the element
   * @see {@link SOGo.Common.sgFocusOn}
   * @ngInject
  */
  sgFocus.$inject = ['$rootScope', '$timeout'];
  function sgFocus($rootScope, $timeout) {
    return function(name) {
      $timeout(function() {
        $rootScope.$broadcast('sgFocusOn', name);
      });
    };
  }

  angular
    .module('SOGo.Common')
    .factory('sgFocus', sgFocus);
})();
/* -*- Mode: js; indent-tabs-mode: nil; js-indent-level: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /**
   * $sgHotkeys - A service to associate keyboard shortcuts to actions.
   * @memberof SOGo.Common
   *
   * @description
   * This service is a modified version of angular-hotkeys-light by Eugene Brodsky:
   * https://github.com/fupslot/angular-hotkeys-light
   */
  function $sgHotkeys() {

    // Key-code values for various meta-keys.
    // Source : http://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
    //          http://unixpapa.com/js/key.html
    // Date: Oct 02, 2015.
    var KEY_CODES = {
      8: 'backspace',
      9: 'tab',
      13: 'enter',
      16: 'shift',
      17: 'ctrl',
      18: 'alt',
      19: 'pause',
      20: 'caps',
      27: 'escape',
      32: 'space',
      33: 'pageup',
      34: 'pagedown',
      35: 'end',
      36: 'home',
      37: 'left',
      38: 'up',
      39: 'right',
      40: 'down',
      45: 'insert',
      46: 'delete',
      // Numpad
      96: '0',
      97: '1',
      98: '2',
      99: '3',
      100: '4',
      101: '5',
      102: '6',
      103: '7',
      104: '8',
      105: '9',
      106: '*',
      107: '+',
      109: '-',
      110: '.',
      111: '/',
      // Function keys
      112: 'f1',
      113: 'f2',
      114: 'f3',
      115: 'f4',
      116: 'f5',
      117: 'f6',
      118: 'f7',
      119: 'f8',
      120: 'f9',
      121: 'f10',
      122: 'f11',
      123: 'f12'
    };
    // Char-code values for characters that require a key combinations
    var CHAR_CODES = {
      42: '*',
      63: '?'
    };

    this.$get = getService;

    getService.$inject = ['$rootScope', '$window'];
    function getService($rootScope, $window) {

      var wrapWithApply = function (fn) {
        return function(event, args) {
          $rootScope.$apply(function() {
            fn.call(this, event, args);
          }.bind(this));
        };
      };

      var HotKey = function(params) {
        this.id = params.id || guid();
        this.key = params.key;
        this.description = params.description || null;
        this.context = params.context || null;
        this.callback = params.callback;
        this.preventInClass = params.preventInClass;
        this.args = params.args;
        this.onKeyUp = false;

        if (this.key.length > 1)
          // Automatically translate common hotkeys
          this.lkey = l('key_' + this.key);
      };

      HotKey.prototype.clone = function() {
        return new HotKey(this);
      };

      var Hotkeys = function() {
        /**
         * Sometimes a UI wants keybindings which are global, so called hotkeys.
         * Keys are keystrings (identify key combinations) and values are objects
         * with keys callback, context.
         */
        this._hotkeys = {};

        /**
         * Sometimes a UI wants keybindings for keyup behaviour.
         */
        this._hotkeysUp = {};

        /**
         * Keybindings are ignored by default when coming from a form input field.
         */
        this._preventIn = ['INPUT', 'SELECT', 'TEXTAREA', 'MD-OPTION'];

        /**
         * Keybindings are ignored by default when coming from special elements
         */
        this._preventInClass = ['md-chip-content', 'ck-content', 'ck-widget', 'ck-editor__editable', 'ck-editor__nested-editable', 'ck-table-bogus-paragraph'];

        this._onKeydown = this._onKeydown.bind(this);
        this._onKeyup = this._onKeyup.bind(this);
        this._onKeypress = this._onKeypress.bind(this);

        this.initialize();
      };

      /**
       * Binds Keydown, Keyup with the window object
       */
      Hotkeys.prototype.initialize = function() {
        this.registerHotkey(
          this.createHotkey({
            key: '?',
            description: l('Show or hide this help'),
            callback: this._toggleCheatSheet.bind(this)
          })
        );

        $window.addEventListener('keydown', this._onKeydown, true);
        $window.addEventListener('keyup', this._onKeyup, true);
        $window.addEventListener('keypress', this._onKeypress, true);
      };

      /**
       * Invokes callback functions assosiated with the given hotkey
       * @param  {Event} event
       * @param  {String} keyString hotkey
       * @param  {Array.<HotKey>} hotkeys List of registered callbacks for
       *                                  the given hotkey
       * @private
       */
      Hotkeys.prototype._invokeHotkeyHandlers = function(event, keyString, hotkeys) {
        for (var i = 0, l = hotkeys.length; i < l; i++) {
          var hotkey = hotkeys[i],
              target = event.target || event.srcElement,
              nodeName = target.nodeName.toUpperCase();
          if (!_.includes(this._preventIn, nodeName) &&
              _.intersection(target.classList, this._preventInClass).length === 0 &&
              _.intersection(target.classList, hotkey.preventInClass).length === 0) {
            try {
              hotkey.callback.call(hotkey.context, event, hotkey.args);
            } catch(e) {
              console.error('HotKeys: ', hotkey.key, e.message);
            }
          }
        }
      };

      /**
       * Keydown Event Handler
       * @private
       */
      Hotkeys.prototype._onKeydown = function(event) {
        var keyString = this.keyStringFromEvent(event);
        if (this._hotkeys[keyString]) {
          this._invokeHotkeyHandlers(event, keyString, this._hotkeys[keyString]);
        }
      };

      /**
       * Keyup Event Handler
       * @private
       */
      Hotkeys.prototype._onKeyup = function(event) {
        var keyString = this.keyStringFromEvent(event);
        if (this._hotkeysUp[keyString]) {
          this._invokeHotkeyHandlers(this._hotkeysUp[keyString], keyString);
        }
      };

      /**
       * Keypress Event Handler
       * @private
       */
      Hotkeys.prototype._onKeypress = function(event) {
        var charCode, keyString;

        charCode = event.keyCode || event.which;
        keyString = CHAR_CODES[charCode];
        if (keyString && this._hotkeys[keyString]) {
          this._invokeHotkeyHandlers(event, keyString, this._hotkeys[keyString]);
        }
      };

      /**
      * Cross-browser method which can extract a key string from an event.
      * Key strings are of the form
      *
      *   ctrl+alt+shift+meta+character
      *
      * where each of the 4 modifiers may or may not appear, but always appear
      * in that order if they do appear.
      *
      * TODO : this is not yet implemented fully. The trouble is, the keyCode,
      * charCode, and which properties of the DOM standard KeyboardEvent are
      * discouraged in favour of the use of key and char, but key and char are
      * not yet implemented in Gecko nor in Blink/Webkit. We need to leverage
      * keyCode/charCode so that current browser versions are supported, but also
      * look to key and char because they're apparently more useful and are the
      * future.
      */
      Hotkeys.prototype.keyStringFromEvent = function(event) {
        var result = [];
        var key = event.which;

        if (KEY_CODES[key]) {
          key = KEY_CODES[key];
        } else {
          key = String.fromCharCode(key).toLowerCase();
        }

        if (event.ctrlKey)  { result.push('ctrl');  }
        if (event.altKey)   { result.push('alt');   }
        if (event.shiftKey) { result.push('shift'); }
        if (event.metaKey)  { result.push('meta');  }
        result.push(key);
        return _.uniq(result).join('+');
      };

      /**
      * Unregister a hotkey (shortcut) helper for (keyUp/keyDown).
      *
      * @param {String}   params.key      - valid key string.
      */
      Hotkeys.prototype._deregisterHotkey = function(hotkey) {
        var ret;
        var table = this._hotkeys;

        if (hotkey.onKeyUp) {
          table = this._hotkeysUp;
        }

        if (table[hotkey.key]) {
          var callbackArray = table[hotkey.key];
          for (var i = 0; i < callbackArray.length; ++i) {
            var callbackData = callbackArray[i];
            if ((hotkey.callback === callbackData.callback &&
                 callbackData.context === hotkey.context) ||
                (hotkey.id === callbackData.id)) {
              ret = callbackArray.splice(i, 1);
            }
          }
          if (callbackArray.length === 0)
            delete this._hotkeys[hotkey.key];
        }
        return ret;
      };

      /**
       * Unregister hotkeys
       * @param  {Hotkey}  hotkey A hotkey object
       * @return {Array}
       */
      Hotkeys.prototype.deregisterHotkey = function(hotkey) {
        var result = [];

        this._validateHotkey(hotkey);

        if (angular.isArray(hotkey.key)) {
          for (var i = hotkey.key.length - 1; i >= 0; i--) {
            var clone = hotkey.clone();
            clone.key = hotkey.key[i];
            var ret = this._deregisterHotkey(clone);
            if (ret !== void 0) {
              result.push(ret[0]);
            }
          }
        } else {
          result.push(this._deregisterHotkey(hotkey));
        }
        return result;
      };

      /**
       * Validate HotKey type
       */
      Hotkeys.prototype._validateHotkey = function(hotkey) {
        if (!(hotkey instanceof HotKey)) {
          throw new TypeError('Hotkeys: Expected a hotkey object be instance of HotKey');
        }
      };

      /**
      * Register a hotkey (shortcut) helper for (keyUp/keyDown).
      * @param {Object} params Parameters object
      * @param {String}   params.key      - valid key string.
      * @param {Function} params.callback - routine to run when key is pressed.
      * @param {Object}   params.context  - @this value in the callback.
      * @param [Boolean]  params.onKeyUp  - if this is intended for a keyup.
      * @param [String]   params.id       - the identifier for this registration.
      */
      Hotkeys.prototype._registerKey = function(hotkey) {
        var table = this._hotkeys;

        if (hotkey.onKeyUp) {
          table = this._hotkeysUp;
        }

        table[hotkey.key] = table[hotkey.key] || [];
        table[hotkey.key].push(hotkey);
        return hotkey;
      };

      Hotkeys.prototype._registerKeys = function(hotkey) {
        var result = [];

        if (angular.isArray(hotkey.key)) {
          for (var i = hotkey.key.length - 1; i >= 0; i--) {
            var clone = hotkey.clone();
            clone.id = guid();
            clone.key = hotkey.key[i];
            result.push(this._registerKey(clone));
          }
        } else {
          result.push(this._registerKey(hotkey));
        }
        return result;
      };

      /**
      * Register a hotkey (shortcut). see _registerHotKey
      */
      Hotkeys.prototype.registerHotkey = function(hotkey) {
        this._validateHotkey(hotkey);
        return this._registerKeys(hotkey);
      };

      /**
      * Register a hotkey (shortcut) keyup behavior.
      * see _registerHotKey
      */
      Hotkeys.prototype.registerHotkeyUp = function(hotkey) {
        this._validateHotkey(hotkey);
        hotkey.onKeyUp = true;
        this._registerKeys(hotkey);
      };

      /**
       * Creates new hotkey object.
       * @param  {Object} args
       * @return {HotKey}
       */
      Hotkeys.prototype.createHotkey = function(args) {
        if (args.key === null || args.key === void 0) {
          throw new TypeError('HotKeys: Argument "key" is required');
        }

        if (args.callback === null || args.callback === void 0) {
          throw new TypeError('HotKeys: Argument "callback" is required');
        }

        args.callback = wrapWithApply(args.callback);
        return new HotKey(args);
      };

      /**
       * Checks if given shortcut match the event
       * @param  {Event} event An event
       * @param  {String|Array} key A shortcut
       * @return {Boolean}
       */
      Hotkeys.prototype.match = function(event, key) {
        if (!angular.isArray(key)) {
          key = [key];
        }

        var eventHotkey = this.keyStringFromEvent(event);
        return Boolean(~key.indexOf(eventHotkey));
      };

      /**
       *  Build and display (or hide) the hotkeys cheat sheet
       *
       * If a hotkey is registered multiple times, only the description of the first registered
       * hotkey is displayed.
       */
      Hotkeys.prototype._toggleCheatSheet = function() {
        var _this = this;

        if (this._cheatSheet) {
          Hotkeys.$modal.hide();
          this._cheatSheet = null;
        }
        else {
          this._cheatSheet = Hotkeys.$modal
            .show({
              clickOutsideToClose: true,
              escapeToClose: true,
              template: [
                '<md-dialog>',
                '  <md-toolbar class="md-hue-2">',
                '    <div class="md-toolbar-tools">',
                '      <div ng-bind="::\'Keyboard Shortcuts\' | loc"></div>',
                '    </div>',
                '  </md-toolbar>',
                '  <md-dialog-content>',
                '    <md-list>',
                '      <md-list-item ng-repeat="(hotkey, keys) in hotkeys">',
                '        {{keys[0].description}}',
                '        <div class="md-secondary sg-hotkey-container">',
                '          <sg-hotkey>{{keys[0].lkey || hotkey}}</sg-hotkey>',
                '        </div>',
                '      </md-list-item>',
                '    </md-list>',
                '  </md-dialog-content>',
                '</md-dialog>'
              ].join(''),
              controller: CheatSheetController,
              locals: {
                hotkeys: _this._hotkeys
              }
            })
            .finally(function() {
              _this._cheatSheet = null;
            });
        }

        CheatSheetController.$inject = ['$scope', 'hotkeys'];
        function CheatSheetController($scope, hotkeys) {
          $scope.hotkeys = hotkeys;
          $scope.closeDialog = function() {
            Hotkeys.$modal.hide();
          };
        }
      };

      return Hotkeys;
    }
  }

  sgHotkeys.$inject = ['$mdDialog', '$sgHotkeys'];
  function sgHotkeys($mdDialog, $sgHotkeys) {
    angular.extend($sgHotkeys, { $modal: $mdDialog });

    return new $sgHotkeys();
  }

  angular
    .module('SOGo.Common')
    .service('sgHotkeys', sgHotkeys)
    .provider('$sgHotkeys', $sgHotkeys);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';
  
  /**
   * sgFocus - A service to set the focus on the element associated to a specific string
   * @memberof SOGo.Common
   * @param {string} name - the string identifier of the element
   * @see {@link SOGo.Common.sgRippleClick}
   * @ngInject
  */
  sgRippleClick.$inject = ['$rootScope', '$timeout'];
  function sgRippleClick($rootScope, $timeout) {
    return function (containerName) {
      $timeout(function() {
        $rootScope.$broadcast('sgRippleDo', containerName);
      });
    };
  }

  angular
    .module('SOGo.Common')
    .factory('sgRippleClick', sgRippleClick);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * sgAutogrow - A directive to conditionally grow a textarea depending on its content.
   *   This directive is an alternative to the autogrow feature of the md-input component.
   *   It fixes the scroll jumping issue described in #3070.
   *
   *    - https://github.com/angular/material/issues/3070
   *    - https://material.angularjs.org/latest/api/directive/mdInput
   *
   *   The drawback of this directive is that it requires to set md-no-autogrow.
   * @memberof SOGo.Common
   * @ngInject
   * @example:

     <textarea rows="9" md-no-autogrow sg-autogrow="!isPopup" />
  */
  sgAutogrow.$inject = ['$document', '$timeout', '$mdUtil'];
  function sgAutogrow($document, $timeout, $mdUtil) {
    return {
      restrict: 'A',
      scope: {
        autogrow: '=sgAutogrow'
      },
      link: function(scope, elem, attr) {
        if (!scope.autogrow) return;

        var textarea = elem[0];
        var minHeight = textarea.clientHeight;
        var hiddenDiv = $document[0].createElement('div');
        var content = null;

        hiddenDiv.classList.add('md-input');
        hiddenDiv.classList.add('plain-text');
        hiddenDiv.style.display = 'none';
        hiddenDiv.style.whiteSpace = 'pre-wrap';
        hiddenDiv.style.wordWrap = 'break-word';
        textarea.parentNode.appendChild(hiddenDiv);

        textarea.style.resize = 'none';
        textarea.style.overflow = 'hidden';

        function AutoGrowTextArea() {
          content = textarea.value.encodeEntities();
          content = content.replace(/\n/g, '<br>');
          hiddenDiv.innerHTML = content + '<br style="line-height: 3px;">';
          hiddenDiv.style.visibility = 'hidden';
          hiddenDiv.style.display = 'block';
          textarea.style.height = Math.max(minHeight, hiddenDiv.offsetHeight) + 'px';
          hiddenDiv.style.visibility = 'visible';
          hiddenDiv.style.display = 'none';
        }

        elem.on('keyup', $mdUtil.debounce(AutoGrowTextArea, 200));
        elem.on('paste', $mdUtil.debounce(AutoGrowTextArea, 0));

        var deregisterWatcher = scope.$watch(function() {
          return elem[0].value;
        }, function(content) {
          if (content) {
            AutoGrowTextArea();
            deregisterWatcher(); // watch once
          }
        });
      }
    };
  }

  angular
    .module('SOGo.Common')
    .directive('sgAutogrow', sgAutogrow);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true, newcap: false */
  'use strict';

  /**
   * sgAvatarImage - An avatar directive that returns un img element with either a local URL (if sg-src is specified)
   * or a Gravatar URL built from the Gravatar factory (using sg-email). The element's content must return the name of the generic icon to be used (usually 'person' or 'group').
   * Based on http://blog.lingohub.com/2014/08/better-ux-with-angularjs-directives/.
   * @memberof SOGo.Common
   * @example:
     <sg-avatar-image sg-email="test@email.com" size="50">person</sg-avatar-image>
  */
  function sgAvatarImage() {
    return {
      restrict: 'AE',
      scope: {},
      bindToController: {
        size: '@',
        email: '=sgEmail',
        src: '=sgSrc'
      },
      transclude: true,
      template: [
        '<div class="sg-icon-badge-container">',
        '  <md-icon ng-transclude></md-icon>',                              // the generic icon
        '  <md-icon class="md-warn sg-icon--badge sg-icon--badge-bottom"',
        '           style="display: none">not_interested</md-icon>',        // the inactive badge (if disabled)
        '  <img class="ng-hide" ng-src="{{vm.url}}">',                      // the gravatar or local image
        '</div>'
      ].join(''),
      link: link,
      controller: 'sgAvatarImageController',
      controllerAs: 'vm'
    };

    function link(scope, element, attrs, controller) {
      var imgElement = element.find('img'),
          mdIcons = element.find('md-icon'),
          mdIconElement = angular.element(mdIcons[0]),
          mdBadgeElement = angular.element(mdIcons[1]),
          deregisterWatcher;

      if (attrs.size) {
        imgElement.attr('width', attrs.size);
        imgElement.attr('height', attrs.size);
        mdIconElement.css('font-size', attrs.size + 'px');
        mdBadgeElement.css('font-size', parseInt(attrs.size*0.4) + 'px');
      }

      if (angular.isDefined(attrs.ngDisabled)) {
        deregisterWatcher = scope.$watch(attrs.ngDisabled, function(isDisabled) {
          if (attrs.disabled) {
            mdBadgeElement.css({ display: 'block' });
          }
          deregisterWatcher(); // watch once
        });
      }

      controller.img = imgElement;
      controller.genericImg = mdIconElement;
    }
  }

  /**
   * @ngInject
   */
  sgAvatarImageController.$inject = ['$scope', '$element', '$http', '$q', 'Preferences', 'Gravatar'];
  function sgAvatarImageController($scope, $element, $http, $q, Preferences, Gravatar) {
    var vm, toggleZoomFcn;

    vm = this;

    $scope.$on('$destroy', function() {
      if (toggleZoomFcn)
        $element.off('click', toggleZoomFcn);
    });

    $scope.$watch(function() { return vm.email; }, function(email, old) {
      if (email && vm.urlEmail != email) {
        // Email has changed or doesn't match the current URL (this happens when using md-virtual-repeat)
        showGenericAvatar();
        if (Preferences.defaults.SOGoGravatarEnabled)
          getGravatar(email);
      }
      else if (!email)
        showGenericAvatar();
    });

    // If sg-src is defined, watch the expression for the URL of a local image
    if ('sg-src' in $element[0].attributes) {
      $scope.$watch(function() { return vm.src; }, function(src) {
        if (src) {
          // Set image URL and save the associated email address
          vm.url = src;
          vm.urlEmail = '' + vm.email;
          configureZoomableAvatar();
          hideGenericAvatar();
        }
      });
    }

    function getGravatar(email) {
      var url = Gravatar(email, vm.size, Preferences.defaults.SOGoAlternateAvatar);
      $http({
        method: 'GET',
        url: url,
        cache: true,
        headers: { Accept: 'image/*' }
      }).then(function successCallback() {
        if (!vm.url) {
          // Set image URL and save the associated email address
          vm.url = url;
          vm.urlEmail = email;
          hideGenericAvatar();
        }
      }, function errorCallback() {
        showGenericAvatar();
      });
    }

    function showGenericAvatar() {
      vm.url = null;
      vm.urlEmail = null;
      vm.img.addClass('ng-hide');
      vm.genericImg.removeClass('ng-hide');
    }

    function hideGenericAvatar() {
      vm.genericImg.addClass('ng-hide');
      vm.img.removeClass('ng-hide');
    }

    function configureZoomableAvatar() {
      $element.addClass('sg-avatar-image--zoomable');
      toggleZoomFcn = function() {
        $element.toggleClass('sg-avatar-image--zoom');
      };
      $element.on('click', toggleZoomFcn);
    }

  }

  angular
    .module('SOGo.Common')
    .directive('sgAvatarImage', sgAvatarImage)
    .controller('sgAvatarImageController', sgAvatarImageController);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /*
   * sgBlockToggle - expandable block, collapsed by default
   * @memberof SOGo.Common
   * @ngInject
   * @example:

   <sg-block-toggle>
     <md-list-item class="sg-button-toggle">
       <md-icon>warning</md-icon>
       <p flex>{{ message }}</p>
       <md-icon class="sg-icon-toggle">expand_more</md-icon>
     </md-list-item>
     <div class="sg-block-toggle">
       <!-- block's content -->
     </div>
  */
  sgBlockToggle.$inject = ['$mdUtil', '$animateCss', '$$rAF'];
  function sgBlockToggle($mdUtil, $animateCss, $$rAF) {
    return {
      link: link
    };

    function link($scope, $element) {
      var button = $element[0].querySelector('.sg-button-toggle'),
          icon = button.querySelector('.sg-icon-toggle'),
          icon_rotate_class = 'md-rotate-180-ccw',
          block = $element[0].querySelector('.sg-block-toggle'),
          isOpen = false;

      button.classList.add('md-clickable');
      angular.element(button).on('click', toggle);

      renderContent();

      function renderContent() {
        block.setAttribute('aria-hidden', !isOpen);
        block.setAttribute('aria-expanded', isOpen);
        if (!isOpen)
          block.style.visibility = 'hidden';
      }

      function toggle() {
        isOpen = !isOpen;
        if (isOpen)
          icon.classList.add(icon_rotate_class);
        else
          icon.classList.remove(icon_rotate_class);

        if (isOpen)
          block.style.visibility = 'visible';

        $$rAF(function() {
          var targetHeight = isOpen ? block.scrollHeight : 0;

          $animateCss(angular.element(block), {
            easing: 'cubic-bezier(0.35, 0, 0.25, 1)',
            to: { height: targetHeight + 'px' },
            duration: 0.75 // seconds
          }).start().then(function() {
            renderContent();
          });
        });
      }
    }
  }

  angular
    .module('SOGo.Common')
    .directive('sgBlockToggle', sgBlockToggle);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  angular
    .module('SOGo.Common')
    .directive('sgCheckmark', sgCheckmarkDirective);

  /*
   * sgCheckmark - A checkmark to be used in a mdMenuItem
   * @memberof SOGo.Common
   * @restrict element
   *
   * @example:

     <md-menu>
       <md-button class="md-icon-button" aria-label="Sort"
                  ng-click="$mdMenu.open()">
         <md-icon>sort</md-icon>
       </md-button>
       <md-menu-content>
         <md-menu-item>
           <sg-checkmark
               aria-label="Descending Order"
               ng-model="ctrl.asc"
               ng-click="ctrl.filter()"
               sg-true-value="0"
               sg-false-value="1">Descending Order</sg-checkmark>
         </md-menu-item>            
       </md-menu-content>
     </md-menu>
  */
  sgCheckmarkDirective.$inject = ['$parse', '$mdAria', '$mdTheming', '$mdUtil'];
  function sgCheckmarkDirective($parse, $mdAria, $mdTheming, $mdUtil) {
    var CHECKED_CSS = 'sg-checked';

    return {
      restrict: 'E',
      replace: true,
      transclude: true,
      require: '?ngModel',
      //priority: 210, // Run before ngAria
      template: [
        '<button class="md-button sg-checkmark" type="button">',
        '  <md-icon>check</md-icon>',
        '  <span ng-transclude></span',
        '</button>'
      ].join(''),
      compile: compile
    };

    function compile(tElement, tAttrs) {

      // Attach a click handler in compile in order to immediately stop propagation
      // (especially for ng-click) when the checkmark is disabled.
      tElement.on('click', function(event) {
        if (this.hasAttribute('disabled')) {
          event.stopImmediatePropagation();
        }
      });

      return function postLink(scope, element, attr, ngModelCtrl) {
        // See https://github.com/angular/angular.js/commit/c90cefe16142d973a123e945fc9058e8a874c357
        var trueValue = parseConstantExpr($parse, scope, 'sgTrueValue', attr.sgTrueValue, true),
            falseValue = parseConstantExpr($parse, scope, 'sgFalseValue', attr.sgFalseValue, false);
        
        ngModelCtrl = ngModelCtrl || $mdUtil.fakeNgModel();
        $mdTheming(element);

        $mdAria.expectWithText(element, 'aria-label');

        element.on('click', listener);

        ngModelCtrl.$render = render;

        function parseConstantExpr($parse, context, name, expression, fallback) {
          var parseFn;
          if (angular.isDefined(expression)) {
            parseFn = $parse(expression);
            if (!parseFn.constant) {
              throw Error('Expected constant expression for `' + name + '`, but saw `' + expression + '`.');
            }
            return parseFn(context);
          }
          return fallback;
        }

        function listener(ev) {
          if (element[0].hasAttribute('disabled')) {
            return;
          }

          scope.$apply(function() {
            // Toggle the checkmark value
            var viewValue = ngModelCtrl.$viewValue == trueValue? falseValue : trueValue;

            ngModelCtrl.$setViewValue( viewValue, ev && ev.type);
            ngModelCtrl.$render();
          });
        }

        function render() {
          if (ngModelCtrl.$viewValue == trueValue)
            element.addClass(CHECKED_CSS);
          else
            element.removeClass(CHECKED_CSS);
        }
      };
    }
  }
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /*
   * sgColorPicker - Color picker widget
   * @restrict element
   * @ngInject
   * @example:

     <sg-color-picker ng-model="properties.calendar.color"></sg-color-picker>
  */
  function sgColorPicker() {
    return {
      restrict: 'E',
      require: 'ngModel',
      template: [
        '  <md-button class="md-icon-button"',
        '             label:aria-label="Options"',
        '             ng-click="$ctrl.showPicker($event)">',
        '    <md-icon>format_color_fill</md-icon>',
        '  </md-button>'
      ].join(''),
      controller: sgColorPickerController,
      controllerAs: '$ctrl'
    };
  }

  /**
   * @ngInject
   */
  sgColorPickerController.$inject = ['$scope', '$element', '$mdPanel', 'sgColors'];
  function sgColorPickerController($scope, $element, $mdPanel, sgColors) {
    var $ctrl, ngModelController, color;

    this.$onInit = function() {
      $ctrl = this;
      ngModelController = $element.controller('ngModel');
    };

    this.$postLink = function() {
      this.buttonIcon = $element.find('md-icon');
      ngModelController.$render = function() {
        updateColor(ngModelController.$viewValue);
      };
    };

    function updateColor(newColor) {
      color = newColor;
      $ctrl.buttonIcon.css('color', color);
    }

    this.showPicker = function($event) {
      var panelPosition = $mdPanel.newPanelPosition()
          .relativeTo($ctrl.buttonIcon)
          .addPanelPosition(
            $mdPanel.xPosition.ALIGN_START,
            $mdPanel.yPosition.ALIGN_TOPS
          );

      var panelAnimation = $mdPanel.newPanelAnimation()
          .openFrom($ctrl.buttonIcon)
          .duration(100)
          .withAnimation($mdPanel.animation.FADE);

      // Build grid with 7 colors per row
      var columns = [];
      var column = '';
      for (var i = 0; i < sgColors.selection.length; i++) {
        var currentColor = sgColors.selection[i];
        var currentContrastColor = contrast(currentColor);
        var selected = (currentColor == color);
        if (i % 7 === 0) {
          if (column.length) columns.push(column);
          column = '';
        }
        column += '<span ';
        if (selected)
          column += 'class="selected" ';
        column += 'style="background-color: ' + currentColor + '" ng-click="$menuCtrl.setColor($event, \'' + currentColor + '\')">';
        if (selected)
          column += '<md-icon style="color: ' + currentContrastColor + '">check</md-icon>';
        column += '</span>';
      }

      var config = {
        attachTo: angular.element(document.body),
        bindToController: true,
        controller: MenuController,
        controllerAs: '$menuCtrl',
        position: panelPosition,
        animation: panelAnimation,
        targetEvent: $event,
        template: [
          '<div class="sg-color-picker-panel" md-whiteframe="3">',
          '  <div>' + columns.join('</div><div>') + '</div>',
          '</div>'
        ].join(''),
        trapFocus: true,
        clickOutsideToClose: true,
        escapeToClose: true,
        focusOnOpen: true
      };

      $mdPanel.open(config)
        .then(function(panelRef) {
          // Automatically close panel when clicking inside of it
          panelRef.panelEl.one('click', function() {
            panelRef.close();
          });
        });

      MenuController.$inject = ['mdPanelRef', '$state', '$mdDialog', 'User'];
      function MenuController(mdPanelRef, $state, $mdDialog, User) {
        var $menuCtrl = this;

        this.setColor = function(event, color) {
          if (event) {
            _.forEach(event.currentTarget.parentElement.children, function(tile) {
              tile.classList.remove('selected');
            });
            event.currentTarget.classList.add('selected');
          }
          // Update scope value and ng-model
          updateColor(color);
          ngModelController.$setViewValue(color);
        };
      }
    };
  }

  angular
    .module('SOGo.Common')
    .directive('sgColorPicker', sgColorPicker);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /*
   * sgCompile - Assign an expression to a DOM element and compile it.
   * @memberof SOGo.Common
   * @restrict attribute
   * @param {object} sgCompile - the expression to compile
   * @ngInject
   * @example:

   <div sg-compile="part.content"><!-- msg --></div>
  */
  sgCompile.$inject = ['$compile'];
  function sgCompile($compile) {
    return {
      restrict: 'A',
      link: sgCompileLink
    };

    function sgCompileLink(scope, element, attrs) {
      var ensureCompileRunsOnce = scope.$watch(
        function(scope) {
          // Watch the sg-compile expression for changes
          return scope.$eval(attrs.sgCompile);
        },
        function(value) {
          // When the sg-compile expression changes, assign it into the current DOM
          element.html(value);
          
          // Compile the new DOM and link it to the current scope.
          // NOTE: we only compile .childNodes so that we don't get into infinite loop compiling ourselves
          $compile(element.contents())(scope);
          
          // Use un-watch feature to ensure compilation happens only once.
          ensureCompileRunsOnce();
        }
      );
    }
  }

  angular
    .module('SOGo.Common')
    .directive('sgCompile', sgCompile);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * sgDatepickerReadonlyInput - A directive that disabled the input field of a datepicker.
   * @memberof SOGo.Common
   *
   * @example:

   <md-datepicker md-hide-icons="triangle"
                  md-open-on-focus="md-open-on-focus"
                  ng-model="selectedDate"
                  sg-datepicker-readonly-input>
  */
  function sgDatepickerReadonlyInput() {
    return {
      link: postLink,
      require: 'mdDatepicker',
      restrict: 'A'
    };

    function postLink(scope, element, attrs, datepickerCtrl) {
      function getInput() {
        return element.find('input').eq(0);
      }

      // We need to wait for the autocomplete directive to be compiled
      var listener = scope.$watch(getInput, function (input) {
        if (input.length) {
          listener(); // self release
          input.prop('disabled', true);
          input.parent().addClass('sg-datepicker-readonly-input-container');
        }
      });
    }
  }

  angular
    .module('SOGo.Common')
    .directive('sgDatepickerReadonlyInput', sgDatepickerReadonlyInput);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /*
   * sgDraggable - Make an element (usually a folder of elements) draggable.
   * @memberof SOGo.Common
   * @restrict attribute
   * @param {Object=} sgDraggable - the object to be exposed to the droppable target.
   * @param {expression} sgDragStart - dragging will only start if this expression returns true.
   * @param {expression} sgDragCount - the number of items being dragged; this number appears inside
   *        the sg-draggable-helper element that follows the mouse cursor.
   *
   * @example:

   <sg-draggable-helper>
     <md-icon>email</md-icon>
     <sg-draggable-helper-counter></sg-draggable-helper-counter>
   </sg-draggable-helper>

   <md-list sg-draggable="mailbox.service.selectedFolder"
            sg-drag-start="mailbox.selectedFolder.$selectedCount()"
            sg-drag-count="mailbox.selectedFolder.$selectedCount()">
  */
  sgDraggable.$inject = ['$parse', '$rootScope', '$document', '$timeout', '$log'];
  function sgDraggable($parse, $rootScope, $document, $timeout, $log) {
    return {
      restrict: 'A',
      link: link
    };

    function link(scope, element, attrs) {
      var o;
      
      $timeout(function() {
        var folder, dragStart, count;

        folder = $parse(attrs.sgDraggable)(scope);
        dragStart = attrs.sgDragStart? $parse(attrs.sgDragStart) : null;
        count = attrs.sgDragCount? $parse(attrs.sgDragCount) : null;
        o = new sgDraggableObject(element, folder, dragStart, count);
      });

      scope.$on('$destroy', function() {
        o.$destroy();
      });
      
      function sgDraggableObject($element, folder, dragStart, count) {
        this.$element = $element;
        this.folder = folder;
        this.dragStart = dragStart;
        this.count = count;
        this.helper = $document.find('sg-draggable-helper');

        if (!this.helper) {
          throw Error('sg-draggable requires a sg-draggable-helper element.');
        }

        this.bindedOnDragDetect = angular.bind(this, this.onDragDetect);
        this.bindedOnDrag = angular.bind(this, this.onDrag);

        // Register the mousedown event that can trigger the dragging action
        this.$element.on('mousedown', this.bindedOnDragDetect);
      }

      /**
       * sgDraggableObject is an object that wraps the logic to emit the folder:dragstart and
       * folder:dragend custom events.
       */
      sgDraggableObject.prototype = {

        dragHasStarted: false,

        $destroy: function() {
          this.$element.off('mousedown', this.bindedOnDragDetect);
        },

        getDistanceFromStart: function(event) {
          var delta = {
            x: this.startPosition.clientX - event.clientX,
            y: this.startPosition.clientY - event.clientY
          };

          return Math.sqrt(delta.x * delta.x + delta.y * delta.y);
        },


        // Start dragging on mousedown
        onDragDetect: function(ev) {
          ev.stopPropagation();

          if (!this.dragStart || this.dragStart(scope)) {
            // Listen to mousemove and start dragging when mouse has moved from at least 3 pixels
            $document.on('mousemove', this.bindedOnDrag);
            // Stop dragging on the next "mouseup"
            $document.one('mouseup', angular.bind(this, this.onDragEnd));
          }
        },

        // 
        onDrag: function(ev) {
          var counter;

          if (!this.startPosition) {
            this.startPosition = { clientX: ev.clientX, clientY: ev.clientY };
          }
          else if (!this.dragHasStarted && this.getDistanceFromStart(ev) > 10) {
            counter = this.helper.find('sg-draggable-helper-counter');
            this.dragHasStarted = true;

            this.helper.removeClass('ng-hide');
            if (this.count && this.count(scope) > 1)
              counter.text(this.count(scope)).removeClass('ng-hide');
            else
              counter.addClass('ng-hide');
            
            $log.debug('emit folder:dragstart');
            $rootScope.$emit('folder:dragstart', this.folder);
          }
          if (this.dragHasStarted) {
            if (ev.shiftKey || this.folder.isRemote)
              this.helper.addClass('sg-draggable-helper--copy');
            else
              this.helper.removeClass('sg-draggable-helper--copy');
            this.helper.css({ top: (ev.pageY + 5) + 'px', left: (ev.pageX + 5) + 'px' });
          }
        },


        onDragEnd: function(ev) {
          var action = 'move';

          this.startPosition = null;
          $document.off('mousemove', this.bindedOnDrag);

          if (this.dragHasStarted) {
            if (ev.shiftKey || this.folder.isRemote)
              action = 'copy';
            $log.debug('emit folder:dragend');
            $rootScope.$emit('folder:dragend', this.folder, action);
            this.dragHasStarted = false;
            this.helper.addClass('ng-hide');
          }
        }

      };

    }
  }

  angular
    .module('SOGo.Common')
    .directive('sgDraggable', sgDraggable);
})();

/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /*
   * sgDroppable - Make an element a possible destination while dragging
   * @memberof SOGo.Common
   * @restrict attribute
   * @param {expression} sgDroppable - dropping is accepted only if this expression returs true.
   *        One variables is exposed: dragFolder.
   * @param {expression} sgDrop - called when dropping ends on the element.
   *        Two variables are exposed: dragFolder and dragMode.
   *
   * @example:

   <md-list-item sg-droppable="folder.id != dragFolder.id"
                 sg-drop="app.dragSelectedMessages(dragFolder, folder, dragMode)">
  */
  sgDroppable.$inject = ['$parse', '$rootScope', '$document', '$timeout', '$log'];
  function sgDroppable($parse, $rootScope, $document, $timeout, $log) {
    return {
      restrict: 'A',
      link: link
    };

    function link(scope, element, attrs) {
      var overElement = false, dropAction, droppable,
          deregisterFolderDragStart, deregisterFolderDragEnd;

      if (!attrs.sgDrop) {
        throw Error('sg-droppable requires a sg-drop action.');
      }

      overElement = false;
      droppable = $parse(attrs.sgDroppable);
      dropAction = $parse(attrs.sgDrop);

      // Register listeners of custom events on root scope
      deregisterFolderDragStart = $rootScope.$on('folder:dragstart', function(event, folder) {
        if (droppable(scope, { dragFolder: folder })) {
          element.on('mouseenter', onEnter);
          element.on('mouseleave', onLeave);
        }
      });
      deregisterFolderDragEnd = $rootScope.$on('folder:dragend', function(event, folder, mode) {
        element.off('mouseenter');
        element.off('mouseleave');
        if (overElement) {
          angular.bind(element[0], onLeave)(event);
          dropAction(scope, { dragFolder: folder, dragMode: mode });
        }
      });

      scope.$on('destroy', function() {
        deregisterFolderDragStart();
        deregisterFolderDragEnd();
      });

      function onEnter(event) {
        overElement = true;
        element.addClass('sg-droppable-over');
      }

      function onLeave(event) {
        overElement = false;
        this.classList.remove('sg-droppable-over');
        element.off('mousemove');
      }
    }
  }

  angular
    .module('SOGo.Common')
    .directive('sgDroppable', sgDroppable);
})();

/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * sgEnter - A directive evaluated when the enter key is pressed
   * @memberof SOGo.Common
   * @ngInject
   * @example:

     <input type="text"
            sg-enter="save($index)" />
  */
  function sgEnter() {
    var ENTER_KEY = 13;
    return function(scope, element, attrs) {
      element.bind("keydown keypress", function(event) {
        if (event.which === ENTER_KEY) {
          scope.$apply(attrs.sgEnter);
          event.preventDefault();
        }
      });
    };
  }
  
  angular
    .module('SOGo.Common')
    .directive('sgEnter', sgEnter);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * sgEscape - A directive evaluated when the escape key is pressed
   * @memberof SOGo.Common
   * @ngInject
   * @example:

     <input type="text"
            sg-escape="revertEditing($index)" />
   */
  function sgEscape() {
    var ESCAPE_KEY = 27;
    return function(scope, elem, attrs) {
      elem.bind('keydown', function(event) {
        if (event.keyCode === ESCAPE_KEY) {
          scope.$apply(attrs.sgEscape);
        }
      });
    };
  }
    
  angular
    .module('SOGo.Common')
    .directive('sgEscape', sgEscape);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * sgFocusOn - A directive that sets the focus on its element when the specified string is broadcasted
   * @memberof SOGo.Common
   * @see {@link SOGo.Common.sgFocus}
   * @ngInject
   * @example:

     <input type="text"
            sg-focus-on="username" />
   */
  function sgFocusOn() {
    return function(scope, elem, attr) {
      scope.$on('sgFocusOn', function(e, name) {
        if (name === attr.sgFocusOn) {
          elem[0].focus();
          if (typeof elem[0].select == 'function')
            elem[0].select();
        }
      });
    };
  }

  angular
    .module('SOGo.Common')
    .directive('sgFocusOn', sgFocusOn);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /*
   * sgFolderStylesheet - Add CSS stylesheet for a folder's color (addressbook or calendar)
   * @memberof SOGo.Common
   * @restrict attribute
   * @param {object} ngModel - the object literal describing the folder (an Addressbook or Calendar instance)
   * @example:

    <sg-folder-stylesheet
         ng-repeat="calendar in calendars.list"
         ng-model="calendar" />
  */
  function sgFolderStylesheet() {
    return {
      restrict: 'E',
      require: 'ngModel',
      scope: {
        ngModel: '='
      },
      replace: true,
      bindToController: true,
      controller: sgFolderStylesheetController,
      controllerAs: 'cssCtrl',
      template: [
        '<style type="text/css">',
        /* Background color */
        '  .bg-folder{{ cssCtrl.ngModel.id }} {',
        '    background-color: {{ cssCtrl.ngModel.color }} !important;',
        '    color: {{ cssCtrl.contrast(cssCtrl.ngModel.color) }} !important;',
        '  }',
        '  .sg-event.bg-folder{{ cssCtrl.ngModel.id }} md-icon {',
        '    color: {{ cssCtrl.contrast(cssCtrl.ngModel.color) }} !important;',
        '  }',
        // Set the contrast color of toolbar icons except the one of the background
        '  md-toolbar.bg-folder{{ cssCtrl.ngModel.id }} md-icon:not(.sg-icon-toolbar-bg) {',
        '    color: {{ cssCtrl.contrast(cssCtrl.ngModel.color) }} !important;',
        '  }',
        // Set the contrast color of input labels
        '  .bg-folder{{ cssCtrl.ngModel.id }} label,',
        '  .bg-folder{{ cssCtrl.ngModel.id }} .md-input {',
        '    color: {{ cssCtrl.contrast(cssCtrl.ngModel.color) }} !important;',
        '    opacity: 0.8;',
        '  }',
        /* Foreground color */
        '  .fg-folder{{ cssCtrl.ngModel.id }},',
        '  .sg-event.fg-folder{{ cssCtrl.ngModel.id }} md-icon {',
        '    color: {{ cssCtrl.ngModel.color }} !important;',
        '  }',
        /* Border color */
        '  .bdr-folder{{ cssCtrl.ngModel.id }} {',
        '    border-color: {{ cssCtrl.ngModel.color }} !important;',
        '  }',
        '  .contrast-bdr-folder{{ cssCtrl.ngModel.id }} {',
        '    border-color: {{ cssCtrl.contrast(cssCtrl.ngModel.color) }} !important;',
        '  }',
        /* Checkbox color */
        '  .checkbox-folder{{ cssCtrl.ngModel.id }} .md-icon {',
        '    background-color: {{ cssCtrl.ngModel.color }} !important;',
        '  }',
        '  .checkbox-folder{{ cssCtrl.ngModel.id }}.md-checked .md-icon:after {',
        '    border-color: {{ cssCtrl.contrast(cssCtrl.ngModel.color) }} !important;',
        '  }',
        /* Switch color */
        '  .md-switch-folder{{ cssCtrl.ngModel.id }}.md-checked .md-thumb {',
        '    background-color: {{ cssCtrl.ngModel.color }} !important;',
        '  }',
        '  .md-switch-folder{{ cssCtrl.ngModel.id }}.md-checked .md-bar {',
        '    background-color: {{ cssCtrl.transparent(cssCtrl.ngModel.color, "0.5") }} !important;',
        '  }',
        '  .md-switch-folder{{ cssCtrl.ngModel.id }} .md-bar {',
        '    background-color: {{ cssCtrl.transparent(cssCtrl.ngModel.color, "0.3") }} !important;',
        '  }',
        '</style>'
      ].join('')
    };

    function sgFolderStylesheetController() {
      var vm = this;

      vm.contrast = contrast; // defined in Common/utils.js
      vm.transparent = function(hex, ratio) {
        var color = hexToRgb(hex);

        return ['rgba(' + color.r, color.g, color.b, ratio + ')'].join(',');
      };
    }
  }

  angular
    .module('SOGo.Common')
    .directive('sgFolderStylesheet', sgFolderStylesheet);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /*
   * sgLabels - Load the localizable strings of the specified framework.
   * @memberof SOGo.Common
   * @restrict attribute
   * @param {object} sgLabels - the framework name
   * @ngInject
   * @example:

  <md-dialog sg-labels="MailerUI"><!-- .. --></md-dialog>
  */
  sgLabels.$inject = ['sgSettings', 'Resource', '$window'];
  function sgLabels(Settings, Resource, $window) {
    return {
      restrict: 'A',
      link: sgLabelsLink
    };

    function sgLabelsLink(scope, element, attrs) {
      var framework = attrs.sgLabels;
      var resource = new Resource(Settings.activeUser('folderURL'), Settings.activeUser());
      if (!_.includes($window.labels._loadedFrameworks, framework)) {
        resource.post('labels', null, { framework: framework }).then(function(data) {
          var loadedFrameworks = $window.labels._loadedFrameworks;
          angular.extend($window.labels, data.labels);
          $window.labels._loadedFrameworks = _.concat($window.labels._loadedFrameworks, loadedFrameworks);
        });
      }
    }
  }

  angular
    .module('SOGo.Common')
    .directive('sgLabels', sgLabels);
})();
/* -*- Mode: js; indent-tabs-mode: nil; js-indent-level: 2 -*- */

(function() {
  'use strict';

  angular
    .module('SOGo.Common')
    .directive('sgNoDirtyCheck', sgNoDirtyCheck);

  /*
   * sgNoDirtyCheck - prevent input from affecting the form's pristine state.
   * @restrict attribute
  */
  function sgNoDirtyCheck() {
    return {
      restrict: 'A',
      require: 'ngModel',
      link: function (scope, elem, attrs, ngModelCtrl) {
        if (!ngModelCtrl) {
          return;
        }

        var clean = (ngModelCtrl.$pristine && !ngModelCtrl.$dirty);

        if (clean) {
          ngModelCtrl.$pristine = false;
          ngModelCtrl.$dirty = true;
        }
      }
    };
  }

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * sgPlaceholder - A directive for dynamic placeholder
   * @memberof SOGo.Common
   * @ngInject
   * @example:

     <input type="text"
            sg-placeholder="this_is_a_variable" />
  */
  function sgPlaceholder() {
    return {
      restrict: 'A',
      scope: {
        placeholder: '=sgPlaceholder'
      },
      link: function(scope, elem, attr) {
        scope.$watch('placeholder',function() {
          elem[0].placeholder = scope.placeholder;
        });
      }
    };
  }
  
  angular
    .module('SOGo.Common')
    .directive('sgPlaceholder', sgPlaceholder);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true, newcap: false */
  'use strict';

  /**
   * sgQrCode - Build a otpauth URI and generate a QR Code for the provided secret.
   * @see {@link https://davidshimjs.github.io/qrcodejs/|QRCode.js}
   * @memberof SOGo.Common
   * @example:
     <sg-qr-code text="secret"/>
  */
  sgQrCode.$inject = ['sgSettings'];
  function sgQrCode(Settings) {
    return {
      restrict: 'E',
      scope: {
        text: '@',
        width: '@',
        height: '@'
      },
      link: link
    };

    function link(scope, element, attrs) {
      var width = parseInt(scope.width) || 256,
          height = parseInt(scope.height) || width,
          // See https://github.com/google/google-authenticator/wiki/Key-Uri-Format
          uri = 'otpauth://totp/SOGo:' + Settings.activeUser('email') + '?secret=' + scope.text.replace(/=+$/, '') + '&issuer=SOGo';
      new QRCode(element[0], {
        text: uri,
        width: width,
        height: height
      });
    }
  }

  angular
    .module('SOGo.Common')
    .directive('sgQrCode', sgQrCode);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * sgResetOnDisabled - A directive to reset any error of a datepicker when marked
   *                     as disabled.
   * @memberof SOGo.Common
   * @ngInject
   * @example:

   <md-datepicker
     ng-model="myDate"
     ng-disabled="!myDateEnabled"
     sg-reset-on-disabled>
  */
  function sgResetOnDisabled() {
    return {
      link: postLink,
      require: 'mdDatepicker',
      restrict: 'A'
    };

    function postLink(scope, element, attrs, datepickerCtrl) {
      function getInput() {
        return element.find('input').eq(0);
      }

      // We need to wait for the datepicker directive to be compiled
      var listener = scope.$watch(getInput, function (input) {
        var ngModel;

        if (input.length) {
          listener(); // self release
          datepickerCtrl.$scope.$watch('ctrl.isDisabled', function(isDisabled) {
            if (isDisabled)
              if (datepickerCtrl.ngModelCtrl.$invalid)
                // Trigger the event that will reset the errors and the model value
                datepickerCtrl.$scope.$emit('md-calendar-change', datepickerCtrl.date);
          });
        }
      });
    }
  }

  angular
    .module('SOGo.Common')
    .directive('sgResetOnDisabled', sgResetOnDisabled);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  angular
    .module('SOGo.Common')
    .directive('sgRippleClick', sgRippleClick);

  /*
   * sgRippleClick - A ripple effect to cover the parent element.
   * @memberof SOGo.Common
   * @restrict attribute
   *
   * @example:

     <md-dialog id="mailEditor">
       <md-button ng-click="editor.send()"
                sg-ripple-click="mailEditor">Send</md-button>
     </md-dialog>

  */
  sgRippleClick.$inject = ['$log', '$timeout', '$rootScope'];
  function sgRippleClick($log, $timeout, scope) {
    
    function rippleEffect(element, coordinates, container, content) {
      // Show ripple
      angular.element(container).css({ 'overflow': 'hidden', 'position': 'relative' });
      angular.element(content).css({ top: container.scrollTop + 'px' });
      
      element.css({
        'top': (coordinates.top - container.offsetTop + container.scrollTop) + 'px',
        'left': (coordinates.left - container.offsetLeft) + 'px',
        'height': '400vmin',
        'width': '400vmin'
      });

      // Show ripple content
      content.classList.remove('ng-hide');
    }

    scope.$on('sgRippleDo', function (e, containerName) {
      const container = document.getElementById(containerName);
      container.classList.remove('ng-hide');
      rippleEffect(
            angular.element(document.querySelector('sg-ripple'))
            , { left: (window.innerWidth / 2), top: (window.innerHeight / 2) }
            , container
            , document.querySelector('sg-ripple-content')
      );
    });

    return {
      restrict: 'A',
      compile: compile
    };

    

    function compile(tElement, tAttrs) {

      return function postLink(scope, element, attr) {
        var ripple, content, container, containerId;

        // Lookup container element
        containerId = element.attr('sg-ripple-click');
        container = element[0].parentNode;
        while (container && container.id != containerId) {
          container = container.parentNode;
        }
        if (!container) {
          $log.error('No parent element found with id ' + containerId);
          return undefined;
        }

        // Lookup sg-ripple-content element
        content = container.querySelector('sg-ripple-content');
        if (!content) {
          $log.error('sg-ripple-content not found inside #' + containerId);
          return undefined;
        }

        // Lookup sg-ripple element
        ripple = container.querySelector('sg-ripple');
        if (ripple) {
          ripple = angular.element(ripple);
        }
        else {
          // If ripple layer doesn't exit, create it with the primary background color
          ripple = angular.element('<sg-ripple class="md-default-theme md-bg"></sg-ripple>');
          container.appendChild(ripple[0]);

          // Hide ripple content on initialization
          if (!content.classList.contains('ng-hide'))
            content.classList.add('ng-hide');
        }

        // Register listener
        element.on('click', listener);

        scope.$on('$destroy', function() {
          element.off('click', listener);
        });

        function listener(event) {
          var coordinates;

          if (element[0].hasAttribute('disabled')) {
            return;
          }

          if (event.pageX && event.pageY) {
            // Event is a mouse click
            coordinates = { left: event.pageX, top: event.pageY };
          }
          else {
            // Event is a form submit; target is the submit button
            coordinates = event.target.getBoundingClientRect();
          }

          if (content.classList.contains('ng-hide')) {
            $timeout(function() {
              // Wait until next digest for CSS animation to work
              rippleEffect(ripple, coordinates, container, content);
            });
          }
          else {
            // Hide ripple layer
            ripple.css({
              'top': (coordinates.top - container.offsetTop + container.scrollTop) + 'px',
	            'left': (coordinates.left - container.offsetLeft) + 'px',
              'height': '0px',
              'width': '0px'
            });
            // Hide ripple content
            content.classList.add('ng-hide');
            // Restore overflow of container once the animation is completed
            $timeout(function() {
              angular.element(container).css({ 'overflow': '', 'position': '' });
            }, 800);
          }
        }
      };
    }
  }
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /*
   * sgSearch - Search within a list of items
   * @memberof SOGo.Common
   * @restrict attribute
   * @param {function} sgSearch - the function to call when performing a search.
   *        Two variables are available: searchField and searchText.
   * @example:

   <div sg-search="mailbox.$filter({ sort: 'date', asc: false }, [{ searchBy: searchField, searchInput: searchText }])">
     <md-button class="sg-icon-button"
                sg-search-cancel="ctrl.cancelSearch()">
       <md-icon>arrow_back</md-icon>
     </md-button>
     <md-input-container>
       <input name="search" type="search"/>
     </md-input-container>
     <md-select multiple>
       <md-option value="subject">Subject</md-option>
       <md-option value="sender">sender</md-option>
     </md-select>
   </div>
  */
  sgSearchPreTransclude.$inject = ['$parse'];
  function sgSearchPreTransclude($parse) {
    return {
      restrict: 'A',
      controller: 'sgSearchController',
      controllerAs: '$sgSearchController',
      priority: 1001,
      compile: compile
    };

    function compile(tElement, tAttr) {
      var mdInputEl = tElement.find('md-input-container'),
          inputEl = tElement.find('input'),
          selectEl = tElement.find('md-select'),
          optionEl = tElement.find('md-option'),
          buttonEl = tElement.find('md-button');

      inputEl.attr('ng-model', '$sgSearchController.searchText');
      inputEl.attr('ng-model-options', '$sgSearchController.searchTextOptions');
      inputEl.attr('ng-change', '$sgSearchController.onChange()');
      if (selectEl) {
        selectEl.attr('ng-model', '$sgSearchController.searchField');
        selectEl.attr('ng-change', '$sgSearchController.onChange()');
      }
      if (buttonEl && buttonEl.attr('sg-search-cancel')) {
        buttonEl.attr('ng-click', buttonEl.attr('sg-search-cancel'));
        buttonEl.removeAttr('sg-search-cancel');
      }
      else {
        buttonEl = null;
      }

      return function postLink(scope, iElement, iAttr, controller) {
        var compiledButtonEl = iElement.find('button'), selectedOption;

        // Retrive the form and input names to check the form's validity in the controller
        controller.formName = iElement.attr('name');
        controller.inputName = inputEl.attr('name');

        // Associate the sg-allow-dot parameter (boolean) to the controller
        controller.allowDot = $parse(iElement.attr('sg-allow-dot'))(scope);

        // Associate the sg-search-fields parameter (array) to the controller
        controller.fields = $parse(iElement.attr('sg-search-fields'))(scope);

        // Associate callback to controller
        controller.doSearch = $parse(iElement.attr('sg-search'));

        // Initialize searchField model to first selected option
        selectedOption = _.find(optionEl, function (el) {
          return el.getAttribute('selected');
        });
        if (selectedOption) {
          controller.searchField = selectedOption.getAttribute('value');
        }

        // Reset the input field when cancelling the search
        if (buttonEl && compiledButtonEl) {
          compiledButtonEl.on('click', controller.cancelSearch);
        }
      };
    }
  }

  function sgSearch() {
    return {
      restrict: 'A',
      priority: 1000,
      transclude: true,
      compile: compile
    };

    function compile(tElement, tAttr) {
      return function postLink(scope, iElement, iAttr, controller, transclude) {
        transclude(function(clone) {
          iElement.append(clone);
        });
      };
    }
  }

  /**
   * @ngInject
   */
  sgSearchController.$inject = ['$window', '$scope', '$element'];
  function sgSearchController($window, $scope, $element) {
    var vm = this;

    // Controller variables
    vm.searchText = null;

    // Model options
    vm.searchTextOptions = {
      updateOn: 'default blur',
      debounce: {
        default: 300,
        blur: 0
      }
    };

    if ($element.attr('sg-search-fields')) {
      var waitforFieldsOnce = $scope.$watch(vm.fields, function(value) {
        // Select all fields by default
        vm.searchField = _.clone(vm.fields);
        waitforFieldsOnce();
      });
    }

    // Method to call on data changes
    this.onChange = function() {
      var form = $scope[this.formName],
          input = form[this.inputName],
          rawSearchText = input.$viewValue;

      if (this.allowDot && rawSearchText == '.' || form.$valid && rawSearchText) {
        if (rawSearchText == '.')
          // Ignore the minlength constraint when using the dot operator
          input.$setValidity('minlength', true);

        // doSearch is the compiled expression of the sg-search attribute
        this.doSearch($scope, { searchText: rawSearchText, searchField: this.searchField });
      }
    };

    // Reset input field when cancelling the search
    vm.cancelSearch = function() {
      vm.searchText = null;
    };
  }

  angular
    .module('SOGo.Common')
    .controller('sgSearchController', sgSearchController)
    .directive('sgSearch', sgSearchPreTransclude)
    .directive('sgSearch', sgSearch);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * sgSelectOnly - A directive that restricts an autocomplete field to its selectable values.
   * @memberof SOGo.Common
   * @ngInject
   * @example:

   <md-autocomplete
     md-items="timezone in timeZones"
     ng-required="true"
     sg-select-only>
  */
  function sgSelectOnly() {
    return {
      link: postLink,
      require: 'mdAutocomplete',
      restrict: 'A'
    };

    function postLink(scope, element, attrs, autoComplete) {
      function getInput() {
        return element.find('input').eq(0);
      }

      // We need to wait for the autocomplete directive to be compiled
      var listener = scope.$watch(getInput, function (input) {
        var ngModel;

        if (input.length) {
          listener(); // self release
          ngModel = input.controller('ngModel');
          input.on('blur', function () {
            if (!autoComplete.scope.selectedItem) {
              scope.$applyAsync(ngModel.$setValidity('required', false));
            }
          });
        }
      });
    }
  }

  angular
    .module('SOGo.Common')
    .directive('sgSelectOnly', sgSelectOnly);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /*
   * sgSubscribe - Common subscription widget
   * @restrict attribute
   * @param {string} sgSubscribe - the folder type
   * @param {function} sgSubscribeOnSelect - the function to call when subscribing to a folder.
   *        One variable is available: folderData.
   * @ngInject
   * @example:

     <md-button sg-subscribe="contact" sg-subscribe-on-select="subscribeToFolder">Subscribe ..</md-button>
  */
  sgSubscribe.$inject = ['User'];
  function sgSubscribe(User) {
    return {
      restrict: 'A',
      scope: {
        folderType: '@sgSubscribe',
        onFolderSelect: '&sgSubscribeOnSelect'
      },
      replace: false,
      bindToController: true,
      controller: sgSubscribeDialogController,
      controllerAs: '$sgSubscribeDialogController',
      link: link
    };
  }

  function link(scope, element, attrs, controller) {
    var inputEl = element.find('input');
    element.on('click', controller.showDialog);
  }

  /**
   * @ngInject
   */
  sgSubscribeDialogController.$inject = ['$mdDialog'];
  function sgSubscribeDialogController($mdDialog) {
    var vm = this;
    vm.showDialog = function() {
      $mdDialog.show({
        templateUrl: '../Contacts/UIxContactsUserFolders',
        clickOutsideToClose: true,
        locals: {
          folderType: vm.folderType,
          onFolderSelect: vm.onFolderSelect
        },
        controller: sgSubscribeController,
        controllerAs: 'subscribe'
      });
    };
  }

  /**
   * @ngInject
   */
  sgSubscribeController.$inject = ['$mdDialog', 'folderType', 'onFolderSelect', 'User'];
  function sgSubscribeController($mdDialog, folderType, onFolderSelect, User) {
    var vm = this;

    vm.selectedUser = null;
    vm.users = [];
    vm.folderType = folderType;

    vm.searchTextOptions = {
      updateOn: 'default blur',
      debounce: {
        default: 300,
        blur: 0
      }
    };

    vm.onChange = function(input) {
      User.$filter(vm.searchText, null, { results: vm.users }).then(function(users) {
        input.$setValidity('matches', users.length > 0);
        input.$setTouched();
        if (vm.selectedUser) {
          // If selected user is no longer part of the matching users, unselect it
          if (_.isUndefined(_.find(users, function(user) {
            return user.uid == vm.selectedUser.uid;
          }))) {
            vm.selectedUser = null;
          }
        }
      });
    };

    vm.selectUser = function(i) {
      if (vm.selectedUser == vm.users[i]) {
        vm.selectedUser = null;
      }
      else {
        // Fetch folders of specific type for selected user
        vm.users[i].$folders(folderType).then(function() {
          vm.selectedUser = vm.users[i];
        });
      }
    };

    // Callback upon subscription to a folder
    vm.selectFolder = function(folder) {
      onFolderSelect({folderData: folder});
    };

    vm.close = function() {
      User.$query = null;
      $mdDialog.hide();
    };
  }

  angular
    .module('SOGo.Common')
    .directive('sgSubscribe', sgSubscribe);
})();
(function() {
  'use strict';

  /**
   * This section is inspired from angular-material/src/components/datepicker/js/calendar.js
   */

  angular
    .module('SOGo.Common')
    .directive('sgTimePane', timePaneDirective);

  function timePaneDirective() {
    return {
      template: [
        '<div class="sg-time-pane">',
        '  <div class="hours-pane">',
        '    <div ng-repeat="hoursBigLine in hours" layout="row" layout-xs="column">',
        '      <div ng-repeat="hoursLine in hoursBigLine" layout="row" class="hours">',
        '          <md-button class="hourBtn sg-time-selection-indicator" id="{{hour.id}}"',
        '                     md-no-ink',
        '                     ng-repeat="hour in hoursLine"',
        '                     ng-click="hourClickHandler(hour.displayName)">{{hour.displayName}}</md-button>',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <div class="min5" ng-show="is5min()">',
        '    <div layout="row" layout-xs="column">',
        '      <div ng-repeat="minutesLine in min5" layout="row">',
        '        <md-button class="minuteBtn sg-time-selection-indicator" id="{{minute.id}}"',
        '                   md-no-ink',
        '                   ng-repeat="minute in minutesLine"',
        '                   ng-click="minuteClickHandler(minute.displayName)">{{minute.displayName}}</md-button>',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <div class="sg-time-scroll-mask" ng-hide="is5min()">',
        '    <div class="min1" layout="row" layout-xs="column" layout-wrap>',
        '      <div ng-repeat="minutesLine in min1" layout="row" layout-align="space-around center">',
        '        <md-button class="minuteBtn sg-time-selection-indicator" id="{{minute.id}}"',
        '                   md-no-ink',
        '                   ng-repeat="minute in minutesLine"',
        '                   ng-click="minuteClickHandler(minute.displayName)">{{minute.displayName}}</md-button>',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <div flex layout="row" layout-align="center center" md-colors="::{background: \'default-background-200\'}">',
        '    <md-button class="toggleBtn md-fab md-mini" ng-bind="getToggleBtnLbl()" ng-click="toggleManual5min()"></md-button>',
        '  </div>',
        '</div>'
      ].join(''),
      scope: {},
      require: ['ngModel', 'sgTimePane', '?^mdInputContainer'],
      controller: TimePaneCtrl,
      controllerAs: 'ctrl',
      bindToController: true,
      link: function(scope, element, attrs, controllers) {
        var ngModelCtrl = controllers[0];
        var sgTimePaneCtrl = controllers[1];

        var mdInputContainer = controllers[2];
        if (mdInputContainer) {
          throw Error('sg-timepicker should not be placed inside md-input-container.');
        }

        sgTimePaneCtrl.configureNgModel(ngModelCtrl, sgTimePaneCtrl);
      }
    };
  }

  /** Next identifier for calendar instance. */
  var nextUniqueId = 0;

  /**
   * Controller for the sgTimePane component.
   * @ngInject @constructor
   */
  TimePaneCtrl.$inject = ['$element', '$scope', '$$mdDateUtil', '$mdUtil',
                          '$mdConstant', '$mdTheming', '$$rAF', '$attrs', '$mdDateLocale'];
  function TimePaneCtrl($element, $scope, $$mdDateUtil, $mdUtil,
                        $mdConstant, $mdTheming, $$rAF, $attrs, $mdDateLocale) {

    var m;

    $mdTheming($element);

    /** @final {!angular.JQLite} */
    this.$element = $element;

    /** @final {!angular.Scope} */
    this.$scope = $scope;

    /** @final */
    this.dateUtil = $$mdDateUtil;

    /** @final */
    this.$mdUtil = $mdUtil;

    /** @final */
    this.keyCode = $mdConstant.KEY_CODE;

    /** @final */
    this.$$rAF = $$rAF;

    this.timePaneElement = $element[0].querySelector('.sg-time-pane');

    // this.$q = $q;

    /** @type {!angular.NgModelController} */
    this.ngModelCtrl = null;

    /** @type {String} Class applied to the selected hour or minute cell. */
    this.SELECTED_TIME_CLASS = 'sg-time-selected';

    /** @type {String} Class applied to the focused hour or minute cell. */
    this.FOCUSED_TIME_CLASS = 'md-focus';

    /** @final {number} Unique ID for this time pane instance. */
    this.id = nextUniqueId++;

    /**
     * The date that is currently focused or showing in the calendar. This will initially be set
     * to the ng-model value if set, otherwise to today. It will be updated as the user navigates
     * to other months. The cell corresponding to the displayDate does not necesarily always have
     * focus in the document (such as for cases when the user is scrolling the calendar).
     * @type {Date}
     */
    this.displayTime = null;

    /**
     * The selected date. Keep track of this separately from the ng-model value so that we
     * can know, when the ng-model value changes, what the previous value was before it's updated
     * in the component's UI.
     *
     * @type {Date}
     */
    this.selectedTime = null;

    /**
     * Used to toggle initialize the root element in the next digest.
     * @type {Boolean}
     */
    this.isInitialized = false;

    $scope.hours=[];
    $scope.hours[0]=[];
    $scope.hours[0][0]=[];
    $scope.hours[0][1]=[];
    $scope.hours[1]=[];
    $scope.hours[1][0]=[];
    $scope.hours[1][1]=[];
    for(var i=0; i<6; i++){
      $scope.hours[0][0][i] = {id:'tp-'+this.id+'-hour-'+i, displayName:i<10?"0"+i:""+i, selected:false};
      $scope.hours[0][1][i] = {id:'tp-'+this.id+'-hour-'+(i+6),displayName:(i+6)<10?"0"+(i+6):""+(i+6), selected:false};
      $scope.hours[1][0][i] = {id:'tp-'+this.id+'-hour-'+(i+12), displayName:""+(i+12), selected:false};
      $scope.hours[1][1][i] = {id:'tp-'+this.id+'-hour-'+(i+18), displayName:""+(i+18), selected:false};
    }

    $scope.min5=[];
    $scope.min5[0]=[];
    $scope.min5[1]=[];
    for(i=0; i<6; i++){
      m=i*5;
      $scope.min5[0][i] = {id:'tp-'+this.id+'-minute5-'+m, displayName:m<10?":0"+m:":"+m, selected:true};
      $scope.min5[1][i] = {id:'tp-'+this.id+'-minute5-'+(m+30), displayName:":"+(m+30), selected:false};
    }

    $scope.min1=[];
    for(i=0; i<12; i++){
      $scope.min1[i]=[];
      for(var ii=0; ii<5; ii++){
        m=i*5 + ii;
        $scope.min1[i][ii] = {id:'tp-'+this.id+'-minute-'+m, displayName:m<10?":0"+m:":"+m, selected:true};
      }
    }

    $scope.show5min = true;
    $scope.getToggleBtnLbl = function() {
      return ($scope.is5min()) ? '>>' : '<<';
    };
    $scope.toggleManual5min = function() {
      $scope.manual5min = !$scope.is5min();
    };
    $scope.is5min = function() {
      if ($scope.manual5min === true || $scope.manual5min === false) {
        return $scope.manual5min;
      }
      else {
        return $scope.show5min;
      }
    };

    // Unless the user specifies so, the calendar should not be a tab stop.
    // This is necessary because ngAria might add a tabindex to anything with an ng-model
    // (based on whether or not the user has turned that particular feature on/off).
    if (!$attrs.tabindex) {
      $element.attr('tabindex', '-1');
    }

    var self = this;

    this.hourClickHandler = function(displayVal) {
      var updated = new Date(self.displayTime);
      updated.setHours(Number(displayVal));
      self.setNgModelValue(updated, 'hours');
    };
    $scope.hourClickHandler = this.hourClickHandler;

    this.minuteClickHandler = function(displayVal) {
      // Remove leading ':'
      var val = displayVal.substr(1);
      var updated = new Date(self.displayTime);
      updated.setMinutes(Number(val));
      self.setNgModelValue(updated, 'minutes');
    };
    $scope.minuteClickHandler = this.minuteClickHandler;

    var boundKeyHandler = angular.bind(this, this.handleKeyEvent);

    // Bind the keydown handler to the body, in order to handle cases where the focused
    // element gets removed from the DOM and stops propagating click events.
    angular.element(document.body).on('keydown', boundKeyHandler);

    $scope.$on('$destroy', function() {
      angular.element(document.body).off('keydown', boundKeyHandler);
    });
  }

  /**
   * Sets up the controller's reference to ngModelController.
   * @param {!angular.NgModelController} ngModelCtrl
   */
  TimePaneCtrl.prototype.configureNgModel = function(ngModelCtrl, sgTimePaneCtrl) {
    var self = this;

    // self.displayTime = new Date(self.$viewValue);

    self.ngModelCtrl = ngModelCtrl;

    self.$mdUtil.nextTick(function() {
      self.isInitialized = true;
    });

    ngModelCtrl.$render = function() {
      var date = this.$viewValue;
      self.$mdUtil.nextTick(function() {
        self.changeSelectedTime(date, sgTimePaneCtrl);
      });
    };
  };

  /**
   * Change the selected date in the time (ngModel value has already been changed).
   */
  TimePaneCtrl.prototype.changeSelectedTime = function(date, sgTimePaneCtrl) {
    var self = this;
    var previousSelectedTime = this.selectedTime;

    this.selectedTime = date;
    this.displayTime = new Date(date);

    // Remove the selected class from the previously selected date, if any.
    if (previousSelectedTime) {
      var prevH = previousSelectedTime.getHours();
      var prevHCell = document.getElementById('tp-'+sgTimePaneCtrl.id+'-hour-'+prevH);
      if (prevHCell) {
        prevHCell.classList.remove(this.SELECTED_TIME_CLASS);
        prevHCell.setAttribute('aria-selected', 'false');
      }
      var prevM = previousSelectedTime.getMinutes();
      var prevMCell = document.getElementById('tp-'+sgTimePaneCtrl.id+'-minute-'+prevM);
      if (prevMCell) {
        prevMCell.classList.remove(this.SELECTED_TIME_CLASS);
        prevMCell.setAttribute('aria-selected', 'false');
      }
      var prevM5Cell = document.getElementById('tp-'+sgTimePaneCtrl.id+'-minute5-'+prevM);
      if (prevM5Cell) {
        prevM5Cell.classList.remove(this.SELECTED_TIME_CLASS);
        prevM5Cell.setAttribute('aria-selected', 'false');
      }
    }

    // Apply the select class to the new selected date if it is set.
    if (date) {
      var newH = date.getHours();
      var mCell, hCell = document.getElementById('tp-'+sgTimePaneCtrl.id+'-hour-'+newH);
      if (hCell) {
        hCell.classList.add(this.SELECTED_TIME_CLASS);
        hCell.setAttribute('aria-selected', 'true');
      }
      var newM = date.getMinutes();
      if (newM % 5 === 0) {
        sgTimePaneCtrl.$scope.show5min = true;
        mCell = document.getElementById('tp-'+sgTimePaneCtrl.id+'-minute5-'+newM);
        if (mCell) {
          mCell.classList.add(this.SELECTED_TIME_CLASS);
          mCell.setAttribute('aria-selected', 'true');
        }
      }
      else {
        sgTimePaneCtrl.$scope.show5min = false;
      }
      mCell = document.getElementById('tp-'+sgTimePaneCtrl.id+'-minute-'+newM);
      if (mCell) {
        mCell.classList.add(this.SELECTED_TIME_CLASS);
        mCell.setAttribute('aria-selected', 'true');
      }
    }
  };

  /**
   * Sets the ng-model value for the time pane and emits a change event.
   * @param {Date} date
   */
  TimePaneCtrl.prototype.setNgModelValue = function(date, mode) {
    this.$scope.$emit('sg-time-pane-change', { date: date, changed: mode });
    this.ngModelCtrl.$setViewValue(date);
    this.ngModelCtrl.$render();
    return date;
  };


  /*** User input handling ***/

  /**
   * Handles a key event in the calendar with the appropriate action. The action will either
   * be to select the focused date or to navigate to focus a new date.
   * @param {KeyboardEvent} event
   */
  TimePaneCtrl.prototype.handleKeyEvent = function(event) {
    var self = this;
    this.$scope.$apply(function() {
      // Capture escape and emit back up so that a wrapping component
      // (such as a time-picker) can decide to close.
      if (event.which == self.keyCode.ESCAPE || event.which == self.keyCode.TAB) {
        self.$scope.$emit('md-time-pane-close');

        if (event.which == self.keyCode.TAB) {
          event.preventDefault();
        }

        return;
      }

      // Remaining key events fall into two categories: selection and navigation.
      // Start by checking if this is a selection event.
      if (event.which === self.keyCode.ENTER) {
        self.setNgModelValue(self.displayTime, 'enter');
        event.preventDefault();
        return;
      }

      // Selection isn't occuring, so the key event is either navigation or nothing.
      /*var date = self.getFocusDateFromKeyEvent(event);
        if (date) {
        event.preventDefault();
        event.stopPropagation();

        // Since this is a keyboard interaction, actually give the newly focused date keyboard
        // focus after the been brought into view.
        self.changeDisplayTime(date).then(function () {
        self.focus(date);
        });
        }*/
    });
  };

  /**
   * Focus the cell corresponding to the given date.
   * @param {Date=} opt_date The date to be focused.
   */
  TimePaneCtrl.prototype.focus = function(opt_date, sgTimePaneCtrl) {
    var date = opt_date || this.selectedTime || this.today;

    var previousFocus = this.timePaneElement.querySelector('.md-focus');
    if (previousFocus) {
      previousFocus.classList.remove(this.FOCUSED_TIME_CLASS);
    }

    if (date) {
      var newH = date.getHours();
      var hCell = document.getElementById('tp-'+sgTimePaneCtrl.id+'-hour-'+newH);
      if (hCell) {
        hCell.classList.add(this.FOCUSED_TIME_CLASS);
        hCell.focus();
      }
    }
  };
})();

(function() {
  'use strict';

  /**
   * This section is inspired from angular-material/src/components/datepicker/js/datepickerDirective.js
   */

  angular.module('SOGo.Common')
    .directive('sgTimepicker', timePickerDirective);

  /**
   * @ngdoc directive
   * @name mdTimepicker
   * @module material.components.timepicker
   *
   * @param {Date} ng-model The component's model. Expects a JavaScript Date object.
   * @param {expression=} ng-change Expression evaluated when the model value changes.
   * @param {String=} md-placeholder The time input placeholder value.
   * @param {boolean=} ng-disabled Whether the timepicker is disabled.
   * @param {boolean=} ng-required Whether a value is required for the timepicker.
   *
   * @description
   * `<sg-timepicker>` is a component used to select a single time.
   * For information on how to configure internationalization for the time picker,
   * see `$mdTimeLocaleProvider`.
   *
   * @usage
   * <hljs lang="html">
   *   <sg-timepicker ng-model="birthday"></sg-timepicker>
   * </hljs>
   *
   */

  timePickerDirective.$inject = ['$mdUtil', '$mdAria', 'inputDirective'];
  function timePickerDirective($mdUtil, $mdAria, inputDirective) {
    return {
      template: function(tElement, tAttrs) {
        // Buttons are not in the tab order because users can open the hours pane via keyboard
        // interaction on the text input, and multiple tab stops for one component (picker)
        // may be confusing.
        var ariaLabelValue = tAttrs.ariaLabel || tAttrs.mdPlaceholder;

        return [
          '<md-button class="sg-timepicker-button md-icon-button" type="button" ',
          '           tabindex="-1" aria-hidden="true" ',
          '           ng-click="ctrl.openTimePane($event)">',
          '  <md-icon class="sg-timepicker-icon">access_time</md-icon>',
          '</md-button>',
          '<div class="md-default-theme sg-timepicker-input-container" ',
          '     ng-class="{\'sg-timepicker-focused\': ctrl.isFocused}">',
          '  <input class="sg-timepicker-input" ',
          (ariaLabelValue ? 'aria-label="' + ariaLabelValue + '" ' : ''),
          '         aria-haspopup="true"',
          '         aria-expanded="{{ctrl.isTimeOpen}}" ',
          '         aria-owns="{{::ctrl.timePaneId}}"',
          '         ng-focus="ctrl.setFocused(true)" ng-blur="ctrl.setFocused(false)">',
          '  <md-button type="button" md-no-ink ',
          '             class="sg-timepicker-triangle-button md-icon-button" ',
          '             ng-click="ctrl.openTimePane($event)" ',
          '             aria-label="{{::ctrl.dateLocale.msgOpenCalendar}}">',
          '    <div class="sg-timepicker-expand-triangle"></div>',
          '  </md-button>',
          '</div>',
          // This pane will be detached from here and re-attached to the document body.
          '<div class="sg-timepicker-time-pane md-whiteframe-z1" id="{{::ctrl.timePaneId}}">',
          '  <div class="sg-timepicker-input-mask">',
          '    <div class="sg-timepicker-input-mask-opaque"></div>',
          // '                md-colors="::{\'box-shadow\': \'default-background-hue-1\'}"></div>', // using mdColors
          '  </div>',
          '  <div class="sg-timepicker-time">',
          '    <sg-time-pane role="dialog" aria-label="{{::ctrl.dateLocale.msgCalendar}}" ',
          '                  ng-model="ctrl.time" ng-if="ctrl.isTimeOpen"></sg-time-pane>',
          '  </div>',
          '</div>'
        ].join('');
      },
      require: ['ngModel', 'sgTimepicker', '?^mdInputContainer', '?^form'],
      scope: {
        placeholder: '@mdPlaceholder'
      },
      controller: TimePickerCtrl,
      controllerAs: 'ctrl',
      bindToController: true,
      link: function(scope, element, attr, controllers) {
        var ngModelCtrl = controllers[0];
        var sgTimePickerCtrl = controllers[1];
        var mdInputContainer = controllers[2];
        var parentForm = controllers[3];
        var mdNoAsterisk = $mdUtil.parseAttributeBoolean(attr.mdNoAsterisk);

        sgTimePickerCtrl.configureNgModel(ngModelCtrl, mdInputContainer, inputDirective);

        if (mdInputContainer) {
          var spacer = element[0].querySelector('.md-errors-spacer');

          if (spacer) {
            element.after(angular.element('<div>').append(spacer));
          }

          mdInputContainer.setHasPlaceholder(attr.mdPlaceholder);
          mdInputContainer.input = element;
          mdInputContainer.element
            .addClass(INPUT_CONTAINER_CLASS)
            .toggleClass(HAS_TIME_ICON_CLASS, attr.mdHideIcons !== 'time' && attr.mdHideIcons !== 'all');

          if (!mdInputContainer.label) {
            $mdAria.expect(element, 'aria-label', attr.mdPlaceholder);
          } else if (!mdNoAsterisk) {
            attr.$observe('required', function(value) {
              mdInputContainer.label.toggleClass('md-required', !!value);
            });
          }

          scope.$watch(mdInputContainer.isErrorGetter || function() {
            return ngModelCtrl.$invalid && (ngModelCtrl.$touched || (parentForm && parentForm.$submitted));
          }, mdInputContainer.setInvalid);
        } else if (parentForm) {
          // If invalid, highlights the input when the parent form is submitted.
          var parentSubmittedWatcher = scope.$watch(function() {
            return parentForm.$submitted;
          }, function(isSubmitted) {
            if (isSubmitted) {
              sgTimePickerCtrl.updateErrorState();
              parentSubmittedWatcher();
            }
          });
        }
      }
    };
  }

  /** Additional offset for the input's `size` attribute, which is updated based on its content. */
  var EXTRA_INPUT_SIZE = 3;

  /** Class applied to the container if the date is invalid. */
  var INVALID_CLASS = 'sg-timepicker-invalid';

  /** Class applied to the timepicker when it's open. */
  var OPEN_CLASS = 'sg-timepicker-open';

  /** Class applied to the md-input-container, if a timepicker is placed inside it */
  var INPUT_CONTAINER_CLASS = '_sg-timepicker-floating-label';

  /** Class to be applied when the time icon is enabled. */
  var HAS_TIME_ICON_CLASS = '_sg-timepicker-has-calendar-icon';

  /** Default time in ms to debounce input event by. */
  var DEFAULT_DEBOUNCE_INTERVAL = 500;

  /**
   * Height of the calendar pane used to check if the pane is going outside the boundary of
   * the viewport. See calendar.scss for how $md-calendar-height is computed; an extra 20px is
   * also added to space the pane away from the exact edge of the screen.
   *
   *  This is computed statically now, but can be changed to be measured if the circumstances
   *  of calendar sizing are changed.
   */
  var TIME_PANE_HEIGHT = { MIN5: { GTXS: 172 + 20, XS: 291 + 20 },
                           MIN1: { GTXS: 364 + 20, XS: 454 + 20 } };

  /**
   * Width of the calendar pane used to check if the pane is going outside the boundary of
   * the viewport. See calendar.scss for how $md-calendar-width is computed; an extra 20px is
   * also added to space the pane away from the exact edge of the screen.
   *
   *  This is computed statically now, but can be changed to be measured if the circumstances
   *  of calendar sizing are changed.
   */
  var TIME_PANE_WIDTH = { GTXS: 510 + 20, XS: 274 + 20 };

  /** Used for checking whether the current user agent is on iOS or Android. */
  var IS_MOBILE_REGEX = /ipad|iphone|ipod|android/i;

  /**
   * Controller for sg-timepicker.
   *
   * ngInject @constructor
   */
  TimePickerCtrl.$inject = ['$scope', '$element', '$attrs', '$window', '$mdConstant',
                            '$mdTheming', '$mdUtil', '$mdDateLocale', '$$mdDateUtil', '$$rAF',
                            '$mdMedia'];
  function TimePickerCtrl($scope, $element, $attrs, $window, $mdConstant,
                          $mdTheming, $mdUtil, $mdDateLocale, $$mdDateUtil, $$rAF,
                          $mdMedia) {
    /** @final */
    this.$window = $window;

    /** @final */
    this.dateLocale = $mdDateLocale;

    /** @final */
    this.dateUtil = $$mdDateUtil;

    /** @final */
    this.$mdConstant = $mdConstant;

    /* @final */
    this.$mdUtil = $mdUtil;

    /** @final */
    this.$$rAF = $$rAF;

    /** @final */
    this.$mdMedia = $mdMedia;

    /**
     * The root document element. This is used for attaching a top-level click handler to
     * close the calendar panel when a click outside said panel occurs. We use `documentElement`
     * instead of body because, when scrolling is disabled, some browsers consider the body element
     * to be completely off the screen and propagate events directly to the html element.
     * @type {!angular.JQLite}
     */
    this.documentElement = angular.element(document.documentElement);

    /** @type {!angular.NgModelController} */
    this.ngModelCtrl = null;

    /** @type {HTMLInputElement} */
    this.inputElement = $element[0].querySelector('input');

    /** @final {!angular.JQLite} */
    this.ngInputElement = angular.element(this.inputElement);

    /** @type {HTMLElement} */
    this.inputContainer = $element[0].querySelector('.sg-timepicker-input-container');

    /** @type {HTMLElement} Floating time pane. */
    this.timePane = $element[0].querySelector('.sg-timepicker-time-pane');

    /** @type {HTMLElement} Time icon button. */
    this.timeButton = $element[0].querySelector('.sg-timepicker-button');

    /**
     * Element covering everything but the input in the top of the floating calendar pane.
     * @type {HTMLElement}
     */
    this.inputMask = angular.element($element[0].querySelector('.sg-timepicker-input-mask-opaque'));

    /** @final {!angular.JQLite} */
    this.$element = $element;

    /** @final {!angular.Attributes} */
    this.$attrs = $attrs;

    /** @final {!angular.Scope} */
    this.$scope = $scope;

    /** @type {Date} */
    this.time = null;

    /** @type {boolean} */
    this.isFocused = false;

    /** @type {boolean} */
    this.isDisabled = false;
    this.setDisabled($element[0].disabled || angular.isString($attrs.disabled));

    /** @type {boolean} Whether the date-picker's calendar pane is open. */
    this.isTimeOpen = false;

    /** @type {boolean} Whether the calendar should open when the input is focused. */
    // this.openOnFocus = $attrs.hasOwnProperty('mdOpenOnFocus');

    /** @final */
    // this.mdInputContainer = null;

    /**
     * Element from which the calendar pane was opened. Keep track of this so that we can return
     * focus to it when the pane is closed.
     * @type {HTMLElement}
     */
    this.timePaneOpenedFrom = null;

    /** @type {String} Unique id for the time pane. */
    this.timePaneId = 'sg-time-pane' + $mdUtil.nextUid();

    /** Pre-bound click handler is saved so that the event listener can be removed. */
    this.bodyClickHandler = angular.bind(this, this.handleBodyClick);

    /**
     * Name of the event that will trigger a close. Necessary to sniff the browser, because
     * the resize event doesn't make sense on mobile and can have a negative impact since it
     * triggers whenever the browser zooms in on a focused input.
     */
    this.windowEventName = IS_MOBILE_REGEX.test(
      navigator.userAgent || navigator.vendor || window.opera
    ) ? 'orientationchange' : 'resize';

    /** Pre-bound close handler so that the event listener can be removed. */
    this.windowEventHandler = $mdUtil.debounce(angular.bind(this, this.closeTimePane), 100);

    /** Pre-bound handler for the window blur event. Allows for it to be removed later. */
    this.windowBlurHandler = angular.bind(this, this.handleWindowBlur);

    /** @type {Number} Extra margin for the left side of the floating calendar pane. */
    this.leftMargin = 20;

    /** @type {Number} Extra margin for the top of the floating calendar. Gets determined on the first open. */
    this.topMargin = null;

    // Unless the user specifies so, the timepicker should not be a tab stop.
    // This is necessary because ngAria might add a tabindex to anything with an ng-model
    // (based on whether or not the user has turned that particular feature on/off).
    if ($attrs.tabindex) {
      this.ngInputElement.attr('tabindex', $attrs.tabindex);
      $attrs.$set('tabindex', null);
    } else {
      $attrs.$set('tabindex', '-1');
    }

    $mdTheming($element);
    $mdTheming(angular.element(this.timePane));

    var self = this;

    $scope.$on('$destroy', function() {
      self.detachTimePane();
    });

    if ($attrs.mdIsOpen) {
      $scope.$watch('ctrl.isOpen', function(shouldBeOpen) {
        if (shouldBeOpen) {
          self.openTimePane({
            target: self.inputElement
          });
        } else {
          self.closeTimePane();
        }
      });
    }

  }

  /**
   * AngularJS Lifecycle hook for newer AngularJS versions.
   * Bindings are not guaranteed to have been assigned in the controller, but they are in the $onInit hook.
   */
  TimePickerCtrl.prototype.$onInit = function() {
    this.installPropertyInterceptors();
    this.attachChangeListeners();
    this.attachInteractionListeners();
  };

  /**
   * Sets up the controller's reference to ngModelController.
   * @param {!angular.NgModelController} ngModelCtrl Instance of the ngModel controller.
   */
  TimePickerCtrl.prototype.configureNgModel = function(ngModelCtrl, mdInputContainer, inputDirective) {
    this.ngModelCtrl = ngModelCtrl;
    this.mdInputContainer = mdInputContainer;

    // The input needs to be [type="date"] in order to be picked up by AngularJS.
    this.$attrs.$set('type', 'date');

    // Invoke the `input` directive link function, adding a stub for the element.
    // This allows us to re-use AngularJS's logic for setting the timezone via ng-model-options.
    // It works by calling the link function directly which then adds the proper `$parsers` and
    // `$formatters` to the ngModel controller.
    // inputDirective[0].link.pre(this.$scope, {
    //   on: angular.noop,
    //   val: angular.noop,
    //   0: {}
    // }, this.$attrs, [ngModelCtrl]);

    var self = this;

    // Responds to external changes to the model value.
    self.ngModelCtrl.$formatters.push(function(value) {
      if (value && !(value instanceof Date)) {
        throw Error('The ng-model for sg-timepicker must be a Date instance. ' +
                    'Currently the model is a: ' + (typeof value));
      }

      self.onExternalChange(value);

      return value;
    });

    // Responds to external error state changes (e.g. ng-required based on another input).
    ngModelCtrl.$viewChangeListeners.unshift(angular.bind(this, this.updateErrorState));

    // Forwards any events from the input to the root element. This is necessary to get `updateOn`
    // working for events that don't bubble (e.g. 'blur') since AngularJS binds the handlers to
    // the `<md-datepicker>`.
    var updateOn = self.$mdUtil.getModelOption(ngModelCtrl, 'updateOn');

    if (updateOn) {
      this.ngInputElement.on(
        updateOn,
        angular.bind(this.$element, this.$element.triggerHandler, updateOn)
      );
    }
  };

  /**
   * Attach event listeners for both the text input and the md-time.
   * Events are used instead of ng-model so that updates don't infinitely update the other
   * on a change. This should also be more performant than using a $watch.
   */
  TimePickerCtrl.prototype.attachChangeListeners = function() {
    var self = this;

    self.$scope.$on('sg-time-pane-change', function(event, data) {
      var time = new Date(data.date);
      self.setModelValue(time);
      self.onExternalChange(time);
      if (data.changed == 'minutes') {
        self.closeTimePane();
      }
    });

    self.ngInputElement.on('input', angular.bind(self, self.resizeInputElement));

    var debounceInterval = angular.isDefined(this.debounceInterval) ?
        this.debounceInterval : DEFAULT_DEBOUNCE_INTERVAL;
    self.ngInputElement.on('input', self.$mdUtil.debounce(self.handleInputEvent,
                                                          debounceInterval, self));
  };

  /** Attach event listeners for user interaction. */
  TimePickerCtrl.prototype.attachInteractionListeners = function() {
    var self = this;
    var $scope = this.$scope;
    var keyCodes = this.$mdConstant.KEY_CODE;

    // Add event listener through angular so that we can triggerHandler in unit tests.
    self.ngInputElement.on('keydown', function(event) {
      if (event.altKey && event.keyCode == keyCodes.DOWN_ARROW) {
        self.openTimePane(event);
        $scope.$digest();
      }
    });

    $scope.$on('md-time-close', function() {
      self.closeTimePane();
    });
  };

  /**
   * Capture properties set to the time-picker and imperitively handle internal changes.
   * This is done to avoid setting up additional $watches.
   */
  TimePickerCtrl.prototype.installPropertyInterceptors = function() {
    var self = this;

    if (this.$attrs.ngDisabled) {
      // The expression is to be evaluated against the directive element's scope and not
      // the directive's isolate scope.
      var scope = this.$scope.$parent;

      if (scope) {
        scope.$watch(this.$attrs.ngDisabled, function(isDisabled) {
          self.setDisabled(isDisabled);
        });
      }
    }

    Object.defineProperty(this, 'placeholder', {
      get: function() { return self.inputElement.placeholder; },
      set: function(value) { self.inputElement.placeholder = value || ''; }
    });
  };

  /**
   * Sets whether the date-picker is disabled.
   * @param {boolean} isDisabled
   */
  TimePickerCtrl.prototype.setDisabled = function(isDisabled) {
    this.isDisabled = isDisabled;
    this.inputElement.disabled = isDisabled;

    if (this.timeButton) {
      this.timeButton.disabled = isDisabled;
    }
  };

  /**
   * Sets the custom ngModel.$error flags to be consumed by ngMessages. Flags are:
   *   - mindate: whether the selected date is before the minimum date.
   *   - maxdate: whether the selected flag is after the maximum date.
   *   - filtered: whether the selected date is allowed by the custom filtering function.
   *   - valid: whether the entered text input is a valid date
   *
   * The 'required' flag is handled automatically by ngModel.
   *
   * @param {Date=} opt_date Date to check. If not given, defaults to the datepicker's model value.
   */
  TimePickerCtrl.prototype.updateErrorState = function(opt_date) {
    var date = opt_date || this.time;

    // Clear any existing errors to get rid of anything that's no longer relevant.
    this.clearErrorState();

    if (!this.dateUtil.isValidDate(date)) {
      // The date is seen as "not a valid date" if there is *something* set
      // (i.e.., not null or undefined), but that something isn't a valid date.
      this.ngModelCtrl.$setValidity('valid', date === null);
    }

    var input = this.inputElement.value;
    var parsedTime = this.dateLocale.parseTime(input);

    if (!this.isInputValid(input, parsedTime) && this.ngModelCtrl.$valid) {
      this.ngModelCtrl.$setValidity('valid', date == null);
    }

    angular.element(this.inputContainer).toggleClass(INVALID_CLASS, !this.ngModelCtrl.$valid);
  };

  /**
   * Check to see if the input is valid, as the validation should fail if the model is invalid.
   *
   * @param {string} inputString
   * @param {Date} parsedDate
   * @return {boolean} Whether the input is valid
   */
  TimePickerCtrl.prototype.isInputValid = function (inputString, parsedTime) {
    return inputString === '' || this.dateUtil.isValidDate(parsedTime);
  };

  /** Clears any error flags set by `updateErrorState`. */
  TimePickerCtrl.prototype.clearErrorState = function() {
    this.inputContainer.classList.remove(INVALID_CLASS);
    ['valid'].forEach(function(field) {
      this.ngModelCtrl.$setValidity(field, true);
    }, this);
  };

  /**
   * Resizes the input element based on the size of its content.
   */
  TimePickerCtrl.prototype.resizeInputElement = function() {
    this.inputElement.size = this.inputElement.value.length + EXTRA_INPUT_SIZE;
  };

  /**
   * Sets the model value if the user input is a valid time.
   * Adds an invalid class to the input element if not.
   */
  TimePickerCtrl.prototype.handleInputEvent = function(self) {
    var inputString = this.inputElement.value;
    var parsedTime = inputString ? this.dateLocale.parseTime(inputString) : null;

    // An input string is valid if it is either empty (representing no date)
    // or if it parses to a valid time that the user is allowed to select.
    var isValidInput = this.isInputValid(inputString, parsedTime);

    // The datepicker's model is only updated when there is a valid input.
    if (isValidInput) {
      var updated = new Date(this.time);
      if (parsedTime) {
        updated.setHours(parsedTime.getHours());
        updated.setMinutes(parsedTime.getMinutes());
      } else {
        updated = null;
      }
      this.setModelValue(updated);
      this.time = updated;
    }

    this.updateErrorState(parsedTime);
  };

  /** Position and attach the floating calendar to the document. */
  TimePickerCtrl.prototype.attachTimePane = function() {
    var timePane = this.timePane;
    var body = document.body;

    timePane.style.transform = '';
    this.$element.addClass(OPEN_CLASS);
    // this.mdInputContainer && this.mdInputContainer.element.addClass(OPEN_CLASS);
    angular.element(body).addClass('md-datepicker-is-showing');

    var elementRect = this.inputContainer.getBoundingClientRect();
    var bodyRect = body.getBoundingClientRect();

    if (!this.topMargin || this.topMargin < 0) {
      this.topMargin = (this.inputMask.parent().prop('clientHeight') - this.ngInputElement.prop('clientHeight')) / 2;
    }

    // Check to see if the calendar pane would go off the screen. If so, adjust position
    // accordingly to keep it within the viewport.
    var paneTop = elementRect.top - bodyRect.top - this.topMargin;
    var paneLeft = elementRect.left - bodyRect.left - this.leftMargin;

    // If ng-material has disabled body scrolling (for example, if a dialog is open),
    // then it's possible that the already-scrolled body has a negative top/left. In this case,
    // we want to treat the "real" top as (0 - bodyRect.top). In a normal scrolling situation,
    // though, the top of the viewport should just be the body's scroll position.
    var viewportTop = (bodyRect.top < 0 && body.scrollTop === 0) ?
        -bodyRect.top :
        document.body.scrollTop;

    var viewportLeft = (bodyRect.left < 0 && body.scrollLeft === 0) ?
        -bodyRect.left :
        document.body.scrollLeft;

    var viewportBottom = viewportTop + this.$window.innerHeight;
    var viewportRight = viewportLeft + this.$window.innerWidth;

    // Creates an overlay with a hole the same size as element. We remove a pixel or two
    // on each end to make it overlap slightly. The overlay's background is added in
    // the theme in the form of a box-shadow with a huge spread.
    this.inputMask.css({
      position: 'absolute',
      left: this.leftMargin + 'px',
      top: this.topMargin + 'px',
      width: (elementRect.width - 1) + 'px',
      height: (elementRect.height - 2) + 'px'
    });

    // If the right edge of the pane would be off the screen and shifting it left by the
    // difference would not go past the left edge of the screen. If the time pane is too
    // big to fit on the screen at all, move it to the left of the screen and scale the entire
    // element down to fit.
    var paneWidth = this.$mdMedia('xs')? TIME_PANE_WIDTH.XS : TIME_PANE_WIDTH.GTXS;
    if (paneLeft + paneWidth > viewportRight) {
      if (viewportRight - paneWidth > 0) {
        paneLeft = viewportRight - paneWidth;
      } else {
        paneLeft = viewportLeft;
        var scale = this.$window.innerWidth / paneWidth;
        timePane.style.transform = 'scale(' + scale + ')';
      }

      timePane.classList.add('sg-timepicker-pos-adjusted');
    }

    // If the bottom edge of the pane would be off the screen and shifting it up by the
    // difference would not go past the top edge of the screen.
    var min = (this.time && this.time.getMinutes() % 5 === 0)? 'MIN5' : 'MIN1';
    var paneHeight = this.$mdMedia('xs')? TIME_PANE_HEIGHT[min].XS : TIME_PANE_HEIGHT[min].GTXS;
    if (paneTop + paneHeight > viewportBottom &&
        viewportBottom - paneHeight > viewportTop) {
      paneTop = viewportBottom - paneHeight;
      timePane.classList.add('sg-timepicker-pos-adjusted');
    }

    timePane.style.left = paneLeft + 'px';
    timePane.style.top = paneTop + 'px';
    document.body.appendChild(timePane);

    // Add CSS class after one frame to trigger open animation.
    this.$$rAF(function() {
      timePane.classList.add('md-pane-open');
    });
  };

  /** Detach the floating time pane from the document. */
  TimePickerCtrl.prototype.detachTimePane = function() {
    this.$element.removeClass(OPEN_CLASS);
    //this.mdInputContainer && this.mdInputContainer.element.removeClass(OPEN_CLASS);
    angular.element(document.body).removeClass('md-datepicker-is-showing');
    this.timePane.classList.remove('md-pane-open');
    this.timePane.classList.remove('md-timepicker-pos-adjusted');

    if (this.isTimeOpen) {
      this.$mdUtil.enableScrolling();
    }

    if (this.timePane.parentNode) {
      // Use native DOM removal because we do not want any of the angular state of this element
      // to be disposed.
      this.timePane.parentNode.removeChild(this.timePane);
    }
  };

  /**
   * Open the floating time pane.
   * @param {Event} event
   */
  TimePickerCtrl.prototype.openTimePane = function(event) {
    if (!this.isTimeOpen && !this.isDisabled) {
      this.isTimeOpen = true;
      this.timePaneOpenedFrom = event.target;

      // Because the time pane is attached directly to the body, it is possible that the
      // rest of the component (input, etc) is in a different scrolling container, such as
      // an md-content. This means that, if the container is scrolled, the pane would remain
      // stationary. To remedy this, we disable scrolling while the time pane is open, which
      // also matches the native behavior for things like `<select>` on Mac and Windows.
      this.$mdUtil.disableScrollAround(this.timePane);

      this.attachTimePane();
      //this.focusTime();
      this.evalAttr('ngFocus');

      // Attach click listener inside of a timeout because, if this open call was triggered by a
      // click, we don't want it to be immediately propogated up to the body and handled.
      var self = this;
      this.$mdUtil.nextTick(function() {
        // Use 'touchstart` in addition to click in order to work on iOS Safari, where click
        // events aren't propogated under most circumstances.
        // See http://www.quirksmode.org/blog/archives/2014/02/mouse_event_bub.html
        self.documentElement.on('click touchstart', self.bodyClickHandler);
      }, false);

      window.addEventListener(this.windowEventName, this.windowEventHandler);
    }
  };

  /** Close the floating time pane. */
  TimePickerCtrl.prototype.closeTimePane = function() {
    if (this.isTimeOpen) {
      var self = this;

      self.detachTimePane();
      self.ngModelCtrl.$setTouched();
      self.evalAttr('ngBlur');

      self.documentElement.off('click touchstart', self.bodyClickHandler);
      window.removeEventListener(self.windowEventName, self.windowEventHandler);

      self.timePaneOpenedFrom.focus();
      self.timePaneOpenedFrom = null;

      self.isTimeOpen = false;
    }
  };

  /** Gets the controller instance for the time in the floating pane. */
  TimePickerCtrl.prototype.getTimePaneCtrl = function() {
    return angular.element(this.timePane.querySelector('sg-time-pane')).controller('sgTimePane');
  };

  /** Focus the time in the floating pane. */
  TimePickerCtrl.prototype.focusTime = function() {
    // Use a timeout in order to allow the time to be rendered, as it is gated behind an ng-if.
    var self = this;
    this.$mdUtil.nextTick(function() {
      var ctrl = self.getTimePaneCtrl();
      self.getTimePaneCtrl().focus(null, ctrl);
    }, false);
  };

  /**
   * Sets whether the input is currently focused.
   * @param {boolean} isFocused
   */
  TimePickerCtrl.prototype.setFocused = function(isFocused) {
    if (!isFocused) {
      this.ngModelCtrl.$setTouched();
    }

    this.evalAttr(isFocused ? 'ngFocus' : 'ngBlur');

    this.isFocused = isFocused;
  };

  /**
   * Handles a click on the document body when the floating time pane is open.
   * Closes the floating time pane if the click is not inside of it.
   * @param {MouseEvent} event
   */
  TimePickerCtrl.prototype.handleBodyClick = function(event) {
    if (this.isTimeOpen) {
      var isInTime = this.$mdUtil.getClosest(event.target, 'sg-time-pane');

      if (!isInTime) {
        this.closeTimePane();
      }

      this.$scope.$digest();
    }
  };

  /**
   * Handles the event when the user navigates away from the current tab. Keeps track of
   * whether the input was focused when the event happened, in order to prevent the time pane
   * from re-opening.
   */
  TimePickerCtrl.prototype.handleWindowBlur = function() {
    this.inputFocusedOnWindowBlur = document.activeElement === this.inputElement;
  };

  /**
   * Evaluates an attribute expression against the parent scope.
   * @param {String} attr Name of the attribute to be evaluated.
   */
  TimePickerCtrl.prototype.evalAttr = function(attr) {
    if (this.$attrs[attr]) {
      this.$scope.$parent.$eval(this.$attrs[attr]);
    }
  };

  /**
   * Sets the ng-model value.
   * @param {Date=} value Date to be set as the model value.
   */
  TimePickerCtrl.prototype.setModelValue = function(value) {
    this.ngModelCtrl.$setViewValue(value);
  };

  /**
   * Updates the timepicker when a model change occurred externally.
   * @param {Date=} value Value that was set to the model.
   */
  TimePickerCtrl.prototype.onExternalChange = function(value) {
    this.time = value;
    this.inputElement.value = this.dateLocale.formatTime(value);
    if (this.mdInputContainer) this.mdInputContainer.setHasValue(!!value);
    this.resizeInputElement();
    this.updateErrorState();
  };
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /*
   * sgToggleGrid - Convert the tiles of a grid to toggle buttons
   * @memberof SOGo.Common
   * @restrict attribute
   * @param {string} [sgToggleGridAttr] - the attribute that specifies if an object is enabled (toggled)
   * @ngInject
   * @example:

    <md-grid-list md-cols="7" md-row-height="1:1"
                  ng-model="editor.event.repeat.days"
                  sg-toggle-grid sg-toggle-grid-attr="day">..</md-grid-list>
  */
  sgToggleGrid.$inject = ['$parse', '$mdUtil', '$mdColors'];
  function sgToggleGrid($parse, $mdUtil, $mdColors) {
    return {
      restrict: 'A',
      require: ['mdGridList', '?ngModel'],
      compile: compile
    };

    function compile(tElement, tAttrs) {
      var CLASS_ACTIVE = 'md-default-theme md-accent md-bg md-bdr';
      return function postLink(scope, element, attr, controllers) {
        var tiles = tElement.find('md-grid-tile'),
            label = tElement.parent().children()[0],
            tile,
            ngModelCtrl,
            i,
            modelDays = [],
            modelAttr,
            toggleClass;

        ngModelCtrl = controllers[1] || $mdUtil.fakeNgModel();
        ngModelCtrl.$render = render;
        ngModelCtrl.$isEmpty = function(value) {
          return !value || value.length === 0;
        };

        scope.$watch(function() {
          return ngModelCtrl.$invalid;
        }, setInvalid);

        tAttrs.$observe('required', function(value) {
          angular.element(label).toggleClass('md-required', !!value);
          ngModelCtrl.$validate();
        });

        toggleClass = function() {
          // Toggle class on click event and call toggle function
          var tile = angular.element(this),
              day = tile.attr('value');
          tile.toggleClass(CLASS_ACTIVE);
          toggle(day);
        };

        for (i = 0; i < tiles.length; i++) {
          tile = angular.element(tiles[i]);
          tile.addClass('sg-icon-button');
          tile.find('figure').addClass('md-icon');
          tile.on('click', toggleClass);
        }

        function render() {
          var flattenedDays = ngModelCtrl.$viewValue;
          modelDays = ngModelCtrl.$viewValue;
          if (tAttrs.sgToggleGridAttr) {
            modelAttr = tAttrs.sgToggleGridAttr;
            flattenedDays = _.map(ngModelCtrl.$viewValue, tAttrs.sgToggleGridAttr);
          }
          _.forEach(tiles, function(o) {
            var tile = angular.element(o);
            if (_.includes(flattenedDays, tile.attr('value'))) {
              tile.addClass(CLASS_ACTIVE);
            }
          });
          ngModelCtrl.$validate();
        }

        function setInvalid() {
          var invalid = ngModelCtrl.$invalid;
          if (invalid) {
            element.addClass('sg-toggle-grid-invalid');
            if (label.tagName == 'LABEL') {
              label.style.color = $mdColors.getThemeColor('warn');
            }
          }
          else {
            element.removeClass('sg-toggle-grid-invalid');
            if (label.tagName == 'LABEL') {
              label.style.color = '';
            }
          }
        }

        function toggle(day) {
          var i = _.findIndex(modelDays, function(o) {
            if (modelAttr)
              return o[modelAttr] == day;
            else
              return o == day;
          });
          if (i < 0) {
            if (modelAttr) {
              var o = {};
              o[modelAttr] = day;
              modelDays.push(o);
            }
            else
              modelDays.push(day);
          }
          else
            modelDays.splice(i, 1);

          scope.$apply(function() {
            ngModelCtrl.$setViewValue(modelDays);
            ngModelCtrl.$setDirty();
            ngModelCtrl.$validate();
          });
        }
      };
    }
  }

  angular
    .module('SOGo.Common')
    .directive('sgToggleGrid', sgToggleGrid);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

String.emailRE = /([\w\!\#$\%\&\'\*\+\-\/\=\?\^\`{\|\}\~]+\.)*[\w\!\#$\%\&\'\*\+\-\/\=\?\^\`{\|\}\~]+@((((([\u00C0-\u017Fa-z0-9]{1}[\u00C0-\u017Fa-z0-9\-]{0,62}[\u00C0-\u017Fa-z0-9]{1})|[\u00C0-\u017Fa-z])\.)+[a-z]{2,})|(\d{1,3}\.){3}\d{1,3}(\:\d{1,5})?)/;

String.prototype.endsWith = function(suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

String.prototype.startsWith = function(pattern, position) {
  position = angular.isNumber(position) ? position : 0;
  return this.lastIndexOf(pattern, position) === position;
};

// See ngSanitize
String.prototype.encodeEntities = function () {
  // Regular Expressions for parsing tags and attributes
  var SURROGATE_PAIR_REGEXP = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
      // Match everything outside of normal chars and " (quote character)
      NON_ALPHANUMERIC_REGEXP = /([^#-~ |!])/g;

  return this.
    replace(/&/g, '&amp;').
    replace(SURROGATE_PAIR_REGEXP, function(value) {
      var hi = value.charCodeAt(0);
      var low = value.charCodeAt(1);
      return '&#' + (((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000) + ';';
    }).
    replace(NON_ALPHANUMERIC_REGEXP, function(value) {
      return '&#' + value.charCodeAt(0) + ';';
    }).
    replace(/</g, '&lt;').
    replace(/>/g, '&gt;');
};

String.prototype._base64_keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
String.prototype.base64encode = function () {
  var output = "";
  var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
  var i = 0;
  
  var input = this.utf8encode();

  while (i < input.length) {
    chr1 = input.charCodeAt(i++);
    chr2 = input.charCodeAt(i++);
    chr3 = input.charCodeAt(i++);
    
    enc1 = chr1 >> 2;
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    enc4 = chr3 & 63;
    
    if (isNaN(chr2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(chr3)) {
      enc4 = 64;
    }
    
    output = output +
      this._base64_keyStr.charAt(enc1) + this._base64_keyStr.charAt(enc2) +
      this._base64_keyStr.charAt(enc3) + this._base64_keyStr.charAt(enc4);
  }
  
  return output;
};

String.prototype.base64decode = function() { 
  var output = "";
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  
  var input = "" + this; // .replace(/[^A-Za-z0-9\+\/\=]/g, "")
  while (i < input.length) {
    enc1 = this._base64_keyStr.indexOf(input.charAt(i++));
    enc2 = this._base64_keyStr.indexOf(input.charAt(i++));
    enc3 = this._base64_keyStr.indexOf(input.charAt(i++));
    enc4 = this._base64_keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;
    
    output = output + String.fromCharCode(chr1);
    
    if (enc3 != 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 != 64) {
      output = output + String.fromCharCode(chr3);
    }
  }

  return output;
};

String.prototype.md5 = function() {
  if (!this.length) { return; }
  // MD5 (Message-Digest Algorithm) by WebToolkit
  var md5 = function(s){function L(k,d){return(k<<d)|(k>>>(32-d));}function K(G,k){var I,d,F,H,x;F=(G&2147483648);H=(k&2147483648);I=(G&1073741824);d=(k&1073741824);x=(G&1073741823)+(k&1073741823);if(I&d){return(x^2147483648^F^H);}if(I|d){if(x&1073741824){return(x^3221225472^F^H);}else{return(x^1073741824^F^H);}}else{return(x^F^H);}}function r(d,F,k){return(d&F)|((~d)&k);}function q(d,F,k){return(d&k)|(F&(~k));}function p(d,F,k){return(d^F^k);}function n(d,F,k){return(F^(d|(~k)));}function u(G,F,aa,Z,k,H,I){G=K(G,K(K(r(F,aa,Z),k),I));return K(L(G,H),F);}function f(G,F,aa,Z,k,H,I){G=K(G,K(K(q(F,aa,Z),k),I));return K(L(G,H),F);}function D(G,F,aa,Z,k,H,I){G=K(G,K(K(p(F,aa,Z),k),I));return K(L(G,H),F);}function t(G,F,aa,Z,k,H,I){G=K(G,K(K(n(F,aa,Z),k),I));return K(L(G,H),F);}function e(G){var Z;var F=G.length;var x=F+8;var k=(x-(x%64))/64;var I=(k+1)*16;var aa=Array(I-1);var d=0;var H=0;while(H<F){Z=(H-(H%4))/4;d=(H%4)*8;aa[Z]=(aa[Z]|(G.charCodeAt(H)<<d));H++;}Z=(H-(H%4))/4;d=(H%4)*8;aa[Z]=aa[Z]|(128<<d);aa[I-2]=F<<3;aa[I-1]=F>>>29;return aa;}function B(x){var k="",F="",G,d;for(d=0;d<=3;d++){G=(x>>>(d*8))&255;F="0"+G.toString(16);k=k+F.substr(F.length-2,2);}return k;}function J(k){k=k.replace(/rn/g,"n");var d="";for(var F=0;F<k.length;F++){var x=k.charCodeAt(F);if(x<128){d+=String.fromCharCode(x);}else{if((x>127)&&(x<2048)){d+=String.fromCharCode((x>>6)|192);d+=String.fromCharCode((x&63)|128);}else{d+=String.fromCharCode((x>>12)|224);d+=String.fromCharCode(((x>>6)&63)|128);d+=String.fromCharCode((x&63)|128);}}}return d;}var C=Array();var P,h,E,v,g,Y,X,W,V;var S=7,Q=12,N=17,M=22;var A=5,z=9,y=14,w=20;var o=4,m=11,l=16,j=23;var U=6,T=10,R=15,O=21;s=J(s);C=e(s);Y=1732584193;X=4023233417;W=2562383102;V=271733878;for(P=0;P<C.length;P+=16){h=Y;E=X;v=W;g=V;Y=u(Y,X,W,V,C[P+0],S,3614090360);V=u(V,Y,X,W,C[P+1],Q,3905402710);W=u(W,V,Y,X,C[P+2],N,606105819);X=u(X,W,V,Y,C[P+3],M,3250441966);Y=u(Y,X,W,V,C[P+4],S,4118548399);V=u(V,Y,X,W,C[P+5],Q,1200080426);W=u(W,V,Y,X,C[P+6],N,2821735955);X=u(X,W,V,Y,C[P+7],M,4249261313);Y=u(Y,X,W,V,C[P+8],S,1770035416);V=u(V,Y,X,W,C[P+9],Q,2336552879);W=u(W,V,Y,X,C[P+10],N,4294925233);X=u(X,W,V,Y,C[P+11],M,2304563134);Y=u(Y,X,W,V,C[P+12],S,1804603682);V=u(V,Y,X,W,C[P+13],Q,4254626195);W=u(W,V,Y,X,C[P+14],N,2792965006);X=u(X,W,V,Y,C[P+15],M,1236535329);Y=f(Y,X,W,V,C[P+1],A,4129170786);V=f(V,Y,X,W,C[P+6],z,3225465664);W=f(W,V,Y,X,C[P+11],y,643717713);X=f(X,W,V,Y,C[P+0],w,3921069994);Y=f(Y,X,W,V,C[P+5],A,3593408605);V=f(V,Y,X,W,C[P+10],z,38016083);W=f(W,V,Y,X,C[P+15],y,3634488961);X=f(X,W,V,Y,C[P+4],w,3889429448);Y=f(Y,X,W,V,C[P+9],A,568446438);V=f(V,Y,X,W,C[P+14],z,3275163606);W=f(W,V,Y,X,C[P+3],y,4107603335);X=f(X,W,V,Y,C[P+8],w,1163531501);Y=f(Y,X,W,V,C[P+13],A,2850285829);V=f(V,Y,X,W,C[P+2],z,4243563512);W=f(W,V,Y,X,C[P+7],y,1735328473);X=f(X,W,V,Y,C[P+12],w,2368359562);Y=D(Y,X,W,V,C[P+5],o,4294588738);V=D(V,Y,X,W,C[P+8],m,2272392833);W=D(W,V,Y,X,C[P+11],l,1839030562);X=D(X,W,V,Y,C[P+14],j,4259657740);Y=D(Y,X,W,V,C[P+1],o,2763975236);V=D(V,Y,X,W,C[P+4],m,1272893353);W=D(W,V,Y,X,C[P+7],l,4139469664);X=D(X,W,V,Y,C[P+10],j,3200236656);Y=D(Y,X,W,V,C[P+13],o,681279174);V=D(V,Y,X,W,C[P+0],m,3936430074);W=D(W,V,Y,X,C[P+3],l,3572445317);X=D(X,W,V,Y,C[P+6],j,76029189);Y=D(Y,X,W,V,C[P+9],o,3654602809);V=D(V,Y,X,W,C[P+12],m,3873151461);W=D(W,V,Y,X,C[P+15],l,530742520);X=D(X,W,V,Y,C[P+2],j,3299628645);Y=t(Y,X,W,V,C[P+0],U,4096336452);V=t(V,Y,X,W,C[P+7],T,1126891415);W=t(W,V,Y,X,C[P+14],R,2878612391);X=t(X,W,V,Y,C[P+5],O,4237533241);Y=t(Y,X,W,V,C[P+12],U,1700485571);V=t(V,Y,X,W,C[P+3],T,2399980690);W=t(W,V,Y,X,C[P+10],R,4293915773);X=t(X,W,V,Y,C[P+1],O,2240044497);Y=t(Y,X,W,V,C[P+8],U,1873313359);V=t(V,Y,X,W,C[P+15],T,4264355552);W=t(W,V,Y,X,C[P+6],R,2734768916);X=t(X,W,V,Y,C[P+13],O,1309151649);Y=t(Y,X,W,V,C[P+4],U,4149444226);V=t(V,Y,X,W,C[P+11],T,3174756917);W=t(W,V,Y,X,C[P+2],R,718787259);X=t(X,W,V,Y,C[P+9],O,3951481745);Y=K(Y,h);X=K(X,E);W=K(W,v);V=K(V,g);}var i=B(Y)+B(X)+B(W)+B(V);return i.toLowerCase();};
  return md5(this.toLowerCase());
};

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

String.prototype.asDate = function () {
    var newDate;
    var date = this.split("/");
    if (date.length == 3)
        newDate = new Date(date[2], date[1] - 1, date[0]); // dd/mm/yyyy
    else {
        date = this.split("-");
        if (date.length == 3)
            newDate = new Date(date[0], date[1] - 1, date[2]); // yyyy-mm-dd
        else {
            if (this.length == 8) {
                newDate = new Date(this.substring(0, 4),
                                   this.substring(4, 6) - 1,
                                   this.substring(6, 8)); // yyyymmdd
            }
        }
    }

    return newDate;
};

String.prototype.formatted = function() {
  var newString = this;

  for (var i = 0; i < arguments.length; i++) {
    newString = newString.replace("%{" + i + "}", arguments[i], "g");
  }

  return newString;
};

String.prototype.isValidEmail = function(strict) {
  var result = String.emailRE.test(this);

  if (strict && result) {
    result = String.emailRE.exec(this)[0] == this;
  }

  return result;
};

String.prototype.asCSSIdentifier = function() {
  var characters = [ '_'  , '\\.', '#'  , '@'  , '\\*', ':'  , ','   , ' ',    "'",    '&',    '\\+' ];
  var escapeds =   [ '_U_', '_D_', '_H_', '_A_', '_S_', '_C_', '_CO_', '_SP_', '_SQ_', '_AM_', '_P_' ];

  var newString = this;
  for (var i = 0; i < characters.length; i++) {
    var re = new RegExp(characters[i], 'g');
    newString = newString.replace(re, escapeds[i]);
  }

  newString = newString.replace(/[^\x00-\x7F]/g, '');

  if (/^\d+/.test(newString)) {
    newString = '_' + newString;
  }

  return newString;
};

String.prototype.timeInterval = function () {
  var interval, match;

  if (this == "once_per_hour")
    interval = 3600;
  else if (this == "every_minute")
    interval = 60;
  else if ((match = this.match(/^every_(\d+)_seconds$/)))
    interval = parseInt(match[1], 10);
  else if ((match = this.match(/^every_(\d+)_minutes$/)))
    interval = parseInt(match[1], 10) * 60;
  else
    interval = parseInt(this.substr(6), 10) * 60;

  return interval;
};

String.prototype.parseDate = function(localeProvider, format) {
  var string, formattingTokens, tokens, token, now, date, regexes, i, parsedInput, matchesCount;

  string = '' + this;
  formattingTokens = /%[dembByYHIMp]/g;
  now = new Date();
  date = {
    year: now.getYear() + 1900,
    month: now.getMonth(),
    day: now.getDate(),
    hour: 0,
    minute: 0
  };
  regexes = {
    '%d': [/\d\d/, function(input) {
      date.day = parseInt(input);
      return (date.day < 32);
    }],
    '%e': [/ ?\d?\d/, function(input) {
      date.day = parseInt(input);
      return (date.day < 32);
    }],
    '%m': [/\d\d/, function(input) {
      date.month = parseInt(input) - 1;
      return (date.month < 12);
    }],
    '%b': [/[^\d\s\.\/\-]{2,}/, function(input) {
      var i = _.indexOf(_.map(localeProvider.shortMonths, _.toLower), _.toLower(input));
      if (i >= 0)
        date.month = i;
      return (i >= 0);
    }],
    '%B': [/[^\d\s\.\/\-]{2,}/, function(input) {
      var i = _.indexOf(_.map(localeProvider.months, _.toLower), _.toLower(input));
      if (i >= 0)
        date.month = i;
      return (i >= 0);
    }],
    '%y': [/\d\d/, function(input) {
      var nearFuture = parseInt(now.getFullYear().toString().substring(2)) + 50;
      date.year = parseInt(input);
      if (date.year < nearFuture) date.year += 2000;
      else date.year += 1900;
      return true;
    }],
    '%Y': [/[12]\d\d\d/, function(input) {
      date.year = parseInt(input);
      return true;
    }],
    '%H': [/\d{1,2}/, function(input) {
      date.hour = parseInt(input);
      return (date.hour < 24);
    }],
    '%I': [/\d{1,2}/, function(input) {
      date.hour = parseInt(input);
      return (date.hour <= 12);
    }],
    '%M': [/[0-5]\d/, function(input) {
      date.minute = parseInt(input);
      return (date.minute < 60 );
    }],
    '%p': [/[^\d\s\/\-]+/, function(input) {
      var linput = _.toLower(input), am = _.toLower(l('AM')), pm = _.toLower(l('PM'));
      if (linput == pm)
        date.hour += 12;
      return (linput == am || linput == pm);
    }],
  };
  tokens = format.match(formattingTokens) || [];
  matchesCount = 0;

  for (i = 0; i < tokens.length; i++) {
    token = tokens[i];
    parsedInput = (string.match(regexes[token][0]) || [])[0];
    if (parsedInput) {
      string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
      if (regexes[token][1](parsedInput))
        matchesCount++;
    }
  }

  if (tokens.length === matchesCount) {
    // console.debug(this + ' + ' + format + ' = ' + JSON.stringify(date));
    return new Date(date.year, date.month, date.day, date.hour, date.minute);
  }
  else
    return new Date(NaN);
};

Date.prototype.clone = function() {
  var newDate = new Date();

  newDate.setTime(this.getTime());

  return newDate;
};

Date.prototype.daysUpTo = function(otherDate) {
  var days = [];

  var day1 = this.getTime();
  var day2 = otherDate.getTime();
  if (day1 > day2) {
    var tmp = day1;
    day1 = day2;
    day2 = tmp;
  }

  var DAY_SECS = 25 * 60 * 60 * 1000; // compensate for DST
  var nbrDays = Math.round((day2 - day1) / DAY_SECS) + 1;
  for (var i = 0; i < nbrDays; i++) {
    var newDate = new Date();
    newDate.setTime(day1 + (i * DAY_SECS));
    newDate.setHours(this.getHours());
    newDate.setMinutes(this.getMinutes());
    newDate.setSeconds(this.getSeconds());
    newDate.setMilliseconds(this.getMilliseconds());
    days.push(newDate);
  }

  return days;
};

Date.prototype.minutesTo = function(otherDate) {
  var delta, dstOffset;

  delta = Math.floor(otherDate.valueOf() - this.valueOf())/1000/60;
  dstOffset = otherDate.getTimezoneOffset() - this.getTimezoneOffset();

  return delta - dstOffset;
};

Date.prototype.stringWithSeparator = function(separator) {
    var month = '' + (this.getMonth() + 1);
    var day = '' + this.getDate();
    var year = this.getYear();
    if (year < 1000)
        year = '' + (year + 1900);
    if (month.length == 1)
        month = '0' + month;
    if (day.length == 1)
        day = '0' + day;

    if (separator == '-')
        str = year + '-' + month + '-' + day;
    else
        str = day + '/' + month + '/' + year;

    return str;
};

Date.prototype.addDays = function(nbrDays) {
  var initialDate, milliSeconds, dstOffset;

  milliSeconds = this.getTime();
  initialDate = new Date(milliSeconds);
  milliSeconds += 86400000 * nbrDays;
  this.setTime(milliSeconds);

  dstOffset = this.getTimezoneOffset() - initialDate.getTimezoneOffset();
  if (dstOffset !== 0) {
    milliSeconds = this.getTime() + dstOffset*60*1000;
    this.setTime(milliSeconds);
  }

  return this;
};

Date.prototype.addHours = function(nbrHours) {
  var milliSeconds = this.getTime();
  milliSeconds += 3600000 * nbrHours;
  this.setTime(milliSeconds);
};

Date.prototype.addMinutes = function(nbrMinutes) {
  var milliSeconds = this.getTime();
  milliSeconds += 60000 * nbrMinutes;
  this.setTime(milliSeconds);
};

Date.prototype.beginOfDay = function() {
    var beginOfDay = new Date(this.getTime());
    beginOfDay.setHours(0);
    beginOfDay.setMinutes(0);
    beginOfDay.setSeconds(0);
    beginOfDay.setMilliseconds(0);

    return beginOfDay;
};

/**
 * See [SOGoUser dayOfWeekForDate:]
 */
Date.prototype.dayOfWeek = function(localeProvider) {
  var offset, baseDayOfWeek, dayOfWeek;

  offset = localeProvider.firstDayOfWeek;
  baseDayOfWeek = this.getDay();
  if (offset > baseDayOfWeek)
    baseDayOfWeek += 7;

  dayOfWeek = baseDayOfWeek - offset;

  return dayOfWeek;
};

/**
 * See [SOGoUser firstWeekOfYearForDate:]
 */
Date.prototype.firstWeekOfYearForDate = function(localeProvider) {
  var firstWeekRule, dayOfWeek, januaryFirst, firstWeek;

  firstWeekRule = localeProvider.firstWeekOfYear;

  januaryFirst = new Date(this.getTime());
  januaryFirst.setMonth(0);
  januaryFirst.setDate(1);
  dayOfWeek = januaryFirst.dayOfWeek(localeProvider);

  if (firstWeekRule == 'First4DayWeek') {
    if (dayOfWeek < 4)
      firstWeek = januaryFirst.beginOfWeek(localeProvider.firstDayOfWeek);
    else
      firstWeek = januaryFirst.addDays(7).beginOfWeek(localeProvider.firstDayOfWeek);
  }
  else if (firstWeekRule == 'FirstFullWeek') {
    if (dayOfWeek === 0)
      firstWeek = januaryFirst.beginOfWeek(localeProvider.firstDayOfWeek);
    else
      firstWeek = januaryFirst.addDays(7).beginOfWeek(localeProvider.firstDayOfWeek);
  }
  else {
    firstWeek = januaryFirst.beginOfWeek(localeProvider.firstDayOfWeek);
  }

  return firstWeek;
};

/**
 * See [SOGoUser weekNumberForDate:]
 */
Date.prototype.getWeek = function(localeProvider) {
  var firstWeek, previousWeek, weekNumber, clone;

  clone = new Date(this.getTime());
  clone.addDays(6);
  firstWeek = clone.firstWeekOfYearForDate(localeProvider);
  if (firstWeek.getTime() < clone.getTime()) {
    weekNumber = 1 + Math.floor((clone.getTime() - firstWeek.getTime()) / (86400000 * 7));
  }
  else
    {
      // Date is within the last week of the previous year;
      // Compute the previous week number to find the week number of the requested date.
      // The number will either be 52 or 53.
      previousWeek = new Date(clone.getTime());
      previousWeek.addDays(-7);
      firstWeek = previousWeek.firstWeekOfYearForDate(localeProvider);
      weekNumber = 2 + Math.floor((previousWeek.getTime() - firstWeek.getTime()) / (86400000 * 7));
    }

  return weekNumber;
};

Date.prototype.beginOfWeek = function(firstDayOfWeek) {
    var offset = firstDayOfWeek - this.getDay();
    if (offset > 0)
        offset -= 7;

    var beginOfWeek = this.beginOfDay();
    beginOfWeek.setHours(12);
    beginOfWeek.addDays(offset);

    return beginOfWeek;
};

Date.prototype.endOfWeek = function(firstDayOfWeek) {
    var endOfWeek = this.beginOfWeek(firstDayOfWeek);
    endOfWeek.addDays(6);

    endOfWeek.setHours(23);
    endOfWeek.setMinutes(59);
    endOfWeek.setSeconds(59);
    endOfWeek.setMilliseconds(999);

    return endOfWeek;
};

// YYYYMMDD
Date.prototype.getDayString = function() {
    var newString = this.getYear();
    if (newString < 1000) newString += 1900;
    var month = '' + (this.getMonth() + 1);
    if (month.length == 1)
        month = '0' + month;
    newString += month;
    var day = '' + this.getDate();
    if (day.length == 1)
        day = '0' + day;
    newString += day;

    return newString;
};

// HH00
Date.prototype.getHourString = function() {
    var newString = this.getHours() + '00';
    if (newString.length == 3)
        newString = '0' + newString;

    return newString;
};

Date.prototype.format = function(localeProvider, format) {
  var separators, parts, i, max,
      date = [],
      validParts = /%[deaAmbByYUHIMp]/g,
      val = {
        '%d': this.getDate(),                                  // day of month (e.g., 01)
        '%e': this.getDate(),                                  // day of month, space padded
        '%a': localeProvider.shortDays[this.getDay()],         // locale's abbreviated weekday name (e.g., Sun)
        '%A': localeProvider.days[this.getDay()],              // locale's full weekday name (e.g., Sunday)
        '%m': this.getMonth() + 1,                             // month (01..12)
        '%b': localeProvider.shortMonths[this.getMonth()],     // locale's abbreviated month name (e.g., Jan)
        '%B': localeProvider.months[this.getMonth()],          // locale's full month name (e.g., January)
        '%y': this.getFullYear().toString().substring(2),      // last two digits of year (00..99)
        '%Y': this.getFullYear(),                              // year
        '%U': this.getWeek(localeProvider),                    // week of the year
        '%H': this.getHours(),                                 // hour (00..23)
        '%M': this.getMinutes() };                             // minute (00..59)
  val['%I'] = val['%H'] > 12 ? val['%H'] % 12 : val['%H'];     // hour (01..12)
  val['%p'] = val['%H'] < 12 ? l('AM') : l('PM');              // locale's equivalent of either AM or PM

  val['%d'] = (val['%d'] < 10 ? '0' : '') + val['%d'];
  val['%e'] = (val['%e'] < 10 ? ' ' : '') + val['%e'];
  val['%m'] = (val['%m'] < 10 ? '0' : '') + val['%m'];
  val['%H'] = (val['%H'] < 10 ? '0' : '') + val['%H'];
  val['%I'] = (val['%I'] < 10 ? '0' : '') + val['%I'];
  val['%M'] = (val['%M'] < 10 ? '0' : '') + val['%M'];

  separators = format.replace(validParts, '\0').split('\0');
  parts = format.match(validParts);
  for (i = 0, max = parts.length; i <= max; i++){
    if (separators.length)
      date.push(separators.shift());
    date.push(val[parts[i]]);
  }

  return date.join('');
};

Element.prototype.setCaretTo = function(pos) {
  if (this.setSelectionRange) {  // For Mozilla and Safari
    this.focus();
    this.setSelectionRange(pos, pos);
  }
  else if (this.createTextRange) {  // For IE
    var range = this.createTextRange();
    range.move('character', pos);
    range.select();
  }
};

Element.prototype.selectText = function(start, end) {
  if (this.setSelectionRange) {     // For Mozilla and Safari
    this.setSelectionRange(start, end);
  }
  else if (this.createTextRange) {  // For IE
    var textRange = this.createTextRange();
    textRange.moveStart('character', start);
    textRange.moveEnd('character', end-element.value.length);
    textRange.select();
  }
  else {
    this.select();
  }
};

/* Functions */

function l() {
  var key = arguments[0], value = key, args = arguments, i, j;

  // Retrieve translation
  if (labels[key]) {
    value = labels[key];
  }
  else if (clabels[key]) {
    value = clabels[key];
  }

  // Format placeholders %{0}, %{1], %{2}, ...
  for (i = 1, j = 0; i < args.length; i++, j++) {
    value = value.replace('%{' + j + '}', args[i]);
  }

  // Format placeholders %d and %s
  i = 1;
  if (args.length > 1) {
    value = value.replace(/%((%)|s|d)/g, function(m) {
      // m is the matched format, e.g. %s, %d
      var val = null;
      if (m[2]) {
        val = m[2];
      }
      else {
        val = args[i];
        // A switch statement so that the formatter can be extended. Default is %s
        switch (m) {
        case '%d':
          val = parseFloat(val);
          if (isNaN(val))
            val = 0;
          break;
        }
        i++;
      }
      return val;
    });
  }

  return value;
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Respect contrast ratio recommendation from W3C:
// http://www.w3.org/TR/WCAG20/#contrast-ratiodef
function contrast(hex) {
  var color, c, l = 1;

  color = hexToRgb(hex);
  if (color) {
    c = [color.r / 255, color.g / 255, color.b / 255];

    for (var i = 0; i < c.length; ++i) {
      if (c[i] <= 0.03928) {
	c[i] = c[i] / 12.92;
      }
      else {
	c[i] = Math.pow((c[i] + 0.055) / 1.055, 2.4);
      }
    }

    l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  if (l > 0.179) {
    return 'black';
  }
  else {
    return 'white';
  }
}

function guid() {
  function S4() {
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1); 
  }
  
  return (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
}
