/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* JavaScript for SOGoAdministration */

(function() {
  'use strict';

  angular.module('SOGo.AdministrationUI', ['ui.router', 'SOGo.Common', 'SOGo.Authentication', 'SOGo.PreferencesUI', 'SOGo.ContactsUI', 'SOGo.SchedulerUI', 'sgCkeditor'])
    .config(configure)
    .run(runBlock);

  /**
   * @ngInject
   */
  configure.$inject = ['$stateProvider', '$urlServiceProvider'];
  function configure($stateProvider, $urlServiceProvider) {
    $stateProvider
      .state('administration', {
        abstract: true,
        views: {
          administration: {
            templateUrl: 'administration.html',
            controller: 'AdministrationController',
            controllerAs: 'app'
          }
        }
      })
      .state('administration.rights', {
        url: '/rights',
        views: {
          module: {
            templateUrl: 'rights.html'
          }
        }
      })
      .state('administration.rights.edit', {
        url: '/:userId/:folderId/edit',
        views: {
          acl: {
            templateUrl: 'UIxAdministrationAclEditor', // UI/Templates/Administration/UIxAdministrationAclEditor.wox
            controller: 'AdministrationAclController',
            controllerAs: 'acl'
          }
        },
        resolve: {
          stateUser: stateUser,
          stateFolder: stateFolder,
          stateAcls: stateAcls
        }
      })
      .state('administration.theme', {
        url: '/theme',
        views: {
          module: {
            templateUrl: 'UIxThemePreview', // UI/Templates/Administration/UIxThemePreview.wox
            controller: 'ThemePreviewController',
            controllerAs: 'ctrl'
          }
        }
      })
      .state('administration.motd', {
        url: '/motd',
        views: {
          module: {
            templateUrl: 'UIxAdministrationMotd', // UI/Templates/Administration/UIxAdministrationMotd.wox
            controller: 'AdministrationMotdController',
            controllerAs: 'ctrl'
          }
        }
      });

    // if none of the above states are matched, use this as the fallback
    $urlServiceProvider.rules.otherwise('/rights');
  }

  /**
   * @ngInject
   */
  stateUser.$inject = ['$q', '$stateParams', 'User'];
  function stateUser($q, $stateParams, User) {
    var user;

    user = _.find(User.$users, function(user) {
      return user.uid == $stateParams.userId;
    });

    if (angular.isUndefined(user)) {
      return User.$filter($stateParams.userId).then(function(users) {
        user = _.find(User.$users, function(user) {
          return user.uid == $stateParams.userId;
        });
        if (angular.isUndefined(user)) {
          return $q.reject('User with ID ' + $stateParams.userId + ' not found');
        }
        else {
          // Resolve folders
          return user.$folders().then(function() {
            return user;
          });
        }
        return user;
      });
    }

    return user;
  }

  /**
   * @ngInject
   */
  stateFolder.$inject = ['$state', '$stateParams', 'decodeUriFilter', 'stateUser', 'AddressBook', 'Calendar'];
  function stateFolder($state, $stateParams, decodeUriFilter, stateUser, AddressBook, Calendar) {
    var folder, o,
        folderId = decodeUriFilter($stateParams.folderId);

    folder = _.find(stateUser.$$folders, function(folder) {
      return folder.name == folderId;
    });
    
    if (folder.type == "Appointment") {
      o = new Calendar({ id: folder.name.split('/').pop(),
                         owner: folder.owner,
                         name: folder.displayName });
    } else {
      o = new AddressBook({ id: folder.name.split('/').pop(),
                            owner: folder.owner,
                            name: folder.displayName });
    }

    stateUser.selectedFolder = o.id;

    return o;
  }

  stateAcls.$inject = ['stateFolder'];
  function stateAcls(stateFolder) {
    return stateFolder.$acl.$users(stateFolder.owner);
  }

  /**
   * @ngInject
   */
  runBlock.$inject = ['$window', '$log', '$transitions', '$state'];
  function runBlock($window, $log, $transitions, $state) {
    if (!$window.DebugEnabled)
      $state.defaultErrorHandler(function() {
        // Don't report any state error
      });
    $transitions.onError({ to: 'administration.**' }, function(transition) {
      if (transition.to().name != 'administration' &&
          !transition.ignored()) {
        $log.error('transition error to ' + transition.to().name + ': ' + transition.error().detail);
        $state.go({ state: 'administration.rights' });
      }
    });
  }

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* JavaScript for SOGoAdministration */

(function() {
  'use strict';
  
  /**
   * @ngInject
   */
  AdministrationAclController.$inject = ['$timeout', '$state', '$mdMedia', '$mdToast', 'stateUser', 'stateFolder', 'stateAcls', 'sgConstant', 'User'];
  function AdministrationAclController($timeout, $state, $mdMedia, $mdToast, stateUser, stateFolder, stateAcls, sgConstant, User) {
    var vm = this;

    vm.user = stateUser;
    vm.folder = stateFolder;
    vm.users = stateAcls;
    vm.folderType = angular.isDefined(stateFolder.$cards)? 'AddressBook' : 'Calendar';
    vm.selectedUser = null;
    vm.selectedUid = null;
    vm.selectUser = selectUser;
    vm.selectAllRights = selectAllRights;
    vm.showRights = showRights;
    vm.removeUser = removeUser;
    vm.getTemplate = getTemplate;
    vm.close = close;
    vm.save = save;

    vm.userToAdd = '';
    vm.searchText = '';
    vm.userFilter = userFilter;
    vm.addUser = addUser;


    function getTemplate() {
      if (angular.isDefined(stateFolder.$cards))
        return '../' + stateFolder.owner + '/Contacts/' + stateFolder.id + '/UIxContactsUserRightsEditor';

      return '../' + stateFolder.owner + '/Calendar/' + stateFolder.id + '/UIxCalUserRightsEditor';
    }

    function selectAllRights(user) {
      stateFolder.$acl.$selectAllRights(user);
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
        vm.selectedUser.$rights();
      }
    }

    function showRights(user) {
      return vm.selectedUid == user.uid && user.rights;
    }

    function userFilter($query) {
      return User.$filter($query, stateFolder.$acl.users, { dry: true, uid: vm.user.uid });
    }

    function removeUser(user) {
      $timeout(function() {
        stateFolder.$acl.$removeUser(user.uid, stateFolder.owner);
      }, 500); // wait for CSS transition to complete (see card.scss)
    }

    function addUser(data) {
      if (data) {
        stateFolder.$acl.$addUser(data, stateFolder.owner).then(function(user) {
          vm.userToAdd = '';
          vm.searchText = '';
          vm.selectedUid = null;
          if (user)
            selectUser(user);
        });
      }
    }

    function close() {
      $state.go('administration.rights').then(function() {
        delete vm.user.selectedFolder;
        vm.user = null;
      });
    }

    function save() {
      stateFolder.$acl.$saveUsersRights(stateFolder.owner).then(function() {
        $mdToast.show(
          $mdToast.simple()
            .textContent(l('ACLs saved'))
            .position(sgConstant.toastPosition)
            .hideDelay(2000)
        );
        // Close acls on small devices
        if ($mdMedia('xs'))
          close();
      });
    }
  }

  angular
    .module('SOGo.AdministrationUI')
    .controller('AdministrationAclController', AdministrationAclController);

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* JavaScript for SOGoAdministration */

(function() {
  'use strict';
  
  /**
   * @ngInject
   */
  AdministrationController.$inject = ['$state', '$window', '$mdToast', '$mdMedia', '$mdSidenav', 'sgConstant', 'Dialog', 'encodeUriFilter', 'User'];
  function AdministrationController($state, $window, $mdToast, $mdMedia, $mdSidenav, sgConstant, Dialog, encodeUriFilter, User) {
    var vm = this,
        defaultWindowTitle = angular.element($window.document).find('title').attr('sg-default') || "SOGo";

    this.$onInit = function() {
      this.service = User;

      this.selectedUser = null;
      this.users = User.$users;
    };

    this.go = function (module) {
      $state.go('administration.' + module);
      // Close sidenav on small devices
      if (!$mdMedia(sgConstant['gt-md']))
        $mdSidenav('left').close();
    };

    this.filter = function (searchText) {
      User.$filter(searchText);
    };

    this.selectUser = function (i) {
      if (this.selectedUser == this.users[i]) {
        this.selectedUser = null;
      }
      else {
        // Fetch folders of specific type for selected user
        this.users[i].$folders().then(function() {
          vm.selectedUser = vm.users[i];
        });
      }
    };

    this.selectFolder = function (folder) {
      $state.go('administration.rights.edit', {userId: this.selectedUser.uid, folderId: encodeUriFilter(folder.name)});
    };

  }

  angular
    .module('SOGo.AdministrationUI')
    .controller('AdministrationController', AdministrationController);

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* JavaScript for SOGoAdministration */

(function() {
  'use strict';
  
  /**
   * @ngInject
   */
  AdministrationMotdController.$inject = ['$timeout', '$state', '$mdMedia', '$mdToast', 'sgConstant', 'Administration', 'sgSettings'];
  function AdministrationMotdController($timeout, $state, $mdMedia, $mdToast, sgConstant, Administration, Settings) {
    var vm = this;
    vm.administration = Administration;
    vm.motd = null;
    vm.save = save;
    vm.clear = clear;
    vm.ckConfig = {
      'autoGrow_minHeight': 200,
      removeButtons: 'Save,NewPage,Preview,Print,Templates,Cut,Copy,Paste,PasteText,PasteFromWord,Undo,Redo,Find,Replace,SelectAll,Scayt,Form,Checkbox,Radio,TextField,Textarea,Select,Button,Image,HiddenField,CopyFormatting,RemoveFormat,NumberedList,BulletedList,Outdent,Indent,Blockquote,CreateDiv,BidiLtr,BidiRtl,Language,Unlink,Anchor,Flash,Table,HorizontalRule,Smiley,SpecialChar,PageBreak,Iframe,Styles,Format,Maximize,ShowBlocks,About,Strike,Subscript,Superscript,Underline,Emojipanel,Emoji,'
    };

    this.administration.$getMotd().then(function (data) {
      if (data && data.motd) {
        vm.motd = data.motd;
      }
    });

    function save() {
      this.administration.$saveMotd(vm.motd).then(function () {
        $mdToast.show(
          $mdToast.simple()
            .textContent(l('Message of the day has been saved'))
            .position(sgConstant.toastPosition)
            .hideDelay(3000));
      });
    }

    function clear() {
      console.log('HEY');
      vm.motd = '';
    }
  }

  angular
    .module('SOGo.AdministrationUI')
    .controller('AdministrationMotdController', AdministrationMotdController);

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @ngInject
   */
  configure.$inject = ['$mdThemingProvider'];
  function configure($mdThemingProvider) {

    $mdThemingProvider.registerStyles([
      '.foreground-1 { color: "{{foreground-1}}" }',
      '.foreground-2 { color: "{{foreground-2}}" }',
      '.foreground-3 { color: "{{foreground-3}}" }',
      '.foreground-4 { color: "{{foreground-4}}" }',
      '.background-contrast { color: "{{background-contrast}}" }',
      '.background-contrast-secondary { color: "{{background-contrast-secondary}}" }',
      '.background-default { background-color: "{{background-default}}" }',
    ].join(''));

    $mdThemingProvider.generateThemesOnDemand(false);
  }

  /**
   * @ngInject
   */
  ThemePreviewController.$inject = ['$mdTheming', '$mdColors'];
  function ThemePreviewController($mdTheming, $mdColors) {
    this.defaultTheme = $mdTheming.THEMES[$mdTheming.defaultTheme()];
    this.jsonDefaultTheme = JSON.stringify(this.defaultTheme, undefined, 2);
    this.getColor = $mdColors.getThemeColor;
  }

  angular
    .module('SOGo.AdministrationUI')
    .config(configure)
    .controller('ThemePreviewController', ThemePreviewController);

})();
