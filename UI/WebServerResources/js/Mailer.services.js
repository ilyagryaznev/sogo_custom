/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @name Account
   * @constructor
   * @param {object} futureAccountData
   */
  function Account(futureAccountData) {
    var _this = this;
    // Data is immediately available
    if (typeof futureAccountData.then !== 'function') {
      angular.extend(this, futureAccountData);
      _.forEach(this.identities, function(identity) {
        if (identity.fullName && identity.email)
          identity.full = identity.fullName + ' <' + identity.email + '>';
        else if (identity.email)
          identity.full = '<' + identity.email + '>';
        else
          identity.full = '';
        if (identity.signature) {
          var element = angular.element('<div>' + identity.signature + '</div>');
          identity.textSignature = _.map(element.contents(), 'textContent').join(' ').trim();
        }
      });
      if (this.$mailboxes) {
        // Create instances of Mailbox
        Account.$Mailbox.$unwrapCollection(this, Account.$q.when({ mailboxes: this.$mailboxes })).then(function(collection) {
          _this.$mailboxes = collection;
        });
      }
    }
    else {
      // The promise will be unwrapped first
      //this.$unwrap(futureAccountData);
    }
  }

  /**
   * @memberof Account
   * @desc The factory we'll use to register with Angular
   * @returns the Account constructor
   */
  Account.$factory = ['$q', '$timeout', '$log', 'sgSettings', 'Resource', 'Preferences', 'Mailbox', 'Message', function($q, $timeout, $log, Settings, Resource, Preferences, Mailbox, Message) {
    angular.extend(Account, {
      $q: $q,
      $timeout: $timeout,
      $log: $log,
      $$resource: new Resource(Settings.activeUser('folderURL') + 'Mail', Settings.activeUser()),
      $Preferences: Preferences,
      $Mailbox: Mailbox,
      $Message: Message
    });

    return Account; // return constructor
  }];

  /**
   * @module SOGo.MailerUI
   * @desc Factory registration of Account in Angular module.
   */
  try {
    angular.module('SOGo.MailerUI');
  }
  catch(e) {
    angular.module('SOGo.MailerUI', ['SOGo.Common']);
  }
  angular.module('SOGo.MailerUI')
    .factory('Account', Account.$factory);

  /**
   * @memberof Account
   * @desc Set the list of accounts and instanciate a new Account object for each item.
   * @param {array} [data] - the metadata of the accounts
   * @returns the list of accounts
   */
  Account.$findAll = function(data) {
    if (data) {
      return Account.$unwrapCollection(data);
    }
    else if (Account.$accounts) {
      return Account.$q.when(Account.$accounts);
    }
    else {
      return Account.$$resource.fetch('', 'mailAccounts').then(function(o) {
        return Account.$unwrapCollection(o);
      });
    }
  };

  /**
   * @memberof Account
   * @desc Unwrap to a collection of Account instances.
   * @param {object} data - the accounts information
   * @returns a collection of Account objects
   */
  Account.$unwrapCollection = function(data) {
    var collection = [];

    angular.forEach(data, function(o, i) {
      o.id = i;
      collection[i] = new Account(o);
    });
    Account.$accounts = collection;

    return collection;
  };

  /**
   * @memberof Account
   * @desc Refresh the unseen count for all required mailboxes.
   *       Starts a timer if user choose to automatically refresh folders.
   * @param {array} [string] - the paths of the folders
   */
  Account.refreshUnseenCount = function(folders) {
    var unseenCountFolders,
        fetchAllUnseenCountFolders = (Account.$Preferences.defaults.SOGoMailFetchAllUnseenCountFolders === 1),
        refreshViewCheck = Account.$Preferences.defaults.SOGoRefreshViewCheck;

    if (fetchAllUnseenCountFolders)
      unseenCountFolders = [];
    else if (folders)
      unseenCountFolders = folders;
    else
      throw Error('SOGoMailFetchAllUnseenCountFolders is disabled and no folders list provided');

    _.forEach(Account.$accounts, function(account) {
      if (fetchAllUnseenCountFolders) {
        // Include all mailboxes
        _.forEach(account.$$flattenMailboxes, function(mailbox) {
          unseenCountFolders.push(mailbox.id);
        });
      }
      else {
        // Always include the INBOX
        if (!_.includes(unseenCountFolders, account.id + '/folderINBOX'))
          unseenCountFolders.push(account.id + '/folderINBOX');

        _.forEach(account.$$flattenMailboxes, function(mailbox) {
          if (angular.isDefined(mailbox.unseenCount) &&
              !_.includes(unseenCountFolders, mailbox.id))
            unseenCountFolders.push(mailbox.id);
        });
      }
    });

    Account.$$resource.post('', 'unseenCount', {mailboxes: unseenCountFolders}).then(function(data) {
      _.forEach(Account.$accounts, function(account) {
        _.forEach(account.$$flattenMailboxes, function(mailbox) {
          if (angular.isDefined(data[mailbox.id])) {
            mailbox.unseenCount = data[mailbox.id];
          }
        });
      });
    });

    if (refreshViewCheck && refreshViewCheck != 'manually') {
      if (Account.$refreshUnseenCount)
        Account.$timeout.cancel(Account.$refreshUnseenCount);
      Account.$refreshUnseenCount = Account.$timeout(angular.bind(this, Account.refreshUnseenCount, folders), refreshViewCheck.timeInterval()*1000);
    }
  };

  /**
   * @function getLength
   * @memberof Account.prototype
   * @desc Used by md-virtual-repeat / md-on-demand
   * @returns the number of mailboxes in the account
   */
  Account.prototype.getLength = function() {
    if (this.$expanded)
      return this.$flattenMailboxes().length;
    else
      return 0;
  };

  /**
   * @function getItemAtIndex
   * @memberof Account.prototype
   * @desc Used by md-virtual-repeat / md-on-demand
   * @returns the mailbox at the specified index
   */
  Account.prototype.getItemAtIndex = function(index) {
    var expandedMailboxes;

    expandedMailboxes = this.$flattenMailboxes();
    if (index >= 0 && index < expandedMailboxes.length)
      return expandedMailboxes[index];

    return null;
  };

  /**
   * @function $getMailboxes
   * @memberof Account.prototype
   * @desc Fetch the list of mailboxes for the current account.
   * @param {object} [options] - force a reload by setting 'reload' to true
   * @returns a promise of the HTTP operation
   */
  Account.prototype.$getMailboxes = function(options) {
    var _this = this, reload = (options && options.reload);

    if (this.$mailboxes && !reload) {
      return Account.$q.when(this.$mailboxes);
    }
    else if (!reload && this.$futureMailboxesData) {
      return this.$futureMailboxesData;
    }
    else {
      this.$futureMailboxesData = Account.$Mailbox.$find(this, options).then(function(data) {
        var previousMailboxes = _this.$flattenMailboxes({ all: true });
        _this.$mailboxes = data;
        _this.$expanded = false;

        // Restore unseen count
        var _visitForUnseencount = function(mailboxes) {
          _.forEach(mailboxes, function(o) {
            var previousMailbox = _.find(previousMailboxes, ['id', o.id]);
            if (previousMailbox) {
              o.unseenCount = previousMailbox.unseenCount;
            }
            if (o.children && o.children.length > 0) {
              _visitForUnseencount(o.children);
            }
          });
        };
        _visitForUnseencount(_this.$mailboxes);

        // Set expanded folders from user's settings
        var expandedFolders,
            _visitForExpanded = function(mailboxes) {
              _.forEach(mailboxes, function(o) {
                o.$expanded = (expandedFolders.indexOf('/' + o.id) >= 0);
                if (o.children && o.children.length > 0) {
                  _visitForExpanded(o.children);
                }
              });
            };
        if (Account.$Preferences.settings.Mail.ExpandedFolders) {
          if (angular.isString(Account.$Preferences.settings.Mail.ExpandedFolders)) {
            // Backward compatibility support
            try {
              expandedFolders = angular.fromJson(Account.$Preferences.settings.Mail.ExpandedFolders);
            }
            catch (e) {
              Account.$log.warn("Can't parse list of expanded folders. String was: " +
                                Account.$Preferences.settings.Mail.ExpandedFolders);
              expandedFolders = [];
            }
          }
          else {
            expandedFolders = Account.$Preferences.settings.Mail.ExpandedFolders;
          }
          _this.$expanded = (expandedFolders.indexOf('/' + _this.id) >= 0);
          if (expandedFolders.length > 0) {
            _visitForExpanded(_this.$mailboxes);
          }
        }
        if (Account.$accounts)
          _this.$expanded |= (Account.$accounts.length == 1); // Always expand single account

        _this.$flattenMailboxes({reload: true});

        return _this.$mailboxes;
      });
      return this.$futureMailboxesData;
    }
  };

  /**
   * @function $flattenMailboxes
   * @memberof Account.prototype
   * @desc Get a flatten array of the mailboxes.
   * @param {object} [options] - the following boolean attributes are available:
   *   - reload: rebuild the flatten array of mailboxes from the original tree representation (this.$mailboxes)
   *   - all: return all mailboxes, ignoring their expanstion state
   *   - saveState: save expansion state of mailboxes to the server
   * @returns an array of Mailbox instances
   */
  Account.prototype.$flattenMailboxes = function(options) {
    var _this = this,
        allMailboxes = [],
        expandedMailboxes = [],
        _visit = function(mailboxes) {
          _.forEach(mailboxes, function(o) {
            allMailboxes.push(o);
            if ((options && options.all || o.$expanded) && o.children && o.children.length > 0) {
              _visit(o.children);
            }
          });
        };

    if (this.$$flattenMailboxes && !(options && (options.reload || options.all))) {
      allMailboxes = this.$$flattenMailboxes;
    }
    else {
      _visit(this.$mailboxes);
      if (!options || !options.all) {
        _this.$$flattenMailboxes = allMailboxes;
        if (options && options.saveState) {
          // Save expansion state of mailboxes to the server
          _.forEach(Account.$accounts, function(account) {
            if (account.$expanded) {
              expandedMailboxes.push('/' + account.id);
            }
            _.reduce(account.$$flattenMailboxes, function(expandedFolders, mailbox) {
              if (mailbox.$expanded) {
                expandedFolders.push('/' + mailbox.id);
              }
              return expandedFolders;
            }, expandedMailboxes);
          });
          Account.$$resource.post(null, 'saveFoldersState', expandedMailboxes);
        }
      }
    }

    return allMailboxes;
  };

  Account.prototype.$getMailboxByType = function(type) {
    var mailbox,
        // Recursive find function
        _find = function(mailboxes) {
          var mailbox = _.find(mailboxes, function(o) {
            return o.type == type;
          });
          if (!mailbox) {
            angular.forEach(mailboxes, function(o) {
              if (!mailbox && o.children && o.children.length > 0) {
                mailbox = _find(o.children);
              }
            });
          }
          return mailbox;
        };
    mailbox = _find(this.$mailboxes);

    return mailbox;
  };

  /**
   * @function $getMailboxByPath
   * @memberof Account.prototype
   * @desc Recursively find a mailbox using its path
   * @returns the Mailbox instance or null if not found
   */
  Account.prototype.$getMailboxByPath = function(path) {
    var mailbox = null,
        // Recursive find function
        _find = function(mailboxes) {
          var mailbox = _.find(mailboxes, function(o) {
            return o.path == path;
          });
          if (!mailbox) {
            angular.forEach(mailboxes, function(o) {
              if (!mailbox && o.children && o.children.length > 0) {
                mailbox = _find(o.children);
              }
            });
          }
          return mailbox;
        };
    mailbox = _find(this.$mailboxes);

    if (mailbox == null)
      throw Error('No mailbox found matching path ' + path);

    return mailbox;
  };

  /**
   * @function $newMailbox
   * @memberof Account.prototype
   * @desc Create a new mailbox on the server and refresh the list of mailboxes.
   * @returns a promise of the HTTP operations
   */
  Account.prototype.$newMailbox = function(path, name) {
    var _this = this;

    return Account.$$resource.post(path.toString(), 'createFolder', {name: name}).then(function() {
      _this.$getMailboxes({reload: true});
    });
  };

  /**
   * @function getTextSignature
   * @memberof Account.prototype
   * @desc Create a plain text representation of the signature for the specified identity index.
   * @returns a plain text version of the signature
   */
  Account.prototype.getTextSignature = function(identity) {
    if (identity.signature) {
      var element = angular.element('<div>' + identity.signature + '</div>');
      identity.textSignature = _.map(element.contents(), 'textContent').join(' ').trim();
    } else {
      identity.textSignature = '';
    }
    return identity.textSignature;
  };

  /**
   * @function $hasCertificate
   * @memberof Account.prototype
   * @desc Return true if the user has a S/MIME certificate for this account
   * @returns a boolean value
   */
  Account.prototype.$hasCertificate = function() {
    return this.security && this.security.hasCertificate;
  };

  /**
   * @function $certificate
   * @memberof Account.prototype
   * @desc View the S/MIME certificate details associated to the account.
   * @returns a promise of the HTTP operation
   */
  Account.prototype.$certificate = function() {
    var _this = this;

    if (this.$hasCertificate()) {
      if (this.$$certificate)
        return Account.$q.when(this.$$certificate);
      else {
        return Account.$$resource.fetch(this.id.toString(), 'certificate').then(function(data) {
          _this.$$certificate = data;
          return data;
        });
      }
    }
    else {
      return Account.$q.reject();
    }
  };

  /**
   * @function $removeCertificate
   * @memberof Account.prototype
   * @desc Remove any S/MIME certificate associated with the account.
   * @returns a promise of the HTTP operation
   */
  Account.prototype.$removeCertificate = function() {
    var _this = this;

    return Account.$$resource.fetch(this.id.toString(), 'removeCertificate').then(function() {
      _this.security.hasCertificate = false;
    });
  };

  /**
   * @function updateQuota
   * @memberof Account.prototype
   * @param {Object} data - the inbox quota information returned by the server
   * @desc Update the quota definition associated to the account
   */
  Account.prototype.updateQuota = function(data) {
    var percent, format, description;

    if (data.maxQuota) {
      percent = (Math.round(data.usedSpace * 10000 / data.maxQuota) / 100);
      format = l("quotasFormat");
      description = format.formatted(percent, Math.round(data.maxQuota/10.24)/100);
    }
    else if (data.maxMessages) {
      percent = (Math.round(data.messagesCount * 10000 / data.maxMessages) / 100);
      format = l("messageQuotasFormat");
      description = format.formatted(percent, data.maxMessages);
    }

    this.$quota = { percent: percent, description: description };
  };

  /**
   * @function $newMessage
   * @memberof Account.prototype
   * @desc Prepare a new Message object associated to the appropriate mailbox.
   * @returns a promise of the HTTP operations
   */
  Account.prototype.$newMessage = function(options) {
    var _this = this;

    // Query account for draft folder and draft UID
    return Account.$$resource.fetch(this.id.toString(), 'compose').then(function(data) {
      Account.$log.debug('New message (compose): ' + JSON.stringify(data, undefined, 2));
      var message = new Account.$Message(data.accountId, _this.$getMailboxByPath(data.mailboxPath), data);
      return message;
    }).then(function(message) {
      // Fetch draft initial data
      return Account.$$resource.fetch(message.$absolutePath({asDraft: true}), 'edit').then(function(data) {
        var accountDefaults = Account.$Preferences.defaults.AuxiliaryMailAccounts[_this.id];
        if (accountDefaults.security) {
          if (accountDefaults.security.alwaysSign)
            data.sign = true;
          if (accountDefaults.security.alwaysEncrypt)
            data.encrypt = true;
        }
        Account.$log.debug('New message (edit): ' + JSON.stringify(data, undefined, 2));
        angular.extend(message.editable, data);
        message.isNew = true;
        if (options && options.mailto) {
          if (angular.isObject(options.mailto))
            angular.extend(message.editable, options.mailto);
          else
            message.$parseMailto(options.mailto);
        }
        return message;
      });
    });
  };

  /**
   * @function $addDelegate
   * @memberof Account.prototype
   * @param {Object} user - a User object with minimal set of attributes (uid, isGroup, cn, c_email)
   * @desc Remove a user from the account's delegates
   * @see {@link User.$filter}
   */
  Account.prototype.$addDelegate = function(user) {
    var _this = this,
        deferred = Account.$q.defer(),
        param = {uid: user.uid};
    if (!user.uid || _.indexOf(_.map(this.delegates, 'uid'), user.uid) > -1) {
      // No UID specified or user already in delegates
      deferred.resolve();
    }
    else {
      Account.$$resource.fetch(this.id.toString(), 'addDelegate', param).then(function() {
        _this.delegates.push(user);
        deferred.resolve(_this.users);
      }, function(data, status) {
        deferred.reject(l('An error occured, please try again.'));
      });
    }
    return deferred.promise;
  };

  /**
   * @function $removeDelegate
   * @memberof Account.prototype
   * @param {Object} user - a User object with minimal set of attributes (uid, isGroup, cn, c_email)
   * @desc Remove a user from the account's delegates
   * @return a promise of the server call to remove the user from the account's delegates
   */
  Account.prototype.$removeDelegate = function(uid) {
    var _this = this,
        param = {uid: uid};
    return Account.$$resource.fetch(this.id.toString(), 'removeDelegate', param).then(function() {
      var i = _.indexOf(_.map(_this.delegates, 'uid'), uid);
      if (i >= 0) {
        _this.delegates.splice(i, 1);
      }
    });
  };

  /**
   * @function $omit
   * @memberof Account.prototype
   * @desc Return a sanitized object used to send to the server.
   * @return an object literal copy of the Account instance
   */
  Account.prototype.$omit = function (deep) {
    var account = {}, identities = [], mailboxes = [], defaultIdentity = false;

    angular.forEach(this, function(value, key) {
      if (key != 'constructor' && key !='identities' && key[0] != '$') {
        account[key] = angular.copy(value);
      }
    });

    if (deep) {
      _.forEach(this.$mailboxes, function(mailbox) {
        mailboxes.push(mailbox.$omit(deep));
      });
      account.$mailboxes = mailboxes;
    }

    _.forEach(this.identities, function (identity) {
      if (!identity.isReadOnly || deep)
        identities.push(_.pick(identity, ['email', 'fullName', 'replyTo', 'signature', 'isDefault']));
      if (identity.isDefault)
        defaultIdentity = identity;
    });
    account.identities = identities;

    if (!defaultIdentity || !account.forceDefaultIdentity)
      delete account.forceDefaultIdentity;

    return account;
  };

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @name Mailbox
   * @constructor
   * @param {object} futureMailboxData - either an object literal or a promise
   */
  function Mailbox(account, futureMailboxData) {
    this.$account = account;
    // Data is immediately available
    if (typeof futureMailboxData.then !== 'function') {
      this.init(futureMailboxData);
      if (this.name && !this.path) {
        // Create a new mailbox on the server
        var newMailboxData = Mailbox.$$resource.create('createFolder', this.name);
        this.$unwrap(newMailboxData);
      }
    }
    else {
      // The promise will be unwrapped first
      // NOTE: this condition never happen for the moment
      this.$unwrap(futureMailboxData);
    }
  }

  /**
   * @memberof Mailbox
   * @desc The factory we'll use to register with Angular
   * @returns the Mailbox constructor
   */
  Mailbox.$factory = ['$q', '$timeout', '$log', '$rootScope', 'sgSettings', 'Resource', 'Message', 'Acl', 'Preferences', 'sgMailbox_PRELOAD', 'sgMailbox_BATCH_DELETE_LIMIT', function ($q, $timeout, $log, $rootScope, Settings, Resource, Message, Acl, Preferences, PRELOAD, BATCH_DELETE_LIMIT) {
    angular.extend(Mailbox, {
      $q: $q,
      $timeout: $timeout,
      $log: $log,
      $rootScope: $rootScope,
      $$resource: new Resource(Settings.activeUser('folderURL') + 'Mail', Settings.activeUser()),
      $Message: Message,
      $$Acl: Acl,
      $Preferences: Preferences,
      $query: { sort: 'arrival', asc: 0 }, // The default sort must match [UIxMailListActions defaultSortKey]
      selectedFolder: null,
      $refreshTimeout: null,
      $virtualMode: false,
      $virtualPath: false,
      $searchMode: false,
      PRELOAD: PRELOAD,
      BATCH_DELETE_LIMIT: BATCH_DELETE_LIMIT
    });
    // Initialize sort parameters from user's settings
    if (Preferences.settings.Mail.SortingState) {
      Mailbox.$query.sort = Preferences.settings.Mail.SortingState[0];
      Mailbox.$query.asc = parseInt(Preferences.settings.Mail.SortingState[1]);
    }

    return Mailbox; // return constructor
  }];

  /**
   * @module SOGo.MailerUI
   * @desc Factory registration of Mailbox in Angular module.
   */
  try {
    angular.module('SOGo.MailerUI');
  }
  catch(e) {
    angular.module('SOGo.MailerUI', ['SOGo.Common']);
  }
  angular.module('SOGo.MailerUI')
    .constant('sgMailbox_PRELOAD', {
      LOOKAHEAD: 50,
      SIZE: 100
    })
    .constant('sgMailbox_BATCH_DELETE_LIMIT', 1000)
    .factory('Mailbox', Mailbox.$factory);

  /**
   * @memberof Mailbox
   * @desc Fetch list of mailboxes of a specific account
   * @param {string} accountId - the account
   * @return a promise of the HTTP operation
   * @see {@link Account.$getMailboxes}
   */
  Mailbox.$find = function(account, options) {
    var path, futureMailboxData;

    if (options && options.all)
      futureMailboxData = this.$$resource.fetch(account.id.toString(), 'viewAll');
    else
      futureMailboxData = this.$$resource.fetch(account.id.toString(), 'view');

    return Mailbox.$unwrapCollection(account, futureMailboxData); // a collection of mailboxes
  };

  /**
   * @memberof Mailbox
   * @desc Unwrap to a collection of Mailbox instances.
   * @param {string} account - the account
   * @param {promise} futureMailboxData - a promise of the mailboxes metadata
   * @returns a promise of a collection of Mailbox objects
   */
  Mailbox.$unwrapCollection = function(account, futureMailboxData) {
    var collection = [],
        // Local recursive function
        createMailboxes = function(level, mailbox) {
          mailbox.isSentFolder = mailbox.isSentFolder || mailbox.type == 'sent';
          mailbox.isDraftsFolder = mailbox.isDraftsFolder || mailbox.type == 'draft';
          for (var i = 0; i < mailbox.children.length; i++) {
            mailbox.children[i].level = level;
            mailbox.children[i] = new Mailbox(account, mailbox.children[i]);
            mailbox.children[i].isSentFolder = mailbox.isSentFolder;
            mailbox.children[i].isDraftsFolder = mailbox.isDraftsFolder;
            createMailboxes(level+1, mailbox.children[i]);
          }
        };
    //collection.$futureMailboxData = futureMailboxData;

    return futureMailboxData.then(function(data) {
      return Mailbox.$timeout(function() {
        // Each entry is spun up as a Mailbox instance
        angular.forEach(data.mailboxes, function(data, index) {
          data.level = 0;
          var mailbox = new Mailbox(account, data);
          createMailboxes(1, mailbox); // recursively create all sub-mailboxes
          collection.push(mailbox);
        });
        // Update inbox quota
        if (data.quotas)
          account.updateQuota(data.quotas);
        return collection;
      });
    });
  };

  /**
   * @memberof Mailbox
   * @desc Build the path of the mailbox (or account only).
   * @param {string} accountId - the account ID
   * @param {string} [mailboxPath] - the mailbox path
   * @returns a string representing the path relative to the mail module
   */
  Mailbox.$absolutePath = function(accountId, mailboxPath) {
    var path = [];

    if (mailboxPath) {
      path = _.map(mailboxPath.split('/'), function(component) {
        return 'folder' + component.asCSSIdentifier();
      });
    }

    path.splice(0, 0, accountId); // insert account ID

    return path.join('/');
  };

  /**
   * @function init
   * @memberof Mailbox.prototype
   * @desc Extend instance with new data and compute additional attributes.
   * @param {object} data - attributes of mailbox
   */
  Mailbox.prototype.init = function(data) {
    var _this = this;
    if (angular.isUndefined(this.uidsMap) || data.headers) {
      this.$isLoading = true;
      this.$messages = [];
      this.uidsMap = {};
      this.$visibleMessages = this.$messages;
      this.$selectedMessages = [];
    }
    if (angular.isUndefined(this.$highlightWords)) {
      this.$highlightWords = [];
    }
    angular.extend(this, data);
    if (this.path) {
      this.id = this.$id();
      this.$acl = new Mailbox.$$Acl('Mail/' + this.id);
      if (this.threaded) {
        this.$collapsedThreads = [];
        if (Mailbox.$Preferences.settings.Mail.threadsCollapsed && Mailbox.$Preferences.settings.Mail.threadsCollapsed['/' + this.id]) {
          this.$collapsedThreads = Mailbox.$Preferences.settings.Mail.threadsCollapsed['/' + this.id];
        }
      }
    }
    this.$displayName = this.name;
    if (this.type) {
      this.$isEditable = this.isEditable();
      this.$isSpecial = true;
      if (this.type == 'inbox') {
        this.$displayName = l('InboxFolderName');
        this.$icon = 'inbox';
      }
      else if (this.type == 'draft') {
        this.$displayName = l('DraftsFolderName');
        this.$icon = 'drafts';
      }
      else if (this.type == 'sent') {
        this.$displayName = l('SentFolderName');
        this.$icon = 'send';
      }
      else if (this.type == 'trash') {
        this.$displayName = l('TrashFolderName');
        this.$icon = 'delete';
      }
      else if (this.type == 'junk') {
        this.$displayName = l('JunkFolderName');
        this.$icon = 'thumb_down';
      }
      else if (this.type == 'templates') {
        this.$displayName = l('TemplatesFolderName');
        this.$icon = 'mail_outline';
      }
      else if (this.type == 'additional') {
        this.$icon = 'folder';
      }
      else if (this.type == 'shared') {
        this.$icon = 'folder_shared';
      }
      else if (this.type == 'otherUsers') {
        this.$icon = 'folder_shared';
      }
      else if (this.type == 'dropbox') {
        this.$icon = 'drive_folder_upload';
      }
      else {
        this.$isSpecial = false;
        this.$icon = 'folder';
      }
    }
    this.$isNoInferiors = this.isNoInferiors();
    if (angular.isUndefined(this.$shadowData)) {
      // Make a copy of the data for an eventual reset
      this.$shadowData = this.$omit();
    }
  };

  /**
   * @function $displayUnseenCount
   * @memberof Mailbox.prototype
   * @desc Compute the unread count to display. For inbox, aggregates unread
   *       from all folders except spam/junk.
   * @returns number of unread messages to display
   */
  Mailbox.prototype.$displayUnseenCount = function() {
    if (this.type != 'inbox' || !this.$account || !this.$account.$mailboxes) {
      return this.unseenCount || 0;
    }

    // For INBOX: show "direct_count (subfolders_count)"
    var inboxCount = parseInt(this.unseenCount, 10) || 0,
        subfoldersCount = 0,
        isSpamFolder = function(mailbox) {
          if (!mailbox)
            return false;
          var name = (mailbox.name || mailbox.$displayName || '').toLowerCase();
          return mailbox.type == 'junk' || name == 'spam' || name == 'junk' || name == 'спам';
        },
        visitSubfolders = function(mailboxes) {
          _.forEach(mailboxes, function(box) {
            if (!isSpamFolder(box) && angular.isDefined(box.unseenCount)) {
              var count = parseInt(box.unseenCount, 10);
              if (!isNaN(count))
                subfoldersCount += count;
            }
            if (box && box.children && box.children.length > 0)
              visitSubfolders(box.children);
          });
        };

    // Count unread in subfolders only (not including INBOX itself)
    if (this.children && this.children.length > 0) {
      visitSubfolders(this.children);
    }

    // Return formatted string: "inbox_only (inbox + subfolders)" or just inbox_only
    var totalCount = inboxCount + subfoldersCount;
    if (subfoldersCount > 0) {
      return inboxCount + ' (' + totalCount + ')';
    }
    return inboxCount || 0;
  };

  /**
   * @function selectFolder
   * @memberof Mailbox.prototype
   * @desc Mark the folder as selected in the constructor unless virtual mode is active
   */
  Mailbox.prototype.selectFolder = function() {
    if (!Mailbox.$virtualMode)
      Mailbox.selectedFolder = this;
  };

  /**
   * @function setSearchMode
   * @memberof Mailbox.prototype
   * @desc Set search mode for controller
   * @param {array} searchMode - a boolean
   */
  Mailbox.prototype.setSearchMode = function (searchMode) {
    Mailbox.$searchMode = searchMode;
  };

  /**
   * @function getLength
   * @memberof Mailbox.prototype
   * @desc Used by md-virtual-repeat / md-on-demand
   * @returns the number of messages in the mailbox
   */
  Mailbox.prototype.getLength = function() {
    return this.$visibleMessages.length;
  };

  /**
   * @function getItemAtIndex
   * @memberof Mailbox.prototype
   * @desc Used by md-virtual-repeat / md-on-demand
   * @returns the message at the specified index
   */
  Mailbox.prototype.getItemAtIndex = function(index) {
    var message;

    if (index >= 0 && index < this.$visibleMessages.length) {
      message = this.$visibleMessages[index];
      this.$lastVisibleIndex = Math.max(0, index - 3); // Magic number is NUM_EXTRA from virtual-repeater.js
      this.$loadMessage(message.uid);
      return message; // skeleton is displayed while headers are being fetched
    }
    return null;
  };

  /**
   * @function $id
   * @memberof Mailbox.prototype
   * @desc Build the unique ID to identified the mailbox.
   * @returns a string representing the path relative to the mail module
   */
  Mailbox.prototype.$id = function() {
    return Mailbox.$absolutePath(this.$account.id, this.path);
  };

  /**
   * @function selectedMessages
   * @memberof Mailbox.prototype
   * @desc Return the messages selected by the user.
   * @returns Message instances
   */
  Mailbox.prototype.selectedMessages = function(options) {
    if (options && options.updateCache)
      this.$selectedMessages = _.filter(this.$messages, function(message) { return message.selected; });
    return this.$selectedMessages;
  };

  /**
   * @function selectedCount
   * @memberof Mailbox.prototype
   * @desc Return the number of messages selected by the user.
   * @returns the number of selected messages
   */
  Mailbox.prototype.selectedCount = function() {
    return this.$selectedMessages.length;
  };

  /**
   * @function $unselectMessages
   * @memberof Mailbox.prototype
   * @desc Unselect all messages.
   */
  Mailbox.prototype.$unselectMessages = function() {
    _.forEach(this.$selectedMessages, function(message) {
      message.selected = false;
    });
    this.$selectedMessages = [];
  };

  /**
   * @function isSelectedMessage
   * @memberof Mailbox.prototype
   * @desc Check if the specified message is displayed in the detailed view.
   * @param {string} messageId
   * @returns true if the specified message is displayed
   */
  Mailbox.prototype.isSelectedMessage = function(messageId) {
    return this.$selectedMessage == messageId;
  };

  /**
   * @function $selectedMessage
   * @memberof Mailbox.prototype
   * @desc Return the currently visible message.
   * @returns a Message instance or undefined if no message is displayed
   */
  Mailbox.prototype.selectedMessage = function() {
    var _this = this;
    return _.find(this.$messages, function(message) { return message.uid == _this.$selectedMessage; });
  };

  /**
   * @function $selectedMessageIndex
   * @memberof Mailbox.prototype
   * @desc Return the index of the currently visible message.
   * @returns a number or undefined if no message is selected
   */
  Mailbox.prototype.$selectedMessageIndex = function() {
    return this.uidsMap[this.$selectedMessage];
  };

  /**
   * @function hasSelectedMessage
   * @memberof Mailbox.prototype
   * @desc Check if a message is selected.
   * @returns true if the a message is selected
   */
  Mailbox.prototype.hasSelectedMessage = function() {
    return angular.isDefined(this.$selectedMessage);
  };

  /**
   * @function $filter
   * @memberof Mailbox.prototype
   * @desc Fetch the messages metadata of the mailbox
   * @param {object} [sortsortingAttributes] - sort preferences. Defaults to descendent by date.
   * @param {string} sortingAttributes.match - either AND or OR
   * @param {string} sortingAttributes.sort - either arrival, subject, from, to, date, or size
   * @param {boolean} sortingAttributes.asc - sort is ascendant if true
   * @param {object[]} [filters] - list of filters for the query
   * @param {string} filters.searchBy - either subject, from, to, cc, or body
   * @param {string} filters.searchInput - the search string to match
   * @param {boolean} filters.negative - negate the condition
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.$filter = function(sortingAttributes, filters) {
    var _this = this, action = 'view', options = {};

    if (!angular.isDefined(this.unseenCount))
      this.unseenCount = 0;

    this.$isLoading = true;

    if (Mailbox.$refreshTimeout)
      Mailbox.$timeout.cancel(Mailbox.$refreshTimeout);

    if (sortingAttributes)
      // Sorting preferences are common to all mailboxes
      angular.extend(Mailbox.$query, sortingAttributes);

    if (filters && filters.length > 0) {
      // Remove highlight words
      this.$highlightWords = [];
      filters.forEach(filter => {
        if ("subject_or_from" == filter.searchBy
          || "subject_or_to" == filter.searchBy
          || "contains" == filter.searchBy
          || "body" == filter.searchBy
          || "from" == filter.searchBy
          || "to" == filter.searchBy
          || "subject" == filter.searchBy) {
          var words = filter.searchInput.split(" ");
          words.forEach(word => {
            var cleanedWord = word.trim().toLowerCase();
            if (!this.$highlightWords.includes(cleanedWord)) {
              this.$highlightWords.push(cleanedWord);
            }
          });
        }
      });
    }

    angular.extend(options, { sortingAttributes: Mailbox.$query });
    if (angular.isDefined(filters)) {
      options.filters = _.reject(angular.copy(filters), function(filter) {
        return !filter.searchInput || filter.searchInput.length === 0;
      });
      // Decompose filters that match two fields
      _.forEach(options.filters, function(filter) {
        var secondFilter,
            match = filter.searchBy.match(/(\w+)_or_(\w+)/);
        if (match) {
          options.sortingAttributes.match = 'OR';
          filter.searchBy = match[1];
          secondFilter = angular.copy(filter);
          secondFilter.searchBy = match[2];
          options.filters.push(secondFilter);
        }
      });
    }
    else if (!sortingAttributes && !this.$flaggedOnly && !this.$unseenOnly && this.$syncToken) {
      // Fetch changes only if sorting attributes haven't changed, and view is not limited to
      // unseen messages or flagged messages.
      action = 'changes';
      options.syncToken = this.$syncToken;
    }

    if (this.$unseenOnly)
      options.unseenOnly = 1;

    if (this.$flaggedOnly)
      options.flaggedOnly = 1;

    var labels = _.filter(_.keys(this.$filteredLabels), function (k) {
      return !!_this.$filteredLabels[k];
    });
    if (labels.length)
      options.labels = labels;

    // Restart the refresh timer, if needed
    if (!Mailbox.$virtualMode) {
      var refreshViewCheck = Mailbox.$Preferences.defaults.SOGoRefreshViewCheck;
      if (refreshViewCheck && refreshViewCheck != 'manually') {
        var f = angular.bind(this, Mailbox.prototype.$filter, null, filters);
        Mailbox.$refreshTimeout = Mailbox.$timeout(f, refreshViewCheck.timeInterval()*1000);
      }
    }

    var futureMailboxData = Mailbox.$$resource.post(this.id, action, options);
    return this.$unwrap(futureMailboxData);
  };

  /**
   * @function $loadMessage
   * @memberof Mailbox.prototype
   * @desc Check if the message headers are loaded and in any case, fetch more messages headers from the server.
   * @returns true if the message metadata are already fetched
   */
  Mailbox.prototype.$loadMessage = function(messageId) {
    var startIndex = this.uidsMap[messageId],
        endIndex,
        index,
        max = this.$messages.length,
        loaded = false,
        uids,
        futureHeadersData;
    if (angular.isDefined(this.uidsMap[messageId]) && startIndex < this.$messages.length) {
      // Index is valid
      if (angular.isDefined(this.$messages[startIndex].subject)) {// || this.$messages[startIndex].loading) {
        // Message headers are loaded or data is coming
        loaded = true;
      }

      // Preload more headers if possible
      endIndex = Math.min(startIndex + Mailbox.PRELOAD.LOOKAHEAD, max - 1);
      if (angular.isDefined(this.$messages[endIndex].subject) ||
          angular.isDefined(this.$messages[endIndex].loading)) {
        index = Math.max(startIndex - Mailbox.PRELOAD.LOOKAHEAD, 0);
        if (!angular.isDefined(this.$messages[index].subject) &&
            !angular.isDefined(this.$messages[index].loading)) {
          // Previous messages not loaded; preload more headers further up
          endIndex = startIndex;
          startIndex = Math.max(startIndex - Mailbox.PRELOAD.SIZE, 0);
        }
      }
      else
        // Next messages not load; preload more headers further down
        endIndex = Math.min(startIndex + Mailbox.PRELOAD.SIZE, max - 1);

      if (!angular.isDefined(this.$messages[startIndex].subject) &&
          !angular.isDefined(this.$messages[startIndex].loading) ||
          !angular.isDefined(this.$messages[endIndex].subject) &&
          !angular.isDefined(this.$messages[endIndex].loading)) {

        for (uids = []; startIndex < endIndex && startIndex < max; startIndex++) {
          if (angular.isDefined(this.$messages[startIndex].subject) || this.$messages[startIndex].loading) {
            // Message at this index is already loaded; increase the end index
            endIndex++;
          }
          else {
            // Message at this index will be loaded
            uids.push(this.$messages[startIndex].uid);
            //console.debug('loading ' + this.$messages[startIndex].uid);
            this.$messages[startIndex].loading = true;
          }
        }

        if (uids.length) {
          Mailbox.$log.debug('Loading UIDs ' + uids.join(' '));
          futureHeadersData = Mailbox.$$resource.post(this.id, 'headers', {uids: uids});
          this.$unwrapHeaders(futureHeadersData);
        }
      }
    }
    return loaded;
  };

  /**
   * @function isEditable
   * @memberof Mailbox.prototype
   * @desc Checks if the mailbox is editable based on its type.
   * @returns true if the mailbox is not a special folder.
   */
  Mailbox.prototype.isEditable = function() {
    return this.type == 'folder';
  };

  /**
   * @function isNoInferiors
   * @memberof Mailbox.prototype
   * @desc Checks if the mailbox can contain submailboxes
   * @returns true if the mailbox can not contain submailboxes
   */
  Mailbox.prototype.isNoInferiors = function() {
    return this.flags.indexOf('noinferiors') >= 0;
  };

  /**
   * @function isNoSelect
   * @memberof Mailbox.prototype
   * @desc Checks if the mailbox can be selected
   * @returns true if the mailbox can not be selected
   */
  Mailbox.prototype.isNoSelect = function() {
    return this.flags.indexOf('noselect') >= 0;
  };

  /**
   * @function isWritable
   * @memberof Mailbox.prototype
   * @desc Checks the user can write to the mailbox
   * @returns true if messages can be inserted
   */
  Mailbox.prototype.isWritable = function() {
    return this.flags.indexOf('noselect') < 0 || this.type == 'dropbox';
  };

  /**
   * @function getClassName
   * @memberof Mailbox.prototype
   * @desc Not used but defined because it is called from UIxAclEditor.wox.
   * @returns a string representing the foreground CSS class name
   */
  Mailbox.prototype.getClassName = function(base) {
    return false;
  };

  /**
   * @function $rename
   * @memberof AddressBook.prototype
   * @desc Rename the mailbox and keep the list sorted
   * @param {string} name - the new name
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.$rename = function() {
    var _this = this,
        findParent,
        parent,
        children,
        i;

    if (this.name == this.$shadowData.name) {
      // Name hasn't changed
      return Mailbox.$q.when();
    }

    // Local recursive function
    findParent = function(parent, children) {
      var parentMailbox = null,
          mailbox = _.find(children, function(o) {
            return o.path == _this.path;
          });
      if (mailbox) {
        parentMailbox = parent;
      }
      else {
        angular.forEach(children, function(o) {
          if (!parentMailbox && o.children && o.children.length > 0) {
            parentMailbox = findParent(o, o.children);
          }
        });
      }
      return parentMailbox;
    };

    // Find mailbox parent
    parent = findParent(null, this.$account.$mailboxes);
    if (parent === null)
      children = this.$account.$mailboxes;
    else
      children = parent.children;

    // Find index of mailbox among siblings
    i = _.indexOf(_.map(children, 'id'), this.id);

    return this.$save().then(function(data) {
      var sibling, oldPath = _this.path;
      _this.init(data); // update the path and id

      // Move mailbox among its siblings according to its new name
      children.splice(i, 1);
      sibling = _.find(children, function(o) {
        return (o.type == 'folder' && o.name.localeCompare(_this.name) > 0);
      });
      if (sibling) {
        i = _.indexOf(_.map(children, 'id'), sibling.id);
      }
      else {
        i = children.length;
      }
      children.splice(i, 0, _this);

      // Update the path and id of children
      var pathRE = new RegExp('^' + oldPath);
      var _updateChildren = function(mailbox) {
        _.forEach(mailbox.children, function(child) {
          child.path = child.path.replace(pathRE, _this.path);
          child.id = child.$id();
          _updateChildren(child);
        });
      };
      _updateChildren(_this);
    });
  };

  /**
   * @function $compact
   * @memberof Mailbox.prototype
   * @desc Compact the mailbox
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.$compact = function() {
    var _this = this;
    return Mailbox.$$resource.post(this.id, 'expunge')
      .then(function(data) {
        // Update inbox quota
        if (data.quotas)
          _this.$account.updateQuota(data.quotas);
        return true;
      });
  };

  /**
   * @function $canFolderAs
   * @memberof Mailbox.prototype
   * @desc Check if the folder can be set as Drafts/Sent/Trash
   * @returns true if folder is eligible
   */
  Mailbox.prototype.$canFolderAs = function() {
    return this.type == 'folder';
  };

  /**
   * @function $setFolderAs
   * @memberof Mailbox.prototype
   * @desc Set a folder as Drafts/Sent/Trash
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.$setFolderAs = function(type) {
    return Mailbox.$$resource.post(this.id, 'setAs' + type + 'Folder');
  };

  /**
   * @function $empty
   * @memberof Mailbox.prototype
   * @desc Empty the Trash folder.
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.$empty = function() {
    var _this = this,
        action = 'empty' + this.type[0].capitalize() + this.type.substring(1);

    return Mailbox.$$resource.post(this.id, action).then(function(data) {
      // Remove all messages from the mailbox
      _this.$messages = _this.$visibleMessages = [];
      _this.uidsMap = {};
      _this.unseenCount = 0;

      // If we had any submailboxes, lets do a refresh of the mailboxes list
      if (angular.isDefined(_this.children) && _this.children.length)
        _this.$account.$getMailboxes({reload: true});

      // Update inbox quota
      if (data.quotas)
        _this.$account.updateQuota(data.quotas);
    });
  };

  /**
   * @function $markAsRead
   * @memberof Mailbox.prototype
   * @desc Mark all messages from folder as read
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.$markAsRead = function() {
    var _this = this;

    return Mailbox.$$resource.post(this.id, 'markRead').then(function() {
      _this.unseenCount = 0;
      _.forEach(_this.$messages, function(message) {
        message.isread = true;
      });
    });
  };

  /**
   * @function getLabels
   * @memberof Mailbox.prototype
   * @desc Fetch the list of labels associated to the mailbox. Use the cached value if available.
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.getLabels = function(options) {
    var _this = this;

    if (this.$labels && !(options && options.reload))
      return Mailbox.$q.when(this.$labels);

    if (angular.isUndefined(this.$filteredLabels))
      this.$filteredLabels = {};
    return Mailbox.$$resource.fetch(this.id, 'labels').then(function(data) {
      _this.$labels = data;
      return _this.$labels;
    });
  };

  Mailbox.prototype.filteredByLabel = function() {
    return _.includes(this.$filteredLabels, 1);
  };

  /**
   * @function $flagMessages
   * @memberof Mailbox.prototype
   * @desc Add or remove a flag on a message set
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.$flagMessages = function(messages, flags, operation) {
    var data = {msgUIDs: _.map(messages, 'uid'),
                flags: flags,
                operation: operation};

    return Mailbox.$$resource.post(this.id, 'addOrRemoveLabel', data).then(function() {
      return messages;
    });
  };

  /**
   * @function forwardMessages
   * @memberof Mailbox.prototype
   * @desc Attach multiple messages to a new draft
   * @returns a promise of the HTTP operation with the draft coordinates
   */
  Mailbox.prototype.forwardMessages = function(messages) {
    var _this = this,
        uids = _.map(messages, 'uid');

    return Mailbox.$$resource.post(this.id, 'forwardMessages', { uids: uids }).then(function(data) {
      Mailbox.$log.debug('Forward selected messages: ' + JSON.stringify(data, undefined, 2));
      var message = new Mailbox.$Message(data.accountId, _this.$account.$getMailboxByPath(data.mailboxPath), data);
      return message;
    });
  };

  /**
   * @function saveSelectedMessages
   * @memberof Mailbox.prototype
   * @desc Download the selected messages
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.saveSelectedMessages = function() {
    var data, options, selectedMessages, selectedUIDs;

    selectedMessages = _.filter(this.$messages, function(message) { return message.selected; });
    selectedUIDs = _.map(selectedMessages, 'uid');
    data = { uids: selectedUIDs };
    options = { filename: l('Saved Messages.zip') };

    return Mailbox.$$resource.download(this.id, 'saveMessages', {uids: selectedUIDs});
  };

  /**
   * @function exportFolder
   * @memberof Mailbox.prototype
   * @desc Export this mailbox
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.exportFolder = function() {
    var options;

    options = { filename: this.name + '.zip' };

    return Mailbox.$$resource.open(this.id, 'exportFolder', null, options);
  };

  /**
   * @function $delete
   * @memberof Mailbox.prototype
   * @desc Delete the mailbox from the server
   * @param {object} [options] - additional options (use {withoutTrash: true} to delete immediately)
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.$delete = function(options) {
    var _this = this;

    return Mailbox.$$resource.post(this.id, 'delete', options)
      .then(function() {
        _this.$account.$getMailboxes({reload: true});
        return true;
      });
  };

  /**
   * @function $_deleteMessages
   * @memberof Mailbox.prototype
   * @desc Delete multiple messages from Mailbox object.
   * @param {string[]} uids - the messages uids
   * @return the index of the first deleted message
   */
  Mailbox.prototype.$_deleteMessages = function(uids) {
    var _this = this, firstIndex = this.$messages.length;

    // Remove messages from $messages and uidsMap
    _.forEachRight(this.$messages, function(message, index) {
      var selectedIndex = _.findIndex(uids, function(uid) {
        return message.uid == uid;
      });
      if (selectedIndex > -1) {
        uids.splice(selectedIndex, 1);
        delete _this.uidsMap[message.uid];
        if (message.uid == _this.$selectedMessage)
          delete _this.$selectedMessage;
        _this.$messages.splice(index, 1);
        if (index < firstIndex)
          firstIndex = index;
      }
      else {
        _this.uidsMap[message.uid] -= uids.length;
      }
    });

    if (this.threaded) {
      this.updateVisibleMessages();
    }

    // Return the index of the first deleted message
    return firstIndex;
  };

  /**
   * @function $deleteMessages
   * @memberof Mailbox.prototype
   * @desc Delete multiple messages from mailbox by batch of 1000 messages (see constant sgMailbox_BATCH_DELETE_LIMIT).
   * @param {object} [options] - additional options (use {withoutTrash: true} to delete immediately)
   * @return a promise of the HTTP operation
   */
  Mailbox.prototype.$deleteMessages = function(messages, options) {
    var _this = this, uids,
        batchSize = Mailbox.BATCH_DELETE_LIMIT;

    uids = _.map(messages, 'uid');

    // Recursive function to synchronously delete batch of messages
    function _deleteMessages(start, end) {
      var currentUids = uids.slice(start, end),
          data = { uids: currentUids };
      if (options) angular.extend(data, options);
      return Mailbox.$$resource.post(_this.id, 'batchDelete', data).then(function(data) {
        if (end < uids.length) {
          _this.$_deleteMessages(currentUids);
          return _deleteMessages(end, Math.min(end + batchSize, uids.length));
        }
        else {
          // Last API call; update inbox quota
          if (data.quotas)
            _this.$account.updateQuota(data.quotas);
          if (angular.isDefined(data.unseenCount))
            _this.unseenCount = data.unseenCount;

          return _this.$_deleteMessages(currentUids);
        }
      });
    }

    return _deleteMessages(0, Math.min(batchSize, uids.length)).then(function(firstIndex) {
      _this.$selectedMessages = []; // reset selection
      return firstIndex;
    });
  };

  /**
   * @function $markOrUnMarkMessagesAsJunk
   * @memberof Mailbox.prototype
   * @desc Mark messages as junk/not junk
   * @return a promise of the HTTP operation
   */
  Mailbox.prototype.$markOrUnMarkMessagesAsJunk = function(messages) {
    var _this = this,
        uids = _.map(messages, 'uid'),
        method = (this.type == 'junk' ? 'markMessagesAsNotJunk' : 'markMessagesAsJunk');

    return Mailbox.$$resource.post(this.id, method, {uids: uids});
  };

  /**
   * @function $copyMessages
   * @memberof Mailbox.prototype
   * @desc Copy multiple messages from the current mailbox to a target one
   * @return a promise of the HTTP operation
   */
  Mailbox.prototype.$copyMessages = function(messages, folder) {
    var _this = this,
        uids = _.map(messages, 'uid');

    return Mailbox.$$resource.post(this.id, 'copyMessages', {uids: uids, folder: folder})
      .then(function(data) {
        // Update inbox quota
        if (data.quotas)
          _this.$account.updateQuota(data.quotas);
        // Update destination folder unseen count
        if (angular.isDefined(data.destinationUnseenCount) && angular.isDefined(data.destinationFolder)) {
          var destMailbox = _this.$account.$getMailboxByPath(data.destinationFolder);
          if (destMailbox) {
            destMailbox.unseenCount = data.destinationUnseenCount;
          }
        }
      });
  };

  /**
   * @function $moveMessages
   * @memberof Mailbox.prototype
   * @desc Move multiple messages from the current mailbox to a target one
   * @return a promise of the HTTP operation
   */
  Mailbox.prototype.$moveMessages = function(messages, folder) {
    var _this = this, uids;

    uids = _.map(messages, 'uid');
    return Mailbox.$$resource.post(this.id, 'moveMessages', {uids: uids, folder: folder})
      .then(function(data) {
        if (angular.isDefined(data.unseenCount)) {
          _this.unseenCount = data.unseenCount;
        }
        // Update destination folder unseen count
        if (angular.isDefined(data.destinationUnseenCount) && angular.isDefined(data.destinationFolder)) {
          var destMailbox = _this.$account.$getMailboxByPath(data.destinationFolder);
          if (destMailbox) {
            destMailbox.unseenCount = data.destinationUnseenCount;
          }
        }
        _this.$selectedMessages = []; // reset selection
        return _this.$_deleteMessages(uids);
      });
  };

  /**
   * @function $move
   * @memberof Mailbox.prototype
   * @desc Move the mailbox to a different parent. Will reload the mailboxes list.
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.$move = function(parentPath) {
    var _this = this;

    return Mailbox.$$resource.post(this.id, 'move', {parent: parentPath}).finally(function() {
      _this.$account.$getMailboxes({reload: true});
      return true;
    });
  };

  /**
   * @function $save
   * @memberof Mailbox.prototype
   * @desc Save the mailbox to the server. This currently can only affect the name of the mailbox.
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.$save = function() {
    var _this = this;

    return Mailbox.$$resource.save(this.id, this.$omit()).then(function(data) {
      // Make a copy of the data for an eventual reset
      _this.$shadowData = _this.$omit();
      Mailbox.$log.debug(JSON.stringify(data, undefined, 2));
      return data;
    }, function(response) {
      Mailbox.$log.error(JSON.stringify(response.data, undefined, 2));
      // Restore previous version
      _this.$reset();
      return response.data;
    });
  };

  /**
   * @function $newMailbox
   * @memberof Mailbox.prototype
   * @desc Create a new mailbox on the server and refresh the list of mailboxes.
   * @returns a promise of the HTTP operations
   */
  Mailbox.prototype.$newMailbox = function(path, name) {
    return this.$account.$newMailbox(path, name);
  };

  /**
   * @function $reset
   * @memberof Mailbox.prototype
   * @desc Reset the original state the mailbox's data.
   */
  Mailbox.prototype.$reset = function(options) {
    var _this = this;
    var account;
    var currentUnseenCount;

    // For inbox, preserve current unseenCount as it's calculated dynamically from subfolders
    if (this.type === 'inbox') {
      currentUnseenCount = this.unseenCount;
    }

    angular.forEach(this.$shadowData, function(value, key) {
      delete _this[key];
    });
    account = Object.assign({}, _this.$account)
    angular.extend(this, this.$shadowData);
    this.$shadowData = this.$omit();
    this.account = account;

    // Restore unseenCount based on mailbox type
    if (this.type === 'inbox' && angular.isDefined(currentUnseenCount)) {
      // For inbox, keep the current value (calculated from subfolders)
      this.unseenCount = currentUnseenCount;
    } else if (options && options.unseenCount) {
      // For other folders, restore from options
      this.unseenCount = options.unseenCount;
    }

    if (options && options.unseenCount) {
      delete options["unseenCount"];
    }

    if (options && options.filter) {
      this.$messages = [];
      this.$visibleMessages = [];
      delete this.$syncToken;
    }
  };

  /**
   * @function $omit
   * @memberof Mailbox.prototype
   * @desc Return a sanitized object used to send to the server.
   * @return an object literal copy of the Mailbox instance
   */
  Mailbox.prototype.$omit = function(deep) {
    var mailbox = {},
        _visit = function(children) {
          var childrenArray = [];
          _.forEach(children, function(o) {
            childrenArray.push(o.$omit(deep));
          });
          return childrenArray;
        };

    angular.forEach(this, function(value, key) {
      if (key != 'constructor' &&
          key != 'children' &&
          key != 'headers' &&
          key != 'uids' &&
          key != 'uidsMap' &&
          key[0] != '$') {
        mailbox[key] = value;
      }
    });
    if (deep && this.children) {
      mailbox.children = _visit(this.children);
    }
    return mailbox;
  };

  /**
   * @function updateVisibleMessages
   * @memberof Mailbox.prototype
   * @desc Update list of visible messages when in threaded mode.
   */
  Mailbox.prototype.updateVisibleMessages = function() {
    var collapsedThread = false;

    if (this.threaded) {
      this.$visibleMessages = _.filter(this.$messages, function(msg, i) {
        if (msg.first) {
          collapsedThread = msg.collapsed;
        } else if (msg.level < 0) {
          collapsedThread = false; // leaving the thread
        }
        return msg.first || collapsedThread === false;
      });
    }
  };

  /**
   * @function $unwrap
   * @memberof Mailbox.prototype
   * @desc Unwrap a promise and instanciate new Message objects using received data.
   * @param {promise} futureMailboxData - a promise of the Mailbox's metadata
   * @returns a promise of the HTTP operation
   */
  Mailbox.prototype.$unwrap = function(futureMailboxData) {
    Mailbox.$rootScope.$broadcast('beforeListRefresh');
    var _this = this,
        deferred = Mailbox.$q.defer();

    this.$futureMailboxData = futureMailboxData;
    this.$futureMailboxData.then(function(data) {
      var selectedMessages = _.map(_this.$selectedMessages, 'uid');
      Mailbox.$timeout(function() {
        var uids, headers, headersFields, msgObject, hasNewMessages = false;

        if (!data.uids || _this.$topIndex > data.uids.length - 1)
          _this.$topIndex = 0;
        if (data.syncToken) {
          _this.$syncToken = data.syncToken;
        }

        if (data.deleted) {
          _.forEachRight(data.deleted, function(uid, i) {
            var j = _this.uidsMap[uid.toString()];
            if (j < 0 || !_this.$messages[j])
              // Unkown message
              data.deleted.splice(i, 1);
          });
          if (data.deleted.length)
            _this.$_deleteMessages(data.deleted);
        }
        if (data.changed) {
          var i = 0, j;
          _.forEach(data.changed, function(uid) {
            if (angular.isUndefined(_this.uidsMap[uid.toString()])) {
              // New messsage; update map of UID <=> index
              _this.uidsMap[uid] = i;
              _this.$messages.splice(i, 0, {uid: uid});
              hasNewMessages = true;
              i++;
            }
          });

          if (i > 0) {
            // New messages received, update uidsMap for existing messages
            for (j = i; j < _this.$messages.length; j++) {
              msgObject = _this.$messages[j];
              _this.uidsMap[msgObject.uid] += i;
            }
          }
        }
        if (angular.isDefined(data.unseenCount)) {
          _this.unseenCount = data.unseenCount;
        }

        if (data.uids) {
          // Initialization phase, we received complete list of UIDs
          Mailbox.$log.debug('unwrapping ' + data.uids.length + ' messages');

          hasNewMessages = true;
          _this.init(data);

          // First entry of 'uids' are keys when threaded view is enabled
          if (_this.threaded) {
            uids = _this.uids[0]; // uid, level, first
            _this.uids.splice(0, 1);
          }

          // Populate $messages with object literals
          _.reduce(_this.uids, function(msgs, msg, i) {
            var data;
            if (_this.threaded) {
              data = _.zipObject(uids, msg);
              if (data.first === 1) {
                var count = 1;
                while (_this.uids[i + count] &&
                       _this.uids[i + count][1] >= 0 &&
                       _this.uids[i + count][2] !== 1) {
                  count++;
                }
                data.count = count;
                data.collapsed = false;
                if (_this.$collapsedThreads.indexOf(data.uid.toString()) >= 0) {
                  data.collapsed = true;
                }
              }
              else if (!isNaN(data.level) && data.level >= 0) {
                data.threadMember = true;
              }

            } else {
              data = {uid: msg};
            }

            // Build map of UID <=> index
            _this.uidsMap[data.uid] = i;

            // Restore selection
            data.selected = selectedMessages.indexOf(data.uid) > -1;

            // Add an object literal to be used later to create a Message object
            msgs.push(data);

            return msgs;
          }, _this.$messages);
        }

        if (data.headers) {
          // First entry of 'headers' are keys
          headersFields = _.invokeMap(data.headers.splice(0, 1)[0], 'toLowerCase');
          headers = data.headers;

          // Instanciate or extend Message objects with received headers
          _.forEach(headers, function(data) {
            var msg = _.zipObject(headersFields, data),
                i = _this.uidsMap[msg.uid.toString()];
            if (!(_this.$messages[i] instanceof Mailbox.$Message)) {
              _this.$messages[i] = new Mailbox.$Message(_this.$account.id, _this, _this.$messages[i], true);
            }
            _this.$messages[i].init(msg);
          });
        }

        if (hasNewMessages && _this.threaded) {
          _this.updateVisibleMessages();
        }

        Mailbox.$log.debug('mailbox ' + _this.id + ' ready');
        _this.$isLoading = false;
        Mailbox.$rootScope.$broadcast('listRefreshed');
        deferred.resolve(_this.$messages);
      });
    }, function(data) {
      Mailbox.$log.error(data);
      angular.extend(_this, data);
      _this.isError = true;
      _this.$isLoading = false;
      deferred.reject();
    });

    return deferred.promise;
  };

  /**
   * @function $unwrapHeaders
   * @memberof Mailbox.prototype
   * @desc Unwrap a promise and extend matching Message objects using received data.
   * @param {promise} futureHeadersData - a promise of some messages metadata
   */
  Mailbox.prototype.$unwrapHeaders = function(futureHeadersData) {
    var _this = this;

    futureHeadersData.then(function(data) {
      Mailbox.$timeout(function() {
        var headers, j;
        if (data.length > 0) {
          // First entry of 'headers' are keys
          headers = _.invokeMap(data[0], 'toLowerCase');
          data.splice(0, 1);
          _.forEach(data, function(messageHeaders) {
            messageHeaders = _.zipObject(headers, messageHeaders);
            j = _this.uidsMap[messageHeaders.uid.toString()];
            if (angular.isDefined(j)) {
              if (!(_this.$messages[j] instanceof Mailbox.$Message)) {
                _this.$messages[j] = new Mailbox.$Message(_this.$account.id, _this, _this.$messages[j], true);
              }
              _this.$messages[j].init(messageHeaders);
            }
          });
          if (_this.threaded) {
            _this.updateVisibleMessages();
          }
        }
      });
    });
  };

  /**
   * @function $updateSubscribe
   * @memberof Mailbox.prototype
   * @desc Update mailbox subscription state with server.
   */
  Mailbox.prototype.$updateSubscribe = function() {
    var action = this.subscribed? 'subscribe' : 'unsubscribe';

    Mailbox.$$resource.post(this.id, action);
  };

  /**
   * @function setHighlightWords
   * @memberof Mailbox.prototype
   * @desc Set highlight words when searching
   * @param {array} highlightWords - a list of words
   */
  Mailbox.prototype.setHighlightWords = function (highlightWords) {
    this.$highlightWords = highlightWords;
  };

  /**
   * @function getHighlightWords
   * @memberof Mailbox.prototype
   * @desc Get highlight words when searching
   * @returns a list of words
   */
  Mailbox.prototype.getHighlightWords = function () {
    return this.$highlightWords;
  };

  /**
   * @function cleanMailbox
   * @memberof Mailbox.prototype
   * @desc Cleans up the mailbox by applying the specified parameters. 
   *       This can include operations such as moving emails to trash, 
   *       filtering emails based on a duration, and applying actions to subfolders.
   * @param {Object} parameters - An object containing the parameters for cleaning the mailbox.
   * @param {boolean} [parameters.applyToSubfolders=false] - Whether to apply the cleaning operation to subfolders.
   * @param {boolean} [parameters.moveToTrash=false] - Whether to move the emails to the trash folder.
   * @param {string|null} [parameters.filterDuration=null] - A duration filter (e.g., "3m", "6m") to select emails older than the specified duration.
   * @returns {Promise} A promise that resolves when the cleaning operation is completed, or rejects with an error if the operation fails.
   */
  Mailbox.prototype.cleanMailbox = function (parameters) {
    return parameters.folders.length > 0 ? Mailbox.$$resource.post(this.id.split("/")[0], 'cleanMailbox', parameters) : Mailbox.$$resource.post(this.id, 'cleanMailbox', parameters);
  };
  
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function () {
  'use strict';

  /**
   * @name Message
   * @constructor
   * @param {string} accountId - the account ID
   * @param {string} mailboxPath - an array of the mailbox path components
   * @param {object} futureAddressBookData - either an object literal or a promise
   * @param {bool} lazy - do "lazy loading" so we are very quick at initializing message instances
   */
  function Message(accountId, mailbox, futureMessageData, lazy) {
    this.accountId = accountId;
    this.$mailbox = mailbox;
    this.$hasUnsafeContent = false;
    this.$loadUnsafeContent = false;
    this.editable = { to: [], cc: [], bcc: [] };
    this.selected = false;

    // Data is immediately available
    if (typeof futureMessageData.then !== 'function') {
      //console.debug(JSON.stringify(futureMessageData, undefined, 2));
      if (angular.isUndefined(lazy) || !lazy) {
        this.init(futureMessageData);
      }
      this.uid = parseInt(futureMessageData.uid);
      this.selected = !!futureMessageData.selected;
      this.level = parseInt(futureMessageData.level);
      this.first = parseInt(futureMessageData.first) === 1;
      this.flags = [];
      if (this.first) {
        this.threadCount = parseInt(futureMessageData.count);
        this.collapsed = (futureMessageData.collapsed === true);
      }
      else if (!isNaN(this.level) && this.level >= 0) {
        this.threadMember = true;
      }
    }
    else {
      // The promise will be unwrapped first
      this.$unwrap(futureMessageData);
    }
  }

  /**
   * @memberof Message
   * @desc The factory we'll use to register with Angular
   * @returns the Message constructor
   */
  Message.$factory = ['$q', '$timeout', '$log', '$rootScope', 'sgSettings', 'sgMessage_STATUS', 'Resource', 'Preferences', function ($q, $timeout, $log, $rootScope, Settings, Message_STATUS, Resource, Preferences) {
    angular.extend(Message, {
      STATUS: Message_STATUS,
      $q: $q,
      $timeout: $timeout,
      $log: $log,
      $rootScope: $rootScope,
      $$resource: new Resource(Settings.activeUser('folderURL') + 'Mail', Settings.activeUser()),
      $Preferences: Preferences,
      $avatar: angular.bind(Preferences, Preferences.avatar)
    });

    // Initialize tags form user's defaults
    if (Preferences.defaults.SOGoMailLabelsColors) {
      Message.$tags = Preferences.defaults.SOGoMailLabelsColors;
    } else {
      Message.$tags = {};
    }
    if (Preferences.defaults.SOGoMailDisplayRemoteInlineImages &&
      Preferences.defaults.SOGoMailDisplayRemoteInlineImages == 'always') {
      Message.$displayRemoteInlineImages = true;
    }

    return Message; // return constructor
  }];

  /**
   * @module SOGo.MailerUI
   * @desc Factory registration of Message in Angular module.
   */
  try {
    angular.module('SOGo.MailerUI');
  }
  catch (e) {
    angular.module('SOGo.MailerUI', ['SOGo.Common']);
  }
  angular.module('SOGo.MailerUI')
    .constant('sgMessage_STATUS', {
      NOT_LOADED: 0,
      DELAYED_LOADING: 1,
      LOADING: 2,
      LOADED: 3,
      DELAYED_MS: 300
    })
    .factory('Message', Message.$factory);

  /**
   * @function filterTags
   * @memberof Message.prototype
   * @desc Search for tags (ie., mail labels) matching some criterias
   * @param {string} search - the search string to match
   * @returns a collection of strings
   */
  Message.filterTags = function (query, excludedTags) {
    var re = new RegExp(query, 'i'),
      results = [];

    _.forEach(_.keys(Message.$tags), function (tag) {
      var pair = Message.$tags[tag];
      if (pair[0].search(re) != -1) {
        if (!_.includes(excludedTags, tag))
          results.push({ name: tag, description: pair[0], color: pair[1] });
      }
    });

    return results;
  };

  /**
   * @function init
   * @memberof Message.prototype
   * @desc Extend instance with new data and massage some attributes.
   * @param {object} data - attributes of message
   */
  Message.prototype.init = function (data) {
    var _this = this;
    angular.extend(this, data);
    this.$formatFullAddresses();
    this.$loadUnsafeContent = false;
    _.forEach(this.flags, function (flag, i) {
      if (flag.charAt(0) == '$') {
        _this.flags.splice(i, 1, '_' + flag);
      }
    });
    // isread will be undefined when composing a new message -- assume unseen flag is not set.
    this.isread = angular.isDefined(this.isread) ? !!this.isread : true;
  };

  /**
   * @function $absolutePath
   * @memberof Message.prototype
   * @desc Build the path of the message
   * @returns a string representing the path relative to the mail module
   */
  Message.prototype.$absolutePath = function (options) {
    var _this = this, id = this.id;

    function buildPath() {
      var path;
      path = _.map(_this.$mailbox.path.split('/'), function (component) {
        return 'folder' + component.asCSSIdentifier();
      });
      path.splice(0, 0, _this.accountId); // insert account ID
      return path.join('/');
    }

    if (angular.isUndefined(this.id) || options && options.nocache) {
      this.id = buildPath() + '/' + this.uid; // add message UID
      id = this.id;
    }
    if (options && options.asDraft && this.draftId) {
      id = buildPath() + '/' + this.draftId; // add draft ID
    }
    if (options && options.withResourcePath) {
      id = Message.$$resource.path(id); // return absolute URL
    }

    return id;
  };

  /**
   * @function $setUID
   * @memberof Message.prototype
   * @desc Change the UID of the message. This happens when saving a draft.
   * @param {number} uid - the new message UID
   */
  Message.prototype.$setUID = function (uid) {
    var oldUID = (this.uid || -1), _this = this, index;

    if (oldUID != parseInt(uid)) {
      this.uid = parseInt(uid);
      this.$absolutePath({ nocache: true });
      if (oldUID > -1) {
        oldUID = oldUID.toString();
        if (angular.isDefined(this.$mailbox.uidsMap[oldUID])) {
          index = this.$mailbox.uidsMap[oldUID];
          this.$mailbox.uidsMap[uid] = index;
          delete this.$mailbox.uidsMap[oldUID];
          this.$mailbox.$messages[index].uid = this.uid;

          // Update messages list of mailbox
          _.forEach(['from', 'to', 'subject'], function (attr) {
            _this.$mailbox.$messages[index][attr] = _this.editable[attr];
          });
        }
      }
      else {
        // Refresh selected folder if it's the drafts mailbox
        if (this.$mailbox.constructor.selectedFolder &&
          this.$mailbox.constructor.selectedFolder.type == 'draft') {
          this.$mailbox.constructor.selectedFolder.$filter();
        }
      }
    }
  };

  /**
   * @function $formatFullAddresses
   * @memberof Message.prototype
   * @desc Format all sender and recipients addresses with a complete description (name <email>).
   *       This function also generates the avatar URL for each email address and a short name
   */
  Message.prototype.$formatFullAddresses = function () {
    var _this = this;
    var identities = _.map(_this.$mailbox.$account.identities, 'email');

    // Build long representation of email addresses
    _.forEach(['from', 'to', 'cc', 'bcc', 'reply-to'], function (type) {
      _.forEach(_this[type], function (data) {
        if (data.name && data.name != data.email) {
          data.full = data.name + ' <' + data.email + '>';

          if (data.name.length < 10)
            // Name is already short
            data.shortname = data.name;
          else if (data.name.split(' ').length)
            // If we have "Alice Foo" or "Foo, Alice" as name, we grab "Alice"
            data.shortname = _.first(_.last(data.name.split(/, */)).split(/ +/)).replace('\'', '');
        }
        else if (data.email) {
          data.full = '<' + data.email + '>';
          data.shortname = data.email.split('@')[0];
        }

        data.image = Message.$avatar(data.email, 32);

        // If the current user is the recepient, overwrite
        // the short name with 'me'
        if (_.indexOf(identities, data.email) >= 0)
          data.shortname = l('me');
      });
    });
  };

  /**
   * @function $shortRecipients
   * @memberof Message.prototype
   * @desc Format all recipients into a very compact string
   * @returns a compacted string of all recipients
   */
  Message.prototype.$shortRecipients = function (max) {
    var _this = this, result = [], count = 0, total = 0;

    // Build short representation of email addresses
    _.forEach(['to', 'cc', 'bcc'], function (type) {
      total += _this[type] ? _this[type].length : 0;
      _.forEach(_this[type], function (data, i) {
        if (count < max)
          result.push(data.shortname);
        count++;
      });
    });

    if (total > max)
      result.push(l('and %{0} more...', (total - max)));

    return result.join(', ');
  };

  /**
   * @function $shortAddress
   * @memberof Message.prototype
   * @desc Format the first address of a specific type with a short description.
   * @returns a string of the name or the email of the envelope address type
   */
  Message.prototype.$shortAddress = function (type, fullEmail) {
    var address = '';
    if (this[type]) {
      if (angular.isString(this[type])) {
        // The recipient is a string; try to extract the name
        var emailRE = /<?(([\w\!\#$\%\&\'\*\+\-\/\=\?\^\`{\|\}\~]+\.)*[\w\!\#$\%\&\'\*\+\-\/\=\?\^\`{\|\}\~]+@((((([a-z0-9]{1}[a-z0-9\-]{0,62}[a-z0-9]{1})|[a-z])\.)+[a-z]{2,})|(\d{1,3}\.){3}\d{1,3}(\:\d{1,5})?))/i;
        var match = this[type].match(String.emailRE);
        if (match) {
          address = this[type].substring(0, match.index);
          address = address.replace(/^\"? *(.+?)\"? *$/, "$1");
        }
        if (!address.length)
          address = this[type];
      }
      else if (this[type].length > 0) {
        // We have an array of objects; pick the first one
        if(!fullEmail)
          address = this[type][0].name || this[type][0].email || '';
        else if(this[type][0].name && this[type][0].email)
          address = this[type][0].name + ' <' + this[type][0].email +'>';
        else if(this[type][0].name)
          address = this[type][0].name;
        else if(this[type][0].email)
          address = this[type][0].email;
        else
          address =  '';
      }
    }

    return punycode.toUnicode(address);
  };

  /**
   * @function allowReplyAll
   * @memberof Message.prototype
   * @desc Check if 'Reply to All' is an appropriate action on the message.
   * @returns true if the message is not a draft and has more than one recipient
   */
  Message.prototype.allowReplyAll = function () {
    var identities = _.map(this.$mailbox.$account.identities, 'email');
    var recipientsCount = 0;
    recipientsCount = _.reduce(['to', 'cc', 'bcc', 'reply-to'], _.bind(function (count, type) {
      var typeCount = 0;
      if (this[type]) {
        typeCount = this[type].length;
        _.forEach(this[type], function (recipient) {
          if (_.indexOf(identities, recipient.email) >= 0) {
            typeCount--;
          }
        });
        return count + typeCount;
      }
      else {
        return count;
      }
    }, this), recipientsCount);

    return !this.isDraft && recipientsCount > 1;
  };

  /**
   * @function loadUnsafeContent
   * @memberof Message.prototype
   * @desc Mark the message to load unsafe resources when calling $content().
   */
  Message.prototype.loadUnsafeContent = function () {
    this.$loadUnsafeContent = true;
    delete this.$parts;
  };

  /**
   * @function $content
   * @memberof Message.prototype
   * @desc Get the message body as accepted by SCE (Angular Strict Contextual Escaping).
   * @returns the HTML representation of the body
   */
  Message.prototype.$content = function () {
    // Punycode
    if (this.to && this.to.length > 0) {
      this.to.forEach(function (element, i, arr) {
        if (element.email && element.email.indexOf('@') > 0)
          arr[i].email = punycode.toUnicode(element.email);
      });
    }
    if (this.from && this.from.indexOf('@') > 0)
      this.from = punycode.toUnicode(this.from);

    var _this = this,
      parts = [],



      _visit = function (part) {
        part.msgclass = 'msg-attachment-other';
        if (part.type == 'UIxMailPartAlternativeViewer') {
          _visit(_.find(part.content, function (alternatePart) {
            return part.preferredPart == alternatePart.contentType;
          }));
        }
        // Can be used for UIxMailPartMixedViewer, UIxMailPartMessageViewer, and UIxMailPartSignedViewer
        else if (angular.isArray(part.content)) {
          if (part.type == 'UIxMailPartSignedViewer' && part['supports-smime'] === 1) {
            _this.signed = {
              valid: part.valid,
              certificate: part.certificates[part.certificates.length - 1],
              message: part.message
            };
          }
          else if (part.type == 'UIxMailPartEncryptedViewer') {
            if (part.encrypted) {
              _this.encrypted = {
                valid: part.decrypted
              };
              if (part.decrypted)
                _this.encrypted.message = l("This message is encrypted");
              else
                _this.encrypted.message = l("This message can't be decrypted. Please make sure you have uploaded your S/MIME certificate from the mail preferences module.");
            }
            if (part.opaqueSigned) {
              _this.signed = {
                valid: part.valid,
                certificate: part.certificates[part.certificates.length - 1],
                message: part.message
              };
            }
          }
          var winmail = _.find(part.content, function (mixedPart) {
            // Ignore empty content -- that could mean a decoding error server-side.
            return mixedPart.type == 'UIxMailPartTnefViewer' && mixedPart.content.length > 0;
          });

          if (winmail && !_.find(part.content, function (mixedPart) {
            return mixedPart.type == 'UIxMailPartAlternativeViewer';
          })) {
            // If there's no alternate part in the message, show the winmail.dat attachment only.
            // Otherwise, show all parts.
            _visit(winmail);
          }
          else {
            _.forEach(part.content, function (mixedPart) {
              _visit(mixedPart);
            });
          }
        }
        else {
          if (angular.isUndefined(part.safeContent)) {
            // Keep a copy of the original content
            part.safeContent = part.content;
            _this.$hasUnsafeContent |= (part.safeContent.indexOf(' unsafe-') > -1);
          }
          if (part.type == 'UIxMailPartHTMLViewer') {
            part.html = true;
            if (_this.$loadUnsafeContent || Message.$displayRemoteInlineImages) {
              if (angular.isUndefined(part.unsafeContent)) {
                part.unsafeContent = document.createElement('div');
                part.unsafeContent.innerHTML = part.safeContent;
                angular.forEach(['src', 'data', 'classid', 'background', 'style'], function (suffix) {
                  var elements = part.unsafeContent.querySelectorAll('[unsafe-' + suffix + ']'),
                    element,
                    value,
                    i;
                  for (i = 0; i < elements.length; i++) {
                    element = angular.element(elements[i]);
                    value = element.attr('unsafe-' + suffix);
                    element.attr(suffix, value);
                    element.removeAttr('unsafe-' + suffix);
                  }
                });
                _this.$hasUnsafeContent = false;
              }
              part.content = part.unsafeContent.innerHTML;
            }
            else {
              part.content = part.safeContent;
            }
            parts.push(part);
          }
          else if (part.type == 'UIxMailPartICalViewer' ||
            part.type == 'UIxMailPartImageViewer' ||
            part.type == 'UIxMailPartLinkViewer') {

            if (part.type == 'UIxMailPartImageViewer')
              part.msgclass = 'msg-attachment-image';
            else if (part.type == 'UIxMailPartLinkViewer')
              part.msgclass = 'msg-attachment-link';

            // Trusted content that can be compiled (Angularly-speaking)
            part.compile = true;
            if (!Object.hasOwn(part, 'shouldDisplayAttachment') || 1 == part.shouldDisplayAttachment ) {
              if(Message.$Preferences.defaults.SOGoMailDisplayAttachmentAbove) {
                parts.unshift(part);
              }
              else {
                parts.push(part);
              }
            }
          }
          else {
            part.html = true;
            part.content = part.safeContent;
            parts.push(part);
          }
        }
      };

    

    if (this.$parts)
      // Use the cache
      return this.$parts;

    else if (this.parts)
      _visit(this.parts);


    // Highlight words
    if (parts && this.$mailbox && this.$mailbox.getHighlightWords().length > 0) {
      var i = 0, j = 0;
      for (i = 0; i < parts.length; i++) {
        if (parts[i]
          && parts[i].type
          && ("UIxMailPartHTMLViewer" == parts[i].type
          || "UIxMailPartTextViewer" == parts[i].type)) {
          // Content
          parts[i].content = this.highlightSearchTerms(parts[i].content, false);
          // Title
          this.subject = this.getHighlightSubject();
          // From
          this.from = this.getHighlightFrom();
        }
      }
    }

    // Cache result
    this.$parts = parts;

    return parts;
  };

  /**
   * @function highlightSearchTerms
   * @memberof Message.prototype
   * @desc Returns the data with highlight search
   * @returns the data with highlighted search terms
   */
  Message.prototype.highlightSearchTerms = function (data, encodeEntities) {
    var i = 0;
    if (this.$mailbox.getHighlightWords() 
        && this.$mailbox.getHighlightWords().length > 0 
        && data 
        && -1 === data.indexOf("data-markjs")) {
      var dom = document.createElement("DIV");
      dom.innerHTML = encodeEntities ? data.encodeEntities() : data;
      var markInstance = new Mark(dom);
      markInstance.mark(this.$mailbox.getHighlightWords());
      data = dom.innerHTML;
      dom.remove();
    } else if (encodeEntities) {
      data = data.encodeEntities();
    }

    return data;
  };

  /**
   * @function getHighlightSubject
   * @memberof Message.prototype
   * @desc Returns the subject with highlight search
   * @returns the subject with highlighted search terms
   */
  Message.prototype.getHighlightSubject = function () {   
    return this.highlightSearchTerms(this.subject, false);
  };

  /**
   * @function getHighlightFrom
   * @memberof Message.prototype
   * @desc Returns the from with highlight search
   * @returns the from with highlighted search terms
   */
  Message.prototype.getHighlightFrom = function () {
    var i = 0;
    for (i = 0; i < this.from.length; i++) {
      this.from[i].fullHighlighted = this.highlightSearchTerms(this.from[i].full, false);
      this.from[i].nameHighlighted = this.highlightSearchTerms(this.from[i].name, false);
    }

    return this.from;
  };

  /**
   * @function $editableContent
   * @memberof Message.prototype
   * @desc First, fetch the draft ID that corresponds to the temporary draft object on the SOGo server.
   * Secondly, fetch the editable message body along with other metadata such as the recipients.
   * @returns the HTML representation of the body
   */
  Message.prototype.$editableContent = function () {
    var _this = this;

    return Message.$$resource.fetch(this.$absolutePath(), 'edit').then(function (data) {
      angular.extend(_this, data);
      return Message.$$resource.fetch(_this.$absolutePath({ asDraft: true }), 'edit').then(function (data) {
        // Try to match a known account identity from the specified "from" address
        var identity = _.find(_this.$mailbox.$account.identities, function (identity) {
          return data.from && data.from.toLowerCase().indexOf(identity.email) !== -1;
        });
        if (identity)
          data.from = identity.full;
        var accountDefaults = Message.$Preferences.defaults.AuxiliaryMailAccounts[_this.$mailbox.$account.id];
        if (accountDefaults.security) {
          if (accountDefaults.security.alwaysSign)
            data.sign = true;
          if (accountDefaults.security.alwaysEncrypt)
            data.encrypt = true;
        }
        Message.$log.debug('editable = ' + JSON.stringify(data, undefined, 2));
        angular.extend(_this.editable, data);
        return data.text;
      });
    });
  };

  /**
   * @function $plainContent
   * @memberof Message.prototype
   * @returns the a plain text representation of the subject and body
   */
  Message.prototype.$plainContent = function () {
    return Message.$$resource.fetch(this.$absolutePath(), 'viewplain');
  };

  /**
   * @function addTag
   * @memberof Message.prototype
   * @desc Add a mail tag on the current message.
   * @param {string} tag - the tag name
   * @returns a promise of the HTTP operation
   */
  Message.prototype.addTag = function (tag) {
    var _this = this,
      _tag = tag.replace(/^_\$/, '$');
    return this.$mailbox.getLabels().then(function (labels) {
      var reload = !_.find(labels, function (label) {
        return label.imapName == _tag;
      });
      return _this.$addOrRemoveTag('add', tag).then(function () {
        if (reload)
          // Update the list of labels for the mailbox
          _this.$mailbox.getLabels({ reload: true });
      });
    });
  };

  /**
   * @function removeTag
   * @memberof Message.prototype
   * @desc Remove a mail tag from the current message.
   * @param {string} tag - the tag name
   * @returns a promise of the HTTP operation
   */
  Message.prototype.removeTag = function (tag) {
    return this.$addOrRemoveTag('remove', tag);
  };

  /**
   * @function $addOrRemoveTag
   * @memberof Message.prototype
   * @desc Add or remove a mail tag on the current message.
   * @param {string} operation - the operation name to perform
   * @param {string} tag - the tag name
   * @returns a promise of the HTTP operation
   */
  Message.prototype.$addOrRemoveTag = function (operation, tag) {
    var data = {
      operation: operation,
      msgUIDs: [this.uid],
      flags: tag.replace(/^_\$/, '$')
    };

    if (tag)
      return Message.$$resource.post(this.$mailbox.$id(), 'addOrRemoveLabel', data);
  };

  /**
   * @function toggleRead
   * @memberof Message.prototype
   * @desc Toggle message unseen status
   * @returns a promise of the HTTP operation
   */
  Message.prototype.toggleRead = function () {
    var _this = this;

    if (this.isread)
      return Message.$$resource.fetch(this.$absolutePath(), 'markMessageUnread').then(function () {
        Message.$timeout(function () {
          _this.isread = false;
          _this.$mailbox.unseenCount++;
          Message.$rootScope.$broadcast('mailbox:unseenCountChanged', _this.$mailbox);
        });
      });
    else
      return Message.$$resource.fetch(this.$absolutePath(), 'markMessageRead').then(function () {
        Message.$timeout(function () {
          _this.isread = true;
          _this.$mailbox.unseenCount--;
          Message.$rootScope.$broadcast('mailbox:unseenCountChanged', _this.$mailbox);
        });
      });
  };

  /**
   * @function $imipAction
   * @memberof Message.prototype
   * @desc Perform IMIP actions on the current message.
   * @param {string} path - the path of the IMIP calendar part
   * @param {string} action - the the IMIP action to perform
   * @param {object} data - the delegation info
   */
  Message.prototype.$imipAction = function (path, action, data) {
    var _this = this;
    Message.$$resource.post([this.$absolutePath(), path].join('/'), action, data).then(function (data) {
      Message.$timeout(function () {
        _this.$reload();
      });
    });
  };

  /**
   * @function $sendMDN
   * @memberof Message.prototype
   * @desc Send MDN response for current email message
   */
  Message.prototype.$sendMDN = function () {
    this.shouldAskReceipt = 0;
    return Message.$$resource.post(this.$absolutePath(), 'sendMDN');
  };

  /**
   * @function hasAttachments
   * @memberof Message.prototype
   * @returns true if there's one ore more attached files
   */
  Message.prototype.hasAttachments = function (content) {
    var _this = this;

    return !!_.find(content || this.parts.content, function (part) {
      if (angular.isArray(part.content)) {
        return _this.hasAttachments(part.content);
      }
      return part.type == 'UIxMailPartLinkViewer' || part.type == 'UIxMailPartImageViewer';
    });
  };

  /**
   * @function $deleteAttachment
   * @memberof Message.prototype
   * @desc Delete an attachment from a message being composed
   * @param {string} filename - the filename of the attachment to delete
   */
  Message.prototype.$deleteAttachment = function (filename) {
    var data = { 'filename': filename };
    var _this = this;
    return Message.$$resource.fetch(this.$absolutePath({ asDraft: true }), 'deleteAttachment', data).then(function () {
      Message.$timeout(function () {
        _this.editable.attachmentAttrs = _.filter(_this.editable.attachmentAttrs, function (attachment) {
          return attachment.filename != filename;
        });
      });
    });
  };

  /**
   * @function toggleFlag
   * @memberof Message.prototype
   * @desc Add or remove a the \\Flagged flag on the current message.
   * @returns a promise of the HTTP operation
   */
  Message.prototype.toggleFlag = function () {
    var _this = this,
      action = 'markMessageFlagged';

    if (this.isflagged)
      action = 'markMessageUnflagged';

    return Message.$$resource.post(this.$absolutePath(), action).then(function (data) {
      Message.$timeout(function () {
        _this.isflagged = !_this.isflagged;
      });
    });
  };

  /**
   * @function toggleThread
   * @memberof Message.prototype
   * @desc Collapse or expand mail thread
   * @returns a promise of the HTTP operation
   */
  Message.prototype.toggleThread = function () {
    var _this = this,
      action = 'markMessageCollapse';

    if (this.collapsed)
      action = 'markMessageUncollapse';

    this.collapsed = !this.collapsed;
    this.$mailbox.updateVisibleMessages();

    return Message.$$resource.post(this.$absolutePath(), action).catch(function () {
      this.collapsed = !this.collapsed;
      _this.$mailbox.updateVisibleMessages();
    });
  };

  /**
   * @function $isLoading
   * @memberof Message.prototype
   * @returns true if the Message content is still being retrieved from server after a specific delay
   * @see sgMessage_STATUS
   */
  Message.prototype.$isLoading = function () {
    return this.$loaded == Message.STATUS.LOADING;
  };

  /**
   * @function $reload
   * @memberof Message.prototype
   * @desc Fetch the viewable message body along with other metadata such as the list of attachments.
   * @param {object} [options] - set {useCache: true} to use already fetched data, {raw: true} to remove web mail alteration
   * @returns a promise of the HTTP operation
   */
  Message.prototype.$reload = function (options) {
    var _this = this, futureMessageData;

    if (options && options.useCache && this.$futureMessageData) {
      // The message has already been fetched.
      if (!this.isread) {
        if (Message.$Preferences.defaults.SOGoMailAutoMarkAsReadDelay > -1)
          // Automatically mark message as read
          _this.$markAsReadPromise = Message.$timeout(function () {
            Message.$$resource.fetch(_this.$absolutePath(), 'markMessageRead').then(function () {
              _this.isread = true;
              _this.$mailbox.unseenCount--;
              Message.$rootScope.$broadcast('mailbox:unseenCountChanged', _this.$mailbox);
            });
          }, Message.$Preferences.defaults.SOGoMailAutoMarkAsReadDelay * 1000);
      }
      return this;
    }

    if (options && options.raw)
      futureMessageData = Message.$$resource.fetch(this.$absolutePath(options), 'viewRaw');
    else
      futureMessageData = Message.$$resource.fetch(this.$absolutePath(options), 'view');

    return this.$unwrap(futureMessageData);
  };

  /**
   * @function $parseMailto
   * @memberof Message.prototype
   * @desc Extend the editable content of the message with the
   * information parsed from the specified "mailto:" link.
   */
  Message.prototype.$parseMailto = function (mailto) {
    var to, data = {}, match = /^mailto:([^\?]+)/.exec(mailto);
    if (match) {
      // Recipients
      to = _.map(decodeURIComponent(match[1]).split(','), function (email) {
        return '<' + email.trim() + '>';
      });
      data = { to: to };
    }
    // Subject & body
    _.forEach(['subject', 'body'], function (param) {
      var re = new RegExp(param + '=([^&]+)');
      param = (param == 'body') ? 'text' : param;
      match = re.exec(mailto);
      if (match)
        data[param] = decodeURIComponent(match[1]);
    });
    if ('html' == Message.$Preferences.defaults.SOGoMailComposeMessageType && data.text && data.text.length > 0) {
      data.text = data.text.replace(/(\r\n|\n|\r)/g, '<br/>');
    }
      
    // Other Recipients
    _.forEach(['cc', 'bcc'], function (param) {
      var re = new RegExp(param + '=([^&]+)');
      match = re.exec(mailto);
      if (match)
        data[param] = _.map(decodeURIComponent(match[1]).split(','), function (email) {
          return '<' + email.trim() + '>';
        });
    });
    if (!_.isEmpty(data))
      angular.extend(this.editable, data);
  };

  /**
   * @function $reply
   * @memberof Message.prototype
   * @desc Prepare a new Message object as a reply to the sender.
   * @returns a promise of the HTTP operations
   */
  Message.prototype.$reply = function () {
    return this.$newDraft('reply');
  };

  /**
   * @function $replyAll
   * @memberof Message.prototype
   * @desc Prepare a new Message object as a reply to the sender and all recipients.
   * @returns a promise of the HTTP operations
   */
  Message.prototype.$replyAll = function () {
    return this.$newDraft('replyall');
  };

  /**
   * @function $forward
   * @memberof Message.prototype
   * @desc Prepare a new Message object as a forward.
   * @returns a promise of the HTTP operations
   */
  Message.prototype.$forward = function () {
    return this.$newDraft('forward');
  };

  /**
   * @function $compose
   * @memberof Message.prototype
   * @desc Prepare a new Message object as a new draft from a copy of this message.
   * @returns a promise of the HTTP operations
   */
  Message.prototype.$compose = function () {
    return this.$newDraft('compose');
  };

  /**
   * @function $newDraft
   * @memberof Message.prototype
   * @desc Prepare a new Message object as a reply, a forward or a copy of the current message and associated
   * to the draft mailbox.
   * @see {@link Account.$newMessage}
   * @see {@link Message.$editableContent}
   * @see {@link Message.$reply}
   * @see {@link Message.$replyAll}
   * @see {@link Message.$forwad}
   * @param {string} action - the HTTP action to perform on the message
   * @returns a promise of the HTTP operations
   */
  Message.prototype.$newDraft = function (action) {
    var _this = this;

    // Query server for draft folder and draft UID
    return Message.$$resource.fetch(this.$absolutePath(), action).then(function (data) {
      var mailbox, message;
      Message.$log.debug('New ' + action + ': ' + JSON.stringify(data, undefined, 2));
      mailbox = _this.$mailbox.$account.$getMailboxByPath(data.mailboxPath);
      message = new Message(data.accountId, mailbox, data);
      // Fetch draft initial data
      return Message.$$resource.fetch(message.$absolutePath({ asDraft: true }), 'edit').then(function (data) {
        Message.$log.debug('New ' + action + ': ' + JSON.stringify(data, undefined, 2) + ' original UID: ' + _this.uid);
        var accountDefaults = Message.$Preferences.defaults.AuxiliaryMailAccounts[_this.$mailbox.$account.id];
        if (accountDefaults.security) {
          if (accountDefaults.security.alwaysSign)
            data.sign = true;
          if (accountDefaults.security.alwaysEncrypt)
            data.encrypt = true;
        }
        if (data.isHTML) {
          // Sanitize HTML replies to properly display quoted content in CKEditor.
          // Don't use the DOM to avoid triggering any event.
          var html = data.text;
          html = html.replace(/<\/?html[^>]*>/g, '');
          html = html.replace(/<\/?body[^>]*>/g, '');
          html = html.replace(/<meta[^>]*>.*<\/meta>/g, '');
          html = html.replace(/<link[^>]*>.*<\/link>/g, '');
          html = html.replace(/<base[^>]*>.*<\/base>/g, '');
          html = html.replace(/<title[^>]*>.*<\/title>/g, '');
          data.text = html;
        }
        angular.extend(message.editable, data);

        // We keep a reference to our original message in order to update the flags
        message.origin = { message: _this, action: action };
        return message;
      });
    });
  };

  /**
   * @function $save
   * @memberof Message.prototype
   * @desc Save the message to the server.
   * @returns a promise of the HTTP operation
   */
  Message.prototype.$save = function () {
    var _this = this,
      data = this.$omit();

    Message.$log.debug('save = ' + JSON.stringify(data, undefined, 2));

    return Message.$$resource.save(this.$absolutePath({ asDraft: true }), data).then(function (response) {
      Message.$log.debug('save = ' + JSON.stringify(response, undefined, 2));
      _this.$setUID(response.uid);
      _this.$reload(); // fetch a new viewable version of the message
      _this.isNew = false;
    });
  };

  /**
   * @function $punycode
   * @memberof Message.prototype
   * @desc Encode an email address string
   * @returns an RFC 3492  email encoded
   */
  Message.prototype.punycode = function (element) {
    var re = /<(.*)>|^([\w\-\.@]+)$/gm;
    var r = re.exec(element);
    var puny = element;
    if (r && r.length > 0 && r[1]) {
      puny = r[1];
    }
    return element.replace(puny, punycode.toASCII(puny));
  };

  /**
   * @function $send
   * @memberof Message.prototype
   * @desc Send the message.
   * @returns a promise of the HTTP operation
   */
  Message.prototype.$send = function () {
    var _this = this,
      data = this.$omit();

    Message.$log.debug('send = ' + JSON.stringify(data, undefined, 2));

    // Punycode
    if (data.to && data.to.length > 0) {
      data.to.forEach(function (element, i, arr) {
        arr[i] = _this.punycode(element);
      });
    }
    if (data.bcc && data.bcc.length > 0) {
      data.bcc.forEach(function (element, i, arr) {
        arr[i] = _this.punycode(element);
      });
    }
    if (data.cc && data.cc.length > 0) {
      data.cc.forEach(function (element, i, arr) {
        arr[i] = _this.punycode(element);
      });
    }
    data.from = _this.punycode(data.from);

    return Message.$$resource.post(this.$absolutePath({ asDraft: true }), 'send', data).then(function (response) {
      if (response.status == 'success') {
        if (angular.isDefined(_this.origin)) {
          if (_this.origin.action.startsWith('reply'))
            _this.origin.message.isanswered = true;
          else if (_this.origin.action == 'forward')
            _this.origin.message.isforwarded = true;
        }
        return response;
      }
      else {
        return Message.$q.reject(response.data);
      }
    });
  };

  /**
   * @function $unwrap
   * @memberof Message.prototype
   * @desc Unwrap a promise.
   * @param {promise} futureMessageData - a promise of some of the Message's data
   */
  Message.prototype.$unwrap = function (futureMessageData) {
    var _this = this;

    // Message is not loaded yet
    this.$loaded = Message.STATUS.DELAYED_LOADING;
    Message.$timeout(function () {
      if (_this.$loaded != Message.STATUS.LOADED)
        _this.$loaded = Message.STATUS.LOADING;
    }, Message.STATUS.DELAYED_MS);

    // Resolve and expose the promise
    this.$futureMessageData = futureMessageData.then(function (data) {
      // Calling $timeout will force Angular to refresh the view
      if (!data.isRead) {
        if (Message.$Preferences.defaults.SOGoMailAutoMarkAsReadDelay > -1)
          // Automatically mark message as read
          _this.$markAsReadPromise = Message.$timeout(function () {
            Message.$$resource.fetch(_this.$absolutePath(), 'markMessageRead').then(function () {
              _this.isread = true;
              _this.$mailbox.unseenCount--;
              Message.$rootScope.$broadcast('mailbox:unseenCountChanged', _this.$mailbox);
            });
          }, Message.$Preferences.defaults.SOGoMailAutoMarkAsReadDelay * 1000);
      }
      else if (!_this.isread) {
        // Message as already been marked read on the server
        _this.isread = true;
        _this.$mailbox.unseenCount--;
        Message.$rootScope.$broadcast('mailbox:unseenCountChanged', _this.$mailbox);
      }
      return Message.$timeout(function () {
        delete _this.$parts;
        _this.$loaded = Message.STATUS.LOADED;
        _this.init(data);
        return _this;
      });
    });

    return this.$futureMessageData;
  };

  /**
   * @function $omit
   * @memberof Message.prototype
   * @desc Return a sanitized object used to send to the server.
   * @return an object literal copy of the Message instance
   */
  Message.prototype.$omit = function (options) {
    var message = {},
      privateAttributes = options && options.privateAttributes,
      source = privateAttributes ? this : this.editable;
    angular.forEach(source, function (value, key) {
      if (_.includes(['to', 'cc', 'bcc'], key) && !privateAttributes) {
        message[key] = _.map(value, function (addr) {
          return addr.toString();
        });
      }
      else if (key != 'constructor' && key[0] != '$' || privateAttributes) {
        message[key] = value;
      }
    });

    return message;
  };

  /**
   * @function downloadArchive
   * @memberof Message.prototype
   * @desc Download the current message as a zip archive
   * @returns a promise of the HTTP operation
   */
  Message.prototype.downloadArchive = function () {
    var data, options;

    data = { uids: [this.uid] };
    options = { filename: this.subject + '.zip' };

    return Message.$$resource.download(this.$mailbox.id, 'saveMessages', data, options);
  };

  /**
   * @function download
   * @memberof Message.prototype
   * @desc Download the current message as a eml file
   * @returns a promise of the HTTP operation
   */
  Message.prototype.download = function () {
    var options;

    options = { filename: this.subject + '.eml', type: 'message/rfc822' };
    return Message.$$resource.download(this.$absolutePath(), 'export', undefined, options);
  };

  /**
   * @function downloadAttachments
   * @memberof Message.prototype
   * @desc Download a zip archive of all attachments
   * @returns a promise of the HTTP operation
   */
  Message.prototype.downloadAttachmentsArchive = function () {
    var options;

    options = { filename: l('attachments') + "-" + this.uid + ".zip" };

    return Message.$$resource.download(this.$absolutePath(), 'archiveAttachments', null, options);
  };

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @name VirtualMailbox
   * @constructor
   * @param {object} account - the mail account associated with the virtual search
   */
  function VirtualMailbox(account) {
    this.$account = account;
  }

  /**
   * @memberof VirtualMailbox
   * @desc The factory we'll use to register with Angular
   * @returns the VirtualMailbox constructor
   */
  VirtualMailbox.$factory = ['$q', '$timeout', '$log', '$rootScope', 'sgSettings', 'Resource', 'Message', 'Mailbox', 'sgMailbox_PRELOAD', function ($q, $timeout, $log, $rootScope, Settings, Resource, Mailbox, Message, PRELOAD) {
    angular.extend(VirtualMailbox, {
      $q: $q,
      $timeout: $timeout,
      $log: $log,
      $rootScope: $rootScope,
      $$resource: new Resource(Settings.activeUser('folderURL') + 'Mail', Settings.activeUser()),
      $Message: Message,
      selectedFolder: null,
      PRELOAD: PRELOAD
    });

    return VirtualMailbox; // return constructor
  }];

  /**
   * @module SOGo.MailerUI
   * @desc Factory registration of VirtualMailbox in Angular module.
   */
  try {
    angular.module('SOGo.MailerUI');
  }
  catch(e) {
    angular.module('SOGo.MailerUI', ['SOGo.Common']);
  }
  angular.module('SOGo.MailerUI')
    .constant('sgMailbox_PRELOAD', {
      LOOKAHEAD: 50,
      SIZE: 100
    })
    .factory('VirtualMailbox', VirtualMailbox.$factory);

  /**
   * @memberof VirtualMailbox
   * @desc Build the path of the virtual mailbox (or account only).
   * @param {string} accountId - the account ID
   * @returns a string representing the path relative to the mail module
   */
  VirtualMailbox.$absolutePath = function(accountId) {
    return [accountId, "virtual"].join('/');
  };

  /**
   * @function init
   * @memberof VirtualMailbox.prototype
   * @desc Extend instance with new data and compute additional attributes.
   * @param {object} data - attributes of mailbox
   */
  VirtualMailbox.prototype.init = function(data) {
    this.$isLoading = false;
    this.$mailboxes = [];
    this.uidsMap = {};
    angular.extend(this, data);
    this.id = this.$id();
  };

  VirtualMailbox.prototype.setMailboxes = function(data) {
    this.$mailboxes = data;

    _.forEach(this.$mailboxes, function(mailbox) {
      mailbox.$messages = [];
      mailbox.uidsMap = {};
    });
  };

  VirtualMailbox.prototype.startSearch = function(match, params) {
    var _this = this,
        search = VirtualMailbox.$q.when();

    this.$isLoading = true;

    _.forEach(this.$mailboxes, function(mailbox) {
      search = search.then(function() {
        if (_this.$isLoading) {
          VirtualMailbox.$log.debug("searching mailbox " + mailbox.path);
          return mailbox.$filter( {sort: "date", asc: false, match: match}, params);
        }
      });
    });

    search.finally(function() {
      _this.$isLoading = false;
    });
  };

  VirtualMailbox.prototype.stopSearch = function() {
    VirtualMailbox.$log.debug("stopping search...");
    this.$isLoading = false;
  };

  /**
   * @function selectFolder
   * @memberof VirtualMailbox.prototype
   * @desc A no-op for virtual mailbox
   */
  VirtualMailbox.prototype.selectFolder = function() {
    return;
  };

  /**
   * @function resetSelectedMessage
   * @memberof VirtualMailbox.prototype
   * @desc Delete 'selectedMessage' attribute of all submailboxes.
   */
  VirtualMailbox.prototype.resetSelectedMessage = function() {
    _.forEach(this.$mailboxes, function(mailbox) {
      delete mailbox.$selectedMessage;
    });
  };

  /**
   * @function hasSelectedMessage
   * @memberof VirtualMailbox.prototype
   * @desc Check if a message is selected among the resulting mailboxes
   * @returns true if one message is selected
   */
  VirtualMailbox.prototype.hasSelectedMessage = function() {
    return angular.isDefined(_.find(this.$mailboxes, function(mailbox) {
      return angular.isDefined(mailbox.$selectedMessage);
    }));
  };

  /**
   * @function isSelectedMessage
   * @memberof VirtualMailbox.prototype
   * @desc Check if the message of the specified mailbox is selected.
   * @param {string} messageId
   * @param {string} mailboxPath
   * @returns true if the specified message is selected
   */
  VirtualMailbox.prototype.isSelectedMessage = function(messageId, mailboxPath) {
    return angular.isDefined(_.find(this.$mailboxes, function(mailbox) {
      return mailbox.path == mailboxPath && mailbox.$selectedMessage == messageId;
    }));
  };

  /**
   * @function getLength
   * @memberof VirtualMailbox.prototype
   * @desc Used by md-virtual-repeat / md-on-demand
   * @returns the number of items in the mailbox
   */
  VirtualMailbox.prototype.getLength = function() {
    var len = 0;

    if (!angular.isDefined(this.$mailboxes))
      return len;

    _.forEach(this.$mailboxes, function(mailbox) {
      len += mailbox.$messages.length;
    });

    return len;
  };

  /**
   * @function getItemAtIndex
   * @memberof VirtualMailbox.prototype
   * @desc Used by md-virtual-repeat / md-on-demand
   * @returns the message as the specified index
   */
  VirtualMailbox.prototype.getItemAtIndex = function(index) {
    var i, j, k, mailbox, message;

    if (angular.isDefined(this.$mailboxes) && index >= 0) {
      i = 0;
      for (j = 0; j < this.$mailboxes.length; j++) {
        mailbox = this.$mailboxes[j];
        for (k = 0; k < mailbox.$messages.length; i++, k++) {
          if (i == index) {
            message = mailbox.$messages[k];
            if (mailbox.$loadMessage(message.uid))
              return message;
          }
        }
      }
    }

    return null;
  };

  /**
   * @function $id
   * @memberof VirtualMailbox.prototype
   * @desc Build the unique ID to identified the mailbox.
   * @returns a string representing the path relative to the mail module
   */
  VirtualMailbox.prototype.$id = function() {
    return VirtualMailbox.$absolutePath(this.$account.id);
  };

  /**
   * @function $selectedMessageIndex
   * @memberof Mailbox.prototype
   * @desc Return the index of the currently visible message.
   * @returns a number or undefined if no message is selected
   */
  VirtualMailbox.prototype.$selectedMessageIndex = function() {
    var offset = 0;
    var selectedMailbox = _.find(this.$mailboxes, function(mailbox) {
      if (angular.isDefined(mailbox.$selectedMessage)) {
        return true;
      }
      else {
        offset += mailbox.getLength();
        return false;
      }
    });
    return offset + selectedMailbox.uidsMap[selectedMailbox.$selectedMessage];
  };

  /**
   * @function $selectedMessages
   * @memberof VirtualMailbox.prototype
   * @desc Return an associative array of the selected messages for each mailbox. Keys are the mailboxes ids.
   * @returns an associative array
   */
  VirtualMailbox.prototype.selectedMessages = function(options) {
    var messagesMap = {};
    return _.filter(_.transform(this.$mailboxes, function(messagesMap, mailbox) {
      if (options && options.updateCache)
        mailbox.$selectedMessages = _.filter(mailbox.$messages, function (message) { return message.selected; });
      messagesMap[mailbox.id] = mailbox.$selectedMessages;
    }, {}), function(o) {
      return _.size(o) > 0;
    });
  };

  /**
   * @function selectedCount
   * @memberof VirtualMailbox.prototype
   * @desc Return the number of messages selected by the user.
   * @returns the number of selected messages
   */
  VirtualMailbox.prototype.selectedCount = function() {
    return _.sum(_.invokeMap(this.$mailboxes, 'selectedCount'));
  };

  /**
   * @function $flagMessages
   * @memberof VirtualMailbox.prototype
   * @desc Add or remove a flag on a message set
   * @param {object} messagesMap
   * @param {array} flags
   * @param {string} operation
   * @returns a promise of the HTTP operation
   */
  VirtualMailbox.prototype.$flagMessages = function(messagesMap, flags, operation) {
    var data = {
      flags: flags,
      operation: operation
    };
    var allMessages = [];
    var promises = [];

    _.forEach(messagesMap, function(messages, id) {
      if (messages.length > 0) {
        var uids = _.map(messages, 'uid');
        allMessages.push(messages);
        var promise = VirtualMailbox.$$resource.post(id, 'addOrRemoveLabel', _.assign(data, {msgUIDs: uids}));
        promises.push(promise);
      }
    });

    return VirtualMailbox.$q.all(promises).then(function() {
      return _.flatten(allMessages);
    });
  };

  /**
   * @function $deleteMessages
   * @memberof VirtualMailbox.prototype
   * @desc Delete one or multiple messages from mailbox.
   * @param {object} messagesMap
   * @return a promise of the HTTP operation
   */
  VirtualMailbox.prototype.$deleteMessages = function(messagesMap) {
    var _this = this, promises = [];

    if (_.isArray(messagesMap) && messagesMap.length === 1 
      && messagesMap[0] && messagesMap[0].mailbox && !_.isArray(messagesMap[0].mailbox)) {
      // Deleting one message
      var message = messagesMap[0];
      var mailbox = message.$mailbox;
      return mailbox.$deleteMessages([message]).then(function(index) {
        var offset = 0;
        _.find(_this.$mailboxes, function(currentMailbox) {
          if (currentMailbox.id === mailbox.id) {
            return true;
          }
          else {
            offset += currentMailbox.getLength();
            return false;
          }
        });
        return offset + index;
      });
    }
    else {
      // Deleting multiple messages from different mailboxes
      _.forEach(messagesMap, function(messages, id) {
        if (messages.length > 0) {
          var mailbox = messages[0].$mailbox;
          var promise = mailbox.$deleteMessages(messages);
          promises.push(promise);
        }
      });

      return VirtualMailbox.$q.all(promises);
    }
  };

  /**
   * @function $markOrUnMarkMessagesAsJunk
   * @memberof VirtualMailbox.prototype
   * @desc Mark messages as junk/not junk
   * @param {object} messagesMap
   * @return a promise of the HTTP operation
   */
  VirtualMailbox.prototype.$markOrUnMarkMessagesAsJunk = function(messagesMap) {
    var promises = [];

    _.forEach(messagesMap, function(messages, id) {
      if (messages.length > 0) {
        var mailbox = messages[0].$mailbox;
        var promise = mailbox.$markOrUnMarkMessagesAsJunk(messages);
        promises.push(promise);
      }
    });

    return VirtualMailbox.$q.all(promises);
  };

  /**
   * @function $copyMessages
   * @memberof VirtualMailbox.prototype
   * @desc Copy multiple messages from the current mailbox to a target one
   * @param {object} messagesMap
   * @param {string} folder
   * @return a promise of the HTTP operation
   */
  VirtualMailbox.prototype.$copyMessages = function(messagesMap, folder) {
    var promises = [];

    _.forEach(messagesMap, function(messages, id) {
      if (messages.length > 0) {
        var mailbox = messages[0].$mailbox;
        var promise = mailbox.$copyMessages(messages, folder);
        promises.push(promise);
      }
    });

    return VirtualMailbox.$q.all(promises);
  };

  /**
   * @function $moveMessages
   * @memberof VirtualMailbox.prototype
   * @desc Move multiple messages from the current mailbox to a target one
   * @param {object} messagesMap
   * @param {string} folder
   * @return a promise of the HTTP operation
   */
  VirtualMailbox.prototype.$moveMessages = function(messagesMap, folder) {
    var promises = [];

    _.forEach(messagesMap, function(messages, id) {
      if (messages.length > 0) {
        var mailbox = messages[0].$mailbox;
        var promise = mailbox.$moveMessages(messages, folder);
        promises.push(promise);
      }
    });

    return VirtualMailbox.$q.all(promises);
  };

  /**
   * @function $compact
   * @memberof VirtualMailbox.prototype
   * @desc Called when leaving the Mailer module. No-op when in advanced search.
   */
  VirtualMailbox.prototype.$comact = function() {
    return true;
  };

  /**
   * @function $reset
   * @memberof VirtualMailbox.prototype
   * @desc Reset the original state all mailboxes data.
   */
  VirtualMailbox.prototype.$reset = function(options) {
    _.forEach(this.$mailboxes, function(mailbox) {
      mailbox.$reset(options);
    });
  };

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @name ImageGallery
   * @constructor
   */
  function ImageGallery() {
    this.show = false;
    this.message = null;
    this.elements = [];
  }

  /**
   * @memberof ImageGallery
   * @desc The factory we'll use to register with Angular
   * @returns an ImageGallery instance
   */
  ImageGallery.$factory = ['$document', '$timeout', '$mdPanel', 'sgHotkeys', function($document, $timeout, $mdPanel, sgHotkeys) {
    angular.extend(ImageGallery, {
      $document: $document,
      $timeout: $timeout,
      $mdPanel: $mdPanel,
      sgHotkeys: sgHotkeys
    });

    return new ImageGallery(); // return unique instance
  }];

  /**
   * @function setMessage
   * @memberof ImageGallery.prototype
   * @desc Set current message object of gallery
   */
  ImageGallery.prototype.setMessage = function(message) {
    this.message = message;
  };

  /**
   * @function registerImage
   * @memberof ImageGallery.prototype
   * @desc Add an image to the gallery. Called from sgZoomableImage directive.
   */
  ImageGallery.prototype.registerImage = function(element) {
    this.elements.push(element);
  };

  /**
   * @function registerHotkeys
   * @memberof ImageGallery.prototype
   * @desc Allow keyboard navigation
   */
  ImageGallery.prototype.registerHotkeys = function($ctrl) {
    this.keys = [
      ImageGallery.sgHotkeys.createHotkey({
        key: 'left',
        description: l('View previous item'),
        callback: angular.bind($ctrl, $ctrl.previousImage)
      }),
      ImageGallery.sgHotkeys.createHotkey({
        key: 'right',
        description: l('View next item'),
        callback: angular.bind($ctrl, $ctrl.nextImage)
      })
    ];
    _.forEach(this.keys, function(key) {
      ImageGallery.sgHotkeys.registerHotkey(key);
    });
  };

  /**
   * @function showGallery
   * @memberof ImageGallery.prototype
   * @desc Build and show the md-panel
   */
  ImageGallery.prototype.showGallery = function($event, partIndex) {
    var _this = this,
        $mdPanel = ImageGallery.$mdPanel,
        partSrc = angular.element(this.message.$content()[partIndex].content).find('img')[0].src;

    var _findImages = function (parts, images) {
      _.forEach(parts, function (part) {
        if (part.type == 'UIxMailPartImageViewer') {
          images.push(part);
        }
        else if (typeof part.content != 'string') {
          _findImages(part.content, images);
        }
      });
    };
    var images = [];
    _findImages(this.message.$content(), images);

    var selectedIndex = _.findIndex(images, function(image) {
      return partSrc.indexOf(image.viewURL) >= 0;
    });

    // Add a class to the body in order to modify the panel backdrop opacity
    angular.element(ImageGallery.$document[0].body).addClass('sg-image-gallery-backdrop');

    // Fullscreen panel
    var panelPosition = $mdPanel.newPanelPosition()
        .absolute();

    var panelAnimation = $mdPanel.newPanelAnimation()
        .openFrom($event.target)
        .duration(100)
        .withAnimation($mdPanel.animation.FADE);

    var config = {
      attachTo: angular.element(document.body),
      locals: {
        lastIndex: images.length -1,
        images: images,
        selectedIndex: selectedIndex,
        selectedImage: images[selectedIndex]
      },
      bindToController: true,
      controller: PanelController,
      controllerAs: '$panelCtrl',
      position: panelPosition,
      animation: panelAnimation,
      targetEvent: $event,
      fullscreen: true,
      hasBackdrop: true,
      template: [
        '<sg-image-gallery layout="column">',
        '  <div class="md-toolbar-tools" layout="row" layout-align="space-between center">',
        '    <md-button class="md-icon-button"',
        '                aria-label="' + l('Close') + '"',
        '                ng-click="$panelCtrl.close()">',
        '      <md-icon>arrow_back</md-icon>',
        '    </md-button>',
        '    <md-icon class="md-primary">image</md-icon>',
        '    <div md-truncate class="md-flex" ng-bind="$panelCtrl.selectedImage.filename"></div>',
        '    <md-button class="md-icon-button"',
        '                aria-label="' + l('Save Attachment') + '"',
        '                ng-href="{{$panelCtrl.selectedImage.downloadURL}}">',
        '      <md-icon>file_download</md-icon>',
        '    </md-button>',
        '  </div>',
        '  <div class="md-flex" layout="row" layout-align="space-between center">',
        '      <md-button class="md-icon-button" ng-click="$panelCtrl.previousImage()"',
        '                 ng-disabled="$panelCtrl.selectedIndex == 0">',
        '        <md-icon>navigate_before</md-icon>',
        '      </md-button>',
        '      <img class="sg-image" ng-src="{{$panelCtrl.selectedImage.viewURL}}">',
        '      <md-button class="md-icon-button" ng-click="$panelCtrl.nextImage()"',
        '                 ng-disabled="$panelCtrl.selectedIndex == $panelCtrl.lastIndex">',
        '        <md-icon>navigate_next</md-icon>',
        '      </md-button>',
        '  </div>',
        '    <div class="sg-image-thumbnails">',
        '      <div class="sg-image-thumbnail" ng-repeat="image in ::$panelCtrl.images">',
        '        <img class="sg-hide" ng-src="{{::image.viewURL}}" ng-click="$panelCtrl.selectImage($index)">',
        '      </div>',
        '    </div>',
        '</sg-image-gallery>'
      ].join(''),
      trapFocus: true,
      clickOutsideToClose: true,
      escapeToClose: true,
      focusOnOpen: true,
      onOpenComplete: function() {
        _this.show = true;
        _.forEach(ImageGallery.$document.find('sg-image-gallery')[0].getElementsByClassName('sg-image-thumbnail'),
                  function(imgContainer) {
                    var imgEl = imgContainer.children[0];
                    angular.element(imgEl).one('load', function() {
                      if (imgEl.naturalWidth < imgEl.naturalHeight)
                        imgEl.classList.add('portrait');
                    });
                    // Display thumbnail
                    ImageGallery.$timeout(function() {
                      imgEl.classList.remove('sg-hide');
                    }, 1000);
                  });
      },
      onDomRemoved: function() {
        angular.element(ImageGallery.$document[0].body).removeClass('sg-image-gallery-backdrop');
        _this.show = false;
        // Deregister hotkeys
        _.forEach(_this.hotkeys, function(key) {
          ImageGallery.sgHotkeys.deregisterHotkey(key);
        });
      }
    };

    $mdPanel.open(config).then(function(mdPanelRef) {
      _this.registerHotkeys(mdPanelRef.$ctrl);
    });

    PanelController.$inject = ['mdPanelRef'];
    function PanelController(mdPanelRef) {
      var $menuCtrl = this;

      mdPanelRef.$ctrl = this;

      this.close = function() {
        mdPanelRef.close();
      };

      this.selectImage = function(index) {
        this.selectedIndex = index;
        this.selectedImage = this.images[index];
      };

      this.nextImage = function() {
        if (this.selectedIndex != this.lastIndex)
          this.selectImage(this.selectedIndex + 1);
      };

      this.previousImage = function() {
        if (this.selectedIndex > 0)
          this.selectImage(this.selectedIndex - 1);
      };

    } // PanelController

  };

  /* Factory registration in Angular module */
  angular.module('SOGo.MailerUI')
    .factory('ImageGallery', ImageGallery.$factory);

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @ngInject
   */
  MailboxController.$inject = ['$window', '$scope', '$timeout', '$q', '$state', '$mdDialog', '$mdToast', 'stateAccounts', 'stateAccount', 'stateMailbox', 'sgHotkeys', 'encodeUriFilter', 'sgConstant', 'sgSettings', 'sgFocus', 'Dialog', 'Preferences', 'Account', 'Mailbox'];
  function MailboxController($window, $scope, $timeout, $q, $state, $mdDialog, $mdToast, stateAccounts, stateAccount, stateMailbox, sgHotkeys, encodeUriFilter, sgConstant, sgSettings, focus, Dialog, Preferences, Account, Mailbox) {
    var vm = this,
        defaultWindowTitle = angular.element($window.document).find('title').attr('sg-default') || "SOGo",
        hotkeys = [],
        sortLabels,
        popupWindow = null,
        msgHeight = 56; // must match md-item-size of md-list-item in UIxMailFolderTemplate

    sortLabels = {
      subject: 'Subject',
      from: 'From',
      date: 'Date',
      size: 'Size',
      arrival: 'Order Received'
    };

    this.$onInit = function() {
      // Expose controller for eventual popup windows
      $window.$mailboxController = vm;

      this.service = Mailbox;
      this.accounts = stateAccounts;
      this.account = stateAccount;
      this.selectedFolder = stateMailbox;
      this.messageDialog = null; // also access from Message controller
      this.mode = { search: false, multiple: 0 };
      this.allSelected = false;
      this.isLoadingMessage = false;
      this.nextAction = null;

      if (!Mailbox.$virtualMode)
        this.selectedFolder.getLabels(); // fetch labels from server

      // When opening INBOX, immediately refresh all folder unseen counts
      // to avoid showing stale aggregated values from subfolders
      if (this.selectedFolder && this.selectedFolder.type === 'inbox') {
        Account.refreshUnseenCount($window.unseenCountFolders);
      }

      _registerHotkeys(hotkeys);

      // Start auto-refresh timer for current folder
      var startAutoRefresh = function() {
        var refreshViewCheck = Preferences.defaults.SOGoRefreshViewCheck;
        if (refreshViewCheck && refreshViewCheck != 'manually' && vm.selectedFolder) {
          var interval = refreshViewCheck.timeInterval() * 1000;

          // Cancel the built-in global refresh timer to avoid double refresh
          if (Mailbox.$refreshTimeout) {
            Mailbox.$timeout.cancel(Mailbox.$refreshTimeout);
            Mailbox.$refreshTimeout = null;
          }

          vm.autoRefreshTimer = $timeout(function() {
            if (vm.selectedFolder) {
              // Use incremental update (with syncToken) for smooth, seamless refresh
              vm.selectedFolder.$filter();

              // Hide loading animation for invisible background refresh
              vm.selectedFolder.$isLoading = false;

              // Cancel the built-in timer again after each refresh
              if (Mailbox.$refreshTimeout) {
                Mailbox.$timeout.cancel(Mailbox.$refreshTimeout);
                Mailbox.$refreshTimeout = null;
              }
            }
            startAutoRefresh();
          }, interval);
        }
      };

      startAutoRefresh();

      // Expunge mailbox when leaving the Mail module
      angular.element($window).on('beforeunload', _compactBeforeUnload);
      $scope.$on('$destroy', function() {
        angular.element($window).off('beforeunload', _compactBeforeUnload);
        // Cancel auto-refresh timer
        if (vm.autoRefreshTimer) {
          $timeout.cancel(vm.autoRefreshTimer);
        }
        // When leaving a subfolder, pre-fetch fresh unseen counts so INBOX
        // counter is accurate before it renders (reduces visible flash)
        if (vm.selectedFolder && vm.selectedFolder.type !== 'inbox') {
          Account.refreshUnseenCount($window.unseenCountFolders);
        }
        // Deregister hotkeys
        _.forEach(hotkeys, function(key) {
          sgHotkeys.deregisterHotkey(key);
        });
        // if (vm.mode.search) {
        //   vm.mode.search = false;
        //   vm.selectedFolder.$reset({ filter: true });
        // }
      });

      // Update window's title with unseen messages count of selected mailbox
      $scope.$watch(function() {
        if (!vm.selectedFolder)
          return 0;
        if (angular.isFunction(vm.selectedFolder.$displayUnseenCount))
          return vm.selectedFolder.$displayUnseenCount();
        return vm.selectedFolder.unseenCount;
      }, function(unseenCount) {
        var title = '';
        if (unseenCount)
          title += '(' + unseenCount + ') ';
        title += vm.selectedFolder.$displayName;
        title += ' | ' + defaultWindowTitle;
        $window.document.title = title;
      });
    };

    function _registerHotkeys(keys) {
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_search'),
        description: l('Search'),
        callback: vm.searchMode
      }));
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_compose'),
        description: l('Write a new message'),
        callback: function($event) {
          if (vm.messageDialog === null)
            vm.newMessage($event);
        }
      }));
      keys.push(sgHotkeys.createHotkey({
        key: l('shift+j'),
        description: l('Mark the selected messages as junk'),
        callback: vm.markOrUnMarkMessagesAsJunk
      }));
      keys.push(sgHotkeys.createHotkey({
        key: 'space',
        description: l('Toggle item'),
        callback: vm.toggleMessageSelection
      }));
      keys.push(sgHotkeys.createHotkey({
        key: 'shift+space',
        description: l('Toggle range of items'),
        callback: vm.toggleMessageSelection
      }));
      keys.push(sgHotkeys.createHotkey({
        key: 'up',
        description: l('View next item'),
        callback: _nextMessage,
        preventInClass: ['sg-mail-part']
      }));
      keys.push(sgHotkeys.createHotkey({
        key: 'down',
        description: l('View previous item'),
        callback: _previousMessage,
        preventInClass: ['sg-mail-part']
      }));
      keys.push(sgHotkeys.createHotkey({
        key: 'shift+up',
        description: l('Add next item to selection'),
        callback: _addNextMessageToSelection,
        preventInClass: ['sg-mail-part']
      }));
      keys.push(sgHotkeys.createHotkey({
        key: 'shift+down',
        description: l('Add previous item to selection'),
        callback: _addPreviousMessageToSelection,
        preventInClass: ['sg-mail-part']
      }));
      _.forEach(['backspace', 'delete'], function(hotkey) {
        keys.push(sgHotkeys.createHotkey({
          key: hotkey,
          description: l('Delete selected message or folder'),
          callback: vm.confirmDeleteSelectedMessages
        }));
      });

      // Register the hotkeys
      _.forEach(keys, function(key) {
        sgHotkeys.registerHotkey(key);
      });
    }

    function _compactBeforeUnload(event) {
      if (Mailbox.$virtualMode)
        return true;
      return vm.selectedFolder.$compact();
    }

    this.centerIsClose = function(navController_centerIsClose) {
      // Allow the messages list to be hidden only if a message is selected
      return this.selectedFolder.hasSelectedMessage() && !!navController_centerIsClose;
    };

    this.sort = function(field) {
      if (field) {
        vm.selectedFolder.$filter({ sort: field });
      }
      else {
        return sortLabels[vm.service.$query.sort];
      }
    };

    this.sortedBy = function(field) {
      return Mailbox.$query.sort == field;
    };

    this.ascending = function() {
      return Mailbox.$query.asc;
    };

    this.refresh = function () {
      Preferences.pollInbox();
      this.selectedFolder.$filter();
    };

    this.searchMode = function($event) {
      vm.mode.search = true;
      focus('search');
      if ($event)
        $event.preventDefault();
    };

    this.cancelSearch = function() {
      // Clean highlights
      if (vm.account) {
        vm.account.$getMailboxes().$$state.value.forEach((mailbox) => {
          mailbox.setHighlightWords([]);
        });
      }
      vm.mode.search = false;
      vm.selectedFolder.$filter(vm.service.$query).then(function() {
        if (vm.selectedFolder.$selectedMessage) {
          vm.selectedFolder.$topIndex = vm.selectedFolder.uidsMap[vm.selectedFolder.$selectedMessage];
        }
      });
    };

    this.composeWindowEnabled = function() {
      return Preferences.defaults.SOGoMailComposeWindowEnabled;
    };

    this.openInPopup = function(message, action) {
      var url = [sgSettings.baseURL(),
                 'UIxMailPopupView#!/Mail',
                 this.account.id],
          wId = this.account.id + '/' + Math.random(0, 1000);
      if (message) {
        // The double-encoding is necessary
        url.push(encodeUriFilter(encodeUriFilter(message.$mailbox.path)));
        url.push(message.uid);
        wId = message.$absolutePath();
      }
      if (action) {
        wId += '/' + action;
        url.push(action);
      }
      url = url.join('/');
      popupWindow = $window.open(url, wId,
                                 ["resizable=1",
                                  "scrollbars=1",
                                  "toolbar=0",
                                  "location=0",
                                  "directories=0",
                                  "status=0",
                                  "menubar=0",
                                  "copyhistory=0"]
                                 .join(','));
    };

    this.closePopup = function() {
      if ($window.document.body.classList.contains('popup'))
        $window.close();
    };

    /**
     * To keep track of the currently active dialog, we share a common variable with the parent controller.
     */
    function _messageDialog() {
      if ($scope.mailbox) {
        if (arguments.length > 0)
          $scope.mailbox.messageDialog = arguments[0];
        return $scope.mailbox.messageDialog;
      }
      return null;
    }

    function _showMailEditor($event, message) {
      if (_messageDialog() === null) {
        var onCompleteDeferred = $q.defer();
        _messageDialog(
          $mdDialog
            .show({
              parent: angular.element(document.body),
              targetEvent: $event,
              clickOutsideToClose: false,
              escapeToClose: false,
              templateUrl: 'UIxMailEditor',
              controller: 'MessageEditorController',
              controllerAs: 'editor',
              onComplete: function (scope, element) {
                return onCompleteDeferred.resolve(element);
              },
              locals: {
                stateParent: $scope,
                stateAccount: vm.account,
                stateMessage: message,
                onCompletePromise: function () {
                  return onCompleteDeferred.promise;
                }
              }
            })
            .catch(_.noop) // Cancel
            .finally(function() {
              _messageDialog(null);
              vm.closePopup();
            })
        );
      }
    }

    this._showMailEditorInPopup = function(message, action, inPopup) {
      if (!sgSettings.isPopup &&
          (Preferences.defaults.SOGoMailComposeWindow == 'popup' || inPopup)) {
        this.openInPopup(message, action);
        return true;
      }
      return false;
    };

    this.newMessage = function($event, inPopup) {
      if (!this._showMailEditorInPopup(null, 'new', inPopup)) {
        this.account.$newMessage().then(function(message) {
          _showMailEditor($event, message);
        });
      }
    };

    /**
     * User has pressed up arrow key
     */
    function _nextMessage($event) {
      if (vm.isLoadingMessage) {
        vm.nextAction = { m: _nextMessage, p: $event };
      }

      var index = vm.selectedFolder.$selectedMessageIndex();

      if (angular.isDefined(index)) {
        index--;
        if (vm.selectedFolder.$topIndex > 0)
          _scrollToIndex(index);
      }
      else {
        // No message is selected, show oldest message
        index = vm.selectedFolder.getLength() - 1;
        vm.selectedFolder.$topIndex = vm.selectedFolder.getLength();
      }

      if (index > -1 && !vm.isLoadingMessage)
        vm.selectMessage(vm.selectedFolder.getItemAtIndex(index));

      $event.preventDefault();

      return index;
    }

    /**
     * User has pressed the down arrow key
     */
    function _previousMessage($event) {
      if (vm.isLoadingMessage) {
        vm.nextAction = { m: _previousMessage, p: $event };
      }

      var index = vm.selectedFolder.$selectedMessageIndex();

      if (angular.isDefined(index)) {
        index++;
        if (vm.selectedFolder.$topIndex < vm.selectedFolder.getLength())
          _scrollToIndex(index);
      }
      else
        // No message is selected, show newest
        index = 0;

      if (index < vm.selectedFolder.getLength() && !vm.isLoadingMessage)
        vm.selectMessage(vm.selectedFolder.getItemAtIndex(index));
      else
        index = -1;

      $event.preventDefault();

      return index;
    }

    /**
     * Perform a smoother scrolling than modifying vm.selectedFolder.$topIndex directly
     */
    function _scrollToIndex(index) {
      var scroller = document.querySelector('[ui-view=mailbox] .md-virtual-repeat-scroller'),
          scrollTop = index * msgHeight;

      if (scrollTop < scroller.scrollTop || (scrollTop + msgHeight) > scroller.scrollTop + scroller.clientHeight)
        document.querySelectorAll('.md-virtual-repeat-scroller')[1].scrollTo({
          top: msgHeight * index - (scroller.clientHeight - msgHeight)/2,
          behavior: 'smooth'
        });
    }

    function _addNextMessageToSelection($event) {
      var index;

      if (vm.selectedFolder.hasSelectedMessage()) {
        index = _nextMessage($event);
        if (index >= 0)
          vm.toggleMessageSelection($event, vm.selectedFolder.$messages[index]);
      }
    }

    function _addPreviousMessageToSelection($event) {
      var index;

      if (vm.selectedFolder.hasSelectedMessage()) {
        index = _previousMessage($event);
        if (index >= 0)
          vm.toggleMessageSelection($event, vm.selectedFolder.$messages[index]);
      }
    }

    this.selectMessage = function(message) {
      if (Mailbox.$virtualMode) {
        vm.isLoadingMessage = true;
        $state.go('mail.account.virtualMailbox.message', { mailboxId: encodeUriFilter(encodeUriFilter(message.$mailbox.path)), messageId: message.uid }).then(function () {

        }).catch((err) => {
          console.error(err);
        })
          .finally(() => {
            vm.isLoadingMessage = false;
            if (vm.nextAction) {
              vm.nextAction.m(vm.nextAction.p);
              vm.nextAction = null;
            }
          });
      } else {
        vm.isLoadingMessage = true;
        $state.go('mail.account.mailbox.message', { mailboxId: encodeUriFilter(encodeUriFilter(message.$mailbox.path)), messageId: message.uid }).then(function () {

        }).catch((err) => {
          console.error(err);
        })
          .finally(() => {
            vm.isLoadingMessage = false;
            if (vm.nextAction) {
              vm.nextAction.m(vm.nextAction.p);
              vm.nextAction = null;
            }
          });
      }
    };

    this.toggleMessageSelection = function($event, message) {
      var folder = vm.selectedFolder,
          selectedIndex, nextSelectedIndex, i;

      if (!message)
        message = folder.selectedMessage();
      if (!message)
        return true;

      message.selected = !message.selected;

      // Select closest range of messages when shift key is pressed
      if ($event.shiftKey && folder.selectedCount() > 0) {
        selectedIndex = folder.uidsMap[message.uid];
        // Search for next selected message above
        nextSelectedIndex = selectedIndex - 2;
        while (nextSelectedIndex >= 0 &&
               !folder.$messages[nextSelectedIndex].selected)
          nextSelectedIndex--;
        if (nextSelectedIndex < 0) {
          // Search for next selected message bellow
          nextSelectedIndex = selectedIndex + 2;
          while (nextSelectedIndex < folder.getLength() &&
                 !folder.$messages[nextSelectedIndex].selected)
            nextSelectedIndex++;
        }
        if (nextSelectedIndex >= 0 && nextSelectedIndex < folder.getLength()) {
          for (i = Math.min(selectedIndex, nextSelectedIndex);
               i <= Math.max(selectedIndex, nextSelectedIndex);
               i++)
            folder.$messages[i].selected = true;
        }
      }

      folder.selectedMessages({ updateCache: true });
      vm.mode.multiple = vm.selectedFolder.selectedCount();
      $event.preventDefault();
      $event.stopPropagation();
    };

    /**
     * Batch operations
     */

    function _currentMailboxes() {
      if (Mailbox.$virtualMode)
        return vm.selectedFolder.$mailboxes;
      else
        return [vm.selectedFolder];
    }

    // Unselect current message and cleverly load the next message.
    // This function must not be called in virtual mode.
    function _unselectMessage(message, index) {
      var nextMessage, previousMessage, nextIndex = index;
      vm.mode.multiple = vm.selectedFolder.selectedCount();
      if (message) {
        // Select either the next or previous message
        if (index > 0) {
          nextIndex -= 1;
          nextMessage = vm.selectedFolder.$messages[nextIndex];
        }
        if (index < vm.selectedFolder.$messages.length)
          previousMessage = vm.selectedFolder.$messages[index];
        if (nextMessage) {
          if (nextMessage.isread && previousMessage && !previousMessage.isread) {
            nextIndex = index;
            nextMessage = previousMessage;
          }
        }
        else if (previousMessage) {
          nextIndex = index;
          nextMessage = previousMessage;
        }
        if (nextMessage) {
          vm.selectedFolder.$topIndex = nextIndex;
          $state.go('mail.account.mailbox.message', { messageId: nextMessage.uid });
        }
        else {
          $state.go('mail.account.mailbox');
        }
      }
    }

    this.confirmDeleteSelectedMessages = function($event) {
      var selectedMessages = vm.selectedFolder.selectedMessages();

      if (vm.messageDialog === null && _.size(selectedMessages) > 0)
        vm.messageDialog = Dialog.confirm(l('Confirmation'),
                                            l('Are you sure you want to delete the selected messages?'),
                                            { ok: l('Delete') })
        .then(function() {
          var deleteSelectedMessage = vm.selectedFolder.hasSelectedMessage();
          vm.selectedFolder.$deleteMessages(selectedMessages).then(function(index) {
            if (Mailbox.$virtualMode) {
              // When performing an advanced search, we refresh the view if the selected message
              // was deleted, but only once all promises have completed.
              if (deleteSelectedMessage)
                $state.go('mail.account.virtualMailbox');
            }
            else {
              // In normal mode, we immediately unselect the selected message.
              _unselectMessage(deleteSelectedMessage, index);
            }
          }, function(response) {
            vm.messageDialog = Dialog.confirm(l('Warning'),
                                           l('The messages could not be moved to the trash folder. Would you like to delete them immediately?'),
                                           { ok: l('Delete') })
              .then(function() {
                vm.selectedFolder.$deleteMessages(selectedMessages, { withoutTrash: true })
                  .then(function(index) {
                    if (Mailbox.$virtualMode) {
                      // When performing an advanced search, we refresh the view if the selected message
                      // was deleted, but only once all promises have completed.
                      if (deleteSelectedMessage)
                        $state.go('mail.account.virtualMailbox');
                    }
                    else {
                      // In normal mode, we immediately unselect the selected message.
                      _unselectMessage(deleteSelectedMessage, index);
                    }
                  })
                  .finally(function() {
                    vm.messageDialog = null;
                  });
              });
          });
        })
        .finally(function() {
          vm.messageDialog = null;
        });

      $event.preventDefault();
    };

    this.markOrUnMarkMessagesAsJunk = function() {
      var moveSelectedMessage = vm.selectedFolder.hasSelectedMessage();
      var selectedMessages = vm.selectedFolder.selectedMessages();
      if (_.size(selectedMessages) === 0 && moveSelectedMessage)
        // No selection, user has pressed keyboard shortcut
        selectedMessages = [vm.selectedFolder.selectedMessage()];
      if (_.size(selectedMessages) > 0)
        vm.selectedFolder.$markOrUnMarkMessagesAsJunk(selectedMessages).then(function() {
          var dstFolder = '/' + vm.account.id + '/folderINBOX';
          if (vm.selectedFolder.type != 'junk') {
            dstFolder = '/' + vm.account.$getMailboxByType('junk').id;
          }
          vm.selectedFolder.$moveMessages(selectedMessages, dstFolder).then(function(index) {
            if (Mailbox.$virtualMode) {
              // When performing an advanced search, we refresh the view if the selected message
              // was deleted, but only once all promises have completed.
              if (moveSelectedMessage)
                $state.go('mail.account.virtualMailbox');
            }
            else {
              // In normal mode, we immediately unselect the selected message.
              _unselectMessage(moveSelectedMessage, index);
            }
          });
        });
    };

    this.copySelectedMessages = function(dstFolder) {
      var selectedMessages = vm.selectedFolder.selectedMessages();
      if (_.size(selectedMessages) > 0)
        vm.selectedFolder.$copyMessages(selectedMessages, '/' + dstFolder).then(function() {
          $mdToast.show(
            $mdToast.simple()
              .textContent(l('%{0} message(s) copied', vm.selectedFolder.selectedCount()))
              .position(sgConstant.toastPosition)
              .hideDelay(2000));
        });
    };

    this.moveSelectedMessages = function(dstFolder, message) {
      var moveSelectedMessage = vm.selectedFolder.hasSelectedMessage();
      var selectedMessages = vm.selectedFolder.selectedMessages();
      if (message) {
        selectedMessages.push(message);
      }
      var count = vm.selectedFolder.selectedCount();
      if (_.size(selectedMessages) > 0)
        vm.selectedFolder.$moveMessages(selectedMessages, '/' + dstFolder).then(function(index) {
          $mdToast.show(
            $mdToast.simple()
              .textContent(l('%{0} message(s) moved', count))
              .position(sgConstant.toastPosition)
              .hideDelay(2000));
          if (Mailbox.$virtualMode) {
            // When performing an advanced search, we refresh the view if the selected message
            // was moved, but only once all promises have completed.
            if (moveSelectedMessage)
              $state.go('mail.account.virtualMailbox');
          }
          else {
            // In normal mode, we immediately unselect the selected message.
            _unselectMessage(moveSelectedMessage, index);
          }
        });
    };

    this.selectAll = function() {
      var count = 0;
      _.forEach(_currentMailboxes(), function(folder) {
        var i = 0, length = folder.$messages.length;
        folder.$selectedMessages = [];
        for (; i < length; i++) {
          folder.$messages[i].selected = !vm.allSelected;
          if(folder.$messages[i].selected)
            folder.$selectedMessages.push(folder.$messages[i]);
            count++;
        }
      });
      vm.allSelected = !vm.allSelected;
      vm.mode.multiple = count;
    };

    this.unselectMessages = function() {
      _.forEach(_currentMailboxes(), function(folder) {
        folder.$selectedMessages = [];
        _.forEach(folder.$messages, function(message) {
          message.selected = false;
        });
      });
      vm.mode.multiple = 0;
    };

    this.markSelectedMessagesAsFlagged = function() {
      var selectedMessages = vm.selectedFolder.selectedMessages();
      if (_.size(selectedMessages) > 0)
        vm.selectedFolder.$flagMessages(selectedMessages, '\\Flagged', 'add').then(function(messages) {
          _.forEach(messages, function(message) {
            message.isflagged = true;
          });
        });
    };

    this.markSelectedMessagesAsUnread = function() {
      var selectedMessages = vm.selectedFolder.selectedMessages();
      if (_.size(selectedMessages) > 0) {
        vm.selectedFolder.$flagMessages(selectedMessages, 'seen', 'remove').then(function(messages) {
          _.forEach(messages, function(message) {
            if (message.isread)
              message.$mailbox.unseenCount++;
            message.isread = false;
          });
        });
      }
    };

    this.markSelectedMessagesAsRead = function() {
      var selectedMessages = vm.selectedFolder.selectedMessages();
      if (_.size(selectedMessages) > 0) {
        vm.selectedFolder.$flagMessages(selectedMessages, 'seen', 'add').then(function(messages) {
          _.forEach(messages, function(message) {
            if (!message.isread)
              message.$mailbox.unseenCount--;
            message.isread = true;
          });
        });
      }
    };

    this.forwardSelectedMessages = function($event) {
      var _this = this,
          selectedMessages = vm.selectedFolder.selectedMessages();
      if (_.size(selectedMessages) > 0) {
        vm.selectedFolder.forwardMessages(selectedMessages).then(function(message) {
          if (!_this._showMailEditorInPopup(message, 'edit')) {
            message.$editableContent().then(function() {
              _showMailEditor($event, message);
            });
          }
        });
      }
    };

  }

  angular
    .module('SOGo.MailerUI')
    .controller('MailboxController', MailboxController);

  /**
   * @ngInject
   */
  mdVirtualRepeatContainerDirectiveDecorator.$inject = ['$delegate'];
  function mdVirtualRepeatContainerDirectiveDecorator($delegate) {
    $delegate[0].controller.prototype.resetScroll = function() {
      // Don't scroll to top if current virtual repeater is the messages list
      // but do update the container size
      if (this.$element.parent().attr('id') == 'messagesList')
        this.updateSize();
      else
        this.scrollTo(0);
    };
    return $delegate;
  }

  angular
    .module('material.components.virtualRepeat')
    .decorator('mdVirtualRepeatContainerDirective', mdVirtualRepeatContainerDirectiveDecorator);

})();

