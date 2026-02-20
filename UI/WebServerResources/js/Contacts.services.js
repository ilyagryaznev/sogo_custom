/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @name AddressBook
   * @constructor
   * @param {object} futureAddressBookData - either an object literal or a promise
   */
  function AddressBook(futureAddressBookData) {
    // Data is immediately available
    if (typeof futureAddressBookData.then !== 'function') {
      this.init(futureAddressBookData);
      if (this.name && !this.id) {
        // Create a new addressbook on the server
        var newAddressBookData = AddressBook.$$resource.create('createFolder', this.name);
        this.$unwrap(newAddressBookData);
        this.acls = {'objectEditor': 1, 'objectCreator': 1, 'objectEraser': 1};
      }
      else if (this.id) {
        this.$acl = new AddressBook.$$Acl('Contacts/' + this.id);
      }
    }
    else {
      // The promise will be unwrapped first
      this.$unwrap(futureAddressBookData);
    }
  }

  /**
   * @memberof AddressBook
   * @desc The factory we'll use to register with Angular
   * @returns the AddressBook constructor
   */
  AddressBook.$factory = ['$q', '$timeout', '$log', 'sgSettings', 'sgAddressBook_PRELOAD', 'Resource', 'Card', 'Acl', 'Preferences', function($q, $timeout, $log, Settings, AddressBook_PRELOAD, Resource, Card, Acl, Preferences) {
    angular.extend(AddressBook, {
      $q: $q,
      $timeout: $timeout,
      $log: $log,
      PRELOAD: AddressBook_PRELOAD,
      $$resource: new Resource(Settings.activeUser('folderURL') + 'Contacts', Settings.activeUser()),
      $Card: Card,
      $$Acl: Acl,
      $Preferences: Preferences,
      $query: {value: '', sort: 'c_cn', asc: 1},
      activeUser: Settings.activeUser(),
      $addressbooks: [],
      $subscriptions: [],
      $remotes: [],
      selectedFolder: null,
      $refreshTimeout: null
    });
    // Initialize sort parameters from user's settings
    if (Preferences.settings.Contact.SortingState) {
      AddressBook.$query.sort = Preferences.settings.Contact.SortingState[0];
      AddressBook.$query.asc = parseInt(Preferences.settings.Contact.SortingState[1]);
    }

    return AddressBook; // return constructor
  }];

  /**
   * @module SOGo.ContactsUI
   * @desc Factory registration of AddressBook in Angular module.
   */
  try {
    angular.module('SOGo.ContactsUI');
  }
  catch(e) {
    angular.module('SOGo.ContactsUI', ['SOGo.Common', 'SOGo.PreferencesUI']);
  }
  angular.module('SOGo.ContactsUI')
    .constant('sgAddressBook_PRELOAD', {
      LOOKAHEAD: 50,
      SIZE: 100
    })
    .factory('AddressBook', AddressBook.$factory);

  /**
   * @memberof AddressBook
   * @desc Search for cards among all addressbooks matching some criterias.
   * @param {string} search - the search string to match
   * @param {object} [options] - additional options to the query (excludeGroups and excludeLists)
   * @param {object[]} excludedCards - a list of Card objects that must be excluded from the results
   * @returns a collection of Cards instances
   */
  AddressBook.$filterAll = function(search, cards, options, excludedCards) {
    var params = { search: search };

    if (!search) {
      // No query specified
      cards = [];
      return AddressBook.$q.when(cards);
    }
    if (angular.isUndefined(cards)) {
      // First session query
      cards = [];
    }

    angular.extend(params, options);

    return AddressBook.$$resource.fetch(null, 'allContactSearch', params).then(function(response) {
      var results, card, index,
          compareIds = function(data) {
            if(this.sourceID === undefined || data.sourceid === undefined) {
              return this.id == data.id;
            }
            else {
              return this.id == data.id && this.sourceID == data.sourceid;
            }
          };
      if (excludedCards) {
        // Remove excluded cards from results
        results = _.filter(response.contacts, function(data) {
          return _.isUndefined(_.find(excludedCards, _.bind(compareIds, data)));
        });
      }
      else {
        results = response.contacts;
      }
      // Remove cards that no longer match the search query
      for (index = cards.length - 1; index >= 0; index--) {
        card = cards[index];
        if (_.isUndefined(_.find(results, _.bind(compareIds, card)))) {
          cards.splice(index, 1);
        }
      }
      // Add new cards matching the search query
      _.forEach(results, function(data, index) {
        if (_.isUndefined(_.find(cards, _.bind(compareIds, data)))) {
          var card = new AddressBook.$Card(_.mapKeys(data, function(value, key) {
            return key.toLowerCase();
          }), search);
          cards.splice(index, 0, card);
        }
      });
      // AddressBook.$log.debug(cards);
      return cards;
    });
  };

  /**
   * @memberof AddressBook
   * @desc Add a new addressbook to the static list of addressbooks
   * @param {AddressBook} addressbook - an Addressbook object instance
   */
  AddressBook.$add = function(addressbook) {
    // Insert new addressbook at proper index
    var list, sibling, i;

    list = addressbook.isSubscription? this.$subscriptions : this.$addressbooks;
    sibling = _.find(list, function(o) {
      return (addressbook.id == 'personal' ||
              (o.id != 'personal' &&
               o.name.localeCompare(addressbook.name) === 1));
    });
    i = sibling ? _.indexOf(_.map(list, 'id'), sibling.id) : 1;
    list.splice(i, 0, addressbook);
  };

  /**
   * @memberof AddressBook
   * @desc Set or get the list of addressbooks. Will instantiate a new AddressBook object for each item.
   * @param {array} [data] - the metadata of the addressbooks
   * @returns the list of addressbooks
   */
  AddressBook.$findAll = function(data) {
    var _this = this;
    if (data && data.length) {
      this.$addressbooks.splice(0, this.$addressbooks.length);
      this.$subscriptions.splice(0, this.$subscriptions.length);
      this.$remotes.splice(0, this.$remotes.length);
      // Instanciate AddressBook objects
      angular.forEach(data, function(o, i) {
        var addressbook = new AddressBook(o);
        if (addressbook.isRemote)
          _this.$remotes.push(addressbook);
        else if (addressbook.isSubscription)
          _this.$subscriptions.push(addressbook);
        else
          _this.$addressbooks.push(addressbook);
      });
    }
    else if (angular.isArray(data)) { // empty array
      return AddressBook.$$resource.fetch('addressbooksList').then(function(data) {
        return AddressBook.$findAll(data.addressbooks);
      });
    }

    return _.union(this.$addressbooks, this.$subscriptions, this.$remotes);
  };

  /**
   * @memberOf AddressBook
   * @desc Subscribe to another user's addressbook and add it to the list of addressbooks.
   * @param {string} uid - user id
   * @param {string} path - path of folder for specified user
   * @returns a promise of the HTTP query result
   */
  AddressBook.$subscribe = function(uid, path) {
    var _this = this;
    return AddressBook.$$resource.userResource(uid).fetch(path, 'subscribe').then(function(addressbookData) {
      var addressbook = new AddressBook(addressbookData);
      if (_.isUndefined(_.find(_this.$subscriptions, function(o) {
        return o.id == addressbookData.id;
      }))) {
        // Not already subscribed
        AddressBook.$add(addressbook);
      }
      return addressbook;
    });
  };

  /**
   * @memberof AddressBook
   * @desc Reload the list of known addressbooks.
   */
  AddressBook.$reloadAll = function() {
    var _this = this;

    return AddressBook.$$resource.fetch('addressbooksList').then(function(data) {
      _.forEach(data.addressbooks, function(addressbookData) {
        var group, addressbook;

        if (addressbookData.isRemote)
          group = _this.$remotes;
        else if (addressbookData.owner != AddressBook.activeUser.login)
          group = _this.$subscriptions;
        else
          group = _this.$addressbooks;

        addressbook = _.find(group, function(o) { return o.id == addressbookData.id; });
        if (addressbook)
          addressbook.init(addressbookData);
      });
    });
  };

  /**
   * @function init
   * @memberof AddressBook.prototype
   * @desc Extend instance with new data and compute additional attributes.
   * @param {object} data - attributes of addressbook
   */
  AddressBook.prototype.init = function(data, options) {
    var _this = this;
    if (!this.$$cards) {
      // Array of cards for "dry" searches (see $filter)
      this.$$cards = [];
    }
    this.idsMap = {};
    this.$cards = [];
    // Extend instance with all attributes of data except headers
    angular.forEach(data, function(value, key) {
      if (key != 'headers' && key != 'cards') {
        _this[key] = value;
      }
    });
    // Add 'isOwned' and 'isSubscription' attributes based on active user (TODO: add it server-side?)
    this.isOwned = AddressBook.activeUser.isSuperUser || this.owner == AddressBook.activeUser.login;
    this.isSubscription = !this.isRemote && this.owner != AddressBook.activeUser.login;
  };

  /**
   * @function $id
   * @memberof AddressBook.prototype
   * @desc Resolve the addressbook id.
   * @returns a promise of the addressbook id
   */
  AddressBook.prototype.$id = function() {
    if (this.id) {
      // Object already unwrapped
      return AddressBook.$q.when(this.id);
    }
    else {
      // Wait until object is unwrapped
      return this.$futureAddressBookData.then(function(addressbook) {
        if (addressbook)
          return addressbook.id;
        else
          return AddressBook.$q.reject();
      });
    }
  };

  /**
   * @function getLength
   * @memberof AddressBook.prototype
   * @desc Used by md-virtual-repeat / md-on-demand
   * @returns the number of cards in the addressbook
   */
  AddressBook.prototype.getLength = function() {
    return this.$cards.length;
  };

  /**
   * @function getItemAtIndex
   * @memberof AddressBook.prototype
   * @desc Used by md-virtual-repeat / md-on-demand
   * @returns the card at the specified index
   */
  AddressBook.prototype.getItemAtIndex = function(index) {
    var card;

    if (!this.$isLoading && index >= 0 && index < this.$cards.length) {
      card = this.$cards[index];
      this.$lastVisibleIndex = Math.max(0, index - 3); // Magic number is NUM_EXTRA from virtual-repeater.js

      if (this.$loadCard(card))
        return card;
    }
    return null;
  };

  /**
   * @function $loadCard
   * @memberof AddressBook.prototype
   * @desc Check if the card is loaded and in any case, fetch more cards headers from the server.
   * @returns true if the card metadata are already fetched
   */
  AddressBook.prototype.$loadCard = function(card) {
    var cardId = card.id,
        startIndex = this.idsMap[cardId],
        endIndex,
        index,
        max = this.$cards.length,
        loaded = false,
        ids,
        futureHeadersData;

    if (angular.isUndefined(this.ids) && card.id) {
      loaded = true;
    }
    else if (angular.isDefined(startIndex) && startIndex < this.$cards.length) {
      // Index is valid
      if (card.$loaded != AddressBook.$Card.STATUS.NOT_LOADED) {
        // Card headers are loaded or data is coming
        loaded = true;
      }

      // Preload more headers if possible
      endIndex = Math.min(startIndex + AddressBook.PRELOAD.LOOKAHEAD, max - 1);
      if (this.$cards[endIndex].$loaded != AddressBook.$Card.STATUS.NOT_LOADED) {
        index = Math.max(startIndex - AddressBook.PRELOAD.LOOKAHEAD, 0);
        if (this.$cards[index].$loaded != AddressBook.$Card.STATUS.LOADED) {
          // Previous cards not loaded; preload more headers further up
          endIndex = startIndex;
          startIndex = Math.max(startIndex - AddressBook.PRELOAD.SIZE, 0);
        }
      }
      else
        // Next cards not load; preload more headers further down
        endIndex = Math.min(startIndex + AddressBook.PRELOAD.SIZE, max - 1);

      if (this.$cards[startIndex].$loaded == AddressBook.$Card.STATUS.NOT_LOADED ||
          this.$cards[endIndex].$loaded == AddressBook.$Card.STATUS.NOT_LOADED) {

        for (ids = []; startIndex < endIndex && startIndex < max; startIndex++) {
          if (this.$cards[startIndex].$loaded != AddressBook.$Card.STATUS.NOT_LOADED) {
            // Card at this index is already loaded; increase the end index
            endIndex++;
          }
          else {
            // Card at this index will be loaded
            ids.push(this.$cards[startIndex].id);
            this.$cards[startIndex].$loaded = AddressBook.$Card.STATUS.LOADING;
          }
        }

        AddressBook.$log.debug('Loading Ids ' + ids.join(' ') + ' (' + ids.length + ' cards)');
        if (ids.length > 0) {
          futureHeadersData = AddressBook.$$resource.post(this.id, 'headers', {ids: ids});
          this.$unwrapHeaders(futureHeadersData);
        }
      }
    }
    return loaded;
  };

  /**
   * @function hasSelectedMessage
   * @memberof AddressBook.prototype
   * @desc Check if a card is selected.
   * @returns true if the a card is selected
   */
  AddressBook.prototype.hasSelectedCard = function() {
    return angular.isDefined(this.selectedCard);
  };

  /**
   * @function isSelectedCard
   * @memberof AddressBook.prototype
   * @desc Check if the specified card is selected.
   * @param {string} CardId
   * @returns true if the specified card is selected
   */
  AddressBook.prototype.isSelectedCard = function(cardId) {
    return this.hasSelectedCard() && this.selectedCard == cardId;
  };

  /**
   * @function $selectedCard
   * @memberof AddressBook.prototype
   * @desc Return the currently visible card.
   * @returns a Card instance or undefined if no card is displayed
   */
  AddressBook.prototype.$selectedCard = function() {
    var _this = this;

    return _.find(this.$cards, function(card) { return card.id == _this.selectedCard; });
  };

  /**
   * @function $selectedCardIndex
   * @memberof AddressBook.prototype
   * @desc Return the index of the currently visible card.
   * @returns a number or undefined if no card is selected
   */
  AddressBook.prototype.$selectedCardIndex = function() {
    return _.indexOf(_.map(this.$cards, 'id'), this.selectedCard);
  };

  /**
   * @function $selectedCards
   * @memberof AddressBook.prototype
   * @desc Return the cards selected by the user.
   * @returns Card instances
   */
  AddressBook.prototype.$selectedCards = function() {
    return _.filter(this.$cards, function(card) { return card.selected; });
  };

  /**
   * @function $selectedCount
   * @memberof AddressBook.prototype
   * @desc Return the number of cards selected by the user.
   * @returns the number of selected cards
   */
  AddressBook.prototype.$selectedCount = function() {
    var count;

    count = 0;
    if (this.$cards) {
      count = (_.filter(this.$cards, function(card) { return card.selected; })).length;
    }
    return count;
  };

  /**
   * @function $startRefreshTimeout
   * @memberof AddressBook.prototype
   * @desc Starts the refresh timeout for the current selected address book
   */
  AddressBook.prototype.$startRefreshTimeout = function() {
    if (AddressBook.$refreshTimeout)
      AddressBook.$timeout.cancel(AddressBook.$refreshTimeout);

    // Restart the refresh timer, if needed
    var refreshViewCheck = AddressBook.$Preferences.defaults.SOGoRefreshViewCheck;
    if (refreshViewCheck && refreshViewCheck != 'manually') {
      var f = angular.bind(this, AddressBook.prototype.$reload);
      AddressBook.$refreshTimeout = AddressBook.$timeout(f, refreshViewCheck.timeInterval()*1000);
    }
  };

  /**
   * @function $reload
   * @memberof AddressBook.prototype
   * @desc Reload list of cards
   * @returns a promise of the Cards instances
   */
  AddressBook.prototype.$reload = function() {
    var _this = this;

    this.$startRefreshTimeout();
    return this.$filter();
  };

    /**
   * @function $filter
   * @memberof AddressBook.prototype
   * @desc Search for cards matching some criterias
   * @param {string} search - the search string to match
   * @param {object} [options] - additional options to the query (dry, excludeList)
   * @returns a collection of Cards instances
   */
  AddressBook.prototype.$filter = function(search, options, excludedCards) {
    var _this = this, query,
        dry = options && options.dry;

    if (dry) {
      // Don't keep a copy of the query in dry mode
      query = {value: '', sort: 'c_cn', asc: 1};
    }
    else {
      this.$isLoading = true;
      query = AddressBook.$query;
      if (!this.isRemote) query.partial = 1;
    }

    if (options) {
      angular.extend(query, options);
      if (dry) {
        if (!search) {
          // No query specified
          _this.$$cards = [];
          return AddressBook.$q.when(_this.$$cards);
        }
      }
    }

    if (angular.isDefined(search))
      query.value = search;

    return _this.$id().then(function(addressbookId) {
      var futureData = AddressBook.$$resource.post(addressbookId, 'view', query);

      if (dry) {
        return futureData.then(function(response) {
          var results, headers, card, index, fields, idFieldIndex,
              cards = _this.$$cards,
              compareIds = function(card) {
                return this == card.id;
              };

          if (response.headers) {
            // First entry of 'headers' are keys
            fields = _.invokeMap(response.headers[0], 'toLowerCase');
            idFieldIndex = fields.indexOf('id');
            response.headers.splice(0, 1);
            results = _.map(response.headers, function(data) {
              return data[idFieldIndex];
            });
          }

          if (response.ids) {
            if (excludedCards)
              // Remove excluded cards from results
              results = _.filter(response.ids, function(id) {
                return _.isUndefined(_.find(excludedCards, _.bind(compareIds, id)));
              });
            else
              results = response.ids;
          }

          // Remove cards that no longer match the search query
          for (index = cards.length - 1; index >= 0; index--) {
            card = cards[index];
            if (_.isUndefined(_.find(results, _.bind(compareIds, card.id)))) {
              cards.splice(index, 1);
            }
          }

          // Add new cards matching the search query
          _.forEach(results, function(cardId, index) {
            if (_.isUndefined(_.find(cards, _.bind(compareIds, cardId)))) {
              var data = { pid: addressbookId, id: cardId };
              var card = new AddressBook.$Card(data, search);
              cards.splice(index, 0, card);
            }
          });

          // Respect the order of the results
          _.forEach(results, function(cardId, index) {
            var oldIndex, removedCards;
            if (!_.isUndefined(cards[index]) && cards[index].id != cardId) {
              oldIndex = _.findIndex(cards, _.bind(compareIds, cardId));
              removedCards = cards.splice(oldIndex, 1);
              cards.splice(index, 0, removedCards[0]);
            }
          });

          // Extend Card objects with received headers
          _.forEach(response.headers, function(data) {
            var card, index = _.findIndex(cards, _.bind(compareIds, data[idFieldIndex]));
            if (index > -1) {
              card = _.zipObject(fields, data);
              cards[index].init(card, search);
            }
          });

          return cards;
        });
      }
      else {
        // Unwrap promise and instantiate or extend Cards objets
        return _this.$unwrap(futureData);
      }
    });
  };

  /**
   * @function $rename
   * @memberof AddressBook.prototype
   * @desc Rename the addressbook and keep the list sorted
   * @param {string} name - the new name
   * @returns a promise of the HTTP operation
   */
  AddressBook.prototype.$rename = function(name) {
    var _this = this, i, list;

    list = this.isSubscription? AddressBook.$subscriptions : AddressBook.$addressbooks;
    i = _.indexOf(_.map(list, 'id'), this.id);

    return this.$save().then(function() {
      list.splice(i, 1);
      _this.name = name;
      AddressBook.$add(_this);
    });
  };

  /**
   * @function $delete
   * @memberof AddressBook.prototype
   * @desc Delete the addressbook from the server and the static list of addressbooks.
   * @returns a promise of the HTTP operation
   */
  AddressBook.prototype.$delete = function() {
    var _this = this,
        d = AddressBook.$q.defer(),
        list,
        promise;

    if (this.isSubscription) {
      promise = AddressBook.$$resource.fetch(this.id, 'unsubscribe');
      list = AddressBook.$subscriptions;
    }
    else {
      promise = AddressBook.$$resource.remove(this.id);
      list = AddressBook.$addressbooks;
    }

    promise.then(function() {
      var i = _.indexOf(_.map(list, 'id'), _this.id);
      list.splice(i, 1);
      d.resolve();
    }, d.reject);
    return d.promise;
  };

  /**
   * @function $_deleteCards
   * @memberof AddressBook.prototype
   * @desc Delete multiple cards from AddressBook object.
   * @param {string[]} ids - the cards ids
   */
  AddressBook.prototype.$_deleteCards = function(ids) {
    var _this = this;

    // Remove cards from $cards and idsMap
    _.forEachRight(this.$cards, function(card, index) {
      var selectedIndex = _.findIndex(ids, function(id) {
        return card.id == id;
      });
      if (selectedIndex > -1) {
        ids.splice(selectedIndex, 1);
        delete _this.idsMap[card.id];
        if (_this.isSelectedCard(card.id))
          delete _this.selectedCard;
        _this.$cards.splice(index, 1);
      }
      else {
        _this.idsMap[card.id] -= ids.length;
      }
    });
  };

  /**
   * @function $deleteCards
   * @memberof AddressBook.prototype
   * @desc Delete multiple cards from addressbook.
   * @return a promise of the HTTP operation
   */
  AddressBook.prototype.$deleteCards = function(cards) {
    var _this = this,
        ids = _.map(cards, 'id');

    return AddressBook.$$resource.post(this.id, 'batchDelete', {uids: ids}).then(function() {
      _this.$_deleteCards(ids);
    });
  };

  /**
   * @function $copyCards
   * @memberof AddressBook.prototype
   * @desc Copy multiple cards from addressbook to an other one.
   * @return a promise of the HTTP operation
   */
  AddressBook.prototype.$copyCards = function(cards, folder) {
    var uids = _.map(cards, 'id');
    return AddressBook.$$resource.post(this.id, 'copy', {uids: uids, folder: folder});
  };

  /**
   * @function $moveCards
   * @memberof AddressBook.prototype
   * @desc Move multiple cards from the current addressbook to a target one
   * @param {object[]} cards - instances of Card object
   * @param {string} folder - the destination folder id
   * @return a promise of the HTTP operation
   */
  AddressBook.prototype.$moveCards = function(cards, folder) {
    var _this = this, uids;

    uids = _.map(cards, 'id');
    return AddressBook.$$resource.post(this.id, 'move', {uids: uids, folder: folder})
      .then(function() {
        return _this.$_deleteCards(uids);
      });
  };

  /**
   * @function $save
   * @memberof AddressBook.prototype
   * @desc Save the addressbook to the server. This currently can only affect the name of the addressbook.
   * @returns a promise of the HTTP operation
   */
  AddressBook.prototype.$save = function() {
    return AddressBook.$$resource.save(this.id, this.$omit()).then(function(data) {
      return data;
    });
  };

  /**
   * @function $exportCards
   * @memberof AddressBook.prototype
   * @desc Export the selected/all cards
   * @returns a promise of the HTTP operation
   */
  AddressBook.prototype.exportCards = function(selectedOnly) {
    var data = null, options, selectedCards;

    options = {
      type: 'application/octet-stream',
      filename: this.name + '.ldif'
    };

    if (selectedOnly) {
      selectedCards = _.filter(this.$cards, function(card) { return card.selected; });
      data = { uids: _.map(selectedCards, 'id') };
    }

    if (data) {
      return AddressBook.$$resource.download(this.id, 'export', data, options);
    }
    else {
      return AddressBook.$$resource.open(this.id, 'export', data, options);
    }
  };

  /**
   * @function downloadProvisioningProfile
   * @memberof AddressBook.prototype
   * @desc Download provisioning profile for Apple's devices
   * @returns a promise of the HTTP operation
   */
  AddressBook.prototype.downloadProvisioningProfile = function () {
    var options, resource, index, ownerPaths, realOwnerId, path;

    options = {
      type: 'application/octet-stream',
      filename: 'addressbook.mobileconfig'
    }

    if (this.isSubscription) {
      index = this.urls.cardDavURL.indexOf('/dav/');
      ownerPaths = this.urls.cardDavURL.substring(index + 5).split(/\//);
      realOwnerId = ownerPaths[0];
      resource = AddressBook.$$resource.userResource(realOwnerId);
      path = ownerPaths[1] + '/' + ownerPaths[2];
    } else {
      resource = AddressBook.$$resource;
      path = this.id;
    }

    return resource.open(path, 'mobileconfig', null, options);
  };

  /**
   * @function $unwrap
   * @memberof AddressBook.prototype
   * @desc Unwrap a promise and instanciate new Card objects using received data.
   * @param {promise} futureAddressBookData - a promise of the AddressBook's data
   */
  AddressBook.prototype.$unwrap = function(futureAddressBookData) {
    var _this = this;

    this.$isLoading = true;

    // Expose and resolve the promise
    this.$futureAddressBookData = futureAddressBookData.then(function(response) {
      var selectedCards = _.map(_this.$selectedCards(), 'id');
      return AddressBook.$timeout(function() {
        var headers;

        if (!response.ids || _this.$topIndex > response.ids.length - 1)
          _this.$topIndex = 0;

        // Extend AddressBook instance from data of addressbooks list.
        // Will inherit attributes such as isEditable and isRemote.
        angular.forEach(AddressBook.$findAll(), function(o, i) {
          if (o.id == response.id) {
            angular.extend(_this, o);
          }
        });

        // Extend AddressBook instance with received data
        _this.init(response);

        if (_this.ids) {
          AddressBook.$log.debug('unwrapping ' + _this.ids.length + ' cards');

          // Instanciate Card objects
          _.reduce(_this.ids, function(cards, card, i) {
            var data = { pid: _this.id, id: card }, cardObject;

            // Build map of ID <=> index
            _this.idsMap[data.id] = i;

            cardObject = new AddressBook.$Card(data);

            // Restore selection
            cardObject.selected = selectedCards.indexOf(cardObject.id) > -1;

            cards.push(cardObject);

            return cards;
          }, _this.$cards);
        }

        if (response.headers) {
          // First entry of 'headers' are keys
          headers = _.invokeMap(response.headers[0], 'toLowerCase');
          response.headers.splice(0, 1);

          if (_this.ids) {
            // Extend Card objects with received headers
            _.forEach(response.headers, function(data) {
              var o = _.zipObject(headers, data),
                  i = _this.idsMap[o.id];
              _this.$cards[i].init(o);
            });
          }
          else {
            // Instanciate Card objects
            _this.$cards = [];
            angular.forEach(response.headers, function(data) {
              var o = _.zipObject(headers, data), cardObject;
              angular.extend(o, { pid: _this.id });
              cardObject = new AddressBook.$Card(o);
              cardObject.selected = selectedCards.indexOf(cardObject.id) > -1; // Restore selection
              _this.$cards.push(cardObject);
            });
          }
        }

        // Instanciate Acl object
        _this.$acl = new AddressBook.$$Acl('Contacts/' + _this.id);

        _this.$startRefreshTimeout();

        _this.$isLoading = false;

        AddressBook.$log.debug('addressbook ' + _this.id + ' ready');

        return _this;
      });
    }, function(data) {
      _this.isError = true;
      if (angular.isObject(data)) {
        AddressBook.$timeout(function() {
          angular.extend(_this, data);
        });
      }
    });
  };

  /**
   * @function $unwrapHeaders
   * @memberof AddressBook.prototype
   * @desc Unwrap a promise and extend matching Card objects with received data.
   * @param {promise} futureHeadersData - a promise of the metadata of some cards
   */
  AddressBook.prototype.$unwrapHeaders = function(futureHeadersData) {
    var _this = this,
        deferred = AddressBook.$q.defer();

    this.$futureHeadersData = deferred.promise;
    futureHeadersData.then(function(data) {
      AddressBook.$timeout(function() {
        var headers, j;
        if (data.length > 0) {
          // First entry of 'headers' are keys
          headers = _.invokeMap(data[0], 'toLowerCase');
          data.splice(0, 1);
          _.forEach(data, function(cardHeaders) {
            cardHeaders = _.zipObject(headers, cardHeaders);
            j = _this.idsMap[cardHeaders.id];
            if (angular.isDefined(j)) {
              _this.$cards[j].init(cardHeaders);
            }
          });
        }
        deferred.resolve(_this.$cards);
      });
    }, function() {
      deferred.reject();
    });

    return this.$futureHeadersData;
  };

  /**
   * @function $omit
   * @memberof AddressBook.prototype
   * @desc Return a sanitized object used to send to the server.
   * @return an object literal copy of the Addressbook instance
   */
  AddressBook.prototype.$omit = function() {
    var addressbook = {};
    angular.forEach(this, function(value, key) {
      if (key != 'constructor' &&
          key != 'acls' &&
          key != 'ids' &&
          key != 'idsMap' &&
          key != 'urls' &&
          key[0] != '$') {
        addressbook[key] = value;
      }
    });
    return addressbook;
  };
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @name Card
   * @constructor
   * @param {object} futureCardData
   * @param {string} [partial]
   */
  function Card(futureCardData, partial) {

    // Data is immediately available
    if (typeof futureCardData.then !== 'function') {
      this.init(futureCardData, partial);
      if (this.pid && !this.id) {
        // Prepare for the creation of a new card;
        // Get UID from the server.
        var newCardData = Card.$$resource.newguid(this.pid);
        this.$unwrap(newCardData);
        this.isNew = true;
      }
    }
    else {
      // The promise will be unwrapped first
      this.$unwrap(futureCardData);
    }
  }

  Card.$TEL_TYPES = ['work', 'home', 'cell', 'fax', 'pager'];
  Card.$EMAIL_TYPES = ['work', 'home', 'pref'];
  Card.$URL_TYPES = ['work', 'home', 'pref'];
  Card.$ADDRESS_TYPES = ['work', 'home'];

  /**
   * @memberof Card
   * @desc The factory we'll use to register with Angular.
   * @returns the Card constructor
   */
  Card.$factory = ['$q', '$timeout', 'sgSettings', 'sgCard_STATUS', 'encodeUriFilter', 'Resource', 'Preferences', function($q, $timeout, Settings, Card_STATUS, encodeUriFilter, Resource, Preferences) {
    angular.extend(Card, {
      STATUS: Card_STATUS,
      encodeUri: encodeUriFilter,
      $$resource: new Resource(Settings.activeUser('folderURL') + 'Contacts', Settings.activeUser()),
      $q: $q,
      $timeout: $timeout,
      $Preferences: Preferences
    });
    // Initialize categories from user's defaults
    if (Preferences.defaults.SOGoContactsCategories) {
      Card.$categories = Preferences.defaults.SOGoContactsCategories;
    }
    if (Preferences.defaults.SOGoAlternateAvatar)
      Card.$alternateAvatar = Preferences.defaults.SOGoAlternateAvatar;

    return Card; // return constructor
  }];

  /**
   * @module SOGo.ContactsUI
   * @desc Factory registration of Card in Angular module.
   */
  try {
    angular.module('SOGo.ContactsUI');
  }
  catch(e) {
    angular.module('SOGo.ContactsUI', ['SOGo.Common', 'SOGo.PreferencesUI']);
  }
  angular.module('SOGo.ContactsUI')
    .constant('sgCard_STATUS', {
      NOT_LOADED:      0,
      DELAYED_LOADING: 1,
      LOADING:         2,
      LOADED:          3,
      DELAYED_MS:      300
    })
    .factory('Card', Card.$factory);

  /**
   * @memberof Card
   * @desc Fetch a card from a specific addressbook.
   * @param {string} addressbookId - the addressbook ID
   * @param {string} cardId - the card ID
   * @see {@link AddressBook.$getCard}
   */
  Card.$find = function(addressbookId, cardId) {
    var futureCardData = this.$$resource.fetch([addressbookId, cardId].join('/'), 'view');

    if (cardId) return new Card(futureCardData); // a single card

    return Card.$unwrapCollection(futureCardData); // a collection of cards
  };

  /**
   * @function filterCategories
   * @memberof Card.prototype
   * @desc Search for categories matching some criterias
   * @param {string} search - the search string to match
   * @returns a collection of strings
   */
  Card.filterCategories = function(query) {
    var re = new RegExp(query, 'i');
    return _.map(_.filter(Card.$categories, function(category) {
      return category.search(re) != -1;
    }), function(category) {
      return { value: category };
    });
  };

  /**
   * @memberof Card
   * @desc Unwrap to a collection of Card instances.
   * @param {object} futureCardData
   */
  Card.$unwrapCollection = function(futureCardData) {
    var collection = {};

    collection.$futureCardData = futureCardData;

    futureCardData.then(function(cards) {
      Card.$timeout(function() {
        angular.forEach(cards, function(data, index) {
          collection[data.id] = new Card(data);
        });
      });
    });

    return collection;
  };

  /**
   * @function init
   * @memberof Card.prototype
   * @desc Extend instance with required attributes and new data.
   * @param {object} data - attributes of card
   */
  Card.prototype.init = function(data, partial) {
    var _this = this;

    if (angular.isUndefined(this.refs))
      this.refs = [];
    if (angular.isUndefined(this.categories))
      this.categories = [];
    this.c_screenname = null;
    angular.extend(this, data);
    if (!this.pid)
      this.pid = this.container;
    if (!this.$$fullname)
      this.$$fullname = this.$fullname();
    if (!this.$$email)
      this.$$email = this.$preferredEmail(partial);
    if (!this.$$image)
      this.$$image = this.image;
    if (!this.$$image)
      this.$$image = Card.$Preferences.avatar(this.$$email, 40, {no_404: true});
    if (this.hasphoto)
      this.photoURL = Card.$$resource.path(this.pid, this.id, 'photo');
    if (this.isgroup)
      this.c_component = 'vlist';
    this.$avatarIcon = this.$isList()? 'group' : 'person';
    if (data.orgs && data.orgs.length)
      this.orgs = _.map(data.orgs, function(org) { return { 'value': org }; });
    if (data.notes && data.notes.length)
      this.notes = _.map(data.notes, function(note) { return { 'value': note }; });
    else if (!this.notes || !this.notes.length)
      this.notes = [ { value: '' } ];
    // Lowercase the type of specific fields
    angular.forEach(['addresses', 'phones', 'urls'], function(key) {
      angular.forEach(_this[key], function(o) {
        if (o.type) o.type = o.type.toLowerCase();
      });
    });
    // Instanciate Card objects for list members
    angular.forEach(this.refs, function(o, i) {
      if (o.email) o.emails = [{value: o.email}];
      o.id = o.reference;
      _this.refs[i] = new Card(o);
    });
    // Instanciate date object of birthday
    if (this.birthday && angular.isString(this.birthday)) {
      var dlp = Card.$Preferences.$mdDateLocaleProvider;
      this.birthday = this.birthday.parseDate(dlp, '%Y-%m-%d');
      this.$birthday = dlp.formatDate(this.birthday);
    }

    this.$loaded = angular.isDefined(this.c_name)? Card.STATUS.LOADED : Card.STATUS.NOT_LOADED;

    // An empty attribute to trick md-autocomplete when adding attendees from the appointment editor
    this.empty = ' ';
  };

  /**
   * @function $id
   * @memberof Card.prototype
   * @desc Return the card ID.
   * @returns the card ID
   */
  Card.prototype.$id = function() {
    return this.$futureCardData.then(function(data) {
      return data.id;
    });
  };

  /**
   * @function $path
   * @memberof Card.prototype
   * @desc Return the relative URL of the card.
   * @returns the relative URL, properly encoded
   */
  Card.prototype.$path = function() {
    return [this.pid, this.id];
  };

  /**
   * @function $isLoading
   * @memberof Card.prototype
   * @returns true if the Card definition is still being retrieved from server after a specific delay
   * @see sgCard_STATUS
   */
  Card.prototype.$isLoading = function() {
    return this.$loaded == Card.STATUS.LOADING;
  };

  /**
   * @function $reload
   * @memberof Card.prototype
   * @desc Fetch all available attributes of the contact.
   * @returns a promise of the HTTP operation
   */
  Card.prototype.$reload = function() {
    var _this = this, futureCardData;

    if (this.$futureCardData)
      return this;

    futureCardData = Card.$$resource.fetch(this.$path(), 'view');

    return this.$unwrap(futureCardData);
  };

  /**
   * @function $members
   * @memberof Card.prototype
   * @desc Fetch members of the LDAP group.
   * @returns a promise that resolves with the members
   */
  Card.prototype.$members = function() {
    var _this = this;

    if (this.members)
      return Card.$q.when(this.members);

    if (this.$isGroup({expandable: true})) {
      return Card.$$resource.fetch(this.$path(), 'members').then(function(data) {
        _this.members = _.map(data.members, function(member) {
          return new Card(member);
        });
        return _this.members;
      });
    }

    return Card.$q.reject("Card " + this.id + " is not an LDAP group");
  };

  /**
   * @function $save
   * @memberof Card.prototype
   * @desc Save the card to the server.
   */
  Card.prototype.$save = function(options) {
    var _this = this,
        action = 'saveAsContact',
        data;

    if (this.c_component == 'vlist') {
      action = 'saveAsList';
      _.forEach(this.refs, function(ref) {
        ref.reference = ref.id;
      });
    }

    data = this.$omit();
    if (options && options.ignoreDuplicate) {
      angular.extend(data, options);
    }

    return Card.$$resource.save([
      Card.encodeUri(this.pid),
      Card.encodeUri(this.id) || '_new_'
    ].join('/'),
                                data,
                                { action: action })
      .then(function(data) {
        // Format birthdate
        if (_this.birthday)
          _this.$birthday = Card.$Preferences.$mdDateLocaleProvider.formatDate(_this.birthday);
        // Make a copy of the data for an eventual reset
        _this.$shadowData = _this.$omit(true);
        return data;
      });
  };

  Card.prototype.$delete = function(attribute, index) {
    if (attribute) {
      if (index > -1 && this[attribute].length > index) {
        this[attribute].splice(index, 1);
      }
      else
        delete this[attribute];
    }
    else {
      // No arguments -- delete card
      return Card.$$resource.remove(this.$path());
    }
  };

  /**
   * @function export
   * @memberof Card.prototype
   * @desc Download the current card
   * @returns a promise of the HTTP operation
   */
  Card.prototype.export = function() {
    var data, options;

    data = { uids: [ this.id ] };
    options = {
      type: 'application/octet-stream',
      filename: this.$$fullname + '.ldif'
    };

    return Card.$$resource.download(this.pid, 'export', data, options);
  };

  Card.prototype.$fullname = function(options) {
    var toHtmlEntities = function (string) {
      if (options && options.html && string && string.length > 0)
        return string.replace(/./gm, function(s) {
	  return "&#" + s.charCodeAt(0) + ";";
        });
      else
        return string;
    };
    var fn = toHtmlEntities(this.c_cn) || '', html = options && options.html, email, names;
    if (fn.length === 0) {
      names = [];
      if (this.c_givenname && this.c_givenname.length > 0)
        names.push(toHtmlEntities(this.c_givenname));
      if (this.nickname && this.nickname.length > 0)
        names.push((html?'<em>':'') + toHtmlEntities(this.nickname) + (html?'</em>':''));
      if (this.c_sn && this.c_sn.length > 0)
        names.push(toHtmlEntities(this.c_sn));
      if (names.length > 0)
        fn = names.join(' ');
      else if (this.org && this.org.length > 0) {
        fn = toHtmlEntities(this.org);
      }
      else if (this.emails && this.emails.length > 0) {
        email = _.find(this.emails, function(i) { return i.value !== ''; });
        if (email)
          fn = toHtmlEntities(email.value);
      }
    }
    if (this.contactinfo)
      fn += ' (' + toHtmlEntities(this.contactinfo.split("\n").join("; ")) + ')';

    return fn;
  };

  Card.prototype.$description = function() {
    var description = [];
    if (this.title) description.push(this.title);
    if (this.role) description.push(this.role);
    if (this.org) description.push(this.org);
    if (this.orgs) description = _.concat(description, _.map(this.orgs, 'value'));
    if (this.description) description.push(this.description);

    return description.join(', ');
  };

  /**
   * @function $preferredEmail
   * @memberof Card.prototype
   * @desc Get the preferred email address.
   * @param {string} [partial] - a partial string that the email must match
   * @returns the first email address of type "pref" or the first address if none found
   */
  Card.prototype.$preferredEmail = function(partial) {
    var email, re;
    if (partial) {
      re = new RegExp(partial, 'i');
      email = _.find(this.emails, function(o) {
        return re.test(o.value);
      });
    }
    if (email) {
      email = email.value;
    }
    else {
      email = _.find(this.emails, function(o) {
        return o.type == 'pref';
      });
      if (email) {
        email = email.value;
      }
      else if (this.emails && this.emails.length) {
        email = this.emails[0].value;
      }
      else if (this.c_mail && this.c_mail.length) {
        email = this.c_mail[0];
      }
      else {
        email = '';
      }
    }

    return email;
  };

  /**
   * @function $shortFormat
   * @memberof Card.prototype
   * @param {string} [partial] - a partial string that the email must match
   * @returns the fullname along with a matching email address in parentheses
   */
  Card.prototype.$shortFormat = function(partial) {
    var fullname = [this.$$fullname],
        email = this.$preferredEmail(partial);
    if (email && email != this.$$fullname)
      fullname.push(' <' + email + '>');
    return fullname.join(' ');
  };

  Card.prototype.$isCard = function() {
    return this.c_component == 'vcard';
  };

  Card.prototype.$isList = function(options) {
    // isGroup attribute means it's a group of a LDAP source (not automatically expanded on the client-side)
    var condition = (!options || !options.expandable || options.expandable && !this.isgroup);
    return this.c_component == 'vlist' && condition;
  };

  Card.prototype.$isGroup = function(options) {
    var condition = (!options || !options.expandable || options.expandable && Card.$Preferences.defaults.SOGoLDAPGroupExpansionEnabled);
    return this.isgroup && condition;
  };

  Card.prototype.$addOrg = function(org) {
    if (angular.isUndefined(this.orgs)) {
      this.orgs = [org];
    }
    else if (org != this.org && !_.includes(this.orgs, org)) {
      this.orgs.push(org);
    }
    return this.orgs.length - 1;
  };

  // Card.prototype.$addCategory = function(category) {
  //   if (category) {
  //     if (angular.isUndefined(this.categories)) {
  //       this.categories = [{value: category}];
  //     }
  //     else {
  //       for (var i = 0; i < this.categories.length; i++) {
  //         if (this.categories[i].value == category) {
  //           break;
  //         }
  //       }
  //       if (i == this.categories.length)
  //         this.categories.push({value: category});
  //     }
  //   }
  // };

  Card.prototype.$addEmail = function(type) {
    if (angular.isUndefined(this.emails)) {
      this.emails = [{type: type, value: ''}];
    }
    else if (_.isUndefined(_.find(this.emails, function(i) { return i.value === ''; }))) {
      this.emails.push({type: type, value: ''});
    }
    return this.emails.length - 1;
  };

  Card.prototype.$addScreenName = function(screenName) {
    this.c_screenname = screenName;
  };

  Card.prototype.$addPhone = function(type) {
    if (angular.isUndefined(this.phones)) {
      this.phones = [{type: type, value: ''}];
    }
    else if (_.isUndefined(_.find(this.phones, function(i) { return i.value === ''; }))) {
      this.phones.push({type: type, value: ''});
    }
    return this.phones.length - 1;
  };

  Card.prototype.$addUrl = function(type, url) {
    if (angular.isUndefined(this.urls)) {
      this.urls = [{type: type, value: url}];
    }
    else if (_.isUndefined(_.find(this.urls, function(i) { return i.value == url; }))) {
      this.urls.push({type: type, value: url});
    }
    return this.urls.length - 1;
  };

  Card.prototype.$addAddress = function(type, postoffice, street, street2, locality, region, country, postalcode) {
    if (angular.isUndefined(this.addresses)) {
      this.addresses = [{type: type, postoffice: postoffice, street: street, street2: street2, locality: locality, region: region, country: country, postalcode: postalcode}];
    }
    else if (!_.find(this.addresses, function(i) {
      return i.street == street &&
        i.street2 == street2 &&
        i.locality == locality &&
        i.country == country &&
        i.postalcode == postalcode;
    })) {
      this.addresses.push({type: type, postoffice: postoffice, street: street, street2: street2, locality: locality, region: region, country: country, postalcode: postalcode});
    }
    return this.addresses.length - 1;
  };

  Card.prototype.$addMember = function(email) {
    var card = new Card({email: email, emails: [{value: email}]}),
        i;
    if (angular.isUndefined(this.refs)) {
      this.refs = [card];
    }
    else if (email.length === 0) {
      this.refs.push(card);
    }
    else {
      for (i = 0; i < this.refs.length; i++) {
        if (this.refs[i].email == email) {
          break;
        }
      }
      if (i == this.refs.length)
        this.refs.push(card);
    }
    return this.refs.length - 1;
  };

  /**
   * @function $certificate
   * @memberof Account.prototype
   * @desc View the S/MIME certificate details associated to the account.
   * @returns a promise of the HTTP operation
   */
  Card.prototype.$certificate = function() {
    var _this = this;

    if (this.hasCertificate) {
      if (this.$$certificate)
        return Card.$q.when(this.$$certificate);
      else {
        return Card.$$resource.fetch(this.$path(), 'certificate').then(function(data) {
          _this.$$certificate = data;
          return data;
        });
      }
    }
    else {
      return Card.$q.reject();
    }
  };

  /**
   * @function $removeCertificate
   * @memberof Account.prototype
   * @desc Remove any S/MIME certificate associated with the account.
   * @returns a promise of the HTTP operation
   */
  Card.prototype.$removeCertificate = function(immediate) {
    var _this = this;

    if (immediate) {
      return Card.$$resource.fetch(this.$path(), 'removeCertificate').then(function() {
        _this.hasCertificate = false;
      });
    }
    else {
      this.hasCertificate = false;
    }
  };

  /**
   * @function explode
   * @memberof Card.prototype
   * @desc Create a new Card associated to each email address of this card.
   * @return an array of Card instances
   */
  Card.prototype.explode = function() {
    var _this = this, cards = [], data;

    if (this.emails) {
      if (this.emails.length > 1) {
        data = this.$omit();
        _.forEach(this.emails, function(email) {
          var card = new Card(angular.extend({}, data, {emails: [email]}));
          cards.push(card);
        });
        return cards;
      }
      else
        return [this];
    }

    return [];
  };

  /**
   * @function $reset
   * @memberof Card.prototype
   * @desc Reset the original state the card's data.
   */
  Card.prototype.$reset = function() {
    var _this = this;
    angular.forEach(this, function(value, key) {
      if (key != 'constructor' && key[0] != '$') {
        delete _this[key];
      }
    });
    this.init(this.$shadowData);
    this.$shadowData = this.$omit(true);
  };

  /**
   * @function $updateMember
   * @memberof Card.prototype
   * @desc Update an existing list member from a Card instance.
   * A list member has the following attribtues:
   * - email
   * - reference
   * - fn
   * @param {number} index
   * @param {string} email
   * @param {Card} card
   */
  // Card.prototype.$updateMember = function(index, email, card) {
  //   var ref = {
  //     email: email,
  //     emails: [{value: email}],
  //     reference: card.c_name,
  //     c_cn: card.$fullname()
  //   };
  //   this.refs[index] = new Card(ref);
  // };

  /**
   * @function $unwrap
   * @memberof Card.prototype
   * @desc Unwrap a promise and make a copy of the resolved data.
   * @param {object} futureCardData - a promise of the Card's data
   */
  Card.prototype.$unwrap = function(futureCardData) {
    var _this = this;

    // Card is not loaded yet
    this.$loaded = Card.STATUS.DELAYED_LOADING;
    Card.$timeout(function() {
      if (_this.$loaded != Card.STATUS.LOADED)
        _this.$loaded = Card.STATUS.LOADING;
    }, Card.STATUS.DELAYED_MS);

    // Expose the promise
    this.$futureCardData = futureCardData.then(function(data) {
      _this.init(data);
      // Mark card as loaded
      _this.$loaded = Card.STATUS.LOADED;
      // Make a copy of the data for an eventual reset
      _this.$shadowData = _this.$omit(true);

      return _this;
    });

    return this.$futureCardData;
  };

  /**
   * @function $omit
   * @memberof Card.prototype
   * @desc Return a sanitized object used to send to the server.
   * @param {boolean} [deep] - make a deep copy if true
   * @return an object literal copy of the Card instance
   */
  Card.prototype.$omit = function(deep) {
    var card = {};
    angular.forEach(this, function(value, key) {
      if (key == 'refs') {
        card.refs = _.map(value, function(o) {
          return o.$omit(deep);
        });
      }
      else if (key != 'constructor' && key[0] != '$') {
        if (deep)
          card[key] = angular.copy(value);
        else
          card[key] = value;
      }
    });

    // We convert back our birthday object
    if (!deep) {
      if (card.birthday)
        card.birthday = card.birthday.format(Card.$Preferences.$mdDateLocaleProvider, '%Y-%m-%d');
      else
        card.birthday = '';
    }

    // We flatten the organizations to an array of strings
    if (this.orgs)
      card.orgs = _.map(this.orgs, 'value');

    // We flatten the notes to an array of strings
    if (this.notes)
      card.notes = _.map(this.notes, 'value');

    return card;
  };

  Card.prototype.toString = function() {
    var desc = this.id + ' ' + this.$$fullname;

    if (this.$$email)
      desc += ' <' + this.$$email + '>';

    return '[' + desc + ']';
  };
})();
