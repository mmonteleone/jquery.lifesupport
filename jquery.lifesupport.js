/**
 * jQuery.lifesupport - Smart, simple, and secure session management plugin for jQuery
 *
 * version 0.9.0
 * 
 * http://michaelmonteleone.net/projects/lifesupport
 * http://github.com/mmonteleone/jquery.lifesupport
 *
 * Copyright (c) 2009 Michael Monteleone
 * Licensed under terms of the MIT License (README.markdown)
 */
(function($) {

    // namespace used for internal scoping of client activity events
    var eventNameSpace = '.lifesupport';
    
    // define stub refresh and logout methods to be implemented
    // at runtime when plugin applied against a selector
    // defined here so as to be available to static api
    var refresh = function() {};
    var logout = function() {};
    var halt = function() {};
    var timeRemaining = function() {};  
    var running = false;
    
    $.fn.extend({
        lifesupport: function(options) {
            // if already running, first halt any existing intances
            if(running) { halt(); }
            // set as running 
            running = true;
            
            var settings = $.extend({}, $.fn.lifesupport.defaults, options || {});

            var selection = this;
            var elapsedLifetime, elapsedWarningDuration, changeRaised;

            /**
             * Define a function to reset the internal state of lifesupport
             */
            var reset = function() {
                changeRaised = false;
                elapsedLifetime = 0;
                elapsedWarningDuration = 0;
            };

            // Go ahead and always reset.  Only one instance of lifesupport at once
            reset();

            /**
             * Refreshes the session by calling against the refresh 
             * URL via AJAX or executing the refresh lambda.  
             * Also triggers a refresh event
             */
            refresh = function() {
                selection.trigger('refresh');
                reset();
                if ($.isFunction(settings.refresh)) {
                    settings.refresh();
                } else {
                    $.get(settings.refresh, { req: Math.floor(Math.random() * 1000000000) });
                }
            };

            /**
             * Visibly terminates the session by redirecting 
             * client to the logout url (if defined), or executing the 
             * passed logout lambda function.
             * Also triggers a 'logout' event first.
             */
            logout = function() {
                selection.trigger('logout');
                if ($.isFunction(settings.logout)) {
                    reset();
                    settings.logout();
                } else {
                    reset();
                    if($.safetynet !== undefined && $.safetynet.suppressed !== undefined) {
                        $.safetynet.suppressed(true);
                    }
                    settings.window.location = settings.logout;
                }
            };

            /**
             * Main clock cycle.  
             * Increments epalsed times of both the lifetime and warning threshold periods.
             * Triggers warns and logouts if necessary
             */
            var tick = function() {
                if (elapsedLifetime + 1 < settings.lifetime) {
                    elapsedLifetime++;
                    if (elapsedLifetime + 1 > settings.lifetime - settings.warnAt && !changeRaised) {
                        if (elapsedWarningDuration === 0) { selection.trigger('warn'); }
                        selection.trigger('warnIncrement', [settings.warnAt - elapsedWarningDuration]);
                        elapsedWarningDuration++;
                    }
                } else {
                    logout();
                }
            };

            /**
             * Secondary cycle responsible for calling refresh whenever
             * client activity has been observed during the cycle
             * Acts a buffer to keep refreshes from occurring after 
             * every observed bit of activity
             */
            var refreshTick = function() {
                if (changeRaised) {
                    refresh();
                }
            };

            // bind default events to raise changes
            $.each(settings.events.split(','), function() {
                selection.bind(this + eventNameSpace, function() {
                    // raise a change to be refreshed on next refresh tick cycle
                    changeRaised = true;

                    // if currently in warning period, don't wait for refresh 
                    // tick cycle to perform the actual refresh, since it could be urgent
                    if (elapsedWarningDuration > 0) {
                        refresh();
                    }
                });
            });

            // set both clock cycles
            var tickInterval = settings.window.setInterval(tick, settings.clockCycle);
            var refreshInterval = settings.window.setInterval(refreshTick, settings.refreshEvery * settings.clockCycle);
                
            /**
             * Halts all behavior of lifesupport, as if it had never been instantiated
             */
            halt = function() {
                settings.window.clearInterval(tickInterval);
                settings.window.clearInterval(refreshInterval);
                $(document).unbind(eventNameSpace);                                
                reset();
            };
            
            /**
             * Returns the current remaining seconds before a logout would occur
             */
            timeRemaining = function() {
                return settings.lifetime - elapsedLifetime;
            };

            return selection;
        }
    });

    // provide an alias to $(document).lifesupport since that's the most common 
    // instantiation pattern
    $.extend({
        lifesupport: function(options) { $(document).lifesupport(options); }
    });

    // static api for directly manipulating lifesupport
    $.extend($.lifesupport, {
        stop: function() { halt(); },
        refresh: function() { refresh(); },
        logout: function() { logout(); },
        timeRemaining: function() { return timeRemaining(); }
    });

    // set some default options
    $.extend($.fn.lifesupport, {
        version: '0.9.1',
        defaults: {
            refresh: function() { }, // either A URL to be requested against via 
                                     // AJAX, or an anonymous function to be
                                     // executed upon refreshing of the user's session.
            logout: function() { },  // either a URL to be redirected to, or an
                                     // anonymous function to be executed upon 
                                     // termination of the user's session
            lifetime: 1200,  // number of consecutive inactive seconds which can 
                             // pass before logging out.  This should be set equal 
                             // to or less than the seconds the application sets as 
                             // the lifetime on the user's cookie.
            warnAt: 60,  // number of seconds before a `logout` to begin raising 
                         // the `warn` and `warnIncrement` events
            refreshEvery: 120,  //length of the activity monitoring cycle in seconds, 
                                // during which any observed client activity will 
                                // cause a refresh to occur at the end of the cycle.
            events: 'click,scroll,resize,keyup', //list of DOM events which the refresh 
                                                 // cycle will consider to infer 
                                                 // client-side user activity
            clockCycle: 1000,  // clock ticks defaul to 1000 ms (1 second),
            window: window // allow window dependency to be injected for testing
        }
    });

})(jQuery);