/* -*- Mode: js; indent-tabs-mode: nil; js-indent-level: 2; -*- */

(function() {
  'use strict';
  
  /**
   * @ngInject
   */
  MailboxesController.$inject = ['$scope', '$rootScope', '$state', '$transitions', '$timeout', '$window', '$mdUtil', '$mdMedia', '$mdSidenav', '$mdDialog', '$mdToast', 'sgConstant', 'sgFocus', 'encodeUriFilter', 'Dialog', 'sgSettings', 'sgHotkeys', 'Account', 'Mailbox', 'VirtualMailbox', 'User', 'Preferences', 'stateAccounts', 'Message'];
  function MailboxesController($scope, $rootScope, $state, $transitions, $timeout, $window, $mdUtil, $mdMedia, $mdSidenav, $mdDialog, $mdToast, sgConstant, focus, encodeUriFilter, Dialog, Settings, sgHotkeys, Account, Mailbox, VirtualMailbox, User, Preferences, stateAccounts, Message) {
    var vm = this,
        account,
        mailbox,
        hotkeys = [];

    $scope.closeDialog = function () {
      $mdDialog.hide();
    };

    this.$onInit = function () {
      this.service = Mailbox;
      this.accounts = stateAccounts;
      this.message = Message;
      this.advancedSearchPanelVisible = false;

      // Advanced search options
      this.reset();

      this.search = {
        subfolders: 1,
        match: 'AND',
        params: []
      };
      this.highlightWords = [];

      this.showSubscribedOnly = Preferences.defaults.SOGoMailShowSubscribedFoldersOnly;

      Account.refreshUnseenCount($window.unseenCountFolders);

      _registerHotkeys(hotkeys);

      $scope.$on('$destroy', function() {
        // Deregister hotkeys
        _.forEach(hotkeys, function(key) {
          sgHotkeys.deregisterHotkey(key);
        });
      });

      $rootScope.$on('showMailAdvancedSearchPanel', function () {
        vm.showAdvancedSearch();
      });

      $rootScope.$on('resetMailAdvancedSearchPanel', function () {
        vm.reset();
      });

      $rootScope.$on('showCleanMailboxPanel', function (e, d) {
        vm.showCleanMailboxPanel(d.folder, d.account);
      });
    };


    function _registerHotkeys(keys) {
      _.forEach(['backspace', 'delete'], function(hotkey) {
        keys.push(sgHotkeys.createHotkey({
          key: hotkey,
          description: l('Delete selected message or folder'),
          callback: function() {
            if (Mailbox.selectedFolderController &&
                Mailbox.selectedFolder &&
                Mailbox.selectedFolder.$isEditable &&
                !Mailbox.selectedFolder.hasSelectedMessage() &&
                Mailbox.selectedFolder.$selectedCount() === 0)
              Mailbox.selectedFolderController.confirmDelete(Mailbox.selectedFolder);
          }
        }));
        keys.push(sgHotkeys.createHotkey({
          key: 'shift+s',
          description: l('Advanced search'),
          callback: function () {
           vm.showAdvancedSearch();
          }
        }));
      });

      // Register the hotkeys
      _.forEach(keys, function(key) {
        sgHotkeys.registerHotkey(key);
      });
    }
    this.hideAdvancedSearch = function(e) {
      vm.service.$virtualPath = false;
      vm.service.$virtualMode = false;

      account = vm.accounts[0];
      mailbox = vm.searchPreviousMailbox;
      vm.search.params = [];
      vm.highlightWords = [];
      if (mailbox && mailbox.path) {
        // Reset
        mailbox.setHighlightWords([]);
        mailbox.$filter({
          "sort": "date",
          "asc": false,
          "match": "OR"
        }).then(function () {
          $state.go('mail.account.mailbox', { accountId: account.id, mailboxId: encodeUriFilter(mailbox.path) });
          vm.$onInit(); // Reinit search fields
        });
      }
      e.stopPropagation();
    };

    this.addHighlightWords = function(sentence) {
      var words = sentence.split(" ");

      words.forEach(word => {
        var cleanedWord = word.trim().toLowerCase();
        if (!this.highlightWords.includes(cleanedWord)) {
          this.highlightWords.push(cleanedWord);
        }
      });
    };

    this.reset = function() {
      this.highlightWords = [];
      this.searchForm = {
        from: '',
        to: '',
        contains: '',
        notContains: '',
        subject: '',
        body: '',
        date: 'anytime',
        dateStart: new Date(),
        dateEnd: new Date(),
        bcc: '',
        size: '',
        sizeOperator: '>',
        sizeUnit: 'mb',
        attachements: 0,
        favorite: 0,
        unseen: 0,
        tags: { searchText: '', selected: '' },
        flags: [],
      };
    }

    this.addSearchParameters = function() {
      this.search.params = [];
      this.highlightWords = [];
      // From
      if (this.searchForm.from && this.searchForm.from.length > 0) {
        this.search.params.push(this.newSearchParam('from', this.searchForm.from));
        this.addHighlightWords(this.searchForm.from);
      }
      // To
      if (this.searchForm.to && this.searchForm.to.length > 0) {
        this.search.params.push(this.newSearchParam('to', this.searchForm.to));
      }
      // Bcc
      if (this.searchForm.bcc && this.searchForm.bcc.length > 0) {
        this.search.params.push(this.newSearchParam('bcc', this.searchForm.bcc));
      }
      // Contains
      if (this.searchForm.contains && this.searchForm.contains.length > 0) {
        this.search.params.push(this.newSearchParam('contains', this.searchForm.contains));
        this.addHighlightWords(this.searchForm.contains);
      }
      // Does not contains
      if (this.searchForm.doesnotcontains && this.searchForm.doesnotcontains.length > 0) {
        this.search.params.push(this.newSearchParam('not_contains', this.searchForm.doesnotcontains));
      }
      // Subject
      if (this.searchForm.subject && this.searchForm.subject.length > 0) {
        this.search.params.push(this.newSearchParam('subject', this.searchForm.subject));
        this.addHighlightWords(this.searchForm.subject);
      }
      // Body
      if (this.searchForm.body && this.searchForm.body.length > 0) {
        this.search.params.push(this.newSearchParam('body', this.searchForm.body));
        this.addHighlightWords(this.searchForm.body);
      }
      // Date
      if (this.searchForm.date && this.searchForm.date.length > 0) {
        var date = null;
        var dateTo = null;
        var today = new Date();
        var tmp = new Date(today);
        switch (this.searchForm.date) {
          case 'anytime':
            break;
          case 'last7days':
            tmp.setDate(tmp.getDate() - 7);
            date = this.formatDate(tmp);
            this.search.params.push(this.newSearchParam('date', date, '>='));
            break;
          case 'last30days':
            tmp.setDate(tmp.getDate() - 30);
            date = this.formatDate(tmp);
            this.search.params.push(this.newSearchParam('date', date, '>='));
            break;
          case 'last6month':
            tmp.setMonth(tmp.getMonth() - 6);
            date = this.formatDate(tmp);
            this.search.params.push(this.newSearchParam('date', date, '>='));
            break;
          case 'before':
            date = this.formatDate(this.searchForm.dateStart);
            this.search.params.push(this.newSearchParam('date', date, '<'));
            break;
          case 'after':
            date = this.formatDate(this.searchForm.dateStart);
            this.search.params.push(this.newSearchParam('date', date, '>='));
            break;
          case 'between':
            date = this.formatDate(this.searchForm.dateStart);
            dateTo = this.formatDate(this.searchForm.dateEnd);
            this.search.params.push(this.newSearchDateBetweenParam(date, dateTo));
            break;
        }
      }
      // Size
      if (this.searchForm.size && this.searchForm.size > 0) {
        this.search.params.push(this.newSearchParam('size', this.searchForm.size.toString(), this.searchForm.sizeOperator));
      }
      // Attachment
      if (this.searchForm.attachements) {
        this.search.params.push(this.newSearchParam('attachment', '1', '='));
      }
      // Favorite
      if (this.searchForm.favorite) {
        this.search.params.push(this.newSearchParam('favorite', '1', '='));
      }
      // Unseen
      if (this.searchForm.unseen) {
        this.search.params.push(this.newSearchParam('unseen', '1', '='));
      }
      // Flags
      if (this.searchForm.flags && this.searchForm.flags.length > 0) {
        this.search.params.push(this.newSearchFlagsParam());
      }

      this.toggleAdvancedSearch();
    }

    this.searchFieldChange = function (event) {
      if (13 == event.keyCode) {
        this.addSearchParameters();
        $mdDialog.hide();
        vm.advancedSearchPanelVisible = false;
      } 
    };

    this.toggleAdvancedSearch = function() {
      if (Mailbox.selectedFolder.$isLoading) {
        // Stop search
        vm.virtualMailbox.stopSearch();
      }
      else {
        // Start search
        var root, mailboxes = [],
            _visit = function(folders) {
              _.forEach(folders, function(o) {
                if (!o.isNoSelect())
                  mailboxes.push(o);
                if (o.children && o.children.length > 0) {
                  _visit(o.children);
                }
              });
            };

        vm.virtualMailbox = new VirtualMailbox(vm.accounts[0]);

        // Don't set the previous selected mailbox if we're in virtual mode
        // That allows users to do multiple advanced search but return
        // correctly to the previously selected mailbox once done.
        if (!Mailbox.$virtualMode)
          vm.searchPreviousMailbox = Mailbox.selectedFolder;

        Mailbox.selectedFolder = vm.virtualMailbox;
        Mailbox.$virtualMode = true;

        if (Mailbox.$virtualPath.length) {
          root = vm.accounts[0].$getMailboxByPath(Mailbox.$virtualPath);
          root.setHighlightWords(vm.highlightWords);
          mailboxes.push(root);
          if (vm.search.subfolders && root.children.length)
            _visit(root.children);
        }
        else {
          mailboxes = _.filter(vm.accounts[0].$flattenMailboxes({ all: true }), function(mailbox) {
            return !mailbox.isNoSelect();
          });
        }

        mailboxes.forEach((mailbox) => {
          mailbox
        });
        vm.virtualMailbox.setMailboxes(mailboxes);
        vm.virtualMailbox.startSearch(vm.search.match, vm.search.params);
        if ($state.$current.name != 'mail.account.virtualMailbox')
          $state.go('mail.account.virtualMailbox', { accountId: vm.accounts[0].id });
      }
    };

  
    this.formatDate = function(date) {
      var year = date.getFullYear();
      var month = (date.getMonth() + 1).toString().padStart(2, '0');
      var day = date.getDate().toString().padStart(2, '0');
      return year + '-' + month + '-' + day;
    };

    this.changeDate = function() {
      if ('between' == this.searchForm.date) {
        if (this.searchForm.dateStart > this.searchForm.dateEnd) {
          this.searchForm.dateEnd = this.searchForm.dateStart;
        }
      }
    };

    this.newSearchParam = function (searchParam, pattern, operator = '>') {
      if (pattern.length && searchParam.length) {
        var n = 0;
        if (pattern.startsWith("!")) {
          n = 1;
          pattern = pattern.substring(1).trim();
        }

        switch (searchParam) {
          case 'size':
            return { searchBy: searchParam, searchInput: pattern, negative: n, operator: operator, sizeUnit: this.searchForm.sizeUnit };
          case 'date':
            return { searchBy: searchParam, searchInput: pattern, negative: n, operator: operator };
          default:
            return { searchBy: searchParam, searchInput: pattern, negative: n };
        }
      }
    };

    this.newSearchDateBetweenParam = function (dateFrom, dateTo) {
      return { searchBy: 'date_between', searchInput: "*", dateFrom: dateFrom, dateTo: dateTo, negative: 0 };
    };

    this.newSearchFlagsParam = function () {
      return { searchBy: 'flags', searchInput: "*", flags: vm.searchForm.flags, negative: 0 };
    };

    this.toggleAccountState = function (account) {
      account.$expanded = !account.$expanded;
      if (!this.debounceSaveState) {
        this.debounceSaveState = $mdUtil.debounce(function () {
          account.$flattenMailboxes({ reload: true, saveState: true });
        }, 1000);
      }
      this.debounceSaveState();
    };

    this.subscribe = function(account) {
      $mdDialog.show({
        templateUrl: account.id + '/subscribe',
        controller: SubscriptionsDialogController,
        controllerAs: 'subscriptions',
        clickOutsideToClose: true,
        escapeToClose: true,
        locals: {
          srcAccount: account
        }
      }).finally(function() {
          account.$getMailboxes({reload: true});
      });

      /**
       * @ngInject
       */
      SubscriptionsDialogController.$inject = ['$scope', '$mdDialog', 'srcAccount'];
      function SubscriptionsDialogController($scope, $mdDialog, srcAccount) {
        var vm = this;

        vm.loading = true;
        vm.filter = { name: '' };
        vm.account = new Account({
          id: srcAccount.id,
          name: srcAccount.name
        });
        vm.close = close;

        vm.account.$getMailboxes({ reload: true, all: true }).then(function() {
          vm.loading = false;
        });

        function close() {
          $mdDialog.hide();
        }
      }
    };
    
    this.showAdvancedSearch = function() {
      if (!vm.advancedSearchPanelVisible) {
        vm.advancedSearchPanelVisible = true;
        if (Mailbox.selectedFolder.path)
          Mailbox.$virtualPath = Mailbox.selectedFolder.path;

        // Close sidenav on small devices
        if (!$mdMedia(sgConstant['gt-md']))
          $mdSidenav('left').close();

        $mdDialog.show({
          template: document.getElementById('advancedSearch').innerHTML,
          parent: angular.element(document.body),
          controller: function () {
            var dialogCtrl = this;

            this.$onInit = function () {
              // Pass main controller
              this.mainController = vm;
              this.mailbox = Mailbox;
              this.message = Message;
            };

            dialogCtrl.closeDialog = function () {
              $mdDialog.hide();
              vm.advancedSearchPanelVisible = false;
            };

            dialogCtrl.search = function () {
              this.mainController.addSearchParameters();
              $mdDialog.hide();
              vm.advancedSearchPanelVisible = false;
            };
          },
          controllerAs: 'dialogCtrl',
          clickOutsideToClose: false,
          escapeToClose: false,
        });
      }
    };

    this.newFolder = function(parentFolder) {
      Dialog.prompt(l('New Folder...'),
                    l('Enter the new name of your folder'))
        .then(function(name) {
          parentFolder.$newMailbox(parentFolder.id, name)
            .then(function() {
              // success
            }, function(data, status) {
              Dialog.alert(l('An error occured while creating the mailbox "%{0}".', name),
                           l(data.error));
            });
        });
    };

    this.showCleanMailboxPanel = function (folder, account) {
        // Close sidenav on small devices
        if (!$mdMedia(sgConstant['gt-md']))
          $mdSidenav('left').close();

        $mdDialog.show({
          template: document.getElementById('cleanMailbox').innerHTML,
          parent: angular.element(document.body),
          controller: function () {
            var dialogCtrl = this;

            this.$onInit = function () {
              this.mainController = vm;
              this.folder = folder;
              this.isMailbox = (folder ? false : true);
              this.name = folder ? folder.$displayName : account.name;
              this.loading = false;
              this.date = null;
              this.form = {
                filterDuration: "3m",
                permanentlyDelete: false,
                confirmDelete: false,
                filterDurationDate: null
              };

              var today = new Date();
              var maxDate = new Date(today);
              maxDate.setMonth(today.getMonth() - 3);
              this.maxDate = maxDate;
            };

            dialogCtrl.closeDialog = function () {
              $mdDialog.hide();
            };

            dialogCtrl.isLoading = function () {
              return this.loading;
            }

            dialogCtrl.isWarningDisplayed = function () {
              return (this.form && this.form.permanentlyDelete);
            }

            dialogCtrl.isApplyDisabled = function () {
              return !(!this.loading 
                && (!this.form.permanentlyDelete || (this.form.permanentlyDelete && this.form.confirmDelete))
                && (this.form.filterDuration != 'custom' || (this.form.filterDuration == 'custom' && this.form.filterDurationDate))
              );
            }

            dialogCtrl.apply = function () {
              var folders = [];
              var i;
              if (account) {
                for (i = 0; i < account.$mailboxes.length ; i++) {
                  folders.push(account.$mailboxes[i].id);
                }
                this.folder = account.$mailboxes[0];
              }
              var date = '';
              var durationMonth = 12;
              var date = new Date();
              switch (this.form.filterDuration) {
                case '3m':
                    durationMonth = 3;
                    date.setMonth(date.getMonth() - durationMonth);
                  break;
                case '6m':
                  durationMonth = 6;
                  date.setMonth(date.getMonth() - durationMonth);
                  break;
                case '9m':
                  durationMonth = 9;
                  date.setMonth(date.getMonth() - durationMonth);
                  break;
                case '1y':
                  durationMonth = 12;
                  date.setMonth(date.getMonth() - durationMonth);
                  break;
                case 'custom':
                  date = this.form.filterDurationDate;
                  break;
              }
              var year = date.getFullYear();
              var month = String(date.getMonth() + 1).padStart(2, '0');
              var day = String(date.getDate()).padStart(2, '0');
              this.date = `${year}-${month}-${day}`;
              this.folder.cleanMailbox({
                'applyToSubfolders': (this.form && this.form.applyToSubfolders) ? this.form.applyToSubfolders : false,
                'permanentlyDelete': (this.form && this.form.permanentlyDelete) ? this.form.permanentlyDelete : false,
                'date': this.date,
                'folders': folders
              }).then(function (data) {
                dialogCtrl.loading = true;
                Mailbox.selectedFolder.$filter({
                  "sort": "date",
                  "asc": false,
                  "match": "OR"
                }).then(function () {
                  $state.go('mail.account.mailbox', { accountId: vm.accounts[0].id, mailboxId: encodeUriFilter(Mailbox.selectedFolder.path) });
                  dialogCtrl.loading = false;
                  $mdDialog.hide();

                  $mdToast.show(
                  $mdToast.simple()
                      .textContent(l('%{0} message(s) deleted', data.nbMessageDeleted))
                    .position(sgConstant.toastPosition)
                    .hideDelay(2000));
                });
              }).catch(function () {
                dialogCtrl.loading = false;
                $mdDialog.hide();
              });
            };
          },
          controllerAs: 'dialogCtrl',
          clickOutsideToClose: false,
          escapeToClose: false,
        });
    };


    this.delegate = function(account) {
      $mdDialog.show({
        templateUrl: account.id + '/delegation', // UI/Templates/MailerUI/UIxMailUserDelegation.wox
        controller: MailboxDelegationController,
        controllerAs: 'delegate',
        clickOutsideToClose: true,
        escapeToClose: true,
        locals: {
          User: User,
          account: account
        }
      });

      /**
       * @ngInject
       */
      MailboxDelegationController.$inject = ['$scope', '$mdDialog', 'User', 'account'];
      function MailboxDelegationController($scope, $mdDialog, User, account) {
        var vm = this;

        vm.users = account.delegates;
        vm.account = account;
        vm.userToAdd = '';
        vm.searchText = '';
        vm.userFilter = userFilter;
        vm.closeModal = closeModal;
        vm.removeUser = removeUser;
        vm.addUser = addUser;

        function userFilter($query) {
          return User.$filter($query, account.delegates);
        }

        function closeModal() {
          $mdDialog.hide();
        }

        function removeUser(user) {
          account.$removeDelegate(user.uid).catch(function(data, status) {
            Dialog.alert(l('Warning'), l('An error occured, please try again.'));
          });
        }

        function addUser(data) {
          if (data) {
            account.$addDelegate(data).then(function() {
              vm.userToAdd = '';
              vm.searchText = '';
            }, function(error) {
              Dialog.alert(l('Warning'), error);
            });
          }
        }
      }
    }; // delegate

    this.isDroppableFolder = function(srcFolder, dstFolder) {
      return (dstFolder.id != srcFolder.id) && dstFolder.isWritable();
    };

    this.dragSelectedMessages = function(srcFolder, dstFolder, mode) {
      var dstId, messages, uids, clearMessageView, promise, success;

      dstId = '/' + dstFolder.id;
      messages = srcFolder.selectedMessages();
      if (messages.length === 0)
        messages = [srcFolder.selectedMessage()];
      uids = _.map(messages, 'uid');
      clearMessageView = (srcFolder.$selectedMessage && uids.indexOf(srcFolder.$selectedMessage) >= 0);

      if (mode == 'copy') {
        promise = srcFolder.$copyMessages(messages, dstId);
        success = l('%{0} message(s) copied', messages.length);
      }
      else {
        promise = srcFolder.$moveMessages(messages, dstId);
        success = l('%{0} message(s) moved', messages.length);
      }

      promise.then(function() {
        if (clearMessageView)
          $state.go('mail.account.mailbox');
        $mdToast.show(
          $mdToast.simple()
            .textContent(success)
            .position(sgConstant.toastPosition)
            .hideDelay(2000));
      });
    };

  }

  angular
    .module('SOGo.MailerUI')
    .controller('MailboxesController', MailboxesController);

  
})();

