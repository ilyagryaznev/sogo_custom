/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* JavaScript for SOGoPreferences */

(function() {
  'use strict';

  angular.module('SOGo.PreferencesUI', ['ui.router', 'sgCkeditor', 'angularFileUpload', 'SOGo.Common', 'SOGo.MailerUI', 'SOGo.ContactsUI', 'SOGo.Authentication', 'as.sortable'])
    .config(configure)
    .run(runBlock);

  /**
   * @ngInject
   */
  configure.$inject = ['$stateProvider', '$urlServiceProvider'];
  function configure($stateProvider, $urlServiceProvider) {
    $stateProvider
      .state('preferences', {
        abstract: true,
        views: {
          preferences: {
            templateUrl: 'preferences.html',
            controller: 'PreferencesController',
            controllerAs: 'app'
          }
        }
      })
      .state('preferences.general', {
        url: '/general',
        views: {
          module: {
            templateUrl: 'generalPreferences.html'
          }
        }
      })
      .state('preferences.calendars', {
        url: '/calendars',
        views: {
          module: {
            templateUrl: 'calendarsPreferences.html'
          }
        }
      })
      .state('preferences.addressbooks', {
        url: '/addressbooks',
        views: {
          module: {
            templateUrl: 'addressbooksPreferences.html'
          }
        }
      })
      .state('preferences.mailer', {
        url: '/mailer',
        views: {
          module: {
            templateUrl: 'mailerPreferences.html'
          }
        }
      });

    // if none of the above states are matched, use this as the fallback
    $urlServiceProvider.rules.otherwise('/general');
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
    $transitions.onError({ to: 'preferences.**' }, function(transition) {
      if (transition.to().name != 'preferences' &&
          !transition.ignored()) {
        $log.error('transition error to ' + transition.to().name + ': ' + transition.error().detail);
        $state.go({ state: 'preferences' });
      }
    });
  }

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* JavaScript for SOGoPreferences */

(function() {
  'use strict';

  /**
   * @ngInject
   */
  AccountDialogController.$inject = ['$timeout', '$window', '$mdDialog', 'FileUploader', 'Dialog', 'sgSettings', 'defaults', 'account', 'accountId', 'mailCustomFromEnabled', 'maxSize'];
  function AccountDialogController($timeout, $window, $mdDialog, FileUploader, Dialog, Settings, defaults, account, accountId, mailCustomFromEnabled, maxSize) {
    var vm = this, usesSSO = $window.usesCASAuthentication || $window.usesSAML2Authentication;

    this.defaultPort = 143;
    this.smtpDefaultPort = 25;
    this.defaults = defaults;
    this.account = account;
    this.maxSize = maxSize;
    this.accountId = accountId;
    this.hostnameRE = usesSSO && accountId > 0 ? /^(?!(127\.0\.0\.1|localhost(?:\.localdomain)?)$)/ : /./;
    this.emailRE = String.emailRE;
    this.addressesSearchText = '';
    this.ckConfig = {
      'autoGrow_minHeight': 70,
      toolbar: {
        "items": [
          "bold", "italic", "|",
          "fontColor", "fontFamily", "fontSize", "|",
          "link", "|",
          "specialCharacters", "imageUpload", "|",
          "sourceEditing", "htmlEmbed"
        ],
        "shouldNotGroupWhenFull": true
      },
      language: defaults.ckLocaleCode
    };

    if (!this.account.encryption)
      this.account.encryption = "none";
    else if (this.account.encryption == "ssl")
      this.defaultPort = 993;

    if (!this.account.smtpEncryption)
      this.account.smtpEncryption = "none";
    else
      this.smtpDefaultPort = 465;

    _loadCertificate();

    this.uploader = new FileUploader({
      url: [Settings.activeUser('folderURL') + 'Mail', accountId, 'importCertificate'].join('/'),
      autoUpload: false,
      queueLimit: 1,
      filters: [{ name: filterByExtension, fn: filterByExtension }],
      onAfterAddingFile: function(item) {
        vm.certificateFilename = item.file.name;
      },
      onSuccessItem: function(item, response, status, headers) {
        this.clearQueue();
        $timeout(function() {
          _.assign(vm.account, {security: {hasCertificate: true}, $$certificate: response});
        });
        _loadCertificate();
      },
      onErrorItem: function(item, response, status, headers) {
        Dialog.alert(l('Error'), l('An error occurred while importing the certificate. Verify your password.'));
      }
    });

    this.hasIdentities = function () {
      return _.filter(this.account.identities, this.isEditableIdentity).length > 0;
    };

    this.isEditableIdentity = function (identity) {
      return !identity.isReadOnly;
    };

    this.selectIdentity = function (index) {
      if (this.selectedIdentity == index) {
        this.selectedIdentity = null;
      } else {
        this.selectedIdentity = index;
      }
    };

    this.hasDefaultIdentity = function() {
      return _.findIndex(this.account.identities, function(identity) { return !!identity.isDefault; }) >= 0;
    };

    this.setDefaultIdentity = function ($event, $index) {
      _.forEach(this.account.identities, function(identity, i) {
        if (i == $index)
          identity.isDefault = !identity.isDefault;
        else
          delete identity.isDefault;
      });
      $event.stopPropagation();
      return false;
    };

    this.canRemoveIdentity = function (index) {
      return (index == this.selectedIdentity) && this.hasIdentities();
    };

    this.removeIdentity = function (index) {
      this.account.identities.splice(index, 1);
      this.selectedIdentity = null;
    };

    this.addIdentity = function () {
      var firstReadonlyIndex = _.findIndex(this.account.identities, { isReadOnly: 1 });
      var identity = {};

      if (firstReadonlyIndex < 0)
        firstReadonlyIndex = this.account.identities.length;
      if (this.customFromIsReadonly())
        identity.fullName = this.account.identities[0].fullName;
      this.account.identities.splice(Math.max(firstReadonlyIndex, 0), 0, identity);
      this.selectedIdentity = firstReadonlyIndex;
    };

    this.showCkEditor = function ($index) {
      return this.selectedIdentity == $index && this.defaults.SOGoMailComposeMessageType == 'html';
    };

    this.filterEmailAddresses = function ($query) {
      return _.filter($window.defaultEmailAddresses, function (address) {
        return address.toLowerCase().indexOf($query.toLowerCase()) >= 0;
      });
    };

    function _loadCertificate() {
      if (vm.account.security && vm.account.security.hasCertificate)
        vm.account.$certificate().then(function(crt) {
          vm.certificate = crt;
        }, function() {
          delete vm.account.security.hasCertificate;
        });
    }

    function filterByExtension(item) {
      var isP12File = item.type.indexOf('pkcs12') > 0 || /\.(p12|pfx)$/.test(item.name);
      vm.form.certificateFilename.$setValidity('fileformat', isP12File);
      return isP12File;
    }

    this.customFromIsReadonly = function () {
      if (accountId > 0)
        return false;
      return !mailCustomFromEnabled;
    };

    this.importCertificate = function () {
      this.uploader.queue[0].formData = [{ password: this.certificatePassword }];
      this.uploader.uploadItem(0);
    };

    this.onBeforeUploadCertificate = function (form) {
      this.form = form;
      this.uploader.clearQueue();
    };

    this.removeCertificate = function () {
      this.account.$removeCertificate();
    };

    this.cancel = function () {
      $mdDialog.cancel();
    };

    this.save = function () {
      // Check if the size of the content os not too big. Otherwise it will fail while storing in database.
      // This usually happens when using image signature 
      var data = JSON.stringify(this.account);
      if (data.length > this.maxSize) {
        Dialog.alert(l('Error'), l('Data too big. Please contact technical support.'));
      } else {
        $mdDialog.hide();
      }
    };
  }

  angular
    .module('SOGo.PreferencesUI')
    .controller('AccountDialogController', AccountDialogController);

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* JavaScript for SOGoPreferences */

(function() {
  'use strict';

  /**
   * @ngInject
   */
  FiltersDialogController.$inject = ['$scope', '$window', '$mdDialog', 'Dialog', 'filter', 'mailboxes', 'labels', 'validateForwardAddress', 'Preferences'];
  function FiltersDialogController($scope, $window, $mdDialog, Dialog, filter, mailboxes, labels, validateForwardAddress, Preferences) {
    var vm = this,
        sieveCapabilities = $window.sieveCapabilities,
        forwardEnabled = $window.forwardEnabled,
        notificationEnabled = $window.notificationEnabled,
        vacationEnabled = $window.vacationEnabled;

    this.filter = filter;
    this.mailboxes = mailboxes;
    this.labels = labels;

    this.fieldLabels = {
      "subject": l("Subject"),
      "from": l("From"),
      "to": l("To"),
      "cc": l("Cc"),
      "to_or_cc": l("To or Cc"),
      "size": l("Size (Kb)"),
      "header": l("Header")
    };

    if (sieveCapabilities.indexOf("body") > -1)
      this.fieldLabels.body = l("Body");

    this.methodLabels = {
      "discard": l("Discard the message"),
      "keep": l("Keep the message"),
      "stop": l("Stop processing filter rules")
    };

    if (forwardEnabled)
      this.methodLabels.redirect = l("Forward the message to");

    if (notificationEnabled)
      this.methodLabels.notify = l("Notify the message to");

    //if (vacationEnabled)
    //  this.methodLabels.vacation = l("Send a vacation message");

    if (sieveCapabilities.indexOf("reject") > -1)
      this.methodLabels.reject = l("Send a reject message");

    if (sieveCapabilities.indexOf("fileinto") > -1)
      this.methodLabels.fileinto = l("File the message in");

    if (sieveCapabilities.indexOf("imapflags") > -1 || sieveCapabilities.indexOf("imap4flags") > -1)
      this.methodLabels.addflag = l("Flag the message with");

    this.methods = [
      "fileinto",
      "addflag",
      "stop",
      "keep",
      "discard",
      "redirect",
      "notify",
      "reject"
    ];
    this.methods = _.intersection(this.methods, _.keys(this.methodLabels));

    this.numberOperatorLabels = {
      "under": l("is under"),
      "over": l("is over")
    };

    this.textOperatorLabels = {
      "is": l("is"),
      "is_not": l("is not"),
      "contains": l("contains"),
      "contains_not": l("does not contain"),
      "matches": l("matches"),
      "matches_not": l("does not match")
    };

    if (sieveCapabilities.indexOf("regex") > -1) {
      this.textOperatorLabels.regex = l("matches regex");
      this.textOperatorLabels.regex_not = l("does not match regex");
    }

    this.cancel = function () {
      $mdDialog.cancel();
    };

    this.hasRulesAndActions = function () {
      var requirements = [ this.filter.actions ];
      if (this.filter.match != 'allmessages')
        // When matching all messages, no rules are required
        requirements.push(this.filter.rules);
      return _.every(requirements, function(a) {
        return a && a.length > 0;
      });
    };

    this.save = function (form) {
      var i;

      this.invalid = false;

      // We do some sanity checks
      if (this.filter.actions) {
        try {
          _.forEach(_.filter(this.filter.actions, { 'method': 'redirect' }), function (action) {
            validateForwardAddress(action.argument);
          });
        } catch (err) {
          //Dialog.alert(l('Error'), err);
          this.invalid = err.message;
          return false;
        }
        try {
          _.forEach(_.filter(this.filter.actions, { 'method': 'notify' }), function (action) {
            validateForwardAddress(action.argument);
          });
        } catch (err) {
          //Dialog.alert(l('Error'), err);
          this.invalid = err.message;
          return false;
        }
      }
      $mdDialog.hide();
    };

    this.addMailFilterRule = function (event) {
      if (!this.filter.rules)
        this.filter.rules = [];

      this.filter.rules.push({ field: 'subject', operator: 'contains' });
    };

    this.removeMailFilterRule = function (index) {
      this.filter.rules.splice(index, 1);
    };
    
    this.addMailFilterAction = function (event) {
      if (!this.filter.actions)
        this.filter.actions = [];

      this.filter.actions.push({ method: 'fileinto' });
    };
    
    this.removeMailFilterAction = function (index) {
      this.filter.actions.splice(index, 1);
    };
  }

  angular
    .module('SOGo.PreferencesUI')
    .controller('FiltersDialogController', FiltersDialogController);

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* JavaScript for SOGoPreferences */

(function() {
  'use strict';

  /**
   * @ngInject
   */
  PreferencesController.$inject = ['$q', '$window', '$state', '$mdMedia', '$mdSidenav', '$mdDialog', '$mdToast', 'sgSettings', 'sgFocus', 'Dialog', 'User', 'Account', 'Preferences', 'Authentication', 'AddressBook'];
  function PreferencesController($q, $window, $state, $mdMedia, $mdSidenav, $mdDialog, $mdToast, sgSettings, focus, Dialog, User, Account, Preferences, Authentication, AddressBook) {
    var vm = this, mailboxes = [], today = new Date().beginOfDay();

    this.$onInit = function() {
      this.preferences = Preferences;
      this.passwords = { newPassword: null, newPasswordConfirmation: null, oldPassword: null };
      this.timeZonesList = $window.timeZonesList;
      this.timeZonesSearchText = '';
      this.addressesSearchText = '';
      this.autocomplete = {forward: [], notification: []};
      this.mailLabelKeyRE = new RegExp(/^(?!^_\$)[^(){} %*\"\\\\]*?$/);
      this.emailSeparatorKeys = Preferences.defaults.emailSeparatorKeys;
      if(this.preferences.defaults.Notification) {
        if (!this.preferences.defaults.Notification.notificationMessage)
          this.preferences.defaults.Notification.notificationMessage = l('Notification Message', $window.defaultEmailAddresses[0]);
        this.preferences.defaults.Notification.notificationTranslated = l('Notification');
      }
      if (Preferences.defaults.SOGoMailAutoMarkAsReadMode == 'delay')
        this.mailAutoMarkAsReadDelay = Math.max(1, this.preferences.defaults.SOGoMailAutoMarkAsReadDelay);
      else
        this.mailAutoMarkAsReadDelay = 5;

      // Set alternate avatar in User service
      if (Preferences.defaults.SOGoAlternateAvatar)
        User.$alternateAvatar = Preferences.defaults.SOGoAlternateAvatar;

      if (sgSettings.activeUser('path').mail) {
        this.sieveVariablesCapability = ($window.sieveCapabilities.indexOf('variables') >= 0);
        this.preferences.hasActiveExternalSieveScripts();
      }
      this.updateVacationDates();
    };

    this.go = function(module, form) {
      if (form.$valid) {
        // Close sidenav on small devices
        if (!$mdMedia('gt-md'))
          $mdSidenav('left').close();
        $state.go('preferences.' + module);
      }
    };

    this.onLanguageChange = function(form) {
      if (form.$valid)
        Dialog.confirm(l('Warning'),
                       l('Save preferences and reload page now?'),
                       {ok: l('Yes'), cancel: l('No')})
        .then(function() {
          vm.save(form, { quick: true }).then(function() {
            $window.location.reload(true);
          });
        });
    };
    

    this.onDesktopNotificationsChange = function() {
      if (this.preferences.defaults.SOGoDesktopNotifications)
        this.preferences.authorizeNotifications();
    };

    this.resetContactsCategories = function(form) {
      this.preferences.defaults.SOGoContactsCategories = $window.defaultContactsCategories.slice();
      form.$setDirty();
    };

    this.resetCalendarCategories = function(form) {
      this.preferences.defaults.SOGoCalendarCategories = _.keys($window.defaultCalendarCategories);
      this.preferences.defaults.SOGoCalendarCategoriesColorsValues = _.values($window.defaultCalendarCategories);
      form.$setDirty();
    };

    this.addCalendarCategory = function(form) {
      var i = _.indexOf(this.preferences.defaults.SOGoCalendarCategories, l('New category'));
      if (i < 0) {
        this.preferences.defaults.SOGoCalendarCategories.push(l('New category'));
        this.preferences.defaults.SOGoCalendarCategoriesColorsValues.push("#aaa");
        form.$setDirty();
        i = this.preferences.defaults.SOGoCalendarCategories.length - 1;
      }
      focus('calendarCategory_' + i);
    };

    this.resetCalendarCategoryValidity = function(index, form) {
      form['calendarCategory_' + index].$setValidity('duplicate', true);
    };

    this.removeCalendarCategory = function(index, form) {
      this.preferences.defaults.SOGoCalendarCategories.splice(index, 1);
      this.preferences.defaults.SOGoCalendarCategoriesColorsValues.splice(index, 1);
      form.$setDirty();
    };

    this.addContactCategory = function(form) {
      var i = _.indexOf(this.preferences.defaults.SOGoContactsCategories, "");
      if (i < 0) {
        this.preferences.defaults.SOGoContactsCategories.push("");
        form.$setDirty();
        i = this.preferences.defaults.SOGoContactsCategories.length - 1;
      }
      focus('contactCategory_' + i);
    };

    this.removeContactCategory = function(index, form) {
      this.preferences.defaults.SOGoContactsCategories.splice(index, 1);
      form.$setDirty();
    };

    this.onMailAutoMarkAsReadDelay = function() {
      this.preferences.defaults.SOGoMailAutoMarkAsReadDelay = this.mailAutoMarkAsReadDelay;
    };

    this.addMailAccount = function(ev, form) {
      var account, index;

      index = this.preferences.defaults.AuxiliaryMailAccounts.length;
      account = new Account({
        id: index,
        isNew: true,
        name: "",
        identities: [
          {
            fullName: "",
            email: ""
          }
        ],
        receipts: {
          receiptAction: "ignore",
          receiptNonRecipientAction: "ignore",
          receiptOutsideDomainAction: "ignore",
          receiptAnyAction: "ignore"
        }
      });

      $mdDialog.show({
        controller: 'AccountDialogController',
        controllerAs: '$AccountDialogController',
        templateUrl: 'editAccount?account=new',
        targetEvent: ev,
        locals: {
          defaults: this.preferences.defaults,
          account: account,
          accountId: index,
          mailCustomFromEnabled: $window.mailCustomFromEnabled,
          maxSize: this.preferences.defaults.CDefaultsSize
        }
      }).then(function() {
        // Automatically expand the new mail account
        if (!angular.isArray(vm.preferences.settings.Mail.ExpandedFolders)) {
          vm.preferences.settings.Mail.ExpandedFolders = ['/0'];
        }
        vm.preferences.settings.Mail.ExpandedFolders.push('/' + index);
        vm.preferences.defaults.AuxiliaryMailAccounts.push(account.$omit());

        form.$setDirty();
      });
    };

    this.editMailAccount = function(event, index, form) {
      var data, account;

      data = _.assign({ id: index }, _.cloneDeep(this.preferences.defaults.AuxiliaryMailAccounts[index]));
      account = new Account(data);
      $mdDialog.show({
        controller: 'AccountDialogController',
        controllerAs: '$AccountDialogController',
        templateUrl: 'editAccount?account=' + index,
        targetEvent: event,
        locals: {
          defaults: this.preferences.defaults,
          account: account,
          accountId: index,
          mailCustomFromEnabled: $window.mailCustomFromEnabled,
          maxSize: this.preferences.defaults.CDefaultsSize
        }
      }).then(function() {
        vm.preferences.defaults.AuxiliaryMailAccounts[index] = account.$omit();
        form.$setDirty();
      }).catch(_.noop); // Cancel
    };

    this.removeMailAccount = function(index, form) {
      this.preferences.defaults.AuxiliaryMailAccounts.splice(index, 1);
      form.$setDirty();
    };

    this.resetMailLabelValidity = function(index, form) {
      form['mailIMAPLabel_' + index].$setValidity('duplicate', true);
    };

    this.addMailLabel = function(form) {
      // See $omit() in the Preferences services for real key generation
      var key = '_$$' + guid();
      this.preferences.defaults.SOGoMailLabelsColorsKeys.push("label");
      this.preferences.defaults.SOGoMailLabelsColorsValues.push(["New label", "#aaa"]);
      focus('mailLabel_' + (_.size(this.preferences.defaults.SOGoMailLabelsColorsKeys) - 1));
      form.$setDirty();
    };

    this.removeMailLabel = function(index, form) {
      this.preferences.defaults.SOGoMailLabelsColorsKeys.splice(index, 1);
      this.preferences.defaults.SOGoMailLabelsColorsValues.splice(index, 1);
      form.$setDirty();
    };

    function _loadAllMailboxes() {
      var account;

      if (mailboxes.length) {
        return;
      }
      if (sgSettings.activeUser('path').mail) {
        // Fetch a flatten version of the mailboxes list of the main account (0)
        // This list will be forwarded to the Sieve filter controller
        account = new Account({ id: 0 });
        account.$getMailboxes().then(function() {
          var allMailboxes = account.$flattenMailboxes({all: true}),
              index = -1,
              length = allMailboxes.length;
          while (++index < length) {
            mailboxes.push(allMailboxes[index]);
          }
        });
      }
    }

    this.addMailFilter = function(ev, form) {
      var filter = { match: 'all', active: 1 };

      _loadAllMailboxes();
      $mdDialog.show({
        templateUrl: 'editFilter?filter=new',
        controller: 'FiltersDialogController',
        controllerAs: 'filterEditor',
        targetEvent: ev,
        locals: {
          filter: filter,
          mailboxes: mailboxes,
          labels: this.preferences.defaults.SOGoMailLabelsColors,
          validateForwardAddress: validateForwardAddress
        }
      }).then(function() {
        if (!vm.preferences.defaults.SOGoSieveFilters)
          vm.preferences.defaults.SOGoSieveFilters = [];
        vm.preferences.defaults.SOGoSieveFilters.push(filter);
        form.$setDirty();
      });
    };

    this.editMailFilter = function(ev, index, form) {
      var filter = angular.copy(this.preferences.defaults.SOGoSieveFilters[index]);

      _loadAllMailboxes();
      $mdDialog.show({
        templateUrl: 'editFilter?filter=' + index,
        controller: 'FiltersDialogController',
        controllerAs: 'filterEditor',
        targetEvent: null,
        locals: {
          filter: filter,
          mailboxes: mailboxes,
          labels: this.preferences.defaults.SOGoMailLabelsColors,
          validateForwardAddress: validateForwardAddress
        }
      }).then(function() {
        vm.preferences.defaults.SOGoSieveFilters[index] = filter;
        form.$setDirty();
      },
              _.noop); // Cancel
    };

    this.removeMailFilter = function(index, form) {
      this.preferences.defaults.SOGoSieveFilters.splice(index, 1);
      form.$setDirty();
    };

    this.onFiltersOrderChanged = function(form) {
      // Return a callback that will affect the form
      if (!this._onFiltersOrderChanged) {
        this._onFiltersOrderChanged = function(type) {
          form.$setDirty();
        };
      }
      return this._onFiltersOrderChanged;
    };

    this.filterEmailAddresses = function ($query) {
      return _.filter(
        _.difference($window.defaultEmailAddresses,
                     this.preferences.defaults.Vacation.autoReplyEmailAddresses),
        function (address) {
          return address.toLowerCase().indexOf($query.toLowerCase()) >= 0;
        }
      );
    };

    this.addDefaultEmailAddresses = function(form) {
      var v = [];

      if (angular.isDefined(this.preferences.defaults.Vacation.autoReplyEmailAddresses)) {
        v = this.preferences.defaults.Vacation.autoReplyEmailAddresses;
      }

      this.preferences.defaults.Vacation.autoReplyEmailAddresses = _.union($window.defaultEmailAddresses, v);
      form.$setDirty();
    };

    this.userFilter = function(search, excludedUsers) {
      if (!search || search.length < sgSettings.minimumSearchLength())
        return [];

      return User.$filter(search, excludedUsers).then(function(users) {
        // Set users avatars
        _.forEach(users, function(user) {
          if (!user.$$image) {
            if (user.image)
              user.$$image = user.image;
            else
              user.$$image = vm.preferences.avatar(user.c_email, 40, {no_404: true});
            }
        });
        return users;
      });
    };

    this.manageSieveScript = function(form) {
      this.preferences.hasActiveExternalSieveScripts(false);
      form.$setDirty();
    };

    this.confirmChanges = function($event, form) {
      var target;

      if (form.$dirty && form.$valid) {
        // Stop default action
        $event.preventDefault();
        $event.stopPropagation();

        // Find target link
        target = $event.target;
        while (target.tagName != 'A')
          target = target.parentNode;

        Dialog.confirm(l('Unsaved Changes'),
                       l('Do you want to save your changes made to the configuration?'),
                       { ok: l('Save'), cancel: l('Don\'t Save') })
        .then(function() {
          // Save & follow link
          vm.save(form, { quick: true }).then(function() {
            $window.location = target.href;
          });
        }, function() {
          // Don't save & follow link
          $window.location = target.href;
        });
      }
    };

    function validateForwardAddress(address) {
      var defaultAddresses, domains, domain;

      domains = [];

      if ($window.forwardConstraints > 0) {

        // We first extract the list of 'known domains' to SOGo
        defaultAddresses = $window.defaultEmailAddresses;
        _.forEach(defaultAddresses, function(adr) {
          var domain = adr.split("@")[1];
          if (domain) {
            domains.push(domain.toLowerCase());
          }
        });

        // We check if we're allowed or not to forward based on the domain defaults
        domain = address.split("@")[1].toLowerCase();
        if (domains.indexOf(domain) < 0 && $window.forwardConstraints == 1) {
          throw new Error(l("You are not allowed to forward your messages to an external email address."));
        }
        else if (domains.indexOf(domain) >= 0 && $window.forwardConstraints == 2) {
          throw new Error(l("You are not allowed to forward your messages to an internal email address."));
        }
        else if ($window.forwardConstraints == 2 &&
                 $window.forwardConstraintsDomains.length > 0 &&
                 $window.forwardConstraintsDomains.indexOf(domain) < 0) {
          throw new Error(l("You are not allowed to forward your messages to this domain:") + " " + domain);
        }
        else if ($window.forwardConstraints == 3 &&
                  domains.indexOf(domain) < 0 &&
                    ($window.forwardConstraintsDomains.length > 0 &&
                    $window.forwardConstraintsDomains.indexOf(domain) < 0)) {
          // If constraints mode is 3 and the domain is not an internal nor in forwardConstraintsDomains list, throw an error
          throw new Error(l("You are not allowed to forward your messages to this domain:")+ " " + domain);
        }
      }

      return true;
    }

    this.save = function(form, options) {
      var i, sendForm, addresses;

      sendForm = true;

      // We do some sanity checks

      // We check if we're allowed or not to forward based on the domain defaults
      if (this.preferences.defaults.Forward && this.preferences.defaults.Forward.enabled &&
          this.preferences.defaults.Forward.forwardAddress) {
        addresses = this.preferences.defaults.Forward.forwardAddress;
        try {
          for (i = 0; i < addresses.length; i++) {
            validateForwardAddress(addresses[i]);
          }
        } catch (err) {
          Dialog.alert(l('Error'), err);
          sendForm = false;
        }
      }

      // IMAP labels must be unique
      if (this.preferences.defaults.SOGoMailLabelsColorsKeys.length !=
          this.preferences.defaults.SOGoMailLabelsColorsValues.length ||
          this.preferences.defaults.SOGoMailLabelsColorsKeys.length !=
          _.uniq(this.preferences.defaults.SOGoMailLabelsColorsKeys).length) {
        Dialog.alert(l('Error'), l("IMAP labels must have unique names."));
        _.forEach(this.preferences.defaults.SOGoMailLabelsColorsKeys, function (value, i, keys) {
          if (form['mailIMAPLabel_' + i].$dirty &&
              (keys.indexOf(value) != i ||
               keys.indexOf(value, i+1) > -1)) {
            form['mailIMAPLabel_' + i].$setValidity('duplicate', false);
            sendForm = false;
          }
        });
      }

      // Calendar categories must be unique
      if (this.preferences.defaults.SOGoCalendarCategories.length !=
          _.uniq(this.preferences.defaults.SOGoCalendarCategories).length) {
        Dialog.alert(l('Error'), l("Calendar categories must have unique names."));
        _.forEach(this.preferences.defaults.SOGoCalendarCategories, function (value, i, keys) {
          if (form['calendarCategory_' + i].$dirty &&
              (keys.indexOf(value) != i ||
               keys.indexOf(value, i+1) > -1)) {
            form['calendarCategory_' + i].$setValidity('duplicate', false);
            sendForm = false;
          }
        });
      }

      // Contact categories must be unique
      if (this.preferences.defaults.SOGoContactsCategories.length !=
          _.uniq(this.preferences.defaults.SOGoContactsCategories).length) {
        Dialog.alert(l('Error'), l("Contact categories must have unique names."));
        _.forEach(this.preferences.defaults.SOGoContactsCategories, function (value, i, keys) {
          if (form['contactCategory_' + i].$dirty &&
              (keys.indexOf(value) != i ||
               keys.indexOf(value, i+1) > -1)) {
            form['contactCategory_' + i].$setValidity('duplicate', false);
            sendForm = false;
          }
        });
      }

      if (sendForm) {
        var self = this;
        return this.preferences.$save().then(function(data) {
          self.preferences.defaults.totpVerificationCode = ''
          if (!options || !options.quick) {
            $mdToast.show(
              $mdToast.simple()
                .textContent(l('Preferences saved'))
                .position('bottom right')
                .hideDelay(2000));
            form.$setPristine();
          }
        }).catch(function(e) {
          if (485 == e.status) {
            form.totpVerificationCode.$setValidity('invalidTotpCode', false);
          }
        });
      }

      return $q.reject('Invalid form');
    };

    this.resetTotpVerificationCode = function(form) {
      form.totpVerificationCode.$setValidity('invalidTotpCode', true);
    }

    this.canChangePassword = function(form) {
      if (this.passwords.newPasswordConfirmation && this.passwords.newPasswordConfirmation.length &&
          this.passwords.newPassword != this.passwords.newPasswordConfirmation) {
        form.newPasswordConfirmation.$setValidity('newPasswordMismatch', false);
        return false;
      }
      else {
        form.newPasswordConfirmation.$setValidity('newPasswordMismatch', true);
      }
      if (this.passwords.newPassword && this.passwords.newPassword.length > 0 &&
          this.passwords.newPasswordConfirmation && this.passwords.newPasswordConfirmation.length &&
          this.passwords.newPassword == this.passwords.newPasswordConfirmation &&
          this.passwords.oldPassword && this.passwords.oldPassword.length > 0)
        return true;

      return false;
    };

    this.changePassword = function() {
      Authentication.changePassword(null, null, this.passwords.newPassword, this.passwords.oldPassword).then(function() {
        var alert = $mdDialog.alert({
          title: l('Password'),
          textContent: l('The password was changed successfully.'),
          ok: l('OK')
        });
        $mdDialog.show( alert )
          .finally(function() {
            alert = undefined;
          });
      }, function(msg) {
        var alert = $mdDialog.alert({
          title: l('Password'),
          textContent: msg,
          ok: l('OK')
        });
        $mdDialog.show( alert )
          .finally(function() {
            alert = undefined;
          });
      });
    };

    this.timeZonesListFilter = function(filter) {
      return _.filter(this.timeZonesList, function(value) {
        return value.toUpperCase().indexOf(filter.toUpperCase()) >= 0;
      });
    };

    this.updateVacationDates = function() {
      var d = this.preferences.defaults;

      if (d &&
          d.Vacation &&
          d.Vacation.enabled) {
        this.toggleVacationStartDate();
        this.toggleVacationEndDate();
      }
    };

    this.toggleVacationStartDate = function() {
      var v;

      v = this.preferences.defaults.Vacation;

      if (v.startDateEnabled) {
        // Enabling the start date
        if (!v.startDate) {
          v.startDate = new Date();
        }
        if (v.endDateEnabled && v.endDate && v.startDate.getTime() > v.endDate.getTime()) {
          v.startDate = new Date(v.endDate.getTime());
          v.startDate.addDays(-1);
        }
      }
    };

    this.toggleVacationEndDate = function() {
      var v;

      v = this.preferences.defaults.Vacation;

      if (v.endDateEnabled) {
        // Enabling the end date
        if (!v.endDate) {
          v.endDate = new Date();
        }
        if (v.startDateEnabled && v.startDate && v.endDate.getTime() < v.startDate.getTime()) {
          v.endDate = new Date(v.startDate.getTime());
          v.endDate.addDays(1);
        }
      }
    };

    this.validateVacationEndDate = function(date) {
      var d = vm.preferences.defaults, r = true;
      if (d &&
          d.Vacation &&
          d.Vacation.enabled) {
        if (d.Vacation.endDateEnabled) {
          r = (!d.Vacation.startDateEnabled ||
               !d.Vacation.startDate ||
               date.getTime() >= d.Vacation.startDate.getTime());
        }
      }

      return r;
    };

    this.toggleVacationStartTime = function() {
      var v;

      v = this.preferences.defaults.Vacation;

      if (v.startTimeEnabled) {
        // Enabling the start date
        if (!v.startTime) {
          v.startTime = new Date();
        }
      }
    };

    this.toggleVacationEndTime = function() {
      var v;

      v = this.preferences.defaults.Vacation;

      if (v.endTimeEnabled) {
        // Enabling the end date
        if (!v.endTime) {
          v.endTime = new Date();
        }
      }
    };

    this.contactFilter = function ($query) {
      return AddressBook.$filterAll($query, [], {priority: 'gcs'}).then(function(cards) {
        // Divide the matching cards by email addresses so the user can select
        // the recipient address of her choice
        var explodedCards = [];
        _.forEach(_.invokeMap(cards, 'explode'), function(manyCards) {
          _.forEach(manyCards, function(card) {
            explodedCards.push(card);
          });
        });
        // Remove duplicates
        return _.uniqBy(explodedCards, function(card) {
          return card.$$fullname + ' ' + card.$$email + ' ' + card.containername;
        });
      });
    };

    this.ignoreReturn = function ($event) {
      if ($event.keyCode == 13) {
        $event.stopPropagation();
        $event.preventDefault();
        return false;
      }
      if ($event.keyCode == 186 && $event.key == 'ü') { //Key code for separator ';' but is keycode for ü in german keyboard
        $event.stopPropagation();
        $event.preventDefault();
        let element = $window.document.getElementById($event.target.id);
        element.value = element.value + 'ü'
      }
    };

    this.addRecipient = function (contact, element) {
      var recipients, recipient, list, i, address;

      recipients = this.autocomplete[element];

      if (angular.isString(contact)) {
        // Examples that are handled:
        //   Smith, John <john@smith.com>
        //   <john@appleseed.com>;<foo@bar.com>
        //   foo@bar.com abc@xyz.com
        address = '';
        for (i = 0; i < contact.length; i++) {
          if ((contact.charCodeAt(i) ==  9 ||   // tab
               contact.charCodeAt(i) == 32 ||   // space
               contact.charCodeAt(i) == 44 ||   // ,
               contact.charCodeAt(i) == 59) &&  // ;
              address.isValidEmail() &&
              recipients.indexOf(address) < 0) {
            recipients.push(address);
            address = '';
          }
          else {
            address += contact.charAt(i);
          }
        }
        if (address && recipients.indexOf(address) < 0)
          recipients.push(address);

        return address;
      }

      if (contact.$isList({expandable: true})) {
        // If the list's members were already fetch, use them
        if (angular.isDefined(contact.refs) && contact.refs.length) {
          _.forEach(contact.refs, function(ref) {
            if (ref.email.length && recipients.indexOf(ref.$shortFormat()) < 0)
              recipients.push(ref.$shortFormat());
          });
        }
        else {
          list = Card.$find(contact.container, contact.c_name);
          list.$id().then(function(listId) {
            _.forEach(list.refs, function(ref) {
              if (ref.email.length && recipients.indexOf(ref.$shortFormat()) < 0)
                recipients.push(ref.$shortFormat());
            });
          });
        }
      }
      else if (contact.$isGroup({expandable: true})) {
        recipient = {
          toString: function () { return contact.$shortFormat(); },
          isExpandable: true,
          members: []
        };
        contact.$members().then(function (members) {
          recipient.members = members;
        });
      }
      else {
        recipient = contact.$$email;
      }
      
      if (recipient)
        return recipient;
      else
        return null;
    };

  }

  angular
    .module('SOGo.PreferencesUI')
    .controller('PreferencesController', PreferencesController);

})();
