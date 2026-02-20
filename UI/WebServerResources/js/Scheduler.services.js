/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @name Attendees
   * @constructor
   * @param {object} component - a Component object instance
   */
  function Attendees(component) {
    this.component = component;
    if (this.component.attendees) {
      _.forEach(this.component.attendees, function(attendee) {
        attendee.image = Attendees.$gravatar(attendee.email, 32);
      });
    }
    this.workDaysOnly = true;
    this.slotStartTimeLimit = new Date();
    this.slotStartTimeLimit.setMinutes(0);
    this.slotStartTimeLimit.setHours(Attendees.dayStartHour);
    this.slotEndTimeLimit = new Date();
    this.slotEndTimeLimit.setMinutes(0);
    this.slotEndTimeLimit.setHours(Attendees.dayEndHour);
    this.$days = [];
    this.$futureFreebusyData = {};
    this.updateFreeBusyCoverage();
    this.updateFreeBusy();
    if (this.$days.length == 0) {
      this.getDays();
    }
  }

  /**
   * @memberof Attendees
   * @desc The factory we'll use to register with Angular
   * @returns the Attendees constructor
   */
  Attendees.$factory = ['$q', '$timeout', '$log', 'sgSettings', 'Attendees_ROLES', 'Preferences', 'User', 'Card', 'Gravatar', 'Resource', function($q, $timeout, $log, Settings, ROLES, Preferences, User, Card, Gravatar, Resource) {
    angular.extend(Attendees, {
      $q: $q,
      $timeout: $timeout,
      $log: $log,
      $settings: Settings,
      $User: User,
      $Preferences: Preferences,
      $Card: Card,
      $gravatar: Gravatar,
      $$resource: new Resource(Settings.activeUser('folderURL') + 'Calendar', Settings.activeUser()),
      ROLES: ROLES
    });

    Attendees.dayStartHour = parseInt(Preferences.defaults.SOGoDayStartTime.split(':')[0]);
    Attendees.dayEndHour = parseInt(Preferences.defaults.SOGoDayEndTime.split(':')[0]);

    return Attendees; // return constructor
  }];

  /**
   * @module SOGo.SchedulerUI
   * @desc Factory registration of Attendees in Angular module.
   */
  try {
    angular.module('SOGo.SchedulerUI');
  }
  catch(e) {
    angular.module('SOGo.SchedulerUI', ['SOGo.Common']);
  }
  angular.module('SOGo.SchedulerUI')
    .constant('Attendees_ROLES', {
      REQ_PARTICIPANT: 'req-participant',
      OPT_PARTICIPANT: 'opt-participant',
      NON_PARTICIPANT: 'non-participant',
      CHAIR: 'chair'
    })
    .factory('Attendees', Attendees.$factory);

  /**
   * @function timeToQuarters
   * @memberof Attendees
   * @param {date} dateTime - a Date object instance
   * @desc Return the number of quarters matching the time
   * @returns the number of quarters
   */
  Attendees.timeToQuarters = function(dateTime) {
    return dateTime.getHours() * 4 + Math.ceil(dateTime.getMinutes()/15);
  };

  /**
   * @function getLength
   * @memberof Attendees.prototype
   * @returns the number of attendees
   */
  Attendees.prototype.getLength = function() {
    return this.component.attendees ? this.component.attendees.length : 0;
  };

  /**
   * @function initOrganizer
   * @memberof Attendees.prototype
   * @desc Extend instance with organizer including her freebusy information.
   * @param {object} calendar - Calendar instance associated to current component
   */
  Attendees.prototype.initOrganizer = function(calendar) {
    var _this = this, promise;
    if (calendar && calendar.isSubscription) {
      promise = Attendees.$User.$filter(calendar.owner).then(function(results) {
        var owner = results[0];
        _this.component.organizer = {
          uid: owner.uid,
          name: owner.cn,
          email: owner.c_email
        };
      });
    }
    else {
      if (!this.component.organizer) {
        this.component.organizer = {
          uid: Attendees.$settings.activeUser('login'),
          name: Attendees.$settings.activeUser('identification'),
          email: Attendees.$settings.activeUser('email')
        };
      }
      promise = Attendees.$q.when();
    }
    // Fetch organizer's freebusy
    promise.then(function() {
      _this.updateFreeBusyAttendee(_this.component.organizer);
    });
  };

  /**
   * @function add
   * @memberof Attendees.prototype
   * @desc Add an attendee and fetch his freebusy info.
   * @param {Object} card - an Card object instance to be added to the attendees list
   */
  Attendees.prototype.add = function(card, options) {
    var _this = this, attendee, list, url, params, promise = Attendees.$q.when();
    if (card) {
      if (!this.component.attendees || (options && options.organizerCalendar)) {
        // No attendee yet; initialize the organizer
        this.initOrganizer(options? options.organizerCalendar : null);
      }
      if (card.$isList({expandable: true})) {
        // Decompose list members
        list = Attendees.$Card.$find(card.container, card.c_name);
        promise = list.$id().then(function(listId) {
          _.forEach(list.refs, function(ref) {
            attendee = {
              name: ref.c_cn,
              email: ref.$preferredEmail(options? options.partial : null),
              role: Attendees.ROLES.REQ_PARTICIPANT,
              partstat: 'needs-action',
              uid: ref.c_uid,
              $avatarIcon: 'person',
            };
            if (!_.find(_this.component.attendees, function(o) {
              return o.email == attendee.email;
            })) {
              // Contact is not already an attendee, add it
              attendee.image = Attendees.$gravatar(attendee.email, 32);
              if (_this.component.attendees)
                _this.component.attendees.push(attendee);
              else
                _this.component.attendees = [attendee];
              _this.updateFreeBusyAttendee(attendee);
            }
          });
        });
      }
      else {
        // Single contact
        attendee = {
          uid: card.c_uid,
          domain: card.c_domain,
          isMSExchange: card.ismsexchange,
          isGroup: card.$isList(),
          isExpandableGroup: false,
          isResource: card.isresource,
          name: card.c_cn,
          email: card.$$email,
          role: Attendees.ROLES.REQ_PARTICIPANT,
          partstat: 'needs-action',
          $avatarIcon: card.$avatarIcon
        };
        if (!_.find(this.attendees, function(o) {
          return o.email == attendee.email;
        })) {
          if (card.$isList() && Attendees.$Preferences.defaults.SOGoLDAPGroupExpansionEnabled) {
            // LDAP list -- preload members
            promise = card.$members().then(function(members) {
              attendee.members = members;
              attendee.isExpandableGroup = true;
            });
          }
          attendee.image = Attendees.$gravatar(attendee.email, 32);
          if (this.component.attendees) {
            if (_.findIndex(this.component.attendees, { email: attendee.email }) < 0)
              this.component.attendees.push(attendee);
          }
          else
            this.component.attendees = [attendee];
          this.updateFreeBusyAttendee(attendee);
        }
      }
    }

    return promise;
  };

  /**
   * @function nextRole
   * @memberof Attendees.prototype
   * @desc Switch the attendee to the next participation role.
   * @param {Object} attendee - the attendee definition
   */
  Attendees.prototype.nextRole = function(attendee) {
    var roles = _.values(Attendees.ROLES);
    var index = _.findIndex(roles, function(role) {
      return attendee.role === role;
    });
    attendee.role = roles[++index % 4];
  };

  /**
   * @function hasAttendee
   * @memberof Attendees.prototype
   * @desc Verify if one of the email addresses of a Card instance matches an attendee.
   * @param {Object} card - an Card object instance
   * @returns true if the Card matches an attendee
   */
  Attendees.prototype.hasAttendee = function(card) {
    var attendee = _.find(this.component.attendees, function(attendee) {
      return _.find(card.emails, function(email) {
        return email.value == attendee.email;
      });
    });
    return angular.isDefined(attendee);
  };

  /**
   * @function remove
   * @memberof Attendees.prototype
   * @desc Remove an attendee from the component.
   * @param {Object} attendee - an object literal defining an attendee
   */
  Attendees.prototype.remove = function(attendee) {
    var index = _.findIndex(this.component.attendees, function(currentAttendee) {
      return currentAttendee.email == attendee.email;
    });
    if (index > -1)
      this.component.attendees.splice(index, 1);
    delete this.$futureFreebusyData[attendee.uid];
  };

  /**
   * @function updateFreeBusyCoverage
   * @memberof Attendees.prototype
   * @desc Build a 15-minute-based representation of the component's period.
   * @returns an object literal hashed by days and hours and arrays of four 1's and 0's
   */
  Attendees.prototype.updateFreeBusyCoverage = function() {
    var _this = this, freebusy = {};
    var roundedStart, roundedEnd, startQuarter, endQuarter;

    if (this.component.start && this.component.end) {
      roundedStart = new Date(this.component.start.getTime());
      roundedEnd = new Date(this.component.end.getTime());
      if (this.component.isAllDay) {
        roundedStart.setHours(Attendees.dayStartHour);
        roundedStart.setMinutes(0);
        roundedEnd.setHours(Attendees.dayEndHour);
        roundedEnd.setMinutes(0);
        startQuarter = endQuarter = 0;
      }
      else {
        startQuarter = parseInt(roundedStart.getMinutes()/15 + 0.5);
        endQuarter = parseInt(roundedEnd.getMinutes()/15 + 0.5);
      }
      roundedStart.setMinutes(15*startQuarter);
      roundedEnd.setMinutes(15*endQuarter);

      _.forEach(roundedStart.beginOfDay().daysUpTo(roundedEnd.beginOfDay()), function(date, index) {
        if (date < roundedStart)
          date = new Date(roundedStart.getTime());
        var currentDay = date.getDate(),
            dayKey = date.getDayString(),
            hourKey;
        if (dayKey === roundedStart.getDayString()) {
          hourKey = date.getHours().toString();
          freebusy[dayKey] = {};
          freebusy[dayKey][hourKey] = [];
          while (startQuarter > 0) {
            freebusy[dayKey][hourKey].push(0);
            startQuarter--;
          }
        }
        else {
          date = date.beginOfDay();
          freebusy[dayKey] = {};
        }
        while (date.getTime() < roundedEnd.getTime() &&
               date.getDate() == currentDay) {
          hourKey = date.getHours().toString();
          if (angular.isUndefined(freebusy[dayKey][hourKey]))
            freebusy[dayKey][hourKey] = [];
          freebusy[dayKey][hourKey].push(1);
          date.addMinutes(15);
        }
      });
      this.freebusy = freebusy;
    }
  };

  /**
   * @function coversFreeBusy
   * @memberof Attendees.prototype
   * @desc Check if a specific quarter matches the component's period.
   * @returns true if the quarter covers the component's period
   */
  Attendees.prototype.coversFreeBusy = function(day, hour, quarter) {
    var b = (this.freebusy &&
             angular.isDefined(this.freebusy[day]) &&
             angular.isDefined(this.freebusy[day][hour]) &&
             this.freebusy[day][hour][quarter] == 1);
    return b;
  };

  /**
   * @function getDays
   * @memberof Attendees.prototype
   * @desc Define a period of one week before and one week after the component's period or a reference date.
   * @param refDate - a Date object
   * @returns an array of objects representing the days
   */
  Attendees.prototype.getDays = function(refDate) {
    var _this = this, sd, ed, formatFcn;

    if (refDate) {
      sd = refDate;
      ed = new Date(refDate.getTime());
      ed.addMinutes(this.component.delta);
    }
    else {
      sd = this.component.start;
      ed = this.component.end;
    }

    if (this.$days.length === 0 ||
        _.findIndex(this.$days, ['getDayString', sd.getDayString()]) < 0 ||
        _.findIndex(this.$days, ['getDayString', ed.getDayString()]) < 0) {
      sd = sd.beginOfDay().addDays(-7);
      ed = ed.beginOfDay().addDays(7);
      formatFcn = Attendees.$Preferences.$mdDateLocaleProvider.formatDate;
      this.$days.splice(0, this.$days.length);
      _.forEach(sd.daysUpTo(ed), function(date) {
        date.$dateFormat = Attendees.$Preferences.defaults.SOGoLongDateFormat;
        _this.$days.push({
          stringWithSeparator: formatFcn(date),
          getDayString: date.getDayString()
        });
      });
    }

    return this.$days;
  };

  /**
   * @function updateFreeBusy
   * @memberof Attendees.prototype
   * @desc Fetch the freebusy information of the organizer and all attendees.
   * @returns a promise of the all HTTP operations
   */
  Attendees.prototype.updateFreeBusy = function(refDate) {
    var _this = this, promises = [];

    if (this.getLength() > 0) {
      if (this.component.organizer) {
        promises.push(this.updateFreeBusyAttendee(this.component.organizer, refDate));
      }
      _.forEach(_.filter(this.component.attendees, 'uid'), function(attendee) {
        promises.push(_this.updateFreeBusyAttendee(attendee, refDate));
      });
    }

    return Attendees.$q.all(promises);
  };

  /**
   * @function updateFreeBusyAttendee
   * @memberof Attendees.prototype
   * @desc Update the freebusy information for the component's period for a specific attendee.
   * @param {Object} card - an Card object instance of the attendee
   * @returns a promise of the HTTP operation if the information was not cached
   */
  Attendees.prototype.updateFreeBusyAttendee = function(attendee, refDate) {
    var promise, resource, uid, sd, ed, params, days;

    if (attendee.uid) {
      uid = attendee.uid;
      if (attendee.domain)
        uid += '@' + attendee.domain;
      days = _.map(this.getDays(refDate), 'getDayString');
      params =
        {
          sday: days[0],
          eday: days[days.length - 1]
        };

      if (attendee.isMSExchange) {
        // Attendee is not a local user, but her freebusy data is available from an external MS Exchange server;
        // we query /SOGo/so/<login_user>/freebusy.ifb/ajaxRead?uid=<uid>
        resource = Attendees.$$resource.userResource();
        params.uid = uid;
      }
      else {
        // Attendee is a user;
        // web query /SOGo/so/<uid>/freebusy.ifb/ajaxRead
        resource = Attendees.$$resource.userResource(uid);
      }

      if (angular.isUndefined(attendee.freebusy))
        attendee.freebusy = {};

      if (_.intersection(_.keys(attendee.freebusy), days).length !== days.length) {
        // Fetch FreeBusy information
        promise = resource.fetch('freebusy.ifb', 'ajaxRead', params).then(function(data) {
          _.forEach(days, function(day) {
            var hour;

            if (angular.isUndefined(attendee.freebusy[day]))
              attendee.freebusy[day] = {};

            if (angular.isUndefined(data[day]))
              data[day] = {};

            for (var i = 0; i <= 23; i++) {
              hour = i.toString();
              if (data[day][hour])
                attendee.freebusy[day][hour] = [
                  data[day][hour]["0"],
                  data[day][hour]["15"],
                  data[day][hour]["30"],
                  data[day][hour]["45"]
                ];
              else
                attendee.freebusy[day][hour] = [0, 0, 0, 0];
            }
          });
        });
      }
      else {
        promise = Attendees.$q.when();
      }

      this.$futureFreebusyData[attendee.uid] = promise;

      return promise;
    }
  };


  /**
   * @function forwardFindDate
   * @memberof Attendees.prototype
   * @desc Find the next slot for which all attendees are available whitin the reference day
   * @param {date} currentStart - the reference day
   * @returns a date object or null if no slot were found
   */
  Attendees.prototype.forwardFindDate = function(currentStart) {
    var foundDate = null;
    var maxOffset = this.endLimit - this.duration;
    var offset = 0;

    if (this.firstStep) {
      offset = Math.floor(this.start.getHours() * 4 + this.start.getMinutes() / 15) + 1;
      this.firstStep = false;
    }
    else {
      offset = this.currentEntries.indexOf(0);
    }
    if (offset > -1 && offset < this.startLimit) {
      offset = this.startLimit;
    }

    while (!foundDate && offset > -1 && offset <= maxOffset) {
      var testDuration = 0;
      while (this.currentEntries[offset] === 0 && testDuration < this.duration) {
        testDuration++;
        offset++;
      }
      if (testDuration == this.duration) {
        foundDate = new Date();
        var foundTime = (currentStart.getTime() + (offset - testDuration) * 900000);
        foundDate.setTime(foundTime);
      }
      else {
        offset = this.currentEntries.indexOf(0, offset + 1);
      }
    }

    return foundDate;
  };

  /**
   * @function forwardAdjustCurrentStart
   * @memberof Attendees.prototype
   * @desc Adjust a date to the next non-weekend day
   * @param {date} currentStart - the reference day
   */
  Attendees.prototype.forwardAdjustCurrentStart = function (currentStart) {
    var day = currentStart.getDay();
    if (day === 0) {
      currentStart.addDays(1);
    }
    else if (day === 6) {
      currentStart.addDays(2);
    }
  };

  /**
   * @function backwardFindDate
   * @memberof Attendees.prototype
   * @desc Find the previous slot for which all attendees are available whitin the reference day
   * @param {date} currentStart - the reference day
   * @returns a date object or null if no slot were found
   */
  Attendees.prototype.backwardFindDate = function (currentStart) {
    var foundDate = null;
    var maxOffset = this.endLimit - this.duration;
    var offset;
    if (this.firstStep) {
      offset = Math.floor(this.start.getHours() * 4 + this.start.getMinutes() / 15) - 1;
      this.firstStep = false;
    }
    else {
      offset = this.currentEntries.lastIndexOf(0);
    }
    if (offset > maxOffset) {
      offset = maxOffset;
    }
    while (!foundDate && offset >= this.startLimit) {
      var testDuration = 0;
      var testOffset = offset;
      while (this.currentEntries[testOffset] === 0 && testDuration < this.duration) {
        testDuration++;
        testOffset++;
      }
      if (testDuration == this.duration) {
        foundDate = new Date();
        var foundTime = (currentStart.getTime() + offset * 900000);
        foundDate.setTime(foundTime);
      }
      else {
        offset = this.currentEntries.lastIndexOf(0, offset - 1);
      }
    }
    Attendees.$log.debug(['found = ' + foundDate, offset]);
    return foundDate;
  };

  /**
   * @function backwardAdjustCurrentStart
   * @memberof Attendees.prototype
   * @desc Adjust a date to the previous non-weekend day
   * @param {date} currentStart - the reference day
   */
  Attendees.prototype.backwardAdjustCurrentStart = function (currentStart) {
    var day = currentStart.getDay();
    if (day == 0) {
      currentStart.addDays(-2);
    }
    else if (day == 6) {
      currentStart.addDays(-1);
    }
  };

  /**
   * @function findSlot
   * @memberof Attendees.prototype
   * @desc Find the next or previous slot when all attendees are available.
   * @param {number} direction - the search direction (1 or -1)
   */
  Attendees.prototype.findSlot = function(direction) {
    var _this = this, currentStart;

    this.direction = direction;
    this.firstStep = true;

    if (direction > 0) {
      this.findDate = this.forwardFindDate;
      this.adjustCurrentStart = this.forwardAdjustCurrentStart;
    }
    else {
      this.findDate = this.backwardFindDate;
      this.adjustCurrentStart = this.backwardAdjustCurrentStart;
    }

    if (this.component.isAllDay) {
      // Event lasts all day within limits
      this.start = this.component.start.clone();
      this.start.setHours(Attendees.dayStartHour);
      this.start.setMinutes(0);
      this.start.setSeconds(0);

      this.end = this.component.end.clone();
      this.end.setHours(Attendees.dayEndHour);
      this.end.setMinutes(0);
      this.end.setSeconds(0);

      this.startLimit = Attendees.dayStartHour * 4; // from user's defaults
      this.endLimit = Attendees.dayEndHour * 4; // from user's defaults

      this.duration = (Attendees.dayEndHour - Attendees.dayStartHour) * 4;
    }
    else {
      // Event can be outside limits
      this.start = this.component.start;
      this.end = this.component.end;

      this.startLimit = Attendees.timeToQuarters(this.slotStartTimeLimit); // from time picker
      this.endLimit = Attendees.timeToQuarters(this.slotEndTimeLimit); // from time picker

      this.duration = Math.ceil((this.end.getTime() - this.start.getTime()) / 900000);
    }

    currentStart = this.component.start.clone();
    currentStart.setHours(0, 0, 0, 0);

    if (this.workDaysOnly) {
      this.adjustCurrentStart(currentStart);
    }

    // Start a recursive search
    return this.step(currentStart).then(function (foundDate) {
      _this.component.start = new Date(foundDate.getTime());
      _this.component.end = new Date(_this.component.start.getTime());
      _this.component.end.addMinutes(_this.component.delta);
      _this.updateFreeBusyCoverage();
      return foundDate;
    }).catch(function (err) {
      _this.updateFreeBusy();
      throw err;
    });
  };

  /**
   * @function mergeFreebusy
   * @memberof Attendees.prototype
   * @desc Merge freebusy information of organizer and all attendees for a referene date.
   * @param {date) start - the reference date
   */
  Attendees.prototype.mergeFreebusy = function(start) {
    var _this = this;
    var startDay = start.getDayString();

    return this.updateFreeBusy(start).then(function () {
      var i, j, attendee, attendeeEntries;
      _this.currentEntries = _.flatMap(_this.component.organizer.freebusy[startDay]);
      for (i = 0; i < _this.component.attendees.length; i++) {
        attendee = _this.component.attendees[i];
        if (attendee.freebusy && attendee.role !== Attendees.ROLES.NON_PARTICIPANT) {
          attendeeEntries = _.flatMap(attendee.freebusy[startDay]);
          for (j = 0; j < _this.currentEntries.length; j++) {
            _this.currentEntries[j] += attendeeEntries[j];
          }
        }
      }
    });
  };

  /**
   * @function step
   * @memberof Attendees.prototype
   * @desc Recursively search for the next available slot, one day a the time.
   * @param {date) currentStart - the starting day
   */
  Attendees.prototype.step = function(currentStart, count) {
    var _this = this;
    if (!parseInt(count)) {
      count = 0;
    } else if (count >= 30) {
      return Attendees.$q.reject(l('There\'s no free slot available for all attendees in the next 30 days. Please try a different date or length.'));
    }
    // var currentStartDay = currentStart.getDayString();
    return this.mergeFreebusy(currentStart).then(function () {
      var foundDate = _this.findDate(currentStart);
      if (foundDate) {
        return foundDate;
      }
      else {
        currentStart.addDays(_this.direction > 0 ? 1 : -1);
        currentStart.setHours(0, 0, 0, 0);
        if (_this.workDaysOnly) {
          _this.adjustCurrentStart(currentStart);
        }
        return _this.step(currentStart, count + 1);
      }
    });
  };

})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @name Calendar
   * @constructor
   * @param {object} futureCalendarData - either an object literal or a promise
   */
  function Calendar(futureCalendarData) {
    // Data is immediately available
    this.init(futureCalendarData);
    if (this.name && !this.id) {
      // Create a new calendar on the server
      var newCalendarData = Calendar.$$resource.create('createFolder', this.name);
      this.$unwrap(newCalendarData);
    }
  }

  /**
   * @memberof Calendar
   * @desc The factory we'll use to register with Angular
   * @returns the Calendar constructor
   */
  Calendar.$factory = ['$q', '$timeout', '$log', 'sgSettings', 'Resource', 'Preferences', 'Component', 'Acl', function($q, $timeout, $log, Settings, Resource, Preferences, Component, Acl) {
    angular.extend(Calendar, {
      $q: $q,
      $timeout: $timeout,
      $log: $log,
      $$resource: new Resource(Settings.activeUser('folderURL') + 'Calendar', Settings.activeUser()),
      $Preferences: Preferences,
      $Component: Component,
      $$Acl: Acl,
      activeUser: Settings.activeUser(),
      $view: null
    });

    return Calendar; // return constructor
  }];

  /**
   * @module SOGo.SchedulerUI
   * @desc Factory registration of Calendar in Angular module.
   */
  try {
    angular.module('SOGo.SchedulerUI');
  }
  catch(e) {
    angular.module('SOGo.SchedulerUI', ['SOGo.Common']);
  }
  angular.module('SOGo.SchedulerUI')
    .value('CalendarSettings', {
      EventDragDayLength:          24 * 4,   // hour quarters
      EventDragHorizontalOffset:   3,        // pixels
      ConflictHTTPErrorCode:       409
    })
    .factory('Calendar', Calendar.$factory);

  /**
   * @memberof Calendar
   * @desc Return the default calendar id according to the user's defaults.
   * @returns a calendar id
   */
  Calendar.$defaultCalendar = function() {
    var defaultCalendar = Calendar.$Preferences.defaults.SOGoDefaultCalendar,
        calendar;

    if (defaultCalendar == 'first') {
      calendar = _.find(Calendar.$findAll(null, true), function(calendar) {
        return calendar.active;
      });
      if (calendar)
        return calendar.id;
    }

    return 'personal';
  };

  /**
   * @memberof Calendar
   * @desc Add a new calendar to the static list of calendars
   * @param {Calendar} calendar - an Calendar object instance
   */
  Calendar.$add = function(calendar) {
    // Insert new calendar at proper index
    var list, sibling;

    if (calendar.isWebCalendar)
      list = this.$webcalendars;
    else if (calendar.isSubscription)
      list = this.$subscriptions;
    else
      list = this.$calendars;

    sibling = _.findIndex(list, function(o, i) {
      return (calendar.id == 'personal' ||
              (o.id != 'personal' && o.name.localeCompare(calendar.name) > 0));
    });
    if (sibling < 0)
      list.push(calendar);
    else
      list.splice(sibling, 0, calendar);

    if (Calendar.$Preferences.settings.Calendar.FoldersOrder)
      // Save list order
      Calendar.saveFoldersOrder(_.flatMap(Calendar.$findAll(), 'id'));
    // Refresh list of calendars to fetch links associated to new calendar
    Calendar.$reloadAll();
  };

  /**
   * @memberof Calendar
   * @desc Set or get the list of calendars. Will instanciate a new Calendar object for each item.
   * @param {object[]} [data] - the metadata of the calendars
   * @param {bool} [writable] - if true, returns only the list of writable calendars
   * @returns the list of calendars
   */
  Calendar.$findAll = function(data, writable, contextId) {
    var _this = this;
    if (data) {
      this.$calendars = [];
      this.$subscriptions = [];
      this.$webcalendars = [];
      // Instanciate Calendar objects
      angular.forEach(data, function(o, i) {
        var calendar = new Calendar(o);
        if (calendar.isWebCalendar)
          _this.$webcalendars.push(calendar);
        else if (calendar.isSubscription)
          _this.$subscriptions.push(calendar);
        else
          _this.$calendars.push(calendar);
      });
    }
    else if (angular.isUndefined(this.$calendars)) {
      this.$calendars = [];
      this.$subscriptions = [];
      this.$webcalendars = [];
      return Calendar.$$resource.fetch('calendarslist').then(function(data) {
        return Calendar.$findAll(data.calendars, writable);
      });
    }

    if (writable) {
      return _.union(this.$calendars, _.filter(this.$subscriptions, function(calendar) {
        return calendar.isOwned || calendar.acls.objectCreator || calendar.id == contextId;
      }));
    }

    return _.union(this.$calendars, this.$subscriptions, this.$webcalendars);
  };

  /**
   * @memberof Calendar
   * @desc Reload the list of known calendars.
   */
  Calendar.$reloadAll = function() {
    var _this = this;

    Calendar.$$resource.fetch('calendarslist').then(function(data) {
      _.forEach(data.calendars, function(calendarData) {
        var group, calendar;

        if (calendarData.isWebCalendar)
          group = _this.$webcalendars;
        else if (calendarData.owner != Calendar.activeUser.login)
          group = _this.$subscriptions;
        else
          group = _this.$calendars;

        calendar = _.find(group, function(o) { return o.id == calendarData.id; });
        if (calendar)
          calendar.init(calendarData);
      });
    });
  };

  /**
   * @memberof Calendar
   * @desc Find a calendar among local instances (personal calendars, subscriptions and Web calendars).
   * @param {string} id - the calendar ID
   * @returns an object literal of the matching Calendar instance
   */
  Calendar.$get = function(id) {
    var calendar;

    calendar = _.find(Calendar.$calendars, function(o) { return o.id == id; });
    if (!calendar)
      calendar = _.find(Calendar.$subscriptions, function(o) { return o.id == id; });
    if (!calendar)
      calendar = _.find(Calendar.$webcalendars, function(o) { return o.id == id; });

    return calendar;
  };

  /**
   * @memberof Calendar
   * @desc Find a calendar among local instances (personal calendars, subscriptions and Web calendars).
   * @param {string} id - the calendar ID
   * @returns an object literal of the matching Calendar instance
   */
  Calendar.$getIndex = function(id) {
    var i;

    i = _.indexOf(_.map(Calendar.$calendars, 'id'), id);
    if (i < 0)
      i = _.indexOf(_.map(Calendar.$subscriptions, 'id'), id);
    if (i < 0)
      i = _.indexOf(_.map(Calendar.$webcalendars, 'id'), id);

    return i;
  };

  /**
   * @memberOf Calendar
   * @desc Subscribe to another user's calendar and add it to the list of calendars.
   * @param {string} uid - user id
   * @param {string} path - path of folder for specified user
   * @returns a promise of the HTTP query result
   */
  Calendar.$subscribe = function(uid, path) {
    var _this = this;
    return Calendar.$$resource.userResource(uid).fetch(path, 'subscribe').then(function(calendarData) {
      var calendar = new Calendar(angular.extend({ active: 1 }, calendarData));
      if (!_.find(_this.$subscriptions, function(o) {
        return o.id == calendarData.id;
      })) {
        Calendar.$add(calendar);
      }
      return calendar;
    });
  };

  /**
   * @memberOf Calendar
   * @desc Subscribe to a remote Web calendar
   * @param {string} url - URL of .ics file
   * @returns a promise of the HTTP query result
   */
  Calendar.$addWebCalendar = function(url) {
    var _this = this,
        d = Calendar.$q.defer();

    if (_.find(_this.$webcalendars, function(o) {
        return o.urls.webCalendarURL == url;
    })) {
      // Already subscribed
      d.reject();
    }
    else {
      Calendar.$$resource.post(null, 'addWebCalendar', { url: url }).then(function(calendarData) {
        angular.extend(calendarData, {
          isWebCalendar: true,
          isEditable: true,
          isRemote: false,
          owner: Calendar.activeUser.login,
          urls: { webCalendarURL: url }
        });
        var calendar = new Calendar(calendarData);
        Calendar.$$resource.fetch(calendar.id, 'reload').then(function(data) {
          // TODO: show a toast of the reload status
          Calendar.$log.debug(JSON.stringify(data, undefined, 2));
          Calendar.$add(calendar);
          d.resolve();
        }, function(response) {
          if (response.status == 401) {
            // Web calendar requires authentication
            d.resolve(calendar);
          }
          else {
            d.reject();
          }
        });
      }, d.reject);
    }

    return d.promise;
  };

  /**
   * @function reloadWebCalendars
   * @memberof Calendar
   * @desc Reload all Web calendars
   * @return a promise combining the results of all HTTP operations
   */
  Calendar.reloadWebCalendars = function() {
    var promises = [];

    _.forEach(this.$webcalendars, function(calendar) {
      var promise = Calendar.$$resource.fetch(calendar.id, 'reload');
      promise.then(function(data) {
        calendar.$error = false;
      }, function(response) {
        calendar.$error = l(response.statusText);
      });
      promises.push(promise);
    });

    return Calendar.$q.all(promises);
  };

  /**
   * @function $deleteComponents
   * @memberof Calendar
   * @desc Delete multiple components from calendar.
   * @return a promise of the HTTP operation
   */
  Calendar.$deleteComponents = function(components) {
    var _this = this, calendars = {}, promises = [];

    _.forEach(components, function(component) {
      if (!angular.isDefined(calendars[component.pid]))
        calendars[component.pid] = [];
      calendars[component.pid].push(component.id);
    });

    _.forEach(calendars, function(uids, pid) {
      promises.push(Calendar.$$resource.post(pid, 'batchDelete', {uids: uids}));
    });

    return Calendar.$q.all(promises);
  };

  /**
   * @function saveFoldersActivation
   * @memberof Calendar
   * @desc Save to the user's settings the activation state of the calendars
   * @param {string[]} folders - the folders IDs
   * @returns a promise of the HTTP operation
   */
  Calendar.saveFoldersActivation = function(ids) {
    var request = {};

    _.forEach(ids, function(id) {
      var calendar = Calendar.$get(id);
      request[calendar.id] = calendar.active;
    });

    return Calendar.$$resource.post(null, 'saveFoldersActivation', request);
  };

  /**
   * @function saveFoldersOrder
   * @desc Save to the user's settings the current calendars order.
   * @param {string[]} folders - the folders IDs
   * @returns a promise of the HTTP operation
   */
  Calendar.saveFoldersOrder = function(folders) {
    return this.$$resource.post(null, 'saveFoldersOrder', { folders: folders }).then(function() {
      Calendar.$Preferences.settings.Calendar.FoldersOrder = folders;
      if (!folders)
        // Calendars order was reset; reload list
        return Calendar.$$resource.fetch('calendarslist').then(function(data) {
          return Calendar.$findAll(data.calendars);
        });
    });
  };

  /**
   * @function init
   * @memberof Calendar.prototype
   * @desc Extend instance with new data and compute additional attributes.
   * @param {object} data - attributes of calendar
   */
  Calendar.prototype.init = function(data) {
    this.color = this.color || '#AAAAAA';
    this.active = 1;
    angular.extend(this, data);
    if (this.id) {
      this.$acl = new Calendar.$$Acl('Calendar/' + this.id);
    }
    // Add 'isOwned' and 'isSubscription' attributes based on active user (TODO: add it server-side?)
    this.isOwned = Calendar.activeUser.isSuperUser || this.owner == Calendar.activeUser.login;
    this.isSubscription = !this.isRemote && this.owner != Calendar.activeUser.login;
    if (angular.isUndefined(this.$shadowData) || !this.$shadowData.id) {
      // Make a copy of the data for an eventual reset
      this.$shadowData = this.$omit();
    }
  };

  /**
   * @function $id
   * @memberof Calendar.prototype
   * @desc Resolve the calendar id.
   * @returns a promise of the calendar id
   */
  Calendar.prototype.$id = function() {
    var _this = this;

    if (this.id) {
      // Object already unwrapped
      return Calendar.$q.when(this.id);
    }
    else {
      // Wait until object is unwrapped
      return this.$futureCalendarData.then(function(calendar) {
        if (calendar.id)
          return calendar.id;
        else
          return Calendar.$q.reject();
      });
    }
  };

  /**
   * @function getClassName
   * @memberof Calendar.prototype
   * @desc Return the calendar CSS class name based on its ID.
   * @returns a string representing the foreground CSS class name
   */
  Calendar.prototype.getClassName = function(base) {
    if (angular.isUndefined(base))
      base = 'fg';
    return base + '-folder' + this.id;
  };

  /**
   * @function $rename
   * @memberof Calendar.prototype
   * @desc Rename the calendar and keep the list sorted
   * @param {string} name - the new name
   * @returns a promise of the HTTP operation
   */
  Calendar.prototype.$rename = function() {
    var _this = this,
        i,
        calendars;

    if (this.name == this.$shadowData.name) {
      // Name hasn't changed
      return Calendar.$q.when();
    }

    if (this.isWebCalendar)
      calendars = Calendar.$webcalendars;
    else if (this.isSubscription)
      calendars = Calendar.$subscriptions;
    else
      calendars = Calendar.$calendars;

    i = _.indexOf(_.map(calendars, 'id'), this.id);
    if (i > -1) {
      return this.$save().then(function() {
        calendars.splice(i, 1);
        Calendar.$add(_this);
      });
    }
    else {
      return Calendar.$q.reject();
    }
  };

  /**
   * @function $delete
   * @memberof Calendar.prototype
   * @desc Delete the calendar from the server and the static list of calendars.
   * @returns a promise of the HTTP operation
   */
  Calendar.prototype.$delete = function() {
    var _this = this,
        list,
        promise;

    if (this.isSubscription) {
      promise = Calendar.$$resource.fetch(this.id, 'unsubscribe');
      list = Calendar.$subscriptions;
    }
    else {
      promise = Calendar.$$resource.remove(this.id);
      if (this.isWebCalendar)
        list = Calendar.$webcalendars;
      else
        list = Calendar.$calendars;
    }

    return promise.then(function() {
      var i = _.indexOf(_.map(list, 'id'), _this.id);
      list.splice(i, 1);
    });
  };

  /**
   * @function $reset
   * @memberof Calendar.prototype
   * @desc Reset the original state the calendar's data.
   */
  Calendar.prototype.$reset = function() {
    var _this = this;
    angular.forEach(this, function(value, key) {
      if (key != 'constructor' && key[0] != '$') {
        delete _this[key];
      }
    });
    angular.extend(this, this.$shadowData);
    this.$shadowData = this.$omit();
  };

  /**
   * @function $save
   * @memberof Calendar.prototype
   * @desc Save the calendar properties to the server.
   * @returns a promise of the HTTP operation
   */
  Calendar.prototype.$save = function() {
    var _this = this,
        d = Calendar.$q.defer();

    Calendar.$$resource.save(this.id, this.$omit()).then(function(data) {
      // Make a copy of the data for an eventual reset
      _this.$shadowData = _this.$omit();
      return d.resolve(data);
    }, function(data) {
      // Restore previous version
      _this.$reset();
      return d.reject(data);
    });

    return d.promise;
  };

  /**
   * @function setCredentials
   * @memberof Calendar.prototype
   * @desc Set the credentials for a Web calendar that requires authentication
   * @returns a promise of the HTTP operation
   */
  Calendar.prototype.setCredentials = function(username, password) {
    var _this = this,
        d = Calendar.$q.defer();

    Calendar.$$resource.post(this.id, 'set-credentials', { username: username, password: password }).then(function() {
      Calendar.$$resource.fetch(_this.id, 'reload').then(function(data) {
        Calendar.$add(_this);
        d.resolve();
      }, function(response) {
        if (response.status == 401) {
          // Authentication failed
          d.reject(l('Wrong username or password.'));
        }
        else {
          d.reject(response.statusText);
        }
      });
    }, d.reject);

    return d.promise;
  };

  /**
   * @function export
   * @memberof Calendar.prototype
   * @desc Export the calendar
   * @returns a promise of the HTTP operation
   */
  Calendar.prototype.export = function() {
    var options, resource, ownerPaths, realOwnerId, path, index;

    options = {
      type: 'application/octet-stream',
      filename: this.name + '.ics'
    };

    if (this.isSubscription) {
      index = this.urls.webDavICSURL.indexOf('/dav/');
      ownerPaths = this.urls.webDavICSURL.substring(index + 5).split(/\//);
      realOwnerId = ownerPaths[0];
      resource = Calendar.$$resource.userResource(realOwnerId);
      path = ownerPaths.splice(ownerPaths.length - 2).join('/');
    }
    else {
      resource = Calendar.$$resource;
      path = this.id + '.ics';
    }

    return resource.open(path, 'export', null, options);
  };

  /**
   * @function downloadProvisioningProfile
   * @memberof Calendar.prototype
   * @desc Download provisioning profile for Apple's devices
   * @returns a promise of the HTTP operation
   */
  Calendar.prototype.downloadProvisioningProfile = function () {
    var options, resource, index, ownerPaths, realOwnerId, path;

    options = {
      type: 'application/octet-stream',
      filename: 'calendar.mobileconfig'
    }

    if (this.isSubscription) {
      index = this.urls.webDavICSURL.indexOf('/dav/');
      ownerPaths = this.urls.webDavICSURL.substring(index + 5).split(/\//);
      realOwnerId = ownerPaths[0];
      resource = Calendar.$$resource.userResource(realOwnerId);
      path = 'Calendar';
    } else {
      resource = Calendar.$$resource;
      path = '';
    }

    return resource.open(path, 'mobileconfig', null, options);
  };

  /**
   * @function $setActivation
   * @memberof Calendar.prototype
   * @desc Either activate or deactivate the calendar.
   * @returns a promise of the HTTP operation
   */
  Calendar.prototype.$setActivation = function() {
    return Calendar.$$resource.fetch(this.id, (this.active?'':'de') + 'activateFolder');
  };

  /**
   * @function $getComponent
   * @memberof Calendar.prototype
   * @desc Fetch a component attributes from the server.
   * @returns a promise of the HTTP operation
   */
  Calendar.prototype.$getComponent = function(componentId, recurrenceId) {
    return Calendar.$Component.$find(this.id, componentId, recurrenceId);
  };

  /**
   * @function $unwrap
   * @memberof Calendar.prototype
   * @desc Unwrap a promise
   * @param {promise} futureCalendarData - a promise of the Calendar's data
   */
  Calendar.prototype.$unwrap = function(futureCalendarData) {
    var _this = this;

    // Expose and resolve the promise
    this.$futureCalendarData = futureCalendarData.then(function(data) {
      return Calendar.$timeout(function() {
        // Extend Calendar instance with received data
        _this.init(data);
        return _this;
      });
    }, function(data) {
      _this.isError = true;
      if (angular.isObject(data)) {
        Calendar.$timeout(function() {
          angular.extend(_this, data);
        });
      }
    });
  };

  /**
   * @function $omit
   * @memberof Calendar.prototype
   * @desc Return a sanitized object used to send to the server.
   * @return an object literal copy of the Calendar instance
   */
  Calendar.prototype.$omit = function() {
    var calendar = {};
    angular.forEach(this, function(value, key) {
      if (key != 'constructor' &&
          key[0] != '$') {
        calendar[key] = angular.copy(value);
      }
    });
    return calendar;
  };
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @name Component
   * @constructor
   * @param {object} futureComponentData - either an object literal or a promise
   */
  function Component(futureComponentData) {
    // Data is immediately available
    if (typeof futureComponentData.then !== 'function') {
      this.init(futureComponentData);
      if (this.pid && !this.id) {
        // Prepare for the creation of a new component;
        // Get UID from the server.
        var newComponentData = Component.$$resource.newguid(this.pid);
        this.$unwrap(newComponentData);
        this.isNew = true;
      }
    }
    else {
      // The promise will be unwrapped first
      this.$unwrap(futureComponentData);
    }
  }

  /**
   * @memberof Component
   * @desc The factory we'll use to register with Angular
   * @returns the Component constructor
   */
  Component.$factory = ['$q', '$timeout', '$log', '$rootScope', 'sgSettings', 'sgComponent_STATUS', 'Attendees', 'Preferences', 'User', 'Card', 'Resource', function($q, $timeout, $log, $rootScope, Settings, Component_STATUS, Attendees, Preferences, User, Card, Resource) {
    angular.extend(Component, {
      STATUS: Component_STATUS,
      $q: $q,
      $timeout: $timeout,
      $log: $log,
      $rootScope: $rootScope,
      $settings: Settings,
      $User: User,
      $Preferences: Preferences,
      $Attendees: Attendees,
      $Card: Card,
      $$resource: new Resource(Settings.activeUser('folderURL') + 'Calendar', Settings.activeUser()),
      timeFormat: "%H:%M",
      // Filter parameters common to events and tasks
      $query: { value: '', search: 'title_Category_Location' },
      // Filter paramaters specific to events
      $queryEvents: { sort: 'start', asc: 1, filterpopup: 'view_next7' },
      // Filter parameters specific to tasks
      $queryTasks: { sort: 'status', asc: 1, filterpopup: 'view_incomplete' },
      $refreshTimeout: null,
      $ghost: {}
    });
    // Initialize filter parameters from user's settings
    if (Preferences.settings.Calendar.EventsFilterState)
      Component.$queryEvents.filterpopup = Preferences.settings.Calendar.EventsFilterState;
    if (Preferences.settings.Calendar.TasksFilterState)
      Component.$queryTasks.filterpopup = Preferences.settings.Calendar.TasksFilterState;
    if (Preferences.settings.Calendar.EventsSortingState) {
      Component.$queryEvents.sort = Preferences.settings.Calendar.EventsSortingState[0];
      Component.$queryEvents.asc = parseInt(Preferences.settings.Calendar.EventsSortingState[1]);
    }
    if (Preferences.settings.Calendar.TasksSortingState) {
      Component.$queryTasks.sort = Preferences.settings.Calendar.TasksSortingState[0];
      Component.$queryTasks.asc = parseInt(Preferences.settings.Calendar.TasksSortingState[1]);
    }
    Component.$queryTasks.show_completed = parseInt(Preferences.settings.ShowCompletedTasks);
    // Initialize categories from user's defaults
    Component.$categories = Preferences.defaults.SOGoCalendarCategoriesColors;
    // Initialize time format from user's defaults
    if (Preferences.defaults.SOGoTimeFormat) {
      Component.timeFormat = Preferences.defaults.SOGoTimeFormat;
    }

    return Component; // return constructor
  }];

  /**
   * @module SOGo.SchedulerUI
   * @desc Factory registration of Component in Angular module.
   */
  try {
    angular.module('SOGo.SchedulerUI');
  }
  catch(e) {
    angular.module('SOGo.SchedulerUI', ['SOGo.Common']);
  }
  angular.module('SOGo.SchedulerUI')
    .constant('sgComponent_STATUS', {
      NOT_LOADED:      0,
      DELAYED_LOADING: 1,
      LOADING:         2,
      LOADED:          3,
      DELAYED_MS:      300
    })
    .factory('Component', Component.$factory);

  /**
   * @function $selectedCount
   * @memberof Component
   * @desc Return the number of events or tasks selected by the user.
   * @returns the number of selected events or tasks
   */
  Component.$selectedCount = function() {
    var count;

    count = 0;
    if (Component.$events) {
      count += (_.filter(Component.$events, function(event) { return event.selected; })).length;
    }
    if (Component.$tasks) {
      count += (_.filter(Component.$tasks, function(task) { return task.selected; })).length;
    }
    return count;
  };

  /**
   * @function $startRefreshTimeout
   * @memberof Component
   * @desc Starts the refresh timeout for the current selected list (events or tasks) and
   * current view.
   */
  Component.$startRefreshTimeout = function(type) {
    if (Component.$refreshTimeout)
      Component.$timeout.cancel(Component.$refreshTimeout);

    // Restart the refresh timer, if needed
    var refreshViewCheck = Component.$Preferences.defaults.SOGoRefreshViewCheck;
    if (refreshViewCheck && refreshViewCheck != 'manually') {
      var f = angular.bind(Component.$rootScope, Component.$rootScope.$emit, 'calendars:list');
      Component.$refreshTimeout = Component.$timeout(f, refreshViewCheck.timeInterval()*1000);
    }
  };

  /**
   * @function $isLoading
   * @memberof Component
   * @returns true if the components list is still being retrieved from server after a specific delay
   * @see sgMessage_STATUS
   */
  Component.$isLoading = function() {
    return Component.$loaded == Component.STATUS.LOADING;
  };

  /**
   * @function $filter
   * @memberof Component
   * @desc Search for components matching some criterias
   * @param {string} type - either 'events' or 'tasks'
   * @param {object} [options] - additional options to the query
   * @returns a collection of Components instances
   */
  Component.$filter = function(type, options) {
    var _this = this,
        now = new Date(),
        day = now.getDate(),
        month = now.getMonth() + 1,
        year = now.getFullYear(),
        queryKey = '$query' + type.capitalize(),
        params = {
          day: '' + year + (month < 10?'0':'') + month + (day < 10?'0':'') + day,
        },
        futureComponentData,
        dirty = false,
        otherType;

    Component.$startRefreshTimeout(type);

    angular.extend(this.$query, params);

    if (options) {
      _.forEach(_.keys(options), function(key) {
        // Query parameters common to events and tasks are compared
        dirty |= (_this.$query[key] && options[key] != Component.$query[key]);
        if (key == 'reload' && options[key])
          dirty = true;
        // Update either the common parameters or the type-specific parameters
        else if (angular.isDefined(_this.$query[key]))
          _this.$query[key] = options[key];
        else
          _this[queryKey][key] = options[key];
      });
    }

    // Perform query with both common and type-specific parameters
    futureComponentData = this.$$resource.fetch(null, type + 'list',
                                                angular.extend(this[queryKey], this.$query));

    // Invalidate cached results of other type if $query has changed
    if (dirty) {
      otherType = (type == 'tasks')? '$events' : '$tasks';
      delete Component[otherType];
      Component.$log.debug('force reload of ' + otherType);
    }

    return this.$unwrapCollection(type, futureComponentData);
  };

  /**
   * @function $find
   * @desc Fetch a component from a specific calendar.
   * @param {string} calendarId - the calendar ID
   * @param {string} componentId - the component ID
   * @param {string} [occurrenceId] - the component ID
   * @see {@link Calendar.$getComponent}
   */
  Component.$find = function(calendarId, componentId, occurrenceId) {
    var futureComponentData, path = [calendarId, componentId];

    if (occurrenceId)
      path.push(occurrenceId);

    futureComponentData = this.$$resource.fetch(path, 'view');

    return new Component(futureComponentData);
  };

  /**
   * @function filterCategories
   * @desc Search for categories matching some criterias
   * @param {string} search - the search string to match
   * @returns a collection of strings
   */
  Component.filterCategories = function(query) {
    var re = new RegExp(query, 'i');
    return _.filter(_.keys(Component.$categories), function(category) {
      return category.search(re) != -1;
    });
  };

  /**
   * @function saveSelectedList
   * @desc Save to the user's settings the currently selected list.
   * @param {string} componentType - either "events" or "tasks"
   * @returns a promise of the HTTP operation
   */
  Component.saveSelectedList = function(componentType) {
    return this.$$resource.post(null, 'saveSelectedList', { list: componentType + 'ListView' });
  };

  /**
   * @function $eventsBlocksForView
   * @desc Events blocks for a specific week
   * @param {string} view - Either 'day' or 'week'
   * @param {Date} type - Date of any day of the desired period
   * @returns a promise of a collection of objects describing the events blocks
   */
  Component.$eventsBlocksForView = function(view, date) {
    var firstDayOfWeek, viewAction, startDate, endDate, params;

    firstDayOfWeek = Component.$Preferences.defaults.SOGoFirstDayOfWeek;
    if (view == 'day') {
      viewAction = 'dayView';
      startDate = endDate = date;
    }
    else if (view == 'multicolumnday') {
      viewAction = 'multicolumndayView';
      startDate = endDate = date;
    }
    else if (view == 'week') {
      viewAction = 'weekView';
      startDate = date.beginOfWeek(firstDayOfWeek);
      endDate = new Date();
      endDate.setTime(startDate.getTime());
      endDate.addDays(6);
    }
    else if (view == 'month') {
      viewAction = 'monthView';
      startDate = date;
      startDate.setDate(1);
      startDate = startDate.beginOfWeek(firstDayOfWeek);
      endDate = new Date();
      endDate.setTime(date.getTime());
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.addDays(-1);
      endDate = endDate.endOfWeek(firstDayOfWeek);
    }
    return this.$eventsBlocks(viewAction, startDate, endDate);
  };

  /**
   * @function $eventsBlocks
   * @desc Events blocks for a specific view and period
   * @param {string} view - Either 'day', 'multicolumnday', 'week' or 'month'
   * @param {Date} startDate - period's start date
   * @param {Date} endDate - period's end date
   * @returns a promise of a collection of objects describing the events blocks
   */
  Component.$eventsBlocks = function(view, startDate, endDate) {
    var params, futureComponentData, i, j, dayDates = [], dayNumbers = [],
        deferred = Component.$q.defer();

    params = { view: view.toLowerCase(), sd: startDate.getDayString(), ed: endDate.getDayString() };
    futureComponentData = this.$$resource.fetch(null, 'eventsblocks', params);
    futureComponentData.then(function(views) {
      var reduceComponent, associateComponent;

      reduceComponent = function(objects, eventData, i) {
        var componentData = _.zipObject(this.eventsFields, eventData),
            start = new Date(componentData.c_startdate * 1000),
            component;
        componentData.hour = start.getHourString();
        componentData.blocks = [];
        component = new Component(componentData);
        objects.push(component);
        return objects;
      };

      associateComponent = function(block) {
        this[block.nbr].blocks.push(block); // Associate block to component
        block.component = this[block.nbr];  // Associate component to block
        block.isFirst = (this[block.nbr].blocks.length == 1);
      };

      Component.$views = [];
      Component.$timeout(function() {
        _.forEach(views, function(data, viewIndex) {
          var components = [], blocks = {}, allDayBlocks = {}, viewData;

          // Change some attributes names
          data.eventsFields.splice(_.indexOf(data.eventsFields, 'c_folder'),        1, 'pid');
          data.eventsFields.splice(_.indexOf(data.eventsFields, 'c_name'),          1, 'id');
          data.eventsFields.splice(_.indexOf(data.eventsFields, 'c_recurrence_id'), 1, 'occurrenceId');
          data.eventsFields.splice(_.indexOf(data.eventsFields, 'c_title'),         1, 'summary');

          // Instantiate Component objects
          _.reduce(data.events, _.bind(reduceComponent, data), components);

          // Associate Component objects to blocks positions
          _.forEach(_.flatten(data.blocks), _.bind(associateComponent, components));

          // Associate Component objects to all-day blocks positions
          _.forEach(_.flatten(data.allDayBlocks), _.bind(associateComponent, components));

          // Build array of dates
          if (dayDates.length === 0) {
            dayDates = _.flatMap(data.days, 'date');
            dayNumbers = _.flatMap(data.days, 'number');
          }

          // Convert array of blocks to an object literal with date strings as keys
          for (i = 0; i < data.blocks.length; i++) {
            for (j = 0; j < data.blocks[i].length; j++) {
              data.blocks[i][j].dayIndex = i + (viewIndex * data.blocks.length);
              data.blocks[i][j].dayNumber = dayNumbers[i];
            }
            blocks[dayDates[i]] = data.blocks[i];
          }

          // Convert array of all-day blocks to object with days as keys
          for (i = 0; i < data.allDayBlocks.length; i++) {
            for (j = 0; j < data.allDayBlocks[i].length; j++) {
              data.allDayBlocks[i][j].dayIndex = i + (viewIndex * data.allDayBlocks.length);
              data.allDayBlocks[i][j].dayNumber = dayNumbers[i];
            }
            allDayBlocks[dayDates[i]] = data.allDayBlocks[i];
          }

          // "blocks" is now an object literal with the following structure:
          // { day: [
          //    { start: number,
          //      length: number,
          //      siblings: number,
          //      realSiblings: number,
          //      position: number,
          //      nbr: number,
          //      component: Component },
          //    .. ],
          //  .. }
          //
          // Where day is a string with format YYYYMMDD

          Component.$log.debug('blocks ready (' + _.flatten(data.blocks).length + ')');
          Component.$log.debug('all day blocks ready (' + _.flatten(data.allDayBlocks).length + ')');

          // Save the blocks to the object model
          viewData = { blocks: blocks, allDayBlocks: allDayBlocks };
          if (data.id && data.calendarName) {
            // The multicolumnday view also includes calendar information
            viewData.id = data.id;
            viewData.calendarName = data.calendarName;
          }
          Component.$views.push(viewData);
        });

        deferred.resolve(Component.$views);
      });
    }, deferred.reject);

    return deferred.promise;
  };

  /**
   * @function $unwrapCollection
   * @desc Unwrap a promise and instanciate new Component objects using received data.
   * @param {string} type - either 'events' or 'tasks'
   * @param {promise} futureComponentData - a promise of the components' metadata
   * @returns a promise of the HTTP operation
   */
  Component.$unwrapCollection = function(type, futureComponentData) {
    var _this = this,
        components = [];

    // Components list is not loaded yet
    Component.$loaded = Component.STATUS.DELAYED_LOADING;
    Component.$timeout(function() {
      if (Component.$loaded != Component.STATUS.LOADED)
        Component.$loaded = Component.STATUS.LOADING;
    }, Component.STATUS.DELAYED_MS);

    return futureComponentData.then(function(data) {
      return Component.$timeout(function() {
        var fields = _.invokeMap(data.fields, 'toLowerCase');
          fields.splice(_.indexOf(fields, 'c_folder'), 1, 'pid');
          fields.splice(_.indexOf(fields, 'c_name'), 1, 'id');
          fields.splice(_.indexOf(fields, 'c_recurrence_id'), 1, 'occurrenceId');

        // Instanciate Component objects

        if (type == 'events') {
          _.forEach(data[type], function(monthData, month) {
            _.forEach(monthData.days, function(dayData, day) {
              _.forEach(dayData.events, function(componentData, i) {
                var data = _.zipObject(fields, componentData), component;
                component = new Component(data);
                dayData.events[i] = component;
              });
            });
          });
          components = data[type];
        }
        else if (type == 'tasks') {
          _.reduce(data[type], function(components, componentData, i) {
            var data = _.zipObject(fields, componentData), component;
            component = new Component(data);
            components.push(component);
            return components;
          }, components);
        }

        Component.$log.debug('list of ' + type + ' ready (' + _.size(components) + ')');

        // Save the list of components to the object model
        Component['$' + type] = components;

        Component.$loaded = Component.STATUS.LOADED;

        return components;
      });
    });
  };

  /**
   * @function $resetGhost
   * @desc Prepare the ghost object for the next drag by resetting appropriate attributes
   */
  Component.$resetGhost = function() {
    this.$ghost.pointerHandler = null;
    this.$ghost.component = null;
    this.$ghost.startHour = null;
    this.$ghost.endHour = null;
  };

  /**
   * @function $parseDate
   * @desc Parse a date string with format YYYY-MM-DDTHH:MM
   * @param {string} dateString - the string representing the date
   * @param {object} [options] - additional options (use {no_time: true} to ignore the time)
   * @returns a date object
   */
  Component.$parseDate = function(dateString, options) {
    var date, time;

    date = dateString.substring(0,10).split('-');

    if (options && options.no_time)
      return new Date(parseInt(date[0]), parseInt(date[1]) - 1, parseInt(date[2]));

    time = dateString.substring(11,16).split(':');

    return new Date(parseInt(date[0]), parseInt(date[1]) - 1, parseInt(date[2]),
                    parseInt(time[0]), parseInt(time[1]), 0, 0);
  };

  /**
   * @function init
   * @memberof Component.prototype
   * @desc Extend instance with required attributes and new data.
   * @param {object} data - attributes of component
   */
  Component.prototype.init = function(data) {
    var _this = this;

    this.categories = [];
    this.repeat = {};
    this.alarm = { action: 'display', quantity: 5, unit: 'MINUTES', reference: 'BEFORE', relation: 'START' };
    this.status = 'not-specified';
    this.delta = 60;
    angular.extend(this, data);

    if (this.component == 'vevent')
      this.type = 'appointment';
    else if (this.component == 'vtodo')
      this.type = 'task';

    if (this.startDate) {
      if (angular.isString(this.startDate))
        // Ex: 2015-10-25T22:34:51+00:00
        this.start = Component.$parseDate(this.startDate);
      else
        // Date object
        this.start = this.startDate;
    }
    else if (this.type == 'appointment') {
      this.start = new Date();
      this.start.setMinutes(Math.round(this.start.getMinutes()/15)*15);
    }

    if (this.endDate) {
      this.end = Component.$parseDate(this.endDate);
      this.delta = this.start.minutesTo(this.end);
    }
    else if (this.type == 'appointment') {
      this.setDelta(this.delta);
    }

    if (this.dueDate)
      this.due = Component.$parseDate(this.dueDate);

    if (this.completedDate)
      this.completed = Component.$parseDate(this.completedDate);
    else if (this.type == 'task')
      this.completed = new Date();

    if (this.c_category) {
      // c_category is only defined in list mode (when calling $filter)
      // Filter out categories for which there's no associated color
      this.categories = _.invokeMap(_.filter(this.c_category, function(name) {
        return Component.$Preferences.defaults.SOGoCalendarCategoriesColors[name];
      }), 'asCSSIdentifier');
    }

    // Parse recurrence rule definition and initialize default values
    this.$isRecurrent = angular.isDefined(data.repeat);
    if (this.repeat.days) {
      var byDayMask = _.find(this.repeat.days, function(o) {
        return angular.isDefined(o.occurrence);
      });
      if (byDayMask) {
        if (this.repeat.frequency == 'yearly')
          this.repeat.year = { byday: true };
        this.repeat.month = {
          type: 'byday',
          occurrence: byDayMask.occurrence.toString(),
          day: byDayMask.day
        };
      }
    }
    else {
      this.repeat.days = [];
    }
    if (this.repeat.dates) {
      this.repeat.frequency = 'custom';
      _.forEach(this.repeat.dates, function(rdate, i, rdates) {
        if (angular.isString(rdate))
          // Ex: 2015-10-25T22:34:51+00:00
          rdates[i] = Component.$parseDate(rdate);
      });
    }
    else if (angular.isUndefined(this.repeat.frequency))
      this.repeat.frequency = 'never';
    if (angular.isUndefined(this.repeat.interval))
      this.repeat.interval = 1;
    if (angular.isUndefined(this.repeat.monthdays))
      // TODO: initialize this.repeat.monthdays with month day of start date
      this.repeat.monthdays = [];
    else if (this.repeat.monthdays.length > 0)
      this.repeat.month = { type: 'bymonthday' };
    if (angular.isUndefined(this.repeat.month))
      this.repeat.month = {};
    if (angular.isUndefined(this.repeat.month.occurrence))
      angular.extend(this.repeat.month, { occurrence: '1', day: 'SU' });
    if (angular.isUndefined(this.repeat.months))
      // TODO: initialize this.repeat.months with month of start date
      this.repeat.months = [];
    if (angular.isUndefined(this.repeat.year))
      this.repeat.year = {};
    if (this.repeat.count)
      this.repeat.end = 'count';
    else if (this.repeat.until) {
      this.repeat.end = 'until';
      if (angular.isString(this.repeat.until))
        this.repeat.until = Component.$parseDate(this.repeat.until, { no_time: true });
    }
    else
      this.repeat.end = 'never';
    this.$hasCustomRepeat = this.hasCustomRepeat();

    var type = (this.type == 'appointment')? 'Events' : 'Tasks';
    if (this.isNew) {
      // Set default values

      // Set default classification
      this.classification = Component.$Preferences.defaults['SOGoCalendar' + type + 'DefaultClassification'].toLowerCase();

      // Set default alarm
      var units = { M: 'MINUTES', H: 'HOURS', D: 'DAYS', W: 'WEEKS' };
      var match = /-PT?([0-9]+)([MHDW])/.exec(Component.$Preferences.defaults.SOGoCalendarDefaultReminder);
      if (match) {
        this.$hasAlarm = true;
        this.alarm.quantity = parseInt(match[1]);
        this.alarm.unit = units[match[2]];
      }

      // Set notitifications
      this.sendAppointmentNotifications = Component.$Preferences.defaults.SOGoAppointmentSendEMailNotifications;
    }
    else {
      if (angular.isUndefined(data.$hasAlarm)) {
        this.$hasAlarm = angular.isDefined(data.alarm);
      }
      if (angular.isUndefined(data.classification)) {
        this.classification = Component.$Preferences.defaults['SOGoCalendar' + type + 'DefaultClassification'].toLowerCase();
      }
    }

    // Allow the component to be moved to a different calendar
    this.destinationCalendar = this.pid;

    // if (this.organizer && this.organizer.email) {
    //   this.organizer.$image = Component.$gravatar(this.organizer.email, 32);
    // }

    this.selected = false;
  };

  /**
   * @function init
   * @memberof Component.prototype
   * @desc Extend instance with required attributes and new data.
   * @param {object} data - attributes of component
   */
  Component.prototype.initAttendees = function() {
    this.$attendees = new Component.$Attendees(this);
  };


  /**
   * @function hasCustomRepeat
   * @memberof Component.prototype
   * @desc Check if the component has a custom recurrence rule.
   * @returns true if the recurrence rule requires the full recurrence editor
   */
  Component.prototype.hasCustomRepeat = function() {
    var b = angular.isUndefined(this.occurrenceId) &&
        angular.isDefined(this.repeat) &&
        (this.repeat.interval > 1 ||
         angular.isDefined(this.repeat.days) && this.repeat.days.length > 0 ||
         angular.isDefined(this.repeat.monthdays) && this.repeat.monthdays.length > 0 ||
         angular.isDefined(this.repeat.months) && this.repeat.months.length > 0 ||
         angular.isDefined(this.repeat.month) && angular.isDefined(this.repeat.month.type) ||
         angular.isDefined(this.repeat.dates) && this.repeat.dates.length > 0);
    return b;
  };

  /**
   * @function isEditable
   * @memberof Component.prototype
   * @desc Check if the component is editable and not an occurrence of a recurrent component
   * @returns true or false
   */
  Component.prototype.isActionable = function() {
    return (!this.occurrenceId && !this.userHasRSVP && (this.isEditable || this.isErasable));
  };

  /**
   * @function isEditableOccurrence
   * @memberof Component.prototype
   * @desc Check if the component is editable and an occurrence of a recurrent component
   * @returns true or false
   */
  Component.prototype.isActionableOccurrence = function() {
    return (this.occurrenceId && !this.userHasRSVP && (this.isEditable || this.isErasable));
  };

  /**
   * @function isInvitation
   * @memberof Component.prototype
   * @desc Check if the component an invitation and not an occurrence of a recurrent component
   * @returns true or false
   */
  Component.prototype.isInvitation = function() {
    return (!this.occurrenceId && this.userHasRSVP);
  };

  /**
   * @function isInvitationOccurrence
   * @memberof Component.prototype
   * @desc Check if the component is an invitation and an occurrence of a recurrent component
   * @returns true or false
   */
  Component.prototype.isInvitationOccurrence = function() {
    return (this.occurrenceId && this.userHasRSVP);
  };

  /**
   * @function showPercentComplete
   * @memberof Component.prototype
   * @desc Check if the percent completion should be displayed with respect to the
   *       component's type and status.
   * @returns true if the percent completion should be displayed
   */
  Component.prototype.showPercentComplete = function() {
    return (this.type == 'task' &&
            this.percentComplete > 0 &&
            this.status != 'cancelled');
  };

  /**
   * @function enablePercentComplete
   * @memberof Component.prototype
   * @desc Check if the percent completion should be enabled with respect to the
   *       component's type and status.
   * @returns true if the percent completion should be displayed
   */
  Component.prototype.enablePercentComplete = function() {
    return (this.type == 'task' &&
            this.status != 'not-specified' &&
            this.status != 'cancelled');
  };

  /**
   * @function markAsCompleted
   * @memberof Component.prototype
   * @desc Mark the task as completed.
   * @returns a promise of the HTTP operation
   */
  Component.prototype.markAsCompleted = function() {
    var _this = this, dlp;
    if (this.type == 'task') {
      dlp = Component.$Preferences.$mdDateLocaleProvider;
      this.percentComplete = 100;
      this.completed = new Date();
      this.completed.$dateFormat = Component.$Preferences.defaults.SOGoLongDateFormat;
      this.status = 'completed';
      this.localizedCompletedDate = dlp.formatDate(this.completed);
      this.localizedCompletedTime = dlp.formatTime(this.completed);
      return this.$save().catch(function() {
        _this.$reset();
      });
    }
    else {
      return Component.$q.reject('Only tasks can be mark as completed');
    }
  };

  /**
   * @function setDelta
   * @memberof Component.prototype
   * @desc Set the end time to the specified number of minutes after the start time.
   * @param {number} delta - the number of minutes
   */
  Component.prototype.setDelta = function(delta) {
    if (delta < 0) {
      var start = new Date(this.start.getTime());
      start.setMinutes(Math.round(start.getMinutes()/15)*15);
      start.addMinutes(delta);
      this.start = start;
      delta *= -1;
    }
    this.delta = delta;
    this.end = new Date(this.start.getTime());
    this.end.setMinutes(Math.round(this.end.getMinutes()/15)*15);
    this.end.addMinutes(this.delta);
  };

  /**
   * @function getClassName
   * @memberof Component.prototype
   * @desc Return the component CSS class name based on its container (calendar) ID.
   * @param {string} [base] - the prefix to add to the class name (defaults to "fg")
   * @returns a string representing the foreground CSS class name
   */
  Component.prototype.getClassName = function(base) {
    if (angular.isUndefined(base))
      base = 'fg';
    return base + '-folder' + (this.destinationCalendar || this.c_folder || this.pid);
  };

  /**
   * @function canRemindAttendeesByEmail
   * @memberof Component.prototype
   * @desc Verify if the component's reminder must be send by email and if it has at least one attendee.
   * @returns true if attendees can receive a reminder by email
   */
  Component.prototype.canRemindAttendeesByEmail = function() {
    return this.alarm.action == 'email' &&
      this.attendees && this.attendees.length > 0;
  };

  /**
   * @function addAttachUrl
   * @memberof Component.prototype
   * @desc Add a new attach URL if not already defined
   * @param {string} attachUrl - the URL
   * @returns the number of values in the list of attach URLs
   */
  Component.prototype.addAttachUrl = function(attachUrl) {
    if (angular.isUndefined(this.attachUrls)) {
      this.attachUrls = [{value: attachUrl}];
    }
    else {
      for (var i = 0; i < this.attachUrls.length; i++) {
        if (this.attachUrls[i].value == attachUrl) {
          break;
        }
      }
      if (i == this.attachUrls.length)
        this.attachUrls.push({value: attachUrl});
    }
    return this.attachUrls.length - 1;
  };

  /**
   * @function deleteAttachUrl
   * @memberof Component.prototype
   * @desc Remove an attach URL
   * @param {number} index - the URL index in the list of attach URLs
   */
  Component.prototype.deleteAttachUrl = function(index) {

    if (index > -1 && this.attachUrls.length > index) {
      this.attachUrls.splice(index, 1);
    }
  };

  /**
   * @function hasJitsiUrl
   * @memberof Component.prototype
   * @desc Check if the there is a jitsi url
   * @returns true if there is a jitsi url
   */
  Component.prototype.hasJitsiUrl = function() {
    if (angular.isUndefined(this.attachUrls)) {
      return false;
    }
    else {
      var jitsiBaseUrl = "https://meet.jit.si";
      if(Component.$Preferences.defaults && Component.$Preferences.defaults.SOGoCalendarJitsiBaseUrl)
        jitsiBaseUrl = Component.$Preferences.defaults.SOGoCalendarJitsiBaseUrl;
      for (var i = 0; i < this.attachUrls.length; i++) {
        if (this.attachUrls[i].value.includes(jitsiBaseUrl)) {
          return true;
        }
      }
    }

    return false;
  };

  /**
   * @function $addDueDate
   * @memberof Component.prototype
   * @desc Add a due date
   */
  Component.prototype.$addDueDate = function() {
    this.due = new Date();
    this.due.setMinutes(Math.round(this.due.getMinutes()/15)*15);
    this.dueDate = this.due.toISOString();
  };

  /**
   * @function $deleteDueDate
   * @memberof Component.prototype
   * @desc Delete a due date
   */
  Component.prototype.$deleteDueDate = function() {
    delete this.due;
    delete this.dueDate;
  };

  /**
   * @function $addStartDate
   * @memberof Component.prototype
   * @desc Add a start date
   */
  Component.prototype.$addStartDate = function() {
    this.start = new Date();
    this.start.setMinutes(Math.round(this.start.getMinutes()/15)*15);
  };

  /**
   * @function $deleteStartDate
   * @memberof Component.prototype
   * @desc Delete a start date
   */
  Component.prototype.$deleteStartDate = function() {
    delete this.start;
    delete this.startDate;
  };

  /**
   * @function $addRecurrenceDate
   * @memberof Component.prototype
   * @desc Add a start date
   */
  Component.prototype.$addRecurrenceDate = function() {
    var now = new Date();
    now.setMinutes(Math.round(now.getMinutes()/15)*15);

    if (angular.isUndefined(this.repeat.dates))
      this.repeat = { frequency: 'custom', dates: [] };
    this.repeat.dates.push(now);
  };

  /**
   * @function $deleteRecurrenceDate
   * @memberof Component.prototype
   * @desc Delete a recurrence date
   */
  Component.prototype.$deleteRecurrenceDate = function(index) {
    if (index > -1 && this.repeat && this.repeat.dates && this.repeat.dates.length > index) {
      this.repeat.dates.splice(index, 1);
    }
  };

  /**
   * @function $reset
   * @memberof Component.prototype
   * @desc Reset the original state the component's data.
   */
  Component.prototype.$reset = function() {
    var _this = this;
    angular.forEach(this, function(value, key) {
      if (key != 'constructor' && key[0] != '$') {
        delete _this[key];
      }
    });
    this.init(this.$shadowData);
    this.$shadowData = this.$omit();
  };

  /**
   * @function $reply
   * @memberof Component.prototype
   * @desc Reply to an invitation.
   * @returns a promise of the HTTP operation
   */
  Component.prototype.$reply = function() {
    var _this = this, data, path = [this.pid, this.id];

    if (this.occurrenceId)
      path.push(this.occurrenceId);

    data = {
      reply: this.reply,
      delegatedTo: this.delegatedTo,
      alarm: this.$hasAlarm? this.alarm : {},
      classification: this.classification
    };

    return Component.$$resource.save(path, data, { action: 'rsvpAppointment' })
      .then(function(data) {
        // Make a copy of the data for an eventual reset
        _this.$shadowData = _this.$omit();
        return data;
      });
  };

  /**
   * @function $adjust
   * @memberof Component.prototype
   * @desc Adjust the start, day, and/or duration of the component
   * @returns a promise of the HTTP operation
   */
  Component.prototype.$adjust = function(params) {
    var path = [this.pid, this.id];

    if (_.every(_.values(params), function(v) { return v === 0; }))
      // No changes
      return Component.$q.when();

    if (this.occurrenceId)
      path.push(this.occurrenceId);

    Component.$log.debug('adjust ' + path.join('/') + ' ' + JSON.stringify(params));

    return Component.$$resource.save(path, params, { action: 'adjust' });
  };

  /**
   * @function $save
   * @memberof Component.prototype
   * @desc Save the component to the server.
   * @param {object} extraAttributes - additional attributes to send to the server
   */
  Component.prototype.$save = function(extraAttributes) {
    var _this = this, options, path, component, date, dlp;

    component = this.$omit();
    dlp = Component.$Preferences.$mdDateLocaleProvider;

    // Format dates and times
    component.startDate = component.start ? component.start.format(dlp, '%Y-%m-%d') : '';
    component.startTime = component.start ? component.start.format(dlp, '%H:%M') : '';
    component.endDate = component.end ? component.end.format(dlp, '%Y-%m-%d') : '';
    component.endTime = component.end ? component.end.format(dlp, '%H:%M') : '';
    component.dueDate = component.due ? component.due.format(dlp, '%Y-%m-%d') : '';
    component.dueTime = component.due ? component.due.format(dlp, '%H:%M') : '';
    component.completedDate = component.completed ? component.completed.format(dlp, '%Y-%m-%d') : '';

    // Update recurrence definition depending on selections
    if (this.hasCustomRepeat()) {
      if (this.repeat.frequency == 'monthly' && this.repeat.month.type && this.repeat.month.type == 'byday' && this.repeat.month.day != 'relative' ||
          this.repeat.frequency == 'yearly' && this.repeat.year.byday) {
        // BYDAY mask for a monthly or yearly recurrence
        delete component.repeat.monthdays;
        component.repeat.days = [{ day: this.repeat.month.day, occurrence: this.repeat.month.occurrence.toString() }];
      }
      else if ((this.repeat.frequency == 'monthly' || this.repeat.frequency == 'yearly') &&
               this.repeat.month.type) {
        // montly recurrence by month days or yearly by month
        delete component.repeat.days;
        if (this.repeat.month.day == 'relative')
          component.repeat.monthdays = [this.repeat.month.occurrence];
      }
      else if (this.repeat.frequency == 'custom' && this.repeat.dates) {
        _.forEach(component.repeat.dates, function(rdate, i, rdates) {
          rdates[i] = {
            date: rdate.format(dlp, '%Y-%m-%d'),
            time: rdate.format(dlp, '%H:%M')
          };
        });
      }
    }
    else if (this.repeat.frequency && this.repeat.frequency != 'never') {
      component.repeat = { frequency: this.repeat.frequency };
    }
    if (component.startDate && this.repeat.frequency && this.repeat.frequency != 'never') {
      if (this.repeat.end == 'until' && this.repeat.until)
        component.repeat.until = this.repeat.until.stringWithSeparator('-');
      else if (this.repeat.end == 'count' && this.repeat.count)
        component.repeat.count = this.repeat.count;
      else {
        delete component.repeat.until;
        delete component.repeat.count;
      }
    }
    else {
      delete component.repeat;
    }

    // Check status
    if (this.status == 'not-specified')
      delete component.status;
    else if (this.status != 'completed')
      delete component.completedDate;

    // Verify alarm
    if ((component.startDate || component.dueDate) && this.$hasAlarm) {
      if (this.alarm.action && this.alarm.action == 'email' &&
          !(this.attendees && this.attendees.length > 0)) {
        // No attendees; email reminder must be sent to organizer only
        component.alarm.attendees = 0;
        component.alarm.organizer = 1;
      }
    }
    else {
      component.alarm = {};
    }

    // Build URL
    path = [this.pid, this.id];

    if (this.isNew)
      options = { action: 'saveAs' + this.type.capitalize() };

    if (this.occurrenceId)
      path.push(this.occurrenceId);

    angular.extend(component, extraAttributes);

    return Component.$$resource.save(path, component, options)
      .then(function(data) {
        // Make a copy of the data for an eventual reset
        _this.$shadowData = _this.$omit();
        return data;
      });
  };

  /**
   * @function $delete
   * @memberof Component.prototype
   * @desc Delete the component from the server.
   * @param {boolean} occurrenceOnly - delete this occurrence only
   */
  Component.prototype.remove = function(occurrenceOnly) {
    var _this = this, path = [this.pid, this.id];

    if (occurrenceOnly && this.occurrenceId)
      path.push(this.occurrenceId);

    return Component.$$resource.remove(path);
  };

  /**
   * @function $unwrap
   * @memberof Component.prototype
   * @desc Unwrap a promise.
   * @param {promise} futureComponentData - a promise of some of the Component's data
   */
  Component.prototype.$unwrap = function(futureComponentData) {
    var _this = this;

    // Expose the promise
    this.$futureComponentData = futureComponentData;

    // Resolve the promise
    this.$futureComponentData.then(function(data) {
      _this.init(data);
      // Make a copy of the data for an eventual reset
      _this.$shadowData = _this.$omit();
    }, function(data) {
      angular.extend(_this, data);
      _this.isError = true;
      Component.$log.error(_this.error);
    });
  };

  /**
   * @function $omit
   * @memberof Component.prototype
   * @desc Return a sanitized object used to send to the server.
   * @return an object literal copy of the Component instance
   */
  Component.prototype.$omit = function() {
    var component = {};
    angular.forEach(this, function(value, key) {
      if (key != 'constructor' &&
          (key == '$hasAlarm' || key[0] != '$') &&
          key != 'blocks') {
        component[key] = angular.copy(value);
      }
    });

    return component;
  };

  /**
   * @function repeatDescription
   * @memberof Component.prototype
   * @desc Return a localized description of the recurrence definition
   * @return a localized string
   */
  Component.prototype.repeatDescription = function() {
    var localizedString = null,
        frequency;
    if (this.repeat) {
      frequency = this.repeat.frequency;
      if (frequency == 'weekly' && this.repeat.interval == 2)
        frequency = 'bi-weekly';
      localizedString = l('repeat_' + frequency.toUpperCase());
    }

    return localizedString;
  };

  /**
   * @function alarmDescription
   * @memberof Component.prototype
   * @desc Return a localized description of the reminder definition
   * @return a localized string
   */
  Component.prototype.alarmDescription = function() {
    var key, localizedString = null;
    if (this.alarm) {
      key = ['reminder', this.alarm.quantity];
      if (this.alarm.quantity > 0)
        key.push(this.alarm.unit.toUpperCase(), this.alarm.reference.toUpperCase());
      key = key.join('_');
      localizedString = l(key);
      if (key === localizedString)
        // No localized string for this reminder definition
        localizedString = [this.alarm.quantity,
                           l('reminder_' + this.alarm.unit.toUpperCase()),
                           l('reminder_' + this.alarm.reference.toUpperCase())].join(' ');
    }

    return localizedString;
  };

  /**
   * @function copyTo
   * @memberof Component.prototype
   * @desc Copy an event to a calendar
   * @param {string} calendar - a target calendar UID
   * @returns a promise of the HTTP operation
   */
  Component.prototype.copyTo = function(calendar) {
    return Component.$$resource.post([this.pid, this.id], 'copy', {destination: calendar});
  };

  /**
   * @function moveTo
   * @memberof Component.prototype
   * @desc Move an event to a calendar
   * @param {string} calendar - a target calendar UID
   * @returns a promise of the HTTP operation
   */
  Component.prototype.moveTo = function(calendar) {
    return Component.$$resource.post([this.pid, this.id], 'move', {destination: calendar});
  };

  Component.prototype.toString = function() {
    return '[Component ' + this.id + ']';
  };


})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function () {
  /* jshint loopfunc: true */
  'use strict';

  /**
   * @ngInject
   */
  CalendarController.$inject = ['$scope', '$rootScope', '$state', '$stateParams', '$mdDialog', 'sgHotkeys', 'Calendar', 'Component', 'Preferences', 'stateEventsBlocks'];
  function CalendarController($scope, $rootScope, $state, $stateParams, $mdDialog, sgHotkeys, Calendar, Component, Preferences, stateEventsBlocks) {
    var vm = this, deregisterCalendarsList, hotkeys = [], cdate = new Date(), currentCalendarDate = String(cdate.getFullYear()) + String((cdate.getMonth() + 1)).padStart(2, '0') + String((cdate.getDate())).padStart(2, '0');

    this.$onInit = function () {
      // Make the toolbar state of all-day events persistent
      if (angular.isUndefined(CalendarController.expandedAllDays))
        CalendarController.expandedAllDays = false;

      this.selectedDate = $stateParams.day.asDate();
      this.selectableDays = _.map(Preferences.defaults.SOGoCalendarWeekdays, function (day) {
        return _.indexOf(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'], day);
      });
      this.expandedAllDays = CalendarController.expandedAllDays;
      this.views = stateEventsBlocks;

      _registerHotkeys(hotkeys);

      _formatDate(this.selectedDate);

      // Refresh current view when the list of calendars is modified
      deregisterCalendarsList = $rootScope.$on('calendars:list', _updateView);

      // NOTE: $onDestroy won't work with ui-router (tested with v1.0.20).
      $scope.$on('$destroy', function () {
        // Destroy event listener when the controller is being deactivated
        deregisterCalendarsList();
        // Deregister hotkeys
        _.forEach(hotkeys, function (key) {
          sgHotkeys.deregisterHotkey(key);
        });
      });
    };

    function _registerHotkeys(keys) {
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_today'),
        description: l('Today'),
        callback: vm.changeDate,
        args: new Date()
      }));
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_dayview'),
        description: l('Day'),
        callback: vm.changeView,
        args: 'day'
      }));
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_weekview'),
        description: l('Week'),
        callback: vm.changeView,
        args: 'week'
      }));
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_monthview'),
        description: l('Month'),
        callback: vm.changeView,
        args: 'month'
      }));
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_multicolumndayview'),
        description: l('Multicolumn Day View'),
        callback: vm.changeView,
        args: 'multicolumnday'
      }));
      keys.push(sgHotkeys.createHotkey({
        key: 'left',
        description: l('Move backward'),
        callback: _goToPeriod,
        args: -1
      }));
      keys.push(sgHotkeys.createHotkey({
        key: 'right',
        description: l('Move forward'),
        callback: _goToPeriod,
        args: +1
      }));

      // Register the hotkeys
      _.forEach(keys, function (key) {
        sgHotkeys.registerHotkey(key);
      });
    }


    function _goToPeriod($event, direction) {
      var date;

      if ($stateParams.view == 'week') {
        date = vm.selectedDate.beginOfWeek(Preferences.defaults.SOGoFirstDayOfWeek).addDays(7 * direction);
      }
      else if ($stateParams.view == 'month') {
        date = vm.selectedDate;
        date.setDate(1);
        date.setMonth(date.getMonth() + direction);
      }
      else {
        date = vm.selectedDate.addDays(direction);
        while (!vm.isSelectableDay(date)) {
          date = date.addDays(direction);
        }
      }

      vm.changeDate($event, date);
    }

    /**
     * Format a date according to the current view.
     * - Day/Multicolumn: name of weekday
     * - Week: week number
     * - Month: name of month
     */
    function _formatDate(date) {
      if ($stateParams.view == 'month') {
        date.setDate(1);
        date.setHours(12);
        date.$dateFormat = '%B %Y';
      }
      else if ($stateParams.view == 'week') {
        date.setTime(date.beginOfWeek(Preferences.defaults.SOGoFirstDayOfWeek).getTime());
        date.$dateFormat = l('Week %d').replace('%d', '%U');
      }
      else {
        date.$dateFormat = '%A';
      }
    }

    function _updateView() {
      // The list of calendars has changed; update the views
      // See stateEventsBlocks in Scheduler.app.js
      Component.$eventsBlocksForView($stateParams.view, $stateParams.day.asDate()).then(function (data) {
        var i, j, view;
        for (i = 0; i < data.length; i++) {
          view = data[i];
          if (vm.views[i]) {
            _.forEach(view.allDayBlocks, function (blocks, day) {
              vm.views[i].allDayBlocks[day] = blocks;
            });
            _.forEach(view.blocks, function (blocks, day) {
              vm.views[i].blocks[day] = blocks;
            });
          }
          else {
            vm.views[i] = view;
          }
          if (view.id) {
            // Note: this can't be done in Component service since it would make Component dependent on
            // the Calendar service and create a circular dependency
            vm.views[i].calendar = new Calendar({ id: view.id, name: view.calendarName });
          }
        }
        // Remove previous views
        for (j = vm.views.length; j >= i; j--)
          vm.views.splice(j, 1);

        // Refresh view
        var d = new Date();
        var date = String(d.getFullYear()) + String((d.getMonth() + 1)).padStart(2, '0') + String((d.getDate())).padStart(2, '0');
        if (currentCalendarDate !== date) {
          $state.go('calendars.view', { day: date });
          currentCalendarDate = date;
        }
      });
    }

    // Expand or collapse all-day events
    this.toggleAllDays = function () {
      CalendarController.expandedAllDays = !CalendarController.expandedAllDays;
      this.expandedAllDays = CalendarController.expandedAllDays;
    };

    // Change calendar's date
    this.changeDate = function ($event, newDate, isToday = false) {
      var date = newDate ? newDate.getDayString() : angular.element($event.currentTarget).attr('date');
      if (newDate)
        _formatDate(newDate);

      if (isToday) {
        var d = new Date();
        date = String(d.getFullYear()) + String((d.getMonth() + 1)).padStart(2, '0') + String((d.getDate())).padStart(2, '0');
      }
      $state.go('calendars.view', { day: date });

      // Refresh calendar data if click on today
      if (isToday) {
        $rootScope.$emit('calendars:list');
      }
      // $state.transitionTo('calendars.view', { day: date });
    };

    // Change calendar's view
    this.changeView = function ($event, view) {
      $state.go('calendars.view', { view: view });
    };

    this.printView = function (centerIsClose, componentType) {
      $mdDialog.show({
        parent: angular.element(document.body),
        clickOutsideToClose: true,
        escapeToClose: true,
        templateUrl: 'UIxCalPrintDialog', // See UIxCalMainView.wox
        controller: PrintController,
        controllerAs: '$PrintDialogController',
        locals: {
          calendarView: $stateParams.view,
          visibleList: centerIsClose ? undefined : componentType
        }
      });

    };

    // Check if the week day should be visible/selectable
    this.isSelectableDay = function (date) {
      return _.includes(vm.selectableDays, date.getDay());
    };
  }

  /**
   * @ngInject
   */
  PrintController.$inject = ['$rootScope', '$scope', '$window', '$stateParams', '$mdDialog', '$log', 'Dialog', 'sgSettings', 'Preferences', 'Calendar', 'calendarView', 'visibleList'];
  function PrintController($rootScope, $scope, $window, $stateParams, $mdDialog, $log, Dialog, Settings, Preferences, Calendar, calendarView, visibleList) {
    var vm = this;
    var orientations = {
      day: 'portrait',
      week: 'landscape',
      month: 'landscape',
      multicolumnday: 'landscape'
    };

    this.$onInit = function () {
      // Default values
      this.pageSize = 'letter';
      this.workingHoursOnly = true;
      this.calendarView = calendarView;
      this.orientation = orientations[this.calendarView];
      this.visibleList = visibleList;

      angular.element(document.body).addClass(this.orientation);
      $scope.$watch(function () { return vm.pageSize; }, angular.bind(this, function (newSize, oldSize) {
        angular.element(document.body).removeClass(oldSize);
        angular.element(document.body).addClass(newSize);
      }));
    };

    this.$onDestroy = function () {
      angular.element(document.body).removeClass(['portrait', 'landscape', 'letter', 'legal', 'a4']);
    };

    this.print = function ($event) {
      $window.print();
      $event.stopPropagation();
      return false;
    };

    this.close = function () {
      $mdDialog.hide();
    };
  }

  angular
    .module('SOGo.SchedulerUI')
    .controller('CalendarController', CalendarController);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @ngInject
   */
  CalendarListController.$inject = ['$rootScope', '$scope', '$q', '$timeout', '$state', '$mdDialog', 'sgHotkeys', 'sgFocus', 'Dialog', 'Preferences', 'CalendarSettings', 'Calendar', 'Component'];
  function CalendarListController($rootScope, $scope, $q, $timeout, $state, $mdDialog, sgHotkeys, focus, Dialog, Preferences, CalendarSettings, Calendar, Component) {
    var vm = this, hotkeys = [], type, sortLabels;

    sortLabels = {
      title: 'Title',
      location: 'Location',
      calendarName: 'Calendar',
      start: 'Start',
      priority: 'Priority',
      category: 'Category',
      status: 'Status',
      events: {
        end: 'End'
      },
      tasks: {
        end: 'Due Date'
      }
    };

    vm.component = Component;
    vm.componentType = 'events';
    vm.selectedList = 0;
    vm.selectComponentType = selectComponentType;
    vm.unselectComponents = unselectComponents;
    vm.selectAll = selectAll;
    vm.searchMode = searchMode;
    vm.toggleComponentSelection = toggleComponentSelection;
    vm.confirmDeleteSelectedComponents = confirmDeleteSelectedComponents;
    vm.openEvent = openEvent;
    vm.openTask = openTask;
    vm.newComponent = newComponent;
    vm.filter = filter;
    vm.filteredBy = filteredBy;
    vm.sort = sort;
    vm.sortedBy = sortedBy;
    vm.reload = reload;
    vm.cancelSearch = cancelSearch;
    vm.mode = { search: false, multiple: 0 };
    vm.allSelected = false;


    this.$onInit = function() {
      _registerHotkeys(hotkeys);

      // Select list based on user's settings
      type = 'events';
      if (Preferences.settings.Calendar.SelectedList == 'tasksListView') {
        vm.selectedList = 1;
        type = 'tasks';
      }
      selectComponentType(type, { reload: true }); // fetch events/tasks lists

      // Refresh current list when the list of calendars is modified
      $rootScope.$on('calendars:list', function() {
        Component.$filter(vm.componentType, { reload: true });
      });

      // Update the component being dragged
      $rootScope.$on('calendar:dragend', updateComponentFromGhost);
      $rootScope.$on('calendar:doubleclick', updateComponentFromGhost);

      $scope.$on('$destroy', function() {
        // Deregister hotkeys
        _.forEach(hotkeys, function(key) {
          sgHotkeys.deregisterHotkey(key);
        });
      });
    };


    function _registerHotkeys(keys) {
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_search'),
        description: l('Search'),
        callback: searchMode
      }));
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_create_event'),
        description: l('Create a new event'),
        callback: newComponent,
        args: 'appointment'
      }));
      keys.push(sgHotkeys.createHotkey({
        key: l('hotkey_create_task'),
        description: l('Create a new task'),
        callback: newComponent,
        args: 'task'
      }));

      // Register the hotkeys
      _.forEach(keys, function(key) {
        sgHotkeys.registerHotkey(key);
      });
    }

    // Switch between components tabs
    function selectComponentType(type, options) {
      if (options && options.reload || vm.componentType != type) {
        if (angular.isUndefined(Component['$' + type]))
          Component.$filter(type);
        vm.unselectComponents();
        vm.componentType = type;
        Component.saveSelectedList(type);
      }
    }

    function unselectComponents() {
      _.forEach(Component['$' + vm.componentType], function(component) {
        component.selected = false;
      });
      vm.mode.multiple = 0;
    }

    function selectAll() {
      _.forEach(Component['$' + vm.componentType], function(component) {
        component.selected = !vm.allSelected;
      });
      vm.allSelected = !vm.allSelected;
      vm.mode.multiple = Component['$' + vm.componentType].length;
    }

    function toggleComponentSelection($event, component) {
      component.selected = !component.selected;
      vm.mode.multiple += component.selected? 1 : -1;
      $event.preventDefault();
      $event.stopPropagation();
    }

    function searchMode() {
      vm.mode.search = true;
      focus('search');
    }

    function confirmDeleteSelectedComponents() {
      var components = _.filter(Component['$' + vm.componentType], function(component) {
        return component.selected;
      });
      if(components.length > 0)
        Dialog.confirm(l('Warning'),
                      l('Are you sure you want to delete the selected components?'),
                      { ok: l('Delete') })
          .then(function() {
            // User confirmed the deletion
            Calendar.$deleteComponents(components).then(function() {
              vm.mode.multiple = 0;
              $rootScope.$emit('calendars:list');
            });
          });
    }

    function openEvent($event, event) {
      openComponent($event, event, 'appointment');
    }

    function openTask($event, task) {
      openComponent($event, task, 'task');
    }

    function openComponent($event, component, type) {
      if (component.viewable) {
        var promise = $q.when();

        // Load component before opening dialog
        if (angular.isUndefined(component.$futureComponentData)) {
          component = Calendar.$get(component.pid).$getComponent(component.id, component.occurrenceId);
          promise = component.$futureComponentData;
        }

        promise.then(function() {
          // UI/Templates/SchedulerUI/UIxAppointmentViewTemplate.wox or
          // UI/Templates/SchedulerUI/UIxTaskViewTemplate.wox
          var templateUrl = 'UIx' + type.capitalize() + 'ViewTemplate';
          
          $mdDialog.show({
            parent: angular.element(document.body),
            targetEvent: $event,
            clickOutsideToClose: true,
            escapeToClose: true,
            templateUrl: templateUrl,
            controller: 'ComponentController',
            controllerAs: 'editor',
            locals: {
              stateComponent: component
            }
          });
        });
      }
    }

    function newComponent($event, type, baseComponent) {
      var component;

      if (baseComponent) {
        component = baseComponent;
        component.initAttendees();
        component.$attendees.updateFreeBusy();
      }
      else {
        component = new Component({ pid: Calendar.$defaultCalendar(), type: type });
      }

      // UI/Templates/SchedulerUI/UIxAppointmentEditorTemplate.wox or
      // UI/Templates/SchedulerUI/UIxTaskEditorTemplate.wox
      var templateUrl = 'UIx' + type.capitalize() + 'EditorTemplate';

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
    }

    // Adjust component or create new component through drag'n'drop
    function updateComponentFromGhost($event) {
      var component, pointerHandler, originalCoordinates, coordinates, delta, params, calendarNumber, activeCalendars;

      component = Component.$ghost.component;
      pointerHandler = Component.$ghost.pointerHandler;

      if (component.isNew) {
        originalCoordinates = pointerHandler.originalEventCoordinates;
        coordinates = pointerHandler.currentEventCoordinates;
        component.summary = '';
        if (component.isAllDay)
          coordinates.duration -= 96;
        if (coordinates.start < originalCoordinates.start)
          coordinates.duration *= -1;
        component.setDelta(coordinates.duration * 15);
        newComponent(null, 'appointment', component)
          .catch()
          .finally(function() {
            $timeout(function() {
              Component.$resetGhost();
            });
          });
      }
      else {
        delta = pointerHandler.currentEventCoordinates.getDelta(pointerHandler.originalEventCoordinates);
        params = {
          days: delta.dayNumber,
          start: delta.start * 15,
          duration: delta.duration * 15
        };
        if (pointerHandler.originalCalendar && delta.dayNumber !== 0) {
          // The day number actually represents the destination calendar among the active calendars
          calendarNumber = pointerHandler.currentEventCoordinates.dayNumber;
          activeCalendars = _.filter(Calendar.$findAll(), { active: 1 });
          params.destination = activeCalendars[calendarNumber].id;
          params.days = 0;
        }
        if (component.isException || !component.occurrenceId)
          // Component is an exception to a recurrence or is not recurrent;
          // Immediately perform the adjustments
          component.$adjust(params).then(function() {
            $rootScope.$emit('calendars:list');
            Preferences.getAlarms();
          }, function(response) {
            onComponentAdjustError(response, component, params);
          }).finally(function() {
            $timeout(function() {
              Component.$resetGhost();
            });
          });
        else if (component.occurrenceId) {
          $mdDialog.show({
            clickOutsideToClose: true,
            escapeToClose: true,
            locals: {
              component: component,
              params: params
            },
            template: [
              '<md-dialog flex="50" sm-flex="80" xs-flex="90">',
              '  <md-dialog-content class="md-dialog-content">',
              '    <p>' + l('editRepeatingItem') + '</p>',
              '  </md-dialog-content>',
              '  <md-dialog-actions>',
              '    <md-button ng-click="updateThisOccurrence()">' + l('button_thisOccurrenceOnly') + '</md-button>',
              '    <md-button ng-click="updateAllOccurrences()">' + l('button_allOccurrences') + '</md-button>',
              '  </md-dialog-actions>',
              '</md-dialog>'
            ].join(''),
            controller: RecurrentComponentDialogController
          }).then(function() {
            $rootScope.$emit('calendars:list');
          }, function() {
            // Cancel
          }).finally(function() {
            $timeout(function() {
              Component.$resetGhost();
            });
          });
        }
      }

      /**
       * @ngInject
       */
      RecurrentComponentDialogController.$inject = ['$scope', '$mdDialog', 'component', 'params'];
      function RecurrentComponentDialogController($scope, $mdDialog, component, params) {
        $scope.updateThisOccurrence = function() {
          component.$adjust(params).then($mdDialog.hide, function(response) {
            $mdDialog.cancel().then(function() {
              onComponentAdjustError(response, component, params);
            }, function() {
              // Cancel
            });
          });
        };
        $scope.updateAllOccurrences = function() {
          delete component.occurrenceId;
          component.$adjust(params).then($mdDialog.hide, function(response) {
            $mdDialog.cancel().then(function() {
              onComponentAdjustError(response, component, params);
            }, function() {
              // Cancel
            });
          });
        };
      }

      function onComponentAdjustError(response, component, params) {
        if (response.status == CalendarSettings.ConflictHTTPErrorCode &&
            response.data && response.data.message && angular.isObject(response.data.message)) {
          $mdDialog.show({
            parent: angular.element(document.body),
            clickOutsideToClose: false,
            escapeToClose: false,
            templateUrl: 'UIxAttendeeConflictDialog',
            controller: AttendeeConflictDialogController,
            controllerAs: '$AttendeeConflictDialogController',
            locals: {
              component: component,
              params: params,
              conflictError: response.data.message
            }
          }).then(function() {
            $rootScope.$emit('calendars:list');
          }, function() {
            // Cancel
          });
        }
      }

      /**
       * @ngInject
       */
      AttendeeConflictDialogController.$inject = ['$scope', '$mdDialog', 'component', 'params', 'conflictError'];
      function AttendeeConflictDialogController($scope, $mdDialog, component, params, conflictError) {
        var vm = this;

        vm.conflictError = conflictError;
        vm.cancel = $mdDialog.cancel;
        vm.save = save;

        function save() {
          component.$adjust(angular.extend({ ignoreConflicts: true }, params)).then($mdDialog.hide);
        }
      }
    }

    function filter(filterpopup) {
      if (filterpopup) {
        Component.$filter(vm.componentType, { filterpopup: filterpopup });
      }
      else {
        return Component['$query' + vm.componentType.capitalize()].filterpopup;
      }
    }

    function filteredBy(filterpopup) {
      return Component['$query' + vm.componentType.capitalize()].filterpopup == filterpopup;
    }

    function sort(field) {
      if (field) {
        Component.$filter(vm.componentType, { sort: field });
      }
      else {
        var sort = Component['$query' + vm.componentType.capitalize()].sort;
        return sortLabels[sort] || sortLabels[vm.componentType][sort];
      }
    }

    function sortedBy(field) {
      return Component['$query' + vm.componentType.capitalize()].sort == field;
    }

    this.ascending = function() {
      return Component['$query' + vm.componentType.capitalize()].asc;
    };

    function reload() {
      Component.$loaded = Component.STATUS.LOADING; // Show progress indicator
      Calendar.reloadWebCalendars().finally(function() {
        $rootScope.$emit('calendars:list');
      });
    }

    function cancelSearch() {
      vm.mode.search = false;
      Component.$filter(vm.componentType, { value: '' });
    }
  }

  angular
    .module('SOGo.SchedulerUI')
    .controller('CalendarListController', CalendarListController);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @ngInject
   */
  CalendarsController.$inject = ['$rootScope', '$scope', '$window', '$mdDialog', '$mdMedia', '$log', '$mdToast', 'sgConstant', 'Dialog', 'sgSettings', 'Preferences', 'Calendar'];
  function CalendarsController($rootScope, $scope, $window, $mdDialog, $mdMedia, $log, $mdToast, sgConstant, Dialog, Settings, Preferences, Calendar) {
    var vm = this;

    this.activeUser = Settings.activeUser;
    this.service = Calendar;
    this.filter = { name: '' };
    this.sortableMode = false;
    this.sortableCalendars = {
      scrollableContainer: '#sidenav-content',
      containment: 'md-list',
      orderChanged: _sortableEnd,
      accept: _sortableAccept
    };

    this.$onInit = function() {
      vm.categories = _.map(Preferences.defaults.SOGoCalendarCategories, function(name) {
        return { id: name.asCSSIdentifier(),
                 name: name,
                 color: Preferences.defaults.SOGoCalendarCategoriesColors[name]
               };
      });

      // Dispatch the event named 'calendars:list' when a calendar is activated or deactivated or
      // when the color of a calendar is changed
      $scope.$watch(
        function() {
          return _.union(
            _.map(Calendar.$calendars, function(o) { return _.pick(o, ['id', 'active', 'color']); }),
            _.map(Calendar.$subscriptions, function(o) { return _.pick(o, ['id', 'active', 'color']); }),
            _.map(Calendar.$webcalendars, function(o) { return _.pick(o, ['id', 'active', 'color']); })
          );
        },
        function(newList, oldList) {
          var commonList, ids, promise;

          // Identify which calendar has changed
          commonList = _.intersectionBy(newList, oldList, 'id');
          ids = _.map(_.filter(commonList, function(o) {
            var oldObject = _.find(oldList, { id: o.id });
            return !_.isEqual(o, oldObject);
          }), 'id');
          promise = Calendar.$q.when();

          if (ids.length > 0) {
            $log.debug(ids.join(', ') + ' changed');
            promise = Calendar.saveFoldersActivation(ids);
          }
          if (ids.length > 0 || commonList.length != newList.length || commonList.length != oldList.length)
            promise.then(function() {
              $rootScope.$emit('calendars:list');
            });
        },
        true // compare for object equality
      );
    };

    /**
     * The center is always displayed on small screens.
     */
    this.centerIsClose = function (closed) {
      return closed && $mdMedia(sgConstant['gt-xs']);
    };

    /**
     * Only allow to sort items within the same list.
     */
    function _sortableAccept(sourceItemHandleScope, destSortableScope, destItemScope) {
      return sourceItemHandleScope.sortableScope.element[0] == destSortableScope.element[0];
    }

    function _sortableEnd() {
      Calendar.saveFoldersOrder(_.flatMap(Calendar.$findAll(), 'id'));
    }

    this.toggleSortableMode = function () {
      this.sortableMode = !vm.sortableMode;
      this.filter.name = '';
    };

    this.resetSort = function () {
      Calendar.saveFoldersOrder();
    };

    this.newCalendar = function (ev) {
      Dialog.prompt(l('New calendar'), l('Name of the Calendar'))
        .then(function(name) {
          var calendar = new Calendar(
            {
              name: name,
              isEditable: true,
              isRemote: false,
              owner: UserLogin
            }
          );
          calendar.$id().then(function() {
            Calendar.$add(calendar);
          }).catch(_.noop); // error
        });
    };

    this.addWebCalendar = function () {
      Dialog.prompt(l('Subscribe to a web calendar...'), l('URL of the Calendar'), {inputType: 'url'})
        .then(function(url) {
          Calendar.$addWebCalendar(url).then(function(calendar) {
            if (angular.isObject(calendar)) {
              // Web calendar requires HTTP authentication
              $mdDialog.show({
                parent: angular.element(document.body),
                clickOutsideToClose: true,
                escapeToClose: true,
                templateUrl: 'UIxWebCalendarAuthDialog',
                controller: WebCalendarAuthDialogController,
                controllerAs: '$WebCalendarAuthDialogController',
                locals: {
                  url: url,
                  calendar: calendar
                }
              });
            }
          }).catch(_.noop); // error
        }).catch(_.noop); // error

      /**
       * @ngInject
       */
      WebCalendarAuthDialogController.$inject = ['scope', '$mdDialog', 'url', 'calendar'];
      function WebCalendarAuthDialogController(scope, $mdDialog, url, calendar) {
        var vm = this,
            parts = url.split("/"),
            hostname = parts[2];

        vm.title = l("Please identify yourself to %{0}").formatted(hostname);
        vm.url = url;
        vm.authenticate = function(form) {
          if (form.$valid || !form.$error.required) {
            calendar.setCredentials(vm.username, vm.password).then(function(message) {
              $mdDialog.hide();
            }, function(reason) {
              form.password.$setValidity('credentials', false);
            });
          }
        };
        vm.cancel = function() {
          $mdDialog.cancel();
        };
      }
    };


    // Callback of sgSubscribe directive
    this.subscribeToFolder = function (calendarData) {
      $log.debug('subscribeToFolder ' + calendarData.owner + calendarData.name);
      Calendar.$subscribe(calendarData.owner, calendarData.name).then(function(data) {
         $mdToast.show(
           $mdToast.simple()
             .textContent(l('Successfully subscribed to calendar'))
             .position(sgConstant.toastPosition)
             .hideDelay(3000));
      });
    };

  }

  angular
    .module('SOGo.SchedulerUI')
    .controller('CalendarsController', CalendarsController);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /**
   * @ngInject
   */
  ComponentController.$inject = ['$rootScope', '$scope', '$q', '$mdDialog', 'sgConstant', 'Preferences', 'Calendar', 'Component', 'AddressBook', 'Account', 'stateComponent'];
  function ComponentController($rootScope, $scope, $q, $mdDialog, sgConstant, Preferences, Calendar, Component, AddressBook, Account, stateComponent) {
    var vm = this, component;

    this.$onInit = function () {
      this.calendarService = Calendar;
      this.service = Component;
      this.component = stateComponent;
      this.isDeleting = false;

      // Put organizer in an array to display it as an mdChip
      this.organizer = [stateComponent.organizer];
    };

    this.close = function () {
      $mdDialog.hide();
    };

    this.changed = function (d) {
      console.log(d);
    };

    this.highPriority = function () {
      return (this.component &&
              this.component.priority &&
              this.component.priority < 5);
    };

    // Autocomplete cards for attendees
    this.cardFilter = function ($query) {
      return AddressBook.$filterAll($query);
    };

    this.newMessageWithAllRecipients = function ($event) {
      var recipients = _.map(this.component.attendees, function(attendee) {
        return attendee.name + " <" + attendee.email + ">";
      });
      _newMessage($event, recipients);
    };

    this.newMessageWithRecipient = function ($event, name, email) {
      _newMessage($event, [name + " <" + email + ">"]);
    };

    function _newMessage($event, recipients) {
      Account.$findAll().then(function(accounts) {
        var account = _.find(accounts, function(o) {
          if (o.id === 0)
            return o;
        }),
            onCompleteDeferred = $q.defer();

        // We must initialize the Account with its mailbox
        // list before proceeding with message's creation
        account.$getMailboxes().then(function(mailboxes) {
          account.$newMessage().then(function(message) {
            angular.extend(message.editable, { to: recipients, subject: vm.component.summary });
            $mdDialog.show({
              parent: angular.element(document.body),
              targetEvent: $event,
              clickOutsideToClose: false,
              escapeToClose: false,
              templateUrl: '../Mail/UIxMailEditor',
              controller: 'MessageEditorController',
              controllerAs: 'editor',
              onComplete: function (scope, element) {
                return onCompleteDeferred.resolve(element);
              },
              locals: {
                stateParent: $scope,
                stateAccount: account,
                stateMessage: message,
                onCompletePromise: function () {
                  return onCompleteDeferred.promise;
                }
              }
            });
          });
        });
      });

      $event.preventDefault();
      $event.stopPropagation();
    }

    this.edit = function () {
      var type = (this.component.component == 'vevent')? 'Appointment':'Task';
      $mdDialog.hide().then(function() {
        // UI/Templates/SchedulerUI/UIxAppointmentEditorTemplate.wox or
        // UI/Templates/SchedulerUI/UIxTaskEditorTemplate.wox
        var templateUrl = 'UIx' + type + 'EditorTemplate';
        $mdDialog.show({
          parent: angular.element(document.body),
          clickOutsideToClose: true,
          escapeToClose: true,
          templateUrl: templateUrl,
          controller: 'ComponentEditorController',
          controllerAs: 'editor',
          locals: {
            stateComponent: vm.component
          }
        });
      });
    };

    this.editAllOccurrences = function () {
      component = Calendar.$get(this.component.pid).$getComponent(this.component.id);
      component.$futureComponentData.then(function() {
        vm.component = component;
        vm.edit();
      });
    };

    this.reply = function (component) {
      var c = component || this.component;

      c.$reply().then(function() {
        $rootScope.$emit('calendars:list');
        Preferences.getAlarms();
        $mdDialog.hide();
      });
    };

    this.replyAllOccurrences = function () {
      // Retrieve master event
      component = Calendar.$get(this.component.pid).$getComponent(this.component.id);
      component.$futureComponentData.then(function() {
        // Propagate the participant status, classification and alarm to the master event
        component.reply = vm.component.reply;
        component.delegatedTo = vm.component.delegatedTo;
        component.$hasAlarm = vm.component.$hasAlarm;
        component.classification = vm.component.classification;
        component.alarm = vm.component.alarm;
        // Send reply to the server
        vm.reply(component);
      });
    };

    this.deleteOccurrence = function () {
      if (!this.isDeleting) {
        this.isDeleting = true;
        this.component.remove(true).then(function() {
          $rootScope.$emit('calendars:list');
          $mdDialog.hide();
          vm.isDeleting = false;
        });
      }
    };

    this.deleteAllOccurrences = function () {
      if (!this.isDeleting) {
        this.isDeleting = true;
        this.component.remove().then(function () {
          $rootScope.$emit('calendars:list');
          $mdDialog.hide();
          vm.isDeleting = false;
        });
      }
      
    };

    this.toggleRawSource = function ($event) {
      Calendar.$$resource.post(this.component.pid + '/' + this.component.id, "raw").then(function(data) {
        $mdDialog.hide();
        $mdDialog.show({
          parent: angular.element(document.body),
          targetEvent: $event,
          clickOutsideToClose: true,
          escapeToClose: true,
          template: [
            '<md-dialog flex="40" flex-sm="80" flex-xs="100" aria-label="' + l('View Raw Source') + '">',
            '  <md-dialog-content class="md-dialog-content">',
            '    <pre ng-bind-html="data"></pre>',
            '  </md-dialog-content>',
            '  <md-dialog-actions>',
            '    <md-button ng-click="close()">' + l('Close') + '</md-button>',
            '  </md-dialog-actions>',
            '</md-dialog>'
          ].join(''),
          controller: ComponentRawSourceDialogController,
          locals: { data: data }
        });

        /**
         * @ngInject
         */
        ComponentRawSourceDialogController.$inject = ['scope', '$mdDialog', 'data'];
        function ComponentRawSourceDialogController(scope, $mdDialog, data) {
          scope.data = data;
          scope.close = function() {
            $mdDialog.hide();
          };
        }
      });
    };

    this.copySelectedComponent = function (calendar) {
      this.component.copyTo(calendar).then(function() {
        $mdDialog.hide();
        $rootScope.$emit('calendars:list');
      });
    };

    this.moveSelectedComponent = function (calendar) {
      this.component.moveTo(calendar).then(function() {
        $mdDialog.hide();
        $rootScope.$emit('calendars:list');
      });
    };
  }

  /**
   * @ngInject
   */
  ComponentEditorController.$inject = ['$rootScope', '$scope', '$q', '$log', '$timeout', '$window', '$element', '$mdDialog', '$mdToast', 'sgFocus', 'User', 'CalendarSettings', 'Calendar', 'Component', 'Attendees', 'AddressBook', 'Card', 'Preferences', 'stateComponent'];
  function ComponentEditorController($rootScope, $scope, $q, $log, $timeout, $window, $element, $mdDialog, $mdToast, focus, User, CalendarSettings, Calendar, Component, Attendees, AddressBook, Card, Preferences, stateComponent) {
    var vm = this, component, oldStartDate, oldEndDate, oldDueDate, dayStartTime, dayEndTime;

    this.$onInit = function () {
      this.service = Calendar;
      this.component = stateComponent;
      this.categories = {};
      this.showRecurrenceEditor = this.component.$hasCustomRepeat;
      this.showAttendeesEditor = this.component.attendees && this.component.attendees.length;
      this.isFullscreen = (typeof screen.orientation !== 'undefined' && screen.orientation && 'portrait-primary' == screen.orientation.type);
      this.originalModalCancel = $mdDialog.cancel;
      this.preferences = Preferences;

      if (this.component.type == 'appointment') {
        this.component.initAttendees();
        this.attendeeConflictError = false;
        this.attendeesEditor = {
          days: this.component.$attendees.$days,
          hours: getHours(),
          containerElement: $element[0].querySelector('#freebusy')
        };
      }

      if (this.component.start) {
        oldStartDate = new Date(this.component.start.getTime());
        this.startTime = new Date(this.component.start.getTime());
      }
      if (this.component.end) {
        oldEndDate = new Date(this.component.end.getTime());
        this.endTime = new Date(this.component.end.getTime());
      }
      if (this.component.due) {
        oldDueDate = new Date(this.component.due.getTime());
        this.dueTime = new Date(this.component.due.getTime());
      }

      if (this.component.attendees)
        $timeout(scrollToStart);

      dayStartTime = parseInt(Preferences.defaults.SOGoDayStartTime);
      dayEndTime = parseInt(Preferences.defaults.SOGoDayEndTime);

      this.originalHash = this.hash(this.component);
      $mdDialog.cancel = function () {
        if (vm.originalHash === vm.hash(vm.component)  || confirm(l('You have modified data unsaved. Do you want to close popup and loose data ?'))) {
          $mdDialog.cancel = vm.originalModalCancel;
          return vm.originalModalCancel();
        }
      };
    };

    this.hash = function (data) {
      var hash = 0, i, chr, edata, json;
      edata = {
        repeat: data.repeat,
        pid: data.pid,
        destinationCalendar: data.destinationCalendar,
        classification: data.classification,
        categories: data.categories,
        alarm: data.alarm,
        summary: data.summary,
        status: data.status,
        organizer: data.organizer,
        location: data.location,
        isAllDay: data.isAllDay,
        comment: data.comment,
        attendees: data.attendees
      };
      if (edata.organizer && edata.organizer.freebusy) {
        edata.organizer.freebusy = {};
      }
      if (edata.attendees) {
        for (i = 0; i < edata.attendees.length; i++) {
          edata.attendees[i].freebusy = {};
        }
      }
      json = JSON.stringify(edata);

      if (json.length === 0) return hash;
      for (i = 0; i < json.length; i++) {
        chr = json.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
      }

      return hash;
    }

    this.addAttachUrl = function () {
      var i = this.component.addAttachUrl('');
      focus('attachUrl_' + i);
    };

    this.addJitsiUrl = function () {
      var jitsiBaseUrl = "https://meet.jit.si";
      var jitsiRoomPrefix = "SOGo_meeting/";
      if(this.preferences.defaults && this.preferences.defaults.SOGoCalendarJitsiBaseUrl)
        jitsiBaseUrl = this.preferences.defaults.SOGoCalendarJitsiBaseUrl;
      if(this.preferences.defaults && this.preferences.defaults.SOGoCalendarJitsiRoomPrefix)
        jitsiRoomPrefix = this.preferences.defaults.SOGoCalendarJitsiRoomPrefix;
      var jitsiUrl = jitsiBaseUrl + "/" + jitsiRoomPrefix + crypto.randomUUID();
      var i = this.component.addAttachUrl(jitsiUrl);
      focus('attachUrl_' + i);
    };

    this.toggleRecurrenceEditor = function () {
      this.showRecurrenceEditor = !this.showRecurrenceEditor;
      this.component.$hasCustomRepeat = this.showRecurrenceEditor;
    };

    this.toggleAttendeesEditor = function () {
      this.showAttendeesEditor = !this.showAttendeesEditor;
    };

    this.recurrenceMonthDaysAreRequired = function () {
      return this.component &&
        this.component.repeat.frequency == 'monthly' &&
        this.component.repeat.month.type == 'bymonthday';
    };

    this.changeFrequency = function () {
      if (this.component.repeat.frequency == 'custom')
        this.showRecurrenceEditor = true;
    };

    this.destinationCalendars = function () {
      if (this.component && this.component.isNew)
        // New component, return all writable calendars
        return Calendar.$findAll(null, true);
      else if (this.component && this.component.isErasable)
        // Movable component, return all writable calendars including current one
        return Calendar.$findAll(null, true, this.component.pid);
      else
        // Component can't be moved
        return [Calendar.$get(this.component.pid)];
    };

    this.changeCalendar = function () {
      var updateRequired = (this.component.attendees && this.component.attendees.length > 0);
      if (updateRequired)
        this.component.$attendees.initOrganizer(Calendar.$get(this.component.destinationCalendar));
    };

    this.toggleFullscreen = function() {
      vm.isFullscreen = !vm.isFullscreen;
    }

    // Autocomplete cards for attendees
    this.cardFilter = function ($query) {
      return AddressBook.$filterAll($query);
    };

    this.addAttendee = function (card, partial) {
      var initOrganizer = (!this.component.attendees || this.component.attendees.length === 0),
          destinationCalendar = Calendar.$get(this.component.destinationCalendar),
          options = initOrganizer? { organizerCalendar: destinationCalendar } : {},
          promises = [];
      var i, address;
      if (partial) options.partial = partial;

      function createCard(str) {
        var match = str.match(String.emailRE),
            email = match[0],
            name = str.replace(new RegExp(" *<?" + email + ">? *"), '');
        vm.showAttendeesEditor |= initOrganizer;
        vm.searchText = '';
        return vm.cardFilter(email).then(function (cards) {
          if (cards.length) {
            return cards[0];
          } else {
            return new Card({ c_cn: _.trim(name, ' "'), emails: [{ value: email }] });
          }
        }).catch(function (err) {
          // Server error
          return new Card({ c_cn: _.trim(name, ' "'), emails: [{ value: email }] });
        });
      }

      function addCard(newCard) {
        if (!vm.component.$attendees.hasAttendee(newCard))
          return vm.component.$attendees.add(newCard, options);
      }

      if (angular.isString(card)) {
        // User pressed "Enter" in search field, adding a non-matching card
        // Examples that are handled:
        //   Smith, John <john@smith.com>
        //   <john@appleseed.com>;<foo@bar.com>
        //   foo@bar.com abc@xyz.com
        address = '';
        for (i = 0; i < card.length; i++) {
          if ((card.charCodeAt(i) ==  9 ||   // tab
               card.charCodeAt(i) == 32 ||   // space
               card.charCodeAt(i) == 44 ||   // ,
               card.charCodeAt(i) == 59) &&  // ;
              String.emailRE.test(address)) {
            promises.push(createCard(address).then(addCard));
            address = '';
          }
          else {
            address += card.charAt(i);
          }
        }
        if (address && String.emailRE.test(address)) {
          promises.push(createCard(address).then(addCard));
        }
      }
      else if (angular.isDefined(card)) {
        if (!this.component.$attendees.hasAttendee(card))
          promises.push(this.component.$attendees.add(card, options));
        this.showAttendeesEditor |= initOrganizer;
      }

      if (_.has(this.component, '$attendees'))
        $timeout(scrollToStart);

      return $q.all(promises);
    };

    function scrollToStart() {
      var dayElement, scrollLeft;
      if (!vm.attendeesEditor.containerElement) {
        vm.attendeesEditor.containerElement = $element[0].querySelector('#freebusy');
      }
      dayElement = $element[0].querySelector('#freebusy_day_' + vm.component.start.getDayString());
      if (vm.attendeesEditor.containerElement && dayElement) {
        scrollLeft = dayElement.offsetLeft - vm.attendeesEditor.containerElement.offsetLeft;
        vm.attendeesEditor.containerElement.scrollLeft = scrollLeft;
      }
    }

    this.expandAttendee = function (attendee) {
      if (attendee.members.length > 0) {
        this.component.$attendees.remove(attendee);
        _.forEach(attendee.members, function (member) {
          vm.component.$attendees.add(member);
        });
      }
    };

    this.removeAttendee = function (attendee, form) {
      this.component.$attendees.remove(attendee);
      if (this.component.$attendees.getLength() === 0) {
        this.showAttendeesEditor = false;
        this.component.$attendees.remove(this.component.organizer);
      }
      form.$setDirty();
    };

    this.defaultIconForAttendee = function (attendee) {
      if (attendee.isGroup) {
        return 'group';
      } else if (attendee.isResource) {
        return 'meeting_room';
      } else {
        return 'person';
      }
    };

    this.nextSlot = function () {
      findSlot(1);
    };

    this.previousSlot = function () {
      findSlot(-1);
    };

    function findSlot(direction) {
      vm.adjustStartTime();
      vm.adjustEndTime();
      vm.component.$attendees.findSlot(direction).then(function () {
        vm.startTime = new Date(vm.component.start.getTime());
        vm.endTime = new Date(vm.component.end.getTime());
      }).catch(function (err) {
        vm.component.start = new Date(vm.component.start.getTime() + 1); // trigger update in sgFreeBusy
        $timeout(scrollToStart);
        $mdToast.show({
          template: [
            '<md-toast>',
            '  <div class="md-toast-content">',
            '    <md-icon class="md-warn md-hue-1">error_outline</md-icon>',
            '    <span flex>' + err + '</span>',
            '  </div>',
            '</md-toast>'
          ].join(''),
          hideDelay: 5000,
          position: sgConstant.toastPosition
        });
      }).finally(function () {
        $timeout(scrollToStart);
      });
    }

    this.priorityLevel = function () {
      if (this.component && this.component.priority) {
        if (this.component.priority > 5)
          return l('low');                   // 6-7-8-9
        else if (this.component.priority > 4)
          return l('normal');                // 5
        else
          return l('high');                  // 1-2-3-4
      }
    };

    this.changeAlarmRelation = function (form) {
      if (form.alarmRelation) {
        if (this.component.type == 'task' && this.component.$hasAlarm &&
            (this.component.start || this.component.due) &&
            ((!this.component.start && this.component.alarm.relation == 'START') ||
             (!this.component.due   && this.component.alarm.relation == 'END'))) {
          form.alarmRelation.$setValidity('alarm', false);
        }
        else {
          form.alarmRelation.$setValidity('alarm', true);
        }
      }
    };

    this.onAlarmChange = function (form) {
      if (this.component.type !== 'task') {
        return;
      }
      if (!this.component.start && this.component.alarm.relation == 'START') {
        this.component.alarm.relation = 'END';
      } else if (!this.component.due && this.component.alarm.relation == 'END') {
        this.component.alarm.relation = 'START';
      }
      this.changeAlarmRelation(form);
    };

    this.save = function (form, options) {
      this.adjustStartTime();
      this.adjustEndTime();
      this.changeAlarmRelation(form);
      this.addAttendee(this.searchText).then(function () {
        vm.adjustStartTime();
        if (form.$valid) {
          vm.component.$save(options)
            .then(function(data) {
              $rootScope.$emit('calendars:list');
              Preferences.getAlarms();
              $mdDialog.cancel = vm.originalModalCancel;
              $mdDialog.hide();
            }, function(response) {
              vm.allowResubmit(form);

              if (response.status == CalendarSettings.ConflictHTTPErrorCode) {
                vm.attendeeConflictError = _.isObject(response.data.message) ? response.data.message : { reject: response.data.message };
              } else {
                vm.edit(form);
              }
            });
        }
      });
    };

    this.reset = function (form) {
      this.component.$reset();
      form.$setPristine();
    };

    this.cancel = function (form) {
      if (vm.originalHash === vm.hash(vm.component) || confirm(l('You have modified data unsaved. Do you want to close popup and loose data ?'))) {
        $mdDialog.cancel = vm.originalModalCancel;
      } else {
        return;
      }

      $mdDialog.hide();
      
      this.reset(form);
      if (this.component.isNew) {
        // Cancelling the creation of a component
        this.component = null;
      }
      $mdDialog.hide();
    };

    this.edit = function (form) {
      this.attendeeConflictError = false;
      form.$setPristine();
      form.$setDirty();
    };

    this.allowResubmit = function (form) {
      form.$setPristine();
      form.$setDirty();
    };

    function getHours() {
      var hours = [];
      for (var i = 0; i <= 23; i++) {
        hours.push(i.toString());
      }
      return hours;
    }

    this.addStartDate = function (form) {
      this.component.$addStartDate();
      oldStartDate = new Date(this.component.start.getTime());
      this.startTime = new Date(this.component.start.getTime());
      if (!this.component.due) {
        this.component.alarm.relation = 'START';
      }
      this.changeAlarmRelation(form);
      form.$setDirty();
    };

    this.removeStartDate = function (form) {
      this.component.$deleteStartDate();
      if (this.component.due) {
        this.component.alarm.relation = 'END';
      }
      this.changeAlarmRelation(form);
      form.$setDirty();
    };

    this.addDueDate = function (form) {
      this.component.$addDueDate();
      oldDueDate = new Date(this.component.due.getTime());
      this.dueTime = new Date(this.component.due.getTime());
      if (!this.component.start) {
        this.component.alarm.relation = 'END';
      }
      this.changeAlarmRelation(form);
      form.$setDirty();
    };

    this.removeDueDate = function (form) {
      this.component.$deleteDueDate();
      if (this.component.start) {
        this.component.alarm.relation = 'START';
      }
      this.changeAlarmRelation(form);
      form.$setDirty();
    };

    this.adjustAllDay = function () {
      if (!this.component.isAllDay) {
        this.component.start.setHours(dayStartTime);
        this.component.start.setMinutes(0);
        this.startTime = new Date(this.component.start.getTime());
        oldStartDate = new Date(this.component.start.getTime());
        this.component.end.setHours(dayEndTime);
        this.component.end.setMinutes(0);
        this.endTime = new Date(this.component.end.getTime());
        oldEndDate = new Date(this.component.end.getTime());
        this.component.delta = this.component.start.minutesTo(this.component.end);
      }
      this.component.$attendees.updateFreeBusyCoverage();
    };

    this.adjustStartTime = function () {
      var delta;
      if (this.component.start && this.startTime) {
        // Update the component start date
        this.component.start.setHours(this.startTime.getHours());
        this.component.start.setMinutes(this.startTime.getMinutes());
        // Preserve the delta between the start and end dates
        delta = oldStartDate.valueOf() - this.component.start.valueOf();
        if (delta !== 0) {
          oldStartDate = new Date(this.component.start.getTime());
          if (this.component.type === 'appointment') {
            this.component.end = new Date(this.component.start.getTime());
            this.component.end.addMinutes(this.component.delta);
            this.endTime = new Date(this.component.end.getTime());
            oldEndDate = new Date(this.component.end.getTime());
          }
          updateFreeBusy();
        }
      }
    };

    this.adjustEndTime = function () {
      var delta;
      if (this.component.end && this.endTime) {
        // Update the component end date
        this.component.end.setHours(this.endTime.getHours());
        this.component.end.setMinutes(this.endTime.getMinutes());
        // The end date must be after the start date
        delta = oldEndDate.valueOf() - this.component.end.valueOf();
        if (delta !== 0) {
          if (this.startTime) {
            // Update the component start date
            this.component.start.setHours(this.startTime.getHours());
            this.component.start.setMinutes(this.startTime.getMinutes());
          }
          delta = this.component.start.minutesTo(this.component.end);
          if (delta < 0) {
            this.component.end = new Date(oldEndDate.getTime());
            this.endTime = new Date(this.component.end.getTime());
          }
          else {
            this.component.delta = delta;
            oldEndDate = new Date(this.component.end.getTime());
          }
          updateFreeBusy();
        }
      }
    };

    this.adjustDueTime = function () {
      if (this.component.due && this.dueTime) {
        this.component.due.setHours(this.dueTime.getHours());
        this.component.due.setMinutes(this.dueTime.getMinutes());
        oldDueDate = new Date(this.component.due.getTime());
      }
    };

    function updateFreeBusy() {
      if (_.has(vm.component, '$attendees')) {
        vm.component.$attendees.updateFreeBusyCoverage();
        vm.component.$attendees.updateFreeBusy();
        $timeout(scrollToStart);
      }
    }
  }

  angular
    .module('SOGo.SchedulerUI')
    .controller('ComponentController', ComponentController)
    .controller('ComponentEditorController', ComponentEditorController);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /*
   * sgCalendarDay - An element that represents a day in the calendar's view
   * @memberof SOGo.SchedulerUI
   * @restrict element
   * @param {string} sgDay - the day of the events to display (YYYYMMDD)
   * @param {string} sgDayString - the day in ISO8601 format (YYYY-MM-DDTHH:MM+-HH:MM)
   * @param {number} sgDayNumber - the day index within the calendar's view
   *
   * @example:

   <sg-calendar-day
       sg-day-string="2015-11-01T00:00-05:00"
       sg-day-number="0"
       sg-day="20151101">
     ..
   </sg-calendar-day-table>
  */
  function sgCalendarDay() {
    return {
      restrict: 'E',
      scope: {
        day: '@sgDay',
        dayNumber: '@sgDayNumber',
        dayString: '@sgDayString',
        calendar: '@sgCalendar'
      },
      controller: sgCalendarDayController
    };
  }

  /**
   * @ngInject
   */
  sgCalendarDayController.$inject = ['$scope', 'Calendar'];
  function sgCalendarDayController($scope, Calendar) {
    // Expose some scope variables to the controller
    // See the sgCalendarDayTable directive
    this.day = $scope.day;
    this.dayNumber = $scope.dayNumber;
    this.dayString = $scope.dayString;
    this.calendarData = function() {
      var pid, index, activeCalendars;
      if ($scope.calendar) {
        // A calendar is associated to the day; identify its index among active calendars
        pid = $scope.calendar;
        activeCalendars = _.filter(Calendar.$findAll(), { active: 1 });
        index = _.findIndex(activeCalendars, function(calendar) {
          return calendar.id == pid;
        });
        return { pid: pid, index: index };
      }

      return null;
    };
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgCalendarDay', sgCalendarDay);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /*
   * sgCalendarDayBlock - An event block to be displayed in a week
   * @memberof SOGo.SchedulerUI
   * @restrict element
   * @param {object} sgBlock - the event block definition
   * @param {function} sgClick - the function to call when clicking on a block.
   *        Two variables are available: clickEvent (the event that triggered the mouse click),
   *        and clickComponent (a Component object)
   *
   * @example:

   <sg-calendar-day-block
      ng-repeat="block in blocks[day]"
      sg-block="block"
      sg-click="open(clickEvent, clickComponent)" />
  */
  sgCalendarDayBlock.$inject = ['Calendar'];
  function sgCalendarDayBlock(Calendar) {
    return {
      restrict: 'E',
      scope: {
        block: '=sgBlock',
        clickBlock: '&sgClick'
      },
      replace: true,
      template: template,
      link: link
    };

    function template(tElem, tAttrs) {
      var p = _.has(tAttrs, 'sgCalendarGhost')? '' : '::';

      return [
        '<div class="sg-event"',
        //    Add a class while dragging
        '     ng-class="{\'sg-event--dragging\': block.dragging}">',
        '  <div class="eventInside"',
        '       ng-click="clickBlock({clickEvent: $event, clickComponent: block.component})">',
        //   Categories color stripes
        '    <div class="sg-category" ng-repeat="category in '+p+'block.component.categories"',
        '         ng-class="'+p+'(\'bg-category\' + category)"',
        '         ng-style="'+p+'{ right: ($index * 10) + \'%\' }"></div>',
        '    <div class="text">',
        //     Priority
        '      <span ng-show="'+p+'block.component.c_priority" class="sg-priority">{{'+p+'block.component.c_priority}}</span>',
        //     Summary
        '      {{ '+p+'block.component.summary }}',
        //     Icons
        '      <span class="sg-icons">',
        //       Component is reccurent
        '        <md-icon ng-if="'+p+'block.component.occurrenceId">repeat</md-icon>',
        //       Component has an alarm
        '        <md-icon ng-if="'+p+'block.component.c_nextalarm">alarm</md-icon>',
        //       Component is confidential
        '        <md-icon ng-if="'+p+'block.component.c_classification == 2">visibility_off</md-icon>',
        //       Component is private
        '        <md-icon ng-if="'+p+'block.component.c_classification == 1">vpn_key</md-icon>',
        '      </span>',
        //     Location
        '      <div class="secondary" ng-if="'+p+'block.component.c_location">',
        '        <md-icon>place</md-icon> <span ng-bind="'+p+'block.component.c_location"></span>',
        '      </div>',
        //     Calendar name
        '      <div class="secondary md-truncate" ng-if="'+p+'showCalendarName"',
        '        ng-bind="'+p+'block.component.calendarName"></div>',
        '    </div>',
        '  </div>',
        '  <div class="ghostStartHour" ng-if="block.startHour">{{ block.startHour }}</div>',
        '  <div class="ghostEndHour" ng-if="block.endHour">{{ block.endHour }}</div>',
        '</div>'
      ].join('');
    }

    function link(scope, iElement, attrs) {
      var pc, left, right;


      if (!_.has(attrs, 'sgCalendarGhost')) {

        // Compute position
        // Add right margin (10%) for easier creation of events by mouse dragging
        pc = 90 / scope.block.siblings;
        left = scope.block.position * pc;
        right = 100 - (scope.block.position + 1) * pc;

        // Set position
        iElement.css('left', left + '%');
        iElement.css('right', right + '%');
        if (!scope.block.component || !scope.block.component.c_isallday) {
          iElement.addClass('starts' + scope.block.start);
          iElement.addClass('lasts' + scope.block.length);
        }

        // Add class for user's participation state
        if (scope.block.userState)
          iElement.addClass('sg-event--' + scope.block.userState);

        if (scope.block.component) {
          // Show calendar name for subscriptions only
          scope.showCalendarName = Calendar.activeUser.login !== scope.block.component.c_owner;

          // Set background color
          iElement.addClass('bg-folder' + scope.block.component.pid);
          iElement.addClass('contrast-bdr-folder' + scope.block.component.pid);

          // Add class for transparency
          if (scope.block.component.c_isopaque === 0)
            iElement.addClass('sg-event--transparent');

          // Add class for cancelled event
          if (scope.block.component.c_status === 0)
            iElement.addClass('sg-event--cancelled');
        }

      }
    }
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgCalendarDayBlock', sgCalendarDayBlock);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /*
   * sgCalendarDayTable - Build list of blocks for a specific day
   * @memberof SOGo.SchedulerUI
   * @restrict element
   * @param {object} sgBlocks - the events blocks definitions for the current view
   * @param {string} sgDay - the day of the events to display
   * @param {function} sgClick - the function to call when clicking on a block.
   *        Two variables are available: event (the event that triggered the mouse click),
   *        and component (a Component object)
   *
   * @example:

   <sg-calendar-day-table
       sg-blocks="calendar.blocks"
       sg-day="20150330"
       sg-click="open({ event: clickEvent, component: clickComponent })"/>
  */
  function sgCalendarDayTable() {
    return {
      restrict: 'E',
      scope: {
        blocks: '=sgBlocks',
        day: '@sgDay',
        clickBlock: '&sgClick'
      },
      template: [
        '<sg-calendar-day-block',
        '  class="sg-draggable-calendar-block"',
        '  ng-repeat="block in blocks[day]"',
        '  sg-block="block"',
        '  sg-click="clickBlock({event: clickEvent, component: clickComponent})"/>'
      ].join('')
    };
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgCalendarDayTable', sgCalendarDayTable);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /*
   * sgCalendarBlock - Applied to an event ghost block to be displayed while dragging an event block. Each day of the
   *   calendar's view must have a ghost block.
   * @memberof SOGo.SchedulerUI
   * @restrict attribute
   *
   * @example:

   <sg-calendar-day-block
     sg-calendar-ghost
     sg-block="list.component.$ghost">/
  */
  sgCalendarGhost.$inject = ['$rootScope', '$timeout', 'CalendarSettings', 'Calendar', 'Component'];
  function sgCalendarGhost($rootScope, $timeout, CalendarSettings, Calendar, Component) {
    return {
      restrict: 'A',
      require: ['^sgCalendarDay', '^sgCalendarScrollView'],
      link: link
    };

    function link(scope, iElement, attrs, ctrls) {
      var domElement, calendarDayCtrl, scrollViewCtrl, calendarNumber, originalCalendarNumber;

      domElement = iElement[0];
      calendarDayCtrl = ctrls[0];
      scrollViewCtrl = ctrls[1];
      calendarNumber = -1;

      iElement.addClass('sg-event--ghost md-whiteframe-3dp ng-hide');

      // Listen on drag gestures
      var deregisterDragStart = $rootScope.$on('calendar:dragstart', initGhost);
      var deregisterDrag = $rootScope.$on('calendar:drag', updateGhost);
      var deregisterDragEnd = $rootScope.$on('calendar:dragend', hideGhost);

      // Deregister listeners on destroy
      scope.$on('$destroy', function() {
        deregisterDragStart();
        deregisterDrag();
        deregisterDragEnd();
      });

      function initGhost() {
        var pid, calendarData, userState;

        // Expose ghost block to the scope
        scope.block = Component.$ghost;

        calendarData = calendarDayCtrl.calendarData();
        if (calendarData) {
          // A calendar is associated to the day; this is a special multicolumn day view
          calendarNumber = calendarData.index;
          pid = calendarData.pid;
          originalCalendarNumber = scope.block.pointerHandler.originalCalendar.index;
        }

        if (!pid)
          pid = scope.block.component.pid;

        // Add class for user's participation state
        userState = scope.block.component.blocks[0].userState;
        if (userState)
          iElement.addClass('sg-event--' + userState);

        // Set background color
        iElement.addClass('bg-folder' + pid);
      }

      function hideGhost() {
        // Remove background color
        _.forEachRight(domElement.classList, function(c) {
          if (/^bg-folder/.test(c))
            iElement.removeClass(c);
        });
        // Hide ghost
        iElement.addClass('ng-hide');
      }

      function updateGhost() {
        // From SOGoEventDragGhostController._updateGhosts
        var showGhost, isRelative, isAllDay, currentDay,
            start, duration, durationLeft, maxDuration;

        showGhost = false;

        if (Calendar.$view && Calendar.$view.type == scrollViewCtrl.type) {
          // The view of the dragging block is the scrolling view of this ghost block

          isRelative   = scrollViewCtrl.type === 'multiday-allday';
          isAllDay     = scope.block.component.c_isallday;
          currentDay   = scope.block.pointerHandler.currentEventCoordinates.dayNumber;
          start        = scope.block.pointerHandler.currentEventCoordinates.start;
          durationLeft = scope.block.pointerHandler.currentEventCoordinates.duration;
          maxDuration  = CalendarSettings.EventDragDayLength - start;

          if (angular.isUndefined(durationLeft))
            return;
          duration = durationLeft;
          if (duration > maxDuration)
            duration = maxDuration;

          if (currentDay > -1 &&                                 // pointer is inside viewport
              ((calendarNumber < 0 &&                            // day is not associated to a calendar
                currentDay == calendarDayCtrl.dayNumber) ||      // pointer is inside ghost's day
               currentDay == calendarNumber &&                   // pointer is inside ghost's calendar
               (originalCalendarNumber == calendarNumber ||      // still inside original calendar
                !scope.block.component.isException)              // not an exception, event can be moved to a
                                                                 // different calendar
              )) {
            // This ghost block (day) is the first of the dragging event
            showGhost = true;
            if (!isRelative) {
              if (!isAllDay)
                // Show start hour and set the vertical position
                scope.block.startHour = getStartTime(start);
              // Set the height
              if (Calendar.$view.quarterHeight) {
                iElement.css('top', (start * Calendar.$view.quarterHeight) + 'px');
                iElement.css('height', (duration * Calendar.$view.quarterHeight) + 'px');
              }
              else
                iElement.css('top', Calendar.$view.topOffset + 'px');
            }
            iElement.removeClass('fg-folder' + scope.block.component.pid);
            iElement.removeClass('sg-event--ghost--last');
            iElement.addClass('sg-event--ghost--first');
            scope.block.isFirst = true;
          }

          durationLeft -= duration;
          currentDay++;

          // Search a subsequent block that matches the current ghost's day
          while (!showGhost && durationLeft && currentDay <= calendarDayCtrl.dayNumber) {
            duration = durationLeft;
            if (duration > CalendarSettings.EventDragDayLength)
              duration = CalendarSettings.EventDragDayLength;
            if (currentDay > -1 && currentDay == calendarDayCtrl.dayNumber) {
              // The dragging event overlaps this current ghost's day
              showGhost = true;
              if (!isRelative) {
                iElement.css('top', Calendar.$view.topOffset + 'px');
                // Set the height
                if (Calendar.$view.quarterHeight)
                  iElement.css('height', (duration * Calendar.$view.quarterHeight) + 'px');
              }
              iElement.removeClass('sg-event--ghost--first');
              iElement.removeClass('sg-event--ghost--last');
              // Trick for all-day events: set the foreground color to the background color so the event's title
              // is not visible but the div size remains identical.
              iElement.addClass('fg-folder' + scope.block.component.pid);
            }
            durationLeft -= duration;
            currentDay++;
            start = 0;
          }
          if (!durationLeft) {
            // Reached last ghost block
            if (isRelative) {
              iElement.addClass('sg-event--ghost--last');
            }
            else if (!isAllDay) {
              // Set the end date
              scope.block.endHour = getEndTime(start, duration);
            }
          }
        }

        if (showGhost)
          iElement.removeClass('ng-hide');
        else
          iElement.addClass('ng-hide');
      }

      function quartersToHM(quarters) {
        var minutes, hours, mins;

        minutes = quarters * 15;
        hours = Math.floor(minutes / 60);
        if (hours < 10)
            hours = "0" + hours;
        mins = minutes % 60;
        if (mins < 10)
            mins = "0" + mins;

        return "" + hours + ":" + mins;
      }

      function getStartTime(start) {
        return quartersToHM(start);
      }

      function getEndTime(start, duration) {
        var end = (start + duration) % CalendarSettings.EventDragDayLength;
        return quartersToHM(end);
      }
    }
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgCalendarGhost', sgCalendarGhost);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /*
   * sgCalendarListEvent - An event block to be displayed in a list
   * @memberof SOGo.SchedulerUI
   * @restrict element
   * @param {object} sgComponent - the Component object.
   * @param {function} sgClick - the function to call when clicking on the event.
   *        Two variables are available: clickEvent (the event that triggered the mouse click),
   *        and clickComponent (a Component object)
   *
   * @example:

  <sg-calendar-list-event
      ng-repeat="event in dayData.events"
      sg-component="event"
      sg-click="list.openEvent($event, clickComponent)" />
  */
  sgCalendarListEvent.$inject = ['CalendarSettings'];
  function sgCalendarListEvent(CalendarSettings) {
    return {
      restrict: 'E',
      scope: {
        component: '=sgComponent',
        clickComponent: '&sgClick'
      },
      replace: true,
      template: template,
      link: link
    };

    function template(tElem, tAttrs) {
      return [
        '<div class="sg-event"',
        '     ng-click="clickComponent({clickEvent: $event, clickComponent: component})">',
        '    <div class="text">',
        //     Priority
        '      <span ng-show="::component.c_priority" class="sg-priority" ng-bind="::component.c_priority"></span>',
        //   Categories color dots
        '      <div class="sg-category-dot-container">',
        '        <div class="sg-category-dot" ng-repeat="category in ::component.categories"',
        '             ng-class="::(\'bg-category\' + category)"></div>',
        '      </div>',
        //     Summary
        '      {{ ::component.c_title }}',
        '      <span class="sg-icons">',
        //       Component is reccurent
        '        <md-icon ng-if="::component.occurrenceId">repeat</md-icon>',
        //       Component has an alarm
        '        <md-icon ng-if="::component.c_nextalarm">alarm</md-icon>',
        //       Component is confidential
        '        <md-icon ng-if="::component.c_classification == 2">visibility_off</md-icon>',
        //       Component is private
        '        <md-icon ng-if="::component.c_classification == 1">vpn_key</md-icon>',
        '      </span>',
        //     Time
        '      <div class="secondary" ng-if="::!component.c_isallday">',
        '        <md-icon>access_time</md-icon> <span ng-bind="::component.starthour"></span>',
        '      </div>',
        //     Location
        '      <div class="secondary" ng-if="::component.c_location">',
        '        <md-icon>place</md-icon> <span ng-bind="::component.c_location"></span>',
        '      </div>',
        '    </div>',
        '</div>'
      ].join('');
    }

    function link(scope, iElement, attrs) {
      /**
       * No data binding here since the view is completely redraw when
       * a change is detected.
       */

      if (scope.component.viewable)
        iElement.addClass('md-clickable');

      // Add class for user's participation state
      if (scope.component.userstate)
        iElement.addClass('sg-event--' + scope.component.userstate);

      // Set background color
      iElement.addClass('bg-folder' + scope.component.pid);
      iElement.addClass('contrast-bdr-folder' + scope.component.pid);

      // Add class for transparency
      if (scope.component.c_isopaque === 0)
        iElement.addClass('sg-event--transparent');

      // Add class for cancelled event
      if (scope.component.c_status === 0)
        iElement.addClass('sg-event--cancelled');
    }
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgCalendarListEvent', sgCalendarListEvent);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {

  /**
   * sgCalendarListItem - A directive that defines the content of a md-list-item for a calendar.
   * @memberof SOGo.SchedulerUI
  */
  function sgCalendarListItem() {
    return {
      restrict: 'C',
      scope: {},
      bindToController: {
        calendar: '=sgCalendar'
      },
      template: [
        '<md-switch ng-model="$ctrl.calendar.active"',
        '           ng-class="$ctrl.calendar.getClassName(\'md-switch\')"',
        '           ng-true-value="1"',
        '           ng-false-value="0"',
        '           aria-label="' + l('Enable') + '"></md-switch>',
        '<p class="sg-item-name"',
        '   ng-dblclick="$ctrl.editFolder($event)">',
        '  <span ng-bind="$ctrl.calendar.name"></span>',
        '  <md-icon ng-if="$ctrl.calendar.$error" class="md-warn">error</md-icon>',
        '  <md-tooltip md-delay="1000"',
        '              md-autohide="true"',
        '              ng-bind="$ctrl.calendar.name"></md-tooltip>',
        '  <span class="sg-counter-badge ng-hide"',
        '        ng-show="calendar.activeTasks"',
        '        ng-bind="calendar.activeTasks"></span>',
        '</p>',
        '<md-input-container class="md-flex ng-hide">',
        '  <input class="sg-item-name" type="text"',
        '         aria-label="' + l('Name of the Calendar') + '"',
        '         ng-blur="$ctrl.saveFolder($event)"',
        '         sg-enter="$ctrl.saveFolder($event)"',
        '         sg-escape="$ctrl.revertEditing()" />',
        '</md-input-container>',
        '<md-icon class="md-menu md-secondary-container"',
        '           as-sortable-item-handle="as-sortable-item-handle"',
        '           md-colors="::{color: \'accent-400\'}">drag_handle</md-icon>',
        '<md-icon class="md-menu md-secondary-container sg-list-sortable-hide"',
        '         ng-click="$ctrl.showMenu($event)"',
        '         aria-label="' + l("Options") + '">more_vert</md-icon>'
      ].join(''),
      controller: 'sgCalendarListItemController',
      controllerAs: '$ctrl'
    };
  }

  /**
   * @ngInject
   */
  sgCalendarListItemController.$inject = ['$rootScope', '$scope', '$element', '$timeout', '$mdToast', '$mdPanel', '$mdMedia', '$mdSidenav', 'sgConstant', 'Dialog', 'Calendar'];
  function sgCalendarListItemController($rootScope, $scope, $element, $timeout, $mdToast, $mdPanel, $mdMedia, $mdSidenav, sgConstant, Dialog, Calendar) {
    var $ctrl = this;


    this.$onInit = function() {
      this.editMode = false;
    };


    this.$postLink = function() {
      this.clickableElement = $element.find('p')[0];
      this.nameElements = this.clickableElement.getElementsByClassName('sg-calendar-name');
      this.inputContainer = $element.find('md-input-container')[0];
      this.inputElement = $element.find('input')[0];
      this.moreOptionsButton = _.last($element.find('md-icon'));
      this.updateCalendarName();
    };


    this.updateCalendarName = function() {
      _.forEach(this.nameElements, function(e) {
        e.innerHTML = $ctrl.calendar.name;
      });
    };


    this.editFolder = function($event) {
      $event.stopPropagation();
      $event.preventDefault();
      this.editMode = true;
      this.inputElement.value = this.calendar.name;
      this.clickableElement.classList.add('ng-hide');
      this.inputContainer.classList.remove('ng-hide');
      if ($event.srcEvent && $event.srcEvent.type == 'touchend') {
        $timeout(function() {
          $ctrl.inputElement.focus();
          $ctrl.inputElement.select();
        }, 200); // delayed focus for iOS
      }
      else {
        this.inputElement.select();
        this.inputElement.focus();
      }
      if (this.panel) {
        this.panel.close();
      }
    };


    this.saveFolder = function($event) {
      if (this.inputElement.disabled)
        return;

      if (this.inputElement.value.length === 0)
        this.revertEditing();

      this.calendar.name = this.inputElement.value;
      this.inputElement.disabled = true;
      this.calendar.$rename()
        .then(function(data) {
          $ctrl.editMode = false;
          $ctrl.inputContainer.classList.add('ng-hide');
          $ctrl.clickableElement.classList.remove('ng-hide');
          $ctrl.updateCalendarName();
        }, function() {
          $ctrl.editMode = true;
          $ctrl.inputElement.value = $ctrl.calendar.name;
          $timeout(function() {
            $ctrl.inputElement.focus();
            $ctrl.inputElement.select();
          }, 200); // delayed focus for iOS
        })
        .finally(function() {
          $ctrl.inputElement.disabled = false;
        });
    };


    this.revertEditing = function() {
      this.editMode = false;
      this.clickableElement.classList.remove('ng-hide');
      this.inputContainer.classList.add('ng-hide');
      this.inputElement.value = this.calendar.name;
    };


    this.confirmDelete = function() {
      if (this.calendar.isSubscription) {
        // Unsubscribe without confirmation
        this.calendar.$delete()
          .catch(function(data, status) {
            Dialog.alert(l('An error occured while deleting the calendar "%{0}".', $ctrl.calendar.name),
                         l(data.error));
          });
      }
      else {
        Dialog.confirm(l('Warning'), l('Are you sure you want to delete the calendar "%{0}"?', this.calendar.name),
                       { ok: l('Delete') })
          .then(function() {
            $ctrl.calendar.$delete()
              .catch(function(data, status) {
                Dialog.alert(l('An error occured while deleting the calendar "%{0}".', $ctrl.calendar.name),
                             l(data.error));
              });
          });
      }
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
          calendar: this.calendar,
          editFolder: angular.bind(this, this.editFolder),
          confirmDelete: angular.bind(this, this.confirmDelete)
        },
        bindToController: true,
        controller: MenuController,
        controllerAs: '$menuCtrl',
        position: panelPosition,
        animation: panelAnimation,
        targetEvent: $event,
        templateUrl: 'UIxCalendarMenu',
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

      MenuController.$inject = ['mdPanelRef', '$mdDialog', 'FileUploader', 'User'];
      function MenuController(mdPanelRef, $mdDialog, FileUploader, User) {
        var $menuCtrl = this;

        this.showOnly = function() {
          _.forEach(Calendar.$findAll(), function(o) {
            if ($menuCtrl.calendar.id == o.id)
              o.active = 1;
            else
              o.active = 0;
          });
        };

        this.showAll = function() {
          _.forEach(Calendar.$findAll(), function(o) { o.active = 1; });
        };

        this.showProperties = function() {
          var color = this.calendar.color;
          $mdDialog.show({
            templateUrl: this.calendar.id + '/properties',
            controller: PropertiesDialogController,
            controllerAs: 'properties',
            clickOutsideToClose: true,
            escapeToClose: true,
            locals: {
              srcCalendar: this.calendar
            }
          }).catch(function() {
            // Restore original color when cancelling or closing the dialog
            $menuCtrl.calendar.color = color;
          });

          /**
           * @ngInject
           */
          PropertiesDialogController.$inject = ['$scope', '$mdDialog', 'srcCalendar'];
          function PropertiesDialogController($scope, $mdDialog, srcCalendar) {
            var vm = this;

            vm.emailRE = String.emailRE;
            vm.calendar = new Calendar(srcCalendar.$omit());
            vm.saveProperties = saveProperties;
            vm.close = close;

            $scope.$watch(function() { return vm.calendar.color; }, function() {
              srcCalendar.color = vm.calendar.color;
            });

            function saveProperties(form) {
              if (form.$valid) {
                vm.calendar.$save().then(function() {
                  // Refresh list instance
                  srcCalendar.init(vm.calendar.$omit());
                  $mdDialog.hide();
                }, function() {
                  form.$setPristine();
                });
              }
            }

            function close() {
              $mdDialog.cancel();
            }
          }
        };

        this.showLinks = function() {
          $mdDialog.show({
            parent: angular.element(document.body),
            clickOutsideToClose: true,
            escapeToClose: true,
            templateUrl: this.calendar.id + '/links',
            controller: LinksDialogController,
            controllerAs: 'links',
            locals: {
              calendar: this.calendar
            }
          });

          /**
           * @ngInject
           */
          LinksDialogController.$inject = ['$mdDialog', 'calendar'];
          function LinksDialogController($mdDialog, calendar) {
            var vm = this;
            vm.calendar = calendar;
            vm.close = close;
            vm.clipboard = clipboard

            function close() {
              $mdDialog.hide();
            }

            function clipboard(elem_id) {
              var linkUrl = document.getElementById(elem_id);
              navigator.clipboard.writeText(linkUrl.value);
            }
          }
        };

        this.importCalendar = function() {
          $mdDialog.show({
            parent: angular.element(document.body),
            targetEvent: $event,
            clickOutsideToClose: true,
            escapeToClose: true,
            templateUrl: 'UIxCalendarImportDialog', // subtemplate of UIxCalMainView.wox
            controller: CalendarImportDialogController,
            controllerAs: '$CalendarImportDialogController',
            locals: {
              folder: this.calendar
            }
          });

          /**
           * @ngInject
           */
          CalendarImportDialogController.$inject = ['scope', '$mdDialog', 'folder'];
          function CalendarImportDialogController(scope, $mdDialog, folder) {
            var vm = this;

            vm.uploader = new FileUploader({
              url: ApplicationBaseURL + [folder.id, 'import'].join('/'),
              autoUpload: true,
              queueLimit: 1,
              filters: [{ name: filterByExtension, fn: filterByExtension }],
              onSuccessItem: function(item, response, status, headers) {
                var msg;

                $mdDialog.hide();

                if (response.imported === 0)
                  msg = l('No event was imported.');
                else {
                  msg = l('A total of %{0} events were imported in the calendar.', response.imported);
                  $rootScope.$emit('calendars:list');
                }

                $mdToast.show(
                  $mdToast.simple()
                    .textContent(msg)
                    .position(sgConstant.toastPosition)
                    .hideDelay(3000));
              },
              onErrorItem: function(item, response, status, headers) {
                $mdToast.show({
                  template: [
                    '<md-toast>',
                    '  <div class="md-toast-content">',
                    '    <md-icon class="md-warn md-hue-1">error_outline</md-icon>',
                    '    <span>' + l('An error occurred while importing calendar.') + '</span>',
                    '  </div>',
                    '</md-toast>'
                  ].join(''),
                  position: sgConstant.toastPosition,
                  hideDelay: 3000
                });
              }
            });

            vm.close = function() {
              $mdDialog.hide();
            };

            function filterByExtension(item) {
              var isTextFile = item.type.indexOf('text') === 0 ||
                  /\.(ics)$/.test(item.name);

              if (!isTextFile)
                $mdToast.show({
                  template: [
                    '<md-toast>',
                    '  <div class="md-toast-content">',
                    '    <md-icon class="md-warn md-hue-1">error_outline</md-icon>',
                    '    <span>' + l('Select an iCalendar file (.ics).') + '</span>',
                    '  </div>',
                    '</md-toast>'
                  ].join(''),
                  position: sgConstant.toastPosition,
                  hideDelay: 3000
                });

              return isTextFile;
            }
          }
        };

        this.share = function() {
          // Fetch list of ACL users
          this.calendar.$acl.$users().then(function() {
            // Show ACL editor
            $mdDialog.show({
              templateUrl: $menuCtrl.calendar.id + '/UIxAclEditor', // UI/Templates/UIxAclEditor.wox
              controller: 'AclController', // from the ng module SOGo.Common
              controllerAs: 'acl',
              clickOutsideToClose: true,
              escapeToClose: true,
              locals: {
                usersWithACL: $menuCtrl.calendar.$acl.users,
                User: User,
                folder: $menuCtrl.calendar
              }
            });
          });
        };

      } // MenuController


    };
  }


  angular
    .module('SOGo.SchedulerUI')
    .controller('sgCalendarListItemController', sgCalendarListItemController)
    .directive('sgCalendarListItem', sgCalendarListItem);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /*
   * sgCalendarMonthDay - Build list of blocks for a specific day in a month
   * @memberof SOGo.SchedulerUI
   * @restrict element
   * @param {object} sgBlocks - the events blocks definitions for the current view
   * @param {string} sgDay - the day of the events to display
   * @param {function} sgClick - the function to call when clicking on a block.
   *        Two variables are available: event (the event that triggered the mouse click),
   *        and component (a Component object)
   *
   * @example:

   <sg-calendar-monh-day
      sg-blocks="calendar.blocks"
      sg-day="20150408"
       sg-click="open({ event: clickEvent, component: clickComponent })"/>
  */
  function sgCalendarMonthDay() {
    return {
      restrict: 'E',
      scope: {
        blocks: '=sgBlocks',
        day: '@sgDay',
        clickBlock: '&sgClick'
      },
      template: [
        '<sg-calendar-month-event',
        '  class="sg-draggable-calendar-block"',
        '  ng-repeat="block in blocks[day]"',
        '  sg-block="block"',
        '  sg-click="clickBlock({event: clickEvent, component: clickComponent})"/>'
      ].join('')
    };
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgCalendarMonthDay', sgCalendarMonthDay);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /*
   * sgCalendarMonthEvent - An event block to be displayed in a month
   * @memberof SOGo.Common
   * @restrict element
   * @param {object} sgBlock - the event block definition
   * @ngInject
   * @example:

   <sg-calendar-month-event
       ng-repeat="block in blocks[day]"
       sg-block="block"/>
  */
  function sgCalendarMonthEvent() {
    return {
      restrict: 'E',
      scope: {
        block: '=sgBlock',
        clickBlock: '&sgClick'
      },
      replace: true,
      template: template,
      link: link
    };

    function template(tElem, tAttrs) {
      var p = _.has(tAttrs, 'sgCalendarGhost')? '' : '::';

      return [
        '<div class="sg-event"',
        //  Add a class while dragging
        '   ng-class="{\'sg-event--dragging\': block.dragging}"',
        '   ng-click="clickBlock({clickEvent: $event, clickComponent: block.component})">',
        // Categories color stripes
        '  <div class="sg-category" ng-repeat="category in '+p+'block.component.categories"',
        '     ng-class="'+p+'(\'bg-category\' + category)"',
        '     ng-style="'+p+'{ right: ($index * 10) + \'%\' }"></div>',
        '  <div class="text">',
        //   Start hour
        '    <span class="secondary" ng-if="'+p+'(!block.component.c_isallday && block.isFirst)">{{ '+p+'block.component.startHour }}</span>',
        //   Priority
        '    <span ng-show="'+p+'block.component.c_priority" class="sg-priority">{{'+p+'block.component.c_priority}}</span>',
        //   Summary
        '    {{ '+p+'block.component.summary }}',
        '    <span class="sg-icons">',
        //     Component is reccurent
        '      <md-icon ng-if="'+p+'block.component.occurrenceId">repeat</md-icon>',
        //     Component has an alarm
        '      <md-icon ng-if="'+p+'block.component.c_nextalarm">alarm</md-icon>',
        //     Component is confidential
        '      <md-icon ng-if="'+p+'block.component.c_classification == 2">visibility_off</md-icon>',
        //     Component is private
        '      <md-icon ng-if="'+p+'block.component.c_classification == 1">vpn_key</md-icon>',
        '    </span>',
        '  </div>',
        '</div>'
      ].join('');
    }

    function link(scope, iElement, attrs) {
      if (!_.has(attrs, 'sgCalendarGhost')) {

        // Add class for user's participation state
        if (scope.block.userState)
          iElement.addClass('sg-event--' + scope.block.userState);

        if (scope.block.component) {
          // Set background color
          iElement.addClass('bg-folder' + scope.block.component.pid);

          // Add class for transparency
          if (scope.block.component.c_isopaque === 0)
            iElement.addClass('sg-event--transparent');

          // Add class for cancelled event
          if (scope.block.component.c_status === 0)
            iElement.addClass('sg-event--cancelled');
        }

      }
    }
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgCalendarMonthEvent', sgCalendarMonthEvent);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /*
   * sgCalendarPrintStylesheet - Add CSS stylesheet to fix printing of calendars
   * @memberof SOGo.SchedulerUI
   * @restrict attribute
   * @param {string} sgCalendarView - the name of the calendar view
   * @param {string} sgPageSize - the desired page size (letter, legal, etc)
   * @param {string} sgOrientation - the page orientation
   * @param {boolean} sgWorkingHoursOnly - hide off-working hours
   * @example:

    <sg-calendar-print-stylesheet
      sg-calendar-view="calendarView"
      sg-page-size="pageSize"
      sg-orientation="orientation"
      sg-working-hours-only="workingHoursOnly" />
  */
  function sgCalendarPrintStylesheet() {
    return {
      restrict: 'E',
      scope: {
        calendarView: '<sgCalendarView',
        pageSize: '<sgPageSize',
        orientation: '<sgOrientation',
        workingHoursOnly: '<sgWorkingHoursOnly',
      },
      replace: true,
      bindToController: true,
      controller: sgPrintStylesheetController,
      controllerAs: '$ctrl',
      template: [
        '<style type="text/css">',
        '  @page {',
        '    size: {{ $ctrl.pageSize }} {{ $ctrl.orientation }};',
        '    margin: 0;',
        '  }',
        '  @media print {',
        '    body {',
        '      padding: {{ $ctrl.pageMargin }};',
        '    }',
        '    [ui-view=calendars] .view-list {',
        '      height: {{ $ctrl.viewportHeight }};',
        '      overflow: hidden;',
        '    }',
        '    [ui-view=calendars] .calendarView {',
        '      transform: translateY(-{{ $ctrl.clipTop }});', // hide non-working hours at the top
        '      height: {{ $ctrl.viewHeight }};',
        '      position: relative;',
        '      overflow: hidden;', // hide non-working hours at the bottom
        '    }',
        '    [ui-view=calendars] .allDaysView {',
        '      max-height: {{ $ctrl.hourHeight }}{{ $ctrl.units }} !important;', // limit size of all-day cells
        '    }',
        '    [ui-view=calendars] .hours .hour,',
        '    [ui-view=calendars] .days .day .clickableHourCell {',
        '      min-height: {{ $ctrl.hourHeight }}{{ $ctrl.units }};',
        '      max-height: {{ $ctrl.hourHeight }}{{ $ctrl.units }};',
        '    }',
        '    {{ $ctrl.eventsPositions() }}',
        '  }',
        '</style>'
      ].join('\n')
    };
  }

  /**
   * @ngInject
   */
  sgPrintStylesheetController.$inject = ['$scope', 'Preferences'];
  function sgPrintStylesheetController($scope, Preferences) {
    var vm = this;
    var sizes = {
      portrait: {
        letter: [8.5, 11, 'in'],
        legal:  [8.5, 14, 'in'],
        a4:     [210, 297, 'mm']
      },
      landscape: {
        letter: [11, 8.5, 'in'],
        legal:  [14, 8.5, 'in'],
        a4:     [297, 210, 'mm']
      }
    };
    var margins = {
      letter: [0.4, 2.1],
      legal: [0.4, 2.1],
      a4: [10, 30]
    };

    this.$onInit = function() {
      $scope.$watchGroup([function() { return vm.pageSize; }, function() { return vm.workingHoursOnly; }], angular.bind(this, function() {
        var time;
        var size = sizes[this.orientation][this.pageSize];
        this.units = size[2];
        this.pageMargin = margins[this.pageSize][0] + this.units;
        this.viewportHeight = (size[1] - 2 * margins[this.pageSize][0]).toString() + this.units;
        this.hideHoursStart = 0;
        this.hideHoursEnd = 24;
        this.totalHours = 24;
        this.clipTop = 0;

        if (this.calendarView === 'month') {
          this.viewHeight = (size[1] - (3 * margins[this.pageSize][0])).toString() + this.units;
        }
        else {
          // Day-based views
          if (this.workingHoursOnly) {
            if (Preferences.defaults.SOGoDayEndTime) {
              time = Preferences.defaults.SOGoDayEndTime.split(':');
              this.hideHoursEnd = parseInt(time[0]);
              this.totalHours = this.hideHoursEnd;
            }
            if (Preferences.defaults.SOGoDayStartTime) {
              time = Preferences.defaults.SOGoDayStartTime.split(':');
              this.hideHoursStart = parseInt(time[0]);
              this.totalHours -= this.hideHoursStart;
            }
          }
          this.hourHeight = (size[1] - 2 * margins[this.pageSize][0] - margins[this.pageSize][1]) / this.totalHours;
          this.clipTop = (this.hourHeight * this.hideHoursStart).toString() + this.units;
          this.viewHeight = (this.hideHoursEnd * this.hourHeight).toString() + this.units;
        }
      }));
    };

    this.eventsPositions = function() {
      var i = 0, j;
      var css = [];

      if (this.calendarView === 'month') {
        css.push('[ui-view=calendars] .monthView md-grid-list { min-height: ' + this.viewHeight + '; }');
      }
      else {
        while (i <= 96) { // number of 15-minutes blocks in a day
          if (i <= (4 * this.hideHoursStart)) {
            j = (4 * this.hideHoursStart) - i;
            css.push('[ui-view=calendars] .sg-event.starts' + i +
                     ' .text { margin-top: ' + (this.hourHeight/4*j) + this.units + '; }');
          }
          css.push('[ui-view=calendars] .sg-event.starts' + i + ' { top: ' + (this.hourHeight/4*i) + this.units + '; }');
          css.push('[ui-view=calendars] .sg-event.lasts' + i + ' { height: ' + (this.hourHeight/4*i) + this.units + '; }');
          i++;
        }
      }
      return css.join('\n');
    };
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgCalendarPrintStylesheet', sgCalendarPrintStylesheet);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /*
   * sgCalendarScrollView - scrollable view that contains draggable elements
   * @memberof SOGo.SchedulerUI
   * @restrict attribute
   * @param {string} sgCalendarScrollView - the view type (multiday, multiday-allday, or monthly)
   *
   * @example:

   <md-content sg-calendar-scroll-view="multiday">
     ..
   </md-content>
  */
  sgCalendarScrollView.$inject = ['$rootScope', '$window', '$document', '$q', '$timeout', '$mdGesture', 'Calendar', 'Component', 'Preferences'];
  function sgCalendarScrollView($rootScope, $window, $document, $q, $timeout, $mdGesture, Calendar, Component, Preferences) {
    return {
      restrict: 'A',
      scope: {
        type: '@sgCalendarScrollView'
      },
      controller: sgCalendarScrollViewController,
      link: function(scope, element, attrs, controller) {
        var view, type, isMultiColumn = false;

        view = null;
        type = scope.type; // multiday, multiday-allday, monthly, unknown?
        isMultiColumn = (element.attr('sg-view') == 'multicolumndayview');

        // Expose isMultiColumn in the controller
        // See sgNowLine directive
        controller.isMultiColumn = isMultiColumn;

        // Update the "view" object literal once the Angular template has been transformed
        $timeout(initView);

        // Deregister listeners when destroying the view
        scope.$on('$destroy', function() {
          if (view) {
            view.$destroy();
          }
        });

        function initView() {
          view = new sgScrollView(element, type);

          if (type != 'monthly') {
            // Scroll to the day start hour defined in the user's defaults
            var time, hourCell, quartersOffset;
            if (Preferences.defaults.SOGoDayStartTime) {
              time = Preferences.defaults.SOGoDayStartTime.split(':');
              hourCell = document.getElementById('hour' + parseInt(time[0]));
              quartersOffset = parseInt(time[1]) * view.quarterHeight;
              view.element.scrollTop = hourCell.offsetTop + quartersOffset;
            }
          }

          // Expose quarter height to the controller
          // See sgNowLine directive
          controller.quarterHeight = view.quarterHeight;
        }

        /**
         * sgScrollView
         */
        function sgScrollView($element, type) {
          this.$element = $element;
          this.element = $element[0];
          this.type = type;
          this.quarterHeight = this.getQuarterHeight();
          this.scrollStep = 6 * this.quarterHeight;
          this.dayNumbers = this.getDayNumbers();
          this.maxX = this.getMaxColumns();

          // Listen to dragstart and dragend events
          this.deregisterDragStart = $rootScope.$on('calendar:dragstart', angular.bind(this, this.onDragStart));
          this.deregisterDragStop = $rootScope.$on('calendar:dragend', angular.bind(this, this.onDragEnd));

          this.bindedUpdateCoordinates = angular.bind(this, this.updateCoordinates);
          this.bindedUpdateFromPointerHandler = angular.bind(this, this.updateFromPointerHandler);

          // Compute coordinates of view element; recompute it on window resize
          this.updateCoordinates();
          angular.element($window).on('resize', this.bindedUpdateCoordinates);
        }

        sgScrollView.prototype = {

          $destroy: function() {
            this.deregisterDragStart();
            this.deregisterDragStop();
            this.$element.off('mousemove', this.bindedUpdateFromPointerHandler);
            angular.element($window).off('resize', this.bindedUpdateCoordinates);
          },

          onDragStart: function() {
            this.$element.on('mousemove', this.bindedUpdateFromPointerHandler);
            this.updateCoordinates();
            this.updateFromPointerHandler();
          },

          onDragEnd: function() {
            this.$element.off('mousemove', this.bindedUpdateFromPointerHandler);
            Calendar.$view = null;
          },

          getQuarterHeight: function() {
            var hour0, hour23, height = null;

            hour0 = document.getElementById('hour0');
            hour23 = document.getElementById('hour23');
            if (hour0 && hour23)
              height = ((hour23.offsetTop - hour0.offsetTop) / (23 * 4));

            return height;
          },


          getDayDimensions: function(viewLeft) {
            var width, height, leftOffset, topOffset, nodes, domRect, tileHeader;

            height = width = leftOffset = topOffset = 0;
            nodes = this.element.getElementsByClassName('day');

            if (nodes.length > 0) {
              domRect = nodes[0].getBoundingClientRect();
              height = domRect.height;
              width = domRect.width;
              leftOffset = domRect.left - viewLeft;
              tileHeader = nodes[0].getElementsByClassName('sg-calendar-tile-header');
              if (tileHeader.length > 0)
                topOffset = tileHeader[0].clientHeight;
            }

            return { height: height, width: width, offset: { left: leftOffset, top: topOffset } };
          },


          getDayNumbers: function() {
            var viewType = null, days, total, sum;

            days = this.element.getElementsByTagName('sg-calendar-day');

            return _.map(days, function(el, index) {
              if (isMultiColumn)
                return index;
              else
                return parseInt(el.attributes['sg-day-number'].value);
            });
          },


          getMaxColumns: function() {
            var mdGridList, max = 0;

            if (this.type == 'monthly') {
              mdGridList = this.element.getElementsByTagName('md-grid-list')[0];
              max = parseInt(mdGridList.attributes['md-cols'].value) - 1;
            }
            else {
              max = this.element.getElementsByClassName('day').length - 1;
            }

            return max;
          },

          // View has been resized;
          // Compute the view's origins (x, y), a day's dimensions and left margin.
          updateCoordinates: function() {
            var domRect, dayDimensions;

            domRect = this.element.getBoundingClientRect();
            dayDimensions = this.getDayDimensions(domRect.left);

            angular.extend(this, {
              coordinates: {
                x: domRect.left,
                y: domRect.top
              },
              dayHeight: dayDimensions.height,
              dayWidth: dayDimensions.width,
              daysOffset: dayDimensions.offset.left,
              topOffset: dayDimensions.offset.top
            });
          },


          // From SOGoScrollController.updateFromPointerHandler
          updateFromPointerHandler: function() {
            var pointerHandler, pointerCoordinates, now, scrollY, minY, delta;

            pointerHandler = Component.$ghost.pointerHandler;
            if (this.coordinates && pointerHandler) {
              pointerCoordinates = pointerHandler.getContainerBasedCoordinates(this);

              if (pointerCoordinates) {
                // Pointer is inside view; Adjust scrollbar if necessary
                Calendar.$view = this;
                now = new Date().getTime();
                if (!this.lastScroll || now > this.lastScroll + 100) {
                  this.lastScroll = now;
                  scrollY = pointerCoordinates.y - this.scrollStep;
                  if (scrollY < 0) {
                    minY = -this.element.scrollTop;
                    if (scrollY < minY)
                      scrollY = minY;
                    this.element.scrollTop += scrollY;
                  }
                  else {
                    scrollY = pointerCoordinates.y + this.scrollStep;
                    delta = scrollY - this.element.clientHeight;
                    if (delta > 0) {
                      this.element.scrollTop += delta;
                    }
                  }
                }
              }
            }
          }


        };
      }
    };
  }

  sgCalendarScrollViewController.$inject = ['$scope'];
  function sgCalendarScrollViewController($scope) {
    // Expose the view type to the controller
    // See sgCalendarGhost directive
    this.type = $scope.type;
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgCalendarScrollView', sgCalendarScrollView);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /*
   * sgCategoryStylesheet - Add CSS stylesheet for a category's color
   * @memberof SOGo.SchedulerUI
   * @restrict attribute
   * @param {object} ngModel - the object literal describing the category
   * @example:

    <sg-category-stylesheet
         ng-repeat="category in categories"
         ng-model="category" />
  */
  function sgCategoryStylesheet() {
    return {
      restrict: 'E',
      require: 'ngModel',
      scope: {
        ngModel: '='
      },
      replace: true,
      template: [
        '<style type="text/css">',
        /* Background color */
        '  .bg-category{{ ngModel.id | cssEscape }} {',
        '    background-color: {{ ngModel.color }} !important;',
        '  }',
        /* Border color */
        '  .bdr-category{{ ngModel.id | cssEscape }} {',
        '    border-color: {{ ngModel.color }} !important;',
        '  }',
        '</style>'
      ].join('')
    };
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgCategoryStylesheet', sgCategoryStylesheet);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {
  'use strict';

  /*
   * sgDraggableCalendarBlock - Make an element draggable
   * @memberof SOGo.SchedulerUI
   * @restrict class or attribute
   *
   * @example:

   <div class="sg-draggable-calendar-block"/>
  */
  sgDraggableCalendarBlock.$inject = ['$rootScope', '$timeout', '$log', 'Preferences', 'Calendar', 'CalendarSettings', 'Component'];
  function sgDraggableCalendarBlock($rootScope, $timeout, $log, Preferences, Calendar, CalendarSettings, Component) {
    return {
      restrict: 'CA',
      require: '^sgCalendarDay',
      link: link
    };

    function link(scope, element, attrs, calendarDayCtrl) {
      if (scope.block) {
        if (scope.block.component.editable && !scope.block.userState) {
          // Add dragging grips to existing event block
          initGrips();
        }
        else {
          element.removeClass('sg-draggable-calendar-block');
          return;
        }
      }

      // Start dragging on mousedown
      element.on('mousedown', onDragDetect);
      element.on('dblclick', onDoubleClick);

      // Deregister listeners when removing the element from the DOM
      scope.$on('$destroy', function() {
        element.off('mousedown', onDragDetect);
        element.off('mousemove', onDrag);
      });

      function initGrips() {
        var component, dayIndex, blockIndex, isFirstBlock, isLastBlock,
            dragGrip, leftGrip, rightGrip, topGrip, bottomGrip;

        // Don't show grips for blocks of less than 45 minutes
        if (scope.block.length < 3) return;

        component = scope.block.component;
        dayIndex = scope.block.dayIndex;
        blockIndex = _.findIndex(component.blocks, ['dayIndex', dayIndex]);
        isFirstBlock = (blockIndex === 0);
        isLastBlock = (blockIndex === component.blocks.length - 1);

        dragGrip = angular.element('<div class="dragGrip"></div>');
        dragGrip.addClass('bdr-folder' + component.pid);

        if (component.c_isallday ||
            element[0].parentNode.tagName === 'SG-CALENDAR-MONTH-DAY') {
          if (isFirstBlock) {
            leftGrip = angular.element('<div class="dragGrip-left"></div>').append(dragGrip);
            element.append(leftGrip);
          }
          if (isLastBlock) {
            rightGrip = angular.element('<div class="dragGrip-right"></div>').append(dragGrip.clone());
            element.append(rightGrip);
          }
        }
        else {
          if (isFirstBlock) {
            topGrip = angular.element('<div class="dragGrip-top"></div>').append(dragGrip);
            element.append(topGrip);
          }
          if (isLastBlock) {
            bottomGrip = angular.element('<div class="dragGrip-bottom"></div>').append(dragGrip.clone());
            element.append(bottomGrip);
          }
        }
      }

      function onDragDetect(ev) {
        var dragMode, pointerHandler, hasVerticalScrollbar, rect, scrollableZone;

        ev.stopPropagation();

        hasVerticalScrollbar = ev.target.scrollHeight > ev.target.clientHeight + 1;

        if (hasVerticalScrollbar) {
          // Check if mouse click is inside scrollbar
          rect = ev.target.getBoundingClientRect();
          scrollableZone = rect.left + rect.width - 18;
          if (ev.pageX > scrollableZone)
            return;
        }

        dragMode = 'move-event';

        if (scope.block && scope.block.component) {
          // Move or resize existing component
          if (ev.target.className == 'dragGrip-top' ||
              ev.target.className == 'dragGrip-left')
            dragMode = 'change-start';
          else if (ev.target.className == 'dragGrip-bottom' ||
                   ev.target.className == 'dragGrip-right' )
            dragMode = 'change-end';
        }
        else {
          // Create new component from dragging
          dragMode = 'change-end';
        }

        // Initialize pointer handler
        pointerHandler = new SOGoEventDragPointerHandler(dragMode);
        pointerHandler.initFromEvent(ev);

        // Update Component.$ghost
        Component.$ghost.pointerHandler = pointerHandler;

        // Stop dragging on the next "mouseup"
        angular.element(document).one('mouseup', onDragEnd);

        // Listen to mousemove and start dragging when mouse has moved from at least 3 pixels
        angular.element(document).on('mousemove', onDrag);
      }

      function dragStart(ev) {
        var block, eventType, isHourCell, isMonthly, startDate, newData, newComponent, pointerHandler, calendarData;

        isHourCell = element.hasClass('clickableHourCell');
        isMonthly = (element[0].parentNode.tagName == 'SG-CALENDAR-MONTH-DAY') ||
          element.hasClass('clickableDayCell');

        calendarData = calendarDayCtrl.calendarData();

        if (scope.block && scope.block.component) {
          // Move or resize existing component
          block = scope.block;
        }
        else {
          // Create new component from dragging
          startDate = calendarDayCtrl.dayString.parseDate(Preferences.$mdDateLocaleProvider, '%Y-%m-%e');
          newData = {
            type: 'appointment',
            pid: calendarData? calendarData.pid : Calendar.$defaultCalendar(),
            summary: l('New Event'),
            startDate: startDate,
            isAllDay: isHourCell? 0 : 1
          };
          newComponent = new Component(newData);
          block = {
            component: newComponent,
            dayNumber: calendarDayCtrl.dayNumber,
            length: 0
          };
          block.component.blocks = [block];
        }

        // Determine event type
        eventType = 'multiday';
        if (isMonthly)
          eventType = 'monthly';
        else if (block.component.c_isallday)
          eventType = 'multiday-allday';

        // Mark all blocks as being dragged
        _.forEach(block.component.blocks, function(b) {
          b.dragging = true;
        });

        // Update pointer handler
        pointerHandler = Component.$ghost.pointerHandler;
        pointerHandler.prepareWithEventType(eventType);
        pointerHandler.initFromBlock(block);
        if (calendarData)
          // When the day is associated to a calendar, the day number becomes the calendar index
          // among the active calendars
          pointerHandler.initFromCalendar(calendarData);

        // Update Component.$ghost
        Component.$ghost.component = block.component;

        $log.debug('emit calendar:dragstart ' + eventType);
        $rootScope.$emit('calendar:dragstart');
      }

      function onDrag(ev) {
        var pointerHandler = Component.$ghost.pointerHandler;

        // Update
        // - currentCoordinates
        // - currentViewCoordinates
        // - currentEventCoordinates
        $timeout(function() {
          pointerHandler.updateFromEvent(ev);
        });
      }

      function onDragEnd(ev) {
        var block, pointer;

        block = scope.block;
        pointer = Component.$ghost.pointerHandler;

        // Deregister mouse events
        angular.element(document).off('mousemove', onDrag);

        if (pointer.dragHasStarted) {
          $rootScope.$emit('calendar:dragend');
          pointer.dragHasStarted = false;
        }

        // Unmark all blocks as being dragged
        if (block && block.component)
          _.forEach(block.component.blocks, function(b) {
            b.dragging = false;
          });
      }

      function onDoubleClick(ev) {
        var block, pointerHandler, startDate, newData, newComponent;
        
        startDate = calendarDayCtrl.dayString.parseDate(Preferences.$mdDateLocaleProvider, '%Y-%m-%e');
        newData = {
          type: 'appointment',
          pid: Calendar.$defaultCalendar(),
          summary: l('New Event'),
          startDate: startDate,
          isAllDay: 1
        };
        newComponent = new Component(newData);
        block = {
          component: newComponent,
          dayNumber: calendarDayCtrl.dayNumber,
          length: 0
        };
        block.component.blocks = [block];

        pointerHandler = new SOGoEventDragPointerHandler('double-click');
        pointerHandler.initFromBlock(block);
        pointerHandler.currentEventCoordinates.duration = 0;
        
        // Update Component.$ghost
        Component.$ghost.pointerHandler = pointerHandler;

        Component.$ghost.component = block.component;
        $rootScope.$emit('calendar:doubleclick');
      }

      /**
       * SOGoCoordinates
       */
      function SOGoCoordinates() {
      }

      SOGoCoordinates.prototype = {
        x: -1,
        y: -1,

        getDelta: function SC_getDelta(otherCoordinates) {
          var delta = new SOGoCoordinates();
          delta.x = this.x - otherCoordinates.x;
          delta.y = this.y - otherCoordinates.y;

          if (Calendar.$view) {
            delta.days = Calendar.$view.dayNumbers[this.x] - Calendar.$view.dayNumbers[otherCoordinates.x];
          }

          return delta;
        },

        getDistance: function SC_getDistance(otherCoordinates) {
          var delta = this.getDelta(otherCoordinates);

          return Math.sqrt(delta.x * delta.x + delta.y * delta.y);
        },

        clone: function SC_clone() {
          var coordinates = new SOGoCoordinates();
          coordinates.x = this.x;
          coordinates.y = this.y;

          return coordinates;
        }
      };

      /**
       * SOGoEventDragEventCoordinates
       */
      function SOGoEventDragEventCoordinates(eventType) {
        this.setEventType(eventType);
      }

      SOGoEventDragEventCoordinates.prototype = {
        dayNumber: -1,
        weekDay: -1,
        start: -1,
        duration: -1,

        eventType: null,

        setEventType: function(eventType) {
          this.eventType = eventType;
        },

        initFromBlock: function(block) {
          var prevDayNumber = -1;

          if (this.eventType === 'monthly') {
            this.start = 0;
            this.duration = block.component.blocks.length * CalendarSettings.EventDragDayLength;
          }
          else {
            // Get the start (first quarter) from the event's first block
            // Compute overall length
            this.start = block.component.blocks[0].start;
            this.duration = _.sumBy(block.component.blocks, function(b) {
              var delta, currentDayNumber;

              currentDayNumber = b.dayNumber;
              if (prevDayNumber < 0)
                delta = 0;
              else
                delta = currentDayNumber - prevDayNumber - 1;
              prevDayNumber = currentDayNumber;

              return b.length + delta * CalendarSettings.EventDragDayLength;
            });
          }
        },

        initFromCalendar: function(calendarNumber) {
          this.dayNumber = calendarNumber;
        },

        getDelta: function(otherCoordinates) {
          var delta = new SOGoEventDragEventCoordinates();
          delta.dayNumber = (this.dayNumber - otherCoordinates.dayNumber);
          delta.start = (this.start - otherCoordinates.start);
          delta.duration = (this.duration - otherCoordinates.duration);

          return delta;
        },

        _quartersToHM: function(quarters) {
          var minutes = quarters * 15;
          var hours = Math.floor(minutes / 60);
          if (hours < 10)
            hours = "0" + hours;
          var mins = minutes % 60;
          if (mins < 10)
            mins = "0" + mins;

          return "" + hours + ":" + mins;
        },

        getStartTime: function() {
          return this._quartersToHM(this.start);
        },

        getEndTime: function() {
          var end = (this.start + this.duration) % CalendarSettings.EventDragDayLength;
          return this._quartersToHM(end);
        },

        clone: function() {
          var coordinates = new SOGoEventDragEventCoordinates();
          coordinates.dayNumber = this.dayNumber;
          coordinates.start = this.start;
          coordinates.duration = this.duration;

          return coordinates;
        }
      };

      /**
       * SOGoEventDragPointerHandler
       */
      function SOGoEventDragPointerHandler(dragMode) {
        this.dragMode = dragMode;
      }

      SOGoEventDragPointerHandler.prototype = {
        // Pointer absolute xy coordinates within page
        originalCoordinates: null,
        currentCoordinates: null,

        // Pointer relative xy coordinates within view (row-column)
        originalViewCoordinates: null,
        currentViewCoordinates: null,

        // Event start-duration coordinates
        originalEventCoordinates: null,
        currentEventCoordinates: null,

        originalCalendar: null,

        dragHasStarted: false,

        // Function to return the day and quarter coordinates of the pointer cursor
        // within the day view
        getEventViewCoordinates: null,

        initFromBlock: function SEDPH_initFromBlock(block) {
          this.currentEventCoordinates = new SOGoEventDragEventCoordinates(this.eventType);
          this.originalEventCoordinates = new SOGoEventDragEventCoordinates(this.eventType);
          this.originalEventCoordinates.initFromBlock(block);
        },

        initFromEvent: function SEDPH_initFromEvent(event) {
          this.currentCoordinates = new SOGoCoordinates();
          this.updateFromEvent(event);
          this.originalCoordinates = this.currentCoordinates.clone();
        },

        initFromCalendar: function SEDPH_initFromCalendar(calendarData) {
          this.originalCalendar = calendarData;
          this.currentEventCoordinates.initFromCalendar(calendarData.index);
          this.originalEventCoordinates.initFromCalendar(calendarData.index);
        },

        // Method continuously called while dragging
        updateFromEvent: function SEDPH_updateFromEvent(event) {
          // Event here is a DOM event, not a calendar event!
          this.currentCoordinates.x = event.pageX;
          this.currentCoordinates.y = event.pageY;

          // From SOGoEventDragGhostController.updateFromPointerHandler
          if (this.dragHasStarted && Calendar.$view) {
            var newEventCoordinates = this.getEventViewCoordinates(Calendar.$view);
            if (!this.originalViewCoordinates) {
              this.originalViewCoordinates = this.getEventViewCoordinates(Calendar.$view, this.originalCoordinates);
              if (Component.$ghost.component.isNew) {
                this.setTimeFromQuarters(Component.$ghost.component.start, this.originalViewCoordinates.y);
                $log.debug('new event start date ' + Component.$ghost.component.start);
              }
            }
            if (!this.currentViewCoordinates ||
                !newEventCoordinates ||
                newEventCoordinates.x != this.currentViewCoordinates.x ||
                newEventCoordinates.y != this.currentViewCoordinates.y) {
              this.currentViewCoordinates = newEventCoordinates;
              if (this.originalViewCoordinates) {
                if (!newEventCoordinates) {
                  this.currentViewCoordinates = this.originalViewCoordinates.clone();
                }
                this.updateEventCoordinates();
              }
            }
          }
          else if (this.originalCoordinates &&
                   this.currentCoordinates &&
                   !this.dragHasStarted) {
            var distance = this.getDistance();
            if (distance > 3) {
              this.dragHasStarted = true;
              dragStart(event);
            }
          }
        },

        // SOGoEventDragGhostController._updateCoordinates
        // Extend this.currentCoordinates with start, dayNumber and duration
        updateEventCoordinates: function SEDGC__updateCoordinates() {
          var newDuration;

          // Compute delta wrt to position of mouse at dragstart on the day/quarter grid
          var delta = this.currentViewCoordinates.getDelta(this.originalViewCoordinates);
          var deltaQuarters = delta.days * CalendarSettings.EventDragDayLength + delta.y;
          $log.debug('quarters delta ' + deltaQuarters);

          if (angular.isUndefined(this.originalEventCoordinates.start)) {
            // Creating new appointment from DnD
            this.originalEventCoordinates.dayNumber = Calendar.$view.dayNumbers[this.originalViewCoordinates.x];
            this.originalEventCoordinates.start = this.originalViewCoordinates.y;
          }
          else if (this.originalEventCoordinates.dayNumber < 0) {
            this.originalEventCoordinates.dayNumber = Calendar.$view.dayNumbers[scope.block.component.blocks[0].dayIndex];
          }
          // if (currentView == "multicolumndayview")
          //   this._updateMulticolumnViewDayNumber_SEDGC();
          // else
          this.currentEventCoordinates.dayNumber = this.originalEventCoordinates.dayNumber;

          if (this.dragMode == "move-event") {
            this.currentEventCoordinates.start = this.originalEventCoordinates.start + deltaQuarters;
            this.currentEventCoordinates.duration = this.originalEventCoordinates.duration;
          }
          else {
            if (this.dragMode == "change-start") {
              newDuration = this.originalEventCoordinates.duration - deltaQuarters;
              if (newDuration > 0) {
                this.currentEventCoordinates.start = this.originalEventCoordinates.start + deltaQuarters;
                this.currentEventCoordinates.duration = newDuration;
              }
              else if (newDuration < 0) {
                this.currentEventCoordinates.start = (this.originalEventCoordinates.start + this.originalEventCoordinates.duration);
                this.currentEventCoordinates.duration = -newDuration;
              }
            }
            else if (this.dragMode == "change-end") {
              newDuration = this.originalEventCoordinates.duration + deltaQuarters;
              if (newDuration > 0) {
                this.currentEventCoordinates.start = this.originalEventCoordinates.start;
                this.currentEventCoordinates.duration = newDuration;
              }
              else if (newDuration < 0) {
                this.currentEventCoordinates.start = this.originalEventCoordinates.start + newDuration;
                this.currentEventCoordinates.duration = -newDuration;
              }
            }
          }

          var deltaDays;
          if (this.currentEventCoordinates.start < 0) {
            deltaDays = Math.ceil(-this.currentEventCoordinates.start / CalendarSettings.EventDragDayLength);
            this.currentEventCoordinates.start += deltaDays * CalendarSettings.EventDragDayLength;
            this.currentEventCoordinates.dayNumber -= deltaDays;
          }
          else if (this.currentEventCoordinates.start >= CalendarSettings.EventDragDayLength) {
            deltaDays = Math.floor(this.currentEventCoordinates.start / CalendarSettings.EventDragDayLength);
            this.currentEventCoordinates.start -= deltaDays * CalendarSettings.EventDragDayLength;
            this.currentEventCoordinates.dayNumber += deltaDays;
          }

          //$log.debug('event coordinates ' + JSON.stringify(this.currentEventCoordinates));
          $rootScope.$emit('calendar:drag');
        },

        // SOGoEventDragPointerHandler.getContainerBasedCoordinates
        getContainerBasedCoordinates: function SEDPH_getCBC(view, pointerCoordinates) {
          var currentCoordinates = pointerCoordinates || this.currentCoordinates;
          var coordinates = currentCoordinates.getDelta(view.coordinates);
          var container = view.element;

          if (coordinates.x < view.daysOffset || coordinates.x > container.clientWidth ||
              coordinates.y < 0 || coordinates.y > container.clientHeight)
            coordinates = null;

          return coordinates;
        },

        prepareWithEventType: function SEDPH_prepareWithEventType(eventType) {
          var methods = { "multiday": this.getEventMultiDayViewCoordinates,
                          "multiday-allday": this.getEventMultiDayAllDayViewCoordinates,
                          "monthly": this.getEventMonthlyViewCoordinates,
                          "unknown": null };
          var method = methods[eventType];
          this.eventType = eventType;
          this.getEventViewCoordinates = method;
        },

        getEventMultiDayViewCoordinates: function SEDPH_gEMultiDayViewC(view, pointerCoordinates) {
          /* x = day; y = quarter */
          var coordinates = this.getEventMultiDayAllDayViewCoordinates(view, pointerCoordinates); // get the x coordinate
          if (coordinates) {
            var quarterHeight = view.quarterHeight;
            var pxCoordinates = this.getContainerBasedCoordinates(view, pointerCoordinates);
            pxCoordinates.y += view.element.scrollTop;

            coordinates.y = Math.floor((pxCoordinates.y - CalendarSettings.EventDragHorizontalOffset) / quarterHeight);
            var maxY = CalendarSettings.EventDragDayLength - 1;
            if (coordinates.y < 0)
              coordinates.y = 0;
            else if (coordinates.y > maxY)
              coordinates.y = maxY;
          }

          return coordinates;
        },
        getEventMultiDayAllDayViewCoordinates: function SEDPH_gEMultiDayADVC(view, pointerCoordinates) {
          /* x = day; y = quarter */
          var coordinates;

          var pxCoordinates = this.getContainerBasedCoordinates(view, pointerCoordinates);
          if (pxCoordinates) {
            coordinates = new SOGoCoordinates();

            var dayWidth = view.dayWidth;
            var daysOffset = view.daysOffset;

            coordinates.x = Math.floor((pxCoordinates.x - daysOffset) / dayWidth);
            var minX = 0;
            var maxX = Calendar.$view.maxX;
            if (this.dragMode != 'move-event') {
              var calendarData = calendarDayCtrl.calendarData();
              if (calendarData)
                // Resizing an event can't span a different day when in multicolumn view
                minX = maxX = calendarData.index;
            }
            if (coordinates.x < minX)
              coordinates.x = minX;
            else if (coordinates.x > maxX)
              coordinates.x = maxX;
            coordinates.y = 0;
          }
          else {
            coordinates = null;
          }

          return coordinates;
        },
        getEventMonthlyViewCoordinates: function SEDPH_gEMonthlyViewC(view, pointerCoordinates) {
          /* x = day; y = quarter */
          var coordinates;

          var pxCoordinates = this.getContainerBasedCoordinates(view, pointerCoordinates);
          if (pxCoordinates) {
            coordinates = new SOGoCoordinates();

            var maxX = view.maxX;
            var daysTopOffset = 0;
            var dayWidth = view.dayWidth;
            var daysOffset = view.daysOffset;
            var dayHeight = view.dayHeight;
            var daysY = Math.floor((pxCoordinates.y - daysTopOffset) / dayHeight);
            if (daysY < 0)
              daysY = 0;

            coordinates.x = Math.floor((pxCoordinates.x - daysOffset) / dayWidth);
            if (coordinates.x < 0)
              coordinates.x = 0;
            else if (coordinates.x > maxX)
              coordinates.x = maxX;
            coordinates.x += (maxX + 1) * daysY;
            coordinates.y = 0;
          }
          else {
            coordinates = null;
          }

          return coordinates;
        },

        getDistance: function SEDPH_getDistance() {
          return this.currentCoordinates.getDistance(this.originalCoordinates);
        },

        setTimeFromQuarters: function SEDPH_setTimeFromQuarters(date, quarters) {
          var hours, minutes;
          hours = Math.floor(quarters / 4);
          minutes = (quarters % 4) * 15;
          date.setHours(hours, minutes);
        }
      };
    }
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgDraggableCalendarBlock', sgDraggableCalendarBlock);
})();

/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {

  /**
   * sgFreebusy - A directive that watches some attributes of a component. Any child component
   * should depends on this directive and extend the 'onUpdate' method instead of creating new
   * independent watchers.
   * @memberof SOGo.SchedulerUI
  */
  function sgFreebusy() {
    return {
      restrict: 'C',
      scope: {},
      bindToController: {
        component: '=sgComponent'
      },
      controller: sgFreebusyController
    };
  }

  /**
   * @ngInject
   */
  sgFreebusyController.$inject = ['$scope', '$element', '$q'];
  function sgFreebusyController($scope, $element, $q) {
    var $ctrl = this;

    this.$onInit = function () {
      var watchedAttrs = ['start', 'end', 'attendees'];

      $scope.$watch(
        function() {
          return $ctrl.component? {
            start: $ctrl.component.start,
            end: $ctrl.component.end,
            attendees: _.keys($ctrl.component.$attendees.$futureFreebusyData)
          } : null;
        },
        function(newAttrs, oldAttrs) {
          if (newAttrs && newAttrs.attendees && newAttrs.attendees.length) {
            // Attendees have changed
            $q.all(_.values($ctrl.component.$attendees.$futureFreebusyData)).then(function() {
              $ctrl.onUpdate();
            });
          }
        },
        true // compare for object equality
      );
    };


    this.onUpdate = function () {
      // console.debug('dates or attendees changed -- refresh freebusy');
    };
  }


  angular
    .module('SOGo.SchedulerUI')
    .directive('sgFreebusy', sgFreebusy);
})();
/* -*- Mode: javascript; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

(function() {

  /*
   * sgFreebusyDay - A representation of the freebusy data for an attendee for one day.
   * @memberof SOGo.SchedulerUI
   * @restrict element
   * @param {string} sgDay - the day string
   * @param {object} sgAttendees - the Attendees object instance of the component
   * @param {object} sgAttendee - the object representing the attendee
   *
   * @example:

   <sg-freebusy-day
     ng-repeat="currentAttendee in component.attendees"
     sg-day="day.getDayString"
     sg-attendees="component.$attendees"
     sg-attendee="currentAttendee" />
  */
  function sgFreebusyDay() {
    return {
      restrict: 'E',
      require: '^^sgFreebusy',
      bindToController: {
        day: '=sgDay',
        attendees: '=sgAttendees',
        attendee: '=sgAttendee'
      },
      replace: true,
      template: function(tElement, tAttrs) {
        var template = [
          '<md-list-item>'
        ];
        for (var hour = 0; hour < 24; hour++) {
          template.push('  <div class="hour">');
          for (var quarter = 0; quarter < 4; quarter++) {
            template.push('    <div class="quarter">');
            template.push('      <div class="busy ng-hide"></div>');
            template.push('    </div>');
          }
          template.push('  </div>');
        }
        template.push('  <md-divider><!-- divider --></md-divider>');
        template.push('</md-list-item>');

        return template.join('');
      },
      link: postLink,
      controller: sgFreebusyDayController,
      controllerAs: '$ctrl'
    };

    function postLink(scope, element, attrs, parentController) {
      scope.parentController = parentController;
    }
  }

  /**
   * @ngInject
   */
  sgFreebusyDayController.$inject = ['$scope', '$element'];
  function sgFreebusyDayController($scope, $element) {
    var $ctrl = this;

    this.$postLink = function () {
      var hours = [], quarters = [], busys = [], parentControllerOnUpdate;

      this.parentController = $scope.parentController;
      parentControllerOnUpdate = this.parentController.onUpdate;

      _.forEach($element.find('div'), function(div) {
        if (div.className.startsWith('hour')) hours.push(div);
        else if (div.className.startsWith('quarter')) quarters.push(div);
        else if (div.className.startsWith('busy')) busys.push(div);
      });

      this.parentController.onUpdate = function () {
        var freebusys = $ctrl.attendee.uid ? $ctrl.attendee.freebusy[$ctrl.day] : null;

        if (!$ctrl.attendee.uid) {
          _.forEach(hours, function(div) {
            div.classList.add('sg-no-freebusy');
          });
        }

        for (var hour = 0; hour < 24; hour++) {
          for (var quarter = 0; quarter < 4; quarter++) {
            var index = hour * 4 + quarter;
            if ($ctrl.coversFreebusy(hour, quarter)) {
              quarters[index].classList.add('event');
            } else {
              quarters[index].classList.remove('event');
            }
            if (freebusys && freebusys[hour][quarter]) {
              busys[index].classList.remove('ng-hide');
            } else {
              busys[index].classList.add('ng-hide');
            }
          }
        }

        // Call original method on parent controller
        angular.bind($ctrl.parentController, parentControllerOnUpdate)();
      };
    };

    this.coversFreebusy = function (hour, quarter) {
      return $ctrl.attendees.coversFreeBusy($ctrl.day, hour, quarter);
    };
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgFreebusyDay', sgFreebusyDay);
})();
/* -*- Mode: js; indent-tabs-mode: nil; js-indent-level: 2 -*- */

(function() {
  /* jshint validthis: true */
  'use strict';

  /*
   * sgNowLine - Now line to be displayed on top of current day
   * @restrict class
  */
  function sgNowLine() {
    return {
      restrict: 'C',
      require: '^^sgCalendarScrollView',
      link: link,
      controller: sgNowLineController
    };

    function link(scope, iElement, iAttr, sgCalendarScrollViewCtrl) {
      function _getDays() {
        return iElement.find('sg-calendar-day');
      }
      function _getView() {
        return sgCalendarScrollViewCtrl.quarterHeight;
      }

      // We need to wait for the view to be compiled
      var _unwatchView = scope.$watch(_getView, function(quarterHeight) {
        if (quarterHeight) {
          _unwatchView(); // self release
          scope.quarterHeight = quarterHeight;
          // We need to wait for the days to be compiled
          var _unwatchDays = scope.$watch(_getDays, function(days) {
            if (days.length) {
              _unwatchDays(); // self release
              scope.days = days;
              // Draw the line
              scope.updateLine();
            }
          });
        }
      });
    }
  }

  /**
   * @ngInject
   */
  sgNowLineController.$inject = ['$scope', '$element', '$timeout', 'Preferences'];
  function sgNowLineController($scope, $element, $timeout, Preferences) {
    var _this = this, updater,
        scrollViewCtrl = $element.controller('sgCalendarScrollView');

    $scope.nowDay = null;
    $scope.lineElement = null;
    $scope.updateLine = _updateLine;

    $scope.$on('$destroy', function() {
      if (updater)
        $timeout.cancel(updater);
    });


    function _updateLine(force) {
      var now = new Date(), nowDay, hours, hourHeight, minutes, minuteHeight, position;

      // Adjust to user's timezone
      now.setTime(now.getTime() +
                  now.getTimezoneOffset() * 60 * 1000 +
                  Preferences.defaults.UserTimeZoneSecondsFromGMT * 1000);
      nowDay = now.getDayString();
      hours = now.getHours();
      hourHeight = $scope.quarterHeight * 4;
      minutes = now.getMinutes();
      minuteHeight = $scope.quarterHeight/15;
      position = parseInt(hours   * hourHeight   +
                          minutes * minuteHeight -
                          1);

      if (force || nowDay != $scope.nowDay) {
        if ($scope.lineElement)
          $scope.lineElement.remove();
        $scope.lineElement = _addLine(nowDay, $scope.days);
        $scope.nowDay = nowDay;
      }

      if ($scope.lineElement) {
        // Current day is displayed
        $scope.lineElement.css('top', position + "px");
        // Update line every minute
        updater = $timeout(angular.bind(_this, $scope.updateLine), 60000);
      }
    }

    function _addLine(nowDay, days) {
      var $lineElement = angular.element('<sg-now-line>');

      if (scrollViewCtrl.isMultiColumn) {
        // In multicolumn day view, the line must go over all columns
        if (days && days[0].attributes['sg-day'].value == nowDay)
          $element.append($lineElement);
      }
      else
        _.forEach(days, function(dayElement) {
          if (dayElement.attributes['sg-day'].value == nowDay) {
            angular.element(dayElement).find('div').eq(0).append($lineElement);
          }
        });

      return $lineElement;
    }
  }

  angular
    .module('SOGo.SchedulerUI')
    .directive('sgNowLine', sgNowLine);
})();