/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @ngInject
   */
  MessageController.$inject = ['$window', '$scope', '$q', '$state', '$mdMedia', '$mdDialog', '$mdPanel', 'sgConstant', 'stateAccounts', 'stateAccount', 'stateMailbox', 'stateMessage', 'sgHotkeys', 'encodeUriFilter', 'sgSettings', 'ImageGallery', 'sgFocus', 'Dialog', 'Preferences', 'Calendar', 'Component', 'Account', 'Mailbox', 'Message', 'AddressBook', 'Card'];
  function MessageController($window, $scope, $q, $state, $mdMedia, $mdDialog, $mdPanel, sgConstant, stateAccounts, stateAccount, stateMailbox, stateMessage, sgHotkeys, encodeUriFilter, sgSettings, ImageGallery, focus, Dialog, Preferences, Calendar, Component, Account, Mailbox, Message, AddressBook, Card) {
    var vm = this, popupWindow = null, hotkeys = [];

    this.$onInit = function() {
      var isPopupWindow = false;

      // Expose controller
      $window.$messageController = vm;

      // Initialize image gallery service
      ImageGallery.setMessage(stateMessage);

      this.$state = $state;
      this.accounts = stateAccounts;
      this.account = stateAccount;
      this.mailbox = stateMailbox;
      this.message = stateMessage;
      this.service = Message;
      this.tags = { searchText: '', selected: '' };
      this.showFlags = stateMessage.flags && stateMessage.flags.length > 0;
      this.$alwaysShowDetailedRecipients = (!stateMessage.to || stateMessage.to.length < 5) && (!stateMessage.cc || stateMessage.cc.length < 5);
      this.$showDetailedRecipients = this.$alwaysShowDetailedRecipients;
      this.showRawSource = false;
      this.mailInDeletion = -1;

      _registerHotkeys(hotkeys);

      // Detect if this is message appears in a separate window
      try {
        isPopupWindow = $window.opener && '$mailboxController' in $window.opener;
      }
      catch (e) {}

      // One-way refresh of the parent window when modifying the message from a popup window.
      if (isPopupWindow) {
        // Update the message flags. The message must be displayed in the parent window.
        $scope.$watchCollection(function() { return vm.message.flags; }, function(newTags, oldTags) {
          var ctrls;
          if (newTags || oldTags) {
            ctrls = $parentControllers();
            if (ctrls.messageCtrl) {
              ctrls.messageCtrl.service.$timeout(function() {
                ctrls.messageCtrl.showFlags = true;
                ctrls.messageCtrl.message.flags = newTags;
              });
            }
          }
        });
        // Update the "isflagged" (star icon) of the message. The mailbox must be displayed in the parent window.
        $scope.$watch(function() { return vm.message.isflagged; }, function(isflagged, wasflagged) {
          var ctrls = $parentControllers();
          if (ctrls.mailboxCtrl) {
            ctrls.mailboxCtrl.service.$timeout(function() {
              var message = _.find(ctrls.mailboxCtrl.selectedFolder.$messages, { uid: vm.message.uid });
              message.isflagged = isflagged;
            });
          }
        });
      }
      else {
        // Flatten new tags when coming from the predefined list of tags (Message.$tags) and
        // sync tags with server when adding or removing a tag.
        $scope.$watchCollection(function() { return vm.message.flags; }, function(_newTags, _oldTags) {
          var newTags, oldTags, tags;
          if (_newTags || _oldTags) {
            newTags = _newTags || [];
            oldTags = _oldTags || [];
            _.forEach(newTags, function(tag, i) {
              if (angular.isObject(tag))
                newTags[i] = tag.name;
            });
            if (newTags.length > oldTags.length) {
              tags = _.difference(newTags, oldTags);
              _.forEach(tags, function(tag) {
                vm.message.addTag(tag);
              });
            }
            else if (newTags.length < oldTags.length) {
              tags = _.difference(oldTags, newTags);
              _.forEach(tags, function(tag) {
                vm.message.removeTag(tag);
              });
            }
          }
        });
      }

      $scope.$on('$destroy', function() {
        // Deregister hotkeys
        _.forEach(hotkeys, function(key) {
          sgHotkeys.deregisterHotkey(key);
        });
        // Cancel automatic mark as read
        if (vm.message.$markAsReadPromise)
          vm.service.$timeout.cancel(vm.message.$markAsReadPromise);
        // Remove controller from window
        delete $window.$messageController;
      });

    }; // $onInit


    /**
     * To keep track of the currently active dialog, we share a common variable with the parent controller.
     */
    function _messageDialog() {
      if ($scope.mailbox) {
        if (arguments.length > 0)
          $scope.mailbox.messageDialog = arguments[0];
        return $scope.mailbox.messageDialog;
      }
      return null;
    }

    function _unlessInDialog(callback) {
      return function() {
        // Check if a dialog is opened either from the current controller or the parent controller
        if (_messageDialog() === null)
          return callback.apply(vm, arguments);
      };
    }

    function _registerHotkeys(keys) {
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_reply'),
        description: l('Reply to the message'),
        callback: _unlessInDialog(angular.bind(vm, vm.reply))
      }));
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_replyall'),
        description: l('Reply to sender and all recipients'),
        callback: _unlessInDialog(angular.bind(vm, vm.replyAll))
      }));
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_forward'),
        description: l('Forward selected message'),
        callback: _unlessInDialog(angular.bind(vm, vm.forward))
      }));
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_flag'),
        description: l('Flagged'),
        callback: _unlessInDialog(angular.bind(stateMessage, stateMessage.toggleFlag))
      }));
      _.forEach(['backspace', 'delete'], function(hotkey) {
        keys.push(sgHotkeys.createHotkey({
          key: hotkey,
          callback: _unlessInDialog(function($event) {
            if (vm.mailbox.selectedCount() === 0 
                  && vm.message.uid !== vm.mailInDeletion) //prevent calling function if it was alredy made for this mail
              vm.deleteMessage();
            $event.preventDefault();
          }),
        }));
      });

      // Register the hotkeys
      _.forEach(keys, function(key) {
        sgHotkeys.registerHotkey(key);
      });
    }

    /**
     * If this is a popup window, retrieve the matching controllers (mailbox and message) of the parent window.
     */
    function $parentControllers() {
      var message, mailbox, ctrls = {};
      if ($window.opener) {
        // Deleting the message from a popup window
        if ('$mailboxController' in $window.opener &&
            'selectedFolder' in $window.opener.$mailboxController &&
            $window.opener.$mailboxController.selectedFolder.$id() == stateMailbox.$id()) {
            // The message mailbox is opened in the parent window
            mailbox = $window.opener.$mailboxController;
            ctrls.mailboxCtrl = mailbox;
            if ('$messageController' in $window.opener &&
                $window.opener.$messageController.message.uid == stateMessage.uid) {
              // The message is opened in the parent window
              message = $window.opener.$messageController;
              ctrls.messageCtrl = message;
            }
        }
      }
      return ctrls;
    }

    this.addFlags = function($event) {
      $event.stopPropagation();
      $event.preventDefault();
      this.showFlags = true;
      focus("flags");
    };

    this.toggleDetailedRecipients = function($event) {
      this.$showDetailedRecipients = !this.$showDetailedRecipients;
      $event.stopPropagation();
      $event.preventDefault();
    };

    this.focusChip = function($event) {
      var chipElement = $event.target;
      while (chipElement.tagName !== 'MD-CHIP') {
        chipElement = chipElement.parentNode;
      }
      chipElement.classList.add('md-focused');
    };

    this.blurChip = function($event) {
      var chipElement = $event.target;
      while (chipElement.tagName !== 'MD-CHIP') {
        chipElement = chipElement.parentNode;
      }
      chipElement.classList.remove('md-focused');
      if ($event.relatedTarget && $event.relatedTarget.tagName === 'MD-CHIP-TEMPLATE') {
        // Moving to another chip; close menu
        vm.panel.close();
      }
    };

    this.selectRecipient = function(recipient, $event) {
      // Fetch addressbooks list
      AddressBook.$findAll([]);

      var targetElement = $event.target;

      var panelPosition = $mdPanel.newPanelPosition()
          .relativeTo(targetElement)
          .addPanelPosition(
            $mdPanel.xPosition.ALIGN_START,
            $mdPanel.yPosition.ALIGN_TOPS
          );

      var panelAnimation = $mdPanel.newPanelAnimation()
          .openFrom(targetElement)
          .duration(100)
          .withAnimation($mdPanel.animation.FADE);

      var config = {
        attachTo: angular.element(document.body),
        locals: {
          recipient: recipient,
          addressbooks: AddressBook.$addressbooks,
          subscriptions: AddressBook.$subscriptions,
          newMessage: angular.bind(this, this.newMessage)
        },
        bindToController: true,
        controller: MenuController,
        controllerAs: '$menuCtrl',
        position: panelPosition,
        animation: panelAnimation,
        targetEvent: $event,
        templateUrl: 'UIxMailViewRecipientMenu',
        trapFocus: true,
        clickOutsideToClose: true,
        escapeToClose: true,
        focusOnOpen: false
      };

      $mdPanel.open(config)
        .then(function(panelRef) {
          vm.panel = panelRef;
          // Automatically close panel when clicking inside of it
          panelRef.panelEl.one('click', function() {
            panelRef.close();
          });
        });

      MenuController.$inject = ['mdPanelRef', '$state', '$mdToast'];
      function MenuController(mdPanelRef, $state, $mdToast) {
        this.onKeyDown = function($event) {
          if ($event.which === 9) { // Tab
            mdPanelRef.close();
          }
        };

        this.newCard = function(recipient, addressbookId) {
          var card = new Card({
            pid: addressbookId,
            c_cn: recipient.name,
            emails: [{ value: recipient.email }]
          });
          card.$id().then(function(id) {
            card.$save().then(function() {
              // Show success toast when action succeeds
              $mdToast.show(
                $mdToast.simple()
                  .textContent(l('Successfully created card'))
                  .position(sgConstant.toastPosition)
                  .hideDelay(2000));
            });
          });
          mdPanelRef.close();
        };
      }

      if (targetElement.tagName === 'A') {
        $event.stopPropagation();
        $event.preventDefault();
      }
    };

    this.filterMailtoLinks = function($event) {
      var href, match, to, cc, bcc, subject, body, data;
      if ($event.target.tagName == 'A' && 'href' in $event.target.attributes) {
        href = $event.target.attributes.href.value;
        match = /^mailto:([^\?]+)/.exec(href);
        if (match) {
          delete $event.target.attributes.target;
          this.newMessage($event, href); // will stop event propagation
        }
      }
    };

    this.deleteMessage = function() {
      var mailbox, message, state, nextMessage, previousMessage,
          parentCtrls = $parentControllers(),
          $timeout = this.service.$timeout;

      if (parentCtrls.messageCtrl) {
        mailbox = parentCtrls.mailboxCtrl.selectedFolder;
        message = parentCtrls.messageCtrl.message;
        state = parentCtrls.messageCtrl.$state;
      }
      else {
        mailbox = stateMailbox;
        message = stateMessage;
        state = $state;
      }
      if (Mailbox.$virtualMode) {
        mailbox = Mailbox.selectedFolder; // the VirtualMailbox instance
      }
      vm.mailInDeletion = message.uid;

      function _success(index) {
        var nextIndex = index;
        // Remove message object from scope
        message = null;
        if (angular.isDefined(state)) {
          // Select either the next or previous message
          if (index > 0) {
            nextIndex -= 1;
            nextMessage = mailbox.getItemAtIndex(nextIndex);
          }
          if (index < mailbox.getLength())
            previousMessage = mailbox.getItemAtIndex(index);

          if (nextMessage) {
            if (nextMessage.isread && previousMessage && !previousMessage.isread) {
              nextIndex = index;
              nextMessage = previousMessage;
            }
          }
          else if (previousMessage) {
            nextIndex = index;
            nextMessage = previousMessage;
          }

          try {
            if (nextMessage && $mdMedia(sgConstant['gt-md'])) {
              if (Mailbox.$virtualMode)
                state.go('mail.account.virtualMailbox.message', {mailboxId: encodeUriFilter(nextMessage.$mailbox.path), messageId: nextMessage.uid});
              else
                state.go('mail.account.mailbox.message', {messageId: nextMessage.uid});
              $timeout(function() {
                if (nextIndex < mailbox.$topIndex)
                  mailbox.$topIndex = nextIndex;
                else if (nextIndex > mailbox.$lastVisibleIndex)
                  mailbox.$topIndex = nextIndex - (mailbox.$lastVisibleIndex - mailbox.$topIndex);
              });
            }
            else {
              state.go('mail.account.mailbox').then(function() {
                message = null;
                delete mailbox.$selectedMessage;
              });
            }
          }
          catch (error) {}
        }
        vm.closePopup();
      }

      mailbox.$deleteMessages([message]).then(_success, function(response) {
        _messageDialog(
            Dialog.confirm(l('Warning'),
                           l('The message could not be moved to the trash folder. Would you like to delete it immediately?'),
                           { ok: l('Delete') })
            .then(function() {
              mailbox.$deleteMessages([message], { withoutTrash: true })
                .then(_success)
                .finally(function() {
                  _messageDialog(null);
                });
            })
            .finally(function() {
              _messageDialog(null);
            })
        );
      });
    };

    function _showMailEditor($event, message) {
      if (_messageDialog() === null) {
        var onCompleteDeferred = $q.defer();
        _messageDialog(
          $mdDialog
            .show({
              parent: angular.element(document.body),
              targetEvent: $event,
              clickOutsideToClose: false,
              escapeToClose: false,
              templateUrl: 'UIxMailEditor',
              controller: 'MessageEditorController',
              controllerAs: 'editor',
              onComplete: function (scope, element) {
                return onCompleteDeferred.resolve(element);
              },
              locals: {
                stateParent: $scope,
                stateAccount: vm.account,
                stateMessage: message,
                onCompletePromise: function () {
                  return onCompleteDeferred.promise;
                }
              }
            })
            .catch(_.noop) // Cancel
            .finally(function() {
              _messageDialog(null);
              vm.closePopup();
            })
        );
      }
    }

    this._showMailEditorInPopup = function(action) {
      if (!sgSettings.isPopup &&
          Preferences.defaults.SOGoMailComposeWindow == 'popup') {
        this.openInPopup(action);
        return true;
      }
      return false;
    };

    this.close = function() {
      var destination = Mailbox.$virtualMode ? 'mail.account.virtualMailbox' : 'mail.account.mailbox';
      $state.go(destination).then(function() {
        vm.message = null;
        delete stateMailbox.$selectedMessage;
      });
    };

    this.reply = function($event) {
      if (!this._showMailEditorInPopup('reply')) {
        _showMailEditor($event, this.message.$reply());
      }
    };

    this.replyAll = function($event) {
      if (!this._showMailEditorInPopup('replyall')) {
        _showMailEditor($event, this.message.$replyAll());
      }
    };

    this.forward = function($event) {
      if (!this._showMailEditorInPopup('forward')) {
        _showMailEditor($event, this.message.$forward());
      }
    };

    this.edit = function($event) {
      if (!this._showMailEditorInPopup('edit')) {
        this.message.$editableContent().then(function() {
          _showMailEditor($event, vm.message);
        });
      }
    };

    this.compose = function($event) {
      if (!this._showMailEditorInPopup('compose')) {
        _showMailEditor($event, this.message.$compose());
      }
    };

    this.openInPopup = function(action) {
      var url = [sgSettings.baseURL(),
                 'UIxMailPopupView#!/Mail',
                 this.message.accountId,
                 // The double-encoding is necessary
                 encodeUriFilter(encodeUriFilter(this.message.$mailbox.path)),
                 this.message.uid]
          .join('/'),
          wId = this.message.$absolutePath();
      if (action) {
        wId += '/' + action;
        url += '/' + action;
      }
      popupWindow = $window.open(url, wId,
                                 ["width=680",
                                  "height=520",
                                  "resizable=1",
                                  "scrollbars=1",
                                  "toolbar=0",
                                  "location=0",
                                  "directories=0",
                                  "status=0",
                                  "menubar=0",
                                  "copyhistory=0"]
                                 .join(','));
    };

    this.closePopup = function() {
      if ($window.document.body.classList.contains('popup'))
        $window.close();
    };

    this.newMessage = function($event, mailto) {
      if ($event.target.tagName === 'A') {
        $event.stopPropagation();
        $event.preventDefault();
      }
      this.account.$newMessage({ mailto: mailto }).then(function(message) {
        _showMailEditor($event, message);
      });
    };

    this.toggleRawSource = function($event) {
      if (!this.showRawSource && !this.message.$rawSource) {
        Message.$$resource.post(this.message.id, "viewsource").then(function(data) {
          vm.message.$rawSource = data;
          vm.showRawSource = true;
        });
      }
      else {
        this.showRawSource = !this.showRawSource;
      }
    };

    this.activateRawContent = function ($event) {
      this.openInPopup('viewRaw');
    };

    this.print = function($event) {
      $window.print();
    };

    this.convertToEvent = function($event) {
      return _convertToComponent($event, 'appointment');
    };

    this.convertToTask = function($event) {
      return _convertToComponent($event, 'task');
    };

    function _convertToComponent($event, type) {
      vm.message.$plainContent().then(function(data) {
        var componentData = {
          pid: Calendar.$defaultCalendar(),
          type: type,
          summary: data.subject,
          comment: data.content
        };
        var component = new Component(componentData);
        // UI/Templates/SchedulerUI/UIxAppointmentEditorTemplate.wox or
        // UI/Templates/SchedulerUI/UIxTaskEditorTemplate.wox
        var templateUrl = [
          sgSettings.activeUser('folderURL'),
          'Calendar',
          'UIx' + type.capitalize() + 'EditorTemplate'
        ].join('/');
        return $mdDialog.show({
          parent: angular.element(document.body),
          targetEvent: $event,
          clickOutsideToClose: true,
          escapeToClose: true,
          templateUrl: templateUrl,
          controller: 'ComponentEditorController',
          controllerAs: 'editor',
          locals: {
            stateComponent: component
          }
        });
      });
    }
  }

  angular
    .module('SOGo.MailerUI')
    .controller('MessageController', MessageController);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @ngInject
   */
  MessageEditorController.$inject = ['$scope', '$window', '$stateParams', '$mdUtil', '$mdDialog', '$mdToast', 'FileUploader', 'stateParent', 'stateAccount', 'stateMessage', 'onCompletePromise', 'encodeUriFilter', '$timeout', 'sgConstant', 'sgFocus', 'Dialog', 'AddressBook', 'Card', 'Preferences'];
  function MessageEditorController($scope, $window, $stateParams, $mdUtil, $mdDialog, $mdToast, FileUploader, stateParent, stateAccount, stateMessage, onCompletePromise, encodeUriFilter, $timeout, sgConstant, focus, Dialog, AddressBook, Card, Preferences) {
    var vm = this;

    this.$onInit = function() {
      $scope.isPopup = stateParent.isPopup;

      this.account = stateAccount;
      this.autocomplete = {to: {}, cc: {}, bcc: {}};
      this.autosave = null;
      this.isFullscreen = (typeof screen.orientation !== 'undefined' && screen.orientation && 'portrait-primary' == screen.orientation.type);
      this.hideBcc = (stateMessage.editable.bcc.length === 0);
      this.hideCc = (stateMessage.editable.cc.length === 0);
      this.identities = stateAccount.identities;
      this.fromIdentity = stateMessage.editable.from;
      this.identitySearchText = '';
      this.message = stateMessage;
      this.recipientSeparatorKeys = Preferences.defaults.emailSeparatorKeys;
      this.sendState = false;
      this.toggleFullscreen = toggleFullscreen;
      this.firstFocus = true;
      this.editor = null;

      _initFileUploader();

      // Read user's defaults
      if (Preferences.defaults.SOGoMailAutoSave)
        // Enable auto-save of draft
        this.autosave = $timeout(this.autosaveDrafts, Preferences.defaults.SOGoMailAutoSave*1000*60);

      // Set the locale of CKEditor
      this.localeCode = Preferences.defaults.LocaleCode;
      this.ckConfig = { language: Preferences.defaults.ckLocaleCode };

      this.composeType = Preferences.defaults.SOGoMailComposeMessageType;

      this.signaturePlacement = Preferences.defaults.SOGoMailSignaturePlacement;
      this.replyPlacement = Preferences.defaults.SOGoMailReplyPlacement;
      if (this.message.origin && this.message.origin.action == 'forward') {
        // For forwards, place caret at top unconditionally
        this.replyPlacement = 'above';
      }

      // Destroy file uploader when the controller is being deactivated
      $scope.$on('$destroy', function() { vm.uploader.destroy(); });

      if ($stateParams.actionName == 'reply') {
        stateMessage.$reply().then(function(msgObject) {
          vm.message = msgObject;
          vm.fromIdentity = msgObject.editable.from;
          vm.hideCc = (!msgObject.editable.cc || msgObject.editable.cc.length === 0);
          vm.hideBcc = (!msgObject.editable.bcc || msgObject.editable.bcc.length === 0);
          _updateFileUploader();
        });
      }
      else if ($stateParams.actionName == 'replyall') {
        stateMessage.$replyAll().then(function(msgObject) {
          vm.message = msgObject;
          vm.fromIdentity = msgObject.editable.from;
          vm.hideCc = (!msgObject.editable.cc || msgObject.editable.cc.length === 0);
          vm.hideBcc = (!msgObject.editable.bcc || msgObject.editable.bcc.length === 0);
          _updateFileUploader();
        });
      }
      else if ($stateParams.actionName == 'forward') {
        stateMessage.$forward().then(function(msgObject) {
          vm.message = msgObject;
          vm.fromIdentity = msgObject.editable.from;
          _updateFileUploader();
          _addAttachments();
        });
      }
      else if ($stateParams.actionName == 'compose') {
        stateMessage.$compose().then(function(msgObject) {
          vm.message = msgObject;
          vm.fromIdentity = msgObject.editable.from;
          _updateFileUploader();
          _addAttachments();
        });
      }
      else if (angular.isDefined(stateMessage)) {
        this.message = stateMessage;
        _updateFileUploader();
        _addAttachments();
      }
    };

    /**
     * If this is a popup window, retrieve the mailbox controller of the parent window.
     */
    function $parentControllers() {
      var originMessage, ctrls = {};

      try {
        if ($window.opener) {
          if ('$mailboxController' in $window.opener &&
              'selectedFolder' in $window.opener.$mailboxController) {
            if ($window.opener.$mailboxController.selectedFolder.id == stateMessage.$mailbox.id) {
              ctrls.draftMailboxCtrl = $window.opener.$mailboxController;
              if ('$messageController' in $window.opener &&
                  $window.opener.$messageController.message.uid == stateMessage.uid) {
                // The draft is opened in the parent window
                ctrls.draftMessageCtrl = $window.opener.$messageController;
              }
            }
            else if (stateMessage.origin) {
              originMessage = stateMessage.origin.message;
              if ($window.opener.$mailboxController.selectedFolder.$id() == originMessage.$mailbox.$id()) {
                // The message mailbox is opened in the parent window
                ctrls.originMailboxCtrl = $window.opener.$mailboxController;
              }
            }
          }
        }
      }
      catch (e) {}

      return ctrls;
    }

    function _initFileUploader() {
      vm.uploader = new FileUploader({
        url: vm.message.$absolutePath({asDraft: true, withResourcePath: true}) + '/save',
        autoUpload: true,
        alias: 'attachments',
        removeAfterUpload: false,
        // onProgressItem: function(item, progress) {
        //   console.debug(item); console.debug(progress);
        // },
        onSuccessItem: function(item, response, status, headers) {
          vm.message.$setUID(response.uid);
          vm.message.$reload();
          item.inlineUrl = response.lastAttachmentAttrs[0].url;
          item.file.name = response.lastAttachmentAttrs[0].filename;
          //console.debug(item); console.debug('success = ' + JSON.stringify(response, undefined, 2));
        },
        onCancelItem: function(item, response, status, headers) {
          //console.debug(item); console.debug('cancel = ' + JSON.stringify(response, undefined, 2));
          // We remove the attachment
          vm.message.$deleteAttachment(item.file.name);
          this.removeFromQueue(item);
        },
        onErrorItem: function(item, response, status, headers) {
          $mdToast.show(
            $mdToast.simple()
              .textContent(l('Error while uploading the file \"%{0}\":', item.file.name) +
                       ' ' + (response.message? l(response.message) : ''))
              .position(sgConstant.toastPosition)
              .action(l('OK'))
              .hideDelay(false));
          this.removeFromQueue(item);
          //console.debug(item); console.debug('error = ' + JSON.stringify(response, undefined, 2));
        }
      });
    }

    function _updateFileUploader() {
      vm.uploader.url = vm.message.$absolutePath({asDraft: true, withResourcePath: true}) + '/save';
    }

    function _addAttachments() {
      // Add existing attached files to uploader
      var i, data, fileItem, attrs = vm.message.editable.attachmentAttrs;
      if (attrs)
        for (i = 0; i < attrs.length; i++) {
          data = {
            name: attrs[i].filename,
            type: attrs[i].mimetype,
            size: parseInt(attrs[i].size)
          };
          fileItem = new FileUploader.FileItem(vm.uploader, data);
          fileItem.progress = 100;
          fileItem.isUploaded = true;
          fileItem.isSuccess = true;
          fileItem.inlineUrl = attrs[i].url;
          vm.uploader.queue.push(fileItem);
        }
    }

    this.removeAttachment = function (item, id) {
      var _this = this;
      if (item.isUploading)
        vm.uploader.cancelItem(item);
      else {
        vm.message.$deleteAttachment(item.file.name).then(function() {
          _this.save({toast: false});
        });
        item.remove();
      }
      // Hack to allow adding the same file again
      // See https://github.com/nervgh/angular-file-upload/issues/671
      var element = $window.document.getElementById(id);
      if (element)
        angular.element(element).prop('value', null);
    };

    this.cancel = function () {
      if (this.autosave)
        $timeout.cancel(this.autosave);

      if (this.message.isNew && this.message.attachmentAttrs)
        this.message.$mailbox.$deleteMessages([this.message]);

      $mdDialog.hide();
    };

    // Fix for https://www.sogo.nu/bugs/view.php?id=4666
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

    this.save = function (options) {
      var ctrls = $parentControllers();
      this.message.$save().then(function() {
        vm.message.$rawSource = null;
        if (ctrls.draftMailboxCtrl) {
          // We're saving a draft from a popup window.
          // Reload draft mailbox
          ctrls.draftMailboxCtrl.selectedFolder.$filter().then(function() {
            if (ctrls.draftMessageCtrl) {
              // Reload selected message
              ctrls.draftMessageCtrl.$state.go('mail.account.mailbox.message', { messageId: vm.message.uid, reload: true });
            }
          });
        }
        if (!options || options.toast) {
          $mdToast.show(
            $mdToast.simple()
              .textContent(l('Your email has been saved'))
              .position(sgConstant.toastPosition)
              .hideDelay(3000));
        }
      });
    };

    this.send = function () {
      if (this.editor && this.editor.component)
        this.editor.component.onEditorChange(true); // Call onEditorChange on sgCkEditor component
      
      this.sendState = 'sending';
      if (this.autosave)
        $timeout.cancel(this.autosave);

      this.message.$send().then(function(data) {
        var ctrls = $parentControllers();
        vm.sendState = 'sent';
        if (ctrls.draftMailboxCtrl) {
          // We're sending a draft from a popup window and the draft mailbox is opened.
          // Reload draft mailbox
          ctrls.draftMailboxCtrl.selectedFolder.$filter().then(function() {
            if (ctrls.draftMessageCtrl) {
              // Close draft
              ctrls.draftMessageCtrl.close();
            }
          });
        }
        if (ctrls.originMailboxCtrl) {
          // We're sending a draft from a popup window and the original mailbox is opened.
          // Reload mailbox
          ctrls.originMailboxCtrl.selectedFolder.$filter();
        }
        $mdToast.show(
          $mdToast.simple()
            .textContent(l('Your email has been sent'))
            .position(sgConstant.toastPosition)
            .hideDelay(3000));

        // Let the user see the succesfull message before closing the dialog
        $timeout($mdDialog.hide, 1000);
      }, function(response) {
        $timeout(function() {
          vm.sendState = 'error';
          vm.errorMessage = response.data? response.data.message : response.statusText;
        });
      });
    };

    function toggleFullscreen() {
      vm.isFullscreen = !vm.isFullscreen;
    }

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

    this.addRecipient = function (contact, field) {
      var recipients, recipient, list, i, address;

      recipients = this.message.editable[field];

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

        return null;
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
        recipient = contact.$shortFormat();
      }

      if (recipient)
        return recipient;
      else
        return null;
    };

    this.setFromIdentity = function (identity) {
      var node, children, nl, reNl, nlNb, space, signature, previousIdentity;

      if (identity && identity.full)
      {
        this.message.editable.from = identity.full;
        if(identity.replyTo)
          this.message.editable.replyTo = identity.replyTo
      }
      else if (identity && identity.length)
        return;

      if (this.composeType == "html") {
        nl = '<br />';
        reNl = '<br ?/>(&nbsp;)?[ \n]?';
        space = '&nbsp;';
      } else {
        nl = '\n';
        reNl = '\n';
        space = ' ';
      }

      // One newline above signature when placed at the bottom, two newlines when placed at the top (see HTML templates)
      if (this.signaturePlacement == 'above')
        nlNb = 2;
      else
        nlNb = 1;
      
      if ((vm.isNew() && Preferences.defaults.SOGoMailUseSignatureOnNew === 1)
        || (!vm.isNew() && Preferences.defaults.SOGoMailUseSignatureOnForward === 1 && vm.message && vm.message.origin && vm.message.origin.action && vm.message.origin.action === 'forward')
        || (!vm.isNew() && Preferences.defaults.SOGoMailUseSignatureOnReply === 1 && vm.message && vm.message.origin && vm.message.origin.action && vm.message.origin.action === 'reply')
        ) {
        if (identity && identity.signature)
          signature = nl.repeat(nlNb) + '--' + space + nl + identity.signature;
        else
          signature = '';
        
        previousIdentity = _.find(this.identities, function (currentIdentity, index) {

          if (currentIdentity.signature) {
            try {
              var currentSignature = new RegExp('(' + reNl + '){' + nlNb + '}--' + space + reNl +
                currentIdentity.signature.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, '\\$&'));
              if (vm.message.editable.text.search(currentSignature) >= 0) {
                vm.message.editable.text = vm.message.editable.text.replace(currentSignature, signature);
                return true;
              }
            } catch (error) {
              // An error can occur (regex too long) when the signature is too big (using images)
              // In this case, just add the signature at the end (#5695)
              vm.message.editable.text += signature;
              return true;
            }
            
          }
          return false;
        });
        
        if (!previousIdentity && signature.length > 0) {
          // Must place signature at proper place
          if (!this.isNew() && this.replyPlacement == 'above' && this.signaturePlacement == 'above') {
            var quotedMessageIndex = this.message.editable.text.search(new RegExp(reNl + '.+?:( ?' + reNl + '){' + nlNb + '}(> |<blockquote type="cite")'));
            if (quotedMessageIndex >= 0) {
              this.message.editable.text =
                this.message.editable.text.slice(0, quotedMessageIndex) +
                signature +
                this.message.editable.text.slice(quotedMessageIndex);
            } else {
              this.message.editable.text = signature + this.message.editable.text;
            }
          } else {
            this.message.editable.text += signature;
          }
        }
      }
    };

    this.identitySearch = function (query) {
      var q = query ? query : '';
      return _.filter(stateAccount.identities, function(identity) {
        return identity.full.toLowerCase().indexOf(q.toLowerCase()) >= 0;
      });
    };

    this.expandGroup = function(contact, field) {
      var recipients, i, j;
      recipients = this.message.editable[field];
      i = recipients.indexOf(contact);
      recipients.splice(i, 1);
      for (j = 0; j < contact.members.length; j++) {
        var recipient = contact.members[j].$shortFormat();
        if (recipients.indexOf(recipient) < 0)
          recipients.splice(i + j, 0, contact.members[j].$shortFormat());
      }
    };

    // Drafts autosaving
    this.autosaveDrafts = function () {
      vm.message.$save();
      if (Preferences.defaults.SOGoMailAutoSave)
        vm.autosave = $timeout(vm.autosaveDrafts, Preferences.defaults.SOGoMailAutoSave*1000*60);
    };

    this.isNew = function () {
      return typeof this.message.origin == 'undefined';
    };

    this.onTextFocus = function ($event) {
      var textArea = $event.target;

      function adjustOffset(val, offset) {
        var newOffset = offset, matches;
        if (val.indexOf("\r\n") > -1) {
          matches = val.replace(/\r\n/g, "\n").slice(0, offset).match(/\n/g);
          newOffset -= matches ? matches.length - 1 : 0;
        }
        return newOffset;
      }

      if (this.firstFocus) {
        onCompletePromise().then(function(element) {
          var textContent = angular.element(textArea).val(),
              hasSignature = /\n-- \n/.test(textContent),
              signatureLength = 0,
              sigLimit,
              caretPosition;

          if (vm.replyPlacement == 'above') {
            textArea.setCaretTo(0);
            element.find('md-dialog-content')[0].scrollTop = 0;
          }
          else {
            // Search for signature starting from bottom
            if (hasSignature) {
              sigLimit = textContent.lastIndexOf("-- ");
              if (sigLimit > -1)
                signatureLength = (textContent.length - sigLimit);
            }
            caretPosition = textContent.length - signatureLength;
            caretPosition = adjustOffset(textContent, caretPosition);
            if (hasSignature)
              caretPosition -= 2;
            textArea.setCaretTo(caretPosition);
          }
        });

        this.firstFocus = false;
      }
    };

    this.onHTMLReady = function ($editor) {
      if (!this.isNew()) {
        this.editor = $editor;
        onCompletePromise().then(function() {
          $editor.focus();
        });
      }
    };

    this.onHTMLFocus = function (editor) {
      if (this.firstFocus) {
        onCompletePromise().then(function(element) {
          var caretAtTop = (vm.replyPlacement == 'above'),
              selected = editor.getSelection(),
              selected_ranges = selected.getRanges(),
              children = editor.document.getBody().getChildren(),
              node;

          if (caretAtTop) {
            node = children.getItem(0);
          }
          else {
            // Search for signature starting from bottom
            node = children.getItem(children.count() - 1);
            while (true) {
              var x = node.getPrevious();
              if (x === null) {
                break;
              }
              if (/--(%20|%A0|%C2%A0)/.test(encodeURI(x.getText()))) {
                node = x.getPrevious().getPrevious();
                break;
              }
              node = x;
            }
          }
          selected.selectElement(node);

          // Place the caret
          if (caretAtTop)
            selected.scrollIntoView(); // top
          selected_ranges = selected.getRanges();
          selected_ranges[0].collapse(true);
          selected.selectRanges(selected_ranges);
          if (!caretAtTop)
            selected.scrollIntoView(); // bottom
        });

        this.firstFocus = false;
      }
    };
  }

  SendMessageToastController.$inject = ['$scope', '$mdToast'];
  function SendMessageToastController($scope, $mdToast) {
    $scope.closeToast = function() {
      $mdToast.hide();
    };
  }

  angular
    .module('SOGo.MailerUI')
    .controller('SendMessageToastController', SendMessageToastController)
    .controller('MessageEditorController', MessageEditorController);

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {

  /**
   * sgAccountSection - A directive that is only a controller to manage the selection of the mailboxes.
   * @memberof SOGo.MailerUI
  */
  function sgAccountSection() {
    return {
      restrict: 'C',
      scope: {},
      controller: 'sgAccountController'
    };
  }

  /**
   * @ngInject
   */
  sgAccountController.$inject = ['$element', '$transitions', '$state', '$mdMedia', '$mdSidenav', 'sgConstant', 'Mailbox', 'encodeUriFilter'];
  function sgAccountController($element, $transitions, $state, $mdMedia, $mdSidenav, sgConstant, Mailbox, encodeUriFilter) {
    var $ctrl = this, mailboxes = [];


    this.$postLink = function () {
      this.quotaElement = _.find($element.find('div'), function(div) {
        return div.classList.contains('sg-quota');
      });
    };


    // Register a sgMailboxListItem controller
    this.addMailboxController = function (mailboxController) {
      mailboxes.push(mailboxController);
    };


    // Called from a sgMailboxListItem controller
    this.selectFolder = function (mailboxController) {
      Mailbox.selectedFolderController = mailboxController;
      if (Mailbox.selectedFolder !== null) {
        var selectedMailboxCtrl = _.find(mailboxes, function(ctrl) {
          return ctrl.mailbox.id == Mailbox.selectedFolder.id;
        });
        if (selectedMailboxCtrl)
          selectedMailboxCtrl.unselectFolder();
      }
      // Close sidenav on small devices
      if (!$mdMedia(sgConstant['gt-md']))
        $mdSidenav('left').close();
    };

  }

  angular
    .module('SOGo.MailerUI')
    .controller('sgAccountController', sgAccountController)
    .directive('sgAccountSection', sgAccountSection);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /**
   * sgIMIP - A directive to handle IMIP actions on emails
   * @memberof SOGo.MailerUI
   * @example:

   */
  function sgImip() {
    return {
      restrict: 'A',
      link: link,
      controller: 'sgImipController'
    };

    function link(scope, iElement, attrs, ctrl) {
      ctrl.pathToAttachment = attrs.sgImipPath;
    }
  }

  /**
   * @ngInject
   */
  sgImipController.$inject = ['$scope', 'User'];
  function sgImipController($scope, User) {
    var vm = this;

    $scope.delegateInvitation = false;
    $scope.delegatedTo = '';
    $scope.searchText = '';

    $scope.userFilter = function($query) {
      return User.$filter($query);
    };

    $scope.iCalendarAction = function(action) {
      var data;

      if (action == 'delegate') {
        data = {
          receiveUpdates: false,
          delegatedTo: $scope.delegatedTo.c_email
        };
      }

      $scope.viewer.message.$imipAction(vm.pathToAttachment, action, data);
    };
  }

  angular
    .module('SOGo.MailerUI')
    .controller('sgImipController', sgImipController)
    .directive('sgImip', sgImip);
})();

/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {

  /**
   * sgMailboxListItem - A directive that defines the content of a md-list-item for a mailbox.
   * @memberof SOGo.MailerUI
  */
  function sgMailboxListItem() {
    return {
      restrict: 'C',
      require: {
        accountController: '^^sgAccountSection'
      },
      scope: {},
      bindToController: {
        mailbox: '=sgMailbox'
      },
      template: [
        '  <div class="sg-child-level-0"',
        '       ng-class="$ctrl.childLevel()">',
        '    <md-checkbox class="sg-folder"',
        '                 ng-class="$ctrl.mailbox.$icon"',
        '                 aria-label="' + l("Expanded") + '"',
        '                 ng-model="$ctrl.mailbox.$expanded"',
        '                 ng-disabled="$ctrl.mailbox.children.length == 0"',
        '                 ng-change="$ctrl.mailbox.$account.$flattenMailboxes({ reload: true, saveState: true })">',
        '    </md-checkbox>',
        '  </div>',
        '  <p class="sg-item-name"',
        '    ng-click="$ctrl.selectFolder($event)"',
        '    ng-dblclick="$ctrl.editFolder($event)">',
        '    <md-icon ng-class="{ \'sg-opacity-70\': $ctrl.mailbox.isNoSelect() }">{{$ctrl.mailbox.$icon}}</md-icon>',
        '    <span ng-class="{ \'sg-font-medium\': $ctrl.displayUnseenCount() }" ng-bind="$ctrl.mailbox.$displayName"></span>',
        '    <span class="sg-counter-badge ng-hide"',
        '          ng-show="$ctrl.displayUnseenCount()"',
        '          ng-bind="$ctrl.displayUnseenCount()"></span>',
        '  </p>',
        '  <md-input-container class="md-flex ng-hide">',
        '    <input class="sg-item-name" type="text"',
        '           aria-label="' + l("Enter the new name of your folder") + '"',
        '           ng-blur="$ctrl.saveFolder($event)"',
        '           sg-enter="$ctrl.saveFolder($event)"',
        '           sg-escape="$ctrl.revertEditing()" />',
        '  </md-input-container>',
        '  <md-icon class="md-menu md-secondary-container" ng-click="$ctrl.showMenu($event)" aria-label="' + l("Options") + '">more_vert</md-icon>'
      ].join(''),
      controller: 'sgMailboxListItemController',
      controllerAs: '$ctrl'
    };
  }

  /**
   * @ngInject
   */
  sgMailboxListItemController.$inject = ['$scope', '$rootScope', '$element', '$state', '$timeout', '$mdToast', '$mdPanel', '$mdMedia', '$mdSidenav', 'sgConstant', 'Dialog', 'Mailbox', 'encodeUriFilter', '$window', 'Account'];
  function sgMailboxListItemController($scope, $rootScope, $element, $state, $timeout, $mdToast, $mdPanel, $mdMedia, $mdSidenav, sgConstant, Dialog, Mailbox, encodeUriFilter, $window, Account) {
    var $ctrl = this;


    this.$onInit = function() {
      this.$element = $element;
      this.editMode = false;
      this.accountController.addMailboxController(this);

      // Listen for unseen count changes in subfolders to update inbox counter
      var unsubscribe = $rootScope.$on('mailbox:unseenCountChanged', function(_, changedMailbox) {
        // If this is inbox and a subfolder's count changed, force digest to recalculate displayUnseenCount
        if ($ctrl.mailbox.type === 'inbox' && changedMailbox !== $ctrl.mailbox) {
          // Trigger digest cycle safely to update the counter display
          $timeout(function() {
            // Empty function - just triggers digest
          }, 0);
        }
      });

      // Clean up listener when directive is destroyed
      $scope.$on('$destroy', function() {
        unsubscribe();
      });
    };


    this.$postLink = function() {
      this.selectableElement = $element.find('div')[0];
      this.clickableElement = $element.find('p')[0];
      this.inputContainer = $element.find('md-input-container')[0];
      this.inputElement = $element.find('input')[0];
      this.moreOptionsButton = _.last($element.find('md-icon'));

      // Check if router's state has selected a mailbox
      if (Mailbox.selectedFolder !== null && Mailbox.selectedFolder.id == this.mailbox.id) {
        this.accountController.selectFolder(this);
      }
    };

    this.childLevel = function() {
      return 'sg-child-level-' + this.mailbox.level;
    };


    this.displayUnseenCount = function() {
      if (angular.isFunction($ctrl.mailbox.$displayUnseenCount))
        return $ctrl.mailbox.$displayUnseenCount();
      return $ctrl.mailbox.unseenCount;
    };


    this.selectFolder = function($event) {
      var _this = this;

      if (this.editMode || this.mailbox == Mailbox.selectedFolder || this.mailbox.isNoSelect())
        return;

      this.mailbox.setHighlightWords([]);

      // Step 1: First, refresh ALL counters from server to get actual values
      if (Account && Account.$$resource) {
        // Collect all mailbox IDs
        var allMailboxIds = [];
        var collectMailboxIds = function(mailboxes) {
          _.forEach(mailboxes, function(mailbox) {
            allMailboxIds.push(mailbox.id);
            if (mailbox.children && mailbox.children.length > 0) {
              collectMailboxIds(mailbox.children);
            }
          });
        };
        collectMailboxIds(_this.mailbox.$account.$mailboxes);

        // Fetch fresh counters for ALL mailboxes
        Account.$$resource.post('', 'unseenCount', {mailboxes: allMailboxIds}).then(function(data) {
          // Step 2: Update counters EXCEPT for currently selected folder (to prevent flicker)
          var currentFolderId = Mailbox.selectedFolder ? Mailbox.selectedFolder.id : null;
          var updateMailboxCounts = function(mailboxes) {
            _.forEach(mailboxes, function(mailbox) {
              // Skip updating current folder to avoid flicker
              if (mailbox.id === currentFolderId) {
                return;
              }
              if (angular.isDefined(data[mailbox.id])) {
                mailbox.unseenCount = data[mailbox.id];
              }
              if (mailbox.children && mailbox.children.length > 0) {
                updateMailboxCounts(mailbox.children);
              }
            });
          };
          updateMailboxCounts(_this.mailbox.$account.$mailboxes);

          // Step 3: Broadcast to update parent folder displays (like inbox)
          $rootScope.$broadcast('mailbox:unseenCountChanged', _this.mailbox);

          // Step 4: Handle virtual mode reset if needed
          if (Mailbox.selectedFolder && Mailbox.$virtualMode) {
            Mailbox.$virtualMode = false;
            Mailbox.$virtualPath = false;
            $rootScope.$broadcast('resetMailAdvancedSearchPanel');
          }

          // DO NOT call $reset() to avoid triggering re-render of current folder
          // Just proceed with folder selection directly
          _this.accountController.selectFolder(_this);
          if ($event) {
            $state.go('mail.account.mailbox', {
              accountId: _this.mailbox.$account.id,
              mailboxId: encodeUriFilter(encodeUriFilter(_this.mailbox.path))
            });
            $event.stopPropagation();
            $event.preventDefault();
          }
        });
      } else {
        // Fallback without Account resource
        if (Mailbox.selectedFolder) {
          if (Mailbox.$virtualMode) {
            Mailbox.$virtualMode = false;
            Mailbox.$virtualPath = false;
            $rootScope.$broadcast('resetMailAdvancedSearchPanel');
            if (Mailbox.selectedFolder.$mailboxes && Mailbox.selectedFolder.$mailboxes.length > 0) {
              Mailbox.selectedFolder.$reset({ filter: true, unseenCount: Mailbox.selectedFolder.$mailboxes[0].unseenCount });
            }
          } else {
            Mailbox.selectedFolder.$reset({ filter: true, unseenCount: Mailbox.selectedFolder.unseenCount });
          }
        }
        this.accountController.selectFolder(this);
        if ($event) {
          $state.go('mail.account.mailbox', {
            accountId: this.mailbox.$account.id,
            mailboxId: encodeUriFilter(encodeUriFilter(this.mailbox.path))
          });
          $event.stopPropagation();
          $event.preventDefault();
        }
      }
    };


    this.unselectFolder = function() {
      $element[0].classList.remove('md-bg');
    };


    this.editFolder = function($event) {
      $event.stopPropagation();
      $event.preventDefault();
      if (this.mailbox.$isEditable) {
        this.editMode = true;
        this.inputElement.value = this.mailbox.name;
        this.clickableElement.classList.add('ng-hide');
        this.inputContainer.classList.remove('ng-hide');
        if ($event.srcEvent && $event.srcEvent.type == 'touchend') {
          $timeout(function() {
            $ctrl.inputElement.select();
            $ctrl.inputElement.focus();
          }, 200); // delayed focus for iOS
        }
        else {
          this.inputElement.select();
          this.inputElement.focus();
        }
      }
      if (this.panel) {
        this.panel.close();
      }
    };


    this.saveFolder = function($event) {
      if (this.inputElement.disabled)
        return;

      this.mailbox.name = this.inputElement.value;
      this.inputElement.disabled = true;
      this.mailbox.$rename()
        .then(function(data) {
          $ctrl.editMode = false;
          $ctrl.inputContainer.classList.add('ng-hide');
          $ctrl.clickableElement.classList.remove('ng-hide');
        })
        .finally(function() {
          $ctrl.inputElement.disabled = false;
        });
    };


    this.revertEditing = function() {
      this.editMode = false;
      this.clickableElement.classList.remove('ng-hide');
      this.inputContainer.classList.add('ng-hide');
      this.inputElement.value = this.mailbox.name;
    };


    this.confirmDelete = function() {
      Dialog.confirm(l('Warning'),
                     l('Do you really want to move this folder into the trash ?'),
                     { ok: l('Delete') })
        .then(function() {
          $ctrl.mailbox.$delete()
            .then(function() {
              $state.go('mail.account.inbox');
            }, function(response) {
              Dialog.confirm(l('Warning'),
                             l('The mailbox could not be moved to the trash folder. Would you like to delete it immediately?'),
                             { ok: l('Delete') })
                .then(function() {
                  $ctrl.mailbox.$delete({ withoutTrash: true })
                    .then(function() {
                      $state.go('mail.account.inbox');
                    }, function(response) {
                      Dialog.alert(l('An error occured while deleting the mailbox "%{0}".', $ctrl.mailbox.name),
                                   l(response.error));
                    });
                });
            });
        });
    };


    this.showMenu = function($event) {
      var panelPosition = $mdPanel.newPanelPosition()
          .relativeTo(this.moreOptionsButton)
          .addPanelPosition(
            $mdPanel.xPosition.ALIGN_START,
            $mdPanel.yPosition.ALIGN_TOPS
          );

      var panelAnimation = $mdPanel.newPanelAnimation()
          .openFrom(this.moreOptionsButton)
          .duration(100)
          .withAnimation($mdPanel.animation.FADE);

      var config = {
        attachTo: angular.element(document.body),
        locals: {
          itemCtrl: this,
          folder: this.mailbox,
          editFolder: angular.bind(this, this.editFolder),
          confirmDelete: angular.bind(this, this.confirmDelete)
        },
        bindToController: true,
        controller: MenuController,
        controllerAs: '$menuCtrl',
        position: panelPosition,
        animation: panelAnimation,
        targetEvent: $event,
        templateUrl: 'UIxMailFolderMenu',
        trapFocus: true,
        clickOutsideToClose: true,
        escapeToClose: true,
        focusOnOpen: true
      };

      $mdPanel.open(config)
        .then(function(panelRef) {
          $ctrl.panel = panelRef;
          // Automatically close panel when clicking inside of it
          panelRef.panelEl.one('click', function() {
            panelRef.close();
          });
        });

      MenuController.$inject = ['mdPanelRef', '$state', '$mdDialog', 'User'];
      function MenuController(mdPanelRef, $state, $mdDialog, User) {
        var $menuCtrl = this;

        this.markFolderRead = function() {
          this.folder.$markAsRead();
        };

        this.newFolder = function() {
          Dialog.prompt(l('New Folder...'),
                        l('Enter the new name of your folder'))
            .then(function(name) {
              $menuCtrl.folder.$newMailbox($menuCtrl.folder.id, name)
                .then(function() {
                  // success
                }, function(data, status) {
                  Dialog.alert(l('An error occured while creating the mailbox "%{0}".', name),
                               l(data.error));
                });
            });
        };

        this.compactFolder = function() {
          this.folder.$compact().then(function() {
            $mdToast.show(
              $mdToast.simple()
                .textContent(l('Folder compacted'))
                .position(sgConstant.toastPosition)
                .hideDelay(3000));
          });
        };

        this.cleanMailbox = function () {
          // Close sidenav on small devices
          if (!$mdMedia(sgConstant['gt-md']))
            $mdSidenav('left').close();

          $rootScope.$broadcast('showCleanMailboxPanel', {folder: this.folder, account: null}); // Show remove old emails panel (broadcast event to MailboxesController)
        };

        this.emptyJunkFolder = function() {
          return this.emptyFolder(l('Junk folder emptied'));
        };

        this.emptyTrashFolder = function() {
          return this.emptyFolder(l('Trash emptied'));
        };

        this.emptyFolder = function(successMsg) {
          this.folder.$empty().then(function() {
            $mdToast.show(
              $mdToast.simple()
                .textContent(successMsg)
                .position(sgConstant.toastPosition)
                .hideDelay(3000));
          });
        };

        this.showAdvancedSearch = function() {
          Mailbox.$virtualPath = this.folder.path;
          // Close sidenav on small devices
          if (!$mdMedia(sgConstant['gt-md']))
            $mdSidenav('left').close();

          $rootScope.$broadcast('showMailAdvancedSearchPanel'); // Show advanced search panel (broadcast event to MailboxesController)
        };

        this.share = function() {
          var encodeURL = angular.bind(this.folder.constructor.$$resource,
                                       this.folder.constructor.$$resource.encodeURL);
          // Fetch list of ACL users
          this.folder.$acl.$users().then(function() {
            // Show ACL editor
            $mdDialog.show({
              templateUrl: encodeURL($menuCtrl.folder.id).join('/') + '/UIxAclEditor', // UI/Templates/UIxAclEditor.wox
              controller: 'AclController', // from the ng module SOGo.Common
              controllerAs: 'acl',
              clickOutsideToClose: true,
              escapeToClose: true,
              locals: {
                usersWithACL: $menuCtrl.folder.$acl.users,
                User: User,
                folder: $menuCtrl.folder
              }
            });
          });
        };

        this.setFolderAs = function(type) {
          this.folder.$setFolderAs(type).then(function() {
            $menuCtrl.folder.$account.$getMailboxes({reload: true});
          });
        };

        this.isParentOf = function(path) {
          var findChildren;

          // Local recursive function
          findChildren = function(parent) {
            if (parent.children && parent.children.length > 0) {
              for (var i = 0, found = false; !found && i < parent.children.length; i++) {
                var o = parent.children[i];
                if (o.children && o.children.length > 0) {
                  if (findChildren(o)) {
                    return true;
                  }
                }
                else if (o.path == path) {
                  return true;
                }
              }
            }
            else {
              return (parent.path == path);
            }
          };

          return findChildren(this.folder);
        };

        this.moveFolder = function(path) {
          this.folder.$move(path);
          mdPanelRef.close();
        };

      } // MenuController


    };
  }


  angular
    .module('SOGo.MailerUI')
    .controller('sgMailboxListItemController', sgMailboxListItemController)
    .directive('sgMailboxListItem', sgMailboxListItem);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {

  /**
   * sgMessageListItem - A directive that watches some attributes of a message. Any component inside the
   * list item should depends on this directive and extend the 'onUpdate' method instead of creating new
   * independent watchers.
   * @memberof SOGo.MailerUI
  */
  function sgMessageListItem() {
    return {
      restrict: 'C',
      scope: {},
      bindToController: {
        message: '=sgMessage'
      },
      controller: 'sgMessageListItemController'
    };
  }

  /**
   * @ngInject
   */
  sgMessageListItemController.$inject = ['$scope', '$element', '$timeout', 'Mailbox'];
  function sgMessageListItemController($scope, $element, $timeout, Mailbox) {
    var $ctrl = this;
    var scrollPosition = 0;

    this.$onInit = function () {
      var watchedAttrs = ['uid', 'isread', 'isflagged', 'flags', 'loading'];

      // this.service = Message;
      this.MailboxService = Mailbox;

      if (Mailbox.selectedFolder.type == 'draft' || Mailbox.selectedFolder.type == 'templates')
        watchedAttrs.push('subject');

      $scope.$watch(
        function() {
          return $ctrl.message? [ _.pick($ctrl.message, watchedAttrs) ] : null;
        },
        function(newId, oldId) {
          if ($ctrl.message) {
            // Message has changed
            $ctrl.onUpdate();
          }
        },
        true // compare for object equality
      );
    };


    this.onUpdate = function () {
      if (this.message.loading) {
        $element.addClass('sg-skeleton');
        return;
      }
      $element.removeClass('sg-skeleton');
      // Is the message unread?
      if (this.message.isread)
        $element.removeClass('unread');
      else
        $element.addClass('unread');
      // Is the message selected?
      if (Mailbox.selectedFolder.isSelectedMessage(this.message.uid, this.message.$mailbox.path))
        $element.addClass('md-default-theme md-accent md-bg md-hue-2');
      else
        $element.removeClass('md-default-theme md-accent md-bg md-hue-2');
    };


    this.setVisibility = function (element, visible) {
      if (visible)
        element.classList.remove('ng-hide');
      else
        element.classList.add('ng-hide');
    };

    // The following functions are used to store and restore the scroll position of the message list
    // Position is stored and restored through the Mailbox service using broadcasting
    function storeScrollPosition() {
      if ($element.parent()[0] && $element.parent()[0].parentElement && $element.parent()[0].parentElement.parentElement)
        scrollPosition = $element.parent()[0].parentElement.parentElement.scrollTop;
    }

    function restoreScrollPosition() {
      $timeout(function () {
        if ($element.parent()[0] && $element.parent()[0].parentElement && $element.parent()[0].parentElement.parentElement)
          $element.parent()[0].parentElement.parentElement.scrollTop = scrollPosition;
      }, 0);
    }

    $scope.$on('listRefreshed', function () {
      restoreScrollPosition();
    });

    $scope.$on('beforeListRefresh', function () {
      storeScrollPosition();
    });

  }


  angular
    .module('SOGo.MailerUI')
    .controller('sgMessageListItemController', sgMessageListItemController)
    .directive('sgMessageListItem', sgMessageListItem);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {

  /**
   * sgMessageListItemMain - The main section of a list item for a message. It relies on the
   * 'onUpdate' method of the parent sgMessageListItem controller to update its content.
   * @memberof SOGo.MailerUI
   * @example:
  */
  function sgMessageListItemMain() {
    return {
      restrict: 'C',
      require: '^^sgMessageListItem',
      scope: {},
      template: [
        '<div class="sg-tile-content">',
        '  <div class="sg-md-subhead">',
        '    <div>',
        '      <span class="sg-label-outline ng-hide"><!-- mailbox --></span>',
        '      <md-icon class="ng-hide">error</md-icon>', // the priority icon
        '      <span><!-- sender or recipient --></span>',
        '    </div>',
        '    <div class="sg-tile-date"><!-- date --></div>',
        '  </div>',
        '  <div class="sg-md-body">',
        '    <div class="sg-category-dot-container"><!-- categories --></div>',
        '    <div class="sg-tile-subject"><!-- subject --></div>',
        '    <div class="sg-tile-size"><!-- size --></div>',
        '    <md-button class="sg-tile-btn md-secondary ng-hide" md-colors="::{ color: \'accent-600\'}" ng-click="$ctrl.toggleThread()">',
        '      <md-icon class="md-rotate-180-ccw" md-colors="::{ color: \'accent-600\'}">expand_more</md-icon><span></span>', // expanded by default (icon is rotated)
        '    </md-button>',
        '  </div>',
        '</div>',
        '<div class="sg-tile-icons">',
        '  <md-icon class="ng-hide sg-icon-star">star</md-icon>',
        '  <md-icon class="ng-hide">reply</md-icon>',
        '  <md-icon class="ng-hide">forward</md-icon>',
        '  <md-icon class="ng-hide">attach_file</md-icon>',
        '</div>',
        '<div class="sg-progress-linear-bottom">',
        '  <md-progress-linear class="md-accent"',
        '                      md-mode="indeterminate"',
        '                      ng-disabled="!$ctrl.message.$isLoading()"><!-- message loading progress --></md-progress-linear>',
        '</div>'
      ].join(''),
      link: postLink,
      controller: 'sgMessageListItemMainController',
      controllerAs: '$ctrl'
    };

    function postLink(scope, element, attrs, parentController) {
      scope.parentController = parentController;
    }

  }

  /**
   * @ngInject
   */
  sgMessageListItemMainController.$inject = ['$scope', '$element', '$parse', '$state', '$mdUtil', '$mdToast', 'Mailbox', 'Message', 'encodeUriFilter', 'Preferences'];
  function sgMessageListItemMainController($scope, $element, $parse, $state, $mdUtil, $mdToast, Mailbox, Message, encodeUriFilter, Preferences) {
    var $ctrl = this;

    this.$postLink = function () {
      var contentDivElement, threadButton, iconsDivElement;
      var parentControllerOnUpdate, setVisibility;

      this.parentController = $scope.parentController;

      parentControllerOnUpdate = this.parentController.onUpdate;
      setVisibility = this.parentController.setVisibility;

      _.forEach($element.find('div'), function(div) {
        if (div.classList.contains('sg-tile-content'))
          contentDivElement = angular.element(div);
        else if (div.classList.contains('sg-tile-icons'))
          iconsDivElement = angular.element(div);
      });

      threadButton = contentDivElement.find('button')[0];
      this.threadButton = threadButton;
      threadButton = angular.element(threadButton);
      this.threadIconElement = threadButton.find('md-icon')[0];
      this.threadCountElement = threadButton.find('span')[0];
      this.priorityIconElement = contentDivElement.find('md-icon')[0];

      if (Mailbox.$virtualMode) {
        // Show mailbox name in front of the subject
        this.mailboxNameElement = contentDivElement.find('span')[0];
        this.mailboxNameElement.classList.remove('ng-hide');
      }

      this.senderElement = contentDivElement.find('span')[1];

      _.forEach(contentDivElement.find('div'), function(div) {
        if (div.classList.contains('sg-tile-subject'))
          $ctrl.subjectElement = div;
        else if (div.classList.contains('sg-tile-size'))
          $ctrl.sizeElement = div;
        else if (div.classList.contains('sg-tile-date'))
          $ctrl.dateElement = div;
      });

      _.forEach(iconsDivElement.find('md-icon'), function(div) {
        if (div.textContent == 'star')
          $ctrl.flagIconElement = div;
        else if (div.textContent == 'reply')
          $ctrl.answerIconElement = div;
        else if (div.textContent == 'forward')
          $ctrl.forwardIconElement = div;
        else if (div.textContent == 'attach_file')
          $ctrl.attachmentIconElement = div;
      });

      /**
       * Update the template when the parent controller has detected a change.
       */
      this.parentController.onUpdate = function () {
        var i;
        $ctrl.message = $ctrl.parentController.message;

        if (!$ctrl.message.loading) {
          // Flags
          var flagList = $element[0].querySelector('.sg-category-dot-container'),
              $flagList = angular.element(flagList),
              flagElements = $mdUtil.nodesToArray(flagList.querySelectorAll('.sg-category-dot'));
          _.forEach(flagElements, function(flagElement) {
            flagList.removeChild(flagElement);
          });
          for (i = 0; i < $ctrl.message.flags.length && i < 5; i++) {
            var tag = $ctrl.message.flags[i];
            if ($ctrl.service.$tags[tag]) {
              var flagElement = angular.element('<div class="sg-category-dot"></div>');
              flagElement.css('background-color', $ctrl.service.$tags[tag][1]);
              $flagList.append(flagElement);
            }
          }

          // Mailbox name when in virtual mode
          if ($ctrl.mailboxNameElement)
            $ctrl.mailboxNameElement.innerHTML = $ctrl.message.$mailbox.$displayName;

          // Subject and sender or recipient when in Sent or Draft mailbox
          $ctrl.defineSubjectAndSenderElements();

          // Priority icon
          if ($ctrl.message.priority && $ctrl.message.priority.level < 3) {
            $ctrl.priorityIconElement.classList.remove('ng-hide');
            if ($ctrl.message.priority.level < 2)
              $ctrl.priorityIconElement.classList.add('md-warn');
            else
              $ctrl.priorityIconElement.classList.remove('md-warn');
          }
          else
            $ctrl.priorityIconElement.classList.add('ng-hide');

          // Mail thread
          if ($ctrl.message.first) {
            $ctrl.threadButton.classList.remove('ng-hide');
            $ctrl.threadCountElement.innerHTML = $ctrl.message.threadCount;
            if ($ctrl.message.collapsed)
              $ctrl.threadIconElement.classList.remove('md-rotate-180-ccw');
          }
          else {
            $ctrl.threadButton.classList.add('ng-hide');
          }

          // Message size
          $ctrl.sizeElement.innerHTML = $ctrl.message.size;

          // Received Date
          $ctrl.dateElement.innerHTML = $ctrl.message.relativedate;

          setVisibility($ctrl.flagIconElement,
                        $ctrl.message.isflagged);
          setVisibility($ctrl.answerIconElement,
                        $ctrl.message.isanswered);
          setVisibility($ctrl.forwardIconElement,
                        $ctrl.message.isforwarded);
          setVisibility($ctrl.attachmentIconElement,
                        $ctrl.message.hasattachment);
        }

        // Call original method on parent controller
        angular.bind($ctrl.parentController, parentControllerOnUpdate)();
      };

      this.service = Message;
      this.MailboxService = Mailbox;
    };

    this.defineSubjectAndSenderElements = function() {
      if ($ctrl && $ctrl.message && !$ctrl.message.loading) {
        // Subject
        $ctrl.subjectElement.innerHTML = $ctrl.message.getHighlightSubject();

        // Sender or recipient when in Sent or Draft mailbox
        if ($ctrl.MailboxService.selectedFolder.isSentFolder || $ctrl.MailboxService.selectedFolder.isDraftsFolder)
          $ctrl.senderElement.innerHTML = $ctrl.message.highlightSearchTerms($ctrl.message.$shortAddress('to', Preferences.defaults.SOGoMailDisplayFullEmail), true);
        else
          $ctrl.senderElement.innerHTML = $ctrl.message.highlightSearchTerms($ctrl.message.$shortAddress('from', Preferences.defaults.SOGoMailDisplayFullEmail), true);
      }
    };

    this.$doCheck = function () {
      $ctrl.defineSubjectAndSenderElements();
    };

    this.toggleThread = function() {
      if (this.message.collapsed)
        this.threadIconElement.classList.add('md-rotate-180-ccw');
      else
        this.threadIconElement.classList.remove('md-rotate-180-ccw');
      this.message.toggleThread();
    };

  }


  angular
    .module('SOGo.MailerUI')
    .controller('sgMessageListItemMainController', sgMessageListItemMainController)
    .directive('sgMessageListItemMain', sgMessageListItemMain);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /*
   * sgZoomableImage - Show the image fullscreen when clicking on the image inside the container.
   * @memberof SOGo.MailerUI
   * @restrict attribute
   * @ngInject
   * @example:

   <div sg-zoomable-image="$index">
     <md-card>
       <img src="foo.png">
     </md-card>
   </div>
  */
  function sgZoomableImage() {
    return {
      restrict: 'A',
      bindToController: {
        partIndex: '=sgZoomableImage'
      },
      controller: sgZoomableImageController
    };

    function link(scope, iElement, attrs, ctrl) {
      var parentNode = iElement.parent(),
          imgElement, showImage, toggleClass;

      imgElement = iElement.find('img');

      toggleClass = function(event) {
        if (event.target.tagName == 'IMG')
          parentNode.toggleClass('sg-zoom');
      };

      showImage = function(event) {
        if (event.target.tagName == 'IMG')
          ctrl.showGallery(event, imgElement[0].src);
      };

      if (imgElement.length)
        ctrl.addImage(imgElement[0].src);

      iElement.on('click', showImage);
    }
  }

  /**
   * @ngInject
   */
  sgZoomableImageController.$inject = ['$element', 'ImageGallery'];
  function sgZoomableImageController($element, ImageGallery) {
    var $ctrl = this;

    this.$postLink = function() {
      ImageGallery.registerImage($element);
      $element.on('click', this.showImage);
    };

    this.showImage = function($event) {
      if ($event.target.tagName == 'IMG')
        ImageGallery.showGallery($event, $ctrl.partIndex);
    };
  }

  angular
    .module('SOGo.MailerUI')
    .directive('sgZoomableImage', sgZoomableImage);
})();
